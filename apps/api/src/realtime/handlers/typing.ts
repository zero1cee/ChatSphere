import type {
  ClientToServerEvents,
  InterServerEvents,
  ServerToClientEvents,
  SocketData,
} from '@chatsphere/shared';
import { conversationRoomSchema } from '@chatsphere/shared';
import type { Socket } from 'socket.io';

import { conversationRoom } from '../rooms.js';

type ChatSocket = Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;

const TYPING_WINDOW_MS = 5_000;
const TYPING_LIMIT = 8;

function withinTypingRateLimit(socket: ChatSocket): boolean {
  const now = Date.now();
  const timestamps = (socket.data.typingTimestamps ?? []).filter(
    (timestamp) => now - timestamp < TYPING_WINDOW_MS,
  );

  if (timestamps.length >= TYPING_LIMIT) {
    socket.data.typingTimestamps = timestamps;
    return false;
  }

  timestamps.push(now);
  socket.data.typingTimestamps = timestamps;
  return true;
}

export function registerTypingHandlers(socket: ChatSocket): void {
  socket.on('typing:start', (input) => {
    if (!socket.data.auth || !socket.data.joinedConversationIds?.has(input.conversationId)) {
      return;
    }

    try {
      const { conversationId } = conversationRoomSchema.parse(input);

      if (!withinTypingRateLimit(socket)) {
        return;
      }

      socket.to(conversationRoom(conversationId)).emit('typing:updated', {
        conversationId,
        userId: socket.data.auth.userId,
        name: socket.data.auth.name,
        isTyping: true,
      });
    } catch {
      // Ignore malformed typing events.
    }
  });

  socket.on('typing:stop', (input) => {
    if (!socket.data.auth || !socket.data.joinedConversationIds?.has(input.conversationId)) {
      return;
    }

    try {
      const { conversationId } = conversationRoomSchema.parse(input);
      socket.to(conversationRoom(conversationId)).emit('typing:updated', {
        conversationId,
        userId: socket.data.auth.userId,
        name: socket.data.auth.name,
        isTyping: false,
      });
    } catch {
      // Ignore malformed typing events.
    }
  });
}
