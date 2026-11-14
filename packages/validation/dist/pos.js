"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.posOrdersQuerySchema = exports.voidPosOrderSchema = exports.createPosOrderSchema = exports.updatePosItemSchema = exports.posItemSchema = exports.updateOutletSchema = exports.outletSchema = void 0;
const types_1 = require("@pms/types");
const zod_1 = require("zod");
const reservations_1 = require("./reservations");
const text = (max) => zod_1.z.string().trim().max(max);
exports.outletSchema = zod_1.z.object({
    name: zod_1.z.string().trim().min(2, 'Enter a name').max(80),
    type: zod_1.z.enum(types_1.OUTLET_TYPES),
});
exports.updateOutletSchema = exports.outletSchema.partial();
exports.posItemSchema = zod_1.z.object({
    outletId: zod_1.z.string().uuid('Choose an outlet'),
    name: zod_1.z.string().trim().min(2, 'Enter a name').max(120),
    category: text(60),
    priceMinor: zod_1.z.number().int('Whole number of centavos').min(0).max(100_000_000),
    taxable: zod_1.z.boolean(),
    /** Selling it uses up this stock item. */
    inventoryItemId: zod_1.z.string().uuid().optional(),
    inventoryQuantity: zod_1.z.number().int('Whole number').min(1).max(100_000),
});
exports.updatePosItemSchema = zod_1.z
    .object({
    name: zod_1.z.string().trim().min(2).max(120),
    category: text(60),
    priceMinor: zod_1.z.number().int().min(0).max(100_000_000),
    taxable: zod_1.z.boolean(),
    inventoryItemId: zod_1.z.string().uuid().nullable(),
    inventoryQuantity: zod_1.z.number().int().min(1).max(100_000),
})
    .partial();
const settlementSchema = zod_1.z.discriminatedUnion('type', [
    zod_1.z.object({ type: zod_1.z.literal('PAY_NOW'), method: zod_1.z.enum(types_1.PAYMENT_METHODS) }),
    zod_1.z.object({ type: zod_1.z.literal('ROOM_CHARGE'), reservationId: zod_1.z.string().uuid('Choose the guest') }),
]);
/** Prices are NOT sent by the client: the server uses the menu price at the moment of sale. */
exports.createPosOrderSchema = zod_1.z
    .object({
    outletId: zod_1.z.string().uuid('Choose an outlet'),
    lines: zod_1.z.array(zod_1.z.object({ itemId: zod_1.z.string().uuid(), quantity: zod_1.z.number().int('Whole number').min(1).max(1000) })).min(1, 'Add at least one item').max(100),
    settlement: settlementSchema,
    tableLabel: text(40),
    note: text(300),
})
    .refine((v) => new Set(v.lines.map((l) => l.itemId)).size === v.lines.length, { path: ['lines'], message: 'Each item can appear once' });
exports.voidPosOrderSchema = zod_1.z.object({ reason: zod_1.z.string().trim().min(3, 'Give a short reason').max(300) });
exports.posOrdersQuerySchema = zod_1.z.object({ date: reservations_1.dateSchema.optional() });
//# sourceMappingURL=pos.js.map