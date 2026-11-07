import { z } from 'zod';

export const sendMessageSchema = z
  .object({
    conversationId: z.uuid(),
    clientMessageId: z.uuid(),
    content: z.string().trim().max(4000, 'Messages can be at most 4000 characters.').optional(),
    attachmentIds: z.array(z.uuid()).max(5, 'A message can have at most 5 attachments.').optional(),
    replyToId: z.uuid().optional(),
  })
  .strict()
  .refine(
    (value) => Boolean(value.content) || (value.attachmentIds?.length ?? 0) > 0,
    'Write a message or attach a file.',
  );

export const editMessageSchema = z
  .object({
    content: z.string().trim().min(1, 'Write a message.').max(4000),
  })
  .strict();

export const reactionSchema = z
  .object({
    emoji: z.string().trim().min(1).max(32),
  })
  .strict();

export const messageReferenceSchema = z
  .object({
    conversationId: z.uuid(),
    messageId: z.uuid(),
  })
  .strict();

export const conversationRoomSchema = z
  .object({
    conversationId: z.uuid(),
  })
  .strict();

export const notificationReadSchema = z
  .object({
    conversationId: z.uuid().optional(),
  })
  .strict();

export type SendMessageInput = z.infer<typeof sendMessageSchema>;
