export declare const INVENTORY_CATEGORIES: readonly ["FOOD", "BEVERAGE", "HOUSEKEEPING_SUPPLIES", "TOILETRIES", "LINENS", "OFFICE_SUPPLIES", "MAINTENANCE_MATERIALS"];
export type InventoryCategory = (typeof INVENTORY_CATEGORIES)[number];
export declare const STOCK_MOVEMENT_TYPES: readonly ["OPENING", "PURCHASE_RECEIPT", "USAGE", "WASTAGE", "ADJUSTMENT", "TRANSFER_OUT", "TRANSFER_IN"];
export type StockMovementType = (typeof STOCK_MOVEMENT_TYPES)[number];
/** What a person may enter by hand. Receipts and transfers are created by their own workflows. */
export declare const MANUAL_MOVEMENT_TYPES: readonly ["OPENING", "USAGE", "WASTAGE", "ADJUSTMENT"];
export type ManualMovementType = (typeof MANUAL_MOVEMENT_TYPES)[number];
/**
 * The signed change to stock. People type a positive amount for everything except an adjustment, which is
 * already signed (+ found stock, - missing stock). Stock is whole units (pieces, grams, millilitres).
 */
export declare function movementDelta(type: StockMovementType, quantity: number): number;
export type StockStatus = 'OUT' | 'LOW' | 'OK' | 'OVER';
export declare function stockStatus(onHand: number, minStock: number, maxStock: number): StockStatus;
/** How much to order to get back up to the maximum (or twice the minimum when no maximum is set). */
export declare function suggestedReorder(onHand: number, minStock: number, maxStock: number): number;
export declare const PURCHASE_STATUSES: readonly ["REQUESTED", "APPROVED", "REJECTED", "PARTIALLY_RECEIVED", "RECEIVED", "CANCELLED"];
export type PurchaseStatus = (typeof PURCHASE_STATUSES)[number];
export declare const PURCHASE_DECISIONS: readonly ["approve", "reject", "cancel"];
export type PurchaseDecision = (typeof PURCHASE_DECISIONS)[number];
export declare const PO_DECISION_FROM: Record<PurchaseDecision, readonly PurchaseStatus[]>;
export declare const PO_DECISION_RESULT: Record<PurchaseDecision, PurchaseStatus>;
export declare const RECEIVABLE_STATUSES: readonly PurchaseStatus[];
/** An invoice can be recorded once some goods have arrived. */
export declare const INVOICEABLE_STATUSES: readonly PurchaseStatus[];
export declare const OPEN_PURCHASE_STATUSES: readonly PurchaseStatus[];
export declare const INVOICE_STATUSES: readonly ["UNPAID", "PAID"];
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];
/**
 * Separation of duties: you cannot approve your own request, unless nobody else is able to approve it at that
 * property (a one-manager hotel must still be able to buy supplies; that case is recorded in the audit log).
 */
export declare function mayApprove(requesterId: string | null, approverId: string, otherApproverCount: number): boolean;
export interface OrderLineAmounts {
    quantity: number;
    unitCostMinor: number;
    receivedQuantity?: number;
}
export declare const poTotal: (lines: ReadonlyArray<OrderLineAmounts>) => number;
export declare const remainingToReceive: (line: {
    quantity: number;
    receivedQuantity: number;
}) => number;
export declare const receivedValue: (lines: ReadonlyArray<OrderLineAmounts>) => number;
export declare function receiptStatus(lines: ReadonlyArray<{
    quantity: number;
    receivedQuantity: number;
}>): 'PARTIALLY_RECEIVED' | 'RECEIVED';
/** Three-way match: positive = the supplier is charging MORE than the goods we actually received. */
export declare const invoiceVariance: (invoiceMinor: number, receivedValueMinor: number) => number;
export declare const EXPENSE_CATEGORIES: readonly ["UTILITIES", "PAYROLL", "SUPPLIES", "MAINTENANCE", "MARKETING", "RENT", "INTERNET", "TRANSPORTATION", "INVENTORY", "OTHER"];
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];
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
    byCategory: Array<{
        category: ExpenseCategory;
        totalMinor: number;
    }>;
}
/** One page of expenses with the totals for the whole filter (not just this page). */
export interface ExpenseListView {
    items: ExpenseView[];
    totals: ExpenseTotals;
    meta: {
        page: number;
        pageSize: number;
        total: number;
    };
}
