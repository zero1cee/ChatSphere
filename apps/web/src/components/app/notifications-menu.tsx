'use client';

import type { NotificationDTO } from '@chatsphere/shared';
import { Bell, CheckCheck, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  useMarkNotificationRead,
  useMarkNotificationsRead,
  useNotifications,
} from '@/features/notifications/queries';
import { formatConversationTime } from '@/lib/format-time';
import { cn } from '@/lib/utils';

function notificationText(notification: NotificationDTO): string {
  const payload = notification.payload;

  switch (notification.type) {
    case 'MESSAGE':
      return payload.actorName
        ? `${payload.actorName}: ${payload.preview ?? 'New message'}`
        : (payload.preview ?? 'New message');
    case 'GROUP_ADDED':
      return `You were added to ${payload.conversationTitle ?? 'a group'}.`;
    case 'GROUP_REMOVED':
      return `You were removed from ${payload.conversationTitle ?? 'a group'}.`;
    case 'GROUP_ROLE_CHANGED':
      return payload.role
        ? `Your role in ${payload.conversationTitle ?? 'a group'} is now ${payload.role.toLowerCase()}.`
        : `Your role in ${payload.conversationTitle ?? 'a group'} changed.`;
    default:
      return 'New notification';
  }
}

export function NotificationsMenu() {
  const router = useRouter();
  const notificationsQuery = useNotifications();
  const markAllRead = useMarkNotificationsRead();
  const markOneRead = useMarkNotificationRead();
  const [open, setOpen] = useState(false);

  const unreadCount = notificationsQuery.data?.unreadCount ?? 0;
  const notifications = notificationsQuery.data?.notifications ?? [];

  const handleOpenNotification = (notification: NotificationDTO) => {
    if (!notification.readAt) {
      markOneRead.mutate(notification.id);
    }

    if (notification.conversationId) {
      setOpen(false);
      router.push(`/chats/${notification.conversationId}`);
    }
  };

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="relative size-9 rounded-full text-muted-foreground"
        aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ''}`}
        title="Notifications"
        onClick={() => setOpen(true)}
      >
        <Bell className="size-4" aria-hidden="true" />
        {unreadCount > 0 ? (
          <span className="absolute right-1 top-1 grid min-w-4 place-items-center rounded-full bg-primary px-1 text-[0.55rem] font-semibold leading-4 text-primary-foreground">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        ) : null}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Notifications</DialogTitle>
            <DialogDescription>
              Messages and group updates that need your attention.
            </DialogDescription>
          </DialogHeader>

          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="xs"
              disabled={unreadCount === 0 || markAllRead.isPending}
              onClick={() =>
                markAllRead.mutate(undefined, {
                  onError: () => toast.error('Notifications could not be marked read.'),
                })
              }
            >
              <CheckCheck className="size-3.5" aria-hidden="true" />
              Mark all read
            </Button>
          </div>

          {notificationsQuery.isLoading ? (
            <div className="flex justify-center py-10" role="status">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
              <span className="sr-only">Loading notifications</span>
            </div>
          ) : notifications.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border/70 px-4 py-10 text-center">
              <Bell className="mx-auto size-5 text-muted-foreground" aria-hidden="true" />
              <p className="mt-3 text-sm font-medium">No notifications yet</p>
              <p className="mt-1 text-xs text-muted-foreground">
                New messages and group updates will appear here.
              </p>
            </div>
          ) : (
            <ul className="space-y-1">
              {notifications.map((notification) => (
                <li key={notification.id}>
                  <button
                    type="button"
                    onClick={() => handleOpenNotification(notification)}
                    disabled={!notification.conversationId}
                    className={cn(
                      'w-full rounded-xl border px-3 py-2.5 text-left transition-colors',
                      notification.readAt
                        ? 'border-transparent bg-transparent hover:bg-muted/60'
                        : 'border-primary/15 bg-primary/5 hover:bg-primary/10',
                      !notification.conversationId && 'cursor-default',
                    )}
                  >
                    <span className="flex items-start gap-2">
                      {!notification.readAt ? (
                        <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" />
                      ) : (
                        <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-transparent" />
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm leading-snug">
                          {notificationText(notification)}
                        </span>
                        <span className="mt-1 block text-[0.65rem] text-muted-foreground">
                          {notification.payload.conversationTitle &&
                          notification.payload.conversationTitle !== notification.payload.actorName
                            ? `${notification.payload.conversationTitle} · `
                            : ''}
                          {formatConversationTime(notification.createdAt)}
                        </span>
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
