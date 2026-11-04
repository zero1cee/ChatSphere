import type {
  ConversationDTO,
  ConversationMemberDTO,
  ConversationType,
  MemberRole,
} from '@chatsphere/shared';

import { toPublicUser } from '../users/users.mapper.js';

interface PublicUserRecord {
  id: string;
  name: string;
  username: string;
  avatarUrl: string | null;
  bio: string | null;
  createdAt: Date;
}

interface MemberRecord {
  id: string;
  userId: string;
  role: string;
  joinedAt: Date;
  user: PublicUserRecord;
}

interface ConversationRecord {
  id: string;
  type: string;
  title: string | null;
  avatarUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
  members: MemberRecord[];
}

function toConversationMemberDTO(member: MemberRecord): ConversationMemberDTO {
  return {
    id: member.id,
    userId: member.userId,
    role: member.role as MemberRole,
    joinedAt: member.joinedAt.toISOString(),
    user: toPublicUser(member.user),
  };
}

const roleOrder: Record<string, number> = {
  OWNER: 0,
  ADMIN: 1,
  MEMBER: 2,
};

export function toConversationDTO(conversation: ConversationRecord): ConversationDTO {
  const members = [...conversation.members].sort((first, second) => {
    const roleDifference = (roleOrder[first.role] ?? 3) - (roleOrder[second.role] ?? 3);

    if (roleDifference !== 0) {
      return roleDifference;
    }

    const joinedDifference = first.joinedAt.getTime() - second.joinedAt.getTime();

    if (joinedDifference !== 0) {
      return joinedDifference;
    }

    return first.user.name.localeCompare(second.user.name);
  });

  return {
    id: conversation.id,
    type: conversation.type as ConversationType,
    title: conversation.title,
    avatarUrl: conversation.avatarUrl,
    createdAt: conversation.createdAt.toISOString(),
    updatedAt: conversation.updatedAt.toISOString(),
    members: members.map(toConversationMemberDTO),
  };
}
