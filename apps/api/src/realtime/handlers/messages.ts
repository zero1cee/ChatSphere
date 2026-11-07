import type {
  Ack,
  ClientToServerEvents,
  ConversationUpdatedEvent,
  InterServerEvents,
  MessageDTO,
  ServerToClientEvents,
  SocketData,
} from '@chatsphere/shared';
import { sendMessageSchema } from '@chatsphere/shared';
import type { Server, Socket } from 'socket.io';
import { logger } from '../../lib/logger.js';
import { toMessagePreviewDTO } from '../../modules/messages/messages.mapper.js';
import {
  createMessage,
  getConversationMemberIds,
} from '../../modules/messages/messages.service.js';
import { createMessageNotifications } from '../../modules/notifications/notifications.service.js';
import { replyWithError } from '../ack.js';
import { userRoom } from '../rooms.js';

type ChatServer = Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;
type ChatSocket = Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;

const MESSAGE_WINDOW_MS = 10_000;
const MESSAGE_LIMIT = 20;

function withinMessageRateLimit(socket: ChatSocket): boolean {
  const now = Date.now();
  const timestamps = (socket.data.messageTimestamps ?? []).filter(
    (timestamp) => now - timestamp < MESSAGE_WINDOW_MS,
  );

  if (timestamps.length >= MESSAGE_LIMIT) {
    socket.data.messageTimestamps = timestamps;
    return false;
  }

  timestamps.push(now);
  socket.data.messageTimestamps = timestamps;
  return true;
}

export function registerMessageHandlers(io: ChatServer, socket: ChatSocket): void {
  socket.on(
    'message:send',
    async (input, ack: (response: Ack<{ message: MessageDTO; duplicate: boolean }>) => void) => {
      if (!socket.data.auth) {
        ack({ ok: false, error: { code: 'AUTH_REQUIRED', message: 'Sign in to continue.' } });
        return;
      }

      if (!withinMessageRateLimit(socket)) {
        ack({
          ok: false,
          error: {
            code: 'RATE_LIMITED',
            message: 'You are sending messages too quickly. Slow down for a moment.',
          },
        });
        return;
      }

      try {
        const parsed = sendMessageSchema.parse(input);
        const { message, duplicate } = await createMessage({
          conversationId: parsed.conversationId,
          senderId: socket.data.auth.userId,
          clientMessageId: parsed.clientMessageId,
          content: parsed.content,
          attachmentIds: parsed.attachmentIds,
          replyToId: parsed.replyToId,
        });

        if (!duplicate) {
          const memberIds = await getConversationMemberIds(parsed.conversationId);
          const memberRooms = memberIds.map(userRoom);
          const conversationUpdated: ConversationUpdatedEvent = {
            conversationId: parsed.conversationId,
            updatedAt: message.createdAt,
            lastMessage: toMessagePreviewDTO(message),
          };

          io.to(memberRooms).emit('message:new', { message });
          io.to(memberRooms).emit('conversation:updated', conversationUpdated);

          await createMessageNotifications({
            memberIds,
            senderId: socket.data.auth.userId,
            senderName: socket.data.auth.name,
            message,
          }).catch((error) => {
            logger.error({ err: error }, 'Message notification creation failed');
          });
        }

        ack({ ok: true, data: { message, duplicate } });
      } catch (error) {
        replyWithError(ack, error);
      }
    },
  );
}
