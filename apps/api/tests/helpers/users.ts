import { randomBytes, randomUUID } from 'node:crypto';

import type { User } from '../../src/generated/prisma/client.js';
import { signAccessToken } from '../../src/lib/jwt.js';
import { hashPassword } from '../../src/lib/password.js';
import { prisma } from '../../src/lib/prisma.js';

export const TEST_PASSWORD = 'CorrectHorse123';

let passwordHashPromise: Promise<string> | null = null;

async function testPasswordHash(): Promise<string> {
  passwordHashPromise ??= hashPassword(TEST_PASSWORD);
  return passwordHashPromise;
}

export interface TestUser {
  user: User;
  token: string;
  auth: string;
}

export async function createVerifiedUser(input: {
  name: string;
  username: string;
  email: string;
}): Promise<TestUser> {
  const user = await prisma.user.create({
    data: {
      name: input.name,
      username: input.username,
      email: input.email,
      passwordHash: await testPasswordHash(),
      emailVerifiedAt: new Date(),
    },
  });

  const token = await signAccessToken({
    userId: user.id,
    sessionId: randomUUID(),
  });

  return { user, token, auth: `Bearer ${token}` };
}

export async function createUnverifiedUser(input: {
  name: string;
  username: string;
  email: string;
}): Promise<TestUser> {
  const user = await prisma.user.create({
    data: {
      name: input.name,
      username: input.username,
      email: input.email,
      passwordHash: await testPasswordHash(),
    },
  });

  const token = await signAccessToken({
    userId: user.id,
    sessionId: randomUUID(),
  });

  return { user, token, auth: `Bearer ${token}` };
}

export async function createSession(userId: string) {
  return prisma.refreshSession.create({
    data: {
      userId,
      tokenHash: randomBytes(32).toString('hex'),
      familyId: randomUUID(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    },
  });
}
