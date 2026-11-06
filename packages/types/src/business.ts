// ================================================================== inventory
export const INVENTORY_CATEGORIES = ['FOOD', 'BEVERAGE', 'HOUSEKEEPING_SUPPLIES', 'TOILETRIES', 'LINENS', 'OFFICE_SUPPLIES', 'MAINTENANCE_MATERIALS'] as const;
export type InventoryCategory = (typeof INVENTORY_CATEGORIES)[number];

export const STOCK_MOVEMENT_TYPES = ['OPENING', 'PURCHASE_RECEIPT', 'USAGE', 'WASTAGE', 'ADJUSTMENT', 'TRANSFER_OUT', 'TRANSFER_IN'] as const;
export type StockMovementType = (typeof STOCK_MOVEMENT_TYPES)[number];

/** What a person may enter by hand. Receipts and transfers are created by their own workflows. */
export const MANUAL_MOVEMENT_TYPES = ['OPENING', 'USAGE', 'WASTAGE', 'ADJUSTMENT'] as const;
export type ManualMovementType = (typeof MANUAL_MOVEMENT_TYPES)[number];

/**
 * The signed change to stock. People type a positive amount for everything except an adjustment, which is
 * already signed (+ found stock, - missing stock). Stock is whole units (pieces, grams, millilitres).
 */
export function movementDelta(type: StockMovementType, quantity: number): number {
  const amount = Math.abs(quantity);
  switch (type) {
    case 'OPENING':
    case 'PURCHASE_RECEIPT':
    case 'TRANSFER_IN':
      return amount;
    case 'USAGE':
    case 'WASTAGE':
    case 'TRANSFER_OUT':
      return -amount;
    case 'ADJUSTMENT':
      return quantity;
  }
}

export type StockStatus = 'OUT' | 'LOW' | 'OK' | 'OVER';

export function stockStatus(onHand: number, minStock: number, maxStock: number): StockStatus {
  if (onHand <= 0) return 'OUT';
  if (onHand < minStock) return 'LOW';
  if (maxStock > 0 && onHand > maxStock) return 'OVER';
  return 'OK';
}

/** How much to order to get back up to the maximum (or twice the minimum when no maximum is set). */
export function suggestedReorder(onHand: number, minStock: number, maxStock: number): number {
  if (onHand >= minStock) return 0;
  const target = maxStock > 0 ? maxStock : minStock * 2;
  return Math.max(target - onHand, 0);
}

// ================================================================== purchasing
export const PURCHASE_STATUSES = ['REQUESTED', 'APPROVED', 'REJECTED', 'PARTIALLY_RECEIVED', 'RECEIVED', 'CANCELLED'] as const;
export type PurchaseStatus = (typeof PURCHASE_STATUSES)[number];

export const PURCHASE_DECISIONS = ['approve', 'reject', 'cancel'] as const;
export type PurchaseDecision = (typeof PURCHASE_DECISIONS)[number];

export const PO_DECISION_FROM: Record<PurchaseDecision, readonly PurchaseStatus[]> = {
  approve: ['REQUESTED'],
  reject: ['REQUESTED'],
  /** Once goods have arrived an order can no longer be cancelled. */
  cancel: ['REQUESTED', 'APPROVED'],
};
export const PO_DECISION_RESULT: Record<PurchaseDecision, PurchaseStatus> = { approve: 'APPROVED', reject: 'REJECTED', cancel: 'CANCELLED' };

export const RECEIVABLE_STATUSES: readonly PurchaseStatus[] = ['APPROVED', 'PARTIALLY_RECEIVED'];
/** An invoice can be recorded once some goods have arrived. */
export const INVOICEABLE_STATUSES: readonly PurchaseStatus[] = ['PARTIALLY_RECEIVED', 'RECEIVED'];
export const OPEN_PURCHASE_STATUSES: readonly PurchaseStatus[] = ['REQUESTED', 'APPROVED', 'PARTIALLY_RECEIVED'];

export const INVOICE_STATUSES = ['UNPAID', 'PAID'] as const;
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

/**
 * Separation of duties: you cannot approve your own request, unless nobody else is able to approve it at that
 * property (a one-manager hotel must still be able to buy supplies; that case is recorded in the audit log).
 */
