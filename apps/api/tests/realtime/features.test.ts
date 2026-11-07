import { randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';

import type {
  ClientToServerEvents,
  MessageDTO,
  PresenceState,
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

async function join(socket: TestSocket, conversationId: string) {
  return socket.timeout(5_000).emitWithAck('conversation:join', { conversationId });
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

afterEach(async () => {
  for (const socket of openSockets.splice(0)) {
    socket.disconnect();
  }
  await new Promise((resolve) => setTimeout(resolve, 50));
});

afterAll(async () => {
  await new Promise<void>((resolve) => {
    io.close(() => resolve());
  });
  await prisma.$disconnect();
});

describe('realtime presence, typing, receipts, and notifications', () => {
  it('broadcasts typing state between conversation members', async () => {
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
    const benSocket = await connect(ben.token);
    await join(adaSocket, conversation.id);
    await join(benSocket, conversation.id);

    const typing = new Promise<{ userId: string; name: string; isTyping: boolean }>((resolve) => {
      benSocket.once('typing:updated', resolve);
    });

    adaSocket.emit('typing:start', { conversationId: conversation.id });
    await expect(typing).resolves.toMatchObject({
      userId: ada.user.id,
      name: 'Ada',
      isTyping: true,
    });

    const stopped = new Promise<{ isTyping: boolean }>((resolve) => {
      benSocket.once('typing:updated', resolve);
    });
    adaSocket.emit('typing:stop', { conversationId: conversation.id });
    await expect(stopped).resolves.toMatchObject({ isTyping: false });
  });

  it('publishes presence changes to co-members', async () => {
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
    await createDirectConversation(ada.user.id, ben.user.id);

    const adaSocket = await connect(ada.token);
    const benOnline = new Promise<PresenceState>((resolve) => {
      adaSocket.once('presence:updated', resolve);
    });
    const benSocket = await connect(ben.token);

    await expect(benOnline).resolves.toMatchObject({
      userId: ben.user.id,
      online: true,
    });

    const benOffline = new Promise<PresenceState>((resolve) => {
      adaSocket.once('presence:updated', resolve);
    });
    benSocket.disconnect();

    await expect(benOffline).resolves.toMatchObject({
      userId: ben.user.id,
      online: false,
    });
  });

  it('records delivery/read receipts and creates message notifications', async () => {
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
    const benSocket = await connect(ben.token);
    await join(adaSocket, conversation.id);
    await join(benSocket, conversation.id);

    const notification = new Promise<{ notification: { type: string } }>((resolve) => {
      benSocket.once('notification:new', resolve);
    });

    const sent = await adaSocket.timeout(5_000).emitWithAck('message:send', {
      conversationId: conversation.id,
      clientMessageId: randomUUID(),
      content: 'Receipt me',
    });

    expect(sent.ok).toBe(true);
    if (!sent.ok) {
      throw new Error('Message was not sent.');
    }

    const deliveredReceipt = new Promise<{ userId: string; lastDeliveredAt: string | null }>(
      (resolve) => {
        adaSocket.once('receipt:updated', resolve);
      },
    );
    const delivered = await benSocket.timeout(5_000).emitWithAck('message:delivered', {
      conversationId: conversation.id,
      messageId: sent.data.message.id,
    });
    expect(delivered.ok).toBe(true);
    await expect(deliveredReceipt).resolves.toMatchObject({ userId: ben.user.id });

    const readReceipt = new Promise<{ userId: string; lastReadAt: string | null }>((resolve) => {
      adaSocket.once('receipt:updated', resolve);
    });
    const read = await benSocket.timeout(5_000).emitWithAck('message:read', {
      conversationId: conversation.id,
      messageId: sent.data.message.id,
    });
    expect(read.ok).toBe(true);
    await expect(readReceipt).resolves.toMatchObject({ userId: ben.user.id });

    const membership = await prisma.conversationMember.findUniqueOrThrow({
      where: {
        conversationId_userId: { conversationId: conversation.id, userId: ben.user.id },
      },
    });
    expect(membership.lastReadMessageId).toBe(sent.data.message.id);
    expect(membership.lastReadAt).toBeInstanceOf(Date);

    await expect(notification).resolves.toMatchObject({
      notification: { type: 'MESSAGE' },
    });

    const list = await request(app).get('/api/notifications').set('Authorization', ben.auth);
    expect(list.status).toBe(200);
    expect(list.body.data.unreadCount).toBeGreaterThanOrEqual(1);
    expect(list.body.data.notifications[0].payload).toMatchObject({
      actorName: 'Ada',
      preview: 'Receipt me',
    });

    await request(app)
      .post('/api/notifications/read')
      .set('Authorization', ben.auth)
      .send({})
      .expect(200);

    const afterRead = await request(app).get('/api/notifications').set('Authorization', ben.auth);
    expect(afterRead.body.data.unreadCount).toBe(0);
  });

  it('persists replies and pre-uploaded attachments', async () => {
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
    const benSocket = await connect(ben.token);
    await join(adaSocket, conversation.id);
    await join(benSocket, conversation.id);

    const parent = await adaSocket.timeout(5_000).emitWithAck('message:send', {
      conversationId: conversation.id,
      clientMessageId: randomUUID(),
      content: 'Parent message',
    });
    expect(parent.ok).toBe(true);
    if (!parent.ok) {
      throw new Error('Parent message was not sent.');
    }

    const attachment = await prisma.messageAttachment.create({
      data: {
        uploadedById: ada.user.id,
        storageKey: 'tests/photo.png',
        fileName: 'photo.png',
        mimeType: 'image/png',
        fileSize: 128,
      },
    });

    const received = new Promise<MessageDTO>((resolve) => {
      benSocket.once('message:new', ({ message }) => resolve(message));
    });

    const reply = await adaSocket.timeout(5_000).emitWithAck('message:send', {
      conversationId: conversation.id,
      clientMessageId: randomUUID(),
      content: 'Reply with a photo',
      replyToId: parent.data.message.id,
      attachmentIds: [attachment.id],
    });

    expect(reply.ok).toBe(true);
    if (!reply.ok) {
      throw new Error('Reply was not sent.');
    }

    expect(reply.data.message.replyTo?.id).toBe(parent.data.message.id);
    expect(reply.data.message.attachments).toHaveLength(1);
    expect(reply.data.message.attachments[0]?.fileName).toBe('photo.png');
    expect(reply.data.message.attachments[0]?.url).toContain('X-Amz-Signature');

    await expect(received).resolves.toMatchObject({
      content: 'Reply with a photo',
      replyTo: { id: parent.data.message.id },
    });
  });
});
