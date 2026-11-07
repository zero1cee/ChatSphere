import type { Server as HttpServer } from 'node:http';

import type {
  ClientToServerEvents,
  InterServerEvents,
  ServerToClientEvents,
  SocketData,
} from '@chatsphere/shared';
import { Server } from 'socket.io';

import { env } from '../config/env.js';
import { logger } from '../lib/logger.js';
import { registerReceiptHandlers } from '../modules/messages/receipts.handlers.js';
import { registerUserEmitter } from './events.js';
import { registerConversationHandlers } from './handlers/conversations.js';
import { registerMessageHandlers } from './handlers/messages.js';
import { registerTypingHandlers } from './handlers/typing.js';
import {
  addOnlineSocket,
  broadcastPresence,
  getCoMemberIds,
  markUserOffline,
  removeOnlineSocket,
  sendPresenceSnapshot,
} from './presence.js';
import { sessionRoom, userRoom } from './rooms.js';
import { authenticateSocket } from './socket-auth.js';

export type ChatServer = Server<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>;

export function createSocketServer(httpServer: HttpServer): ChatServer {
  const io = new Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>(
    httpServer,
    {
      cors: {
        origin: env.WEB_ORIGIN,
        credentials: true,
      },
      connectionStateRecovery: {
        maxDisconnectionDuration: 2 * 60 * 1000,
      },
      maxHttpBufferSize: 1_000_000,
    },
  );

  registerUserEmitter((userIds, event, payload) => {
    (
      io.to(userIds.map(userRoom)) as unknown as {
        emit: (event: string, payload: unknown) => void;
      }
    ).emit(event, payload);
  });

  io.use(authenticateSocket);

  io.on('connection', (socket) => {
    const auth = socket.data.auth;

    if (!auth) {
      socket.disconnect(true);
      return;
    }

    void socket.join(userRoom(auth.userId));
    void socket.join(sessionRoom(auth.sessionId));

    registerConversationHandlers(socket);
    registerMessageHandlers(io, socket);
    registerTypingHandlers(socket);
    registerReceiptHandlers(io, socket);

    const wasOffline = addOnlineSocket(auth.userId, socket.id);

    void (async () => {
      const memberIds = await getCoMemberIds(auth.userId);

      if (wasOffline) {
        await broadcastPresence(io, auth.userId, true, null, memberIds);
      }

      await sendPresenceSnapshot(socket, memberIds);
    })().catch((error) => {
      logger.error({ err: error }, 'Presence update failed');
    });

    const expiresIn = Math.max(0, auth.expiresAt * 1000 - Date.now());
    const expiryTimer = setTimeout(() => {
      socket.emit('auth:expired');
      socket.disconnect(true);
    }, expiresIn);

    logger.debug(
      { socketId: socket.id, userId: auth.userId, recovered: socket.recovered },
      'Socket connected',
    );

    socket.on('disconnect', (reason) => {
      clearTimeout(expiryTimer);

      if (removeOnlineSocket(auth.userId, socket.id)) {
        void markUserOffline(io, auth.userId).catch((error) => {
          logger.error({ err: error }, 'Presence offline update failed');
        });
      }

      logger.debug({ socketId: socket.id, userId: auth.userId, reason }, 'Socket disconnected');
    });
  });

  return io;
}
