import { OUTLET_TYPES, PAYMENT_METHODS } from '@pms/types';
import { z } from 'zod';
import { dateSchema } from './reservations';

const text = (max: number) => z.string().trim().max(max);

export const outletSchema = z.object({
  name: z.string().trim().min(2, 'Enter a name').max(80),
  type: z.enum(OUTLET_TYPES),
});
export const updateOutletSchema = outletSchema.partial();

export const posItemSchema = z.object({
  outletId: z.string().uuid('Choose an outlet'),
  name: z.string().trim().min(2, 'Enter a name').max(120),
  category: text(60),
  priceMinor: z.number().int('Whole number of centavos').min(0).max(100_000_000),
  taxable: z.boolean(),
  /** Selling it uses up this stock item. */
  inventoryItemId: z.string().uuid().optional(),
  inventoryQuantity: z.number().int('Whole number').min(1).max(100_000),
});
export const updatePosItemSchema = z
  .object({
    name: z.string().trim().min(2).max(120),
    category: text(60),
    priceMinor: z.number().int().min(0).max(100_000_000),
    taxable: z.boolean(),
    inventoryItemId: z.string().uuid().nullable(),
    inventoryQuantity: z.number().int().min(1).max(100_000),
  })
  .partial();

const settlementSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('PAY_NOW'), method: z.enum(PAYMENT_METHODS) }),
  z.object({ type: z.literal('ROOM_CHARGE'), reservationId: z.string().uuid('Choose the guest') }),
]);

/** Prices are NOT sent by the client: the server uses the menu price at the moment of sale. */
export const createPosOrderSchema = z
  .object({
    outletId: z.string().uuid('Choose an outlet'),
    lines: z.array(z.object({ itemId: z.string().uuid(), quantity: z.number().int('Whole number').min(1).max(1000) })).min(1, 'Add at least one item').max(100),
    settlement: settlementSchema,
    tableLabel: text(40),
    note: text(300),
  })
  .refine((v) => new Set(v.lines.map((l) => l.itemId)).size === v.lines.length, { path: ['lines'], message: 'Each item can appear once' });

export const voidPosOrderSchema = z.object({ reason: z.string().trim().min(3, 'Give a short reason').max(300) });

export const posOrdersQuerySchema = z.object({ date: dateSchema.optional() });

export type OutletInput = z.infer<typeof outletSchema>;
export type UpdateOutletInput = z.infer<typeof updateOutletSchema>;
export type PosItemInput = z.infer<typeof posItemSchema>;
export type UpdatePosItemInput = z.infer<typeof updatePosItemSchema>;
export type CreatePosOrderInput = z.infer<typeof createPosOrderSchema>;
export type VoidPosOrderInput = z.infer<typeof voidPosOrderSchema>;
export type PosOrdersQuery = z.infer<typeof posOrdersQuerySchema>;
