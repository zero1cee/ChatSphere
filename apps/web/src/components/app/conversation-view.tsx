'use client';

import { ArrowLeft, Info, Loader2, MessagesSquare } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

import { ConversationDetailsDialog } from '@/components/app/conversation-details-dialog';
import { UserAvatar } from '@/components/app/user-avatar';
import { Button } from '@/components/ui/button';
import { useConversation } from '@/features/conversations/queries';
import { ApiError } from '@/lib/api-client';
import { getConversationSubtitle, getConversationTitle, getOtherMember } from '@/lib/conversation';
import { useAuthStore } from '@/stores/auth-store';

export function ConversationView({ conversationId }: { conversationId: string }) {
  const user = useAuthStore((state) => state.user);
  const conversationQuery = useConversation(conversationId);
  const [detailsOpen, setDetailsOpen] = useState(false);

  if (!user) {
    return null;
  }

  if (conversationQuery.isLoading) {
    return (
      <div className="grid h-full w-full place-items-center bg-canvas">
        <Loader2 className="size-5 animate-spin text-muted-foreground" aria-label="Loading" />
      </div>
    );
  }

  if (conversationQuery.isError || !conversationQuery.data) {
    const notFound =
      conversationQuery.error instanceof ApiError && conversationQuery.error.status === 404;

    return (
      <div className="flex h-full w-full flex-col items-center justify-center bg-canvas px-6 text-center">
        <span className="grid size-12 place-items-center rounded-2xl border border-border/80 bg-card text-muted-foreground">
          <MessagesSquare className="size-5" aria-hidden="true" />
        </span>
        <h1 className="mt-4 font-display text-3xl">
          {notFound ? 'Conversation not found.' : 'This conversation could not load.'}
        </h1>
        <p className="mt-2 max-w-sm text-sm text-muted-foreground">
          {notFound
            ? 'It may have been removed, or you may not be a member.'
            : 'Check your connection and try again.'}
        </p>
        <div className="mt-5 flex gap-2">
          <Button asChild variant="outline" className="rounded-xl">
            <Link href="/chats">Back to chats</Link>
          </Button>
          {!notFound ? (
            <Button
              type="button"
              className="rounded-xl"
              onClick={() => void conversationQuery.refetch()}
            >
              Try again
            </Button>
          ) : null}
        </div>
      </div>
    );
  }

  const conversation = conversationQuery.data;
  const title = getConversationTitle(conversation, user.id);
  const subtitle = getConversationSubtitle(conversation, user.id);
  const other = conversation.type === 'DIRECT' ? getOtherMember(conversation, user.id) : null;
  const avatarName = other?.user.name ?? title;

  return (
    <div className="flex h-full min-h-0 w-full flex-col bg-canvas">
      <header className="flex h-16 shrink-0 items-center gap-3 border-b border-border/70 bg-background px-3 sm:px-5">
        <Link
          href="/chats"
          aria-label="Back to conversations"
          className="grid size-9 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground lg:hidden"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
        </Link>

        <UserAvatar name={avatarName} />

        <div className="min-w-0 flex-1">
          <h1 className="truncate text-sm font-semibold">{title}</h1>
          <p className="truncate text-xs text-muted-foreground">{subtitle}</p>
        </div>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="rounded-full"
          onClick={() => setDetailsOpen(true)}
        >
          <Info className="size-4" aria-hidden="true" />
          Details
        </Button>
      </header>

      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex flex-1 flex-col items-center justify-center px-6 py-10 text-center">
          <div className="flex -space-x-2">
            {conversation.members.slice(0, 4).map((member) => (
              <UserAvatar
                key={member.id}
                name={member.user.name}
                size="lg"
                className="ring-4 ring-canvas"
              />
            ))}
            {conversation.members.length > 4 ? (
              <span className="grid size-12 place-items-center rounded-full bg-muted text-xs font-medium text-muted-foreground ring-4 ring-canvas">
                +{conversation.members.length - 4}
              </span>
            ) : null}
          </div>

          <p className="mt-6 text-xs font-semibold uppercase tracking-[0.18em] text-primary">
            {conversation.type === 'GROUP' ? 'Group conversation' : 'Direct conversation'}
          </p>
          <h2 className="mt-2 max-w-xl font-display text-4xl leading-tight tracking-[-0.02em] text-balance">
            {conversation.type === 'GROUP'
              ? `Welcome to ${title}.`
              : `A new conversation with ${title}.`}
          </h2>
          <p className="mt-3 max-w-md text-sm leading-relaxed text-muted-foreground">
            {conversation.type === 'GROUP'
              ? `${conversation.members.length} people are in this group. Messaging and real-time delivery are the next milestone.`
              : `This is the beginning of your conversation. Messaging and real-time delivery are the next milestone.`}
          </p>

          {other?.user.bio ? (
            <p className="mt-4 max-w-md rounded-xl border border-border/70 bg-background/60 px-4 py-3 text-sm italic text-muted-foreground">
              “{other.user.bio}”
            </p>
          ) : null}
        </div>

        <div className="shrink-0 border-t border-border/70 bg-background p-3 sm:p-4">
          <div className="flex items-center gap-2.5 rounded-xl border border-dashed border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
            <MessagesSquare className="size-4 shrink-0" aria-hidden="true" />
            <span>Messaging is next. This conversation is ready for it.</span>
          </div>
        </div>
      </div>

      <ConversationDetailsDialog
        conversation={conversation}
        currentUserId={user.id}
        open={detailsOpen}
        onOpenChange={setDetailsOpen}
      />
    </div>
  );
}
