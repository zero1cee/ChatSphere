'use client';

import type { ConversationDTO } from '@chatsphere/shared';
import { MessageSquare } from 'lucide-react';
import Link from 'next/link';

import { UserAvatar } from '@/components/app/user-avatar';
import { getConversationSubtitle, getConversationTitle, getOtherMember } from '@/lib/conversation';
import { cn } from '@/lib/utils';

function ConversationItem({
  conversation,
  currentUserId,
  active,
}: {
  conversation: ConversationDTO;
  currentUserId: string;
  active: boolean;
}) {
  const title = getConversationTitle(conversation, currentUserId);
  const other = conversation.type === 'DIRECT' ? getOtherMember(conversation, currentUserId) : null;
  const avatarName = other?.user.name ?? title;

  return (
    <Link
      href={`/chats/${conversation.id}`}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'flex items-center gap-3 rounded-xl px-2.5 py-2.5 transition-colors',
        active ? 'bg-muted text-foreground' : 'hover:bg-muted/70',
      )}
    >
      <UserAvatar name={avatarName} />
      <span className="min-w-0 flex-1">
        <span className="flex items-center justify-between gap-2">
          <span className="truncate text-sm font-medium">{title}</span>
          {conversation.type === 'GROUP' ? (
            <span className="shrink-0 text-[0.6rem] uppercase tracking-[0.12em] text-muted-foreground">
              Group
            </span>
          ) : null}
        </span>
        <span className="mt-0.5 block truncate text-xs text-muted-foreground">
          {getConversationSubtitle(conversation, currentUserId)}
        </span>
      </span>
    </Link>
  );
}

export function ConversationList({
  conversations,
  currentUserId,
  activeConversationId,
  isLoading,
  isError,
  search,
  onClearSearch,
}: {
  conversations: ConversationDTO[];
  currentUserId: string;
  activeConversationId: string | null;
  isLoading: boolean;
  isError: boolean;
  search: string;
  onClearSearch: () => void;
}) {
  if (isLoading) {
    return (
      <div className="space-y-2 p-1" role="status">
        <span className="sr-only">Loading conversations</span>
        {['one', 'two', 'three', 'four'].map((skeleton) => (
          <div key={skeleton} className="flex items-center gap-3 rounded-xl p-2.5">
            <div className="size-10 animate-pulse rounded-full bg-muted" />
            <div className="flex-1 space-y-2">
              <div className="h-3 w-24 animate-pulse rounded bg-muted" />
              <div className="h-2.5 w-32 animate-pulse rounded bg-muted" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="px-3 py-10 text-center">
        <p className="text-sm font-medium">Conversations could not load.</p>
        <p className="mt-1 text-xs text-muted-foreground">Refresh the page to try again.</p>
      </div>
    );
  }

  if (conversations.length === 0) {
    return (
      <div className="px-3 py-10 text-center">
        <span className="mx-auto grid size-10 place-items-center rounded-xl bg-muted text-muted-foreground">
          <MessageSquare className="size-4" aria-hidden="true" />
        </span>
        <p className="mt-3 text-sm font-medium">
          {search ? 'No matching conversations' : 'No conversations yet'}
        </p>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          {search
            ? 'Try a different name or username.'
            : 'Start a direct conversation or create a group with the button above.'}
        </p>
        {search ? (
          <button
            type="button"
            onClick={onClearSearch}
            className="mt-3 text-xs font-medium text-primary underline-offset-4 hover:underline"
          >
            Clear search
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-1 p-1">
      {conversations.map((conversation) => (
        <ConversationItem
          key={conversation.id}
          conversation={conversation}
          currentUserId={currentUserId}
          active={activeConversationId === conversation.id}
        />
      ))}
    </div>
  );
}
