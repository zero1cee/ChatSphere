import type { SelfUser } from '@chatsphere/shared';

import { AppError } from '../../lib/errors.js';
import { prisma } from '../../lib/prisma.js';
import { toSelfUser } from './users.mapper.js';

export async function getCurrentUser(userId: string): Promise<SelfUser> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw new AppError(401, 'UNAUTHENTICATED', 'This account no longer exists.');
  }

  return toSelfUser(user);
}
