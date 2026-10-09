import { z } from 'zod';

const text = (max: number) => z.string().trim().max(max);

export const guestSchema = z.object({
  firstName: z.string().trim().min(1, 'Enter a first name').max(80),
  lastName: z.string().trim().min(1, 'Enter a last name').max(80),
  email: z.union([z.literal(''), z.string().trim().email('Enter a valid email').max(254)]),
  phone: text(40),
  country: z.union([z.literal(''), z.string().trim().length(2, 'Use a 2-letter country code, e.g. PH')]),
  preferences: text(1000),
  notes: text(1000),
  isVip: z.boolean(),
});
export const updateGuestSchema = guestSchema.partial();

export const guestsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
  search: z.string().trim().max(80).optional(),
});

export type GuestInput = z.infer<typeof guestSchema>;
export type UpdateGuestInput = z.infer<typeof updateGuestSchema>;
export type GuestsQuery = z.infer<typeof guestsQuerySchema>;
