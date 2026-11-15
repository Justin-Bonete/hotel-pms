import { HttpStatus, Injectable } from '@nestjs/common';
import { HOLDING_STATUSES, nightsBetween, parseDate, quoteStay, toDateString, todayIn, type PublicAvailabilityView, type PublicBookingView, type PublicPropertyView, type ReservationView } from '@pms/types';
import type { CreateReservationInput, PublicAvailabilityQuery, PublicBookingInput, PublicLookupQuery } from '@pms/validation';
import { AppException } from '../../common/http/app-exception';
import { badRequest, conflict, notFound } from '../../common/http/errors';
import { PrismaService } from '../../database/prisma/prisma.service';
import { RedisService } from '../../database/redis/redis.service';
import { ApiKeyAuth, forbiddenScope } from '../api-keys/api-keys.service';
import { nightlyAvailability } from '../reservations/availability';
import { reservationInclude, toReservationView } from '../reservations/reservation.mapper';
import { ReservationsService } from '../reservations/reservations.service';
import { PublicRateLimiter } from './public-rate-limiter';

const IDEMPOTENCY_KEY = /^[\w.:-]{8,100}$/;
const IDEMPOTENCY_TTL_SECONDS = 86_400;

const toPublic = (r: ReservationView): PublicBookingView => ({
  code: r.code, status: r.status, propertyId: r.propertyId, roomTypeName: r.roomTypeName, arrival: r.arrivalDate, departure: r.departureDate,
  nights: r.nights, adults: r.adults, children: r.children, totalMinor: r.totalMinor, currency: r.currency,
});

/**
 * What a hotel's website can do with an API key. It reuses the staff booking code (one set of rules for pricing,
 * availability and the last-room lock). It never reveals guest details, internal ids of other guests, or other properties.
 */
