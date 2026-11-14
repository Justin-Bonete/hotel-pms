"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.rangeQuerySchema = exports.reservationsQuerySchema = exports.transitionSchema = exports.updateReservationSchema = exports.createReservationSchema = exports.ratePlanSchema = exports.dateSchema = void 0;
const types_1 = require("@pms/types");
const zod_1 = require("zod");
const guests_1 = require("./guests");
exports.dateSchema = zod_1.z.string().refine(types_1.isDateString, 'Use a valid date (YYYY-MM-DD)');
const minor = zod_1.z.number().int('Whole number of centavos').min(0).max(1_000_000_000);
// ---------------------------------------------------------------- rate plans
exports.ratePlanSchema = zod_1.z.object({
    name: zod_1.z.string().trim().min(2, 'Enter a name').max(80),
    description: zod_1.z.string().trim().max(300),
    isDefault: zod_1.z.boolean(),
    rates: zod_1.z
        .array(zod_1.z.object({ roomTypeId: zod_1.z.string().uuid(), nightlyRateMinor: minor, weekendRateMinor: minor.nullable() }))
        .min(1, 'Set a rate for at least one room type')
        .max(100),
});
// ---------------------------------------------------------------- reservations
const reservationBase = zod_1.z.object({
    roomTypeId: zod_1.z.string().uuid('Choose a room type'),
    ratePlanId: zod_1.z.string().uuid().optional(),
    arrivalDate: exports.dateSchema,
    departureDate: exports.dateSchema,
    adults: zod_1.z.number().int('Whole number').min(1, 'At least 1 adult').max(20),
    children: zod_1.z.number().int('Whole number').min(0).max(20),
    source: zod_1.z.enum(types_1.RESERVATION_SOURCES),
    status: zod_1.z.enum(types_1.CREATABLE_STATUSES),
    specialRequests: zod_1.z.string().trim().max(1000),
    notes: zod_1.z.string().trim().max(1000),
});
exports.createReservationSchema = reservationBase
    .extend({ guestId: zod_1.z.string().uuid().optional(), newGuest: guests_1.guestSchema.optional() })
    .refine((v) => Boolean(v.guestId) !== Boolean(v.newGuest), { path: ['guestId'], message: 'Choose an existing guest or enter a new one' })
    .refine((v) => v.departureDate > v.arrivalDate, { path: ['departureDate'], message: 'Departure must be after arrival' });
exports.updateReservationSchema = zod_1.z
    .object({
    arrivalDate: exports.dateSchema,
    departureDate: exports.dateSchema,
    adults: reservationBase.shape.adults,
    children: reservationBase.shape.children,
    ratePlanId: zod_1.z.string().uuid(),
    specialRequests: reservationBase.shape.specialRequests,
    notes: reservationBase.shape.notes,
})
    .partial();
exports.transitionSchema = zod_1.z.object({
    action: zod_1.z.enum(types_1.RESERVATION_ACTIONS),
    reason: zod_1.z.string().trim().max(300).optional(),
    roomId: zod_1.z.string().uuid().optional(),
    /** Check out even though the folio is not settled. Needs folio.override_checkout. */
    overrideBalance: zod_1.z.boolean().optional(),
});
exports.reservationsQuerySchema = zod_1.z.object({
    page: zod_1.z.coerce.number().int().min(1).default(1),
    pageSize: zod_1.z.coerce.number().int().min(1).max(100).default(25),
    propertyId: zod_1.z.string().uuid().optional(),
    status: zod_1.z.enum(types_1.RESERVATION_STATUSES).optional(),
    from: exports.dateSchema.optional(),
    to: exports.dateSchema.optional(),
    search: zod_1.z.string().trim().max(60).optional(),
});
exports.rangeQuerySchema = zod_1.z.object({
    from: exports.dateSchema,
    days: zod_1.z.coerce.number().int().min(1).max(62).default(14),
});
//# sourceMappingURL=reservations.js.map