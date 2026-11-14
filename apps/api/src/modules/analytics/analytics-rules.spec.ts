import {
  ANALYTICS_PRESETS, buildDaily, buildKpis, combineDaily, combineKpis, eachDate, emptyKpiBase, inclusiveDays, localDateOf, percentChange, percentOf, perUnit, presetRange, previousPeriod, stayNights,
  type StayForAnalytics,
} from '@pms/types';
import { csvCell, toCsv } from '@pms/utils';
import { describe, expect, it } from 'vitest';

const stay = (over: Partial<StayForAnalytics> = {}): StayForAnalytics => ({ status: 'CHECKED_OUT', arrivalDate: '2026-11-10', departureDate: '2026-11-13', nights: 3, totalMinor: 300000, nightlyRates: [100000, 100000, 100000], ...over });
const range = { from: '2026-11-01', to: '2026-11-30' };

describe('periods', () => {
  it('counts both end dates', () => {
    expect(inclusiveDays('2026-11-01', '2026-11-30')).toBe(30);
    expect(inclusiveDays('2026-11-14', '2026-11-14')).toBe(1);
    expect(eachDate('2026-11-28', '2026-12-02')).toEqual(['2026-11-28', '2026-11-29', '2026-11-30', '2026-12-01', '2026-12-02']);
  });

  it('the previous period has the same length and ends the day before', () => {
    expect(previousPeriod('2026-11-01', '2026-11-30')).toEqual({ from: '2026-10-02', to: '2026-10-31' });
    expect(previousPeriod('2026-11-14', '2026-11-14')).toEqual({ from: '2026-11-13', to: '2026-11-13' });
    const p = previousPeriod('2026-03-01', '2026-03-31');
    expect(inclusiveDays(p.from, p.to)).toBe(31);
  });

  it('works out the property’s own local date, not the server’s', () => {
    // 20:00 UTC on 14 Nov is already 15 Nov in Manila (UTC+8)
    expect(localDateOf(new Date('2026-11-14T20:00:00Z'), 'Asia/Manila')).toBe('2026-11-15');
    expect(localDateOf(new Date('2026-11-14T20:00:00Z'), 'UTC')).toBe('2026-11-14');
  });
});

describe('percentages never lie', () => {
  it('percent change has one decimal and is null (not Infinity) when there is nothing to compare', () => {
    expect(percentChange(120, 100)).toBe(20);
    expect(percentChange(80, 100)).toBe(-20);
    expect(percentChange(5, 0)).toBeNull();
    expect(percentChange(0, 0)).toBeNull();
    expect(percentChange(1, 3)).toBe(-66.7);
  });

  it('a ratio over zero is not a number, never 0', () => {
    expect(percentOf(3, 0)).toBeNull();
    expect(perUnit(1000, 0)).toBeNull();
    expect(percentOf(0, 10)).toBe(0);
    expect(perUnit(1000, 3)).toBe(333);
  });
});

