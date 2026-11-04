import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { createApp } from '../../src/app.js';
import { signAccessToken } from '../../src/lib/jwt.js';
import { verifyPassword } from '../../src/lib/password.js';
import { prisma } from '../../src/lib/prisma.js';
import { resetDatabase } from '../helpers/db.js';
import {
  createSession,
  createUnverifiedUser,
  createVerifiedUser,
  TEST_PASSWORD,
} from '../helpers/users.js';

const app = createApp();

beforeEach(async () => {
  await resetDatabase();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('user search and public profiles', () => {
  it('searches verified users without exposing private fields', async () => {
    const ada = await createVerifiedUser({
      name: 'Ada Lovelace',
      username: 'ada',
      email: 'ada@example.com',
    });
    const ben = await createVerifiedUser({
      name: 'Ben Carter',
      username: 'benc',
      email: 'ben@example.com',
    });
    await createUnverifiedUser({
      name: 'Cara Unverified',
      username: 'cara',
      email: 'cara@example.com',
    });

    const response = await request(app)
      .get('/api/users/search?q=ben')
      .set('Authorization', ada.auth);

    expect(response.status).toBe(200);
    expect(response.body.data.users).toHaveLength(1);
    expect(response.body.data.users[0]).toMatchObject({
      id: ben.user.id,
      username: 'benc',
      name: 'Ben Carter',
    });
    expect(response.body.data.users[0]).not.toHaveProperty('email');

    const hidden = await request(app)
      .get('/api/users/search?q=cara')
      .set('Authorization', ada.auth);
    expect(hidden.body.data.users).toHaveLength(0);

    const selfSearch = await request(app)
      .get('/api/users/search?q=ada')
      .set('Authorization', ada.auth);
    expect(selfSearch.body.data.users).toHaveLength(0);
  });

  it('validates search input and requires authentication', async () => {
    const ada = await createVerifiedUser({
      name: 'Ada Lovelace',
      username: 'ada',
      email: 'ada@example.com',
    });

    await request(app).get('/api/users/search?q=a').set('Authorization', ada.auth).expect(400);

    await request(app).get('/api/users/search?q=ada').expect(401);
  });

  it('returns a public profile but hides unverified accounts', async () => {
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
    const hidden = await createUnverifiedUser({
      name: 'Hidden',
      username: 'hidden',
      email: 'hidden@example.com',
    });

    const response = await request(app)
      .get(`/api/users/${ben.user.id}`)
      .set('Authorization', ada.auth);

    expect(response.status).toBe(200);
    expect(response.body.data.user).toMatchObject({ username: 'ben' });
    expect(response.body.data.user).not.toHaveProperty('email');

    await request(app)
      .get(`/api/users/${hidden.user.id}`)
      .set('Authorization', ada.auth)
      .expect(404);

    await request(app).get(`/api/users/${ben.user.id}`).expect(401);
  });
});

describe('profile management', () => {
  it('updates name, username, and bio', async () => {
    const ada = await createVerifiedUser({
      name: 'Ada Lovelace',
      username: 'ada',
      email: 'ada@example.com',
    });

    const response = await request(app)
      .patch('/api/users/me')
      .set('Authorization', ada.auth)
      .send({ name: 'Ada Byron', bio: 'Counting machines.' });

    expect(response.status).toBe(200);
    expect(response.body.data.user).toMatchObject({
      name: 'Ada Byron',
      username: 'ada',
      bio: 'Counting machines.',
    });

    const cleared = await request(app)
      .patch('/api/users/me')
      .set('Authorization', ada.auth)
      .send({ bio: '' });

    expect(cleared.body.data.user.bio).toBeNull();
  });

  it('rejects duplicate usernames and unknown fields', async () => {
    const ada = await createVerifiedUser({
      name: 'Ada',
      username: 'ada',
      email: 'ada@example.com',
    });
    await createVerifiedUser({
      name: 'Ben',
      username: 'ben',
      email: 'ben@example.com',
    });

    const conflict = await request(app)
      .patch('/api/users/me')
      .set('Authorization', ada.auth)
      .send({ username: 'ben' });

    expect(conflict.status).toBe(409);
    expect(conflict.body.error.code).toBe('USERNAME_TAKEN');

    await request(app)
      .patch('/api/users/me')
      .set('Authorization', ada.auth)
      .send({ email: 'new@example.com' })
      .expect(400);
  });

  it('changes the password and revokes other sessions', async () => {
    const ada = await createVerifiedUser({
      name: 'Ada',
      username: 'ada',
      email: 'ada@example.com',
    });
    const currentSession = await createSession(ada.user.id);
    const otherSession = await createSession(ada.user.id);
    const token = await signAccessToken({
      userId: ada.user.id,
      sessionId: currentSession.id,
    });

    const wrong = await request(app)
      .post('/api/users/me/password')
      .set('Authorization', `Bearer ${token}`)
      .send({ currentPassword: 'WrongPassword123', newPassword: 'NewCorrectHorse123' });

    expect(wrong.status).toBe(400);

    const changed = await request(app)
      .post('/api/users/me/password')
      .set('Authorization', `Bearer ${token}`)
      .send({ currentPassword: TEST_PASSWORD, newPassword: 'NewCorrectHorse123' });

    expect(changed.status).toBe(204);

    const user = await prisma.user.findUniqueOrThrow({ where: { id: ada.user.id } });
    expect(await verifyPassword(user.passwordHash, 'NewCorrectHorse123')).toBe(true);

    const currentAfter = await prisma.refreshSession.findUniqueOrThrow({
      where: { id: currentSession.id },
    });
    const otherAfter = await prisma.refreshSession.findUniqueOrThrow({
      where: { id: otherSession.id },
    });

    expect(currentAfter.revokedAt).toBeNull();
    expect(otherAfter.revokedAt).not.toBeNull();

    await request(app)
      .post('/api/auth/login')
      .send({ email: 'ada@example.com', password: TEST_PASSWORD })
      .expect(401);

    await request(app)
      .post('/api/auth/login')
      .send({ email: 'ada@example.com', password: 'NewCorrectHorse123' })
      .expect(200);
  });
});
