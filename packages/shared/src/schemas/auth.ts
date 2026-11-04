import { z } from 'zod';

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email('Enter a valid email address.'));

export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, 'Username must be at least 3 characters.')
  .max(30, 'Username must be at most 30 characters.')
  .regex(/^[a-z0-9_]+$/, 'Use lowercase letters, numbers, and underscores only.');

export const passwordSchema = z
  .string()
  .min(10, 'Password must be at least 10 characters.')
  .max(128, 'Password must be at most 128 characters.')
  .regex(/[A-Za-z]/, 'Password must contain at least one letter.')
  .regex(/[0-9]/, 'Password must contain at least one number.');

export const nameSchema = z
  .string()
  .trim()
  .min(1, 'Name is required.')
  .max(80, 'Name must be at most 80 characters.');

export const registerSchema = z
  .object({
    name: nameSchema,
    username: usernameSchema,
    email: emailSchema,
    password: passwordSchema,
  })
  .strict();

export const loginSchema = z
  .object({
    email: emailSchema,
    password: z.string().min(1, 'Password is required.').max(128),
  })
  .strict();

export const verifyEmailSchema = z
  .object({
    token: z.string().min(20, 'Verification token is invalid.').max(256),
  })
  .strict();

export const resendVerificationSchema = z
  .object({
    email: emailSchema,
  })
  .strict();

export const forgotPasswordSchema = z
  .object({
    email: emailSchema,
  })
  .strict();

export const resetPasswordSchema = z
  .object({
    token: z.string().min(20, 'Reset token is invalid.').max(256),
    password: passwordSchema,
  })
  .strict();

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type VerifyEmailInput = z.infer<typeof verifyEmailSchema>;
export type ResendVerificationInput = z.infer<typeof resendVerificationSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
