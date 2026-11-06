import {
  EXPENSE_CATEGORIES, INVENTORY_CATEGORIES, MANUAL_MOVEMENT_TYPES, PAYMENT_METHODS, PURCHASE_DECISIONS,
} from '@pms/types';
import { z } from 'zod';
import { dateSchema } from './reservations';

const MAX_MINOR = 1_000_000_000;
const MAX_ORDER_MINOR = 2_000_000_000; // stays inside a 32-bit integer column
const text = (max: number) => z.string().trim().max(max);
const minor = z.number().int('Whole number of centavos').min(0).max(MAX_MINOR);

// ---------------------------------------------------------------- suppliers
export const supplierSchema = z.object({
  name: z.string().trim().min(2, 'Enter a name').max(120),
  contactName: text(80),
  email: z.union([z.literal(''), z.string().trim().email('Enter a valid email').max(254)]),
  phone: text(40),
  address: text(200),
  notes: text(500),
});
export const updateSupplierSchema = supplierSchema.partial();

// ---------------------------------------------------------------- inventory
export const inventoryItemSchema = z
  .object({
    sku: z.string().trim().min(1, 'Enter a code').max(40),
    name: z.string().trim().min(2, 'Enter a name').max(120),
    category: z.enum(INVENTORY_CATEGORIES),
    unit: z.string().trim().min(1, 'Enter a unit, e.g. pcs, kg, L').max(20),
    minStock: z.number().int('Whole number').min(0).max(10_000_000),
    maxStock: z.number().int('Whole number').min(0).max(10_000_000),
    unitCostMinor: minor,
  })
  .refine((v) => v.maxStock === 0 || v.maxStock >= v.minStock, { path: ['maxStock'], message: 'Maximum must be at least the minimum (or 0 for no maximum)' });
export const updateInventoryItemSchema = z
  .object({
    sku: z.string().trim().min(1).max(40),
    name: z.string().trim().min(2).max(120),
    category: z.enum(INVENTORY_CATEGORIES),
    unit: z.string().trim().min(1).max(20),
    minStock: z.number().int().min(0).max(10_000_000),
    maxStock: z.number().int().min(0).max(10_000_000),
    unitCostMinor: minor,
  })
  .partial();

export const movementSchema = z
  .object({
    itemId: z.string().uuid('Choose an item'),
    type: z.enum(MANUAL_MOVEMENT_TYPES),
    /** Positive for opening/usage/wastage. An adjustment is signed (+ found, - missing). */
    quantity: z.number().int('Whole number').min(-10_000_000).max(10_000_000),
    note: text(300),
  })
  .superRefine((v, ctx) => {
    if (v.quantity === 0) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['quantity'], message: 'Quantity can not be zero' });
    if (v.type !== 'ADJUSTMENT' && v.quantity < 0) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['quantity'], message: 'Enter a positive quantity' });
    if (v.type === 'ADJUSTMENT' && v.note.length < 3) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['note'], message: 'Say why the count changed' });
  });

export const transferSchema = z
  .object({
    fromPropertyId: z.string().uuid(),
    toPropertyId: z.string().uuid('Choose where to send it'),
    itemId: z.string().uuid('Choose an item'),
    quantity: z.number().int('Whole number').min(1).max(10_000_000),
    note: text(300),
  })
  .refine((v) => v.fromPropertyId !== v.toPropertyId, { path: ['toPropertyId'], message: 'Choose a different property' });

