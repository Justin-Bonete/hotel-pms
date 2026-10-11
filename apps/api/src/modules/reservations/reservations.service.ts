import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { randomBytes } from 'node:crypto';
import {
  ACTION_FROM,
  ACTION_RESULT,
  EDITABLE_STATUSES,
  HOLDING_STATUSES,
  formatMoney,
  nightsBetween,
  parseDate,
  quoteStay,
  toDateString,
  todayIn,
  addDays,
  type AvailabilityView,
  type CalendarView,
  type ReservationView,
} from '@pms/types';
import type { CreateReservationInput, RangeQuery, ReservationsQuery, TransitionInput, UpdateReservationInput } from '@pms/validation';
import type { AccessContext } from '../../common/access/access-context';
import { assertCan } from '../../common/access/assert-access';
import { changedFields } from '../../common/audit/changed-fields';
import { HttpStatus } from '@nestjs/common';
import { AppException } from '../../common/http/app-exception';
import { badRequest, conflict, notFound } from '../../common/http/errors';
import { Paginated } from '../../common/http/response.interceptor';
import { emptyToNull } from '../../common/text/text';
import { PrismaService, Tx } from '../../database/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { FolioLedger } from '../folios/folio-ledger.service';
import { canBook, nightlyAvailability } from './availability';
import { reservationDetailInclude, reservationInclude, toReservationView } from './reservation.mapper';

const MAX_NIGHTS = 365;
const READY_ROOM_STATUSES = ['AVAILABLE', 'INSPECTED'];
const label = (value: string): string => value.toLowerCase().replace(/_/g, ' ');

