"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.guestsQuerySchema = exports.updateGuestSchema = exports.guestSchema = void 0;
const zod_1 = require("zod");
const text = (max) => zod_1.z.string().trim().max(max);
exports.guestSchema = zod_1.z.object({
    firstName: zod_1.z.string().trim().min(1, 'Enter a first name').max(80),
    lastName: zod_1.z.string().trim().min(1, 'Enter a last name').max(80),
    email: zod_1.z.union([zod_1.z.literal(''), zod_1.z.string().trim().email('Enter a valid email').max(254)]),
    phone: text(40),
    country: zod_1.z.union([zod_1.z.literal(''), zod_1.z.string().trim().length(2, 'Use a 2-letter country code, e.g. PH')]),
    preferences: text(1000),
    notes: text(1000),
    isVip: zod_1.z.boolean(),
});
exports.updateGuestSchema = exports.guestSchema.partial();
exports.guestsQuerySchema = zod_1.z.object({
    page: zod_1.z.coerce.number().int().min(1).default(1),
    pageSize: zod_1.z.coerce.number().int().min(1).max(100).default(25),
    search: zod_1.z.string().trim().max(80).optional(),
});
//# sourceMappingURL=guests.js.map