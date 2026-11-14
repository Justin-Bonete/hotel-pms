import { z } from 'zod';
export declare const supplierSchema: z.ZodObject<{
    name: z.ZodString;
    contactName: z.ZodString;
    email: z.ZodUnion<[z.ZodLiteral<"">, z.ZodString]>;
    phone: z.ZodString;
    address: z.ZodString;
    notes: z.ZodString;
}, "strip", z.ZodTypeAny, {
    email: string;
    phone: string;
    notes: string;
    name: string;
    contactName: string;
    address: string;
}, {
    email: string;
    phone: string;
    notes: string;
    name: string;
    contactName: string;
    address: string;
}>;
export declare const updateSupplierSchema: z.ZodObject<{
    name: z.ZodOptional<z.ZodString>;
    contactName: z.ZodOptional<z.ZodString>;
    email: z.ZodOptional<z.ZodUnion<[z.ZodLiteral<"">, z.ZodString]>>;
    phone: z.ZodOptional<z.ZodString>;
    address: z.ZodOptional<z.ZodString>;
    notes: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    email?: string | undefined;
    phone?: string | undefined;
    notes?: string | undefined;
    name?: string | undefined;
    contactName?: string | undefined;
    address?: string | undefined;
}, {
    email?: string | undefined;
    phone?: string | undefined;
    notes?: string | undefined;
    name?: string | undefined;
    contactName?: string | undefined;
    address?: string | undefined;
}>;
export declare const inventoryItemSchema: z.ZodEffects<z.ZodObject<{
    sku: z.ZodString;
    name: z.ZodString;
    category: z.ZodEnum<["FOOD", "BEVERAGE", "HOUSEKEEPING_SUPPLIES", "TOILETRIES", "LINENS", "OFFICE_SUPPLIES", "MAINTENANCE_MATERIALS"]>;
    unit: z.ZodString;
    minStock: z.ZodNumber;
    maxStock: z.ZodNumber;
    unitCostMinor: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    name: string;
    sku: string;
    category: "FOOD" | "BEVERAGE" | "HOUSEKEEPING_SUPPLIES" | "TOILETRIES" | "LINENS" | "OFFICE_SUPPLIES" | "MAINTENANCE_MATERIALS";
    unit: string;
    minStock: number;
    maxStock: number;
    unitCostMinor: number;
}, {
    name: string;
    sku: string;
    category: "FOOD" | "BEVERAGE" | "HOUSEKEEPING_SUPPLIES" | "TOILETRIES" | "LINENS" | "OFFICE_SUPPLIES" | "MAINTENANCE_MATERIALS";
    unit: string;
    minStock: number;
    maxStock: number;
    unitCostMinor: number;
}>, {
    name: string;
    sku: string;
    category: "FOOD" | "BEVERAGE" | "HOUSEKEEPING_SUPPLIES" | "TOILETRIES" | "LINENS" | "OFFICE_SUPPLIES" | "MAINTENANCE_MATERIALS";
    unit: string;
    minStock: number;
    maxStock: number;
    unitCostMinor: number;
}, {
    name: string;
    sku: string;
    category: "FOOD" | "BEVERAGE" | "HOUSEKEEPING_SUPPLIES" | "TOILETRIES" | "LINENS" | "OFFICE_SUPPLIES" | "MAINTENANCE_MATERIALS";
    unit: string;
    minStock: number;
    maxStock: number;
    unitCostMinor: number;
}>;
export declare const updateInventoryItemSchema: z.ZodObject<{
    sku: z.ZodOptional<z.ZodString>;
    name: z.ZodOptional<z.ZodString>;
    category: z.ZodOptional<z.ZodEnum<["FOOD", "BEVERAGE", "HOUSEKEEPING_SUPPLIES", "TOILETRIES", "LINENS", "OFFICE_SUPPLIES", "MAINTENANCE_MATERIALS"]>>;
    unit: z.ZodOptional<z.ZodString>;
    minStock: z.ZodOptional<z.ZodNumber>;
    maxStock: z.ZodOptional<z.ZodNumber>;
    unitCostMinor: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    name?: string | undefined;
    sku?: string | undefined;
    category?: "FOOD" | "BEVERAGE" | "HOUSEKEEPING_SUPPLIES" | "TOILETRIES" | "LINENS" | "OFFICE_SUPPLIES" | "MAINTENANCE_MATERIALS" | undefined;
    unit?: string | undefined;
    minStock?: number | undefined;
    maxStock?: number | undefined;
    unitCostMinor?: number | undefined;
}, {
    name?: string | undefined;
    sku?: string | undefined;
    category?: "FOOD" | "BEVERAGE" | "HOUSEKEEPING_SUPPLIES" | "TOILETRIES" | "LINENS" | "OFFICE_SUPPLIES" | "MAINTENANCE_MATERIALS" | undefined;
    unit?: string | undefined;
    minStock?: number | undefined;
    maxStock?: number | undefined;
    unitCostMinor?: number | undefined;
}>;
export declare const movementSchema: z.ZodEffects<z.ZodObject<{
    itemId: z.ZodString;
    type: z.ZodEnum<["OPENING", "USAGE", "WASTAGE", "ADJUSTMENT"]>;
    /** Positive for opening/usage/wastage. An adjustment is signed (+ found, - missing). */
    quantity: z.ZodNumber;
    note: z.ZodString;
}, "strip", z.ZodTypeAny, {
    type: "OPENING" | "USAGE" | "WASTAGE" | "ADJUSTMENT";
    quantity: number;
    note: string;
    itemId: string;
}, {
    type: "OPENING" | "USAGE" | "WASTAGE" | "ADJUSTMENT";
    quantity: number;
    note: string;
    itemId: string;
}>, {
    type: "OPENING" | "USAGE" | "WASTAGE" | "ADJUSTMENT";
    quantity: number;
    note: string;
    itemId: string;
}, {
    type: "OPENING" | "USAGE" | "WASTAGE" | "ADJUSTMENT";
    quantity: number;
    note: string;
    itemId: string;
}>;
export declare const transferSchema: z.ZodEffects<z.ZodObject<{
    fromPropertyId: z.ZodString;
    toPropertyId: z.ZodString;
    itemId: z.ZodString;
    quantity: z.ZodNumber;
    note: z.ZodString;
}, "strip", z.ZodTypeAny, {
    quantity: number;
    note: string;
    itemId: string;
    fromPropertyId: string;
    toPropertyId: string;
}, {
    quantity: number;
    note: string;
    itemId: string;
    fromPropertyId: string;
    toPropertyId: string;
}>, {
    quantity: number;
    note: string;
    itemId: string;
    fromPropertyId: string;
    toPropertyId: string;
}, {
    quantity: number;
    note: string;
    itemId: string;
    fromPropertyId: string;
    toPropertyId: string;
}>;
export declare const createOrderSchema: z.ZodEffects<z.ZodEffects<z.ZodEffects<z.ZodObject<{
    supplierId: z.ZodString;
    notes: z.ZodString;
    lines: z.ZodArray<z.ZodObject<{
        itemId: z.ZodString;
        quantity: z.ZodNumber;
        unitCostMinor: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        quantity: number;
        unitCostMinor: number;
        itemId: string;
    }, {
        quantity: number;
        unitCostMinor: number;
        itemId: string;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    notes: string;
    supplierId: string;
    lines: {
        quantity: number;
        unitCostMinor: number;
        itemId: string;
    }[];
}, {
    notes: string;
    supplierId: string;
    lines: {
        quantity: number;
        unitCostMinor: number;
        itemId: string;
    }[];
}>, {
    notes: string;
    supplierId: string;
    lines: {
        quantity: number;
        unitCostMinor: number;
        itemId: string;
    }[];
}, {
    notes: string;
    supplierId: string;
    lines: {
        quantity: number;
        unitCostMinor: number;
        itemId: string;
    }[];
}>, {
    notes: string;
    supplierId: string;
    lines: {
        quantity: number;
        unitCostMinor: number;
        itemId: string;
    }[];
}, {
    notes: string;
    supplierId: string;
    lines: {
        quantity: number;
        unitCostMinor: number;
        itemId: string;
    }[];
}>, {
    notes: string;
    supplierId: string;
    lines: {
        quantity: number;
        unitCostMinor: number;
        itemId: string;
    }[];
}, {
    notes: string;
    supplierId: string;
    lines: {
        quantity: number;
        unitCostMinor: number;
        itemId: string;
    }[];
}>;
export declare const decisionSchema: z.ZodEffects<z.ZodObject<{
    action: z.ZodEnum<["approve", "reject", "cancel"]>;
    note: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    action: "cancel" | "approve" | "reject";
    note?: string | undefined;
}, {
    action: "cancel" | "approve" | "reject";
    note?: string | undefined;
}>, {
    action: "cancel" | "approve" | "reject";
    note?: string | undefined;
}, {
    action: "cancel" | "approve" | "reject";
    note?: string | undefined;
}>;
export declare const receiveSchema: z.ZodObject<{
    lines: z.ZodArray<z.ZodObject<{
        lineId: z.ZodString;
        quantity: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        quantity: number;
        lineId: string;
    }, {
        quantity: number;
        lineId: string;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    lines: {
        quantity: number;
        lineId: string;
    }[];
}, {
    lines: {
        quantity: number;
        lineId: string;
    }[];
}>;
export declare const invoiceSchema: z.ZodEffects<z.ZodObject<{
    number: z.ZodString;
    amountMinor: z.ZodNumber;
    issuedOn: z.ZodEffects<z.ZodString, string, string>;
    dueOn: z.ZodEffects<z.ZodString, string, string>;
}, "strip", z.ZodTypeAny, {
    number: string;
    amountMinor: number;
    issuedOn: string;
    dueOn: string;
}, {
    number: string;
    amountMinor: number;
    issuedOn: string;
    dueOn: string;
}>, {
    number: string;
    amountMinor: number;
    issuedOn: string;
    dueOn: string;
}, {
    number: string;
    amountMinor: number;
    issuedOn: string;
    dueOn: string;
}>;
export declare const payInvoiceSchema: z.ZodObject<{
    method: z.ZodEnum<["CASH", "CARD", "BANK_TRANSFER", "E_WALLET", "OTHER"]>;
    reference: z.ZodString;
}, "strip", z.ZodTypeAny, {
    method: "OTHER" | "CASH" | "CARD" | "BANK_TRANSFER" | "E_WALLET";
    reference: string;
}, {
    method: "OTHER" | "CASH" | "CARD" | "BANK_TRANSFER" | "E_WALLET";
    reference: string;
}>;
export declare const ordersQuerySchema: z.ZodObject<{
    status: z.ZodOptional<z.ZodEnum<["REQUESTED", "APPROVED", "REJECTED", "PARTIALLY_RECEIVED", "RECEIVED", "CANCELLED"]>>;
}, "strip", z.ZodTypeAny, {
    status?: "CANCELLED" | "REQUESTED" | "APPROVED" | "REJECTED" | "PARTIALLY_RECEIVED" | "RECEIVED" | undefined;
}, {
    status?: "CANCELLED" | "REQUESTED" | "APPROVED" | "REJECTED" | "PARTIALLY_RECEIVED" | "RECEIVED" | undefined;
}>;
export declare const invoicesQuerySchema: z.ZodObject<{
    status: z.ZodOptional<z.ZodEnum<["UNPAID", "PAID"]>>;
}, "strip", z.ZodTypeAny, {
    status?: "UNPAID" | "PAID" | undefined;
}, {
    status?: "UNPAID" | "PAID" | undefined;
}>;
export declare const expenseSchema: z.ZodObject<{
    category: z.ZodEnum<["UTILITIES", "PAYROLL", "SUPPLIES", "MAINTENANCE", "MARKETING", "RENT", "INTERNET", "TRANSPORTATION", "INVENTORY", "OTHER"]>;
    vendor: z.ZodString;
    departmentId: z.ZodOptional<z.ZodString>;
    incurredOn: z.ZodEffects<z.ZodString, string, string>;
    amountMinor: z.ZodNumber;
    paymentMethod: z.ZodEnum<["CASH", "CARD", "BANK_TRANSFER", "E_WALLET", "OTHER"]>;
    reference: z.ZodString;
    note: z.ZodString;
}, "strip", z.ZodTypeAny, {
    amountMinor: number;
    reference: string;
    note: string;
    category: "OTHER" | "UTILITIES" | "PAYROLL" | "SUPPLIES" | "MAINTENANCE" | "MARKETING" | "RENT" | "INTERNET" | "TRANSPORTATION" | "INVENTORY";
    vendor: string;
    incurredOn: string;
    paymentMethod: "OTHER" | "CASH" | "CARD" | "BANK_TRANSFER" | "E_WALLET";
    departmentId?: string | undefined;
}, {
    amountMinor: number;
    reference: string;
    note: string;
    category: "OTHER" | "UTILITIES" | "PAYROLL" | "SUPPLIES" | "MAINTENANCE" | "MARKETING" | "RENT" | "INTERNET" | "TRANSPORTATION" | "INVENTORY";
    vendor: string;
    incurredOn: string;
    paymentMethod: "OTHER" | "CASH" | "CARD" | "BANK_TRANSFER" | "E_WALLET";
    departmentId?: string | undefined;
}>;
export declare const voidExpenseSchema: z.ZodObject<{
    reason: z.ZodString;
}, "strip", z.ZodTypeAny, {
    reason: string;
}, {
    reason: string;
}>;
export declare const expensesQuerySchema: z.ZodObject<{
    page: z.ZodDefault<z.ZodNumber>;
    pageSize: z.ZodDefault<z.ZodNumber>;
    category: z.ZodOptional<z.ZodEnum<["UTILITIES", "PAYROLL", "SUPPLIES", "MAINTENANCE", "MARKETING", "RENT", "INTERNET", "TRANSPORTATION", "INVENTORY", "OTHER"]>>;
    from: z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>;
    to: z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>;
}, "strip", z.ZodTypeAny, {
    page: number;
    pageSize: number;
    from?: string | undefined;
    to?: string | undefined;
    category?: "OTHER" | "UTILITIES" | "PAYROLL" | "SUPPLIES" | "MAINTENANCE" | "MARKETING" | "RENT" | "INTERNET" | "TRANSPORTATION" | "INVENTORY" | undefined;
}, {
    page?: number | undefined;
    pageSize?: number | undefined;
    from?: string | undefined;
    to?: string | undefined;
    category?: "OTHER" | "UTILITIES" | "PAYROLL" | "SUPPLIES" | "MAINTENANCE" | "MARKETING" | "RENT" | "INTERNET" | "TRANSPORTATION" | "INVENTORY" | undefined;
}>;
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
