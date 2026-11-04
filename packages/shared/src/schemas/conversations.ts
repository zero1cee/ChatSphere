import { z } from 'zod';

export const conversationTypeSchema = z.enum(['DIRECT', 'GROUP']);
export const memberRoleSchema = z.enum(['OWNER', 'ADMIN', 'MEMBER']);

const uniqueIdsSchema = z
  .array(z.uuid())
  .min(1)
  .max(49)
  .refine((ids) => new Set(ids).size === ids.length, {
    message: 'Member IDs must be unique.',
  });

export const createConversationSchema = z.discriminatedUnion('type', [
  z
    .object({
      type: z.literal('DIRECT'),
      userId: z.uuid(),
    })
    .strict(),
  z
    .object({
      type: z.literal('GROUP'),
      title: z.string().trim().min(1, 'Group name is required.').max(100),
      memberIds: uniqueIdsSchema,
    })
    .strict(),
]);

export const updateConversationSchema = z
  .object({
    title: z.string().trim().min(1, 'Group name is required.').max(100),
  })
  .strict();

export const addConversationMembersSchema = z
  .object({
    userIds: uniqueIdsSchema,
  })
  .strict();

export const updateMemberRoleSchema = z
  .object({
    role: memberRoleSchema,
  })
  .strict();

export type CreateConversationInput = z.infer<typeof createConversationSchema>;
export type UpdateConversationInput = z.infer<typeof updateConversationSchema>;
export type AddConversationMembersInput = z.infer<typeof addConversationMembersSchema>;
export type UpdateMemberRoleInput = z.infer<typeof updateMemberRoleSchema>;
