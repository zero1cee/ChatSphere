import { randomUUID } from 'node:crypto';

import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { createApp } from '../../src/app.js';
import { prisma } from '../../src/lib/prisma.js';
import { resetDatabase } from '../helpers/db.js';
import { createVerifiedUser } from '../helpers/users.js';

const app = createApp();

async function directConversation(firstUserId: string, secondUserId: string) {
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

async function groupConversation(ownerId: string, memberId: string) {
  const conversation = await prisma.conversation.create({
    data: {
      type: 'GROUP',
      title: 'Editors',
      members: {
        create: [
          { userId: ownerId, role: 'OWNER' },
          { userId: memberId, role: 'MEMBER' },
        ],
      },
    },
  });

  return conversation;
}

async function seedMessage(input: {
  conversationId: string;
  senderId: string;
  content: string;
  replyToId?: string;
}) {
  return prisma.message.create({
    data: {
      conversationId: input.conversationId,
      senderId: input.senderId,
      clientMessageId: randomUUID(),
      content: input.content,
      replyToId: input.replyToId,
    },
  });
}

beforeEach(async () => {
  await resetDatabase();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('message actions', () => {
  it('edits and soft-deletes messages with sender-only edit permission', async () => {
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
    const conversation = await directConversation(ada.user.id, ben.user.id);
    const message = await seedMessage({
      conversationId: conversation.id,
      senderId: ada.user.id,
      content: 'Original',
    });

    const edited = await request(app)
      .patch(`/api/messages/${message.id}`)
      .set('Authorization', ada.auth)
      .send({ content: 'Edited' });

    expect(edited.status).toBe(200);
    expect(edited.body.data.message.content).toBe('Edited');
    expect(edited.body.data.message.editedAt).toBeTypeOf('string');

    await request(app)
      .patch(`/api/messages/${message.id}`)
      .set('Authorization', ben.auth)
      .send({ content: 'Hijacked' })
      .expect(403);

    await request(app)
      .delete(`/api/messages/${message.id}`)
      .set('Authorization', ben.auth)
      .expect(403);

    const deleted = await request(app)
      .delete(`/api/messages/${message.id}`)
      .set('Authorization', ada.auth);

    expect(deleted.status).toBe(200);
    expect(deleted.body.data.message.content).toBeNull();
    expect(deleted.body.data.message.deletedAt).toBeTypeOf('string');

    await request(app)
      .patch(`/api/messages/${message.id}`)
      .set('Authorization', ada.auth)
      .send({ content: 'Too late' })
      .expect(409);
  });

  it('allows a group admin to delete another member message', async () => {
    const owner = await createVerifiedUser({
      name: 'Owner',
      username: 'owner',
      email: 'owner@example.com',
    });
    const admin = await createVerifiedUser({
      name: 'Admin',
      username: 'admin',
      email: 'admin@example.com',
    });
    const member = await createVerifiedUser({
      name: 'Member',
      username: 'member',
      email: 'member@example.com',
    });
    const conversation = await groupConversation(owner.user.id, admin.user.id);
    await prisma.conversationMember.create({
      data: { conversationId: conversation.id, userId: member.user.id, role: 'MEMBER' },
    });
    await prisma.conversationMember.update({
      where: {
        conversationId_userId: { conversationId: conversation.id, userId: admin.user.id },
      },
      data: { role: 'ADMIN' },
    });

    const message = await seedMessage({
      conversationId: conversation.id,
      senderId: member.user.id,
      content: 'Needs moderation',
    });

    const deleted = await request(app)
      .delete(`/api/messages/${message.id}`)
      .set('Authorization', admin.auth);

    expect(deleted.status).toBe(200);
    expect(deleted.body.data.message.deletedAt).toBeTypeOf('string');
  });

  it('adds, replaces, and removes reactions', async () => {
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
    const conversation = await directConversation(ada.user.id, ben.user.id);
    const message = await seedMessage({
      conversationId: conversation.id,
      senderId: ada.user.id,
      content: 'React to me',
    });

    const added = await request(app)
      .post(`/api/messages/${message.id}/reactions`)
      .set('Authorization', ben.auth)
      .send({ emoji: '👍' });

    expect(added.status).toBe(200);
    expect(added.body.data.message.reactions).toHaveLength(1);
    expect(added.body.data.message.reactions[0]).toMatchObject({
      emoji: '👍',
      user: { id: ben.user.id },
    });

    const replaced = await request(app)
      .post(`/api/messages/${message.id}/reactions`)
      .set('Authorization', ben.auth)
      .send({ emoji: '❤️' });

    expect(replaced.status).toBe(200);
    expect(replaced.body.data.message.reactions).toHaveLength(1);
    expect(replaced.body.data.message.reactions[0].emoji).toBe('❤️');

    const removed = await request(app)
      .delete(`/api/messages/${message.id}/reactions/${encodeURIComponent('❤️')}`)
      .set('Authorization', ben.auth);

    expect(removed.status).toBe(200);
    expect(removed.body.data.message.reactions).toHaveLength(0);
  });

  it('returns reply previews in message history', async () => {
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
    const conversation = await directConversation(ada.user.id, ben.user.id);
    const parent = await seedMessage({
      conversationId: conversation.id,
      senderId: ada.user.id,
      content: 'The original point',
    });
    await seedMessage({
      conversationId: conversation.id,
      senderId: ben.user.id,
      content: 'Replying now',
      replyToId: parent.id,
    });

    const response = await request(app)
      .get(`/api/conversations/${conversation.id}/messages`)
      .set('Authorization', ben.auth);

    expect(response.status).toBe(200);
    expect(response.body.data.messages.at(-1).replyTo).toMatchObject({
      id: parent.id,
      content: 'The original point',
      senderName: 'Ada',
    });
  });
});
