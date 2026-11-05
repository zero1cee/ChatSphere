import type { MessagePreviewDTO } from './messages.js';
import type { PublicUser } from './users.js';

export type ConversationType = 'DIRECT' | 'GROUP';
export type MemberRole = 'OWNER' | 'ADMIN' | 'MEMBER';

export interface ConversationMemberDTO {
  id: string;
  userId: string;
  role: MemberRole;
  joinedAt: string;
  user: PublicUser;
}

export interface ConversationDTO {
  id: string;
  type: ConversationType;
  title: string | null;
  avatarUrl: string | null;
  createdAt: string;
  updatedAt: string;
  members: ConversationMemberDTO[];
  lastMessage: MessagePreviewDTO | null;
}

export interface ConversationListData {
  conversations: ConversationDTO[];
}

export interface ConversationData {
  conversation: ConversationDTO;
}
