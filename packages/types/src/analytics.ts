import { nightlyRatesFrom } from './billing';
import { addDays, eachNight, nightsBetween } from './pricing';

export const MAX_ANALYTICS_DAYS = 366;

/** Calendar days from `from` to `to`, both included. */
export const inclusiveDays = (from: string, to: string): number => nightsBetween(from, addDays(to, 1));
export const eachDate = (from: string, to: string): string[] => eachNight(from, addDays(to, 1));

/** The period of the same length that ends the day before `from`. */
export function previousPeriod(from: string, to: string): { from: string; to: string } {
  const days = inclusiveDays(from, to);
  const prevTo = addDays(from, -1);
  return { from: addDays(prevTo, -(days - 1)), to: prevTo };
}

/** Percent change with one decimal. null when there is nothing to compare with (previous is 0), never Infinity. */
export function percentChange(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return Math.round(((current - previous) / Math.abs(previous)) * 1000) / 10;
}

/** part / whole as a percent with one decimal; null when the whole is 0. */
export const percentOf = (part: number, whole: number): number | null => (whole > 0 ? Math.round((part / whole) * 1000) / 10 : null);

/** numerator / denominator rounded to a whole centavo (ADR, RevPAR); null when the denominator is 0. */
export const perUnit = (numerator: number, denominator: number): number | null => (denominator > 0 ? Math.round(numerator / denominator) : null);

/** The calendar date (YYYY-MM-DD) an instant falls on in a time zone. */
export function localDateOf(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}

// ================================================================== room nights and room revenue
export interface StayForAnalytics {
  status: string;
  arrivalDate: string;
  departureDate: string;
  nights: number;
  totalMinor: number;
  nightlyRates: unknown;
}

/**
 * The room nights of one stay that fall inside [from, to], with the room revenue of each (tax excluded).
 *
 * A night counts as sold when the guest is checked in or out, or when it is a CONFIRMED night from today onward
 * ("on the books", flagged as forecast). A confirmed reservation whose past night never became a check-in is NOT
 * counted, otherwise un-actioned no-shows would inflate occupancy. Cancelled, no-show and inquiry stays never count.
 */
export function stayNights(stay: StayForAnalytics, range: { from: string; to: string }, today: string): Array<{ date: string; revenueMinor: number; forecast: boolean }> {
  if (stay.status !== 'CHECKED_IN' && stay.status !== 'CHECKED_OUT' && stay.status !== 'CONFIRMED') return [];
  const nights = eachNight(stay.arrivalDate, stay.departureDate);
  const rates = nightlyRatesFrom(stay.nightlyRates, nights.length, stay.totalMinor);
  const out: Array<{ date: string; revenueMinor: number; forecast: boolean }> = [];
  nights.forEach((date, i) => {
    if (date < range.from || date > range.to) return;
    const upcoming = date >= today;
    if (stay.status === 'CONFIRMED' && !upcoming) return;
    out.push({ date, revenueMinor: rates[i] ?? 0, forecast: upcoming && stay.status !== 'CHECKED_OUT' });
  });
  return out;
}

// ================================================================== KPIs
/** The additive building blocks. Everything else is derived from them, so several properties can be summed correctly. */
export interface KpiBase {
  days: number;
  availableRoomNights: number;
  soldRoomNights: number;
  /** Of the sold nights, how many are today or later (confirmed or in-house but not yet happened). */
  forecastNights: number;
  roomRevenueMinor: number;
  /** Front-desk extras billed to guests (POS room charges are counted under POS, not here). */
  extrasRevenueMinor: number;
  /** POS sales before tax, from every outlet, however they were settled. */
  posRevenueMinor: number;
  expensesMinor: number;
  bookingsMade: number;
  cancelledBookings: number;
  noShowBookings: number;
  stays: number;
  stayNights: number;
}

export interface PeriodKpis extends KpiBase {
  totalRevenueMinor: number;
  /** Revenue minus recorded expenses. An operating view, not accounting profit. */
  netMinor: number;
  occupancyPct: number | null;
  adrMinor: number | null;
  revparMinor: number | null;
  averageStayNights: number | null;
  cancellationRatePct: number | null;
}

export function buildKpis(base: KpiBase): PeriodKpis {
  const totalRevenueMinor = base.roomRevenueMinor + base.extrasRevenueMinor + base.posRevenueMinor;
  return {
    ...base,
    totalRevenueMinor,
    netMinor: totalRevenueMinor - base.expensesMinor,
    occupancyPct: percentOf(base.soldRoomNights, base.availableRoomNights),
    adrMinor: perUnit(base.roomRevenueMinor, base.soldRoomNights),
    revparMinor: perUnit(base.roomRevenueMinor, base.availableRoomNights),
    averageStayNights: base.stays > 0 ? Math.round((base.stayNights / base.stays) * 10) / 10 : null,
    cancellationRatePct: percentOf(base.cancelledBookings, base.bookingsMade),
  };
}

export const emptyKpiBase = (days: number): KpiBase => ({
  days, availableRoomNights: 0, soldRoomNights: 0, forecastNights: 0, roomRevenueMinor: 0, extrasRevenueMinor: 0, posRevenueMinor: 0, expensesMinor: 0,
  bookingsMade: 0, cancelledBookings: 0, noShowBookings: 0, stays: 0, stayNights: 0,
});

