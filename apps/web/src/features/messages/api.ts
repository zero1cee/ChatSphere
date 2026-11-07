import type { MessageDTO, MessageListData, MessageListMeta } from '@chatsphere/shared';

import { apiRequestWithMeta } from '@/lib/api-client';

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
