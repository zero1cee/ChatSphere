'use client';

import { useQuery } from '@tanstack/react-query';

import { fetchConversation, fetchConversations, searchUsers } from '@/features/conversations/api';

export const conversationKeys = {
  all: ['conversations'] as const,
  detail: (conversationId: string) => ['conversations', conversationId] as const,
};

export function useConversations() {
  return useQuery({
    queryKey: conversationKeys.all,
    queryFn: fetchConversations,
    select: (data) => data.conversations,
  });
}

export function useConversation(conversationId: string) {
  return useQuery({
    queryKey: conversationKeys.detail(conversationId),
    queryFn: () => fetchConversation(conversationId),
    select: (data) => data.conversation,
    enabled: Boolean(conversationId),
  });
}

export function useUserSearch(query: string) {
  const normalized = query.trim();

  return useQuery({
    queryKey: ['users', 'search', normalized],
    queryFn: () => searchUsers(normalized),
    select: (data) => data.users,
    enabled: normalized.length >= 2,
    staleTime: 30_000,
  });
}
