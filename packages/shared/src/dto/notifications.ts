export type NotificationType = 'MESSAGE' | 'GROUP_ADDED' | 'GROUP_REMOVED' | 'GROUP_ROLE_CHANGED';

export interface NotificationPayload {
  conversationId?: string;
  conversationTitle?: string;
  actorName?: string;
  preview?: string;
  messageId?: string;
  role?: string;
}

export interface NotificationDTO {
  id: string;
  type: NotificationType;
  payload: NotificationPayload;
  conversationId: string | null;
  readAt: string | null;
  createdAt: string;
}

export interface NotificationListData {
  notifications: NotificationDTO[];
  unreadCount: number;
}
