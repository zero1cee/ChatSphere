import { z } from 'zod';

export const sendMessageSchema = z
  .object({
    conversationId: z.uuid(),
    clientMessageId: z.uuid(),
    content: z
      .string()
      .trim()
      .min(1, 'Write a message before sending.')
      .max(4000, 'Messages can be at most 4000 characters.'),
  })
  .strict();

export const conversationRoomSchema = z
  .object({
    conversationId: z.uuid(),
  })
  .strict();

export type SendMessageInput = z.infer<typeof sendMessageSchema>;
