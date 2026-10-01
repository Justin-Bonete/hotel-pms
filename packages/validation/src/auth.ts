import { z } from 'zod';

export const emailSchema = z.string().trim().toLowerCase().email('Enter a valid email address').max(254);

/** 12+ characters; max 128 keeps hashing cost bounded. Length beats forced symbols. */
export const passwordSchema = z
  .string()
  .min(12, 'Use at least 12 characters')
  .max(128, 'Use at most 128 characters');

const nameSchema = z.string().trim().min(1, 'Required').max(80);
const tokenSchema = z.string().min(20).max(200);

export const registerSchema = z.object({
  organizationName: z.string().trim().min(2, 'Enter your company or group name').max(100),
  firstName: nameSchema,
  lastName: nameSchema,
  email: emailSchema,
  password: passwordSchema,
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Enter your password').max(128),
});

export const verifyEmailSchema = z.object({ token: tokenSchema });
export const forgotPasswordSchema = z.object({ email: emailSchema });
export const resetPasswordSchema = z.object({ token: tokenSchema, password: passwordSchema });

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type VerifyEmailInput = z.infer<typeof verifyEmailSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
