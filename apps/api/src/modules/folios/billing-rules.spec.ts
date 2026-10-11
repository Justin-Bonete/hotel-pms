import { PaymentMethod as PrismaMethod, FolioItemType as PrismaItemType, FolioStatus as PrismaFolioStatus } from '@prisma/client';
import {
  FOLIO_ITEM_TYPES, FOLIO_STATUSES, PAYMENT_METHODS, VOIDABLE_ITEM_TYPES, calcTaxMinor, computeFolioTotals, formatRate, nightlyRatesFrom, splitTotal,
} from '@pms/types';
import { describe, expect, it } from 'vitest';

describe('billing constants match the database', () => {
  it('enums are identical to the Prisma enums', () => {
    expect([...FOLIO_ITEM_TYPES].sort()).toEqual(Object.values(PrismaItemType).sort());
    expect([...PAYMENT_METHODS].sort()).toEqual(Object.values(PrismaMethod).sort());
    expect([...FOLIO_STATUSES].sort()).toEqual(Object.values(PrismaFolioStatus).sort());
  });

  it('tax and reversal lines cannot be voided directly', () => {
    expect(VOIDABLE_ITEM_TYPES).not.toContain('TAX');
    expect(VOIDABLE_ITEM_TYPES).not.toContain('REVERSAL');
  });
});

describe('tax maths (basis points, whole centavos, half-up)', () => {
  it('12% of 3,500.00 is 420.00', () => expect(calcTaxMinor(350000, 1200)).toBe(42000));
  it('rounds half-up on odd centavos', () => {
    expect(calcTaxMinor(1, 1200)).toBe(0);
    expect(calcTaxMinor(5, 1200)).toBe(1);
    expect(calcTaxMinor(4, 1250)).toBe(1);
  });
  it('never taxes zero, negative (discount) or 0% amounts', () => {
    expect(calcTaxMinor(0, 1200)).toBe(0);
    expect(calcTaxMinor(-1000, 1200)).toBe(0);
    expect(calcTaxMinor(100000, 0)).toBe(0);
  });
  it('stays exact at the largest amounts we allow', () => {
    expect(calcTaxMinor(999_999_999, 1200)).toBe(120_000_000);
    expect(Number.isSafeInteger(999_999_999 * 10_000)).toBe(true);
  });
  it('formats rates', () => {
    expect(formatRate(1200)).toBe('12%');
    expect(formatRate(1250)).toBe('12.50%');
  });
});

describe('splitting a booked total into nights', () => {
  it('always adds up exactly and spreads the remainder', () => {
    expect(splitTotal(10, 3)).toEqual([4, 3, 3]);
    for (const [total, parts] of [[123457, 7], [1, 5], [0, 4], [999_999_999, 365]] as const) {
      const rates = splitTotal(total, parts);
      expect(rates).toHaveLength(parts);
      expect(rates.reduce((a, b) => a + b, 0)).toBe(total);
    }
  });

  it('uses the booking snapshot only when it matches the stored total', () => {
    expect(nightlyRatesFrom([350000, 400000], 2, 750000)).toEqual([350000, 400000]);
    expect(nightlyRatesFrom([350000, 400000], 2, 999999)).toEqual(splitTotal(999999, 2));
    expect(nightlyRatesFrom(null, 3, 10)).toEqual([4, 3, 3]);
    expect(nightlyRatesFrom([1.5, 2], 2, 3)).toEqual(splitTotal(3, 2));
    expect(nightlyRatesFrom([1, 2, 3], 2, 6)).toEqual(splitTotal(6, 2));
  });
});

describe('folio totals', () => {
  const items = [{ amountMinor: 350000 }, { amountMinor: 42000 }, { amountMinor: -50000 }];

  it('balance due = charges - payments + refunds', () => {
    expect(computeFolioTotals({ items, payments: [], refunds: [] }).balanceMinor).toBe(342000);
    expect(computeFolioTotals({ items, payments: [{ amountMinor: 342000 }], refunds: [] }).balanceMinor).toBe(0);
  });

  it('an overpayment is a credit, and refunding it settles the folio', () => {
    expect(computeFolioTotals({ items, payments: [{ amountMinor: 400000 }], refunds: [] }).balanceMinor).toBe(-58000);
    expect(computeFolioTotals({ items, payments: [{ amountMinor: 400000 }], refunds: [{ amountMinor: 58000 }] }).balanceMinor).toBe(0);
  });

  it('a deposit before any charge is a credit', () => {
    expect(computeFolioTotals({ items: [], payments: [{ amountMinor: 100000 }], refunds: [] }).balanceMinor).toBe(-100000);
  });

  it('a voided line and its reversal cancel out exactly', () => {
    const voided = [{ amountMinor: 80000 }, { amountMinor: 9600 }, { amountMinor: -80000 }, { amountMinor: -9600 }];
    expect(computeFolioTotals({ items: voided, payments: [], refunds: [] }).itemsMinor).toBe(0);
  });
});
