import type {
  AddConversationMembersInput,
  ChangePasswordInput,
  ConversationData,
  ConversationListData,
  CreateConversationInput,
  PublicUser,
  UpdateConversationInput,
  UpdateMemberRoleInput,
  UpdateProfileData,
  UpdateProfileInput,
  UserSearchData,
} from '@chatsphere/shared';

import { apiRequest } from '@/lib/api-client';

export function fetchConversations(): Promise<ConversationListData> {
  return apiRequest<ConversationListData>('/api/conversations');
}

export function fetchConversation(conversationId: string): Promise<ConversationData> {
  return apiRequest<ConversationData>(`/api/conversations/${conversationId}`);
}

export function createConversation(input: CreateConversationInput): Promise<ConversationData> {
  return apiRequest<ConversationData>('/api/conversations', {
    method: 'POST',
    body: input,
  });
}

export function updateConversation(
  conversationId: string,
  input: UpdateConversationInput,
): Promise<ConversationData> {
  return apiRequest<ConversationData>(`/api/conversations/${conversationId}`, {
    method: 'PATCH',
    body: input,
  });
}

export function deleteConversation(conversationId: string): Promise<void> {
  return apiRequest<void>(`/api/conversations/${conversationId}`, {
    method: 'DELETE',
  });
}

export function addConversationMembers(
  conversationId: string,
  input: AddConversationMembersInput,
): Promise<ConversationData> {
  return apiRequest<ConversationData>(`/api/conversations/${conversationId}/members`, {
    method: 'POST',
    body: input,
  });
}

export function updateMemberRole(
  conversationId: string,
  memberId: string,
  input: UpdateMemberRoleInput,
): Promise<ConversationData> {
  return apiRequest<ConversationData>(`/api/conversations/${conversationId}/members/${memberId}`, {
    method: 'PATCH',
    body: input,
  });
}

export function removeConversationMember(conversationId: string, memberId: string): Promise<void> {
  return apiRequest<void>(`/api/conversations/${conversationId}/members/${memberId}`, {
    method: 'DELETE',
  });
}

export function searchUsers(query: string): Promise<UserSearchData> {
  return apiRequest<UserSearchData>(`/api/users/search?q=${encodeURIComponent(query)}`);
}

export function fetchPublicUser(userId: string): Promise<{ user: PublicUser }> {
  return apiRequest<{ user: PublicUser }>(`/api/users/${userId}`);
}

export function updateProfile(input: UpdateProfileInput): Promise<UpdateProfileData> {
  return apiRequest<UpdateProfileData>('/api/users/me', {
    method: 'PATCH',
    body: input,
  });
}

export function changePassword(input: ChangePasswordInput): Promise<void> {
  return apiRequest<void>('/api/users/me/password', {
    method: 'POST',
    body: input,
  });
}
