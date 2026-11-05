import { randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';

import type {
  Ack,
  ClientToServerEvents,
  MessageDTO,
  ServerToClientEvents,
} from '@chatsphere/shared';
import { io as createSocketClient, type Socket } from 'socket.io-client';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { createApp } from '../../src/app.js';
import { prisma } from '../../src/lib/prisma.js';
import { createSocketServer } from '../../src/realtime/io.js';
import { resetDatabase } from '../helpers/db.js';
import { createVerifiedUser } from '../helpers/users.js';

type TestSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

const app = createApp();
let httpServer: ReturnType<typeof createServer>;
let io: ReturnType<typeof createSocketServer>;
let baseUrl: string;
const openSockets: TestSocket[] = [];

function connect(token: string): Promise<TestSocket> {
  return new Promise((resolve, reject) => {
    const socket: TestSocket = createSocketClient(baseUrl, {
      auth: { token },
      transports: ['websocket'],
      reconnection: false,
      forceNew: true,
    });

    openSockets.push(socket);
    const timeout = setTimeout(() => {
      socket.disconnect();
      reject(new Error('Socket connection timed out.'));
    }, 5_000);

    socket.once('connect', () => {
      clearTimeout(timeout);
      resolve(socket);
    });

    socket.once('connect_error', (error) => {
      clearTimeout(timeout);
      reject(error);
    });
  });
}

async function createDirectConversation(firstUserId: string, secondUserId: string) {
  return prisma.conversation.create({
    data: {
      type: 'DIRECT',
      directKey: [firstUserId, secondUserId].sort().join(':'),
      members: {
        create: [{ userId: firstUserId }, { userId: secondUserId }],
      },
    },
  });
}

beforeAll(async () => {
  httpServer = createServer(app);
  io = createSocketServer(httpServer);
  await new Promise<void>((resolve) => {
    httpServer.listen(0, resolve);
  });
  baseUrl = `http://127.0.0.1:${(httpServer.address() as AddressInfo).port}`;
});

beforeEach(async () => {
  await resetDatabase();
});

afterEach(() => {
  for (const socket of openSockets.splice(0)) {
    socket.disconnect();
  }
});

afterAll(async () => {
  await new Promise<void>((resolve) => {
    io.close(() => resolve());
  });
  await prisma.$disconnect();
});

describe('realtime messaging', () => {
  it('authenticates, joins only authorized rooms, and delivers persisted messages', async () => {
    const ada = await createVerifiedUser({
      name: 'Ada',
      username: 'ada',
      email: 'ada@example.com',
    });
    const ben = await createVerifiedUser({
      name: 'Ben',
      username: 'ben',
      email: 'ben@example.com',
    });
    const cara = await createVerifiedUser({
      name: 'Cara',
      username: 'cara',
      email: 'cara@example.com',
    });
    const conversation = await createDirectConversation(ada.user.id, ben.user.id);

    const adaSocket = await connect(ada.token);
    const benSocket = await connect(ben.token);
    const caraSocket = await connect(cara.token);

    await expect(
      adaSocket.timeout(5_000).emitWithAck('conversation:join', {
        conversationId: conversation.id,
      }),
    ).resolves.toEqual({ ok: true, data: { joined: true } });

    await expect(
      benSocket.timeout(5_000).emitWithAck('conversation:join', {
        conversationId: conversation.id,
      }),
    ).resolves.toEqual({ ok: true, data: { joined: true } });

    const outsider = await caraSocket.timeout(5_000).emitWithAck('conversation:join', {
      conversationId: conversation.id,
    });
    expect(outsider.ok).toBe(false);
    if (!outsider.ok) {
      expect(outsider.error.code).toBe('CONVERSATION_NOT_FOUND');
    }

    const receivedMessages: MessageDTO[] = [];
    const updatedEvents: Array<{ lastMessage: { content: string | null } | null }> = [];
    benSocket.on('message:new', ({ message }) => {
      receivedMessages.push(message);
    });
    benSocket.on('conversation:updated', (payload) => {
      updatedEvents.push({ lastMessage: payload.lastMessage });
    });

    const clientMessageId = randomUUID();
    const ack = await adaSocket.timeout(5_000).emitWithAck('message:send', {
      conversationId: conversation.id,
      clientMessageId,
      content: 'Hello from Ada',
    });

    expect(ack.ok).toBe(true);
    if (!ack.ok) {
      throw new Error('Expected message send to succeed.');
    }

    expect(ack.data.message).toMatchObject({
      content: 'Hello from Ada',
      clientMessageId,
    });
    expect(ack.data.duplicate).toBe(false);

    await new Promise((resolve) => setTimeout(resolve, 150));

    expect(receivedMessages).toHaveLength(1);
    expect(receivedMessages[0]?.content).toBe('Hello from Ada');
    expect(updatedEvents[0]?.lastMessage?.content).toBe('Hello from Ada');

    const duplicate = await adaSocket.timeout(5_000).emitWithAck('message:send', {
      conversationId: conversation.id,
      clientMessageId,
      content: 'Hello from Ada',
    });

    expect(duplicate.ok).toBe(true);
    if (!duplicate.ok) {
      throw new Error('Expected duplicate send to be acknowledged.');
    }

    expect(duplicate.data.duplicate).toBe(true);
    expect(duplicate.data.message.id).toBe(ack.data.message.id);

    await new Promise((resolve) => setTimeout(resolve, 150));
    expect(receivedMessages).toHaveLength(1);

    const persisted = await prisma.message.findUnique({
      where: {
        senderId_clientMessageId: {
          senderId: ada.user.id,
          clientMessageId,
        },
      },
    });
    expect(persisted?.content).toBe('Hello from Ada');

    const history = await request(app)
      .get(`/api/conversations/${conversation.id}/messages`)
      .set('Authorization', ada.auth);
    expect(history.status).toBe(200);
    expect(history.body.data.messages).toHaveLength(1);
    expect(history.body.data.messages[0].id).toBe(ack.data.message.id);
  });

  it('rejoins after reconnect and receives new messages', async () => {
    const ada = await createVerifiedUser({
      name: 'Ada',
      username: 'ada',
      email: 'ada@example.com',
    });
    const ben = await createVerifiedUser({
      name: 'Ben',
      username: 'ben',
      email: 'ben@example.com',
    });
    const conversation = await createDirectConversation(ada.user.id, ben.user.id);
    const adaSocket = await connect(ada.token);
    let benSocket = await connect(ben.token);

    await adaSocket.timeout(5_000).emitWithAck('conversation:join', {
      conversationId: conversation.id,
    });
    await benSocket.timeout(5_000).emitWithAck('conversation:join', {
      conversationId: conversation.id,
    });

    benSocket.disconnect();
    benSocket = await connect(ben.token);
    await benSocket.timeout(5_000).emitWithAck('conversation:join', {
      conversationId: conversation.id,
    });

    const received = new Promise<MessageDTO>((resolve) => {
      benSocket.once('message:new', ({ message }) => resolve(message));
    });

    const ack = await adaSocket.timeout(5_000).emitWithAck('message:send', {
      conversationId: conversation.id,
      clientMessageId: randomUUID(),
      content: 'After reconnect',
    });

    expect(ack.ok).toBe(true);
    await expect(received).resolves.toMatchObject({ content: 'After reconnect' });
  });

  it('rejects an invalid socket token', async () => {
    await expect(connect('not-a-valid-token')).rejects.toBeTruthy();
  });

  it('rejects a socket token whose refresh session was revoked', async () => {
    const ada = await createVerifiedUser({
      name: 'Ada',
      username: 'ada',
      email: 'ada@example.com',
    });

    await prisma.refreshSession.updateMany({
      where: { userId: ada.user.id },
      data: { revokedAt: new Date() },
    });

    await expect(connect(ada.token)).rejects.toBeTruthy();
  });
});
