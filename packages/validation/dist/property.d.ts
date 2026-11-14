import { z } from 'zod';
/** Form-friendly: optional text is an empty string. The API turns '' into null. */
export declare const propertyFormSchema: z.ZodObject<{
    name: z.ZodString;
    type: z.ZodEnum<["HOTEL", "RESORT", "BOUTIQUE", "INN", "HOSTEL", "SERVICED_APARTMENT", "VACATION_RENTAL"]>;
    groupId: z.ZodUnion<[z.ZodLiteral<"">, z.ZodString]>;
    addressLine1: z.ZodString;
    addressLine2: z.ZodString;
    city: z.ZodString;
    region: z.ZodString;
    postalCode: z.ZodString;
    country: z.ZodString;
    phone: z.ZodString;
    email: z.ZodUnion<[z.ZodLiteral<"">, z.ZodString]>;
    timezone: z.ZodEffects<z.ZodString, string, string>;
    currency: z.ZodString;
    checkInTime: z.ZodString;
    checkOutTime: z.ZodString;
}, "strip", z.ZodTypeAny, {
    email: string;
    type: "HOTEL" | "RESORT" | "BOUTIQUE" | "INN" | "HOSTEL" | "SERVICED_APARTMENT" | "VACATION_RENTAL";
    name: string;
    phone: string;
    country: string;
    groupId: string;
    addressLine1: string;
    addressLine2: string;
    city: string;
    region: string;
    postalCode: string;
    timezone: string;
    currency: string;
    checkInTime: string;
    checkOutTime: string;
}, {
    email: string;
    type: "HOTEL" | "RESORT" | "BOUTIQUE" | "INN" | "HOSTEL" | "SERVICED_APARTMENT" | "VACATION_RENTAL";
    name: string;
    phone: string;
    country: string;
    groupId: string;
    addressLine1: string;
    addressLine2: string;
    city: string;
    region: string;
    postalCode: string;
    timezone: string;
    currency: string;
    checkInTime: string;
    checkOutTime: string;
}>;
export declare const createPropertySchema: z.ZodObject<{
    email: z.ZodOptional<z.ZodUnion<[z.ZodLiteral<"">, z.ZodString]>>;
    type: z.ZodEnum<["HOTEL", "RESORT", "BOUTIQUE", "INN", "HOSTEL", "SERVICED_APARTMENT", "VACATION_RENTAL"]>;
    name: z.ZodString;
    phone: z.ZodOptional<z.ZodString>;
    country: z.ZodOptional<z.ZodString>;
    groupId: z.ZodOptional<z.ZodUnion<[z.ZodLiteral<"">, z.ZodString]>>;
    addressLine1: z.ZodOptional<z.ZodString>;
    addressLine2: z.ZodOptional<z.ZodString>;
    city: z.ZodOptional<z.ZodString>;
    region: z.ZodOptional<z.ZodString>;
    postalCode: z.ZodOptional<z.ZodString>;
    timezone: z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>;
    currency: z.ZodOptional<z.ZodString>;
    checkInTime: z.ZodOptional<z.ZodString>;
    checkOutTime: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    type: "HOTEL" | "RESORT" | "BOUTIQUE" | "INN" | "HOSTEL" | "SERVICED_APARTMENT" | "VACATION_RENTAL";
    name: string;
    email?: string | undefined;
    phone?: string | undefined;
    country?: string | undefined;
    groupId?: string | undefined;
    addressLine1?: string | undefined;
    addressLine2?: string | undefined;
    city?: string | undefined;
    region?: string | undefined;
    postalCode?: string | undefined;
    timezone?: string | undefined;
    currency?: string | undefined;
    checkInTime?: string | undefined;
    checkOutTime?: string | undefined;
}, {
    type: "HOTEL" | "RESORT" | "BOUTIQUE" | "INN" | "HOSTEL" | "SERVICED_APARTMENT" | "VACATION_RENTAL";
    name: string;
    email?: string | undefined;
    phone?: string | undefined;
    country?: string | undefined;
    groupId?: string | undefined;
    addressLine1?: string | undefined;
    addressLine2?: string | undefined;
    city?: string | undefined;
    region?: string | undefined;
    postalCode?: string | undefined;
    timezone?: string | undefined;
    currency?: string | undefined;
    checkInTime?: string | undefined;
    checkOutTime?: string | undefined;
}>;
export declare const updatePropertySchema: z.ZodObject<{
    name: z.ZodOptional<z.ZodString>;
    type: z.ZodOptional<z.ZodEnum<["HOTEL", "RESORT", "BOUTIQUE", "INN", "HOSTEL", "SERVICED_APARTMENT", "VACATION_RENTAL"]>>;
    groupId: z.ZodOptional<z.ZodUnion<[z.ZodLiteral<"">, z.ZodString]>>;
    addressLine1: z.ZodOptional<z.ZodString>;
    addressLine2: z.ZodOptional<z.ZodString>;
    city: z.ZodOptional<z.ZodString>;
    region: z.ZodOptional<z.ZodString>;
    postalCode: z.ZodOptional<z.ZodString>;
    country: z.ZodOptional<z.ZodString>;
    phone: z.ZodOptional<z.ZodString>;
    email: z.ZodOptional<z.ZodUnion<[z.ZodLiteral<"">, z.ZodString]>>;
    timezone: z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>;
    currency: z.ZodOptional<z.ZodString>;
    checkInTime: z.ZodOptional<z.ZodString>;
    checkOutTime: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    email?: string | undefined;
    type?: "HOTEL" | "RESORT" | "BOUTIQUE" | "INN" | "HOSTEL" | "SERVICED_APARTMENT" | "VACATION_RENTAL" | undefined;
    name?: string | undefined;
    phone?: string | undefined;
    country?: string | undefined;
    groupId?: string | undefined;
    addressLine1?: string | undefined;
    addressLine2?: string | undefined;
    city?: string | undefined;
    region?: string | undefined;
    postalCode?: string | undefined;
    timezone?: string | undefined;
    currency?: string | undefined;
    checkInTime?: string | undefined;
    checkOutTime?: string | undefined;
}, {
    email?: string | undefined;
    type?: "HOTEL" | "RESORT" | "BOUTIQUE" | "INN" | "HOSTEL" | "SERVICED_APARTMENT" | "VACATION_RENTAL" | undefined;
    name?: string | undefined;
    phone?: string | undefined;
    country?: string | undefined;
    groupId?: string | undefined;
    addressLine1?: string | undefined;
    addressLine2?: string | undefined;
    city?: string | undefined;
    region?: string | undefined;
    postalCode?: string | undefined;
    timezone?: string | undefined;
    currency?: string | undefined;
    checkInTime?: string | undefined;
    checkOutTime?: string | undefined;
}>;
export declare const propertyGroupSchema: z.ZodObject<{
    name: z.ZodString;
}, "strip", z.ZodTypeAny, {
    name: string;
}, {
    name: string;
}>;
export declare const buildingSchema: z.ZodObject<{
    name: z.ZodString;
}, "strip", z.ZodTypeAny, {
    name: string;
}, {
    name: string;
}>;
export declare const floorSchema: z.ZodObject<{
    level: z.ZodNumber;
    name: z.ZodString;
}, "strip", z.ZodTypeAny, {
    name: string;
    level: number;
}, {
    name: string;
    level: number;
}>;
export type PropertyFormInput = z.infer<typeof propertyFormSchema>;
export type CreatePropertyInput = z.infer<typeof createPropertySchema>;
export type UpdatePropertyInput = z.infer<typeof updatePropertySchema>;
export type PropertyGroupInput = z.infer<typeof propertyGroupSchema>;
export type BuildingInput = z.infer<typeof buildingSchema>;
export type FloorInput = z.infer<typeof floorSchema>;
