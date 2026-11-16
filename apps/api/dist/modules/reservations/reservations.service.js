"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReservationsService = void 0;
const common_1 = require("@nestjs/common");
const node_crypto_1 = require("node:crypto");
const types_1 = require("@pms/types");
const assert_access_1 = require("../../common/access/assert-access");
const changed_fields_1 = require("../../common/audit/changed-fields");
const common_2 = require("@nestjs/common");
const app_exception_1 = require("../../common/http/app-exception");
const errors_1 = require("../../common/http/errors");
const response_interceptor_1 = require("../../common/http/response.interceptor");
const text_1 = require("../../common/text/text");
const prisma_service_1 = require("../../database/prisma/prisma.service");
const audit_service_1 = require("../audit/audit.service");
const folio_ledger_service_1 = require("../folios/folio-ledger.service");
const housekeeping_automation_service_1 = require("../housekeeping/housekeeping-automation.service");
const webhooks_service_1 = require("../webhooks/webhooks.service");
const webhook_events_1 = require("../webhooks/webhook-events");
const realtime_service_1 = require("../realtime/realtime.service");
const availability_1 = require("./availability");
const reservation_mapper_1 = require("./reservation.mapper");
const MAX_NIGHTS = 365;
const READY_ROOM_STATUSES = types_1.READY_ROOM_STATUSES;
const label = (value) => value.toLowerCase().replace(/_/g, ' ');
let ReservationsService = class ReservationsService {
    prisma;
    audit;
    ledger;
    realtime;
    housekeeping;
    webhooks;
    constructor(prisma, audit, ledger, realtime, housekeeping, webhooks) {
        this.prisma = prisma;
        this.audit = audit;
        this.ledger = ledger;
        this.realtime = realtime;
        this.housekeeping = housekeeping;
        this.webhooks = webhooks;
    }
    // ================================================================ reads
    async list(query, access) {
        const scope = access.scopeOf('reservation.read');
        const empty = new response_interceptor_1.Paginated([], { page: query.page, pageSize: query.pageSize, total: 0 });
        if (!scope.all && scope.ids.size === 0)
            return empty;
        const propertyFilter = query.propertyId
            ? access.can('reservation.read', query.propertyId)
                ? { propertyId: query.propertyId }
                : { id: { in: [] } }
            : scope.all
                ? {}
                : { propertyId: { in: [...scope.ids] } };
        const search = query.search?.trim();
        const where = {
            AND: [
                propertyFilter,
                query.status ? { status: query.status } : {},
                query.from ? { arrivalDate: { gte: (0, types_1.parseDate)(query.from) } } : {},
                query.to ? { arrivalDate: { lte: (0, types_1.parseDate)(query.to) } } : {},
                search
                    ? {
                        OR: [
                            { code: { contains: search, mode: 'insensitive' } },
                            { guest: { firstName: { contains: search, mode: 'insensitive' } } },
                            { guest: { lastName: { contains: search, mode: 'insensitive' } } },
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
                    include: reservation_mapper_1.reservationInclude,
                }),
                tx.reservation.count({ where }),
            ]);
            return { rows, total };
        });
        return new response_interceptor_1.Paginated(rows.map(reservation_mapper_1.toReservationView), { page: query.page, pageSize: query.pageSize, total });
    }
    async get(id, access) {
        const row = await this.prisma.forTenant((tx) => tx.reservation.findFirst({ where: { id }, include: reservation_mapper_1.reservationInclude }));
        if (!row)
            throw (0, errors_1.notFound)('Reservation');
        (0, assert_access_1.assertCan)(access, 'reservation.read', row.propertyId);
        return (0, reservation_mapper_1.toReservationView)(row);
    }
    async calendar(propertyId, query, access) {
        (0, assert_access_1.assertCan)(access, 'reservation.read', propertyId);
        const to = (0, types_1.addDays)(query.from, query.days);
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
                        arrivalDate: { lt: (0, types_1.parseDate)(to) },
                        departureDate: { gt: (0, types_1.parseDate)(query.from) },
                    },
                    orderBy: { arrivalDate: 'asc' },
                    include: { guest: { select: { firstName: true, lastName: true } }, roomType: { select: { name: true } } },
                }),
            ]);
            return {
                from: query.from,
                days: query.days,
                today: (0, types_1.todayIn)(property.timezone),
                rooms: rooms.map((r) => ({ id: r.id, number: r.number, roomTypeId: r.roomTypeId, roomTypeName: r.roomType.name, floorLevel: r.floor?.level ?? null })),
                reservations: reservations.map((r) => ({
                    id: r.id,
                    code: r.code,
                    status: r.status,
                    guestName: `${r.guest.firstName} ${r.guest.lastName}`,
                    roomId: r.roomId,
                    roomTypeId: r.roomTypeId,
                    roomTypeName: r.roomType.name,
                    arrivalDate: (0, types_1.toDateString)(r.arrivalDate),
                    departureDate: (0, types_1.toDateString)(r.departureDate),
                    adults: r.adults,
                    children: r.children,
                })),
            };
        });
    }
    async availability(propertyId, query, access) {
        (0, assert_access_1.assertCan)(access, 'reservation.read', propertyId);
        const to = (0, types_1.addDays)(query.from, query.days);
        return this.prisma.forTenant(async (tx) => {
            await this.requireProperty(tx, propertyId);
            const [types, counts, reservations] = await Promise.all([
                tx.roomType.findMany({ where: { propertyId, deletedAt: null }, orderBy: { name: 'asc' }, select: { id: true, name: true } }),
                tx.room.groupBy({ by: ['roomTypeId'], where: { propertyId, deletedAt: null }, _count: { _all: true } }),
                tx.reservation.findMany({
                    where: { propertyId, status: { in: [...types_1.HOLDING_STATUSES] }, arrivalDate: { lt: (0, types_1.parseDate)(to) }, departureDate: { gt: (0, types_1.parseDate)(query.from) } },
                    select: { roomTypeId: true, arrivalDate: true, departureDate: true },
                }),
            ]);
            const totalByType = new Map(counts.map((c) => [c.roomTypeId, c._count._all]));
            return {
                from: query.from,
                days: query.days,
                roomTypes: types.map((t) => {
                    const totalRooms = totalByType.get(t.id) ?? 0;
                    const mine = reservations.filter((r) => r.roomTypeId === t.id).map((r) => ({ arrivalDate: (0, types_1.toDateString)(r.arrivalDate), departureDate: (0, types_1.toDateString)(r.departureDate) }));
                    return { roomTypeId: t.id, roomTypeName: t.name, totalRooms, nights: (0, availability_1.nightlyAvailability)({ totalRooms, reservations: mine, from: query.from, days: query.days }) };
                }),
            };
        });
    }
    // ================================================================ create
    async create(propertyId, dto, access) {
        (0, assert_access_1.assertCan)(access, 'reservation.manage', propertyId);
        return this.createAs({ organizationId: access.organizationId, userId: access.userId }, propertyId, dto);
    }
    /**
     * The one place a reservation is created. `actor.userId` is null (and `via` says which API key) when the booking comes
     * from the public booking API, so the audit trail never blames a staff member for something they did not do.
     */
    async createAs(actor, propertyId, dto) {
        return this.prisma.forOrganization(actor.organizationId, async (tx) => {
            const property = await this.requireProperty(tx, propertyId);
            const today = (0, types_1.todayIn)(property.timezone);
            if (dto.arrivalDate < today)
                throw (0, errors_1.badRequest)('ARRIVAL_IN_PAST', `Arrival can't be before today (${today}).`);
            const nights = (0, types_1.nightsBetween)(dto.arrivalDate, dto.departureDate);
            if (nights > MAX_NIGHTS)
                throw (0, errors_1.badRequest)('STAY_TOO_LONG', `A stay can't be longer than ${MAX_NIGHTS} nights.`);
            const roomType = await tx.roomType.findFirst({ where: { id: dto.roomTypeId, propertyId, deletedAt: null } });
            if (!roomType)
                throw (0, errors_1.badRequest)('INVALID_ROOM_TYPE', 'That room type does not belong to this property.');
            if (dto.adults + dto.children > roomType.maxOccupancy) {
                throw (0, errors_1.badRequest)('OVER_CAPACITY', `${roomType.name} sleeps at most ${roomType.maxOccupancy} guests.`);
            }
            const { plan, quote } = await this.resolveQuote(tx, propertyId, roomType.id, roomType.name, dto.ratePlanId, dto.arrivalDate, dto.departureDate);
            const guestId = await this.resolveGuest(tx, dto, actor);
            if (dto.status !== 'INQUIRY') {
                await this.ensureAvailability(tx, { propertyId, roomTypeId: roomType.id, typeName: roomType.name, arrival: dto.arrivalDate, departure: dto.departureDate });
            }
            const row = await tx.reservation.create({
                data: {
                    organizationId: actor.organizationId,
                    propertyId,
                    code: await this.newCode(tx),
                    guestId,
                    roomTypeId: roomType.id,
                    ratePlanId: plan.id,
                    status: dto.status,
                    source: dto.source,
                    arrivalDate: (0, types_1.parseDate)(dto.arrivalDate),
                    departureDate: (0, types_1.parseDate)(dto.departureDate),
                    adults: dto.adults,
                    children: dto.children,
                    nights: quote.nights,
                    totalMinor: quote.totalMinor,
                    nightlyRates: quote.perNight.map((n) => n.rateMinor),
                    currency: property.currency,
                    specialRequests: (0, text_1.emptyToNull)(dto.specialRequests) ?? null,
                    notes: (0, text_1.emptyToNull)(dto.notes) ?? null,
                    createdById: actor.userId,
                },
                include: reservation_mapper_1.reservationInclude,
            });
            await this.audit.record(tx, {
                organizationId: actor.organizationId,
                actorId: actor.userId,
                propertyId,
                action: 'reservation.created',
                entity: 'reservation',
                entityId: row.id,
                after: { code: row.code, status: row.status, arrival: dto.arrivalDate, departure: dto.departureDate, roomType: roomType.name, totalMinor: quote.totalMinor, ...(actor.via ? { via: actor.via } : {}) },
            });
            this.realtime.emit(actor.organizationId, 'reservation.changed', propertyId, [row.id]);
            const view = (0, reservation_mapper_1.toReservationView)(row);
            await this.webhooks.enqueue(tx, { organizationId: actor.organizationId, propertyId, type: 'reservation.created', data: (0, webhook_events_1.reservationEventData)(view) });
            return view;
        });
    }
    // ================================================================ update
    async update(id, dto, access) {
        return this.prisma.forTenant(async (tx) => {
            const r = await tx.reservation.findFirst({ where: { id }, include: reservation_mapper_1.reservationDetailInclude });
            if (!r)
                throw (0, errors_1.notFound)('Reservation');
            (0, assert_access_1.assertCan)(access, 'reservation.manage', r.propertyId);
            if (!types_1.EDITABLE_STATUSES.includes(r.status)) {
                throw (0, errors_1.conflict)('NOT_EDITABLE', `A ${label(r.status)} reservation can't be edited.`);
            }
            const arrival = dto.arrivalDate ?? (0, types_1.toDateString)(r.arrivalDate);
            const departure = dto.departureDate ?? (0, types_1.toDateString)(r.departureDate);
            const datesChanged = arrival !== (0, types_1.toDateString)(r.arrivalDate) || departure !== (0, types_1.toDateString)(r.departureDate);
            if (departure <= arrival)
                throw (0, errors_1.badRequest)('INVALID_DATES', 'Departure must be after arrival.');
            if (datesChanged && arrival < (0, types_1.todayIn)(r.property.timezone))
                throw (0, errors_1.badRequest)('ARRIVAL_IN_PAST', "Arrival can't be before today.");
            if ((0, types_1.nightsBetween)(arrival, departure) > MAX_NIGHTS)
                throw (0, errors_1.badRequest)('STAY_TOO_LONG', `A stay can't be longer than ${MAX_NIGHTS} nights.`);
            const adults = dto.adults ?? r.adults;
            const children = dto.children ?? r.children;
            if (adults < 1)
                throw (0, errors_1.badRequest)('INVALID_GUESTS', 'At least 1 adult is required.');
            if (adults + children > (await this.roomTypeCapacity(tx, r.roomTypeId)))
                throw (0, errors_1.badRequest)('OVER_CAPACITY', 'That is more guests than this room type sleeps.');
            const { plan, quote } = await this.resolveQuote(tx, r.propertyId, r.roomTypeId, r.roomType.name, dto.ratePlanId ?? r.ratePlanId ?? undefined, arrival, departure);
            if (datesChanged && types_1.HOLDING_STATUSES.includes(r.status)) {
                await this.ensureAvailability(tx, { propertyId: r.propertyId, roomTypeId: r.roomTypeId, typeName: r.roomType.name, arrival, departure, excludeId: id });
                if (r.roomId)
                    await this.ensureRoomFree(tx, { roomId: r.roomId, roomNumber: r.room?.number ?? '', arrival, departure, excludeId: id });
            }
            const row = await tx.reservation.update({
                where: { id },
                data: {
                    arrivalDate: (0, types_1.parseDate)(arrival),
                    departureDate: (0, types_1.parseDate)(departure),
                    adults,
                    children,
                    ratePlanId: plan.id,
                    nights: quote.nights,
                    totalMinor: quote.totalMinor,
                    nightlyRates: quote.perNight.map((n) => n.rateMinor),
                    ...(dto.specialRequests !== undefined ? { specialRequests: (0, text_1.emptyToNull)(dto.specialRequests) } : {}),
                    ...(dto.notes !== undefined ? { notes: (0, text_1.emptyToNull)(dto.notes) } : {}),
                },
                include: reservation_mapper_1.reservationInclude,
            });
            const diff = (0, changed_fields_1.changedFields)(r, row, ['arrivalDate', 'departureDate', 'adults', 'children', 'ratePlanId', 'totalMinor', 'specialRequests', 'notes']);
            if (diff.changed.length > 0) {
                await this.audit.record(tx, { organizationId: access.organizationId, actorId: access.userId, propertyId: r.propertyId, action: 'reservation.updated', entity: 'reservation', entityId: id, before: diff.before, after: diff.after });
            }
            this.realtime.emit(access.organizationId, 'reservation.changed', r.propertyId, [id]);
            return (0, reservation_mapper_1.toReservationView)(row);
        });
    }
    // ================================================================ extend stay
    /** An in-house guest stays longer. The room must be free, the extra nights are priced from the rate plan and billed to the folio. */
    async extend(id, dto, access) {
        return this.prisma.forTenant(async (tx) => {
            const r = await tx.reservation.findFirst({ where: { id }, include: reservation_mapper_1.reservationDetailInclude });
            if (!r)
                throw (0, errors_1.notFound)('Reservation');
            (0, assert_access_1.assertCan)(access, 'reservation.manage', r.propertyId);
            if (r.status !== 'CHECKED_IN' || !r.roomId)
                throw (0, errors_1.conflict)('NOT_IN_HOUSE', 'Only a guest who is checked in can extend their stay.');
            const oldDeparture = (0, types_1.toDateString)(r.departureDate);
            if (dto.departureDate <= oldDeparture)
                throw (0, errors_1.badRequest)('INVALID_DATES', 'The new departure must be after the current one. To leave earlier, check the guest out.');
            if ((0, types_1.nightsBetween)(oldDeparture, dto.departureDate) > 60)
                throw (0, errors_1.badRequest)('STAY_TOO_LONG', "A stay can't be extended by more than 60 nights at once.");
            await this.ensureRoomFree(tx, { roomId: r.roomId, roomNumber: r.room?.number ?? '', arrival: oldDeparture, departure: dto.departureDate, excludeId: id });
            const { quote } = await this.resolveQuote(tx, r.propertyId, r.roomTypeId, r.roomType.name, r.ratePlanId ?? undefined, oldDeparture, dto.departureDate);
            const extraRates = quote.perNight.map((n) => n.rateMinor);
            const newTotal = r.totalMinor + quote.totalMinor;
            const changed = await tx.reservation.updateMany({
                where: { id, status: 'CHECKED_IN', departureDate: r.departureDate },
                data: { departureDate: (0, types_1.parseDate)(dto.departureDate), nights: r.nights + quote.nights, totalMinor: newTotal, nightlyRates: [...(0, types_1.nightlyRatesFrom)(r.nightlyRates, r.nights, r.totalMinor), ...extraRates] },
            });
            if (changed.count === 0)
                throw (0, errors_1.conflict)('RESERVATION_CHANGED', 'Someone else just changed this reservation. Refresh and try again.');
            const stay = { ...this.stayForBilling(r, r.room?.number ?? ''), departureDate: (0, types_1.parseDate)(dto.departureDate), totalMinor: newTotal };
            await this.ledger.postExtraNights(tx, stay, oldDeparture, extraRates, access.userId);
            await this.audit.record(tx, { organizationId: access.organizationId, actorId: access.userId, propertyId: r.propertyId, action: 'reservation.extended', entity: 'reservation', entityId: id, before: { departure: oldDeparture }, after: { departure: dto.departureDate, addedNights: quote.nights, added: (0, types_1.formatMoney)(quote.totalMinor, r.currency) } });
            this.realtime.emit(access.organizationId, 'reservation.changed', r.propertyId, [id]);
            this.realtime.emit(access.organizationId, 'folio.changed', r.propertyId, [id]);
            return (0, reservation_mapper_1.toReservationView)(await tx.reservation.findFirstOrThrow({ where: { id }, include: reservation_mapper_1.reservationInclude }));
        });
    }
    // ================================================================ status flow
    async transition(id, dto, access) {
        return this.prisma.forTenant(async (tx) => {
            const r = await tx.reservation.findFirst({ where: { id }, include: reservation_mapper_1.reservationDetailInclude });
            if (!r)
                throw (0, errors_1.notFound)('Reservation');
            const needed = dto.action === 'check_in' || dto.action === 'check_out' ? 'reservation.check_in' : 'reservation.manage';
            (0, assert_access_1.assertCan)(access, needed, r.propertyId);
            if (!types_1.ACTION_FROM[dto.action].includes(r.status)) {
                throw (0, errors_1.conflict)('INVALID_TRANSITION', `This reservation is ${label(r.status)}, so you can't ${label(dto.action)}.`);
            }
            const now = new Date();
            const today = (0, types_1.todayIn)(r.property.timezone);
            const arrival = (0, types_1.toDateString)(r.arrivalDate);
            const departure = (0, types_1.toDateString)(r.departureDate);
            const data = {};
            let roomToDirty = null;
            let checkInRoomNumber = r.room?.number ?? '';
            let folioToClose = null;
            let overriddenBalance = null;
            switch (dto.action) {
                case 'confirm':
                    if (r.status === 'INQUIRY') {
                        await this.ensureAvailability(tx, { propertyId: r.propertyId, roomTypeId: r.roomTypeId, typeName: r.roomType.name, arrival, departure, excludeId: id });
                    }
                    break;
                case 'cancel':
                    data.cancelledAt = now;
                    data.cancelReason = (0, text_1.emptyToNull)(dto.reason) ?? null;
                    break;
                case 'no_show':
                    if (today < arrival)
                        throw (0, errors_1.conflict)('TOO_EARLY', `A no-show can only be recorded from the arrival date (${arrival}).`);
                    break;
                case 'assign_room': {
                    if (!dto.roomId)
                        throw (0, errors_1.badRequest)('ROOM_REQUIRED', 'Choose a room.');
                    const room = await this.validateRoom(tx, r, dto.roomId);
                    if (r.status === 'CHECKED_IN') {
                        this.assertRoomReady(room);
                        if (r.roomId && r.roomId !== room.id)
                            roomToDirty = { id: r.roomId, number: r.room?.number ?? '' };
                    }
                    data.roomId = room.id;
                    break;
                }
                case 'unassign_room':
                    data.roomId = null;
                    break;
                case 'check_in': {
                    if (today < arrival)
                        throw (0, errors_1.conflict)('TOO_EARLY', `Check-in opens on the arrival date (${arrival}).`);
                    if (today >= departure)
                        throw (0, errors_1.conflict)('STAY_ENDED', 'The departure date has passed, so this stay can no longer be checked in.');
                    const roomId = dto.roomId ?? r.roomId;
                    if (!roomId)
                        throw (0, errors_1.badRequest)('ROOM_REQUIRED', 'Choose a room to check this guest into.');
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
                                throw new app_exception_1.AppException('FORBIDDEN', 'Only a manager can check a guest out with an unsettled balance.', common_2.HttpStatus.FORBIDDEN);
                            }
                            overriddenBalance = balanceMinor;
                        }
                        else if (balanceMinor > 0) {
                            throw (0, errors_1.conflict)('BALANCE_DUE', `${(0, types_1.formatMoney)(balanceMinor, r.currency)} is still owed. Record the payment before checking out.`);
                        }
                        else {
                            throw (0, errors_1.conflict)('CREDIT_REMAINING', `The guest is in credit by ${(0, types_1.formatMoney)(-balanceMinor, r.currency)}. Refund it before checking out.`);
                        }
                    }
                    folioToClose = folio.id;
                    data.checkedOutAt = now;
                    if (r.roomId)
                        roomToDirty = { id: r.roomId, number: r.room?.number ?? '' };
                    break;
                }
            }
            const result = types_1.ACTION_RESULT[dto.action];
            if (result)
                data.status = result;
            // Compare-and-set: refuse instead of overwriting if someone else just changed this reservation.
            const updated = await tx.reservation.updateMany({ where: { id, status: r.status }, data });
            if (updated.count === 0)
                throw (0, errors_1.conflict)('RESERVATION_CHANGED', 'Someone else just changed this reservation. Refresh and try again.');
            if (dto.action === 'check_in') {
                await this.ledger.postRoomCharges(tx, this.stayForBilling(r, checkInRoomNumber), access.userId);
            }
            if (folioToClose)
                await this.ledger.close(tx, folioToClose);
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
                    reason: (0, text_1.emptyToNull)(dto.reason) ?? null,
                    ...(overriddenBalance !== null ? { checkedOutWithBalance: (0, types_1.formatMoney)(overriddenBalance, r.currency) } : {}),
                },
            });
            if (roomToDirty) {
                await this.housekeeping.createCheckoutTask(tx, {
                    organizationId: access.organizationId,
                    propertyId: r.propertyId,
                    roomId: roomToDirty.id,
                    today,
                    createdById: access.userId,
                    notes: dto.action === 'check_out' ? `Guest checked out (${r.code}).` : `Guest moved to another room (${r.code}).`,
                });
            }
            this.realtime.emit(access.organizationId, 'reservation.changed', r.propertyId, [id]);
            if (['check_in', 'check_out', 'assign_room', 'unassign_room'].includes(dto.action)) {
                const touched = [data.roomId, r.roomId, roomToDirty?.id].filter((x) => typeof x === 'string');
                this.realtime.emit(access.organizationId, 'room.changed', r.propertyId, [...new Set(touched)]);
            }
            if (dto.action === 'check_in' || dto.action === 'check_out')
                this.realtime.emit(access.organizationId, 'folio.changed', r.propertyId, [id]);
            const fresh = await tx.reservation.findFirstOrThrow({ where: { id }, include: reservation_mapper_1.reservationInclude });
            const view = (0, reservation_mapper_1.toReservationView)(fresh);
            if (view.status !== r.status) {
                await this.webhooks.enqueue(tx, { organizationId: access.organizationId, propertyId: r.propertyId, type: 'reservation.status_changed', data: { ...(0, webhook_events_1.reservationEventData)(view), previousStatus: r.status } });
            }
            return view;
        });
    }
    // ================================================================ internals
    stayForBilling(r, roomNumber) {
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
    async requireProperty(tx, propertyId) {
        const property = await tx.property.findFirst({ where: { id: propertyId, deletedAt: null }, select: { id: true, name: true, timezone: true, currency: true } });
        if (!property)
            throw (0, errors_1.notFound)('Property');
        return property;
    }
    async roomTypeCapacity(tx, roomTypeId) {
        return (await tx.roomType.findFirstOrThrow({ where: { id: roomTypeId }, select: { maxOccupancy: true } })).maxOccupancy;
    }
    /** The rate plan (given, or the property's default) must have a rate for this room type. */
    async resolveQuote(tx, propertyId, roomTypeId, typeName, ratePlanId, arrival, departure) {
        const plan = await tx.ratePlan.findFirst({
            where: { propertyId, deletedAt: null, ...(ratePlanId ? { id: ratePlanId } : { isDefault: true }) },
            include: { rates: { where: { roomTypeId } } },
        });
        if (!plan)
            throw (0, errors_1.badRequest)('NO_RATE_PLAN', ratePlanId ? 'That rate plan does not belong to this property.' : 'This property has no default rate plan yet. Create one in Rooms → Rates first.');
        const rate = plan.rates[0];
        if (!rate)
            throw (0, errors_1.badRequest)('NO_RATE', `"${plan.name}" has no rate for ${typeName}. Add one in Rooms → Rates.`);
        return { plan, quote: (0, types_1.quoteStay)(arrival, departure, { nightlyRateMinor: rate.nightlyRateMinor, weekendRateMinor: rate.weekendRateMinor }) };
    }
    async resolveGuest(tx, dto, actor) {
        if (dto.guestId) {
            const guest = await tx.guest.findFirst({ where: { id: dto.guestId, deletedAt: null }, select: { id: true } });
            if (!guest)
                throw (0, errors_1.badRequest)('INVALID_GUEST', 'That guest was not found.');
            return guest.id;
        }
        const g = dto.newGuest;
        const email = (0, text_1.emptyToNull)(g.email) ?? null;
        if (email && (await tx.guest.findFirst({ where: { email: { equals: email, mode: 'insensitive' }, deletedAt: null }, select: { id: true } }))) {
            throw (0, errors_1.conflict)('GUEST_EMAIL_EXISTS', 'A guest with this email already exists. Search for them instead of adding a duplicate.');
        }
        const created = await tx.guest.create({
            data: {
                organizationId: actor.organizationId,
                firstName: g.firstName,
                lastName: g.lastName,
                email,
                phone: (0, text_1.emptyToNull)(g.phone) ?? null,
                country: (0, text_1.emptyToNull)(g.country)?.toUpperCase() ?? null,
                preferences: (0, text_1.emptyToNull)(g.preferences) ?? null,
                notes: (0, text_1.emptyToNull)(g.notes) ?? null,
                isVip: g.isVip,
            },
            select: { id: true },
        });
        await this.audit.record(tx, { organizationId: actor.organizationId, actorId: actor.userId, action: 'guest.created', entity: 'guest', entityId: created.id, after: { name: `${g.firstName} ${g.lastName}`, via: 'reservation' } });
        return created.id;
    }
    /**
     * Room-type inventory: every night of the stay needs at least one free room. A per-room-type advisory
     * lock makes two simultaneous bookings take turns, so the last room can't be sold twice.
     */
    async ensureAvailability(tx, a) {
        await tx.$executeRaw `SELECT pg_advisory_xact_lock(hashtext(${'res:' + a.roomTypeId}))`;
        const [totalRooms, overlapping] = await Promise.all([
            tx.room.count({ where: { propertyId: a.propertyId, roomTypeId: a.roomTypeId, deletedAt: null } }),
            tx.reservation.findMany({
                where: {
                    propertyId: a.propertyId,
                    roomTypeId: a.roomTypeId,
                    status: { in: [...types_1.HOLDING_STATUSES] },
                    ...(a.excludeId ? { id: { not: a.excludeId } } : {}),
                    arrivalDate: { lt: (0, types_1.parseDate)(a.departure) },
                    departureDate: { gt: (0, types_1.parseDate)(a.arrival) },
                },
                select: { arrivalDate: true, departureDate: true },
            }),
        ]);
        const nights = (0, availability_1.nightlyAvailability)({
            totalRooms,
            reservations: overlapping.map((o) => ({ arrivalDate: (0, types_1.toDateString)(o.arrivalDate), departureDate: (0, types_1.toDateString)(o.departureDate) })),
            from: a.arrival,
            days: (0, types_1.nightsBetween)(a.arrival, a.departure),
        });
        if (!(0, availability_1.canBook)(nights)) {
            const firstFull = nights.find((n) => n.available < 1);
            throw (0, errors_1.conflict)('NO_AVAILABILITY', `No ${a.typeName} rooms are available for those dates (full on ${firstFull?.date}).`);
        }
    }
    async ensureRoomFree(tx, a) {
        const clash = await tx.reservation.count({
            where: {
                roomId: a.roomId,
                id: { not: a.excludeId },
                status: { in: [...types_1.HOLDING_STATUSES] },
                arrivalDate: { lt: (0, types_1.parseDate)(a.departure) },
                departureDate: { gt: (0, types_1.parseDate)(a.arrival) },
            },
        });
        if (clash > 0)
            throw (0, errors_1.conflict)('ROOM_UNAVAILABLE', `Room ${a.roomNumber} is already booked for those dates.`);
    }
    async validateRoom(tx, r, roomId) {
        const room = await tx.room.findFirst({ where: { id: roomId, propertyId: r.propertyId, deletedAt: null } });
        if (!room)
            throw (0, errors_1.badRequest)('INVALID_ROOM', 'That room does not belong to this property.');
        if (r.status !== 'CHECKED_IN' && room.roomTypeId !== r.roomTypeId) {
            throw (0, errors_1.badRequest)('ROOM_TYPE_MISMATCH', 'Choose a room of the booked room type.');
        }
        await this.ensureRoomFree(tx, { roomId: room.id, roomNumber: room.number, arrival: (0, types_1.toDateString)(r.arrivalDate), departure: (0, types_1.toDateString)(r.departureDate), excludeId: r.id });
        return room;
    }
    assertRoomReady(room) {
        if (!READY_ROOM_STATUSES.includes(room.status)) {
            throw (0, errors_1.conflict)('ROOM_NOT_READY', `Room ${room.number} is ${label(room.status)}, so a guest can't go in yet.`);
        }
    }
    async newCode(tx) {
        for (let i = 0; i < 6; i++) {
            const code = `R${(0, node_crypto_1.randomBytes)(4).toString('hex').toUpperCase()}`;
            if (!(await tx.reservation.findFirst({ where: { code }, select: { id: true } })))
                return code;
        }
        throw (0, errors_1.conflict)('CODE_UNAVAILABLE', 'Could not generate a reservation code. Please try again.');
    }
};
exports.ReservationsService = ReservationsService;
exports.ReservationsService = ReservationsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_service_1.AuditService,
        folio_ledger_service_1.FolioLedger,
        realtime_service_1.RealtimeService,
        housekeeping_automation_service_1.HousekeepingAutomation,
        webhooks_service_1.WebhooksService])
], ReservationsService);
//# sourceMappingURL=reservations.service.js.map