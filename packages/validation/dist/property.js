"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.floorSchema = exports.buildingSchema = exports.propertyGroupSchema = exports.updatePropertySchema = exports.createPropertySchema = exports.propertyFormSchema = void 0;
const types_1 = require("@pms/types");
const zod_1 = require("zod");
const text = (max) => zod_1.z.string().trim().max(max);
const time = zod_1.z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use HH:mm, for example 14:00');
const uuidOrEmpty = zod_1.z.union([zod_1.z.literal(''), zod_1.z.string().uuid()]);
const validTimezone = (value) => {
    try {
        new Intl.DateTimeFormat('en', { timeZone: value });
        return true;
    }
    catch {
        return false;
    }
};
/** Form-friendly: optional text is an empty string. The API turns '' into null. */
exports.propertyFormSchema = zod_1.z.object({
    name: zod_1.z.string().trim().min(2, 'Enter a name').max(120),
    type: zod_1.z.enum(types_1.PROPERTY_TYPES),
    groupId: uuidOrEmpty,
    addressLine1: text(200),
    addressLine2: text(200),
    city: text(100),
    region: text(100),
    postalCode: text(20),
    country: zod_1.z.string().trim().length(2, 'Use a 2-letter country code, e.g. PH'),
    phone: text(40),
    email: zod_1.z.union([zod_1.z.literal(''), zod_1.z.string().trim().email('Enter a valid email').max(254)]),
    timezone: zod_1.z.string().trim().min(1).max(64).refine(validTimezone, 'Unknown timezone, e.g. Asia/Manila'),
    currency: zod_1.z.string().trim().length(3, 'Use a 3-letter currency code, e.g. PHP'),
    checkInTime: time,
    checkOutTime: time,
});
exports.createPropertySchema = exports.propertyFormSchema.partial().required({ name: true, type: true });
exports.updatePropertySchema = exports.propertyFormSchema.partial();
exports.propertyGroupSchema = zod_1.z.object({ name: zod_1.z.string().trim().min(2, 'Enter a name').max(100) });
exports.buildingSchema = zod_1.z.object({ name: zod_1.z.string().trim().min(1, 'Enter a name').max(80) });
exports.floorSchema = zod_1.z.object({
    level: zod_1.z.number().int('Whole number').min(-5).max(200),
    name: text(60),
});
//# sourceMappingURL=property.js.map