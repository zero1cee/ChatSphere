import type { ConversationDTO, ConversationMemberDTO } from '@chatsphere/shared';

export function getInitials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

export function getOtherMember(
  conversation: ConversationDTO,
  currentUserId: string,
): ConversationMemberDTO | undefined {
  return conversation.members.find((member) => member.userId !== currentUserId);
}

export function getConversationTitle(conversation: ConversationDTO, currentUserId: string): string {
  if (conversation.type === 'GROUP') {
    return conversation.title || 'Group conversation';
  }

  return getOtherMember(conversation, currentUserId)?.user.name ?? 'Direct message';
}

export function getConversationSubtitle(
  conversation: ConversationDTO,
  currentUserId: string,
): string {
  if (conversation.type === 'GROUP') {
    return `${conversation.members.length} ${conversation.members.length === 1 ? 'member' : 'members'}`;
  }

  const other = getOtherMember(conversation, currentUserId);
  return other ? `@${other.user.username}` : 'Direct message';
}

export function getMemberRole(
  conversation: ConversationDTO,
  userId: string,
): ConversationMemberDTO['role'] | undefined {
  return conversation.members.find((member) => member.userId === userId)?.role;
}

export function canManageGroup(role: ConversationMemberDTO['role'] | undefined): boolean {
  return role === 'OWNER' || role === 'ADMIN';
}

export function getConversationPreview(
  conversation: ConversationDTO,
  currentUserId: string,
): string {
  const lastMessage = conversation.lastMessage;

  if (!lastMessage) {
    return getConversationSubtitle(conversation, currentUserId);
  }

  const content =
    lastMessage.deletedAt || !lastMessage.content
      ? 'Message deleted'
      : lastMessage.content.replace(/\s+/g, ' ').trim();

  if (conversation.type === 'DIRECT') {
    return content;
  }

  return lastMessage.sender.id === currentUserId
    ? `You: ${content}`
    : `${lastMessage.sender.name}: ${content}`;
}
