import type { MessageDTO, MessageListMeta, MessagePreviewDTO } from '@chatsphere/shared';
import type { Prisma } from '../../generated/prisma/client.js';

import { decodeMessageCursor, encodeMessageCursor } from '../../lib/cursor.js';
import { AppError } from '../../lib/errors.js';
import { prisma } from '../../lib/prisma.js';
import { isPrismaUniqueConstraintError } from '../../lib/prisma-errors.js';
import { messageInclude, toMessageDTO, toMessagePreviewDTO } from './messages.mapper.js';

export interface MessageHistoryOptions {
  before?: string;
  after?: string;
  limit?: number;
}

export interface MessageHistoryResult {
  messages: MessageDTO[];
  meta: MessageListMeta;
}

export interface CreateMessageInput {
  conversationId: string;
  senderId: string;
  clientMessageId: string;
  content?: string | null;
  attachmentIds?: string[];
  replyToId?: string;
}

export interface CreateMessageResult {
  message: MessageDTO;
  duplicate: boolean;
}

export interface MessageActionResult {
  message: MessageDTO;
  memberIds: string[];
}

interface MessageContext {
  id: string;
  conversationId: string;
  senderId: string;
  deletedAt: Date | null;
  conversation: {
    type: 'DIRECT' | 'GROUP';
    members: Array<{
      userId: string;
      role: 'OWNER' | 'ADMIN' | 'MEMBER';
    }>;
  };
}

export async function assertConversationMember(
  conversationId: string,
  userId: string,
): Promise<void> {
  const membership = await prisma.conversationMember.findUnique({
    where: {
      conversationId_userId: { conversationId, userId },
    },
    select: { id: true },
  });

  if (!membership) {
    throw new AppError(404, 'CONVERSATION_NOT_FOUND', 'Conversation not found.');
  }
}

export async function getConversationMemberIds(conversationId: string): Promise<string[]> {
  const members = await prisma.conversationMember.findMany({
    where: { conversationId },
    select: { userId: true },
  });

  return members.map((member) => member.userId);
}

export async function listMessages(
  conversationId: string,
  userId: string,
  options: MessageHistoryOptions,
): Promise<MessageHistoryResult> {
  await assertConversationMember(conversationId, userId);

  if (options.before && options.after) {
    throw new AppError(400, 'INVALID_CURSOR', 'Use either before or after, not both.');
  }

  const limit = options.limit ?? 30;
  const before = options.before ? decodeMessageCursor(options.before) : null;
  const after = options.after ? decodeMessageCursor(options.after) : null;
  const where: Prisma.MessageWhereInput = { conversationId };

  if (before) {
    where.OR = [
      { createdAt: { lt: before.createdAt } },
      { createdAt: before.createdAt, id: { lt: before.id } },
    ];
  }

  if (after) {
    where.OR = [
      { createdAt: { gt: after.createdAt } },
      { createdAt: after.createdAt, id: { gt: after.id } },
    ];
  }

  const descending = !after;
  const rows = await prisma.message.findMany({
    where,
    include: messageInclude,
    orderBy: descending
      ? [{ createdAt: 'desc' }, { id: 'desc' }]
      : [{ createdAt: 'asc' }, { id: 'asc' }],
    take: limit + 1,
  });

  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;

  if (descending) {
    page.reverse();
  }

  const messages = await Promise.all(page.map(toMessageDTO));
  const oldest = messages[0];
  const newest = messages[messages.length - 1];

  return {
    messages,
    meta: {
      hasMore,
      oldestCursor: oldest
        ? encodeMessageCursor({ createdAt: new Date(oldest.createdAt), id: oldest.id })
        : null,
      newestCursor: newest
        ? encodeMessageCursor({ createdAt: new Date(newest.createdAt), id: newest.id })
        : null,
    },
  };
}

export async function createMessage(input: CreateMessageInput): Promise<CreateMessageResult> {
  await assertConversationMember(input.conversationId, input.senderId);

  const content = input.content?.trim() ?? '';
  const attachmentIds = [...new Set(input.attachmentIds ?? [])];

  if (content.length === 0 && attachmentIds.length === 0) {
    throw new AppError(400, 'EMPTY_MESSAGE', 'Write a message or attach a file.');
  }

  if (content.length > 4000) {
    throw new AppError(400, 'MESSAGE_TOO_LONG', 'Messages can be at most 4000 characters.');
  }

  if (input.replyToId) {
    const reply = await prisma.message.findFirst({
      where: { id: input.replyToId, conversationId: input.conversationId },
      select: { id: true },
    });

    if (!reply) {
      throw new AppError(400, 'REPLY_NOT_FOUND', 'The message you replied to is unavailable.');
    }
  }

  const existing = await prisma.message.findUnique({
    where: {
      senderId_clientMessageId: {
        senderId: input.senderId,
        clientMessageId: input.clientMessageId,
      },
    },
    include: messageInclude,
  });

  if (existing) {
    return { message: await toMessageDTO(existing), duplicate: true };
  }

  try {
    const message = await prisma.$transaction(async (tx) => {
      const created = await tx.message.create({
        data: {
          conversationId: input.conversationId,
          senderId: input.senderId,
          clientMessageId: input.clientMessageId,
          content: content.length > 0 ? content : null,
          replyToId: input.replyToId ?? null,
        },
      });

      if (attachmentIds.length > 0) {
        const attached = await tx.messageAttachment.updateMany({
          where: {
            id: { in: attachmentIds },
            uploadedById: input.senderId,
            messageId: null,
          },
          data: { messageId: created.id },
        });

        if (attached.count !== attachmentIds.length) {
          throw new AppError(
            400,
            'ATTACHMENT_NOT_FOUND',
            'One or more attachments are unavailable. Upload them again.',
          );
        }
      }

      await tx.conversation.update({
        where: { id: input.conversationId },
        data: { updatedAt: new Date() },
      });

      return tx.message.findUniqueOrThrow({
        where: { id: created.id },
        include: messageInclude,
      });
    });

    return { message: await toMessageDTO(message), duplicate: false };
  } catch (error) {
    if (!isPrismaUniqueConstraintError(error)) {
      throw error;
    }

    const duplicate = await prisma.message.findUnique({
      where: {
        senderId_clientMessageId: {
          senderId: input.senderId,
          clientMessageId: input.clientMessageId,
        },
      },
      include: messageInclude,
    });

    if (!duplicate) {
      throw error;
    }

    return { message: await toMessageDTO(duplicate), duplicate: true };
  }
}

