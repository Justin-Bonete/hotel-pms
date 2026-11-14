"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resetPasswordSchema = exports.forgotPasswordSchema = exports.verifyEmailSchema = exports.loginSchema = exports.registerSchema = exports.passwordSchema = exports.emailSchema = void 0;
const zod_1 = require("zod");
exports.emailSchema = zod_1.z.string().trim().toLowerCase().email('Enter a valid email address').max(254);
/** 12+ characters; max 128 keeps hashing cost bounded. Length beats forced symbols. */
exports.passwordSchema = zod_1.z
    .string()
    .min(12, 'Use at least 12 characters')
    .max(128, 'Use at most 128 characters');
const nameSchema = zod_1.z.string().trim().min(1, 'Required').max(80);
const tokenSchema = zod_1.z.string().min(20).max(200);
exports.registerSchema = zod_1.z.object({
    organizationName: zod_1.z.string().trim().min(2, 'Enter your company or group name').max(100),
    firstName: nameSchema,
    lastName: nameSchema,
    email: exports.emailSchema,
    password: exports.passwordSchema,
});
exports.loginSchema = zod_1.z.object({
    email: exports.emailSchema,
    password: zod_1.z.string().min(1, 'Enter your password').max(128),
});
exports.verifyEmailSchema = zod_1.z.object({ token: tokenSchema });
exports.forgotPasswordSchema = zod_1.z.object({ email: exports.emailSchema });
exports.resetPasswordSchema = zod_1.z.object({ token: tokenSchema, password: exports.passwordSchema });
//# sourceMappingURL=auth.js.map