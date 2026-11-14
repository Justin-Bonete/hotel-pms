"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const types_1 = require("@pms/types");
const vitest_1 = require("vitest");
(0, vitest_1.describe)('business constants match the database', () => {
    (0, vitest_1.it)('enums are identical to the Prisma enums', () => {
        (0, vitest_1.expect)([...types_1.INVENTORY_CATEGORIES].sort()).toEqual(Object.values(client_1.InventoryCategory).sort());
        (0, vitest_1.expect)([...types_1.STOCK_MOVEMENT_TYPES].sort()).toEqual(Object.values(client_1.StockMovementType).sort());
        (0, vitest_1.expect)([...types_1.PURCHASE_STATUSES].sort()).toEqual(Object.values(client_1.PurchaseStatus).sort());
        (0, vitest_1.expect)([...types_1.INVOICE_STATUSES].sort()).toEqual(Object.values(client_1.InvoiceStatus).sort());
        (0, vitest_1.expect)([...types_1.EXPENSE_CATEGORIES].sort()).toEqual(Object.values(client_1.ExpenseCategory).sort());
    });
    (0, vitest_1.it)('people can only enter four kinds of movement by hand', () => {
        (0, vitest_1.expect)([...types_1.MANUAL_MOVEMENT_TYPES].sort()).toEqual(['ADJUSTMENT', 'OPENING', 'USAGE', 'WASTAGE']);
    });
});
(0, vitest_1.describe)('stock movements', () => {
    (0, vitest_1.it)('stock goes up for opening, receipts and incoming transfers, and down for usage, wastage and outgoing transfers', () => {
        for (const t of ['OPENING', 'PURCHASE_RECEIPT', 'TRANSFER_IN'])
            (0, vitest_1.expect)((0, types_1.movementDelta)(t, 5)).toBe(5);
        for (const t of ['USAGE', 'WASTAGE', 'TRANSFER_OUT'])
            (0, vitest_1.expect)((0, types_1.movementDelta)(t, 5)).toBe(-5);
    });
    (0, vitest_1.it)('typing a minus sign never reverses a movement (only an adjustment is signed)', () => {
        (0, vitest_1.expect)((0, types_1.movementDelta)('WASTAGE', -5)).toBe(-5);
        (0, vitest_1.expect)((0, types_1.movementDelta)('OPENING', -5)).toBe(5);
        (0, vitest_1.expect)((0, types_1.movementDelta)('ADJUSTMENT', -5)).toBe(-5);
        (0, vitest_1.expect)((0, types_1.movementDelta)('ADJUSTMENT', 7)).toBe(7);
    });
});
(0, vitest_1.describe)('stock status and reorder suggestion', () => {
    (0, vitest_1.it)('classifies stock', () => {
        (0, vitest_1.expect)((0, types_1.stockStatus)(0, 10, 50)).toBe('OUT');
        (0, vitest_1.expect)((0, types_1.stockStatus)(-3, 10, 50)).toBe('OUT');
        (0, vitest_1.expect)((0, types_1.stockStatus)(9, 10, 50)).toBe('LOW');
        (0, vitest_1.expect)((0, types_1.stockStatus)(10, 10, 50)).toBe('OK');
        (0, vitest_1.expect)((0, types_1.stockStatus)(51, 10, 50)).toBe('OVER');
        (0, vitest_1.expect)((0, types_1.stockStatus)(500, 10, 0)).toBe('OK');
    });
    (0, vitest_1.it)('suggests topping up to the maximum, or twice the minimum when there is no maximum', () => {
        (0, vitest_1.expect)((0, types_1.suggestedReorder)(4, 10, 50)).toBe(46);
        (0, vitest_1.expect)((0, types_1.suggestedReorder)(4, 10, 0)).toBe(16);
        (0, vitest_1.expect)((0, types_1.suggestedReorder)(10, 10, 50)).toBe(0);
        (0, vitest_1.expect)((0, types_1.suggestedReorder)(80, 10, 50)).toBe(0);
    });
});
(0, vitest_1.describe)('purchase order workflow', () => {
    (0, vitest_1.it)('only a requested order can be approved or rejected; only an order with nothing received can be cancelled', () => {
        (0, vitest_1.expect)([...types_1.PO_DECISION_FROM.approve]).toEqual(['REQUESTED']);
        (0, vitest_1.expect)([...types_1.PO_DECISION_FROM.reject]).toEqual(['REQUESTED']);
        (0, vitest_1.expect)(types_1.PO_DECISION_FROM.cancel).not.toContain('PARTIALLY_RECEIVED');
        (0, vitest_1.expect)(types_1.PO_DECISION_FROM.cancel).not.toContain('RECEIVED');
        for (const d of types_1.PURCHASE_DECISIONS)
            (0, vitest_1.expect)(types_1.PURCHASE_STATUSES).toContain(types_1.PO_DECISION_RESULT[d]);
    });
    (0, vitest_1.it)('goods can be received only after approval, and an invoice recorded only after something arrived', () => {
        (0, vitest_1.expect)([...types_1.RECEIVABLE_STATUSES]).toEqual(['APPROVED', 'PARTIALLY_RECEIVED']);
        (0, vitest_1.expect)([...types_1.INVOICEABLE_STATUSES]).toEqual(['PARTIALLY_RECEIVED', 'RECEIVED']);
        for (const s of ['REQUESTED', 'REJECTED', 'CANCELLED']) {
            (0, vitest_1.expect)(types_1.RECEIVABLE_STATUSES).not.toContain(s);
            (0, vitest_1.expect)(types_1.INVOICEABLE_STATUSES).not.toContain(s);
        }
        (0, vitest_1.expect)(types_1.OPEN_PURCHASE_STATUSES).not.toContain('RECEIVED');
    });
    (0, vitest_1.it)('nobody approves their own request, unless nobody else could (one-manager hotel)', () => {
        (0, vitest_1.expect)((0, types_1.mayApprove)('alice', 'bob', 3)).toBe(true);
        (0, vitest_1.expect)((0, types_1.mayApprove)('alice', 'alice', 1)).toBe(false);
        (0, vitest_1.expect)((0, types_1.mayApprove)('alice', 'alice', 0)).toBe(true);
        (0, vitest_1.expect)((0, types_1.mayApprove)(null, 'alice', 2)).toBe(true);
    });
});
(0, vitest_1.describe)('receiving and invoice matching (whole centavos)', () => {
    const lines = [
        { quantity: 10, unitCostMinor: 25000, receivedQuantity: 10 },
        { quantity: 4, unitCostMinor: 120050, receivedQuantity: 1 },
    ];
    (0, vitest_1.it)('totals the order and the value of what actually arrived', () => {
        (0, vitest_1.expect)((0, types_1.poTotal)(lines)).toBe(10 * 25000 + 4 * 120050);
        (0, vitest_1.expect)((0, types_1.receivedValue)(lines)).toBe(10 * 25000 + 1 * 120050);
        (0, vitest_1.expect)(Number.isInteger((0, types_1.poTotal)(lines))).toBe(true);
    });
    (0, vitest_1.it)('is partially received until every line is complete', () => {
        (0, vitest_1.expect)((0, types_1.receiptStatus)(lines)).toBe('PARTIALLY_RECEIVED');
        (0, vitest_1.expect)((0, types_1.receiptStatus)([{ quantity: 4, receivedQuantity: 4 }, { quantity: 1, receivedQuantity: 1 }])).toBe('RECEIVED');
        (0, vitest_1.expect)((0, types_1.remainingToReceive)({ quantity: 10, receivedQuantity: 3 })).toBe(7);
    });
    (0, vitest_1.it)('flags an invoice that charges more or less than the goods received', () => {
        (0, vitest_1.expect)((0, types_1.invoiceVariance)(370050, 370050)).toBe(0);
        (0, vitest_1.expect)((0, types_1.invoiceVariance)(400000, 370050)).toBe(29950);
        (0, vitest_1.expect)((0, types_1.invoiceVariance)(300000, 370050)).toBe(-70050);
    });
});
//# sourceMappingURL=business-rules.spec.js.map