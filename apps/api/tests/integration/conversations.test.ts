import { randomUUID } from 'node:crypto';

import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { createApp } from '../../src/app.js';
import { prisma } from '../../src/lib/prisma.js';
import { resetDatabase } from '../helpers/db.js';
import { createUnverifiedUser, createVerifiedUser } from '../helpers/users.js';

const app = createApp();

beforeEach(async () => {
  await resetDatabase();
});

afterAll(async () => {
  await prisma.$disconnect();
});

async function makeUser(name: string, username: string) {
  return createVerifiedUser({
    name,
    username,
    email: `${username}@example.com`,
  });
}

function postConversation(auth: string, body: unknown) {
  return request(app).post('/api/conversations').set('Authorization', auth).send(body);
}

describe('direct conversations', () => {
  it('creates one conversation per pair, hides it per user, and reopens it', async () => {
    const ada = await makeUser('Ada Lovelace', 'ada');
    const ben = await makeUser('Ben Carter', 'ben');
    const cara = await makeUser('Cara Diaz', 'cara');
    const unverified = await createUnverifiedUser({
      name: 'Unverified',
      username: 'unverified',
      email: 'unverified@example.com',
    });

    const created = await postConversation(ada.auth, {
      type: 'DIRECT',
      userId: ben.user.id,
    });

    expect(created.status).toBe(201);
    expect(created.body.data.conversation).toMatchObject({
      type: 'DIRECT',
      title: null,
    });
    expect(created.body.data.conversation.members).toHaveLength(2);

    const conversationId = created.body.data.conversation.id as string;

    const reverse = await postConversation(ben.auth, {
      type: 'DIRECT',
      userId: ada.user.id,
    });
    expect(reverse.status).toBe(200);
    expect(reverse.body.data.conversation.id).toBe(conversationId);

    const self = await postConversation(ada.auth, {
      type: 'DIRECT',
      userId: ada.user.id,
    });
    expect(self.status).toBe(400);
    expect(self.body.error.code).toBe('CANNOT_MESSAGE_SELF');

    const blocked = await postConversation(ada.auth, {
      type: 'DIRECT',
      userId: unverified.user.id,
    });
    expect(blocked.status).toBe(404);

    const outsiderList = await request(app)
      .get('/api/conversations')
      .set('Authorization', cara.auth);
    expect(outsiderList.body.data.conversations).toHaveLength(0);

    await request(app)
      .get(`/api/conversations/${conversationId}`)
      .set('Authorization', cara.auth)
      .expect(404);

    const list = await request(app).get('/api/conversations').set('Authorization', ada.auth);
    expect(list.body.data.conversations).toHaveLength(1);

    await request(app)
      .delete(`/api/conversations/${conversationId}`)
      .set('Authorization', ada.auth)
      .expect(204);

    const afterHide = await request(app).get('/api/conversations').set('Authorization', ada.auth);
    expect(afterHide.body.data.conversations).toHaveLength(0);

    const stillVisibleToBen = await request(app)
      .get('/api/conversations')
      .set('Authorization', ben.auth);
    expect(stillVisibleToBen.body.data.conversations).toHaveLength(1);

    const reopened = await postConversation(ada.auth, {
      type: 'DIRECT',
      userId: ben.user.id,
    });
    expect(reopened.status).toBe(200);
    expect(reopened.body.data.conversation.id).toBe(conversationId);

    const afterReopen = await request(app).get('/api/conversations').set('Authorization', ada.auth);
    expect(afterReopen.body.data.conversations).toHaveLength(1);

    await request(app)
      .post(`/api/conversations/${conversationId}/members`)
      .set('Authorization', ada.auth)
      .send({ userIds: [cara.user.id] })
      .expect(400);
  });
});

