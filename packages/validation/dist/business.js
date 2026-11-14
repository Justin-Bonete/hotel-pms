"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.expensesQuerySchema = exports.voidExpenseSchema = exports.expenseSchema = exports.invoicesQuerySchema = exports.ordersQuerySchema = exports.payInvoiceSchema = exports.invoiceSchema = exports.receiveSchema = exports.decisionSchema = exports.createOrderSchema = exports.transferSchema = exports.movementSchema = exports.updateInventoryItemSchema = exports.inventoryItemSchema = exports.updateSupplierSchema = exports.supplierSchema = void 0;
const types_1 = require("@pms/types");
const zod_1 = require("zod");
const reservations_1 = require("./reservations");
const MAX_MINOR = 1_000_000_000;
const MAX_ORDER_MINOR = 2_000_000_000; // stays inside a 32-bit integer column
const text = (max) => zod_1.z.string().trim().max(max);
const minor = zod_1.z.number().int('Whole number of centavos').min(0).max(MAX_MINOR);
// ---------------------------------------------------------------- suppliers
exports.supplierSchema = zod_1.z.object({
    name: zod_1.z.string().trim().min(2, 'Enter a name').max(120),
    contactName: text(80),
    email: zod_1.z.union([zod_1.z.literal(''), zod_1.z.string().trim().email('Enter a valid email').max(254)]),
    phone: text(40),
    address: text(200),
    notes: text(500),
});
exports.updateSupplierSchema = exports.supplierSchema.partial();
// ---------------------------------------------------------------- inventory
exports.inventoryItemSchema = zod_1.z
    .object({
    sku: zod_1.z.string().trim().min(1, 'Enter a code').max(40),
    name: zod_1.z.string().trim().min(2, 'Enter a name').max(120),
    category: zod_1.z.enum(types_1.INVENTORY_CATEGORIES),
    unit: zod_1.z.string().trim().min(1, 'Enter a unit, e.g. pcs, kg, L').max(20),
    minStock: zod_1.z.number().int('Whole number').min(0).max(10_000_000),
    maxStock: zod_1.z.number().int('Whole number').min(0).max(10_000_000),
    unitCostMinor: minor,
})
    .refine((v) => v.maxStock === 0 || v.maxStock >= v.minStock, { path: ['maxStock'], message: 'Maximum must be at least the minimum (or 0 for no maximum)' });
exports.updateInventoryItemSchema = zod_1.z
    .object({
    sku: zod_1.z.string().trim().min(1).max(40),
    name: zod_1.z.string().trim().min(2).max(120),
    category: zod_1.z.enum(types_1.INVENTORY_CATEGORIES),
    unit: zod_1.z.string().trim().min(1).max(20),
    minStock: zod_1.z.number().int().min(0).max(10_000_000),
    maxStock: zod_1.z.number().int().min(0).max(10_000_000),
    unitCostMinor: minor,
})
    .partial();
exports.movementSchema = zod_1.z
    .object({
    itemId: zod_1.z.string().uuid('Choose an item'),
    type: zod_1.z.enum(types_1.MANUAL_MOVEMENT_TYPES),
    /** Positive for opening/usage/wastage. An adjustment is signed (+ found, - missing). */
    quantity: zod_1.z.number().int('Whole number').min(-10_000_000).max(10_000_000),
    note: text(300),
})
    .superRefine((v, ctx) => {
    if (v.quantity === 0)
        ctx.addIssue({ code: zod_1.z.ZodIssueCode.custom, path: ['quantity'], message: 'Quantity can not be zero' });
    if (v.type !== 'ADJUSTMENT' && v.quantity < 0)
        ctx.addIssue({ code: zod_1.z.ZodIssueCode.custom, path: ['quantity'], message: 'Enter a positive quantity' });
    if (v.type === 'ADJUSTMENT' && v.note.length < 3)
        ctx.addIssue({ code: zod_1.z.ZodIssueCode.custom, path: ['note'], message: 'Say why the count changed' });
});
exports.transferSchema = zod_1.z
    .object({
    fromPropertyId: zod_1.z.string().uuid(),
    toPropertyId: zod_1.z.string().uuid('Choose where to send it'),
    itemId: zod_1.z.string().uuid('Choose an item'),
    quantity: zod_1.z.number().int('Whole number').min(1).max(10_000_000),
    note: text(300),
})
    .refine((v) => v.fromPropertyId !== v.toPropertyId, { path: ['toPropertyId'], message: 'Choose a different property' });
