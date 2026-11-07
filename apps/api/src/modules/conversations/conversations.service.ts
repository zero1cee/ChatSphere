import type {
  AddConversationMembersInput,
  ConversationDTO,
  CreateConversationInput,
  MemberRole,
  UpdateConversationInput,
  UpdateMemberRoleInput,
} from '@chatsphere/shared';
import { MAX_GROUP_MEMBERS } from '@chatsphere/shared';

import type { Prisma } from '../../generated/prisma/client.js';
import { AppError } from '../../lib/errors.js';
import { prisma } from '../../lib/prisma.js';
import { isPrismaUniqueConstraintError } from '../../lib/prisma-errors.js';
import { createMembershipNotifications } from '../notifications/notifications.service.js';
import { toConversationDTO } from './conversations.mapper.js';

const publicUserSelect = {
  id: true,
  name: true,
  username: true,
  avatarUrl: true,
  bio: true,
  createdAt: true,
} as const;

const conversationInclude = {
  members: {
    include: {
      user: {
        select: publicUserSelect,
      },
    },
    orderBy: { joinedAt: 'asc' },
  },
  messages: {
    take: 1,
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    select: {
      id: true,
      content: true,
      createdAt: true,
      deletedAt: true,
      _count: {
        select: {
          attachments: true,
        },
      },
      sender: {
        select: {
          id: true,
          name: true,
          username: true,
        },
      },
    },
  },
} satisfies Prisma.ConversationInclude;

export interface CreateConversationResult {
  conversation: ConversationDTO;
  created: boolean;
}

async function getMembership(conversationId: string, userId: string) {
  const membership = await prisma.conversationMember.findUnique({
    where: {
      conversationId_userId: { conversationId, userId },
    },
    include: {
      conversation: {
        include: conversationInclude,
      },
    },
  });

  if (!membership) {
    throw new AppError(404, 'CONVERSATION_NOT_FOUND', 'Conversation not found.');
  }

  return membership;
}

function requireGroup(type: string): void {
  if (type !== 'GROUP') {
    throw new AppError(
      400,
      'NOT_A_GROUP',
      'This action is only available for group conversations.',
    );
  }
}

function requireRole(role: string, allowed: MemberRole[]): void {
  if (!allowed.includes(role as MemberRole)) {
    throw new AppError(403, 'FORBIDDEN', 'You do not have permission to do that.');
  }
}

export async function listConversations(userId: string): Promise<ConversationDTO[]> {
  const memberships = await prisma.conversationMember.findMany({
    where: { userId, hiddenAt: null },
    include: {
      conversation: {
        include: conversationInclude,
      },
    },
    orderBy: {
      conversation: {
        updatedAt: 'desc',
      },
    },
  });

  return memberships.map((membership) => toConversationDTO(membership.conversation));
}

export async function getConversation(
  conversationId: string,
  userId: string,
): Promise<ConversationDTO> {
  const membership = await getMembership(conversationId, userId);
  return toConversationDTO(membership.conversation);
}

export async function createDirectConversation(
  userId: string,
  targetUserId: string,
): Promise<CreateConversationResult> {
  if (userId === targetUserId) {
    throw new AppError(
      400,
      'CANNOT_MESSAGE_SELF',
      'You cannot start a conversation with yourself.',
    );
  }

  const target = await prisma.user.findFirst({
    where: { id: targetUserId, emailVerifiedAt: { not: null } },
    select: { id: true },
  });

  if (!target) {
    throw new AppError(404, 'USER_NOT_FOUND', 'That user could not be found.');
  }

  const directKey = [userId, targetUserId].sort().join(':');

  try {
    const conversation = await prisma.conversation.create({
      data: {
        type: 'DIRECT',
        directKey,
        members: {
          create: [{ userId }, { userId: targetUserId }],
        },
      },
      include: conversationInclude,
    });

    return { conversation: toConversationDTO(conversation), created: true };
  } catch (error) {
    if (!isPrismaUniqueConstraintError(error)) {
      throw error;
    }

    // A concurrent request won the race. Return the existing direct conversation
    // and make sure this caller can see it again.
    const existing = await prisma.conversation.findUnique({
      where: { directKey },
      include: conversationInclude,
    });

    if (!existing) {
      throw error;
    }

    await prisma.conversationMember.updateMany({
      where: { conversationId: existing.id, userId },
      data: { hiddenAt: null },
    });

    const visible = await prisma.conversation.findUniqueOrThrow({
      where: { id: existing.id },
      include: conversationInclude,
    });

    return { conversation: toConversationDTO(visible), created: false };
  }
}

