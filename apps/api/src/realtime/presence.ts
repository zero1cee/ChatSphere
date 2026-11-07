import type {
  ClientToServerEvents,
  InterServerEvents,
  PresenceState,
  ServerToClientEvents,
  SocketData,
} from '@chatsphere/shared';
import type { Server, Socket } from 'socket.io';

import { logger } from '../lib/logger.js';
import { prisma } from '../lib/prisma.js';
import { getRedisClient } from '../lib/redis.js';
import { userRoom } from './rooms.js';

type ChatServer = Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;
type ChatSocket = Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;

const socketsByUser = new Map<string, Set<string>>();
const PRESENCE_TTL_SECONDS = 300;

function presenceKey(userId: string): string {
  return `chatsphere:presence:${userId}`;
}

function addLocalSocket(userId: string, socketId: string): boolean {
  const sockets = socketsByUser.get(userId) ?? new Set<string>();
  const wasOffline = sockets.size === 0;
  sockets.add(socketId);
  socketsByUser.set(userId, sockets);

  return wasOffline;
}

function removeLocalSocket(userId: string, socketId: string): boolean {
  const sockets = socketsByUser.get(userId);

  if (!sockets) {
    return false;
  }

  sockets.delete(socketId);

  if (sockets.size > 0) {
    return false;
  }

  socketsByUser.delete(userId);
  return true;
}

function isLocallyOnline(userId: string): boolean {
  return (socketsByUser.get(userId)?.size ?? 0) > 0;
}

export async function addOnlineSocket(userId: string, socketId: string): Promise<boolean> {
  const locallyOffline = addLocalSocket(userId, socketId);
  const redis = getRedisClient();

  if (!redis) {
    return locallyOffline;
  }

  try {
    const key = presenceKey(userId);
    await redis.sAdd(key, socketId);
    await redis.expire(key, PRESENCE_TTL_SECONDS);
    const count = await redis.sCard(key);
    return count === 1;
  } catch (error) {
    logger.error({ err: error }, 'Redis presence add failed');
    return locallyOffline;
  }
}

export async function removeOnlineSocket(userId: string, socketId: string): Promise<boolean> {
  const locallyOffline = removeLocalSocket(userId, socketId);
  const redis = getRedisClient();

  if (!redis) {
    return locallyOffline;
  }

  try {
    const key = presenceKey(userId);
    await redis.sRem(key, socketId);
    const count = await redis.sCard(key);

    if (count === 0) {
      await redis.del(key);
      return true;
    }

    return false;
  } catch (error) {
    logger.error({ err: error }, 'Redis presence remove failed');
    return locallyOffline;
  }
}

export async function refreshPresence(userId: string, socketId: string): Promise<void> {
  const redis = getRedisClient();

  if (!redis) {
    return;
  }

  try {
    const key = presenceKey(userId);
    await redis.sAdd(key, socketId);
    await redis.expire(key, PRESENCE_TTL_SECONDS);
  } catch (error) {
    logger.error({ err: error }, 'Redis presence refresh failed');
  }
}

export async function isUserOnline(userId: string): Promise<boolean> {
  const redis = getRedisClient();

  if (!redis) {
    return isLocallyOnline(userId);
  }

  try {
    return (await redis.sCard(presenceKey(userId))) > 0;
  } catch (error) {
    logger.error({ err: error }, 'Redis presence lookup failed');
    return isLocallyOnline(userId);
  }
}

export async function getCoMemberIds(userId: string): Promise<string[]> {
  const memberships = await prisma.conversationMember.findMany({
    where: { userId },
    select: { conversationId: true },
  });

  if (memberships.length === 0) {
    return [];
  }

  const coMembers = await prisma.conversationMember.findMany({
    where: {
      conversationId: { in: memberships.map((membership) => membership.conversationId) },
      userId: { not: userId },
    },
    select: { userId: true },
    distinct: ['userId'],
  });

  return coMembers.map((member) => member.userId);
}

export async function getPresenceStates(userIds: string[]): Promise<PresenceState[]> {
  if (userIds.length === 0) {
    return [];
  }

  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, lastSeenAt: true },
  });
  const events = await Promise.all(users.map((user) => isUserOnline(user.id)));

  return users.map((user, index) => ({
    userId: user.id,
    online: events[index] ?? false,
    lastSeenAt: user.lastSeenAt?.toISOString() ?? null,
  }));
}

export async function sendPresenceSnapshot(socket: ChatSocket, userIds: string[]): Promise<void> {
  const states = await getPresenceStates(userIds);
  socket.emit('presence:snapshot', { users: states });
}

export async function broadcastPresence(
  io: ChatServer,
  userId: string,
  online: boolean,
  lastSeenAt: string | null,
  coMemberIds?: string[],
): Promise<void> {
  const recipients = coMemberIds ?? (await getCoMemberIds(userId));

  if (recipients.length === 0) {
    return;
  }

  io.to(recipients.map(userRoom)).emit('presence:updated', {
    userId,
    online,
    lastSeenAt,
  });
}

export async function markUserOffline(io: ChatServer, userId: string): Promise<void> {
  const lastSeenAt = new Date();

  try {
    await prisma.user.update({
      where: { id: userId },
      data: { lastSeenAt },
    });
  } catch (error) {
    logger.error({ err: error }, 'Could not persist last-seen timestamp');
  }

  await broadcastPresence(io, userId, false, lastSeenAt.toISOString());
}
