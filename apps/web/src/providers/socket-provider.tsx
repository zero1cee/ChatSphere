'use client';

import type {
  ClientToServerEvents,
  ConversationData,
  ConversationListData,
  ConversationUpdatedEvent,
  ServerToClientEvents,
} from '@chatsphere/shared';
import { useQueryClient } from '@tanstack/react-query';
import { createContext, type ReactNode, useContext, useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';

import { conversationKeys } from '@/features/conversations/queries';
import { messageKeys } from '@/features/messages/queries';
import { API_BASE_URL, refreshSession } from '@/lib/api-client';
import { useAuthStore } from '@/stores/auth-store';

export type ChatSocket = Socket<ServerToClientEvents, ClientToServerEvents>;
type SocketStatus = 'connecting' | 'connected' | 'disconnected';

interface SocketContextValue {
  socket: ChatSocket | null;
  status: SocketStatus;
}

const SocketContext = createContext<SocketContextValue>({
  socket: null,
  status: 'connecting',
});

const SOCKET_URL = (process.env.NEXT_PUBLIC_SOCKET_URL ?? API_BASE_URL).replace(/\/$/, '');

export function useSocket(): SocketContextValue {
  return useContext(SocketContext);
}

export function SocketProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [socket, setSocket] = useState<ChatSocket | null>(null);
  const [status, setStatus] = useState<SocketStatus>('connecting');
  const recoveryInFlight = useRef<Promise<void> | null>(null);

  useEffect(() => {
    let stopped = false;
    let recoveryAttempted = false;
    const instance: ChatSocket = io(SOCKET_URL, {
      autoConnect: false,
      withCredentials: true,
      auth: (callback) => {
        callback({ token: useAuthStore.getState().accessToken });
      },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 500,
      reconnectionDelayMax: 5_000,
    });

    setSocket(instance);
    setStatus('connecting');

    const recoverSession = (): Promise<void> => {
      if (recoveryInFlight.current) {
        return recoveryInFlight.current;
      }

      if (recoveryAttempted) {
        return Promise.resolve();
      }

      recoveryAttempted = true;

      const recovery = (async () => {
        const session = await refreshSession();

        if (stopped) {
          return;
        }

        if (!session) {
          setStatus('disconnected');
          return;
        }

        instance.auth = { token: session.accessToken };

        if (!instance.connected) {
          instance.connect();
        }
      })().finally(() => {
        recoveryInFlight.current = null;
      });

      recoveryInFlight.current = recovery;
      return recovery;
    };

    const handleConnect = () => {
      if (stopped) {
        return;
      }

      recoveryAttempted = false;
      setStatus('connected');
      void queryClient.invalidateQueries({ queryKey: conversationKeys.all });
      void queryClient.invalidateQueries({ queryKey: messageKeys.all });
    };

    const handleDisconnect = (reason: string) => {
      if (stopped) {
        return;
      }

      setStatus('disconnected');

      if (reason === 'io server disconnect') {
        void recoverSession();
      }
    };

    const handleConnectError = (error: Error & { data?: { code?: string } }) => {
      if (stopped) {
        return;
      }

      setStatus('disconnected');
      const code = error.data?.code;

      if (code === 'AUTH_EXPIRED' || code === 'AUTH_REQUIRED' || code === 'EMAIL_NOT_VERIFIED') {
        void recoverSession();
      }
    };

    const handleAuthExpired = () => {
      recoveryAttempted = false;
      void recoverSession();
    };

    const handleConversationUpdated = (payload: ConversationUpdatedEvent) => {
      const list = queryClient.getQueryData<ConversationListData>(conversationKeys.all);

      if (list) {
        const index = list.conversations.findIndex(
          (conversation) => conversation.id === payload.conversationId,
        );

        if (index >= 0) {
          const conversations = [...list.conversations];
          conversations[index] = {
            ...conversations[index],
            lastMessage: payload.lastMessage,
            updatedAt: payload.updatedAt,
          };
          conversations.sort((first, second) => second.updatedAt.localeCompare(first.updatedAt));
          queryClient.setQueryData<ConversationListData>(conversationKeys.all, { conversations });
        } else {
          void queryClient.invalidateQueries({ queryKey: conversationKeys.all });
        }
      }

      queryClient.setQueryData<ConversationData>(
        conversationKeys.detail(payload.conversationId),
        (current) =>
          current
            ? {
                conversation: {
                  ...current.conversation,
                  lastMessage: payload.lastMessage,
                  updatedAt: payload.updatedAt,
                },
              }
            : current,
      );
    };

    instance.on('connect', handleConnect);
    instance.on('disconnect', handleDisconnect);
    instance.on('connect_error', handleConnectError);
    instance.on('auth:expired', handleAuthExpired);
    instance.on('conversation:updated', handleConversationUpdated);
    instance.connect();

    return () => {
      stopped = true;
      instance.removeAllListeners();
      instance.disconnect();
      setSocket(null);
    };
  }, [queryClient]);

  return <SocketContext.Provider value={{ socket, status }}>{children}</SocketContext.Provider>;
}