export async function createGroupConversation(
  creatorId: string,
  input: Extract<CreateConversationInput, { type: 'GROUP' }>,
): Promise<ConversationDTO> {
  const memberIds = [...new Set(input.memberIds)].filter((id) => id !== creatorId);

  if (memberIds.length === 0) {
    throw new AppError(400, 'GROUP_NEEDS_MEMBERS', 'Add at least one other member to the group.');
  }

  if (memberIds.length + 1 > MAX_GROUP_MEMBERS) {
    throw new AppError(
      400,
      'GROUP_TOO_LARGE',
      `Groups can have at most ${MAX_GROUP_MEMBERS} members.`,
    );
  }

  const users = await prisma.user.findMany({
    where: { id: { in: memberIds }, emailVerifiedAt: { not: null } },
    select: { id: true },
  });

  if (users.length !== memberIds.length) {
    throw new AppError(400, 'INVALID_MEMBERS', 'One or more selected users are unavailable.');
  }

  const conversation = await prisma.conversation.create({
    data: {
      type: 'GROUP',
      title: input.title,
      members: {
        create: [{ userId: creatorId, role: 'OWNER' }, ...memberIds.map((userId) => ({ userId }))],
      },
    },
    include: conversationInclude,
  });

  return toConversationDTO(conversation);
}

export async function updateGroupConversation(
  conversationId: string,
  userId: string,
  input: UpdateConversationInput,
): Promise<ConversationDTO> {
  const membership = await getMembership(conversationId, userId);
  requireGroup(membership.conversation.type);
  requireRole(membership.role, ['OWNER', 'ADMIN']);

  const conversation = await prisma.conversation.update({
    where: { id: conversationId },
    data: { title: input.title },
    include: conversationInclude,
  });

  return toConversationDTO(conversation);
}

export async function deleteConversation(conversationId: string, userId: string): Promise<void> {
  const membership = await getMembership(conversationId, userId);

  if (membership.conversation.type === 'DIRECT') {
    await prisma.conversationMember.update({
      where: { id: membership.id },
      data: { hiddenAt: new Date() },
    });
    return;
  }

  requireRole(membership.role, ['OWNER']);
  await prisma.conversation.delete({ where: { id: conversationId } });
}

export async function addConversationMembers(
  conversationId: string,
  userId: string,
  input: AddConversationMembersInput,
): Promise<ConversationDTO> {
  const membership = await getMembership(conversationId, userId);
  requireGroup(membership.conversation.type);
  requireRole(membership.role, ['OWNER', 'ADMIN']);

  const existingUserIds = new Set(membership.conversation.members.map((member) => member.userId));
  const requested = [...new Set(input.userIds)];

  if (requested.some((id) => existingUserIds.has(id))) {
    throw new AppError(409, 'ALREADY_MEMBER', 'One or more users are already in this group.');
  }

  if (existingUserIds.size + requested.length > MAX_GROUP_MEMBERS) {
    throw new AppError(
      400,
      'GROUP_TOO_LARGE',
      `Groups can have at most ${MAX_GROUP_MEMBERS} members.`,
    );
  }

  const users = await prisma.user.findMany({
    where: { id: { in: requested }, emailVerifiedAt: { not: null } },
    select: { id: true },
  });

  if (users.length !== requested.length) {
    throw new AppError(400, 'INVALID_MEMBERS', 'One or more selected users are unavailable.');
  }

  try {
    await prisma.$transaction([
      prisma.conversationMember.createMany({
        data: requested.map((memberId) => ({
          conversationId,
          userId: memberId,
        })),
      }),
      prisma.conversation.update({
        where: { id: conversationId },
        data: { updatedAt: new Date() },
      }),
    ]);
  } catch (error) {
    if (isPrismaUniqueConstraintError(error)) {
      throw new AppError(409, 'ALREADY_MEMBER', 'One or more users are already in this group.');
    }

    throw error;
  }

  const conversation = await prisma.conversation.findUniqueOrThrow({
    where: { id: conversationId },
    include: conversationInclude,
  });
  const actor = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true },
  });

  await createMembershipNotifications({
    userIds: requested,
    type: 'GROUP_ADDED',
    conversationId,
    conversationTitle: conversation.title || 'Group conversation',
    actorName: actor?.name ?? 'A member',
  });

  return toConversationDTO(conversation);
}