// ---------------------------------------------------------------- purchasing
exports.createOrderSchema = zod_1.z
    .object({
    supplierId: zod_1.z.string().uuid('Choose a supplier'),
    notes: text(500),
    lines: zod_1.z
        .array(zod_1.z.object({
        itemId: zod_1.z.string().uuid(),
        quantity: zod_1.z.number().int('Whole number').min(1).max(10_000_000),
        unitCostMinor: minor,
    }))
        .min(1, 'Add at least one item')
        .max(100),
})
    .refine((v) => new Set(v.lines.map((l) => l.itemId)).size === v.lines.length, { path: ['lines'], message: 'Each item can appear once' })
    .refine((v) => v.lines.every((l) => l.quantity * l.unitCostMinor <= MAX_MINOR), { path: ['lines'], message: 'A line total is too large' })
    .refine((v) => v.lines.reduce((s, l) => s + l.quantity * l.unitCostMinor, 0) <= MAX_ORDER_MINOR, { path: ['lines'], message: 'The order total is too large' });
exports.decisionSchema = zod_1.z
    .object({ action: zod_1.z.enum(types_1.PURCHASE_DECISIONS), note: text(300).optional() })
    .refine((v) => v.action !== 'reject' || (v.note ?? '').length >= 3, { path: ['note'], message: 'Say why it was rejected' });
exports.receiveSchema = zod_1.z.object({
    lines: zod_1.z.array(zod_1.z.object({ lineId: zod_1.z.string().uuid(), quantity: zod_1.z.number().int('Whole number').min(1).max(10_000_000) })).min(1, 'Enter a quantity for at least one line').max(100),
});
exports.invoiceSchema = zod_1.z
    .object({
    number: zod_1.z.string().trim().min(1, "Enter the supplier's invoice number").max(60),
    amountMinor: zod_1.z.number().int('Whole number of centavos').min(1).max(MAX_ORDER_MINOR),
    issuedOn: reservations_1.dateSchema,
    dueOn: reservations_1.dateSchema,
})
    .refine((v) => v.dueOn >= v.issuedOn, { path: ['dueOn'], message: 'Due date cannot be before the invoice date' });
exports.payInvoiceSchema = zod_1.z.object({ method: zod_1.z.enum(types_1.PAYMENT_METHODS), reference: text(80) });
exports.ordersQuerySchema = zod_1.z.object({
    status: zod_1.z.enum(['REQUESTED', 'APPROVED', 'REJECTED', 'PARTIALLY_RECEIVED', 'RECEIVED', 'CANCELLED']).optional(),
});
exports.invoicesQuerySchema = zod_1.z.object({ status: zod_1.z.enum(['UNPAID', 'PAID']).optional() });
// ---------------------------------------------------------------- expenses
exports.expenseSchema = zod_1.z.object({
    category: zod_1.z.enum(types_1.EXPENSE_CATEGORIES),
    vendor: text(120),
    departmentId: zod_1.z.string().uuid().optional(),
    incurredOn: reservations_1.dateSchema,
    amountMinor: zod_1.z.number().int('Whole number of centavos').min(1, 'Enter an amount above zero').max(MAX_MINOR),
    paymentMethod: zod_1.z.enum(types_1.PAYMENT_METHODS),
    reference: text(80),
    note: text(300),
});
exports.voidExpenseSchema = zod_1.z.object({ reason: zod_1.z.string().trim().min(3, 'Give a short reason').max(300) });
exports.expensesQuerySchema = zod_1.z.object({
    page: zod_1.z.coerce.number().int().min(1).default(1),
    pageSize: zod_1.z.coerce.number().int().min(1).max(100).default(25),
    category: zod_1.z.enum(types_1.EXPENSE_CATEGORIES).optional(),
    from: reservations_1.dateSchema.optional(),
    to: reservations_1.dateSchema.optional(),
});
//# sourceMappingURL=business.js.map