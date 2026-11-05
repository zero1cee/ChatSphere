import type {
  ClientToServerEvents,
  InterServerEvents,
  ServerToClientEvents,
  SocketData,
} from '@chatsphere/shared';
import type { Socket } from 'socket.io';
import { verifyAccessToken } from '../lib/jwt.js';
import { logger } from '../lib/logger.js';
import { prisma } from '../lib/prisma.js';

type AuthSocket = Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;

function authError(code: string, message: string): Error {
  const error = new Error(message) as Error & { data?: { code: string } };
  error.data = { code };
  return error;
}

export async function authenticateSocket(
  socket: AuthSocket,
  next: (error?: Error) => void,
): Promise<void> {
  const token = socket.handshake.auth?.token;

  if (typeof token !== 'string' || token.length === 0) {
    next(authError('AUTH_REQUIRED', 'Sign in to connect.'));
    return;
  }

  try {
    const payload = await verifyAccessToken(token);

    const session = await prisma.refreshSession.findUnique({
      where: { id: payload.sessionId },
      select: { revokedAt: true, expiresAt: true },
    });

    if (!session || session.revokedAt || session.expiresAt <= new Date()) {
      next(authError('AUTH_EXPIRED', 'Your session has expired. Sign in again.'));
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { emailVerifiedAt: true },
    });

    if (!user) {
      next(authError('AUTH_REQUIRED', 'This account no longer exists.'));
      return;
    }

    if (!user.emailVerifiedAt) {
      next(authError('EMAIL_NOT_VERIFIED', 'Verify your email before connecting.'));
      return;
    }

    socket.data.auth = payload;
    socket.data.joinedConversationIds = new Set();
    socket.data.messageTimestamps = [];
    next();
  } catch (error) {
    logger.debug({ err: error }, 'Rejected socket authentication');
    next(authError('AUTH_EXPIRED', 'Your session has expired. Sign in again.'));
  }
}
