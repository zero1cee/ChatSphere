import type {
  ChangePasswordInput,
  PublicUser,
  SelfUser,
  UpdateProfileInput,
} from '@chatsphere/shared';

import { AppError } from '../../lib/errors.js';
import { hashPassword, verifyPassword } from '../../lib/password.js';
import { prisma } from '../../lib/prisma.js';
import { isPrismaUniqueConstraintError } from '../../lib/prisma-errors.js';
import { toPublicUser, toSelfUser } from './users.mapper.js';

export async function getCurrentUser(userId: string): Promise<SelfUser> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw new AppError(401, 'UNAUTHENTICATED', 'This account no longer exists.');
  }

  return toSelfUser(user);
}

export async function searchUsers(userId: string, query: string): Promise<PublicUser[]> {
  const users = await prisma.user.findMany({
    where: {
      id: { not: userId },
      emailVerifiedAt: { not: null },
      OR: [
        { username: { contains: query, mode: 'insensitive' } },
        { name: { contains: query, mode: 'insensitive' } },
      ],
    },
    select: {
      id: true,
      name: true,
      username: true,
      avatarUrl: true,
      bio: true,
      createdAt: true,
    },
    orderBy: [{ name: 'asc' }, { username: 'asc' }],
    take: 20,
  });

  return users.map(toPublicUser);
}

export async function getPublicUser(userId: string): Promise<PublicUser> {
  const user = await prisma.user.findFirst({
    where: {
      id: userId,
      emailVerifiedAt: { not: null },
    },
    select: {
      id: true,
      name: true,
      username: true,
      avatarUrl: true,
      bio: true,
      createdAt: true,
    },
  });

  if (!user) {
    throw new AppError(404, 'USER_NOT_FOUND', 'That user could not be found.');
  }

  return toPublicUser(user);
}

export async function updateProfile(userId: string, input: UpdateProfileInput): Promise<SelfUser> {
  const data: { name?: string; username?: string; bio?: string | null } = {};

  if (input.name !== undefined) {
    data.name = input.name;
  }

  if (input.username !== undefined) {
    data.username = input.username;
  }

  if (input.bio !== undefined) {
    data.bio = input.bio.length > 0 ? input.bio : null;
  }

  try {
    const user = await prisma.user.update({
      where: { id: userId },
      data,
    });

    return toSelfUser(user);
  } catch (error) {
    if (isPrismaUniqueConstraintError(error)) {
      throw new AppError(409, 'USERNAME_TAKEN', 'That username is already taken.');
    }

    throw error;
  }
}

export async function changePassword(
  userId: string,
  currentSessionId: string | undefined,
  input: ChangePasswordInput,
): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw new AppError(401, 'UNAUTHENTICATED', 'This account no longer exists.');
  }

  if (!(await verifyPassword(user.passwordHash, input.currentPassword))) {
    throw new AppError(400, 'INVALID_CURRENT_PASSWORD', 'Your current password is incorrect.');
  }

  const passwordHash = await hashPassword(input.newPassword);
  const now = new Date();

  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    }),
    prisma.refreshSession.updateMany({
      where: {
        userId,
        revokedAt: null,
        ...(currentSessionId ? { id: { not: currentSessionId } } : {}),
      },
      data: { revokedAt: now },
    }),
  ]);
}
