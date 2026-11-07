import type { NotificationListData } from '@chatsphere/shared';

import { apiRequest } from '@/lib/api-client';

export function fetchNotifications(): Promise<NotificationListData> {
  return apiRequest<NotificationListData>('/api/notifications');
}

export function markNotificationsReadRequest(
  conversationId?: string,
): Promise<{ updated: number }> {
  return apiRequest<{ updated: number }>('/api/notifications/read', {
    method: 'POST',
    body: conversationId ? { conversationId } : {},
  });
}

export function markNotificationReadRequest(notificationId: string): Promise<{ read: true }> {
  return apiRequest<{ read: true }>(`/api/notifications/${notificationId}/read`, {
    method: 'POST',
  });
}