describe('which room nights count', () => {
  it('a finished stay counts every night in the range, with that night’s rate', () => {
    const nights = stayNights(stay(), range, '2026-11-20');
    expect(nights.map((n) => n.date)).toEqual(['2026-11-10', '2026-11-11', '2026-11-12']);
    expect(nights.every((n) => n.revenueMinor === 100000 && !n.forecast)).toBe(true);
  });

  it('only nights inside the range count (a stay crossing the start or end is clipped)', () => {
    expect(stayNights(stay({ arrivalDate: '2026-10-30', departureDate: '2026-11-03', nights: 4, nightlyRates: [1, 2, 3, 4], totalMinor: 10 }), range, '2026-12-01').map((n) => n.date)).toEqual(['2026-11-01', '2026-11-02']);
    expect(stayNights(stay({ arrivalDate: '2026-11-29', departureDate: '2026-12-02', nights: 3 }), range, '2026-12-05').map((n) => n.date)).toEqual(['2026-11-29', '2026-11-30']);
  });

  it('the departure day is not a night', () => {
    expect(stayNights(stay({ arrivalDate: '2026-11-10', departureDate: '2026-11-11', nights: 1, nightlyRates: [50000], totalMinor: 50000 }), range, '2026-12-01')).toHaveLength(1);
  });

  it('a confirmed booking counts only for nights from today on (flagged as forecast); a past one that never checked in does not', () => {
    const confirmed = stay({ status: 'CONFIRMED', arrivalDate: '2026-11-13', departureDate: '2026-11-17', nights: 4, nightlyRates: [1, 1, 1, 1], totalMinor: 4 });
    const result = stayNights(confirmed, range, '2026-11-15');
    expect(result.map((n) => n.date)).toEqual(['2026-11-15', '2026-11-16']);
    expect(result.every((n) => n.forecast)).toBe(true);
  });

  it('an in-house guest: past nights are actual, tonight and later are forecast', () => {
    const inHouse = stay({ status: 'CHECKED_IN', arrivalDate: '2026-11-13', departureDate: '2026-11-17', nights: 4, nightlyRates: [1, 1, 1, 1], totalMinor: 4 });
    expect(stayNights(inHouse, range, '2026-11-15').map((n) => n.forecast)).toEqual([false, false, true, true]);
  });

  it('cancelled, no-show, inquiry and pending stays never count', () => {
    for (const status of ['CANCELLED', 'NO_SHOW', 'INQUIRY', 'PENDING']) expect(stayNights(stay({ status }), range, '2026-11-20')).toEqual([]);
  });

  it('an extended stay uses the extra nights’ own rates', () => {
    const extended = stay({ status: 'CHECKED_IN', nights: 4, arrivalDate: '2026-11-10', departureDate: '2026-11-14', nightlyRates: [100000, 100000, 100000, 150000], totalMinor: 450000 });
    expect(stayNights(extended, range, '2026-11-12').map((n) => n.revenueMinor)).toEqual([100000, 100000, 100000, 150000]);
  });

  it('falls back to splitting the total when a stay has no per-night rates', () => {
    const legacy = stay({ nightlyRates: null, nights: 3, totalMinor: 100000 });
    const total = stayNights(legacy, range, '2026-12-01').reduce((s, n) => s + n.revenueMinor, 0);
    expect(total).toBe(100000);
  });
});

describe('KPIs', () => {
  const base = { ...emptyKpiBase(30), availableRoomNights: 300, soldRoomNights: 150, roomRevenueMinor: 45_000_000, extrasRevenueMinor: 1_000_000, posRevenueMinor: 4_000_000, expensesMinor: 20_000_000, bookingsMade: 40, cancelledBookings: 4, noShowBookings: 1, stays: 30, stayNights: 75 };

  it('occupancy, ADR and RevPAR follow their definitions', () => {
    const k = buildKpis(base);
    expect(k.occupancyPct).toBe(50);
    expect(k.adrMinor).toBe(300000); // 45,000,000 / 150
    expect(k.revparMinor).toBe(150000); // 45,000,000 / 300
    expect(k.adrMinor! * k.occupancyPct! / 100).toBe(k.revparMinor); // RevPAR = ADR x occupancy
  });

  it('total revenue adds rooms, extras and POS; net subtracts expenses', () => {
    const k = buildKpis(base);
    expect(k.totalRevenueMinor).toBe(50_000_000);
    expect(k.netMinor).toBe(30_000_000);
    expect(k.averageStayNights).toBe(2.5);
    expect(k.cancellationRatePct).toBe(10);
  });

  it('with no rooms or no sales the ratios are not numbers, never a false 0', () => {
    const k = buildKpis(emptyKpiBase(30));
    expect([k.occupancyPct, k.adrMinor, k.revparMinor, k.averageStayNights, k.cancellationRatePct]).toEqual([null, null, null, null, null]);
    expect(k.totalRevenueMinor).toBe(0);
  });

  it('several properties are summed and the ratios worked out again, NOT averaged', () => {
    const big = buildKpis({ ...emptyKpiBase(30), availableRoomNights: 900, soldRoomNights: 900, roomRevenueMinor: 90_000_000 }); // 100%, ADR 100,000
    const small = buildKpis({ ...emptyKpiBase(30), availableRoomNights: 100, soldRoomNights: 0, roomRevenueMinor: 0 }); // 0%
    const all = combineKpis([big, small]);
    expect(all.occupancyPct).toBe(90); // averaging the two percentages would wrongly say 50
    expect(all.adrMinor).toBe(100000);
    expect(all.revparMinor).toBe(90000);
  });
});