@Injectable()
export class ReservationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly ledger: FolioLedger,
  ) {}

  // ================================================================ reads
  async list(query: ReservationsQuery, access: AccessContext): Promise<Paginated<ReservationView>> {
    const scope = access.scopeOf('reservation.read');
    const empty = new Paginated<ReservationView>([], { page: query.page, pageSize: query.pageSize, total: 0 });
    if (!scope.all && scope.ids.size === 0) return empty;

    const propertyFilter: Prisma.ReservationWhereInput = query.propertyId
      ? access.can('reservation.read', query.propertyId)
        ? { propertyId: query.propertyId }
        : { id: { in: [] } }
      : scope.all
        ? {}
        : { propertyId: { in: [...scope.ids] } };

    const search = query.search?.trim();
    const where: Prisma.ReservationWhereInput = {
      AND: [
        propertyFilter,
        query.status ? { status: query.status } : {},
        query.from ? { arrivalDate: { gte: parseDate(query.from) } } : {},
        query.to ? { arrivalDate: { lte: parseDate(query.to) } } : {},
        search
          ? {
              OR: [
                { code: { contains: search, mode: 'insensitive' as const } },
                { guest: { firstName: { contains: search, mode: 'insensitive' as const } } },
                { guest: { lastName: { contains: search, mode: 'insensitive' as const } } },
              ],
            }
          : {},
      ],
    };

    const { rows, total } = await this.prisma.forTenant(async (tx) => {
      const [rows, total] = await Promise.all([
        tx.reservation.findMany({
          where,
          orderBy: [{ arrivalDate: 'desc' }, { createdAt: 'desc' }],
          skip: (query.page - 1) * query.pageSize,
          take: query.pageSize,
          include: reservationInclude,
        }),
        tx.reservation.count({ where }),
      ]);
      return { rows, total };
    });
    return new Paginated(rows.map(toReservationView), { page: query.page, pageSize: query.pageSize, total });
  }

  async get(id: string, access: AccessContext): Promise<ReservationView> {
    const row = await this.prisma.forTenant((tx) => tx.reservation.findFirst({ where: { id }, include: reservationInclude }));
    if (!row) throw notFound('Reservation');
    assertCan(access, 'reservation.read', row.propertyId);
    return toReservationView(row);
  }

  async calendar(propertyId: string, query: RangeQuery, access: AccessContext): Promise<CalendarView> {
    assertCan(access, 'reservation.read', propertyId);
    const to = addDays(query.from, query.days);
    return this.prisma.forTenant(async (tx) => {
      const property = await this.requireProperty(tx, propertyId);
      const [rooms, reservations] = await Promise.all([
        tx.room.findMany({
          where: { propertyId, deletedAt: null },
          orderBy: { number: 'asc' },
          include: { roomType: { select: { name: true } }, floor: { select: { level: true } } },
        }),
        tx.reservation.findMany({
          where: {
            propertyId,
            status: { in: ['PENDING', 'CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT'] },
            arrivalDate: { lt: parseDate(to) },
            departureDate: { gt: parseDate(query.from) },
          },
          orderBy: { arrivalDate: 'asc' },
          include: { guest: { select: { firstName: true, lastName: true } }, roomType: { select: { name: true } } },
        }),
      ]);
      return {
        from: query.from,
        days: query.days,
        today: todayIn(property.timezone),
        rooms: rooms.map((r) => ({ id: r.id, number: r.number, roomTypeId: r.roomTypeId, roomTypeName: r.roomType.name, floorLevel: r.floor?.level ?? null })),
        reservations: reservations.map((r) => ({
          id: r.id,
          code: r.code,
          status: r.status,
          guestName: `${r.guest.firstName} ${r.guest.lastName}`,
          roomId: r.roomId,
          roomTypeId: r.roomTypeId,
          roomTypeName: r.roomType.name,
          arrivalDate: toDateString(r.arrivalDate),
          departureDate: toDateString(r.departureDate),
          adults: r.adults,
          children: r.children,
        })),
      };
    });
  }

  async availability(propertyId: string, query: RangeQuery, access: AccessContext): Promise<AvailabilityView> {
    assertCan(access, 'reservation.read', propertyId);
    const to = addDays(query.from, query.days);
    return this.prisma.forTenant(async (tx) => {
      await this.requireProperty(tx, propertyId);
      const [types, counts, reservations] = await Promise.all([
        tx.roomType.findMany({ where: { propertyId, deletedAt: null }, orderBy: { name: 'asc' }, select: { id: true, name: true } }),
        tx.room.groupBy({ by: ['roomTypeId'], where: { propertyId, deletedAt: null }, _count: { _all: true } }),
        tx.reservation.findMany({
          where: { propertyId, status: { in: [...HOLDING_STATUSES] }, arrivalDate: { lt: parseDate(to) }, departureDate: { gt: parseDate(query.from) } },
          select: { roomTypeId: true, arrivalDate: true, departureDate: true },
        }),
      ]);
      const totalByType = new Map(counts.map((c) => [c.roomTypeId, c._count._all]));
      return {
        from: query.from,
        days: query.days,
        roomTypes: types.map((t) => {
          const totalRooms = totalByType.get(t.id) ?? 0;
          const mine = reservations.filter((r) => r.roomTypeId === t.id).map((r) => ({ arrivalDate: toDateString(r.arrivalDate), departureDate: toDateString(r.departureDate) }));
          return { roomTypeId: t.id, roomTypeName: t.name, totalRooms, nights: nightlyAvailability({ totalRooms, reservations: mine, from: query.from, days: query.days }) };
        }),
      };
    });
  }

  // ================================================================ create
  async create(propertyId: string, dto: CreateReservationInput, access: AccessContext): Promise<ReservationView> {
    assertCan(access, 'reservation.manage', propertyId);
    return this.prisma.forTenant(async (tx) => {
      const property = await this.requireProperty(tx, propertyId);
      const today = todayIn(property.timezone);
      if (dto.arrivalDate < today) throw badRequest('ARRIVAL_IN_PAST', `Arrival can't be before today (${today}).`);
      const nights = nightsBetween(dto.arrivalDate, dto.departureDate);
      if (nights > MAX_NIGHTS) throw badRequest('STAY_TOO_LONG', `A stay can't be longer than ${MAX_NIGHTS} nights.`);

      const roomType = await tx.roomType.findFirst({ where: { id: dto.roomTypeId, propertyId, deletedAt: null } });
      if (!roomType) throw badRequest('INVALID_ROOM_TYPE', 'That room type does not belong to this property.');
      if (dto.adults + dto.children > roomType.maxOccupancy) {
        throw badRequest('OVER_CAPACITY', `${roomType.name} sleeps at most ${roomType.maxOccupancy} guests.`);
      }

      const { plan, quote } = await this.resolveQuote(tx, propertyId, roomType.id, roomType.name, dto.ratePlanId, dto.arrivalDate, dto.departureDate);
      const guestId = await this.resolveGuest(tx, dto, access);

      if (dto.status !== 'INQUIRY') {
        await this.ensureAvailability(tx, { propertyId, roomTypeId: roomType.id, typeName: roomType.name, arrival: dto.arrivalDate, departure: dto.departureDate });
      }

      const row = await tx.reservation.create({
        data: {
          organizationId: access.organizationId,
          propertyId,
          code: await this.newCode(tx),
          guestId,
          roomTypeId: roomType.id,
          ratePlanId: plan.id,
          status: dto.status,
          source: dto.source,
          arrivalDate: parseDate(dto.arrivalDate),
          departureDate: parseDate(dto.departureDate),
          adults: dto.adults,
          children: dto.children,
          nights: quote.nights,
          totalMinor: quote.totalMinor,
          nightlyRates: quote.perNight.map((n) => n.rateMinor),
          currency: property.currency,
          specialRequests: emptyToNull(dto.specialRequests) ?? null,
          notes: emptyToNull(dto.notes) ?? null,
          createdById: access.userId,
        },
        include: reservationInclude,
      });
      await this.audit.record(tx, {
        organizationId: access.organizationId,
        actorId: access.userId,
        propertyId,
        action: 'reservation.created',
        entity: 'reservation',
        entityId: row.id,
        after: { code: row.code, status: row.status, arrival: dto.arrivalDate, departure: dto.departureDate, roomType: roomType.name, totalMinor: quote.totalMinor },
      });
      return toReservationView(row);
    });
  }

  // ================================================================ update
  async update(id: string, dto: UpdateReservationInput, access: AccessContext): Promise<ReservationView> {
    return this.prisma.forTenant(async (tx) => {
      const r = await tx.reservation.findFirst({ where: { id }, include: reservationDetailInclude });
      if (!r) throw notFound('Reservation');
      assertCan(access, 'reservation.manage', r.propertyId);
      if (!EDITABLE_STATUSES.includes(r.status)) {
        throw conflict('NOT_EDITABLE', `A ${label(r.status)} reservation can't be edited.`);
      }

      const arrival = dto.arrivalDate ?? toDateString(r.arrivalDate);
      const departure = dto.departureDate ?? toDateString(r.departureDate);
      const datesChanged = arrival !== toDateString(r.arrivalDate) || departure !== toDateString(r.departureDate);
      if (departure <= arrival) throw badRequest('INVALID_DATES', 'Departure must be after arrival.');
      if (datesChanged && arrival < todayIn(r.property.timezone)) throw badRequest('ARRIVAL_IN_PAST', "Arrival can't be before today.");
      if (nightsBetween(arrival, departure) > MAX_NIGHTS) throw badRequest('STAY_TOO_LONG', `A stay can't be longer than ${MAX_NIGHTS} nights.`);

      const adults = dto.adults ?? r.adults;
      const children = dto.children ?? r.children;
      if (adults < 1) throw badRequest('INVALID_GUESTS', 'At least 1 adult is required.');
      if (adults + children > (await this.roomTypeCapacity(tx, r.roomTypeId))) throw badRequest('OVER_CAPACITY', 'That is more guests than this room type sleeps.');

      const { plan, quote } = await this.resolveQuote(tx, r.propertyId, r.roomTypeId, r.roomType.name, dto.ratePlanId ?? r.ratePlanId ?? undefined, arrival, departure);

      if (datesChanged && HOLDING_STATUSES.includes(r.status)) {
        await this.ensureAvailability(tx, { propertyId: r.propertyId, roomTypeId: r.roomTypeId, typeName: r.roomType.name, arrival, departure, excludeId: id });
        if (r.roomId) await this.ensureRoomFree(tx, { roomId: r.roomId, roomNumber: r.room?.number ?? '', arrival, departure, excludeId: id });
      }

      const row = await tx.reservation.update({
        where: { id },
        data: {
          arrivalDate: parseDate(arrival),
          departureDate: parseDate(departure),
          adults,
          children,
          ratePlanId: plan.id,
          nights: quote.nights,
          totalMinor: quote.totalMinor,
          nightlyRates: quote.perNight.map((n) => n.rateMinor),
          ...(dto.specialRequests !== undefined ? { specialRequests: emptyToNull(dto.specialRequests) } : {}),
          ...(dto.notes !== undefined ? { notes: emptyToNull(dto.notes) } : {}),
        },
        include: reservationInclude,
      });
      const diff = changedFields<Record<string, unknown>>(r, row, ['arrivalDate', 'departureDate', 'adults', 'children', 'ratePlanId', 'totalMinor', 'specialRequests', 'notes']);
      if (diff.changed.length > 0) {
        await this.audit.record(tx, { organizationId: access.organizationId, actorId: access.userId, propertyId: r.propertyId, action: 'reservation.updated', entity: 'reservation', entityId: id, before: diff.before, after: diff.after });
      }
      return toReservationView(row);
    });
  }

  // ================================================================ status flow
  async transition(id: string, dto: TransitionInput, access: AccessContext): Promise<ReservationView> {
    return this.prisma.forTenant(async (tx) => {
      const r = await tx.reservation.findFirst({ where: { id }, include: reservationDetailInclude });
      if (!r) throw notFound('Reservation');

      const needed = dto.action === 'check_in' || dto.action === 'check_out' ? 'reservation.check_in' : 'reservation.manage';
      assertCan(access, needed, r.propertyId);

      if (!ACTION_FROM[dto.action].includes(r.status)) {
        throw conflict('INVALID_TRANSITION', `This reservation is ${label(r.status)}, so you can't ${label(dto.action)}.`);
      }

      const now = new Date();
      const today = todayIn(r.property.timezone);
      const arrival = toDateString(r.arrivalDate);
      const departure = toDateString(r.departureDate);
      const data: Prisma.ReservationUncheckedUpdateInput = {};
      let roomToDirty: { id: string; number: string } | null = null;
      let checkInRoomNumber = r.room?.number ?? '';
      let folioToClose: string | null = null;
      let overriddenBalance: number | null = null;

      switch (dto.action) {
        case 'confirm':
          if (r.status === 'INQUIRY') {
            await this.ensureAvailability(tx, { propertyId: r.propertyId, roomTypeId: r.roomTypeId, typeName: r.roomType.name, arrival, departure, excludeId: id });
          }
          break;

        case 'cancel':
          data.cancelledAt = now;
          data.cancelReason = emptyToNull(dto.reason) ?? null;
          break;

        case 'no_show':
          if (today < arrival) throw conflict('TOO_EARLY', `A no-show can only be recorded from the arrival date (${arrival}).`);
          break;

        case 'assign_room': {
          if (!dto.roomId) throw badRequest('ROOM_REQUIRED', 'Choose a room.');
          const room = await this.validateRoom(tx, r, dto.roomId);
          if (r.status === 'CHECKED_IN') {
            this.assertRoomReady(room);
            if (r.roomId && r.roomId !== room.id) roomToDirty = { id: r.roomId, number: r.room?.number ?? '' };
          }
          data.roomId = room.id;
          break;
        }

        case 'unassign_room':
          data.roomId = null;
          break;

        case 'check_in': {
          if (today < arrival) throw conflict('TOO_EARLY', `Check-in opens on the arrival date (${arrival}).`);
          if (today >= departure) throw conflict('STAY_ENDED', 'The departure date has passed, so this stay can no longer be checked in.');
          const roomId = dto.roomId ?? r.roomId;
          if (!roomId) throw badRequest('ROOM_REQUIRED', 'Choose a room to check this guest into.');
          const room = await this.validateRoom(tx, r, roomId);
          this.assertRoomReady(room);
          data.roomId = room.id;
          data.checkedInAt = now;
          checkInRoomNumber = room.number;
          break;
        }

        case 'check_out': {
          // Bill any nights not yet posted (stays checked in before billing existed), then require a settled folio.
          const stay = this.stayForBilling(r, r.room?.number ?? '');
          const folio = await this.ledger.ensureFolio(tx, stay);
          await this.ledger.postRoomCharges(tx, stay, access.userId);
          const { balanceMinor } = await this.ledger.balance(tx, folio.id);
          if (balanceMinor !== 0) {
            if (dto.overrideBalance) {
              if (!access.can('folio.override_checkout', r.propertyId)) {
                throw new AppException('FORBIDDEN', 'Only a manager can check a guest out with an unsettled balance.', HttpStatus.FORBIDDEN);
              }
              overriddenBalance = balanceMinor;
            } else if (balanceMinor > 0) {
              throw conflict('BALANCE_DUE', `${formatMoney(balanceMinor, r.currency)} is still owed. Record the payment before checking out.`);
            } else {
              throw conflict('CREDIT_REMAINING', `The guest is in credit by ${formatMoney(-balanceMinor, r.currency)}. Refund it before checking out.`);
            }
          }
          folioToClose = folio.id;
          data.checkedOutAt = now;
          if (r.roomId) roomToDirty = { id: r.roomId, number: r.room?.number ?? '' };
          break;
        }
      }

      const result = ACTION_RESULT[dto.action];
      if (result) data.status = result;

      // Compare-and-set: refuse instead of overwriting if someone else just changed this reservation.
      const updated = await tx.reservation.updateMany({ where: { id, status: r.status }, data });
      if (updated.count === 0) throw conflict('RESERVATION_CHANGED', 'Someone else just changed this reservation. Refresh and try again.');

      if (dto.action === 'check_in') {
        await this.ledger.postRoomCharges(tx, this.stayForBilling(r, checkInRoomNumber), access.userId);
      }
      if (folioToClose) await this.ledger.close(tx, folioToClose);

      if (roomToDirty) {
        const changed = await tx.room.updateMany({
          where: { id: roomToDirty.id, status: { not: 'DIRTY' } },
          data: { status: 'DIRTY', statusNote: dto.action === 'check_out' ? 'Guest checked out' : 'Guest moved to another room', statusChangedAt: now },
        });
        if (changed.count > 0) {
          await this.audit.record(tx, {
            organizationId: access.organizationId,
            actorId: access.userId,
            propertyId: r.propertyId,
            action: 'room.status_changed',
            entity: 'room',
            entityId: roomToDirty.id,
            before: { number: roomToDirty.number },
            after: { number: roomToDirty.number, status: 'DIRTY', note: `Triggered by ${label(dto.action)} of reservation ${r.code}` },
          });
        }
      }

      await this.audit.record(tx, {
        organizationId: access.organizationId,
        actorId: access.userId,
        propertyId: r.propertyId,
        action: `reservation.${dto.action}`,
        entity: 'reservation',
        entityId: id,
        before: { code: r.code, status: r.status, room: r.room?.number ?? null },
        after: {
          status: result ?? r.status,
          reason: emptyToNull(dto.reason) ?? null,
          ...(overriddenBalance !== null ? { checkedOutWithBalance: formatMoney(overriddenBalance, r.currency) } : {}),
        },
      });

      const fresh = await tx.reservation.findFirstOrThrow({ where: { id }, include: reservationInclude });
      return toReservationView(fresh);
    });
  }

  // ================================================================ internals
  private stayForBilling(
    r: { id: string; organizationId: string; propertyId: string; currency: string; arrivalDate: Date; departureDate: Date; totalMinor: number; nightlyRates: unknown; roomType: { name: string } },
    roomNumber: string,
  ) {
    return {
      id: r.id,
      organizationId: r.organizationId,
      propertyId: r.propertyId,
      currency: r.currency,
      arrivalDate: r.arrivalDate,
      departureDate: r.departureDate,
      totalMinor: r.totalMinor,
      nightlyRates: r.nightlyRates,
      roomNumber,
      roomTypeName: r.roomType.name,
    };
  }

  private async requireProperty(tx: Tx, propertyId: string) {
    const property = await tx.property.findFirst({ where: { id: propertyId, deletedAt: null }, select: { id: true, name: true, timezone: true, currency: true } });
    if (!property) throw notFound('Property');
    return property;
  }

  private async roomTypeCapacity(tx: Tx, roomTypeId: string): Promise<number> {
    return (await tx.roomType.findFirstOrThrow({ where: { id: roomTypeId }, select: { maxOccupancy: true } })).maxOccupancy;
  }

  /** The rate plan (given, or the property's default) must have a rate for this room type. */
  private async resolveQuote(tx: Tx, propertyId: string, roomTypeId: string, typeName: string, ratePlanId: string | undefined, arrival: string, departure: string) {
    const plan = await tx.ratePlan.findFirst({
      where: { propertyId, deletedAt: null, ...(ratePlanId ? { id: ratePlanId } : { isDefault: true }) },
      include: { rates: { where: { roomTypeId } } },
    });
    if (!plan) throw badRequest('NO_RATE_PLAN', ratePlanId ? 'That rate plan does not belong to this property.' : 'This property has no default rate plan yet. Create one in Rooms → Rates first.');
    const rate = plan.rates[0];
    if (!rate) throw badRequest('NO_RATE', `"${plan.name}" has no rate for ${typeName}. Add one in Rooms → Rates.`);
    return { plan, quote: quoteStay(arrival, departure, { nightlyRateMinor: rate.nightlyRateMinor, weekendRateMinor: rate.weekendRateMinor }) };
  }

  private async resolveGuest(tx: Tx, dto: CreateReservationInput, access: AccessContext): Promise<string> {
    if (dto.guestId) {
      const guest = await tx.guest.findFirst({ where: { id: dto.guestId, deletedAt: null }, select: { id: true } });
      if (!guest) throw badRequest('INVALID_GUEST', 'That guest was not found.');
      return guest.id;
    }
    const g = dto.newGuest!;
    const email = emptyToNull(g.email) ?? null;
    if (email && (await tx.guest.findFirst({ where: { email: { equals: email, mode: 'insensitive' }, deletedAt: null }, select: { id: true } }))) {
      throw conflict('GUEST_EMAIL_EXISTS', 'A guest with this email already exists. Search for them instead of adding a duplicate.');
    }
    const created = await tx.guest.create({
      data: {
        organizationId: access.organizationId,
        firstName: g.firstName,
        lastName: g.lastName,
        email,
        phone: emptyToNull(g.phone) ?? null,
        country: emptyToNull(g.country)?.toUpperCase() ?? null,
        preferences: emptyToNull(g.preferences) ?? null,
        notes: emptyToNull(g.notes) ?? null,
        isVip: g.isVip,
      },
      select: { id: true },
    });
    await this.audit.record(tx, { organizationId: access.organizationId, actorId: access.userId, action: 'guest.created', entity: 'guest', entityId: created.id, after: { name: `${g.firstName} ${g.lastName}`, via: 'reservation' } });
    return created.id;
  }

  /**
   * Room-type inventory: every night of the stay needs at least one free room. A per-room-type advisory
   * lock makes two simultaneous bookings take turns, so the last room can't be sold twice.
   */
  private async ensureAvailability(tx: Tx, a: { propertyId: string; roomTypeId: string; typeName: string; arrival: string; departure: string; excludeId?: string }): Promise<void> {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${'res:' + a.roomTypeId}))`;
    const [totalRooms, overlapping] = await Promise.all([
      tx.room.count({ where: { propertyId: a.propertyId, roomTypeId: a.roomTypeId, deletedAt: null } }),
      tx.reservation.findMany({
        where: {
          propertyId: a.propertyId,
          roomTypeId: a.roomTypeId,
          status: { in: [...HOLDING_STATUSES] },
          ...(a.excludeId ? { id: { not: a.excludeId } } : {}),
          arrivalDate: { lt: parseDate(a.departure) },
          departureDate: { gt: parseDate(a.arrival) },
        },
        select: { arrivalDate: true, departureDate: true },
      }),
    ]);
    const nights = nightlyAvailability({
      totalRooms,
      reservations: overlapping.map((o) => ({ arrivalDate: toDateString(o.arrivalDate), departureDate: toDateString(o.departureDate) })),
      from: a.arrival,
      days: nightsBetween(a.arrival, a.departure),
    });
    if (!canBook(nights)) {
      const firstFull = nights.find((n) => n.available < 1);
      throw conflict('NO_AVAILABILITY', `No ${a.typeName} rooms are available for those dates (full on ${firstFull?.date}).`);
    }
  }

  private async ensureRoomFree(tx: Tx, a: { roomId: string; roomNumber: string; arrival: string; departure: string; excludeId: string }): Promise<void> {
    const clash = await tx.reservation.count({
      where: {
        roomId: a.roomId,
        id: { not: a.excludeId },
        status: { in: [...HOLDING_STATUSES] },
        arrivalDate: { lt: parseDate(a.departure) },
        departureDate: { gt: parseDate(a.arrival) },
      },
    });
    if (clash > 0) throw conflict('ROOM_UNAVAILABLE', `Room ${a.roomNumber} is already booked for those dates.`);
  }

  private async validateRoom(tx: Tx, r: { id: string; propertyId: string; roomTypeId: string; status: string; arrivalDate: Date; departureDate: Date }, roomId: string) {
    const room = await tx.room.findFirst({ where: { id: roomId, propertyId: r.propertyId, deletedAt: null } });
    if (!room) throw badRequest('INVALID_ROOM', 'That room does not belong to this property.');
    if (r.status !== 'CHECKED_IN' && room.roomTypeId !== r.roomTypeId) {
      throw badRequest('ROOM_TYPE_MISMATCH', 'Choose a room of the booked room type.');
    }
    await this.ensureRoomFree(tx, { roomId: room.id, roomNumber: room.number, arrival: toDateString(r.arrivalDate), departure: toDateString(r.departureDate), excludeId: r.id });
    return room;
  }

  private assertRoomReady(room: { number: string; status: string }): void {
    if (!READY_ROOM_STATUSES.includes(room.status)) {
      throw conflict('ROOM_NOT_READY', `Room ${room.number} is ${label(room.status)}, so a guest can't go in yet.`);
    }
  }

  private async newCode(tx: Tx): Promise<string> {
    for (let i = 0; i < 6; i++) {
      const code = `R${randomBytes(4).toString('hex').toUpperCase()}`;
      if (!(await tx.reservation.findFirst({ where: { code }, select: { id: true } }))) return code;
    }
    throw conflict('CODE_UNAVAILABLE', 'Could not generate a reservation code. Please try again.');
  }
}
