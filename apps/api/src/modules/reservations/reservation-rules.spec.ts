import { ReservationSource as PrismaSource, ReservationStatus as PrismaStatus } from '@prisma/client';
import {
  ACTION_FROM, ACTION_RESULT, CREATABLE_STATUSES, EDITABLE_STATUSES, HOLDING_STATUSES, RESERVATION_ACTIONS,
  RESERVATION_SOURCES, RESERVATION_STATUSES, addDays, isDateString, nightsBetween, quoteStay, todayIn,
} from '@pms/types';
import { describe, expect, it } from 'vitest';

describe('reservation constants match the database', () => {
  it('statuses and sources are identical to the Prisma enums', () => {
    expect([...RESERVATION_STATUSES].sort()).toEqual(Object.values(PrismaStatus).sort());
    expect([...RESERVATION_SOURCES].sort()).toEqual(Object.values(PrismaSource).sort());
  });
});

describe('reservation status flow', () => {
  it('every action is allowed from at least one status', () => {
    for (const a of RESERVATION_ACTIONS) expect(ACTION_FROM[a].length).toBeGreaterThan(0);
  });

  it('check-in only from CONFIRMED, check-out only from CHECKED_IN', () => {
    expect([...ACTION_FROM.check_in]).toEqual(['CONFIRMED']);
    expect([...ACTION_FROM.check_out]).toEqual(['CHECKED_IN']);
  });

  it('terminal statuses allow no action', () => {
    for (const terminal of ['CHECKED_OUT', 'CANCELLED', 'NO_SHOW'] as const) {
      for (const a of RESERVATION_ACTIONS) expect(ACTION_FROM[a], `${a} from ${terminal}`).not.toContain(terminal);
    }
  });

  it('inquiries do not hold a room; new reservations can only start as inquiry, pending or confirmed', () => {
    expect(HOLDING_STATUSES).not.toContain('INQUIRY');
    expect([...CREATABLE_STATUSES]).toEqual(['INQUIRY', 'PENDING', 'CONFIRMED']);
  });

  it('a checked-in stay cannot be edited or cancelled', () => {
    expect(EDITABLE_STATUSES).not.toContain('CHECKED_IN');
    expect(ACTION_FROM.cancel).not.toContain('CHECKED_IN');
    expect(ACTION_RESULT.check_in).toBe('CHECKED_IN');
  });
});

describe('stay dates and pricing (money is whole centavos)', () => {
  it('counts nights and handles month and year ends', () => {
    expect(nightsBetween('2026-10-02', '2026-10-05')).toBe(3);
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
  });

  it('rejects impossible dates', () => {
    expect(isDateString('2026-02-30')).toBe(false);
    expect(isDateString('2026-10-04')).toBe(true);
  });

  it('Friday and Saturday nights use the weekend rate', () => {
    const q = quoteStay('2026-10-01', '2026-10-05', { nightlyRateMinor: 350000, weekendRateMinor: 400000 }); // Thu Fri Sat Sun
    expect(q.nights).toBe(4);
    expect(q.totalMinor).toBe(350000 + 400000 + 400000 + 350000);
  });

  it('without a weekend rate every night costs the nightly rate', () => {
    expect(quoteStay('2026-10-01', '2026-10-04', { nightlyRateMinor: 100, weekendRateMinor: null }).totalMinor).toBe(300);
  });

  it('"today" follows the property timezone', () => {
    const instant = new Date('2026-10-04T20:00:00Z');
    expect(todayIn('UTC', instant)).toBe('2026-10-04');
    expect(todayIn('Asia/Manila', instant)).toBe('2026-10-05');
  });
});
