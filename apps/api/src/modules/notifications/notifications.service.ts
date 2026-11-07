import type { MessageDTO, NotificationListData } from '@chatsphere/shared';

import type { Prisma } from '../../generated/prisma/client.js';
import { AppError } from '../../lib/errors.js';
import { prisma } from '../../lib/prisma.js';
import { emitToUsers } from '../../realtime/events.js';
import { buildMessageNotificationPayload, toNotificationDTO } from './notifications.mapper.js';

export async function createMessageNotifications(input: {
  memberIds: string[];
  senderId: string;
  senderName: string;
  message: MessageDTO;
}): Promise<void> {
  const recipients = input.memberIds.filter((memberId) => memberId !== input.senderId);

  if (recipients.length === 0) {
    return;
  }

  const conversation = await prisma.conversation.findUnique({
    where: { id: input.message.conversationId },
    select: { title: true, type: true },
  });

  if (!conversation) {
    return;
  }

  const conversationTitle =
    conversation.type === 'GROUP' ? conversation.title || 'Group conversation' : input.senderName;
  const payload = buildMessageNotificationPayload(
    conversationTitle,
    input.message,
    input.senderName,
  );

  const notifications = await prisma.notification.createManyAndReturn({
    data: recipients.map((userId) => ({
      userId,
      type: 'MESSAGE',
      conversationId: input.message.conversationId,
      payload: payload as unknown as Prisma.InputJsonValue,
    })),
  });

  for (const notification of notifications) {
    emitToUsers([notification.userId], 'notification:new', {
      notification: toNotificationDTO(notification),
    });
  }
}

export async function listNotifications(userId: string): Promise<NotificationListData> {
  const [notifications, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    }),
    prisma.notification.count({
      where: { userId, readAt: null },
    }),
  ]);

  return {
    notifications: notifications.map(toNotificationDTO),
    unreadCount,
  };
}

export async function markNotificationsRead(
  userId: string,
  conversationId?: string,
): Promise<number> {
  const result = await prisma.notification.updateMany({
    where: {
      userId,
      readAt: null,
      ...(conversationId ? { conversationId } : {}),
    },
    data: { readAt: new Date() },
  });

  return result.count;
}

export async function markNotificationRead(userId: string, notificationId: string): Promise<void> {
  const result = await prisma.notification.updateMany({
    where: { id: notificationId, userId, readAt: null },
    data: { readAt: new Date() },
  });

  if (result.count === 0) {
    const exists = await prisma.notification.findFirst({
      where: { id: notificationId, userId },
      select: { id: true },
    });

    if (!exists) {
      throw new AppError(404, 'NOTIFICATION_NOT_FOUND', 'Notification not found.');
    }
  }
}

export async function createMembershipNotifications(input: {
  userIds: string[];
  type: 'GROUP_ADDED' | 'GROUP_REMOVED' | 'GROUP_ROLE_CHANGED';
  conversationId: string;
  conversationTitle: string;
  actorName: string;
  role?: string;
}): Promise<void> {
  if (input.userIds.length === 0) {
    return;
  }

  const payload = {
    conversationId: input.conversationId,
    conversationTitle: input.conversationTitle,
    actorName: input.actorName,
    ...(input.role ? { role: input.role } : {}),
  };

  const notifications = await prisma.notification.createManyAndReturn({
    data: input.userIds.map((userId) => ({
      userId,
      type: input.type,
      conversationId: input.conversationId,
      payload: payload as unknown as Prisma.InputJsonValue,
    })),
  });

  for (const notification of notifications) {
    emitToUsers([notification.userId], 'notification:new', {
      notification: toNotificationDTO(notification),
    });
  }
}