@Injectable()
export class PublicApiService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reservations: ReservationsService,
    private readonly redis: RedisService,
    private readonly limiter: PublicRateLimiter,
  ) {}

  async properties(key: ApiKeyAuth): Promise<PublicPropertyView[]> {
    return this.prisma.forOrganization(key.organizationId, (tx) =>
      tx.property.findMany({ where: { id: { in: key.propertyIds }, deletedAt: null }, select: { id: true, name: true, currency: true, timezone: true }, orderBy: { name: 'asc' } }),
    );
  }

  async availability(key: ApiKeyAuth, propertyId: string, q: PublicAvailabilityQuery): Promise<PublicAvailabilityView> {
    this.requireScope(key, 'availability:read');
    this.requireProperty(key, propertyId);
    return this.prisma.forOrganization(key.organizationId, async (tx) => {
      const property = await tx.property.findFirst({ where: { id: propertyId, deletedAt: null }, select: { timezone: true, currency: true } });
      if (!property) throw notFound('Property');
      if (q.arrival < todayIn(property.timezone)) throw badRequest('ARRIVAL_IN_PAST', 'Arrival can’t be in the past.');
      const nights = nightsBetween(q.arrival, q.departure);
      const guests = q.adults + q.children;

      const [types, counts, reservations, plan] = await Promise.all([
        tx.roomType.findMany({ where: { propertyId, deletedAt: null, maxOccupancy: { gte: guests } }, orderBy: { name: 'asc' }, select: { id: true, name: true, maxOccupancy: true } }),
        tx.room.groupBy({ by: ['roomTypeId'], where: { propertyId, deletedAt: null }, _count: { _all: true } }),
        tx.reservation.findMany({
          where: { propertyId, status: { in: [...HOLDING_STATUSES] }, arrivalDate: { lt: parseDate(q.departure) }, departureDate: { gt: parseDate(q.arrival) } },
          select: { roomTypeId: true, arrivalDate: true, departureDate: true },
        }),
        tx.ratePlan.findFirst({ where: { propertyId, deletedAt: null, isDefault: true }, include: { rates: true } }),
      ]);
      const roomsByType = new Map<string, number>(counts.map((c) => [c.roomTypeId, c._count._all] as [string, number]));

      const offers: PublicAvailabilityView['offers'] = [];
      for (const t of types) {
        const mine = reservations.filter((r) => r.roomTypeId === t.id).map((r) => ({ arrivalDate: toDateString(r.arrivalDate), departureDate: toDateString(r.departureDate) }));
        const free = nightlyAvailability({ totalRooms: roomsByType.get(t.id) ?? 0, reservations: mine, from: q.arrival, days: nights });
        const available = Math.min(...free.map((n) => n.available));
        const rate = plan?.rates.find((r) => r.roomTypeId === t.id);
        if (available < 1 || !rate) continue; // never offer what can't be booked or has no price
        const quote = quoteStay(q.arrival, q.departure, { nightlyRateMinor: rate.nightlyRateMinor, weekendRateMinor: rate.weekendRateMinor });
        offers.push({ roomTypeId: t.id, name: t.name, maxOccupancy: t.maxOccupancy, available, nights: quote.nights, totalMinor: quote.totalMinor, currency: property.currency, nightlyRatesMinor: quote.perNight.map((n) => n.rateMinor) });
      }
      return { propertyId, arrival: q.arrival, departure: q.departure, offers };
    });
  }

  /**
   * Creates a booking. The Idempotency-Key header is REQUIRED: if the website's request times out and it tries again with
   * the same key, it gets the same booking back instead of a second one. Online bookings start PENDING unless the key is
   * set to auto-confirm.
   */
  async book(key: ApiKeyAuth, propertyId: string, dto: PublicBookingInput, idempotencyKey: string | undefined): Promise<PublicBookingView> {
    this.requireScope(key, 'bookings:create');
    this.requireProperty(key, propertyId);
    if (!idempotencyKey || !IDEMPOTENCY_KEY.test(idempotencyKey)) throw badRequest('IDEMPOTENCY_KEY_REQUIRED', 'Send an Idempotency-Key header (8 to 100 letters, digits, - _ . :) that is unique for each booking attempt.');
    const rl = await this.limiter.hit('book', key.id, 20, 60);
    if (!rl.allowed) throw new AppException('RATE_LIMITED', 'Too many booking requests. Try again shortly.', HttpStatus.TOO_MANY_REQUESTS);

    const slot = `pub-idem:${key.id}:${idempotencyKey}`;
    let claimed: boolean;
    try {
      claimed = (await this.redis.client.set(slot, JSON.stringify({ state: 'pending' }), 'EX', IDEMPOTENCY_TTL_SECONDS, 'NX')) === 'OK';
    } catch {
      // Without it we could double-book on a retry, so refuse rather than guess.
      throw new AppException('TEMPORARILY_UNAVAILABLE', 'Bookings are temporarily unavailable. Please try again in a moment.', HttpStatus.SERVICE_UNAVAILABLE);
    }
    if (!claimed) {
      const stored = JSON.parse((await this.redis.client.get(slot)) ?? '{}') as { state?: string; code?: string };
      if (stored.state === 'done' && stored.code) return this.byCode(key, propertyId, stored.code);
      throw conflict('REQUEST_IN_PROGRESS', 'The same request is still being processed. Try again in a moment.');
    }

    try {
      const view = await this.createBooking(key, propertyId, dto);
      await this.redis.client.set(slot, JSON.stringify({ state: 'done', code: view.code }), 'EX', IDEMPOTENCY_TTL_SECONDS);
      return toPublic(view);
    } catch (err) {
      await this.redis.client.del(slot).catch(() => undefined); // a failed attempt may be retried
      throw err;
    }
  }

  /** A booking can be looked up only with its code AND the guest's email, so codes can't be enumerated. */
  async lookup(key: ApiKeyAuth, propertyId: string, code: string, q: PublicLookupQuery): Promise<PublicBookingView> {
    this.requireScope(key, 'bookings:read');
    this.requireProperty(key, propertyId);
    const rl = await this.limiter.hit('lookup', key.id, 30, 60);
    if (!rl.allowed) throw new AppException('RATE_LIMITED', 'Too many lookups. Try again shortly.', HttpStatus.TOO_MANY_REQUESTS);
    const row = await this.prisma.forOrganization(key.organizationId, (tx) =>
      tx.reservation.findFirst({ where: { code, propertyId, guest: { email: { equals: q.email, mode: 'insensitive' } } }, include: reservationInclude }),
    );
    if (!row) throw notFound('Booking');
    return toPublic(toReservationView(row));
  }

  // ================================================================ internals
  private async createBooking(key: ApiKeyAuth, propertyId: string, dto: PublicBookingInput): Promise<ReservationView> {
    const base = {
      roomTypeId: dto.roomTypeId, arrivalDate: dto.arrivalDate, departureDate: dto.departureDate, adults: dto.adults, children: dto.children,
      source: 'WEBSITE' as const, status: key.autoConfirm ? ('CONFIRMED' as const) : ('PENDING' as const),
      specialRequests: dto.specialRequests ?? '', notes: `Online booking via API key "${key.name}"`,
    };
    const actor = { organizationId: key.organizationId, userId: null, via: `api_key:${key.name}` };
    const known = (): Promise<string | null> => this.prisma.forOrganization(key.organizationId, async (tx) => (await tx.guest.findFirst({ where: { email: { equals: dto.guest.email, mode: 'insensitive' }, deletedAt: null }, select: { id: true } }))?.id ?? null);
    const asNew = (): CreateReservationInput => ({ ...base, newGuest: { firstName: dto.guest.firstName, lastName: dto.guest.lastName, email: dto.guest.email, phone: dto.guest.phone ?? '', country: dto.guest.country ?? '', preferences: '', notes: '', isVip: false } });

    const existing = await known();
    try {
      return await this.reservations.createAs(actor, propertyId, existing ? { ...base, guestId: existing } : asNew());
    } catch (err) {
      // Two bookings for the same new guest at the same moment: the second finds the first one's guest.
      if (err instanceof AppException && err.code === 'GUEST_EMAIL_EXISTS') {
        const id = await known();
        if (id) return this.reservations.createAs(actor, propertyId, { ...base, guestId: id });
      }
      throw err;
    }
  }

  private async byCode(key: ApiKeyAuth, propertyId: string, code: string): Promise<PublicBookingView> {
    const row = await this.prisma.forOrganization(key.organizationId, (tx) => tx.reservation.findFirst({ where: { code, propertyId }, include: reservationInclude }));
    if (!row) throw notFound('Booking');
    return toPublic(toReservationView(row));
  }

  private requireScope(key: ApiKeyAuth, scope: Parameters<typeof forbiddenScope>[0]): void {
    if (!key.scopes.includes(scope)) throw forbiddenScope(scope);
  }

  /** A key only sees its own properties. Anything else looks like it does not exist. */
  private requireProperty(key: ApiKeyAuth, propertyId: string): void {
    if (!key.propertyIds.includes(propertyId)) throw notFound('Property');
  }
}
