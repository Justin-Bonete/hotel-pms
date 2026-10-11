import { CREATABLE_STATUSES, RESERVATION_ACTIONS, RESERVATION_SOURCES, RESERVATION_STATUSES, isDateString } from '@pms/types';
import { z } from 'zod';
import { guestSchema } from './guests';

export const dateSchema = z.string().refine(isDateString, 'Use a valid date (YYYY-MM-DD)');
const minor = z.number().int('Whole number of centavos').min(0).max(1_000_000_000);

// ---------------------------------------------------------------- rate plans
export const ratePlanSchema = z.object({
  name: z.string().trim().min(2, 'Enter a name').max(80),
  description: z.string().trim().max(300),
  isDefault: z.boolean(),
  rates: z
    .array(z.object({ roomTypeId: z.string().uuid(), nightlyRateMinor: minor, weekendRateMinor: minor.nullable() }))
    .min(1, 'Set a rate for at least one room type')
    .max(100),
});
export type RatePlanInput = z.infer<typeof ratePlanSchema>;

// ---------------------------------------------------------------- reservations
const reservationBase = z.object({
  roomTypeId: z.string().uuid('Choose a room type'),
  ratePlanId: z.string().uuid().optional(),
  arrivalDate: dateSchema,
  departureDate: dateSchema,
  adults: z.number().int('Whole number').min(1, 'At least 1 adult').max(20),
  children: z.number().int('Whole number').min(0).max(20),
  source: z.enum(RESERVATION_SOURCES),
  status: z.enum(CREATABLE_STATUSES),
  specialRequests: z.string().trim().max(1000),
  notes: z.string().trim().max(1000),
});

export const createReservationSchema = reservationBase
  .extend({ guestId: z.string().uuid().optional(), newGuest: guestSchema.optional() })
  .refine((v) => Boolean(v.guestId) !== Boolean(v.newGuest), { path: ['guestId'], message: 'Choose an existing guest or enter a new one' })
  .refine((v) => v.departureDate > v.arrivalDate, { path: ['departureDate'], message: 'Departure must be after arrival' });

export const updateReservationSchema = z
  .object({
    arrivalDate: dateSchema,
    departureDate: dateSchema,
    adults: reservationBase.shape.adults,
    children: reservationBase.shape.children,
    ratePlanId: z.string().uuid(),
    specialRequests: reservationBase.shape.specialRequests,
    notes: reservationBase.shape.notes,
  })
  .partial();

export const transitionSchema = z.object({
  action: z.enum(RESERVATION_ACTIONS),
  reason: z.string().trim().max(300).optional(),
  roomId: z.string().uuid().optional(),
  /** Check out even though the folio is not settled. Needs folio.override_checkout. */
  overrideBalance: z.boolean().optional(),
});

export const reservationsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
  propertyId: z.string().uuid().optional(),
  status: z.enum(RESERVATION_STATUSES).optional(),
  from: dateSchema.optional(),
  to: dateSchema.optional(),
  search: z.string().trim().max(60).optional(),
});

export const rangeQuerySchema = z.object({
  from: dateSchema,
  days: z.coerce.number().int().min(1).max(62).default(14),
});

export type CreateReservationInput = z.infer<typeof createReservationSchema>;
export type UpdateReservationInput = z.infer<typeof updateReservationSchema>;
export type TransitionInput = z.infer<typeof transitionSchema>;
export type ReservationsQuery = z.infer<typeof reservationsQuerySchema>;
export type RangeQuery = z.infer<typeof rangeQuerySchema>;
