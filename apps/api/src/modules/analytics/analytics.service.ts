import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import {
  buildDaily, buildKpis, combineDaily, combineKpis, eachDate, emptyKpiBase, inclusiveDays, localDateOf, parseDate, previousPeriod, stayNights, toDateString, todayIn, zonedDayRange,
  type AnalyticsOverview, type DailyPoint, type PeriodKpis, type PropertyAnalytics,
} from '@pms/types';
import type { AnalyticsQuery } from '@pms/validation';
import type { AccessContext } from '../../common/access/access-context';
import { assertCan } from '../../common/access/assert-access';
import { PrismaService, Tx } from '../../database/prisma/prisma.service';

const CAP = { reservations: 20_000, folioItems: 50_000, posOrders: 50_000 } as const;
const COUNTED = ['CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT'] as const;

interface PropertyRow { id: string; name: string; currency: string; timezone: string }
interface Range { from: string; to: string }
interface PeriodResult {
  kpis: PeriodKpis;
  daily: DailyPoint[];
  expensesByCategory: Map<string, number>;
  posByOutlet: Map<string, { totalMinor: number; orders: number }>;
  sources: Map<string, number>;
  truncated: boolean;
}

/**
 * Read-only reporting. Money is whole centavos and nothing here writes. Every figure is worked out per property, in
 * that property's own time zone, then (when currencies match) added up and the ratios recomputed, never averaged.
 */
