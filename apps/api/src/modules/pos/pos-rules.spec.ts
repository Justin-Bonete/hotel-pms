import { OutletType as PrismaOutletType, PosOrderStatus as PrismaPosStatus } from '@prisma/client';
import { OUTLET_TYPES, POS_ORDER_STATUSES, calcTaxMinor, posLineTotals, stockNeeded, zonedDayRange } from '@pms/types';
import { describe, expect, it } from 'vitest';

describe('POS constants match the database', () => {
  it('enums are identical to the Prisma enums', () => {
    expect([...OUTLET_TYPES].sort()).toEqual(Object.values(PrismaOutletType).sort());
    expect([...POS_ORDER_STATUSES].sort()).toEqual(Object.values(PrismaPosStatus).sort());
  });
});

describe('sale totals (whole centavos)', () => {
  const vat = [{ rateBps: 1200 }];

  it('adds tax to taxable lines only', () => {
    const t = posLineTotals([{ quantity: 2, unitAmountMinor: 15000, taxable: true }, { quantity: 1, unitAmountMinor: 5000, taxable: false }], vat);
    expect(t.subtotalMinor).toBe(35000);
    expect(t.taxMinor).toBe(3600);
    expect(t.totalMinor).toBe(38600);
    expect(t.lines).toEqual([{ amountMinor: 30000, taxMinor: 3600 }, { amountMinor: 5000, taxMinor: 0 }]);
  });

  it('with no taxes the total is the subtotal', () => {
    const t = posLineTotals([{ quantity: 3, unitAmountMinor: 12000, taxable: true }], []);
    expect(t.taxMinor).toBe(0);
    expect(t.totalMinor).toBe(36000);
  });

  it('works out tax per line and per tax, exactly as the guest bill does, so a room charge matches the receipt', () => {
    const taxes = [{ rateBps: 1200 }, { rateBps: 300 }];
    const lines = [{ quantity: 3, unitAmountMinor: 3333, taxable: true }, { quantity: 1, unitAmountMinor: 999, taxable: true }];
    const t = posLineTotals(lines, taxes);
    const expected = lines.reduce((sum, l) => sum + taxes.reduce((s, x) => s + calcTaxMinor(l.quantity * l.unitAmountMinor, x.rateBps), 0), 0);
    expect(t.taxMinor).toBe(expected);
    expect(Number.isInteger(t.totalMinor)).toBe(true);
    expect(t.totalMinor).toBe(t.subtotalMinor + t.taxMinor);
    expect(t.lines.reduce((s, l) => s + l.taxMinor, 0)).toBe(t.taxMinor);
  });

  it('a free item adds nothing', () => {
    expect(posLineTotals([{ quantity: 1, unitAmountMinor: 0, taxable: true }], vat).totalMinor).toBe(0);
  });
});

describe('stock a sale uses', () => {
  it('adds up the same stock item across lines and ignores items that are not tracked', () => {
    const need = stockNeeded([
      { quantity: 2, inventoryItemId: 'water', inventoryQuantity: 1 },
      { quantity: 3, inventoryItemId: 'water', inventoryQuantity: 1 },
      { quantity: 4, inventoryItemId: 'rice', inventoryQuantity: 2 },
      { quantity: 9, inventoryItemId: null, inventoryQuantity: 1 },
      { quantity: 5, inventoryItemId: 'bulb', inventoryQuantity: 0 },
    ]);
    expect(need.get('water')).toBe(5);
    expect(need.get('rice')).toBe(8);
    expect(need.has('bulb')).toBe(false);
    expect(need.size).toBe(2);
  });
});

describe('the property’s own day', () => {
  it('Manila (UTC+8, no daylight saving): the day starts at 16:00 UTC the evening before', () => {
    const { start, end } = zonedDayRange('2026-11-12', 'Asia/Manila');
    expect(start.toISOString()).toBe('2026-11-11T16:00:00.000Z');
    expect(end.toISOString()).toBe('2026-11-12T16:00:00.000Z');
  });

  it('UTC: the day is the plain calendar day', () => {
    const { start, end } = zonedDayRange('2026-11-12', 'UTC');
    expect(start.toISOString()).toBe('2026-11-12T00:00:00.000Z');
    expect(end.toISOString()).toBe('2026-11-13T00:00:00.000Z');
  });

  it('a day with a daylight-saving change is 23 hours long (New York, spring)', () => {
    const { start, end } = zonedDayRange('2026-03-08', 'America/New_York');
    expect(start.toISOString()).toBe('2026-03-08T05:00:00.000Z');
    expect(end.toISOString()).toBe('2026-03-09T04:00:00.000Z');
    expect((end.getTime() - start.getTime()) / 3_600_000).toBe(23);
  });

  it('consecutive days never overlap or leave a gap', () => {
    const a = zonedDayRange('2026-11-12', 'Asia/Manila');
    const b = zonedDayRange('2026-11-13', 'Asia/Manila');
    expect(a.end.getTime()).toBe(b.start.getTime());
  });
});
