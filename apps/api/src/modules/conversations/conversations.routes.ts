import type {
  AddConversationMembersInput,
  ConversationData,
  ConversationListData,
  CreateConversationInput,
  MessageListData,
  UpdateConversationInput,
  UpdateMemberRoleInput,
} from '@chatsphere/shared';
import {
  addConversationMembersSchema,
  createConversationSchema,
  updateConversationSchema,
  updateMemberRoleSchema,
} from '@chatsphere/shared';
import { Router } from 'express';
import { z } from 'zod';

import { sendSuccess } from '../../lib/api-response.js';
import { AppError } from '../../lib/errors.js';
import { requireAuth, requireVerifiedEmail } from '../../middleware/auth.js';
import { listMessages } from '../messages/messages.service.js';
import {
  addConversationMembers,
  createDirectConversation,
  createGroupConversation,
  deleteConversation,
  getConversation,
  listConversations,
  removeConversationMember,
  updateGroupConversation,
  updateMemberRole,
} from './conversations.service.js';

export const conversationsRouter = Router();

conversationsRouter.use(requireAuth, requireVerifiedEmail);

const historyQuerySchema = z
  .object({
    before: z.string().optional(),
    after: z.string().optional(),
    limit: z.coerce.number().int().min(1).max(50).optional(),
  })
  .strict();

function userId(req: { auth?: { userId: string } }): string {
  if (!req.auth) {
    throw new AppError(401, 'UNAUTHENTICATED', 'Sign in to continue.');
  }

  return req.auth.userId;
}

conversationsRouter.get('/', async (req, res) => {
  const conversations = await listConversations(userId(req));
  const data: ConversationListData = { conversations };

  sendSuccess(res, data);
});

conversationsRouter.post('/', async (req, res) => {
  const input = createConversationSchema.parse(req.body) as CreateConversationInput;
  const actorId = userId(req);

  if (input.type === 'DIRECT') {
    const result = await createDirectConversation(actorId, input.userId);
    const data: ConversationData = { conversation: result.conversation };

    sendSuccess(res, data, result.created ? 201 : 200);
    return;
  }

  const conversation = await createGroupConversation(actorId, input);
  const data: ConversationData = { conversation };

  sendSuccess(res, data, 201);
});

conversationsRouter.get('/:id/messages', async (req, res) => {
  const conversationId = z.uuid().parse(req.params.id);
  const query = historyQuerySchema.parse(req.query);
  const result = await listMessages(conversationId, userId(req), query);
  const data: MessageListData = { messages: result.messages };

  sendSuccess(res, data, 200, result.meta);
});

conversationsRouter.get('/:id', async (req, res) => {
  const conversationId = z.uuid().parse(req.params.id);
  const conversation = await getConversation(conversationId, userId(req));
  const data: ConversationData = { conversation };

  sendSuccess(res, data);
});

conversationsRouter.patch('/:id', async (req, res) => {
  const conversationId = z.uuid().parse(req.params.id);
  const input = updateConversationSchema.parse(req.body) as UpdateConversationInput;
  const conversation = await updateGroupConversation(conversationId, userId(req), input);
  const data: ConversationData = { conversation };

  sendSuccess(res, data);
});

conversationsRouter.delete('/:id', async (req, res) => {
  const conversationId = z.uuid().parse(req.params.id);
  await deleteConversation(conversationId, userId(req));

  res.status(204).end();
});

conversationsRouter.post('/:id/members', async (req, res) => {
  const conversationId = z.uuid().parse(req.params.id);
  const input = addConversationMembersSchema.parse(req.body) as AddConversationMembersInput;
  const conversation = await addConversationMembers(conversationId, userId(req), input);
  const data: ConversationData = { conversation };

  sendSuccess(res, data);
});

conversationsRouter.patch('/:id/members/:userId', async (req, res) => {
  const conversationId = z.uuid().parse(req.params.id);
  const targetUserId = z.uuid().parse(req.params.userId);
  const input = updateMemberRoleSchema.parse(req.body) as UpdateMemberRoleInput;
  const conversation = await updateMemberRole(conversationId, userId(req), targetUserId, input);
  const data: ConversationData = { conversation };

  sendSuccess(res, data);
});

conversationsRouter.delete('/:id/members/:userId', async (req, res) => {
  const conversationId = z.uuid().parse(req.params.id);
  const targetUserId = z.uuid().parse(req.params.userId);
  await removeConversationMember(conversationId, userId(req), targetUserId);

  res.status(204).end();
});
