import type { MessageDTO, MessageListMeta } from '@chatsphere/shared';
import type { Prisma } from '../../generated/prisma/client.js';

import { decodeMessageCursor, encodeMessageCursor } from '../../lib/cursor.js';
import { AppError } from '../../lib/errors.js';
import { prisma } from '../../lib/prisma.js';
import { isPrismaUniqueConstraintError } from '../../lib/prisma-errors.js';
import { messageInclude, toMessageDTO } from './messages.mapper.js';

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
  content: string;
}

export interface CreateMessageResult {
  message: MessageDTO;
  duplicate: boolean;
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

  const messages = page.map(toMessageDTO);
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

  const content = input.content.trim();

  if (content.length === 0) {
    throw new AppError(400, 'EMPTY_MESSAGE', 'Write a message before sending.');
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
    return { message: toMessageDTO(existing), duplicate: true };
  }

  try {
    const message = await prisma.$transaction(async (tx) => {
      const created = await tx.message.create({
        data: {
          conversationId: input.conversationId,
          senderId: input.senderId,
          clientMessageId: input.clientMessageId,
          content,
        },
        include: messageInclude,
      });

      await tx.conversation.update({
        where: { id: input.conversationId },
        data: { updatedAt: new Date() },
      });

      return created;
    });

    return { message: toMessageDTO(message), duplicate: false };
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

    return { message: toMessageDTO(duplicate), duplicate: true };
  }
}