export async function updateMemberRole(
  conversationId: string,
  actorId: string,
  targetUserId: string,
  input: UpdateMemberRoleInput,
): Promise<ConversationDTO> {
  const membership = await getMembership(conversationId, actorId);
  requireGroup(membership.conversation.type);
  requireRole(membership.role, ['OWNER']);

  const target = membership.conversation.members.find((member) => member.userId === targetUserId);

  if (!target) {
    throw new AppError(404, 'MEMBER_NOT_FOUND', 'That member is not in this group.');
  }

  if (targetUserId === actorId) {
    throw new AppError(
      400,
      'CANNOT_CHANGE_OWN_ROLE',
      'Transfer ownership to another member instead of changing your own role.',
    );
  }

  if (target.role === 'OWNER') {
    throw new AppError(400, 'CANNOT_CHANGE_OWNER', 'The group owner cannot be changed directly.');
  }

  if (input.role === 'OWNER') {
    await prisma.$transaction([
      prisma.conversationMember.update({
        where: { id: membership.id },
        data: { role: 'ADMIN' },
      }),
      prisma.conversationMember.update({
        where: { id: target.id },
        data: { role: 'OWNER' },
      }),
    ]);
  } else {
    await prisma.conversationMember.update({
      where: { id: target.id },
      data: { role: input.role },
    });
  }

  const conversation = await prisma.conversation.findUniqueOrThrow({
    where: { id: conversationId },
    include: conversationInclude,
  });
  const actor = await prisma.user.findUnique({
    where: { id: actorId },
    select: { name: true },
  });

  await createMembershipNotifications({
    userIds: [targetUserId],
    type: 'GROUP_ROLE_CHANGED',
    conversationId,
    conversationTitle: conversation.title || 'Group conversation',
    actorName: actor?.name ?? 'A group owner',
    role: input.role,
  });

  return toConversationDTO(conversation);
}

export async function removeConversationMember(
  conversationId: string,
  actorId: string,
  targetUserId: string,
): Promise<void> {
  const membership = await getMembership(conversationId, actorId);
  requireGroup(membership.conversation.type);

  if (targetUserId === actorId) {
    if (membership.role === 'OWNER') {
      throw new AppError(
        409,
        'OWNER_CANNOT_LEAVE',
        'Transfer ownership or delete the group before leaving.',
      );
    }

    await prisma.conversationMember.delete({ where: { id: membership.id } });
    return;
  }

  requireRole(membership.role, ['OWNER', 'ADMIN']);

  const target = membership.conversation.members.find((member) => member.userId === targetUserId);

  if (!target) {
    throw new AppError(404, 'MEMBER_NOT_FOUND', 'That member is not in this group.');
  }

  if (target.role === 'OWNER') {
    throw new AppError(403, 'FORBIDDEN', 'The group owner cannot be removed.');
  }

  if (membership.role === 'ADMIN' && target.role === 'ADMIN') {
    throw new AppError(403, 'FORBIDDEN', 'Admins cannot remove other admins.');
  }

  await prisma.conversationMember.delete({ where: { id: target.id } });
  const actor = await prisma.user.findUnique({
    where: { id: actorId },
    select: { name: true },
  });

  await createMembershipNotifications({
    userIds: [targetUserId],
    type: 'GROUP_REMOVED',
    conversationId,
    conversationTitle: membership.conversation.title || 'Group conversation',
    actorName: actor?.name ?? 'A group admin',
  });
}
