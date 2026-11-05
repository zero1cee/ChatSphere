import { randomUUID } from 'node:crypto';

import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { createApp } from '../../src/app.js';
import { prisma } from '../../src/lib/prisma.js';
import { resetDatabase } from '../helpers/db.js';
import { createVerifiedUser } from '../helpers/users.js';

const app = createApp();

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

beforeEach(async () => {
  await resetDatabase();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('message history', () => {
  it('paginates newest messages, older pages, and catch-up pages', async () => {
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
    const base = Date.now() - 35 * 60 * 1000;

    for (let index = 0; index < 35; index += 1) {
      await prisma.message.create({
        data: {
          conversationId: conversation.id,
          senderId: index % 2 === 0 ? ada.user.id : ben.user.id,
          clientMessageId: randomUUID(),
          content: `Message ${index}`,
          createdAt: new Date(base + index * 60 * 1000),
        },
      });
    }

    const latest = await request(app)
      .get(`/api/conversations/${conversation.id}/messages?limit=10`)
      .set('Authorization', ada.auth);

    expect(latest.status).toBe(200);
    expect(latest.body.data.messages).toHaveLength(10);
    expect(
      latest.body.data.messages.map((message: { content: string }) => message.content),
    ).toEqual(Array.from({ length: 10 }, (_, index) => `Message ${index + 25}`));
    expect(latest.body.meta.hasMore).toBe(true);
    expect(latest.body.meta.oldestCursor).toBeTypeOf('string');
    expect(latest.body.data.messages[0].sender).not.toHaveProperty('email');

    const older = await request(app)
      .get(
        `/api/conversations/${conversation.id}/messages?limit=10&before=${encodeURIComponent(
          latest.body.meta.oldestCursor,
        )}`,
      )
      .set('Authorization', ada.auth);

    expect(older.status).toBe(200);
    expect(older.body.data.messages.map((message: { content: string }) => message.content)).toEqual(
      Array.from({ length: 10 }, (_, index) => `Message ${index + 15}`),
    );

    const catchUp = await request(app)
      .get(
        `/api/conversations/${conversation.id}/messages?after=${encodeURIComponent(
          latest.body.meta.oldestCursor,
        )}`,
      )
      .set('Authorization', ada.auth);

    expect(catchUp.status).toBe(200);
    expect(
      catchUp.body.data.messages.map((message: { content: string }) => message.content),
    ).toEqual(Array.from({ length: 9 }, (_, index) => `Message ${index + 26}`));
    expect(catchUp.body.meta.hasMore).toBe(false);

    const noneAfterNewest = await request(app)
      .get(
        `/api/conversations/${conversation.id}/messages?after=${encodeURIComponent(
          latest.body.meta.newestCursor,
        )}`,
      )
      .set('Authorization', ada.auth);

    expect(noneAfterNewest.status).toBe(200);
    expect(noneAfterNewest.body.data.messages).toHaveLength(0);
  });

  it('returns the newest message in conversation summaries', async () => {
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

    await prisma.message.create({
      data: {
        conversationId: conversation.id,
        senderId: ben.user.id,
        clientMessageId: randomUUID(),
        content: 'The latest message',
      },
    });

    const list = await request(app).get('/api/conversations').set('Authorization', ada.auth);
    expect(list.status).toBe(200);
    expect(list.body.data.conversations[0].lastMessage).toMatchObject({
      content: 'The latest message',
      sender: { id: ben.user.id, username: 'ben' },
    });

    const detail = await request(app)
      .get(`/api/conversations/${conversation.id}`)
      .set('Authorization', ada.auth);

    expect(detail.body.data.conversation.lastMessage.content).toBe('The latest message');
  });

  it('rejects invalid cursors and non-member access', async () => {
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

    await request(app)
      .get(`/api/conversations/${conversation.id}/messages?before=not-a-cursor`)
      .set('Authorization', ada.auth)
      .expect(400);

    await request(app)
      .get(`/api/conversations/${conversation.id}/messages`)
      .set('Authorization', cara.auth)
      .expect(404);

    await request(app).get(`/api/conversations/${conversation.id}/messages`).expect(401);
  });

  it('returns an empty page for a conversation with no messages', async () => {
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

    const response = await request(app)
      .get(`/api/conversations/${conversation.id}/messages`)
      .set('Authorization', ada.auth);

    expect(response.status).toBe(200);
    expect(response.body.data.messages).toEqual([]);
    expect(response.body.meta).toMatchObject({
      hasMore: false,
      oldestCursor: null,
      newestCursor: null,
    });
  });
});
