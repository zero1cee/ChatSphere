import type {
  ClientToServerEvents,
  InterServerEvents,
  PresenceState,
  ServerToClientEvents,
  SocketData,
} from '@chatsphere/shared';
import type { Server, Socket } from 'socket.io';

import { prisma } from '../lib/prisma.js';
import { userRoom } from './rooms.js';

type ChatServer = Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;
type ChatSocket = Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;

const socketsByUser = new Map<string, Set<string>>();

export function addOnlineSocket(userId: string, socketId: string): boolean {
  const sockets = socketsByUser.get(userId) ?? new Set<string>();
  const wasOffline = sockets.size === 0;
  sockets.add(socketId);
  socketsByUser.set(userId, sockets);

  return wasOffline;
}

export function removeOnlineSocket(userId: string, socketId: string): boolean {
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

export function isUserOnline(userId: string): boolean {
  return (socketsByUser.get(userId)?.size ?? 0) > 0;
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

  return users.map((user) => ({
    userId: user.id,
    online: isUserOnline(user.id),
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
): Promise<void> {
  const coMemberIds = await getCoMemberIds(userId);

  if (coMemberIds.length === 0) {
    return;
  }

  io.to(coMemberIds.map(userRoom)).emit('presence:updated', {
    userId,
    online,
    lastSeenAt,
  });
}

export async function markUserOffline(io: ChatServer, userId: string): Promise<void> {
  const lastSeenAt = new Date();
  await prisma.user.update({
    where: { id: userId },
    data: { lastSeenAt },
  });
  await broadcastPresence(io, userId, false, lastSeenAt.toISOString());
}
