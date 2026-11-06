import {
  ExpenseCategory as PrismaExpenseCategory, InventoryCategory as PrismaCategory, InvoiceStatus as PrismaInvoiceStatus,
  PurchaseStatus as PrismaPurchaseStatus, StockMovementType as PrismaMovementType,
} from '@prisma/client';
import {
  EXPENSE_CATEGORIES, INVENTORY_CATEGORIES, INVOICE_STATUSES, INVOICEABLE_STATUSES, MANUAL_MOVEMENT_TYPES, OPEN_PURCHASE_STATUSES,
  PO_DECISION_FROM, PO_DECISION_RESULT, PURCHASE_DECISIONS, PURCHASE_STATUSES, RECEIVABLE_STATUSES, STOCK_MOVEMENT_TYPES,
  invoiceVariance, mayApprove, movementDelta, poTotal, receiptStatus, receivedValue, remainingToReceive, stockStatus, suggestedReorder,
  type PurchaseStatus,
} from '@pms/types';
import { describe, expect, it } from 'vitest';

describe('business constants match the database', () => {
  it('enums are identical to the Prisma enums', () => {
    expect([...INVENTORY_CATEGORIES].sort()).toEqual(Object.values(PrismaCategory).sort());
    expect([...STOCK_MOVEMENT_TYPES].sort()).toEqual(Object.values(PrismaMovementType).sort());
    expect([...PURCHASE_STATUSES].sort()).toEqual(Object.values(PrismaPurchaseStatus).sort());
    expect([...INVOICE_STATUSES].sort()).toEqual(Object.values(PrismaInvoiceStatus).sort());
    expect([...EXPENSE_CATEGORIES].sort()).toEqual(Object.values(PrismaExpenseCategory).sort());
  });

  it('people can only enter four kinds of movement by hand', () => {
    expect([...MANUAL_MOVEMENT_TYPES].sort()).toEqual(['ADJUSTMENT', 'OPENING', 'USAGE', 'WASTAGE']);
  });
});

describe('stock movements', () => {
  it('stock goes up for opening, receipts and incoming transfers, and down for usage, wastage and outgoing transfers', () => {
    for (const t of ['OPENING', 'PURCHASE_RECEIPT', 'TRANSFER_IN'] as const) expect(movementDelta(t, 5)).toBe(5);
    for (const t of ['USAGE', 'WASTAGE', 'TRANSFER_OUT'] as const) expect(movementDelta(t, 5)).toBe(-5);
  });

  it('typing a minus sign never reverses a movement (only an adjustment is signed)', () => {
    expect(movementDelta('WASTAGE', -5)).toBe(-5);
    expect(movementDelta('OPENING', -5)).toBe(5);
    expect(movementDelta('ADJUSTMENT', -5)).toBe(-5);
    expect(movementDelta('ADJUSTMENT', 7)).toBe(7);
  });
});

describe('stock status and reorder suggestion', () => {
  it('classifies stock', () => {
    expect(stockStatus(0, 10, 50)).toBe('OUT');
    expect(stockStatus(-3, 10, 50)).toBe('OUT');
    expect(stockStatus(9, 10, 50)).toBe('LOW');
    expect(stockStatus(10, 10, 50)).toBe('OK');
    expect(stockStatus(51, 10, 50)).toBe('OVER');
    expect(stockStatus(500, 10, 0)).toBe('OK');
  });

  it('suggests topping up to the maximum, or twice the minimum when there is no maximum', () => {
    expect(suggestedReorder(4, 10, 50)).toBe(46);
    expect(suggestedReorder(4, 10, 0)).toBe(16);
    expect(suggestedReorder(10, 10, 50)).toBe(0);
    expect(suggestedReorder(80, 10, 50)).toBe(0);
  });
});

describe('purchase order workflow', () => {
  it('only a requested order can be approved or rejected; only an order with nothing received can be cancelled', () => {
    expect([...PO_DECISION_FROM.approve]).toEqual(['REQUESTED']);
    expect([...PO_DECISION_FROM.reject]).toEqual(['REQUESTED']);
    expect(PO_DECISION_FROM.cancel).not.toContain('PARTIALLY_RECEIVED');
    expect(PO_DECISION_FROM.cancel).not.toContain('RECEIVED');
    for (const d of PURCHASE_DECISIONS) expect(PURCHASE_STATUSES).toContain(PO_DECISION_RESULT[d]);
  });

  it('goods can be received only after approval, and an invoice recorded only after something arrived', () => {
    expect([...RECEIVABLE_STATUSES]).toEqual(['APPROVED', 'PARTIALLY_RECEIVED']);
    expect([...INVOICEABLE_STATUSES]).toEqual(['PARTIALLY_RECEIVED', 'RECEIVED']);
    for (const s of ['REQUESTED', 'REJECTED', 'CANCELLED'] as PurchaseStatus[]) {
      expect(RECEIVABLE_STATUSES).not.toContain(s);
      expect(INVOICEABLE_STATUSES).not.toContain(s);
    }
    expect(OPEN_PURCHASE_STATUSES).not.toContain('RECEIVED');
  });

  it('nobody approves their own request, unless nobody else could (one-manager hotel)', () => {
    expect(mayApprove('alice', 'bob', 3)).toBe(true);
    expect(mayApprove('alice', 'alice', 1)).toBe(false);
    expect(mayApprove('alice', 'alice', 0)).toBe(true);
    expect(mayApprove(null, 'alice', 2)).toBe(true);
  });
});

describe('receiving and invoice matching (whole centavos)', () => {
  const lines = [
    { quantity: 10, unitCostMinor: 25000, receivedQuantity: 10 },
    { quantity: 4, unitCostMinor: 120050, receivedQuantity: 1 },
  ];

  it('totals the order and the value of what actually arrived', () => {
    expect(poTotal(lines)).toBe(10 * 25000 + 4 * 120050);
    expect(receivedValue(lines)).toBe(10 * 25000 + 1 * 120050);
    expect(Number.isInteger(poTotal(lines))).toBe(true);
  });

  it('is partially received until every line is complete', () => {
    expect(receiptStatus(lines)).toBe('PARTIALLY_RECEIVED');
    expect(receiptStatus([{ quantity: 4, receivedQuantity: 4 }, { quantity: 1, receivedQuantity: 1 }])).toBe('RECEIVED');
    expect(remainingToReceive({ quantity: 10, receivedQuantity: 3 })).toBe(7);
  });

  it('flags an invoice that charges more or less than the goods received', () => {
    expect(invoiceVariance(370050, 370050)).toBe(0);
    expect(invoiceVariance(400000, 370050)).toBe(29950);
    expect(invoiceVariance(300000, 370050)).toBe(-70050);
  });
});