async function getMessageContext(messageId: string, userId: string): Promise<MessageContext> {
  const message = await prisma.message.findUnique({
    where: { id: messageId },
    select: {
      id: true,
      conversationId: true,
      senderId: true,
      deletedAt: true,
      conversation: {
        select: {
          type: true,
          members: {
            select: {
              userId: true,
              role: true,
            },
          },
        },
      },
    },
  });

  if (!message?.conversation.members.some((member) => member.userId === userId)) {
    throw new AppError(404, 'MESSAGE_NOT_FOUND', 'Message not found.');
  }

  return message;
}

async function reloadMessage(messageId: string, memberIds: string[]): Promise<MessageActionResult> {
  const message = await prisma.message.findUniqueOrThrow({
    where: { id: messageId },
    include: messageInclude,
  });

  return { message: await toMessageDTO(message), memberIds };
}

export async function editMessage(
  messageId: string,
  userId: string,
  content: string,
): Promise<MessageActionResult> {
  const context = await getMessageContext(messageId, userId);
  const memberIds = context.conversation.members.map((member) => member.userId);

  if (context.senderId !== userId) {
    throw new AppError(403, 'FORBIDDEN', 'You can only edit your own messages.');
  }

  if (context.deletedAt) {
    throw new AppError(409, 'MESSAGE_DELETED', 'Deleted messages cannot be edited.');
  }

  await prisma.message.update({
    where: { id: messageId },
    data: {
      content: content.trim(),
      editedAt: new Date(),
    },
  });

  return reloadMessage(messageId, memberIds);
}

export async function deleteMessage(
  messageId: string,
  userId: string,
): Promise<MessageActionResult> {
  const context = await getMessageContext(messageId, userId);
  const member = context.conversation.members.find((entry) => entry.userId === userId);
  const memberIds = context.conversation.members.map((entry) => entry.userId);

  if (!member) {
    throw new AppError(404, 'MESSAGE_NOT_FOUND', 'Message not found.');
  }

  const isModerator =
    context.conversation.type === 'GROUP' && (member.role === 'OWNER' || member.role === 'ADMIN');

  if (context.senderId !== userId && !isModerator) {
    throw new AppError(403, 'FORBIDDEN', 'You cannot delete this message.');
  }

  if (context.deletedAt) {
    throw new AppError(409, 'MESSAGE_DELETED', 'This message is already deleted.');
  }

  await prisma.message.update({
    where: { id: messageId },
    data: {
      content: null,
      deletedAt: new Date(),
    },
  });

  return reloadMessage(messageId, memberIds);
}

export async function addReaction(
  messageId: string,
  userId: string,
  emoji: string,
): Promise<MessageActionResult> {
  const context = await getMessageContext(messageId, userId);
  const memberIds = context.conversation.members.map((member) => member.userId);

  if (context.deletedAt) {
    throw new AppError(409, 'MESSAGE_DELETED', 'You cannot react to a deleted message.');
  }

  await prisma.messageReaction.upsert({
    where: {
      messageId_userId: { messageId, userId },
    },
    update: { emoji },
    create: { messageId, userId, emoji },
  });

  return reloadMessage(messageId, memberIds);
}

export async function removeReaction(
  messageId: string,
  userId: string,
  emoji: string,
): Promise<MessageActionResult> {
  const context = await getMessageContext(messageId, userId);
  const memberIds = context.conversation.members.map((member) => member.userId);

  await prisma.messageReaction.deleteMany({
    where: { messageId, userId, emoji },
  });

  return reloadMessage(messageId, memberIds);
}

export async function getConversationPreview(conversationId: string): Promise<{
  lastMessage: MessagePreviewDTO | null;
  updatedAt: string;
}> {
  const message = await prisma.message.findFirst({
    where: { conversationId },
    include: messageInclude,
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
  });
  const conversation = await prisma.conversation.findUniqueOrThrow({
    where: { id: conversationId },
    select: { updatedAt: true },
  });

  return {
    lastMessage: message ? toMessagePreviewDTO(await toMessageDTO(message)) : null,
    updatedAt: conversation.updatedAt.toISOString(),
  };
}