@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async overview(query: AnalyticsQuery, access: AccessContext): Promise<AnalyticsOverview> {
    if (query.propertyId) assertCan(access, 'analytics.read', query.propertyId);
    const scope = access.scopeOf('analytics.read');
    const range: Range = { from: query.from, to: query.to };
    const prev = previousPeriod(query.from, query.to);

    return this.prisma.forTenant(async (tx) => {
      const where: Prisma.PropertyWhereInput = { deletedAt: null, ...(query.propertyId ? { id: query.propertyId } : scope.all ? {} : { id: { in: [...scope.ids] } }) };
      const properties: PropertyRow[] = await tx.property.findMany({ where, select: { id: true, name: true, currency: true, timezone: true }, orderBy: { name: 'asc' } });

      const perProperty: PropertyAnalytics[] = [];
      const details: PeriodResult[] = [];
      let truncated = false;
      for (const p of properties) {
        const rooms = await tx.room.count({ where: { propertyId: p.id, deletedAt: null } });
        const today = todayIn(p.timezone);
        const current = await this.period(tx, p, rooms, range, today);
        const previous = await this.period(tx, p, rooms, prev, today);
        truncated ||= current.truncated || previous.truncated;
        details.push(current);
        perProperty.push({ propertyId: p.id, propertyName: p.name, currency: p.currency, current: current.kpis, previous: previous.kpis });
      }

      const currencies = new Set(properties.map((p) => p.currency));
      const mixed = currencies.size > 1;
      const sum = (list: Array<Map<string, number>>) => { const m = new Map<string, number>(); for (const x of list) for (const [k, v] of x) m.set(k, (m.get(k) ?? 0) + v); return m; };
      const posMerged = new Map<string, { totalMinor: number; orders: number }>();
      for (const d of details) for (const [name, v] of d.posByOutlet) { const e = posMerged.get(name) ?? { totalMinor: 0, orders: 0 }; e.totalMinor += v.totalMinor; e.orders += v.orders; posMerged.set(name, e); }

      return {
        range: { ...range, days: inclusiveDays(range.from, range.to) },
        previousRange: prev,
        currency: properties.length > 0 && !mixed ? (properties[0]!.currency) : null,
        mixedCurrencies: mixed,
        current: properties.length > 0 && !mixed ? combineKpis(perProperty.map((p) => p.current)) : null,
        previous: properties.length > 0 && !mixed ? combineKpis(perProperty.map((p) => p.previous)) : null,
        daily: properties.length > 0 && !mixed ? combineDaily(details.map((d) => d.daily)) : null,
        expensesByCategory: [...sum(details.map((d) => d.expensesByCategory))].map(([category, totalMinor]) => ({ category, totalMinor })).sort((a, b) => b.totalMinor - a.totalMinor),
        posByOutlet: [...posMerged].map(([outletName, v]) => ({ outletName, ...v })).sort((a, b) => b.totalMinor - a.totalMinor),
        bookingSources: [...sum(details.map((d) => d.sources))].map(([source, bookings]) => ({ source, bookings })).sort((a, b) => b.bookings - a.bookings),
        properties: perProperty,
        truncated,
      };
    });
  }

  private async period(tx: Tx, p: PropertyRow, rooms: number, range: Range, today: string): Promise<PeriodResult> {
    const days = inclusiveDays(range.from, range.to);
    const start = zonedDayRange(range.from, p.timezone).start;
    const end = zonedDayRange(range.to, p.timezone).end;
    const dates = eachDate(range.from, range.to);
    const day = new Map(dates.map((d) => [d, { room: 0, extras: 0, pos: 0, sold: 0 }] as [string, { room: number; extras: number; pos: number; sold: number }]));
    let truncated = false;

    // ---- room nights and room revenue (from each stay's own nightly rates, tax excluded)
    const reservations = await tx.reservation.findMany({
      where: { propertyId: p.id, status: { in: [...COUNTED] }, arrivalDate: { lte: parseDate(range.to) }, departureDate: { gt: parseDate(range.from) } },
      select: { status: true, arrivalDate: true, departureDate: true, nights: true, totalMinor: true, nightlyRates: true },
      take: CAP.reservations,
    });
    truncated ||= reservations.length >= CAP.reservations;
    let sold = 0, forecast = 0, roomRevenue = 0, stays = 0, stayNightsTotal = 0;
    for (const r of reservations) {
      const counted = stayNights({ status: r.status, arrivalDate: toDateString(r.arrivalDate), departureDate: toDateString(r.departureDate), nights: r.nights, totalMinor: r.totalMinor, nightlyRates: r.nightlyRates }, range, today);
      if (counted.length === 0) continue;
      stays += 1;
      stayNightsTotal += r.nights;
      for (const n of counted) {
        const d = day.get(n.date)!;
        d.sold += 1; d.room += n.revenueMinor;
        sold += 1; roomRevenue += n.revenueMinor;
        if (n.forecast) forecast += 1;
      }
    }

    // ---- extras billed by the front desk (POS charges are counted under POS so nothing is counted twice; voided ones are excluded)
    const extras = await tx.folioItem.findMany({
      where: { folio: { propertyId: p.id }, type: 'EXTRA_CHARGE', source: { not: 'POS' }, reversedBy: { is: null }, createdAt: { gte: start, lt: end } },
      select: { amountMinor: true, createdAt: true },
      take: CAP.folioItems,
    });
    truncated ||= extras.length >= CAP.folioItems;
    let extrasRevenue = 0;
    for (const e of extras) {
      const d = day.get(localDateOf(e.createdAt, p.timezone));
      if (!d) continue;
      d.extras += e.amountMinor; extrasRevenue += e.amountMinor;
    }

    // ---- POS sales before tax, voided sales excluded
    const orders = await tx.posOrder.findMany({
      where: { propertyId: p.id, status: { not: 'VOID' }, createdAt: { gte: start, lt: end } },
      select: { subtotalMinor: true, createdAt: true, outlet: { select: { name: true } } },
      take: CAP.posOrders,
    });
    truncated ||= orders.length >= CAP.posOrders;
    let posRevenue = 0;
    const posByOutlet = new Map<string, { totalMinor: number; orders: number }>();
    for (const o of orders) {
      const d = day.get(localDateOf(o.createdAt, p.timezone));
      if (!d) continue;
      d.pos += o.subtotalMinor; posRevenue += o.subtotalMinor;
      const e = posByOutlet.get(o.outlet.name) ?? { totalMinor: 0, orders: 0 };
      e.totalMinor += o.subtotalMinor; e.orders += 1; posByOutlet.set(o.outlet.name, e);
    }

    // ---- expenses (voided excluded)
    const expenses = await tx.expense.groupBy({ by: ['category'], where: { propertyId: p.id, voidedAt: null, incurredOn: { gte: parseDate(range.from), lte: parseDate(range.to) } }, _sum: { amountMinor: true } });
    const expensesByCategory = new Map<string, number>(expenses.map((e) => [e.category as string, e._sum.amountMinor ?? 0] as [string, number]));
    const expensesTotal = [...expensesByCategory.values()].reduce((s, v) => s + v, 0);

    // ---- bookings made in the period, and what became of them
    const made = await tx.reservation.groupBy({ by: ['status', 'source'], where: { propertyId: p.id, createdAt: { gte: start, lt: end } }, _count: { _all: true } });
    let bookingsMade = 0, cancelled = 0, noShow = 0;
    const sources = new Map<string, number>();
    for (const m of made) {
      const n = m._count._all;
      bookingsMade += n;
      if (m.status === 'CANCELLED') cancelled += n;
      if (m.status === 'NO_SHOW') noShow += n;
      sources.set(m.source as string, (sources.get(m.source as string) ?? 0) + n);
    }

    const kpis = buildKpis({
      ...emptyKpiBase(days), availableRoomNights: rooms * days, soldRoomNights: sold, forecastNights: forecast, roomRevenueMinor: roomRevenue, extrasRevenueMinor: extrasRevenue,
      posRevenueMinor: posRevenue, expensesMinor: expensesTotal, bookingsMade, cancelledBookings: cancelled, noShowBookings: noShow, stays, stayNights: stayNightsTotal,
    });
    const daily = dates.map((date) => { const d = day.get(date)!; return buildDaily(date, { roomRevenueMinor: d.room, extrasRevenueMinor: d.extras, posRevenueMinor: d.pos, soldRoomNights: d.sold, availableRoomNights: rooms }); });
    return { kpis, daily, expensesByCategory, posByOutlet, sources, truncated };
  }
}