describe('group conversations and permissions', () => {
  it('creates a group, enforces roles, transfers ownership, and deletes it', async () => {
    const ada = await makeUser('Ada Lovelace', 'ada');
    const ben = await makeUser('Ben Carter', 'ben');
    const cara = await makeUser('Cara Diaz', 'cara');
    const dave = await makeUser('Dave Evans', 'dave');
    const erin = await makeUser('Erin Fox', 'erin');

    const created = await postConversation(ada.auth, {
      type: 'GROUP',
      title: 'Design crew',
      memberIds: [ben.user.id, cara.user.id],
    });

    expect(created.status).toBe(201);
    const conversation = created.body.data.conversation as {
      id: string;
      members: Array<{ userId: string; role: string }>;
    };
    expect(conversation.members).toHaveLength(3);
    expect(conversation.members.find((member) => member.userId === ada.user.id)?.role).toBe(
      'OWNER',
    );
    expect(conversation.members.find((member) => member.userId === ben.user.id)?.role).toBe(
      'MEMBER',
    );

    const conversationId = conversation.id;

    const benList = await request(app).get('/api/conversations').set('Authorization', ben.auth);
    expect(benList.body.data.conversations).toHaveLength(1);

    await request(app)
      .patch(`/api/conversations/${conversationId}`)
      .set('Authorization', ben.auth)
      .send({ title: 'Not allowed' })
      .expect(403);

    const renamed = await request(app)
      .patch(`/api/conversations/${conversationId}`)
      .set('Authorization', ada.auth)
      .send({ title: 'Design guild' });
    expect(renamed.status).toBe(200);
    expect(renamed.body.data.conversation.title).toBe('Design guild');

    const added = await request(app)
      .post(`/api/conversations/${conversationId}/members`)
      .set('Authorization', ada.auth)
      .send({ userIds: [dave.user.id] });
    expect(added.status).toBe(200);
    expect(added.body.data.conversation.members).toHaveLength(4);

    const duplicate = await request(app)
      .post(`/api/conversations/${conversationId}/members`)
      .set('Authorization', ada.auth)
      .send({ userIds: [ben.user.id] });
    expect(duplicate.status).toBe(409);

    const invalid = await request(app)
      .post(`/api/conversations/${conversationId}/members`)
      .set('Authorization', ada.auth)
      .send({ userIds: [randomUUID()] });
    expect(invalid.status).toBe(400);

    const promoted = await request(app)
      .patch(`/api/conversations/${conversationId}/members/${ben.user.id}`)
      .set('Authorization', ada.auth)
      .send({ role: 'ADMIN' });
    expect(promoted.status).toBe(200);

    await request(app)
      .patch(`/api/conversations/${conversationId}/members/${dave.user.id}`)
      .set('Authorization', ben.auth)
      .send({ role: 'ADMIN' })
      .expect(403);

    const adminAdd = await request(app)
      .post(`/api/conversations/${conversationId}/members`)
      .set('Authorization', ben.auth)
      .send({ userIds: [erin.user.id] });
    expect(adminAdd.status).toBe(200);
    expect(adminAdd.body.data.conversation.members).toHaveLength(5);

    const adminRename = await request(app)
      .patch(`/api/conversations/${conversationId}`)
      .set('Authorization', ben.auth)
      .send({ title: 'Design guild v2' });
    expect(adminRename.status).toBe(200);

    await request(app)
      .delete(`/api/conversations/${conversationId}/members/${cara.user.id}`)
      .set('Authorization', ben.auth)
      .expect(204);

    await request(app)
      .get(`/api/conversations/${conversationId}`)
      .set('Authorization', cara.auth)
      .expect(404);

    await request(app)
      .delete(`/api/conversations/${conversationId}/members/${ada.user.id}`)
      .set('Authorization', ben.auth)
      .expect(403);

    await request(app)
      .delete(`/api/conversations/${conversationId}`)
      .set('Authorization', ben.auth)
      .expect(403);

    const transferred = await request(app)
      .patch(`/api/conversations/${conversationId}/members/${ben.user.id}`)
      .set('Authorization', ada.auth)
      .send({ role: 'OWNER' });
    expect(transferred.status).toBe(200);

    const roles = transferred.body.data.conversation.members as Array<{
      userId: string;
      role: string;
    }>;
    expect(roles.find((member) => member.userId === ada.user.id)?.role).toBe('ADMIN');
    expect(roles.find((member) => member.userId === ben.user.id)?.role).toBe('OWNER');

    await request(app)
      .delete(`/api/conversations/${conversationId}`)
      .set('Authorization', ada.auth)
      .expect(403);

    await request(app)
      .delete(`/api/conversations/${conversationId}`)
      .set('Authorization', ben.auth)
      .expect(204);

    const gone = await request(app)
      .get(`/api/conversations/${conversationId}`)
      .set('Authorization', ada.auth);
    expect(gone.status).toBe(404);
  });

  it('prevents the owner from leaving and lets members leave', async () => {
    const ada = await makeUser('Ada', 'ada');
    const ben = await makeUser('Ben', 'ben');

    const created = await postConversation(ada.auth, {
      type: 'GROUP',
      title: 'Two people',
      memberIds: [ben.user.id],
    });
    const conversationId = created.body.data.conversation.id as string;

    await request(app)
      .delete(`/api/conversations/${conversationId}/members/${ada.user.id}`)
      .set('Authorization', ada.auth)
      .expect(409);

    await request(app)
      .delete(`/api/conversations/${conversationId}/members/${ben.user.id}`)
      .set('Authorization', ben.auth)
      .expect(204);

    await request(app)
      .get(`/api/conversations/${conversationId}`)
      .set('Authorization', ben.auth)
      .expect(404);

    await request(app)
      .delete(`/api/conversations/${conversationId}`)
      .set('Authorization', ada.auth)
      .expect(204);
  });

  it('validates group membership input', async () => {
    const ada = await makeUser('Ada', 'ada');
    const ben = await makeUser('Ben', 'ben');

    await postConversation(ada.auth, {
      type: 'GROUP',
      title: 'No one',
      memberIds: [ada.user.id],
    }).expect(400);

    await postConversation(ada.auth, {
      type: 'GROUP',
      title: 'Duplicate',
      memberIds: [ben.user.id, ben.user.id],
    }).expect(400);

    await postConversation(ada.auth, {
      type: 'GROUP',
      title: '   ',
      memberIds: [ben.user.id],
    }).expect(400);
  });

  it('hides conversations from non-members', async () => {
    const ada = await makeUser('Ada', 'ada');
    const ben = await makeUser('Ben', 'ben');
    const outsider = await makeUser('Out', 'outsider');

    const created = await postConversation(ada.auth, {
      type: 'GROUP',
      title: 'Private',
      memberIds: [ben.user.id],
    });
    const conversationId = created.body.data.conversation.id as string;

    await request(app)
      .get(`/api/conversations/${conversationId}`)
      .set('Authorization', outsider.auth)
      .expect(404);

    await request(app)
      .patch(`/api/conversations/${conversationId}`)
      .set('Authorization', outsider.auth)
      .send({ title: 'Nope' })
      .expect(404);

    await request(app)
      .post(`/api/conversations/${conversationId}/members`)
      .set('Authorization', outsider.auth)
      .send({ userIds: [outsider.user.id] })
      .expect(404);

    await request(app)
      .delete(`/api/conversations/${conversationId}`)
      .set('Authorization', outsider.auth)
      .expect(404);
  });
});
