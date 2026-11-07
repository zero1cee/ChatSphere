import type { MeData, PublicUser, UserSearchData } from '@chatsphere/shared';
import {
  changePasswordSchema,
  updateProfileSchema,
  userSearchQuerySchema,
} from '@chatsphere/shared';
import { Router } from 'express';
import { z } from 'zod';

import { sendSuccess } from '../../lib/api-response.js';
import { AppError } from '../../lib/errors.js';
import { createRateLimiter } from '../../lib/rate-limit.js';
import { requireAuth, requireVerifiedEmail } from '../../middleware/auth.js';
import {
  changePassword,
  getCurrentUser,
  getPublicUser,
  searchUsers,
  updateProfile,
} from './users.service.js';

export const usersRouter = Router();

const searchLimiter = createRateLimiter({ windowMs: 60 * 1000, limit: 60, prefix: 'users:search' });
const passwordLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  prefix: 'users:password',
});

usersRouter.get('/me', requireAuth, async (req, res) => {
  if (!req.auth) {
    throw new AppError(401, 'UNAUTHENTICATED', 'Sign in to continue.');
  }

  const user = await getCurrentUser(req.auth.userId);
  const data: MeData = { user };

  sendSuccess(res, data);
});

usersRouter.patch('/me', requireAuth, async (req, res) => {
  if (!req.auth) {
    throw new AppError(401, 'UNAUTHENTICATED', 'Sign in to continue.');
  }

  const input = updateProfileSchema.parse(req.body);
  const user = await updateProfile(req.auth.userId, input);

  sendSuccess(res, { user });
});

usersRouter.post('/me/password', requireAuth, passwordLimiter, async (req, res) => {
  if (!req.auth) {
    throw new AppError(401, 'UNAUTHENTICATED', 'Sign in to continue.');
  }

  const input = changePasswordSchema.parse(req.body);
  await changePassword(req.auth.userId, req.auth.sessionId, input);

  res.status(204).end();
});

usersRouter.get('/search', requireAuth, requireVerifiedEmail, searchLimiter, async (req, res) => {
  if (!req.auth) {
    throw new AppError(401, 'UNAUTHENTICATED', 'Sign in to continue.');
  }

  const { q } = userSearchQuerySchema.parse(req.query);
  const users = await searchUsers(req.auth.userId, q);
  const data: UserSearchData = { users };

  sendSuccess(res, data);
});

usersRouter.get('/:id', requireAuth, requireVerifiedEmail, async (req, res) => {
  const userId = z.uuid().parse(req.params.id);
  const user = await getPublicUser(userId);
  const data: { user: PublicUser } = { user };

  sendSuccess(res, data);
});
