import { z } from 'zod';
export declare const dateSchema: z.ZodEffects<z.ZodString, string, string>;
export declare const ratePlanSchema: z.ZodObject<{
    name: z.ZodString;
    description: z.ZodString;
    isDefault: z.ZodBoolean;
    rates: z.ZodArray<z.ZodObject<{
        roomTypeId: z.ZodString;
        nightlyRateMinor: z.ZodNumber;
        weekendRateMinor: z.ZodNullable<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        roomTypeId: string;
        nightlyRateMinor: number;
        weekendRateMinor: number | null;
    }, {
        roomTypeId: string;
        nightlyRateMinor: number;
        weekendRateMinor: number | null;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    name: string;
    description: string;
    isDefault: boolean;
    rates: {
        roomTypeId: string;
        nightlyRateMinor: number;
        weekendRateMinor: number | null;
    }[];
}, {
    name: string;
    description: string;
    isDefault: boolean;
    rates: {
        roomTypeId: string;
        nightlyRateMinor: number;
        weekendRateMinor: number | null;
    }[];
}>;
export type RatePlanInput = z.infer<typeof ratePlanSchema>;
export declare const createReservationSchema: z.ZodEffects<z.ZodEffects<z.ZodObject<{
    roomTypeId: z.ZodString;
    ratePlanId: z.ZodOptional<z.ZodString>;
    arrivalDate: z.ZodEffects<z.ZodString, string, string>;
    departureDate: z.ZodEffects<z.ZodString, string, string>;
    adults: z.ZodNumber;
    children: z.ZodNumber;
    source: z.ZodEnum<["WALK_IN", "PHONE", "WEBSITE", "OTA", "GROUP", "CORPORATE", "TRAVEL_AGENT", "OTHER"]>;
    status: z.ZodEnum<["INQUIRY", "PENDING", "CONFIRMED"]>;
    specialRequests: z.ZodString;
    notes: z.ZodString;
} & {
    guestId: z.ZodOptional<z.ZodString>;
    newGuest: z.ZodOptional<z.ZodObject<{
        firstName: z.ZodString;
        lastName: z.ZodString;
        email: z.ZodUnion<[z.ZodLiteral<"">, z.ZodString]>;
        phone: z.ZodString;
        country: z.ZodUnion<[z.ZodLiteral<"">, z.ZodString]>;
        preferences: z.ZodString;
        notes: z.ZodString;
        isVip: z.ZodBoolean;
    }, "strip", z.ZodTypeAny, {
        firstName: string;
        lastName: string;
        email: string;
        phone: string;
        country: string;
        preferences: string;
        notes: string;
        isVip: boolean;
    }, {
        firstName: string;
        lastName: string;
        email: string;
        phone: string;
        country: string;
        preferences: string;
        notes: string;
        isVip: boolean;
    }>>;
}, "strip", z.ZodTypeAny, {
    status: "INQUIRY" | "PENDING" | "CONFIRMED";
    notes: string;
    roomTypeId: string;
    arrivalDate: string;
    departureDate: string;
    adults: number;
    children: number;
    source: "WALK_IN" | "PHONE" | "WEBSITE" | "OTA" | "GROUP" | "CORPORATE" | "TRAVEL_AGENT" | "OTHER";
    specialRequests: string;
    ratePlanId?: string | undefined;
    guestId?: string | undefined;
    newGuest?: {
        firstName: string;
        lastName: string;
        email: string;
        phone: string;
        country: string;
        preferences: string;
        notes: string;
        isVip: boolean;
    } | undefined;
}, {
    status: "INQUIRY" | "PENDING" | "CONFIRMED";
    notes: string;
    roomTypeId: string;
    arrivalDate: string;
    departureDate: string;
    adults: number;
    children: number;
    source: "WALK_IN" | "PHONE" | "WEBSITE" | "OTA" | "GROUP" | "CORPORATE" | "TRAVEL_AGENT" | "OTHER";
    specialRequests: string;
    ratePlanId?: string | undefined;
    guestId?: string | undefined;
    newGuest?: {
        firstName: string;
        lastName: string;
        email: string;
        phone: string;
        country: string;
        preferences: string;
        notes: string;
        isVip: boolean;
    } | undefined;
}>, {
    status: "INQUIRY" | "PENDING" | "CONFIRMED";
    notes: string;
    roomTypeId: string;
    arrivalDate: string;
    departureDate: string;
    adults: number;
    children: number;
    source: "WALK_IN" | "PHONE" | "WEBSITE" | "OTA" | "GROUP" | "CORPORATE" | "TRAVEL_AGENT" | "OTHER";
    specialRequests: string;
    ratePlanId?: string | undefined;
    guestId?: string | undefined;
    newGuest?: {
        firstName: string;
        lastName: string;
        email: string;
        phone: string;
        country: string;
        preferences: string;
        notes: string;
        isVip: boolean;
    } | undefined;
}, {
    status: "INQUIRY" | "PENDING" | "CONFIRMED";
    notes: string;
    roomTypeId: string;
    arrivalDate: string;
    departureDate: string;
    adults: number;
    children: number;
    source: "WALK_IN" | "PHONE" | "WEBSITE" | "OTA" | "GROUP" | "CORPORATE" | "TRAVEL_AGENT" | "OTHER";
    specialRequests: string;
    ratePlanId?: string | undefined;
    guestId?: string | undefined;
    newGuest?: {
        firstName: string;
        lastName: string;
        email: string;
        phone: string;
        country: string;
        preferences: string;
        notes: string;
        isVip: boolean;
    } | undefined;
}>, {
    status: "INQUIRY" | "PENDING" | "CONFIRMED";
    notes: string;
    roomTypeId: string;
    arrivalDate: string;
    departureDate: string;
    adults: number;
    children: number;
    source: "WALK_IN" | "PHONE" | "WEBSITE" | "OTA" | "GROUP" | "CORPORATE" | "TRAVEL_AGENT" | "OTHER";
    specialRequests: string;
    ratePlanId?: string | undefined;
    guestId?: string | undefined;
    newGuest?: {
        firstName: string;
        lastName: string;
        email: string;
        phone: string;
        country: string;
        preferences: string;
        notes: string;
        isVip: boolean;
    } | undefined;
}, {
    status: "INQUIRY" | "PENDING" | "CONFIRMED";
    notes: string;
    roomTypeId: string;
    arrivalDate: string;
    departureDate: string;
    adults: number;
    children: number;
    source: "WALK_IN" | "PHONE" | "WEBSITE" | "OTA" | "GROUP" | "CORPORATE" | "TRAVEL_AGENT" | "OTHER";
    specialRequests: string;
    ratePlanId?: string | undefined;
    guestId?: string | undefined;
    newGuest?: {
        firstName: string;
        lastName: string;
        email: string;
        phone: string;
        country: string;
        preferences: string;
        notes: string;
        isVip: boolean;
    } | undefined;
}>;
export declare const updateReservationSchema: z.ZodObject<{
    arrivalDate: z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>;
    departureDate: z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>;
    adults: z.ZodOptional<z.ZodNumber>;
    children: z.ZodOptional<z.ZodNumber>;
    ratePlanId: z.ZodOptional<z.ZodString>;
    specialRequests: z.ZodOptional<z.ZodString>;
    notes: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    notes?: string | undefined;
    ratePlanId?: string | undefined;
    arrivalDate?: string | undefined;
    departureDate?: string | undefined;
    adults?: number | undefined;
    children?: number | undefined;
    specialRequests?: string | undefined;
}, {
    notes?: string | undefined;
    ratePlanId?: string | undefined;
    arrivalDate?: string | undefined;
    departureDate?: string | undefined;
    adults?: number | undefined;
    children?: number | undefined;
    specialRequests?: string | undefined;
}>;
export declare const transitionSchema: z.ZodObject<{
    action: z.ZodEnum<["confirm", "cancel", "no_show", "check_in", "check_out", "assign_room", "unassign_room"]>;
    reason: z.ZodOptional<z.ZodString>;
    roomId: z.ZodOptional<z.ZodString>;
    /** Check out even though the folio is not settled. Needs folio.override_checkout. */
    overrideBalance: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    action: "confirm" | "cancel" | "no_show" | "check_in" | "check_out" | "assign_room" | "unassign_room";
    reason?: string | undefined;
    roomId?: string | undefined;
    overrideBalance?: boolean | undefined;
}, {
    action: "confirm" | "cancel" | "no_show" | "check_in" | "check_out" | "assign_room" | "unassign_room";
    reason?: string | undefined;
    roomId?: string | undefined;
    overrideBalance?: boolean | undefined;
}>;
export declare const reservationsQuerySchema: z.ZodObject<{
    page: z.ZodDefault<z.ZodNumber>;
    pageSize: z.ZodDefault<z.ZodNumber>;
    propertyId: z.ZodOptional<z.ZodString>;
    status: z.ZodOptional<z.ZodEnum<["INQUIRY", "PENDING", "CONFIRMED", "CHECKED_IN", "CHECKED_OUT", "CANCELLED", "NO_SHOW"]>>;
    from: z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>;
    to: z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>;
    search: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    page: number;
    pageSize: number;
    status?: "INQUIRY" | "PENDING" | "CONFIRMED" | "CHECKED_IN" | "CHECKED_OUT" | "CANCELLED" | "NO_SHOW" | undefined;
    search?: string | undefined;
    propertyId?: string | undefined;
    from?: string | undefined;
    to?: string | undefined;
}, {
    status?: "INQUIRY" | "PENDING" | "CONFIRMED" | "CHECKED_IN" | "CHECKED_OUT" | "CANCELLED" | "NO_SHOW" | undefined;
    page?: number | undefined;
    pageSize?: number | undefined;
    search?: string | undefined;
    propertyId?: string | undefined;
    from?: string | undefined;
    to?: string | undefined;
}>;
export declare const rangeQuerySchema: z.ZodObject<{
    from: z.ZodEffects<z.ZodString, string, string>;
    days: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    from: string;
    days: number;
}, {
    from: string;
    days?: number | undefined;
}>;
export type CreateReservationInput = z.infer<typeof createReservationSchema>;
export type UpdateReservationInput = z.infer<typeof updateReservationSchema>;
export type TransitionInput = z.infer<typeof transitionSchema>;
export type ReservationsQuery = z.infer<typeof reservationsQuerySchema>;
export type RangeQuery = z.infer<typeof rangeQuerySchema>;