/** Several properties as one: add the building blocks, then work the ratios out again. Never average percentages. */
export function combineKpis(list: ReadonlyArray<PeriodKpis>): PeriodKpis {
  const base = emptyKpiBase(list[0]?.days ?? 0);
  for (const k of list) {
    base.availableRoomNights += k.availableRoomNights;
    base.soldRoomNights += k.soldRoomNights;
    base.forecastNights += k.forecastNights;
    base.roomRevenueMinor += k.roomRevenueMinor;
    base.extrasRevenueMinor += k.extrasRevenueMinor;
    base.posRevenueMinor += k.posRevenueMinor;
    base.expensesMinor += k.expensesMinor;
    base.bookingsMade += k.bookingsMade;
    base.cancelledBookings += k.cancelledBookings;
    base.noShowBookings += k.noShowBookings;
    base.stays += k.stays;
    base.stayNights += k.stayNights;
  }
  return buildKpis(base);
}

export interface DailyPoint {
  date: string;
  roomRevenueMinor: number;
  extrasRevenueMinor: number;
  posRevenueMinor: number;
  totalRevenueMinor: number;
  soldRoomNights: number;
  availableRoomNights: number;
  occupancyPct: number | null;
  adrMinor: number | null;
}

export function buildDaily(date: string, p: { roomRevenueMinor: number; extrasRevenueMinor: number; posRevenueMinor: number; soldRoomNights: number; availableRoomNights: number }): DailyPoint {
  return {
    date, ...p,
    totalRevenueMinor: p.roomRevenueMinor + p.extrasRevenueMinor + p.posRevenueMinor,
    occupancyPct: percentOf(p.soldRoomNights, p.availableRoomNights),
    adrMinor: perUnit(p.roomRevenueMinor, p.soldRoomNights),
  };
}

export function combineDaily(lists: ReadonlyArray<ReadonlyArray<DailyPoint>>): DailyPoint[] {
  const byDate = new Map<string, { roomRevenueMinor: number; extrasRevenueMinor: number; posRevenueMinor: number; soldRoomNights: number; availableRoomNights: number }>();
  for (const list of lists) {
    for (const d of list) {
      const t = byDate.get(d.date) ?? { roomRevenueMinor: 0, extrasRevenueMinor: 0, posRevenueMinor: 0, soldRoomNights: 0, availableRoomNights: 0 };
      t.roomRevenueMinor += d.roomRevenueMinor; t.extrasRevenueMinor += d.extrasRevenueMinor; t.posRevenueMinor += d.posRevenueMinor;
      t.soldRoomNights += d.soldRoomNights; t.availableRoomNights += d.availableRoomNights;
      byDate.set(d.date, t);
    }
  }
  return [...byDate.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, t]) => buildDaily(date, t));
}

// ================================================================== views
export interface PropertyAnalytics {
  propertyId: string;
  propertyName: string;
  currency: string;
  current: PeriodKpis;
  previous: PeriodKpis;
}

export interface AnalyticsOverview {
  range: { from: string; to: string; days: number };
  previousRange: { from: string; to: string };
  /** null when the properties use different currencies (their money can't be added). */
  currency: string | null;
  mixedCurrencies: boolean;
  current: PeriodKpis | null;
  previous: PeriodKpis | null;
  daily: DailyPoint[] | null;
  expensesByCategory: Array<{ category: string; totalMinor: number }>;
  posByOutlet: Array<{ outletName: string; totalMinor: number; orders: number }>;
  bookingSources: Array<{ source: string; bookings: number }>;
  properties: PropertyAnalytics[];
  /** true if a safety row limit was reached, so some figures may be incomplete (narrow the date range). */
  truncated: boolean;
}

// ================================================================== date range presets
export const ANALYTICS_PRESETS = ['last7', 'last30', 'last90', 'mtd', 'lastMonth', 'ytd'] as const;
export type AnalyticsPreset = (typeof ANALYTICS_PRESETS)[number];

export const PRESET_LABELS: Record<AnalyticsPreset, string> = {
  last7: 'Last 7 days',
  last30: 'Last 30 days',
  last90: 'Last 90 days',
  mtd: 'Month to date',
  lastMonth: 'Last month',
  ytd: 'Year to date',
};

/** The from/to dates (inclusive) of a preset, given today's date. */
export function presetRange(preset: AnalyticsPreset, today: string): { from: string; to: string } {
  const [year, month] = today.split('-').map(Number) as [number, number];
  const pad = (n: number) => String(n).padStart(2, '0');
  const thisMonthStart = `${year}-${pad(month)}-01`;
  switch (preset) {
    case 'last7': return { from: addDays(today, -6), to: today };
    case 'last30': return { from: addDays(today, -29), to: today };
    case 'last90': return { from: addDays(today, -89), to: today };
    case 'mtd': return { from: thisMonthStart, to: today };
    case 'lastMonth': return { from: month === 1 ? `${year - 1}-12-01` : `${year}-${pad(month - 1)}-01`, to: addDays(thisMonthStart, -1) };
    case 'ytd': return { from: `${year}-01-01`, to: today };
  }
}
