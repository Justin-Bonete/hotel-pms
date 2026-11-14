"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const types_1 = require("@pms/types");
const vitest_1 = require("vitest");
(0, vitest_1.describe)('POS constants match the database', () => {
    (0, vitest_1.it)('enums are identical to the Prisma enums', () => {
        (0, vitest_1.expect)([...types_1.OUTLET_TYPES].sort()).toEqual(Object.values(client_1.OutletType).sort());
        (0, vitest_1.expect)([...types_1.POS_ORDER_STATUSES].sort()).toEqual(Object.values(client_1.PosOrderStatus).sort());
    });
});
(0, vitest_1.describe)('sale totals (whole centavos)', () => {
    const vat = [{ rateBps: 1200 }];
    (0, vitest_1.it)('adds tax to taxable lines only', () => {
        const t = (0, types_1.posLineTotals)([{ quantity: 2, unitAmountMinor: 15000, taxable: true }, { quantity: 1, unitAmountMinor: 5000, taxable: false }], vat);
        (0, vitest_1.expect)(t.subtotalMinor).toBe(35000);
        (0, vitest_1.expect)(t.taxMinor).toBe(3600);
        (0, vitest_1.expect)(t.totalMinor).toBe(38600);
        (0, vitest_1.expect)(t.lines).toEqual([{ amountMinor: 30000, taxMinor: 3600 }, { amountMinor: 5000, taxMinor: 0 }]);
    });
    (0, vitest_1.it)('with no taxes the total is the subtotal', () => {
        const t = (0, types_1.posLineTotals)([{ quantity: 3, unitAmountMinor: 12000, taxable: true }], []);
        (0, vitest_1.expect)(t.taxMinor).toBe(0);
        (0, vitest_1.expect)(t.totalMinor).toBe(36000);
    });
    (0, vitest_1.it)('works out tax per line and per tax, exactly as the guest bill does, so a room charge matches the receipt', () => {
        const taxes = [{ rateBps: 1200 }, { rateBps: 300 }];
        const lines = [{ quantity: 3, unitAmountMinor: 3333, taxable: true }, { quantity: 1, unitAmountMinor: 999, taxable: true }];
        const t = (0, types_1.posLineTotals)(lines, taxes);
        const expected = lines.reduce((sum, l) => sum + taxes.reduce((s, x) => s + (0, types_1.calcTaxMinor)(l.quantity * l.unitAmountMinor, x.rateBps), 0), 0);
        (0, vitest_1.expect)(t.taxMinor).toBe(expected);
        (0, vitest_1.expect)(Number.isInteger(t.totalMinor)).toBe(true);
        (0, vitest_1.expect)(t.totalMinor).toBe(t.subtotalMinor + t.taxMinor);
        (0, vitest_1.expect)(t.lines.reduce((s, l) => s + l.taxMinor, 0)).toBe(t.taxMinor);
    });
    (0, vitest_1.it)('a free item adds nothing', () => {
        (0, vitest_1.expect)((0, types_1.posLineTotals)([{ quantity: 1, unitAmountMinor: 0, taxable: true }], vat).totalMinor).toBe(0);
    });
});
(0, vitest_1.describe)('stock a sale uses', () => {
    (0, vitest_1.it)('adds up the same stock item across lines and ignores items that are not tracked', () => {
        const need = (0, types_1.stockNeeded)([
            { quantity: 2, inventoryItemId: 'water', inventoryQuantity: 1 },
            { quantity: 3, inventoryItemId: 'water', inventoryQuantity: 1 },
            { quantity: 4, inventoryItemId: 'rice', inventoryQuantity: 2 },
            { quantity: 9, inventoryItemId: null, inventoryQuantity: 1 },
            { quantity: 5, inventoryItemId: 'bulb', inventoryQuantity: 0 },
        ]);
        (0, vitest_1.expect)(need.get('water')).toBe(5);
        (0, vitest_1.expect)(need.get('rice')).toBe(8);
        (0, vitest_1.expect)(need.has('bulb')).toBe(false);
        (0, vitest_1.expect)(need.size).toBe(2);
    });
});
(0, vitest_1.describe)('the property’s own day', () => {
    (0, vitest_1.it)('Manila (UTC+8, no daylight saving): the day starts at 16:00 UTC the evening before', () => {
        const { start, end } = (0, types_1.zonedDayRange)('2026-11-12', 'Asia/Manila');
        (0, vitest_1.expect)(start.toISOString()).toBe('2026-11-11T16:00:00.000Z');
        (0, vitest_1.expect)(end.toISOString()).toBe('2026-11-12T16:00:00.000Z');
    });
    (0, vitest_1.it)('UTC: the day is the plain calendar day', () => {
        const { start, end } = (0, types_1.zonedDayRange)('2026-11-12', 'UTC');
        (0, vitest_1.expect)(start.toISOString()).toBe('2026-11-12T00:00:00.000Z');
        (0, vitest_1.expect)(end.toISOString()).toBe('2026-11-13T00:00:00.000Z');
    });
    (0, vitest_1.it)('a day with a daylight-saving change is 23 hours long (New York, spring)', () => {
        const { start, end } = (0, types_1.zonedDayRange)('2026-03-08', 'America/New_York');
        (0, vitest_1.expect)(start.toISOString()).toBe('2026-03-08T05:00:00.000Z');
        (0, vitest_1.expect)(end.toISOString()).toBe('2026-03-09T04:00:00.000Z');
        (0, vitest_1.expect)((end.getTime() - start.getTime()) / 3_600_000).toBe(23);
    });
    (0, vitest_1.it)('consecutive days never overlap or leave a gap', () => {
        const a = (0, types_1.zonedDayRange)('2026-11-12', 'Asia/Manila');
        const b = (0, types_1.zonedDayRange)('2026-11-13', 'Asia/Manila');
        (0, vitest_1.expect)(a.end.getTime()).toBe(b.start.getTime());
    });
});
//# sourceMappingURL=pos-rules.spec.js.map