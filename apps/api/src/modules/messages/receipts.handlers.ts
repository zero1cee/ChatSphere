import type {
  Ack,
  ClientToServerEvents,
  InterServerEvents,
  ReceiptUpdate,
  ServerToClientEvents,
  SocketData,
} from '@chatsphere/shared';
import { messageReferenceSchema } from '@chatsphere/shared';
import type { Server, Socket } from 'socket.io';
import { replyWithError } from '../../realtime/ack.js';
import { userRoom } from '../../realtime/rooms.js';
import { getConversationMemberIds } from './messages.service.js';
import { markMessageDelivered, markMessageRead } from './receipts.service.js';

type ChatServer = Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;
type ChatSocket = Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;

function registerReceiptEvent(
  io: ChatServer,
  socket: ChatSocket,
  event: 'message:delivered' | 'message:read',
  mark: (input: {
    conversationId: string;
    userId: string;
    messageId: string;
  }) => Promise<ReceiptUpdate>,
): void {
  socket.on(event, async (input, ack: (response: Ack<null>) => void) => {
    if (!socket.data.auth) {
      ack({ ok: false, error: { code: 'AUTH_REQUIRED', message: 'Sign in to continue.' } });
      return;
    }

    try {
      const parsed = messageReferenceSchema.parse(input);
      const receipt = await mark({ ...parsed, userId: socket.data.auth.userId });
      const memberIds = await getConversationMemberIds(parsed.conversationId);
      io.to(memberIds.map(userRoom)).emit('receipt:updated', receipt);
      ack({ ok: true, data: null });
    } catch (error) {
      replyWithError(ack, error);
    }
  });
}

export function registerReceiptHandlers(io: ChatServer, socket: ChatSocket): void {
  registerReceiptEvent(io, socket, 'message:delivered', markMessageDelivered);
  registerReceiptEvent(io, socket, 'message:read', markMessageRead);
}
