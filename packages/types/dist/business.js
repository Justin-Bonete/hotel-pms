"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EXPENSE_CATEGORIES = exports.invoiceVariance = exports.receivedValue = exports.remainingToReceive = exports.poTotal = exports.INVOICE_STATUSES = exports.OPEN_PURCHASE_STATUSES = exports.INVOICEABLE_STATUSES = exports.RECEIVABLE_STATUSES = exports.PO_DECISION_RESULT = exports.PO_DECISION_FROM = exports.PURCHASE_DECISIONS = exports.PURCHASE_STATUSES = exports.MANUAL_MOVEMENT_TYPES = exports.STOCK_MOVEMENT_TYPES = exports.INVENTORY_CATEGORIES = void 0;
exports.movementDelta = movementDelta;
exports.stockStatus = stockStatus;
exports.suggestedReorder = suggestedReorder;
exports.mayApprove = mayApprove;
exports.receiptStatus = receiptStatus;
// ================================================================== inventory
exports.INVENTORY_CATEGORIES = ['FOOD', 'BEVERAGE', 'HOUSEKEEPING_SUPPLIES', 'TOILETRIES', 'LINENS', 'OFFICE_SUPPLIES', 'MAINTENANCE_MATERIALS'];
exports.STOCK_MOVEMENT_TYPES = ['OPENING', 'PURCHASE_RECEIPT', 'USAGE', 'WASTAGE', 'ADJUSTMENT', 'TRANSFER_OUT', 'TRANSFER_IN'];
/** What a person may enter by hand. Receipts and transfers are created by their own workflows. */
exports.MANUAL_MOVEMENT_TYPES = ['OPENING', 'USAGE', 'WASTAGE', 'ADJUSTMENT'];
/**
 * The signed change to stock. People type a positive amount for everything except an adjustment, which is
 * already signed (+ found stock, - missing stock). Stock is whole units (pieces, grams, millilitres).
 */
function movementDelta(type, quantity) {
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
function stockStatus(onHand, minStock, maxStock) {
    if (onHand <= 0)
        return 'OUT';
    if (onHand < minStock)
        return 'LOW';
    if (maxStock > 0 && onHand > maxStock)
        return 'OVER';
    return 'OK';
}
/** How much to order to get back up to the maximum (or twice the minimum when no maximum is set). */
function suggestedReorder(onHand, minStock, maxStock) {
    if (onHand >= minStock)
        return 0;
    const target = maxStock > 0 ? maxStock : minStock * 2;
    return Math.max(target - onHand, 0);
}
// ================================================================== purchasing
exports.PURCHASE_STATUSES = ['REQUESTED', 'APPROVED', 'REJECTED', 'PARTIALLY_RECEIVED', 'RECEIVED', 'CANCELLED'];
exports.PURCHASE_DECISIONS = ['approve', 'reject', 'cancel'];
exports.PO_DECISION_FROM = {
    approve: ['REQUESTED'],
    reject: ['REQUESTED'],
    /** Once goods have arrived an order can no longer be cancelled. */
    cancel: ['REQUESTED', 'APPROVED'],
};
exports.PO_DECISION_RESULT = { approve: 'APPROVED', reject: 'REJECTED', cancel: 'CANCELLED' };
exports.RECEIVABLE_STATUSES = ['APPROVED', 'PARTIALLY_RECEIVED'];
/** An invoice can be recorded once some goods have arrived. */
exports.INVOICEABLE_STATUSES = ['PARTIALLY_RECEIVED', 'RECEIVED'];
exports.OPEN_PURCHASE_STATUSES = ['REQUESTED', 'APPROVED', 'PARTIALLY_RECEIVED'];
exports.INVOICE_STATUSES = ['UNPAID', 'PAID'];
/**
 * Separation of duties: you cannot approve your own request, unless nobody else is able to approve it at that
 * property (a one-manager hotel must still be able to buy supplies; that case is recorded in the audit log).
 */
function mayApprove(requesterId, approverId, otherApproverCount) {
    return requesterId !== approverId || otherApproverCount === 0;
}
const poTotal = (lines) => lines.reduce((sum, l) => sum + l.quantity * l.unitCostMinor, 0);
exports.poTotal = poTotal;
const remainingToReceive = (line) => line.quantity - line.receivedQuantity;
exports.remainingToReceive = remainingToReceive;
const receivedValue = (lines) => lines.reduce((sum, l) => sum + (l.receivedQuantity ?? 0) * l.unitCostMinor, 0);
exports.receivedValue = receivedValue;
function receiptStatus(lines) {
    return lines.every((l) => l.receivedQuantity >= l.quantity) ? 'RECEIVED' : 'PARTIALLY_RECEIVED';
}
/** Three-way match: positive = the supplier is charging MORE than the goods we actually received. */
const invoiceVariance = (invoiceMinor, receivedValueMinor) => invoiceMinor - receivedValueMinor;
exports.invoiceVariance = invoiceVariance;
// ================================================================== expenses
exports.EXPENSE_CATEGORIES = ['UTILITIES', 'PAYROLL', 'SUPPLIES', 'MAINTENANCE', 'MARKETING', 'RENT', 'INTERNET', 'TRANSPORTATION', 'INVENTORY', 'OTHER'];
//# sourceMappingURL=business.js.map