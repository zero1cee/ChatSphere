import type { MeData } from '@chatsphere/shared';
import { Router } from 'express';

import { sendSuccess } from '../../lib/api-response.js';
import { AppError } from '../../lib/errors.js';
import { requireAuth } from '../../middleware/auth.js';
import { getCurrentUser } from './users.service.js';

export const usersRouter = Router();

usersRouter.get('/me', requireAuth, async (req, res) => {
  if (!req.auth) {
    throw new AppError(401, 'UNAUTHENTICATED', 'Sign in to continue.');
  }

  const user = await getCurrentUser(req.auth.userId);
  const data: MeData = { user };

  sendSuccess(res, data);
});
