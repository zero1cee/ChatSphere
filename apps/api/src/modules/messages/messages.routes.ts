import type { MessageDTO } from '@chatsphere/shared';
import { editMessageSchema, reactionSchema } from '@chatsphere/shared';
import { Router } from 'express';
import { z } from 'zod';

import { sendSuccess } from '../../lib/api-response.js';
import { AppError } from '../../lib/errors.js';
import { requireAuth, requireVerifiedEmail } from '../../middleware/auth.js';
import { emitToUsers } from '../../realtime/events.js';
import {
  addReaction,
  deleteMessage,
  editMessage,
  getConversationPreview,
  type MessageActionResult,
  removeReaction,
} from './messages.service.js';

export const messagesRouter = Router();

messagesRouter.use(requireAuth, requireVerifiedEmail);

function userId(req: { auth?: { userId: string } }): string {
  if (!req.auth) {
    throw new AppError(401, 'UNAUTHENTICATED', 'Sign in to continue.');
  }

  return req.auth.userId;
}

async function broadcastMessage(result: MessageActionResult, includePreview: boolean) {
  emitToUsers(result.memberIds, 'message:updated', { message: result.message });

  if (includePreview) {
    const preview = await getConversationPreview(result.message.conversationId);
    emitToUsers(result.memberIds, 'conversation:updated', {
      conversationId: result.message.conversationId,
      updatedAt: preview.updatedAt,
      lastMessage: preview.lastMessage,
    });
  }
}

messagesRouter.patch('/:id', async (req, res) => {
  const messageId = z.uuid().parse(req.params.id);
  const input = editMessageSchema.parse(req.body);
  const result = await editMessage(messageId, userId(req), input.content);
  await broadcastMessage(result, true);
  const data: { message: MessageDTO } = { message: result.message };

  sendSuccess(res, data);
});

messagesRouter.delete('/:id', async (req, res) => {
  const messageId = z.uuid().parse(req.params.id);
  const result = await deleteMessage(messageId, userId(req));
  await broadcastMessage(result, true);
  const data: { message: MessageDTO } = { message: result.message };

  sendSuccess(res, data);
});

messagesRouter.post('/:id/reactions', async (req, res) => {
  const messageId = z.uuid().parse(req.params.id);
  const input = reactionSchema.parse(req.body);
  const result = await addReaction(messageId, userId(req), input.emoji);
  await broadcastMessage(result, false);
  const data: { message: MessageDTO } = { message: result.message };

  sendSuccess(res, data);
});

messagesRouter.delete('/:id/reactions/:emoji', async (req, res) => {
  const messageId = z.uuid().parse(req.params.id);
  const emoji = z.string().min(1).max(32).parse(req.params.emoji);
  const result = await removeReaction(messageId, userId(req), emoji);
  await broadcastMessage(result, false);
  const data: { message: MessageDTO } = { message: result.message };

  sendSuccess(res, data);
});
