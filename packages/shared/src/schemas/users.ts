import { z } from 'zod';

import { nameSchema, passwordSchema, usernameSchema } from './auth.js';

export const updateProfileSchema = z
  .object({
    name: nameSchema.optional(),
    username: usernameSchema.optional(),
    bio: z.string().trim().max(280, 'Bio must be at most 280 characters.').optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'Provide at least one field to update.',
  });

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Enter your current password.').max(128),
    newPassword: passwordSchema,
  })
  .strict();

export const userSearchQuerySchema = z.object({
  q: z.string().trim().min(2, 'Search for at least 2 characters.').max(80),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type UserSearchQuery = z.infer<typeof userSearchQuerySchema>;
