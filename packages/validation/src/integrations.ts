import { API_KEY_SCOPES, WEBHOOK_ALL_EVENTS, WEBHOOK_EVENTS, nightsBetween } from '@pms/types';
import { z } from 'zod';
import { dateSchema } from './reservations';

const text = (max: number) => z.string().trim().max(max);

// ---------------------------------------------------------------- API keys
export const createApiKeySchema = z.object({
  name: z.string().trim().min(2, 'Give the key a name').max(80),
  propertyIds: z.array(z.string().uuid()).min(1, 'Choose at least one property').max(100),
  scopes: z.array(z.enum(API_KEY_SCOPES)).min(1, 'Choose what the key may do'),
  /** Online bookings start as PENDING for the hotel to confirm. Turning this on confirms them immediately. */
  autoConfirm: z.boolean(),
  expiresInDays: z.number().int().min(1).max(730).optional(),
});

// ---------------------------------------------------------------- webhooks
const eventList = z.array(z.enum([...WEBHOOK_EVENTS, WEBHOOK_ALL_EVENTS])).min(1, 'Choose at least one event').max(10);
export const createWebhookSchema = z.object({
  url: z.string().trim().url('Enter a full address starting with https://').max(500),
  description: text(200),
  events: eventList,
  /** Leave out to receive events from every property you can manage. */
  propertyId: z.string().uuid().optional(),
});
export const updateWebhookSchema = z.object({
  url: z.string().trim().url().max(500),
  description: text(200),
  events: eventList,
  isActive: z.boolean(),
}).partial();

// ---------------------------------------------------------------- public booking API
const MAX_PUBLIC_NIGHTS = 30;
const stayDates = (v: { arrival?: string; departure?: string; arrivalDate?: string; departureDate?: string }) => {
  const a = v.arrival ?? v.arrivalDate ?? '';
  const d = v.departure ?? v.departureDate ?? '';
  return d > a && nightsBetween(a, d) <= MAX_PUBLIC_NIGHTS;
};
const stayMessage = { message: `Departure must be after arrival, and a stay can be at most ${MAX_PUBLIC_NIGHTS} nights` };

export const publicAvailabilityQuerySchema = z
  .object({
    arrival: dateSchema,
    departure: dateSchema,
    adults: z.coerce.number().int().min(1).max(10).default(1),
    children: z.coerce.number().int().min(0).max(10).default(0),
  })
  .refine(stayDates, { path: ['departure'], ...stayMessage });

export const publicBookingSchema = z
  .object({
    roomTypeId: z.string().uuid(),
    arrivalDate: dateSchema,
    departureDate: dateSchema,
    adults: z.number().int().min(1).max(10),
    children: z.number().int().min(0).max(10),
    guest: z.object({
      firstName: z.string().trim().min(1).max(80),
      lastName: z.string().trim().min(1).max(80),
      email: z.string().trim().toLowerCase().email().max(254),
      phone: text(40).optional(),
      country: z.string().trim().length(2).toUpperCase().optional(),
    }),
    specialRequests: text(500).optional(),
  })
  .refine(stayDates, { path: ['departureDate'], ...stayMessage });

export const publicLookupQuerySchema = z.object({ email: z.string().trim().toLowerCase().email().max(254) });

export type CreateApiKeyInput = z.infer<typeof createApiKeySchema>;
export type CreateWebhookInput = z.infer<typeof createWebhookSchema>;
export type UpdateWebhookInput = z.infer<typeof updateWebhookSchema>;
export type PublicAvailabilityQuery = z.infer<typeof publicAvailabilityQuerySchema>;
export type PublicBookingInput = z.infer<typeof publicBookingSchema>;
export type PublicLookupQuery = z.infer<typeof publicLookupQuerySchema>;
