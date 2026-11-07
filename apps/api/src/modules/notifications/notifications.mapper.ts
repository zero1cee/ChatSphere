import type {
  MessageDTO,
  NotificationDTO,
  NotificationPayload,
  NotificationType,
} from '@chatsphere/shared';

export interface NotificationRecord {
  id: string;
  type: string;
  payload: unknown;
  conversationId: string | null;
  readAt: Date | null;
  createdAt: Date;
}

function payloadFrom(value: unknown): NotificationPayload {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  return value as NotificationPayload;
}

export function toNotificationDTO(notification: NotificationRecord): NotificationDTO {
  return {
    id: notification.id,
    type: notification.type as NotificationType,
    payload: payloadFrom(notification.payload),
    conversationId: notification.conversationId,
    readAt: notification.readAt?.toISOString() ?? null,
    createdAt: notification.createdAt.toISOString(),
  };
}

export function buildMessageNotificationPayload(
  conversationTitle: string,
  message: MessageDTO,
  senderName: string,
): NotificationPayload {
  const preview = message.content
    ? message.content.replace(/\s+/g, ' ').slice(0, 140)
    : message.attachments.length > 0
      ? 'Attachment'
      : 'New message';

  return {
    conversationId: message.conversationId,
    conversationTitle,
    actorName: senderName,
    preview,
    messageId: message.id,
  };
}