export function mayApprove(requesterId: string | null, approverId: string, otherApproverCount: number): boolean {
  return requesterId !== approverId || otherApproverCount === 0;
}

export interface OrderLineAmounts {
  quantity: number;
  unitCostMinor: number;
  receivedQuantity?: number;
}

export const poTotal = (lines: ReadonlyArray<OrderLineAmounts>): number => lines.reduce((sum, l) => sum + l.quantity * l.unitCostMinor, 0);
export const remainingToReceive = (line: { quantity: number; receivedQuantity: number }): number => line.quantity - line.receivedQuantity;
export const receivedValue = (lines: ReadonlyArray<OrderLineAmounts>): number => lines.reduce((sum, l) => sum + (l.receivedQuantity ?? 0) * l.unitCostMinor, 0);

export function receiptStatus(lines: ReadonlyArray<{ quantity: number; receivedQuantity: number }>): 'PARTIALLY_RECEIVED' | 'RECEIVED' {
  return lines.every((l) => l.receivedQuantity >= l.quantity) ? 'RECEIVED' : 'PARTIALLY_RECEIVED';
}

/** Three-way match: positive = the supplier is charging MORE than the goods we actually received. */
export const invoiceVariance = (invoiceMinor: number, receivedValueMinor: number): number => invoiceMinor - receivedValueMinor;

// ================================================================== expenses
export const EXPENSE_CATEGORIES = ['UTILITIES', 'PAYROLL', 'SUPPLIES', 'MAINTENANCE', 'MARKETING', 'RENT', 'INTERNET', 'TRANSPORTATION', 'INVENTORY', 'OTHER'] as const;
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

// ================================================================== views
export interface SupplierView {
  id: string;
  name: string;
  contactName: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  notes: string | null;
}

export interface InventoryItemView {
  id: string;
  sku: string;
  name: string;
  category: InventoryCategory;
  unit: string;
  minStock: number;
  maxStock: number;
  unitCostMinor: number;
  /** At the property asked about. */
  onHand: number;
  status: StockStatus;
  suggestedReorder: number;
}

export interface StockMovementView {
  id: string;
  type: StockMovementType;
  quantity: number;
  unitCostMinor: number | null;
  note: string | null;
  createdByName: string | null;
  createdAt: string;
}

export interface PurchaseLineView {
  id: string;
  itemId: string;
  itemName: string;
  sku: string;
  unit: string;
  quantity: number;
  unitCostMinor: number;
  receivedQuantity: number;
}

export interface SupplierInvoiceView {
  id: string;
  purchaseOrderId: string;
  purchaseOrderCode: string;
  supplierName: string;
  number: string;
  amountMinor: number;
  receivedValueMinor: number;
  /** Invoice minus goods received. Not zero = needs a look before paying. */
  varianceMinor: number;
  issuedOn: string;
  dueOn: string;
  status: InvoiceStatus;
  overdue: boolean;
  paidAt: string | null;
  currency: string;
}

export interface PurchaseOrderView {
  id: string;
  code: string;
  propertyId: string;
  supplierId: string;
  supplierName: string;
  status: PurchaseStatus;
  notes: string | null;
  currency: string;
  totalMinor: number;
  receivedValueMinor: number;
  requestedById: string | null;
  requestedByName: string | null;
  requestedAt: string;
  approvedByName: string | null;
  decisionNote: string | null;
  lines: PurchaseLineView[];
  invoice: SupplierInvoiceView | null;
}

export interface ExpenseView {
  id: string;
  propertyId: string;
  category: ExpenseCategory;
  vendor: string | null;
  departmentName: string | null;
  incurredOn: string;
  amountMinor: number;
  currency: string;
  paymentMethod: string;
  reference: string | null;
  note: string | null;
  /** MANUAL, or PURCHASING when created automatically by paying a supplier invoice. */
  source: string;
  voided: boolean;
  voidReason: string | null;
}

export interface ExpenseTotals {
  totalMinor: number;
  byCategory: Array<{ category: ExpenseCategory; totalMinor: number }>;
}

/** One page of expenses with the totals for the whole filter (not just this page). */
export interface ExpenseListView {
  items: ExpenseView[];
  totals: ExpenseTotals;
  meta: { page: number; pageSize: number; total: number };
}
