import type { Response } from 'supertest';
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

const mail = vi.hoisted(() => ({
  verification: [] as Array<{ to: string; name: string; token: string }>,
  reset: [] as Array<{ to: string; name: string; token: string }>,
}));

vi.mock('../../src/lib/mailer.js', () => ({
  sendVerificationEmail: vi.fn(async (input: { to: string; name: string; token: string }) => {
    mail.verification.push(input);
  }),
  sendPasswordResetEmail: vi.fn(async (input: { to: string; name: string; token: string }) => {
    mail.reset.push(input);
  }),
}));

import { createApp } from '../../src/app.js';
import { prisma } from '../../src/lib/prisma.js';
import { resetDatabase } from '../helpers/db.js';

const app = createApp();

const registration = {
  name: 'Ada Lovelace',
  username: 'ada',
  email: 'ada@example.com',
  password: 'CorrectHorse123',
};

function cookieFrom(response: Response): string {
  const header = response.headers['set-cookie'];
  const raw = Array.isArray(header) ? header[0] : header;

  if (!raw) {
    throw new Error('Expected the response to set a refresh cookie.');
  }

  return raw.split(';')[0] ?? '';
}

async function register(overrides: Partial<typeof registration> = {}): Promise<Response> {
  return request(app)
    .post('/api/auth/register')
    .send({ ...registration, ...overrides });
}

async function createVerifiedUser(): Promise<Response> {
  const response = await register();
  const token = mail.verification[0]?.token;

  if (!token) {
    throw new Error('Registration did not produce a verification token.');
  }

  await request(app).post('/api/auth/verify-email').send({ token }).expect(200);
  return response;
}

