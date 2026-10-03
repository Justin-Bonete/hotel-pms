import { PROPERTY_TYPES } from '@pms/types';
import { z } from 'zod';

const text = (max: number) => z.string().trim().max(max);
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use HH:mm, for example 14:00');
const uuidOrEmpty = z.union([z.literal(''), z.string().uuid()]);

const validTimezone = (value: string): boolean => {
  try {
    new Intl.DateTimeFormat('en', { timeZone: value });
    return true;
  } catch {
    return false;
  }
};

/** Form-friendly: optional text is an empty string. The API turns '' into null. */
export const propertyFormSchema = z.object({
  name: z.string().trim().min(2, 'Enter a name').max(120),
  type: z.enum(PROPERTY_TYPES),
  groupId: uuidOrEmpty,
  addressLine1: text(200),
  addressLine2: text(200),
  city: text(100),
  region: text(100),
  postalCode: text(20),
  country: z.string().trim().length(2, 'Use a 2-letter country code, e.g. PH'),
  phone: text(40),
  email: z.union([z.literal(''), z.string().trim().email('Enter a valid email').max(254)]),
  timezone: z.string().trim().min(1).max(64).refine(validTimezone, 'Unknown timezone, e.g. Asia/Manila'),
  currency: z.string().trim().length(3, 'Use a 3-letter currency code, e.g. PHP'),
  checkInTime: time,
  checkOutTime: time,
});

export const createPropertySchema = propertyFormSchema.partial().required({ name: true, type: true });
export const updatePropertySchema = propertyFormSchema.partial();

export const propertyGroupSchema = z.object({ name: z.string().trim().min(2, 'Enter a name').max(100) });
export const buildingSchema = z.object({ name: z.string().trim().min(1, 'Enter a name').max(80) });
export const floorSchema = z.object({
  level: z.number().int('Whole number').min(-5).max(200),
  name: text(60),
});

export type PropertyFormInput = z.infer<typeof propertyFormSchema>;
export type CreatePropertyInput = z.infer<typeof createPropertySchema>;
export type UpdatePropertyInput = z.infer<typeof updatePropertySchema>;
export type PropertyGroupInput = z.infer<typeof propertyGroupSchema>;
export type BuildingInput = z.infer<typeof buildingSchema>;
export type FloorInput = z.infer<typeof floorSchema>;
