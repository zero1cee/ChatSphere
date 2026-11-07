import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  fetchNotifications,
  markNotificationReadRequest,
  markNotificationsReadRequest,
} from './api';

export const notificationKeys = {
  all: ['notifications'] as const,
};

export function useNotifications() {
  return useQuery({
    queryKey: notificationKeys.all,
    queryFn: fetchNotifications,
    staleTime: 15_000,
  });
}

export function useMarkNotificationsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (conversationId?: string) => markNotificationsReadRequest(conversationId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: notificationKeys.all });
    },
  });
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (notificationId: string) => markNotificationReadRequest(notificationId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: notificationKeys.all });
    },
  });
}
