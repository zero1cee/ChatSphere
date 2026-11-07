import type { MessageDTO, MessageListData, MessageListMeta } from '@chatsphere/shared';

import { apiRequest, apiRequestWithMeta } from '@/lib/api-client';

export interface MessagePage {
  messages: MessageDTO[];
  meta: MessageListMeta;
}

const emptyMeta: MessageListMeta = {
  hasMore: false,
  oldestCursor: null,
  newestCursor: null,
};

export async function fetchMessagePage(
  conversationId: string,
  before?: string,
): Promise<MessagePage> {
  const params = new URLSearchParams({ limit: '30' });

  if (before) {
    params.set('before', before);
  }

  const payload = await apiRequestWithMeta<MessageListData, MessageListMeta>(
    `/api/conversations/${conversationId}/messages?${params.toString()}`,
  );

  return {
    messages: payload.data.messages,
    meta: payload.meta ?? emptyMeta,
  };
}

export function editMessageRequest(
  messageId: string,
  content: string,
): Promise<{ message: MessageDTO }> {
  return apiRequest<{ message: MessageDTO }>(`/api/messages/${messageId}`, {
    method: 'PATCH',
    body: { content },
  });
}

export function deleteMessageRequest(messageId: string): Promise<{ message: MessageDTO }> {
  return apiRequest<{ message: MessageDTO }>(`/api/messages/${messageId}`, {
    method: 'DELETE',
  });
}

export function addReactionRequest(
  messageId: string,
  emoji: string,
): Promise<{ message: MessageDTO }> {
  return apiRequest<{ message: MessageDTO }>(`/api/messages/${messageId}/reactions`, {
    method: 'POST',
    body: { emoji },
  });
}

export function removeReactionRequest(
  messageId: string,
  emoji: string,
): Promise<{ message: MessageDTO }> {
  return apiRequest<{ message: MessageDTO }>(
    `/api/messages/${messageId}/reactions/${encodeURIComponent(emoji)}`,
    { method: 'DELETE' },
  );
}
