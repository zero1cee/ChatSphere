'use client';

import type { ConversationDTO, MessageDTO, NotificationDTO } from '@chatsphere/shared';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowDown, Loader2, RotateCw } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';

import { MessageBubble } from '@/components/app/message-bubble';
import { type ComposerSendInput, MessageComposer } from '@/components/app/message-composer';
import { UserAvatar } from '@/components/app/user-avatar';
import { Button } from '@/components/ui/button';
import {
  addReactionRequest,
  deleteMessageRequest,
  editMessageRequest,
  removeReactionRequest,
} from '@/features/messages/api';
import {
  flattenMessages,
  updateMessageInCache,
  useInsertMessage,
  useMessages,
} from '@/features/messages/queries';
import { useMarkNotificationsRead } from '@/features/notifications/queries';
import { getConversationTitle, getOtherMember } from '@/lib/conversation';
import { formatDateLabel } from '@/lib/format-time';
import { useSocket } from '@/providers/socket-provider';

interface PendingMessage {
  clientMessageId: string;
  content: string;
  createdAt: string;
  status: 'sending' | 'failed';
  attachmentIds: string[];
  replyToId?: string;
}

function PendingBubble({ pending, onRetry }: { pending: PendingMessage; onRetry: () => void }) {
  return (
    <div className="flex w-full justify-end">
      <div className="flex max-w-[82%] flex-col items-end sm:max-w-[70%]">
        <div
          className={`rounded-2xl rounded-br-md bg-primary px-3.5 py-2.5 text-sm leading-relaxed text-primary-foreground shadow-sm ${
            pending.status === 'failed' ? 'opacity-60' : ''
          }`}
        >
          <p className="whitespace-pre-wrap break-words">{pending.content || 'Attachment'}</p>
        </div>
        <div className="mt-1 flex items-center gap-1 px-1 text-[0.65rem] text-muted-foreground">
          {pending.status === 'sending' ? (
            <>
              <Loader2 className="size-3 animate-spin" aria-hidden="true" />
              Sending…
            </>
          ) : (
            <>
              <span>Not sent</span>
              <button
                type="button"
                onClick={onRetry}
                className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
              >
                <RotateCw className="size-3" aria-hidden="true" />
                Retry
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export function MessageThread({
  conversation,
  currentUserId,
}: {
  conversation: ConversationDTO;
  currentUserId: string;
}) {
  const { socket, status } = useSocket();
  const queryClient = useQueryClient();
  const messagesQuery = useMessages(conversation.id);
  const insertMessage = useInsertMessage();
  const markNotificationsRead = useMarkNotificationsRead();
  const [pending, setPending] = useState<PendingMessage[]>([]);
  const [typingUsers, setTypingUsers] = useState<Record<string, string>>({});
  const [hasNew, setHasNew] = useState(false);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [readTick, setReadTick] = useState(0);
  const [replyTo, setReplyTo] = useState<MessageDTO | null>(null);
  const [focusRequest, setFocusRequest] = useState(0);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState('');
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const topSentinelRef = useRef<HTMLDivElement>(null);
  const atBottomRef = useRef(true);
  const initializedRef = useRef(false);
  const lastMessageIdRef = useRef<string | null>(null);
  const lastReadIdRef = useRef<string | null>(null);
  const typingActiveRef = useRef(false);
  const typingStopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const typingTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const markNotificationsMutate = markNotificationsRead.mutate;

  const messages = useMemo(
    () => flattenMessages(messagesQuery.data?.pages),
    [messagesQuery.data?.pages],
  );
  const connected = status === 'connected' && Boolean(socket?.connected);
  const title = getConversationTitle(conversation, currentUserId);
  const other = conversation.type === 'DIRECT' ? getOtherMember(conversation, currentUserId) : null;
  const hasMessages = messages.length > 0 || pending.length > 0;
  const latestMessage = messages[messages.length - 1];
  const myRole = conversation.members.find((member) => member.userId === currentUserId)?.role;
  const canModerate = conversation.type === 'GROUP' && (myRole === 'OWNER' || myRole === 'ADMIN');
  const typingNames = Object.values(typingUsers);

  useEffect(() => {
    markNotificationsMutate(conversation.id);
  }, [conversation.id, markNotificationsMutate]);

  useEffect(() => {
    const handleFocus = () => {
      if (document.visibilityState === 'visible') {
        setReadTick((current) => current + 1);
      }
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleFocus);

    return () => {
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleFocus);
    };
  }, []);

  useEffect(() => {
    if (!socket || status !== 'connected') {
      return;
    }

    let active = true;
    void socket
      .timeout(5_000)
      .emitWithAck('conversation:join', { conversationId: conversation.id })
      .then((response) => {
        if (active && !response.ok) {
          toast.error(response.error.message);
        }
      })
      .catch(() => {
        // The socket will reconnect; the join effect runs again when it does.
      });

    return () => {
      active = false;
      socket.emit('conversation:leave', { conversationId: conversation.id }, () => {});
    };
  }, [conversation.id, socket, status]);

  useEffect(() => {
    if (!socket) {
      return;
    }

    const handleMessage = ({ message }: { message: MessageDTO }) => {
      if (message.conversationId !== conversation.id) {
        return;
      }

      insertMessage(conversation.id, message);
      setPending((current) =>
        current.filter((item) => item.clientMessageId !== message.clientMessageId),
      );

      if (message.sender.id !== currentUserId) {
        void socket
          .timeout(5_000)
          .emitWithAck('message:delivered', {
            conversationId: conversation.id,
            messageId: message.id,
          })
          .catch(() => {});
        markNotificationsMutate(conversation.id);
      }
    };

    const handleTyping = (payload: {
      conversationId: string;
      userId: string;
      name: string;
      isTyping: boolean;
    }) => {
      if (payload.conversationId !== conversation.id || payload.userId === currentUserId) {
        return;
      }

      const existingTimer = typingTimersRef.current.get(payload.userId);

      if (existingTimer) {
        clearTimeout(existingTimer);
        typingTimersRef.current.delete(payload.userId);
      }

      if (!payload.isTyping) {
        setTypingUsers((current) => {
          const next = { ...current };
          delete next[payload.userId];
          return next;
        });
        return;
      }

      setTypingUsers((current) => ({ ...current, [payload.userId]: payload.name }));
      const timer = setTimeout(() => {
        setTypingUsers((current) => {
          const next = { ...current };
          delete next[payload.userId];
          return next;
        });
        typingTimersRef.current.delete(payload.userId);
      }, 4_000);
      typingTimersRef.current.set(payload.userId, timer);
    };

    const handleNotification = ({ notification }: { notification: NotificationDTO }) => {
      if (notification.conversationId === conversation.id) {
        markNotificationsMutate(conversation.id);
      }
    };

    socket.on('message:new', handleMessage);
    socket.on('typing:updated', handleTyping);
    socket.on('notification:new', handleNotification);

    return () => {
      socket.off('message:new', handleMessage);
      socket.off('typing:updated', handleTyping);
      socket.off('notification:new', handleNotification);

      for (const timer of typingTimersRef.current.values()) {
        clearTimeout(timer);
      }

      typingTimersRef.current.clear();
    };
  }, [conversation.id, currentUserId, insertMessage, markNotificationsMutate, socket]);

  useEffect(() => {
    const container = scrollContainerRef.current;

    if (!container) {
      return;
    }

    const lastId = messages[messages.length - 1]?.id ?? null;

    if (!initializedRef.current && messages.length > 0) {
      initializedRef.current = true;
      lastMessageIdRef.current = lastId;
      requestAnimationFrame(() => {
        container.scrollTop = container.scrollHeight;
      });
      return;
    }

    if (lastId && lastId !== lastMessageIdRef.current) {
      lastMessageIdRef.current = lastId;
      const ownMessage = messages[messages.length - 1]?.sender.id === currentUserId;

      if (atBottomRef.current || ownMessage) {
        atBottomRef.current = true;
        setIsAtBottom(true);
        setHasNew(false);
        requestAnimationFrame(() => {
          container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
        });
      } else {
        setHasNew(true);
      }
    }
  }, [currentUserId, messages]);

  useEffect(() => {
    const container = scrollContainerRef.current;
    const content = contentRef.current;

    if (!container || !content) {
      return;
    }

    const observer = new ResizeObserver(() => {
      if (atBottomRef.current) {
        container.scrollTop = container.scrollHeight;
      }
    });

    observer.observe(content);

    return () => {
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    if (pending.length === 0) {
      return;
    }

    atBottomRef.current = true;
    setIsAtBottom(true);
    setHasNew(false);
    const container = scrollContainerRef.current;

    if (container) {
      requestAnimationFrame(() => {
        container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
      });
    }
  }, [pending.length]);

  const { hasNextPage, isFetchingNextPage, fetchNextPage } = messagesQuery;

  useEffect(() => {
    if (!hasNextPage || isFetchingNextPage) {
      return;
    }

    const sentinel = topSentinelRef.current;
    const root = scrollContainerRef.current;

    if (!sentinel || !root) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !isFetchingNextPage) {
          void fetchNextPage();
        }
      },
      { root, rootMargin: '160px' },
    );

    observer.observe(sentinel);

    return () => {
      observer.disconnect();
    };
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  useEffect(() => {
    if (!socket || !connected || !isAtBottom || !latestMessage) {
      return;
    }

    if (lastReadIdRef.current === latestMessage.id) {
      return;
    }

    lastReadIdRef.current = latestMessage.id;
    void readTick;
    void socket
      .timeout(5_000)
      .emitWithAck('message:read', {
        conversationId: conversation.id,
        messageId: latestMessage.id,
      })
      .catch(() => {});
  }, [connected, conversation.id, isAtBottom, latestMessage, readTick, socket]);

  const handleScroll = () => {
    const container = scrollContainerRef.current;

    if (!container) {
      return;
    }

    const distance = container.scrollHeight - container.scrollTop - container.clientHeight;
    const atBottom = distance < 80;
    atBottomRef.current = atBottom;
    setIsAtBottom(atBottom);

    if (atBottom) {
      setHasNew(false);
    }
  };

  const scrollToBottom = () => {
    const container = scrollContainerRef.current;

    if (container) {
      container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
    }

    atBottomRef.current = true;
    setIsAtBottom(true);
    setHasNew(false);
  };

  const stopTyping = useCallback(() => {
    if (typingStopTimerRef.current) {
      clearTimeout(typingStopTimerRef.current);
      typingStopTimerRef.current = null;
    }

    if (typingActiveRef.current && socket) {
      typingActiveRef.current = false;
      socket.emit('typing:stop', { conversationId: conversation.id });
    }
  }, [conversation.id, socket]);

  const handleTypingActivity = useCallback(() => {
    if (!socket?.connected) {
      return;
    }

    if (!typingActiveRef.current) {
      typingActiveRef.current = true;
      socket.emit('typing:start', { conversationId: conversation.id });
    }

    if (typingStopTimerRef.current) {
      clearTimeout(typingStopTimerRef.current);
    }

    typingStopTimerRef.current = setTimeout(() => {
      stopTyping();
    }, 1_500);
  }, [conversation.id, socket, stopTyping]);

  useEffect(() => {
    return () => {
      if (typingStopTimerRef.current) {
        clearTimeout(typingStopTimerRef.current);
      }

      if (typingActiveRef.current && socket) {
        typingActiveRef.current = false;
        socket.emit('typing:stop', { conversationId: conversation.id });
      }
    };
  }, [conversation.id, socket]);

  const sendMessage = useCallback(
    async (input: ComposerSendInput): Promise<boolean> => {
      if (!socket?.connected) {
        toast.error('Still reconnecting. Try again in a moment.');
        return false;
      }

      const clientMessageId = crypto.randomUUID();
      const createdAt = new Date().toISOString();

      setPending((current) => [
        ...current,
        {
          clientMessageId,
          content: input.content,
          createdAt,
          status: 'sending',
          attachmentIds: input.attachmentIds,
          replyToId: input.replyToId,
        },
      ]);

      try {
        const response = await socket.timeout(10_000).emitWithAck('message:send', {
          conversationId: conversation.id,
          clientMessageId,
          ...(input.content ? { content: input.content } : {}),
          ...(input.attachmentIds.length > 0 ? { attachmentIds: input.attachmentIds } : {}),
          ...(input.replyToId ? { replyToId: input.replyToId } : {}),
        });

        if (!response.ok) {
          setPending((current) =>
            current.filter((item) => item.clientMessageId !== clientMessageId),
          );
          toast.error(response.error.message);
          return false;
        }

        insertMessage(conversation.id, response.data.message);
        setPending((current) => current.filter((item) => item.clientMessageId !== clientMessageId));
        setReplyTo(null);
        return true;
      } catch {
        setPending((current) =>
          current.map((item) =>
            item.clientMessageId === clientMessageId ? { ...item, status: 'failed' } : item,
          ),
        );
        toast.error('Message not confirmed. Retry it from the message bubble.');
        return true;
      }
    },
    [conversation.id, insertMessage, socket],
  );

  const retryMessage = useCallback(
    async (clientMessageId: string) => {
      const target = pending.find((item) => item.clientMessageId === clientMessageId);

      if (!target || !socket?.connected) {
        if (!socket?.connected) {
          toast.error('Still reconnecting. Try again in a moment.');
        }
        return;
      }

      setPending((current) =>
        current.map((item) =>
          item.clientMessageId === clientMessageId ? { ...item, status: 'sending' } : item,
        ),
      );

      try {
        const response = await socket.timeout(10_000).emitWithAck('message:send', {
          conversationId: conversation.id,
          clientMessageId: target.clientMessageId,
          ...(target.content ? { content: target.content } : {}),
          ...(target.attachmentIds.length > 0 ? { attachmentIds: target.attachmentIds } : {}),
          ...(target.replyToId ? { replyToId: target.replyToId } : {}),
        });

        if (!response.ok) {
          setPending((current) =>
            current.filter((item) => item.clientMessageId !== clientMessageId),
          );
          toast.error(response.error.message);
          return;
        }

        insertMessage(conversation.id, response.data.message);
        setPending((current) => current.filter((item) => item.clientMessageId !== clientMessageId));
      } catch {
        setPending((current) =>
          current.map((item) =>
            item.clientMessageId === clientMessageId ? { ...item, status: 'failed' } : item,
          ),
        );
        toast.error('Message not confirmed. Try again.');
      }
    },
    [conversation.id, insertMessage, pending, socket],
  );

  const handleReply = (message: MessageDTO) => {
    setReplyTo(message);
    setFocusRequest((current) => current + 1);
  };

  const handleReact = async (message: MessageDTO, emoji: string) => {
    const mine = message.reactions.some(
      (reaction) => reaction.user.id === currentUserId && reaction.emoji === emoji,
    );

    try {
      const response = mine
        ? await removeReactionRequest(message.id, emoji)
        : await addReactionRequest(message.id, emoji);
      updateMessageInCache(queryClient, conversation.id, response.message);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Reaction could not be saved.');
    }
  };

  const handleSaveEdit = async () => {
    if (!editingId || editDraft.trim().length === 0) {
      return;
    }

    try {
      const response = await editMessageRequest(editingId, editDraft.trim());
      updateMessageInCache(queryClient, conversation.id, response.message);
      setEditingId(null);
      setEditDraft('');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Message could not be edited.');
    }
  };

  const handleDelete = async (message: MessageDTO) => {
    const confirmed = window.confirm('Delete this message for everyone?');
    if (!confirmed) {
      return;
    }

    try {
      const response = await deleteMessageRequest(message.id);
      updateMessageInCache(queryClient, conversation.id, response.message);
      if (replyTo?.id === message.id) {
        setReplyTo(null);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Message could not be deleted.');
    }
  };

  const handleAttachmentLoad = () => {
    const container = scrollContainerRef.current;

    if (!container || !atBottomRef.current) {
      return;
    }

    requestAnimationFrame(() => {
      container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
    });
  };

  const getReceiptLabel = (message: MessageDTO): string | undefined => {
    if (message.sender.id !== currentUserId || message.deletedAt) {
      return undefined;
    }

    const others = conversation.members.filter((member) => member.userId !== currentUserId);
    const createdAt = new Date(message.createdAt).getTime();
    const readCount = others.filter(
      (member) => member.lastReadAt && new Date(member.lastReadAt).getTime() >= createdAt,
    ).length;
    const deliveredCount = others.filter(
      (member) => member.lastDeliveredAt && new Date(member.lastDeliveredAt).getTime() >= createdAt,
    ).length;

    if (readCount > 0) {
      if (conversation.type === 'DIRECT') {
        return 'Read';
      }

      return readCount === others.length ? 'Read by all' : `Read by ${readCount}`;
    }

    if (deliveredCount > 0) {
      if (conversation.type === 'DIRECT') {
        return 'Delivered';
      }

      return deliveredCount === others.length ? 'Delivered' : `Delivered to ${deliveredCount}`;
    }

    return 'Sent';
  };

  const typingLabel =
    typingNames.length === 1
      ? `${typingNames[0]} is typing…`
      : typingNames.length > 1
        ? `${typingNames.slice(0, 2).join(' and ')} are typing…`
        : null;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="relative min-h-0 flex-1">
        <div
          ref={scrollContainerRef}
          onScroll={handleScroll}
          className="h-full overflow-y-auto"
          aria-label={`Messages in ${title}`}
          role="log"
        >
          <div
            ref={contentRef}
            className={`mx-auto flex min-h-full w-full max-w-3xl flex-col gap-3 px-3 py-4 sm:px-6 sm:py-6 ${
              hasMessages ? 'justify-end' : 'justify-center'
            }`}
          >
            <div ref={topSentinelRef} className="flex min-h-8 items-center justify-center">
              {isFetchingNextPage ? (
                <Loader2
                  className="size-4 animate-spin text-muted-foreground"
                  aria-label="Loading earlier messages"
                />
              ) : hasNextPage ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="rounded-full text-xs text-muted-foreground"
                  onClick={() => void fetchNextPage()}
                >
                  Load earlier messages
                </Button>
              ) : null}
            </div>

            {messagesQuery.isLoading ? (
              <div className="space-y-5 py-4" role="status">
                <span className="sr-only">Loading messages</span>
                {['one', 'two', 'three'].map((skeleton) => (
                  <div key={skeleton} className="flex items-end gap-2.5">
                    <div className="size-8 animate-pulse rounded-full bg-muted" />
                    <div className="h-12 w-48 animate-pulse rounded-2xl bg-muted" />
                  </div>
                ))}
              </div>
            ) : null}

            {messagesQuery.isError ? (
              <div className="flex flex-col items-center gap-3 py-16 text-center">
                <p className="text-sm font-medium">Messages could not load.</p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="rounded-full"
                  onClick={() => void messagesQuery.refetch()}
                >
                  Try again
                </Button>
              </div>
            ) : null}

            {!messagesQuery.isLoading && !messagesQuery.isError && !hasMessages ? (
              <div className="flex flex-col items-center px-4 py-14 text-center sm:py-20">
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
                  Start the conversation.
                </h2>
                <p className="mt-3 max-w-md text-sm leading-relaxed text-muted-foreground">
                  {conversation.type === 'GROUP'
                    ? `Send the first message to ${title}.`
                    : `Say hello to ${other?.user.name ?? title}. Messages arrive in real time.`}
                </p>
              </div>
            ) : null}

            {messages.map((message, index) => {
              const previous = messages[index - 1];
              const date = new Date(message.createdAt).toDateString();
              const previousDate = previous ? new Date(previous.createdAt).toDateString() : null;
              const showDate = date !== previousDate;
              const own = message.sender.id === currentUserId;
              const showSender =
                conversation.type === 'GROUP' &&
                !own &&
                (showDate || previous?.sender.id !== message.sender.id);

              return (
                <div key={message.id} className="flex flex-col gap-3">
                  {showDate ? (
                    <div className="flex items-center gap-3 py-1" aria-hidden="true">
                      <span className="h-px flex-1 bg-border/70" />
                      <span className="text-[0.65rem] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                        {formatDateLabel(message.createdAt)}
                      </span>
                      <span className="h-px flex-1 bg-border/70" />
                    </div>
                  ) : null}
                  <MessageBubble
                    message={message}
                    own={own}
                    showSender={showSender}
                    currentUserId={currentUserId}
                    receiptLabel={own ? getReceiptLabel(message) : undefined}
                    canModerate={canModerate}
                    editing={editingId === message.id}
                    editDraft={editDraft}
                    onEditDraftChange={setEditDraft}
                    onReply={() => handleReply(message)}
                    onReact={(emoji) => void handleReact(message, emoji)}
                    onEdit={() => {
                      setEditingId(message.id);
                      setEditDraft(message.content ?? '');
                    }}
                    onDelete={() => void handleDelete(message)}
                    onSaveEdit={() => void handleSaveEdit()}
                    onCancelEdit={() => {
                      setEditingId(null);
                      setEditDraft('');
                    }}
                    onAttachmentLoad={handleAttachmentLoad}
                  />
                </div>
              );
            })}

            {pending.map((item) => (
              <PendingBubble
                key={item.clientMessageId}
                pending={item}
                onRetry={() => void retryMessage(item.clientMessageId)}
              />
            ))}
          </div>
        </div>

        {hasNew ? (
          <div className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center">
            <Button
              type="button"
              size="sm"
              className="pointer-events-auto rounded-full shadow-lg"
              onClick={scrollToBottom}
            >
              <ArrowDown className="size-4" aria-hidden="true" />
              New messages
            </Button>
          </div>
        ) : null}
      </div>

      {typingLabel ? (
        <div className="mx-auto w-full max-w-3xl px-4 pb-1 text-xs text-muted-foreground sm:px-6">
          {typingLabel}
        </div>
      ) : null}

      <MessageComposer
        conversationLabel={title}
        connected={connected}
        replyTo={replyTo}
        focusRequest={focusRequest}
        onCancelReply={() => setReplyTo(null)}
        onSend={sendMessage}
        onTypingActivity={handleTypingActivity}
        onTypingStop={stopTyping}
      />
    </div>
  );
}
