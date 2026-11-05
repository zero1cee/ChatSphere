import type {
  Ack,
  ClientToServerEvents,
  InterServerEvents,
  ServerToClientEvents,
  SocketData,
} from '@chatsphere/shared';
import { conversationRoomSchema } from '@chatsphere/shared';
import type { Socket } from 'socket.io';

import { assertConversationMember } from '../../modules/messages/messages.service.js';
import { replyWithError } from '../ack.js';
import { conversationRoom } from '../rooms.js';

type ChatSocket = Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;

export function registerConversationHandlers(socket: ChatSocket): void {
  socket.on('conversation:join', async (input, ack: (response: Ack<{ joined: true }>) => void) => {
    if (!socket.data.auth) {
      ack({ ok: false, error: { code: 'AUTH_REQUIRED', message: 'Sign in to continue.' } });
      return;
    }

    try {
      const { conversationId } = conversationRoomSchema.parse(input);
      await assertConversationMember(conversationId, socket.data.auth.userId);
      await socket.join(conversationRoom(conversationId));
      socket.data.joinedConversationIds?.add(conversationId);
      ack({ ok: true, data: { joined: true } });
    } catch (error) {
      replyWithError(ack, error);
    }
  });

  socket.on('conversation:leave', async (input, ack: (response: Ack<null>) => void) => {
    try {
      const { conversationId } = conversationRoomSchema.parse(input);
      await socket.leave(conversationRoom(conversationId));
      socket.data.joinedConversationIds?.delete(conversationId);
      ack({ ok: true, data: null });
    } catch (error) {
      replyWithError(ack, error);
    }
  });
}