// ---------------------------------------------------------------- purchasing
export const createOrderSchema = z
  .object({
    supplierId: z.string().uuid('Choose a supplier'),
    notes: text(500),
    lines: z
      .array(
        z.object({
          itemId: z.string().uuid(),
          quantity: z.number().int('Whole number').min(1).max(10_000_000),
          unitCostMinor: minor,
        }),
      )
      .min(1, 'Add at least one item')
      .max(100),
  })
  .refine((v) => new Set(v.lines.map((l) => l.itemId)).size === v.lines.length, { path: ['lines'], message: 'Each item can appear once' })
  .refine((v) => v.lines.every((l) => l.quantity * l.unitCostMinor <= MAX_MINOR), { path: ['lines'], message: 'A line total is too large' })
  .refine((v) => v.lines.reduce((s, l) => s + l.quantity * l.unitCostMinor, 0) <= MAX_ORDER_MINOR, { path: ['lines'], message: 'The order total is too large' });

export const decisionSchema = z
  .object({ action: z.enum(PURCHASE_DECISIONS), note: text(300).optional() })
  .refine((v) => v.action !== 'reject' || (v.note ?? '').length >= 3, { path: ['note'], message: 'Say why it was rejected' });

export const receiveSchema = z.object({
  lines: z.array(z.object({ lineId: z.string().uuid(), quantity: z.number().int('Whole number').min(1).max(10_000_000) })).min(1, 'Enter a quantity for at least one line').max(100),
});

export const invoiceSchema = z
  .object({
    number: z.string().trim().min(1, "Enter the supplier's invoice number").max(60),
    amountMinor: z.number().int('Whole number of centavos').min(1).max(MAX_ORDER_MINOR),
    issuedOn: dateSchema,
    dueOn: dateSchema,
  })
  .refine((v) => v.dueOn >= v.issuedOn, { path: ['dueOn'], message: 'Due date cannot be before the invoice date' });

export const payInvoiceSchema = z.object({ method: z.enum(PAYMENT_METHODS), reference: text(80) });

export const ordersQuerySchema = z.object({
  status: z.enum(['REQUESTED', 'APPROVED', 'REJECTED', 'PARTIALLY_RECEIVED', 'RECEIVED', 'CANCELLED']).optional(),
});
export const invoicesQuerySchema = z.object({ status: z.enum(['UNPAID', 'PAID']).optional() });

// ---------------------------------------------------------------- expenses
export const expenseSchema = z.object({
  category: z.enum(EXPENSE_CATEGORIES),
  vendor: text(120),
  departmentId: z.string().uuid().optional(),
  incurredOn: dateSchema,
  amountMinor: z.number().int('Whole number of centavos').min(1, 'Enter an amount above zero').max(MAX_MINOR),
  paymentMethod: z.enum(PAYMENT_METHODS),
  reference: text(80),
  note: text(300),
});
export const voidExpenseSchema = z.object({ reason: z.string().trim().min(3, 'Give a short reason').max(300) });
export const expensesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
  category: z.enum(EXPENSE_CATEGORIES).optional(),
  from: dateSchema.optional(),
  to: dateSchema.optional(),
});

export type SupplierInput = z.infer<typeof supplierSchema>;
export type UpdateSupplierInput = z.infer<typeof updateSupplierSchema>;
export type InventoryItemInput = z.infer<typeof inventoryItemSchema>;
export type UpdateInventoryItemInput = z.infer<typeof updateInventoryItemSchema>;
export type MovementInput = z.infer<typeof movementSchema>;
export type TransferInput = z.infer<typeof transferSchema>;
export type CreateOrderInput = z.infer<typeof createOrderSchema>;
export type DecisionInput = z.infer<typeof decisionSchema>;
export type ReceiveInput = z.infer<typeof receiveSchema>;
export type InvoiceInput = z.infer<typeof invoiceSchema>;
export type PayInvoiceInput = z.infer<typeof payInvoiceSchema>;
export type OrdersQuery = z.infer<typeof ordersQuerySchema>;
export type InvoicesQuery = z.infer<typeof invoicesQuerySchema>;
export type ExpenseInput = z.infer<typeof expenseSchema>;
export type VoidExpenseInput = z.infer<typeof voidExpenseSchema>;
export type ExpensesQuery = z.infer<typeof expensesQuerySchema>;
