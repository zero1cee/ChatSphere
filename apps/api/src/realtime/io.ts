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
import { registerConversationHandlers } from './handlers/conversations.js';
import { registerMessageHandlers } from './handlers/messages.js';
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
      logger.debug({ socketId: socket.id, userId: auth.userId, reason }, 'Socket disconnected');
    });
  });

  return io;
}
