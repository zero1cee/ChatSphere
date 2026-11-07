import type { ReceiptUpdate } from '@chatsphere/shared';

import { AppError } from '../../lib/errors.js';
import { prisma } from '../../lib/prisma.js';

async function assertMessageInConversation(
  conversationId: string,
  userId: string,
  messageId: string,
): Promise<void> {
  const membership = await prisma.conversationMember.findUnique({
    where: { conversationId_userId: { conversationId, userId } },
    select: { id: true },
  });

  if (!membership) {
    throw new AppError(404, 'MESSAGE_NOT_FOUND', 'Message not found.');
  }

  const message = await prisma.message.findFirst({
    where: { id: messageId, conversationId },
    select: { id: true },
  });

  if (!message) {
    throw new AppError(404, 'MESSAGE_NOT_FOUND', 'Message not found.');
  }
}

export async function markMessageDelivered(input: {
  conversationId: string;
  userId: string;
  messageId: string;
}): Promise<ReceiptUpdate> {
  await assertMessageInConversation(input.conversationId, input.userId, input.messageId);
  const now = new Date();

  const member = await prisma.conversationMember.update({
    where: {
      conversationId_userId: {
        conversationId: input.conversationId,
        userId: input.userId,
      },
    },
    data: {
      lastDeliveredMessageId: input.messageId,
      lastDeliveredAt: now,
    },
    select: {
      lastDeliveredAt: true,
      lastReadAt: true,
    },
  });

  return {
    conversationId: input.conversationId,
    userId: input.userId,
    lastDeliveredAt: member.lastDeliveredAt?.toISOString() ?? null,
    lastReadAt: member.lastReadAt?.toISOString() ?? null,
  };
}

export async function markMessageRead(input: {
  conversationId: string;
  userId: string;
  messageId: string;
}): Promise<ReceiptUpdate> {
  await assertMessageInConversation(input.conversationId, input.userId, input.messageId);
  const now = new Date();

  const member = await prisma.conversationMember.update({
    where: {
      conversationId_userId: {
        conversationId: input.conversationId,
        userId: input.userId,
      },
    },
    data: {
      lastDeliveredMessageId: input.messageId,
      lastDeliveredAt: now,
      lastReadMessageId: input.messageId,
      lastReadAt: now,
    },
    select: {
      lastDeliveredAt: true,
      lastReadAt: true,
    },
  });

  await prisma.messageRead.upsert({
    where: { messageId_userId: { messageId: input.messageId, userId: input.userId } },
    update: { readAt: now },
    create: { messageId: input.messageId, userId: input.userId, readAt: now },
  });

  return {
    conversationId: input.conversationId,
    userId: input.userId,
    lastDeliveredAt: member.lastDeliveredAt?.toISOString() ?? null,
    lastReadAt: member.lastReadAt?.toISOString() ?? null,
  };
}
