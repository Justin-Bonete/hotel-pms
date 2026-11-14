import { z } from 'zod';
export declare const guestSchema: z.ZodObject<{
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
}>;
export declare const updateGuestSchema: z.ZodObject<{
    firstName: z.ZodOptional<z.ZodString>;
    lastName: z.ZodOptional<z.ZodString>;
    email: z.ZodOptional<z.ZodUnion<[z.ZodLiteral<"">, z.ZodString]>>;
    phone: z.ZodOptional<z.ZodString>;
    country: z.ZodOptional<z.ZodUnion<[z.ZodLiteral<"">, z.ZodString]>>;
    preferences: z.ZodOptional<z.ZodString>;
    notes: z.ZodOptional<z.ZodString>;
    isVip: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    firstName?: string | undefined;
    lastName?: string | undefined;
    email?: string | undefined;
    phone?: string | undefined;
    country?: string | undefined;
    preferences?: string | undefined;
    notes?: string | undefined;
    isVip?: boolean | undefined;
}, {
    firstName?: string | undefined;
    lastName?: string | undefined;
    email?: string | undefined;
    phone?: string | undefined;
    country?: string | undefined;
    preferences?: string | undefined;
    notes?: string | undefined;
    isVip?: boolean | undefined;
}>;
export declare const guestsQuerySchema: z.ZodObject<{
    page: z.ZodDefault<z.ZodNumber>;
    pageSize: z.ZodDefault<z.ZodNumber>;
    search: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    page: number;
    pageSize: number;
    search?: string | undefined;
}, {
    page?: number | undefined;
    pageSize?: number | undefined;
    search?: string | undefined;
}>;
export type GuestInput = z.infer<typeof guestSchema>;
export type UpdateGuestInput = z.infer<typeof updateGuestSchema>;
export type GuestsQuery = z.infer<typeof guestsQuerySchema>;