describe('daily series', () => {
  it('builds each day and merges properties day by day', () => {
    const a = [buildDaily('2026-11-01', { roomRevenueMinor: 1000, extrasRevenueMinor: 0, posRevenueMinor: 100, soldRoomNights: 1, availableRoomNights: 2 })];
    const b = [buildDaily('2026-11-01', { roomRevenueMinor: 3000, extrasRevenueMinor: 50, posRevenueMinor: 0, soldRoomNights: 3, availableRoomNights: 4 }), buildDaily('2026-11-02', { roomRevenueMinor: 0, extrasRevenueMinor: 0, posRevenueMinor: 0, soldRoomNights: 0, availableRoomNights: 4 })];
    const merged = combineDaily([a, b]);
    expect(merged.map((d) => d.date)).toEqual(['2026-11-01', '2026-11-02']);
    expect(merged[0]).toMatchObject({ roomRevenueMinor: 4000, totalRevenueMinor: 4150, soldRoomNights: 4, availableRoomNights: 6, occupancyPct: 66.7, adrMinor: 1000 });
    expect(merged[1]!.occupancyPct).toBe(0);
  });
});

describe('CSV export', () => {
  it('quotes commas, quotes and line breaks', () => {
    expect(csvCell('Smith, John')).toBe('"Smith, John"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell('a\nb')).toBe('"a\nb"');
    expect(csvCell(null)).toBe('');
    expect(csvCell(undefined)).toBe('');
  });

  it('neutralises spreadsheet formulas in text, but leaves real negative numbers alone', () => {
    expect(csvCell('=HYPERLINK("http://evil")')).toBe(`"'=HYPERLINK(""http://evil"")"`);
    expect(csvCell('+1+1')).toBe("'+1+1");
    expect(csvCell('-2')).toBe("'-2");
    expect(csvCell('@SUM(A1)')).toBe("'@SUM(A1)");
    expect(csvCell(-1500)).toBe('-1500');
    expect(csvCell(12.5)).toBe('12.5');
  });

  it('writes rows with Windows line endings', () => {
    expect(toCsv([['a', 'b'], [1, 'x,y']])).toBe('a,b\r\n1,"x,y"');
  });
});

describe('date range presets', () => {
  it('rolling presets are exactly that many days, ending today', () => {
    for (const [preset, days] of [['last7', 7], ['last30', 30], ['last90', 90]] as const) {
      const r = presetRange(preset, '2026-11-14');
      expect(r.to).toBe('2026-11-14');
      expect(inclusiveDays(r.from, r.to)).toBe(days);
    }
  });

  it('month and year to date start on the first', () => {
    expect(presetRange('mtd', '2026-11-14')).toEqual({ from: '2026-11-01', to: '2026-11-14' });
    expect(presetRange('ytd', '2026-11-14')).toEqual({ from: '2026-01-01', to: '2026-11-14' });
  });

  it('last month is the whole previous calendar month, including across a year and a leap February', () => {
    expect(presetRange('lastMonth', '2026-11-14')).toEqual({ from: '2026-10-01', to: '2026-10-31' });
    expect(presetRange('lastMonth', '2026-01-10')).toEqual({ from: '2025-12-01', to: '2025-12-31' });
    expect(presetRange('lastMonth', '2028-03-05')).toEqual({ from: '2028-02-01', to: '2028-02-29' });
  });

  it('every preset stays inside the 366-day limit', () => {
    for (const p of ANALYTICS_PRESETS) {
      const r = presetRange(p, '2026-12-31');
      expect(inclusiveDays(r.from, r.to) <= 366).toBe(true);
    }
  });
});