beforeEach(async () => {
  await resetDatabase();
  mail.verification.length = 0;
  mail.reset.length = 0;
  vi.clearAllMocks();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('POST /api/auth/register', () => {
  it('creates an unverified user, a session, and a verification email', async () => {
    const response = await register();

    expect(response.status).toBe(201);
    expect(response.body.data.user).toMatchObject({
      email: 'ada@example.com',
      username: 'ada',
      emailVerified: false,
    });
    expect(response.body.data.accessToken).toBeTypeOf('string');

    const setCookie = response.headers['set-cookie']?.[0] ?? '';
    expect(setCookie).toContain('cs_refresh=');
    expect(setCookie).toContain('HttpOnly');
    expect(setCookie).toContain('SameSite=Lax');
    expect(setCookie).toContain('Path=/api/auth');

    const user = await prisma.user.findUnique({ where: { email: 'ada@example.com' } });
    expect(user?.emailVerifiedAt).toBeNull();
    expect(user?.passwordHash).not.toContain(registration.password);

    expect(mail.verification).toHaveLength(1);
    expect(mail.verification[0]?.to).toBe(registration.email);
    expect(mail.verification[0]?.token.length).toBeGreaterThan(40);
  });

  it('rejects duplicate emails and usernames', async () => {
    await register();

    const emailConflict = await register({ username: 'ada2' });
    expect(emailConflict.status).toBe(409);
    expect(emailConflict.body.error.code).toBe('EMAIL_ALREADY_EXISTS');

    const usernameConflict = await register({ email: 'other@example.com' });
    expect(usernameConflict.status).toBe(409);
    expect(usernameConflict.body.error.code).toBe('USERNAME_TAKEN');
  });

  it('returns validation errors for weak or malformed input', async () => {
    const response = await request(app)
      .post('/api/auth/register')
      .send({
        ...registration,
        email: 'not-an-email',
        password: 'short',
      });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });
});

describe('verification and sessions', () => {
  it('verifies an email token once and updates the user', async () => {
    await register();
    const token = mail.verification[0]?.token;

    expect(token).toBeDefined();

    const response = await request(app).post('/api/auth/verify-email').send({ token });
    expect(response.status).toBe(200);
    expect(response.body.data.verified).toBe(true);

    const user = await prisma.user.findUnique({ where: { email: registration.email } });
    expect(user?.emailVerifiedAt).not.toBeNull();

    const reused = await request(app).post('/api/auth/verify-email').send({ token });
    expect(reused.status).toBe(400);
    expect(reused.body.error.code).toBe('INVALID_TOKEN');
  });

  it('rejects invalid verification tokens', async () => {
    const response = await request(app)
      .post('/api/auth/verify-email')
      .send({ token: 'this-token-does-not-exist-and-is-long-enough' });

    expect(response.status).toBe(400);
  });

  it('logs in with the correct password and rejects a wrong one', async () => {
    await createVerifiedUser();

    const success = await request(app).post('/api/auth/login').send({
      email: registration.email,
      password: registration.password,
    });

    expect(success.status).toBe(200);
    expect(success.body.data.user.emailVerified).toBe(true);
    expect(success.body.data.accessToken).toBeTypeOf('string');

    const failure = await request(app).post('/api/auth/login').send({
      email: registration.email,
      password: 'DefinitelyWrong123',
    });

    expect(failure.status).toBe(401);
    expect(failure.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('returns the current user only with a valid access token', async () => {
    const response = await register();
    const accessToken = response.body.data.accessToken as string;

    const me = await request(app)
      .get('/api/users/me')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(me.status).toBe(200);
    expect(me.body.data.user.email).toBe(registration.email);

    const unauthenticated = await request(app).get('/api/users/me');
    expect(unauthenticated.status).toBe(401);
  });

  it('rotates refresh tokens and revokes the family when an old token is reused', async () => {
    const response = await register();
    const oldCookie = cookieFrom(response);

    const refreshed = await request(app).post('/api/auth/refresh').set('Cookie', oldCookie);
    expect(refreshed.status).toBe(200);

    const newCookie = cookieFrom(refreshed);
    expect(newCookie).not.toBe(oldCookie);

    const reuse = await request(app).post('/api/auth/refresh').set('Cookie', oldCookie);
    expect(reuse.status).toBe(401);
    expect(reuse.body.error.code).toBe('SESSION_REUSED');

    const familyRevoked = await request(app).post('/api/auth/refresh').set('Cookie', newCookie);
    expect(familyRevoked.status).toBe(401);
  });

  it('revokes the session on logout', async () => {
    const agent = request.agent(app);
    await agent.post('/api/auth/register').send(registration).expect(201);

    await agent.post('/api/auth/logout').expect(204);
    await agent.post('/api/auth/refresh').expect(401);
  });

  it('rejects cookie-authenticated refresh requests from another origin', async () => {
    const response = await register();
    const cookie = cookieFrom(response);

    const blocked = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', cookie)
      .set('Origin', 'http://evil.example');

    expect(blocked.status).toBe(403);
  });
});

describe('password reset', () => {
  it('resets the password and revokes existing sessions', async () => {
    const registrationResponse = await createVerifiedUser();
    const oldCookie = cookieFrom(registrationResponse);

    const forgot = await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: registration.email });

    expect(forgot.status).toBe(202);
    expect(mail.reset).toHaveLength(1);

    const resetToken = mail.reset[0]?.token;
    expect(resetToken).toBeDefined();

    const reset = await request(app).post('/api/auth/reset-password').send({
      token: resetToken,
      password: 'NewCorrectHorse123',
    });

    expect(reset.status).toBe(204);

    await request(app)
      .post('/api/auth/login')
      .send({ email: registration.email, password: registration.password })
      .expect(401);

    await request(app)
      .post('/api/auth/login')
      .send({ email: registration.email, password: 'NewCorrectHorse123' })
      .expect(200);

    const refreshAfterReset = await request(app).post('/api/auth/refresh').set('Cookie', oldCookie);

    expect(refreshAfterReset.status).toBe(401);
  });

  it('does not reveal whether an email exists', async () => {
    const response = await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: 'nobody@example.com' });

    expect(response.status).toBe(202);
    expect(mail.reset).toHaveLength(0);
  });
});

describe('resending verification', () => {
  it('invalidates the previous verification token', async () => {
    await register();
    const firstToken = mail.verification[0]?.token;

    await request(app)
      .post('/api/auth/resend-verification')
      .send({ email: registration.email })
      .expect(202);

    const secondToken = mail.verification[1]?.token;
    expect(secondToken).toBeDefined();
    expect(secondToken).not.toBe(firstToken);

    await request(app).post('/api/auth/verify-email').send({ token: firstToken }).expect(400);

    await request(app).post('/api/auth/verify-email').send({ token: secondToken }).expect(200);
  });
});
