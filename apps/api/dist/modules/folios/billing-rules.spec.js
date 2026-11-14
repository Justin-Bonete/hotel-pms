"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const types_1 = require("@pms/types");
const vitest_1 = require("vitest");
(0, vitest_1.describe)('billing constants match the database', () => {
    (0, vitest_1.it)('enums are identical to the Prisma enums', () => {
        (0, vitest_1.expect)([...types_1.FOLIO_ITEM_TYPES].sort()).toEqual(Object.values(client_1.FolioItemType).sort());
        (0, vitest_1.expect)([...types_1.PAYMENT_METHODS].sort()).toEqual(Object.values(client_1.PaymentMethod).sort());
        (0, vitest_1.expect)([...types_1.FOLIO_STATUSES].sort()).toEqual(Object.values(client_1.FolioStatus).sort());
    });
    (0, vitest_1.it)('tax and reversal lines cannot be voided directly', () => {
        (0, vitest_1.expect)(types_1.VOIDABLE_ITEM_TYPES).not.toContain('TAX');
        (0, vitest_1.expect)(types_1.VOIDABLE_ITEM_TYPES).not.toContain('REVERSAL');
    });
});
(0, vitest_1.describe)('tax maths (basis points, whole centavos, half-up)', () => {
    (0, vitest_1.it)('12% of 3,500.00 is 420.00', () => (0, vitest_1.expect)((0, types_1.calcTaxMinor)(350000, 1200)).toBe(42000));
    (0, vitest_1.it)('rounds half-up on odd centavos', () => {
        (0, vitest_1.expect)((0, types_1.calcTaxMinor)(1, 1200)).toBe(0);
        (0, vitest_1.expect)((0, types_1.calcTaxMinor)(5, 1200)).toBe(1);
        (0, vitest_1.expect)((0, types_1.calcTaxMinor)(4, 1250)).toBe(1);
    });
    (0, vitest_1.it)('never taxes zero, negative (discount) or 0% amounts', () => {
        (0, vitest_1.expect)((0, types_1.calcTaxMinor)(0, 1200)).toBe(0);
        (0, vitest_1.expect)((0, types_1.calcTaxMinor)(-1000, 1200)).toBe(0);
        (0, vitest_1.expect)((0, types_1.calcTaxMinor)(100000, 0)).toBe(0);
    });
    (0, vitest_1.it)('stays exact at the largest amounts we allow', () => {
        (0, vitest_1.expect)((0, types_1.calcTaxMinor)(999_999_999, 1200)).toBe(120_000_000);
        (0, vitest_1.expect)(Number.isSafeInteger(999_999_999 * 10_000)).toBe(true);
    });
    (0, vitest_1.it)('formats rates', () => {
        (0, vitest_1.expect)((0, types_1.formatRate)(1200)).toBe('12%');
        (0, vitest_1.expect)((0, types_1.formatRate)(1250)).toBe('12.50%');
    });
});
(0, vitest_1.describe)('splitting a booked total into nights', () => {
    (0, vitest_1.it)('always adds up exactly and spreads the remainder', () => {
        (0, vitest_1.expect)((0, types_1.splitTotal)(10, 3)).toEqual([4, 3, 3]);
        for (const [total, parts] of [[123457, 7], [1, 5], [0, 4], [999_999_999, 365]]) {
            const rates = (0, types_1.splitTotal)(total, parts);
            (0, vitest_1.expect)(rates).toHaveLength(parts);
            (0, vitest_1.expect)(rates.reduce((a, b) => a + b, 0)).toBe(total);
        }
    });
    (0, vitest_1.it)('uses the booking snapshot only when it matches the stored total', () => {
        (0, vitest_1.expect)((0, types_1.nightlyRatesFrom)([350000, 400000], 2, 750000)).toEqual([350000, 400000]);
        (0, vitest_1.expect)((0, types_1.nightlyRatesFrom)([350000, 400000], 2, 999999)).toEqual((0, types_1.splitTotal)(999999, 2));
        (0, vitest_1.expect)((0, types_1.nightlyRatesFrom)(null, 3, 10)).toEqual([4, 3, 3]);
        (0, vitest_1.expect)((0, types_1.nightlyRatesFrom)([1.5, 2], 2, 3)).toEqual((0, types_1.splitTotal)(3, 2));
        (0, vitest_1.expect)((0, types_1.nightlyRatesFrom)([1, 2, 3], 2, 6)).toEqual((0, types_1.splitTotal)(6, 2));
    });
});
(0, vitest_1.describe)('folio totals', () => {
    const items = [{ amountMinor: 350000 }, { amountMinor: 42000 }, { amountMinor: -50000 }];
    (0, vitest_1.it)('balance due = charges - payments + refunds', () => {
        (0, vitest_1.expect)((0, types_1.computeFolioTotals)({ items, payments: [], refunds: [] }).balanceMinor).toBe(342000);
        (0, vitest_1.expect)((0, types_1.computeFolioTotals)({ items, payments: [{ amountMinor: 342000 }], refunds: [] }).balanceMinor).toBe(0);
    });
    (0, vitest_1.it)('an overpayment is a credit, and refunding it settles the folio', () => {
        (0, vitest_1.expect)((0, types_1.computeFolioTotals)({ items, payments: [{ amountMinor: 400000 }], refunds: [] }).balanceMinor).toBe(-58000);
        (0, vitest_1.expect)((0, types_1.computeFolioTotals)({ items, payments: [{ amountMinor: 400000 }], refunds: [{ amountMinor: 58000 }] }).balanceMinor).toBe(0);
    });
    (0, vitest_1.it)('a deposit before any charge is a credit', () => {
        (0, vitest_1.expect)((0, types_1.computeFolioTotals)({ items: [], payments: [{ amountMinor: 100000 }], refunds: [] }).balanceMinor).toBe(-100000);
    });
    (0, vitest_1.it)('a voided line and its reversal cancel out exactly', () => {
        const voided = [{ amountMinor: 80000 }, { amountMinor: 9600 }, { amountMinor: -80000 }, { amountMinor: -9600 }];
        (0, vitest_1.expect)((0, types_1.computeFolioTotals)({ items: voided, payments: [], refunds: [] }).itemsMinor).toBe(0);
    });
});
//# sourceMappingURL=billing-rules.spec.js.map