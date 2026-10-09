import { describe, expect, it } from 'vitest';
import { canBook, nightlyAvailability } from './availability';

const stay = (arrivalDate: string, departureDate: string) => ({ arrivalDate, departureDate });

describe('nightlyAvailability', () => {
  it('everything is free when there are no reservations', () => {
    const nights = nightlyAvailability({ totalRooms: 3, reservations: [], from: '2026-10-01', days: 3 });
    expect(nights.map((n) => n.available)).toEqual([3, 3, 3]);
  });

  it('the check-out day is free again (the stay occupies nights, not the departure day)', () => {
    const nights = nightlyAvailability({ totalRooms: 1, reservations: [stay('2026-10-01', '2026-10-03')], from: '2026-10-01', days: 3 });
    expect(nights).toEqual([
      { date: '2026-10-01', available: 0 },
      { date: '2026-10-02', available: 0 },
      { date: '2026-10-03', available: 1 },
    ]);
  });

  it('a same-day turnover is allowed: one guest leaves the morning another arrives', () => {
    const nights = nightlyAvailability({ totalRooms: 1, reservations: [stay('2026-10-01', '2026-10-03')], from: '2026-10-03', days: 2 });
    expect(canBook(nights)).toBe(true);
  });

  it('never goes below zero when over-booked data exists', () => {
    const nights = nightlyAvailability({ totalRooms: 1, reservations: [stay('2026-10-01', '2026-10-02'), stay('2026-10-01', '2026-10-02')], from: '2026-10-01', days: 1 });
    expect(nights[0]?.available).toBe(0);
  });

  it('counts per night, not per overlapping reservation (no false "sold out")', () => {
    // 2 rooms. One stay on nights 1-2, another on nights 3-4. A stay over nights 1-4 still fits: each night has a free room.
    const nights = nightlyAvailability({
      totalRooms: 2,
      reservations: [stay('2026-10-01', '2026-10-03'), stay('2026-10-03', '2026-10-05')],
      from: '2026-10-01',
      days: 4,
    });
    expect(nights.map((n) => n.available)).toEqual([1, 1, 1, 1]);
    expect(canBook(nights)).toBe(true);
  });

  it('refuses a stay if even ONE night is full', () => {
    const nights = nightlyAvailability({
      totalRooms: 1,
      reservations: [stay('2026-10-03', '2026-10-04')],
      from: '2026-10-01',
      days: 4,
    });
    expect(nights.map((n) => n.available)).toEqual([1, 1, 0, 1]);
    expect(canBook(nights)).toBe(false);
  });
});
