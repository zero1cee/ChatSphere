import type { MessageDTO } from '@chatsphere/shared';
import type { InfiniteData } from '@tanstack/react-query';
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

import { fetchMessagePage, type MessagePage } from './api';

export const messageKeys = {
  all: ['messages'] as const,
  list: (conversationId: string) => ['messages', conversationId] as const,
};

function compareMessages(first: MessageDTO, second: MessageDTO): number {
  const timeDifference = new Date(first.createdAt).getTime() - new Date(second.createdAt).getTime();

  return timeDifference !== 0 ? timeDifference : first.id.localeCompare(second.id);
}

export function useMessages(conversationId: string) {
  return useInfiniteQuery({
    queryKey: messageKeys.list(conversationId),
    queryFn: ({ pageParam }) => fetchMessagePage(conversationId, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) =>
      lastPage.meta.hasMore && lastPage.meta.oldestCursor ? lastPage.meta.oldestCursor : undefined,
    enabled: Boolean(conversationId),
    staleTime: 10_000,
  });
}

export function flattenMessages(pages: readonly MessagePage[] | undefined): MessageDTO[] {
  const byId = new Map<string, MessageDTO>();

  for (const page of pages ?? []) {
    for (const message of page.messages) {
      byId.set(message.id, message);
    }
  }

  return [...byId.values()].sort(compareMessages);
}

export function useInsertMessage() {
  const queryClient = useQueryClient();

  return useCallback(
    (conversationId: string, message: MessageDTO) => {
      queryClient.setQueryData<InfiniteData<MessagePage>>(
        messageKeys.list(conversationId),
        (current) => {
          if (!current) {
            return current;
          }

          const alreadyPresent = current.pages.some((page) =>
            page.messages.some((existing) => existing.id === message.id),
          );

          if (alreadyPresent) {
            return current;
          }

          return {
            ...current,
            pages: current.pages.map((page, index) =>
              index === 0
                ? {
                    ...page,
                    messages: [...page.messages, message].sort(compareMessages),
                  }
                : page,
            ),
          };
        },
      );
    },
    [queryClient],
  );
}
