import { z } from 'zod';
export declare const chargeSchema: z.ZodEffects<z.ZodObject<{
    description: z.ZodString;
    quantity: z.ZodNumber;
    unitAmountMinor: z.ZodNumber;
    taxable: z.ZodBoolean;
}, "strip", z.ZodTypeAny, {
    description: string;
    quantity: number;
    unitAmountMinor: number;
    taxable: boolean;
}, {
    description: string;
    quantity: number;
    unitAmountMinor: number;
    taxable: boolean;
}>, {
    description: string;
    quantity: number;
    unitAmountMinor: number;
    taxable: boolean;
}, {
    description: string;
    quantity: number;
    unitAmountMinor: number;
    taxable: boolean;
}>;
export declare const adjustmentSchema: z.ZodObject<{
    description: z.ZodString;
    /** Negative = discount/credit, positive = extra charge without tax. */
    amountMinor: z.ZodEffects<z.ZodNumber, number, number>;
    reason: z.ZodString;
}, "strip", z.ZodTypeAny, {
    description: string;
    amountMinor: number;
    reason: string;
}, {
    description: string;
    amountMinor: number;
    reason: string;
}>;
export declare const paymentSchema: z.ZodObject<{
    amountMinor: z.ZodNumber;
    method: z.ZodEnum<["CASH", "CARD", "BANK_TRANSFER", "E_WALLET", "OTHER"]>;
    reference: z.ZodString;
    note: z.ZodString;
}, "strip", z.ZodTypeAny, {
    amountMinor: number;
    method: "CASH" | "CARD" | "BANK_TRANSFER" | "E_WALLET" | "OTHER";
    reference: string;
    note: string;
}, {
    amountMinor: number;
    method: "CASH" | "CARD" | "BANK_TRANSFER" | "E_WALLET" | "OTHER";
    reference: string;
    note: string;
}>;
export declare const voidSchema: z.ZodObject<{
    reason: z.ZodString;
}, "strip", z.ZodTypeAny, {
    reason: string;
}, {
    reason: string;
}>;
export declare const refundSchema: z.ZodObject<{
    amountMinor: z.ZodNumber;
    reason: z.ZodString;
}, "strip", z.ZodTypeAny, {
    amountMinor: number;
    reason: string;
}, {
    amountMinor: number;
    reason: string;
}>;
export declare const taxSchema: z.ZodObject<{
    name: z.ZodString;
    /** 1200 = 12%. The screen converts from percent. */
    rateBps: z.ZodNumber;
    appliesToRoom: z.ZodBoolean;
    appliesToExtras: z.ZodBoolean;
    isActive: z.ZodBoolean;
}, "strip", z.ZodTypeAny, {
    name: string;
    rateBps: number;
    appliesToRoom: boolean;
    appliesToExtras: boolean;
    isActive: boolean;
}, {
    name: string;
    rateBps: number;
    appliesToRoom: boolean;
    appliesToExtras: boolean;
    isActive: boolean;
}>;
export declare const updateTaxSchema: z.ZodObject<{
    name: z.ZodOptional<z.ZodString>;
    rateBps: z.ZodOptional<z.ZodNumber>;
    appliesToRoom: z.ZodOptional<z.ZodBoolean>;
    appliesToExtras: z.ZodOptional<z.ZodBoolean>;
    isActive: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    name?: string | undefined;
    rateBps?: number | undefined;
    appliesToRoom?: boolean | undefined;
    appliesToExtras?: boolean | undefined;
    isActive?: boolean | undefined;
}, {
    name?: string | undefined;
    rateBps?: number | undefined;
    appliesToRoom?: boolean | undefined;
    appliesToExtras?: boolean | undefined;
    isActive?: boolean | undefined;
}>;
export type ChargeInput = z.infer<typeof chargeSchema>;
export type AdjustmentInput = z.infer<typeof adjustmentSchema>;
export type PaymentInput = z.infer<typeof paymentSchema>;
export type VoidInput = z.infer<typeof voidSchema>;
export type RefundInput = z.infer<typeof refundSchema>;
export type TaxInput = z.infer<typeof taxSchema>;
export type UpdateTaxInput = z.infer<typeof updateTaxSchema>;
