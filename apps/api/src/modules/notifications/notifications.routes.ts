import { notificationReadSchema } from '@chatsphere/shared';
import { Router } from 'express';
import { z } from 'zod';

import { sendSuccess } from '../../lib/api-response.js';
import { AppError } from '../../lib/errors.js';
import { requireAuth, requireVerifiedEmail } from '../../middleware/auth.js';
import {
  listNotifications,
  markNotificationRead,
  markNotificationsRead,
} from './notifications.service.js';

export const notificationsRouter = Router();

notificationsRouter.use(requireAuth, requireVerifiedEmail);

function userId(req: { auth?: { userId: string } }): string {
  if (!req.auth) {
    throw new AppError(401, 'UNAUTHENTICATED', 'Sign in to continue.');
  }

  return req.auth.userId;
}

notificationsRouter.get('/', async (req, res) => {
  sendSuccess(res, await listNotifications(userId(req)));
});

notificationsRouter.post('/read', async (req, res) => {
  const input = notificationReadSchema.parse(req.body);
  const updated = await markNotificationsRead(userId(req), input.conversationId);
  sendSuccess(res, { updated });
});

notificationsRouter.post('/:id/read', async (req, res) => {
  const notificationId = z.uuid().parse(req.params.id);
  await markNotificationRead(userId(req), notificationId);
  sendSuccess(res, { read: true });
});
