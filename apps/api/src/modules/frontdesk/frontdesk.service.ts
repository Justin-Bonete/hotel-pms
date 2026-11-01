import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { addDays, parseDate, todayIn, type FrontDeskItem, type FrontDeskView } from '@pms/types';
import type { AccessContext } from '../../common/access/access-context';
import { assertCan } from '../../common/access/assert-access';
import { notFound } from '../../common/http/errors';
import { PrismaService, Tx } from '../../database/prisma/prisma.service';
import { reservationInclude, toReservationView } from '../reservations/reservation.mapper';

const include = {
  ...reservationInclude,
  guest: { select: { firstName: true, lastName: true, isVip: true } },
} satisfies Prisma.ReservationInclude;

/** "Who is arriving, departing and staying?" in one request, for the property's own "today". */
@Injectable()
export class FrontDeskService {
  constructor(private readonly prisma: PrismaService) {}

  async get(propertyId: string, access: AccessContext): Promise<FrontDeskView> {
    assertCan(access, 'reservation.read', propertyId);
    return this.prisma.forTenant(async (tx) => {
      const property = await tx.property.findFirst({ where: { id: propertyId, deletedAt: null }, select: { timezone: true } });
      if (!property) throw notFound('Property');
      const today = todayIn(property.timezone);
      const todayDate = parseDate(today);

      const [arrivalRows, inHouseRows, expectedRows, rooms, dirty, outOfOrder] = await Promise.all([
        tx.reservation.findMany({ where: { propertyId, status: { in: ['PENDING', 'CONFIRMED'] }, arrivalDate: todayDate }, include, orderBy: { createdAt: 'asc' } }),
        tx.reservation.findMany({ where: { propertyId, status: 'CHECKED_IN' }, include, orderBy: [{ departureDate: 'asc' }, { createdAt: 'asc' }] }),
        tx.reservation.findMany({ where: { propertyId, status: { in: ['PENDING', 'CONFIRMED'] }, arrivalDate: { gt: todayDate, lte: parseDate(addDays(today, 3)) } }, include, orderBy: { arrivalDate: 'asc' }, take: 100 }),
        tx.room.count({ where: { propertyId, deletedAt: null } }),
        tx.room.count({ where: { propertyId, deletedAt: null, status: 'DIRTY' } }),
        tx.room.count({ where: { propertyId, deletedAt: null, status: { in: ['OUT_OF_ORDER', 'OUT_OF_SERVICE', 'MAINTENANCE'] } } }),
      ]);

      const balances = await this.balances(tx, inHouseRows.map((r) => r.id));
      const item = (r: (typeof arrivalRows)[number], withBalance: boolean): FrontDeskItem => ({
        ...toReservationView(r),
        guestIsVip: r.guest.isVip,
        balanceDueMinor: withBalance ? (balances.get(r.id) ?? null) : null,
      });

      const arrivals = arrivalRows.map((r) => item(r, false));
      const inHouse = inHouseRows.map((r) => item(r, true));
      return {
        today,
        propertyId,
        counts: { rooms, inHouse: inHouse.length, arrivals: arrivals.length, departures: inHouse.filter((i) => i.departureDate === today).length, dirty, outOfOrder },
        arrivals,
        departures: inHouse.filter((i) => i.departureDate === today),
        inHouse,
        expected: expectedRows.map((r) => item(r, false)),
        overstays: inHouse.filter((i) => i.departureDate < today),
        vips: [...arrivals, ...inHouse].filter((i) => i.guestIsVip),
        paymentsDue: inHouse.filter((i) => (i.balanceDueMinor ?? 0) > 0).sort((a, b) => (b.balanceDueMinor ?? 0) - (a.balanceDueMinor ?? 0)),
      };
    });
  }

  /** Balance per reservation (charges - payments + refunds), computed with three grouped queries, not one per guest. */
  private async balances(tx: Tx, reservationIds: string[]): Promise<Map<string, number>> {
    const result = new Map<string, number>();
    if (reservationIds.length === 0) return result;
    const folios = await tx.folio.findMany({ where: { reservationId: { in: reservationIds } }, select: { id: true, reservationId: true } });
    if (folios.length === 0) return result;
    const folioIds = folios.map((f) => f.id);
    const [items, payments, refunds] = await Promise.all([
      tx.folioItem.groupBy({ by: ['folioId'], where: { folioId: { in: folioIds } }, _sum: { amountMinor: true } }),
      tx.payment.groupBy({ by: ['folioId'], where: { folioId: { in: folioIds } }, _sum: { amountMinor: true } }),
      tx.refund.findMany({ where: { payment: { folioId: { in: folioIds } } }, select: { amountMinor: true, payment: { select: { folioId: true } } } }),
    ]);
    const charged = new Map<string, number>(items.map((i) => [i.folioId, i._sum.amountMinor ?? 0] as [string, number]));
    const paid = new Map<string, number>(payments.map((p) => [p.folioId, p._sum.amountMinor ?? 0] as [string, number]));
    const refunded = new Map<string, number>();
    for (const r of refunds) refunded.set(r.payment.folioId, (refunded.get(r.payment.folioId) ?? 0) + r.amountMinor);
    for (const f of folios) result.set(f.reservationId, (charged.get(f.id) ?? 0) - (paid.get(f.id) ?? 0) + (refunded.get(f.id) ?? 0));
    return result;
  }
}
