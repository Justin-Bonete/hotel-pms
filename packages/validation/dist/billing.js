"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateTaxSchema = exports.taxSchema = exports.refundSchema = exports.voidSchema = exports.paymentSchema = exports.adjustmentSchema = exports.chargeSchema = void 0;
const types_1 = require("@pms/types");
const zod_1 = require("zod");
const MAX_MINOR = 1_000_000_000;
const amount = zod_1.z.number().int('Whole number of centavos').min(1, 'Enter an amount above zero').max(MAX_MINOR);
const reason = zod_1.z.string().trim().min(3, 'Give a short reason').max(300);
exports.chargeSchema = zod_1.z
    .object({
    description: zod_1.z.string().trim().min(2, 'Describe the charge').max(120),
    quantity: zod_1.z.number().int('Whole number').min(1).max(1000),
    unitAmountMinor: amount,
    taxable: zod_1.z.boolean(),
})
    .refine((v) => v.quantity * v.unitAmountMinor <= MAX_MINOR, { path: ['unitAmountMinor'], message: 'That total is too large' });
exports.adjustmentSchema = zod_1.z.object({
    description: zod_1.z.string().trim().min(2, 'Describe the adjustment').max(120),
    /** Negative = discount/credit, positive = extra charge without tax. */
    amountMinor: zod_1.z.number().int().min(-MAX_MINOR).max(MAX_MINOR).refine((n) => n !== 0, 'Amount can not be zero'),
    reason,
});
exports.paymentSchema = zod_1.z.object({
    amountMinor: amount,
    method: zod_1.z.enum(types_1.PAYMENT_METHODS),
    reference: zod_1.z.string().trim().max(80),
    note: zod_1.z.string().trim().max(300),
});
exports.voidSchema = zod_1.z.object({ reason });
exports.refundSchema = zod_1.z.object({ amountMinor: amount, reason });
exports.taxSchema = zod_1.z.object({
    name: zod_1.z.string().trim().min(2, 'Enter a name').max(40),
    /** 1200 = 12%. The screen converts from percent. */
    rateBps: zod_1.z.number().int('Whole number').min(0).max(10000),
    appliesToRoom: zod_1.z.boolean(),
    appliesToExtras: zod_1.z.boolean(),
    isActive: zod_1.z.boolean(),
});
exports.updateTaxSchema = exports.taxSchema.partial();
//# sourceMappingURL=billing.js.map