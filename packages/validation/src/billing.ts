import { PAYMENT_METHODS } from '@pms/types';
import { z } from 'zod';

const MAX_MINOR = 1_000_000_000;
const amount = z.number().int('Whole number of centavos').min(1, 'Enter an amount above zero').max(MAX_MINOR);
const reason = z.string().trim().min(3, 'Give a short reason').max(300);

export const chargeSchema = z
  .object({
    description: z.string().trim().min(2, 'Describe the charge').max(120),
    quantity: z.number().int('Whole number').min(1).max(1000),
    unitAmountMinor: amount,
    taxable: z.boolean(),
  })
  .refine((v) => v.quantity * v.unitAmountMinor <= MAX_MINOR, { path: ['unitAmountMinor'], message: 'That total is too large' });

export const adjustmentSchema = z.object({
  description: z.string().trim().min(2, 'Describe the adjustment').max(120),
  /** Negative = discount/credit, positive = extra charge without tax. */
  amountMinor: z.number().int().min(-MAX_MINOR).max(MAX_MINOR).refine((n) => n !== 0, 'Amount can not be zero'),
  reason,
});

export const paymentSchema = z.object({
  amountMinor: amount,
  method: z.enum(PAYMENT_METHODS),
  reference: z.string().trim().max(80),
  note: z.string().trim().max(300),
});

export const voidSchema = z.object({ reason });
export const refundSchema = z.object({ amountMinor: amount, reason });

export const taxSchema = z.object({
  name: z.string().trim().min(2, 'Enter a name').max(40),
  /** 1200 = 12%. The screen converts from percent. */
  rateBps: z.number().int('Whole number').min(0).max(10000),
  appliesToRoom: z.boolean(),
  appliesToExtras: z.boolean(),
  isActive: z.boolean(),
});
export const updateTaxSchema = taxSchema.partial();

export type ChargeInput = z.infer<typeof chargeSchema>;
export type AdjustmentInput = z.infer<typeof adjustmentSchema>;
export type PaymentInput = z.infer<typeof paymentSchema>;
export type VoidInput = z.infer<typeof voidSchema>;
export type RefundInput = z.infer<typeof refundSchema>;
export type TaxInput = z.infer<typeof taxSchema>;
export type UpdateTaxInput = z.infer<typeof updateTaxSchema>;
