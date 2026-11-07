'use client';

import type { MessageAttachmentDTO, MessageDTO } from '@chatsphere/shared';
import { FileText, MoreHorizontal, Pencil, Reply, Trash2, X } from 'lucide-react';
import { useState } from 'react';

import { UserAvatar } from '@/components/app/user-avatar';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { formatFileSize } from '@/lib/format-file';
import { formatMessageTime } from '@/lib/format-time';
import { cn } from '@/lib/utils';

const QUICK_REACTIONS = ['👍', '❤️', '😂', '🎉'] as const;

function MessageAttachments({
  attachments,
  own,
  onImageLoad,
}: {
  attachments: MessageAttachmentDTO[];
  own: boolean;
  onImageLoad?: () => void;
}) {
  if (attachments.length === 0) {
    return null;
  }

  const images = attachments.filter((attachment) => attachment.mimeType.startsWith('image/'));
  const files = attachments.filter((attachment) => !attachment.mimeType.startsWith('image/'));

  return (
    <div className="mb-2 space-y-2">
      {images.length > 0 ? (
        <div className={cn('grid gap-2', images.length > 1 ? 'grid-cols-2' : 'grid-cols-1')}>
          {images.map((attachment) => (
            <a
              key={attachment.id}
              href={attachment.url}
              target="_blank"
              rel="noreferrer"
              className="block overflow-hidden rounded-xl border border-black/10 bg-black/5"
            >
              {/* biome-ignore lint/performance/noImgElement: S3-signed URL */}
              <img
                src={attachment.url}
                alt={attachment.fileName}
                loading="lazy"
                onLoad={onImageLoad}
                className="max-h-64 w-full object-cover"
              />
            </a>
          ))}
        </div>
      ) : null}

      {files.map((attachment) => (
        <a
          key={attachment.id}
          href={attachment.url}
          target="_blank"
          rel="noreferrer"
          className={cn(
            'flex items-center gap-2 rounded-xl border px-2.5 py-2 text-xs transition-colors',
            own
              ? 'border-primary-foreground/20 bg-primary-foreground/10 hover:bg-primary-foreground/15'
              : 'border-border/70 bg-background/60 hover:bg-muted',
          )}
        >
          <FileText className="size-4 shrink-0" aria-hidden="true" />
          <span className="min-w-0 flex-1">
            <span className="block truncate font-medium">{attachment.fileName}</span>
            <span className="block opacity-70">{formatFileSize(attachment.fileSize)}</span>
          </span>
        </a>
      ))}
    </div>
  );
}

export function MessageBubble({
  message,
  own,
  showSender,
  currentUserId,
  receiptLabel,
  canModerate = false,
  editing = false,
  editDraft = '',
  onEditDraftChange,
  onReply,
  onReact,
  onEdit,
  onDelete,
  onSaveEdit,
  onCancelEdit,
  onAttachmentLoad,
}: {
  message: MessageDTO;
  own: boolean;
  showSender: boolean;
  currentUserId: string;
  receiptLabel?: string;
  canModerate?: boolean;
  editing?: boolean;
  editDraft?: string;
  onEditDraftChange?: (value: string) => void;
  onReply: () => void;
  onReact: (emoji: string) => void;
  onEdit: () => void;
  onDelete: () => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  onAttachmentLoad?: () => void;
}) {
  const [actionsOpen, setActionsOpen] = useState(false);
  const deleted = Boolean(message.deletedAt);
  const runAction = (action: () => void) => {
    setActionsOpen(false);
    action();
  };
  const reactionGroups = new Map<string, { count: number; mine: boolean }>();

  for (const reaction of message.reactions) {
    const current = reactionGroups.get(reaction.emoji) ?? { count: 0, mine: false };
    current.count += 1;
    current.mine ||= reaction.user.id === currentUserId;
    reactionGroups.set(reaction.emoji, current);
  }

  return (
    <div className={cn('group/message flex w-full gap-2.5', own ? 'justify-end' : 'justify-start')}>
      {!own ? <UserAvatar name={message.sender.name} size="sm" className="mt-5 shrink-0" /> : null}

      <div
        className={cn(
          'flex max-w-[82%] flex-col sm:max-w-[70%]',
          own ? 'items-end' : 'items-start',
        )}
        data-message-id={message.id}
      >
        {showSender && !own ? (
          <p className="mb-1 px-1 text-[0.7rem] font-medium text-muted-foreground">
            {message.sender.name}
          </p>
        ) : null}

        <div
          className={cn(
            'rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed shadow-sm',
            own
              ? 'rounded-br-md bg-primary text-primary-foreground'
              : 'rounded-bl-md border border-border/70 bg-card text-card-foreground',
          )}
        >
          {message.replyTo ? (
            <div
              className={cn(
                'mb-2 rounded-lg border-l-2 px-2.5 py-1.5 text-xs',
                own
                  ? 'border-primary-foreground/50 bg-primary-foreground/10'
                  : 'border-primary/40 bg-muted/60',
              )}
            >
              <p className="font-medium opacity-80">{message.replyTo.senderName}</p>
              <p className="line-clamp-2 opacity-70">
                {message.replyTo.deletedAt
                  ? 'Message deleted'
                  : message.replyTo.content || 'Attachment'}
              </p>
            </div>
          ) : null}

          <MessageAttachments
            attachments={message.attachments}
            own={own}
            onImageLoad={onAttachmentLoad}
          />

          {editing ? (
            <div className="min-w-56 space-y-2">
              <Textarea
                value={editDraft}
                onChange={(event) => onEditDraftChange?.(event.target.value)}
                rows={3}
                maxLength={4000}
                autoFocus
                className="min-h-20 resize-none border-black/10 bg-background/95 text-sm text-foreground"
                aria-label="Edit message"
              />
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  size="xs"
                  variant="ghost"
                  className="text-primary-foreground hover:bg-primary-foreground/15"
                  onClick={onCancelEdit}
                >
                  <X className="size-3" aria-hidden="true" />
                  Cancel
                </Button>
                <Button
                  type="button"
                  size="xs"
                  variant="secondary"
                  disabled={editDraft.trim().length === 0}
                  onClick={onSaveEdit}
                >
                  Save
                </Button>
              </div>
            </div>
          ) : message.deletedAt ? (
            <p className="italic opacity-75">Message deleted</p>
          ) : message.content ? (
            <p className="whitespace-pre-wrap break-words">{message.content}</p>
          ) : message.attachments.length === 0 ? (
            <p className="italic opacity-75">Empty message</p>
          ) : null}
        </div>

        {reactionGroups.size > 0 && !deleted ? (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {[...reactionGroups.entries()].map(([emoji, group]) => (
              <button
                key={emoji}
                type="button"
                aria-label={`${emoji} ${group.count}`}
                aria-pressed={group.mine}
                onClick={() => onReact(emoji)}
                className={cn(
                  'flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs transition-colors',
                  group.mine
                    ? 'border-primary/40 bg-primary/10 text-foreground'
                    : 'border-border/70 bg-background text-muted-foreground hover:bg-muted',
                )}
              >
                <span>{emoji}</span>
                <span>{group.count}</span>
              </button>
            ))}
          </div>
        ) : null}

        <div className="mt-1 flex items-center gap-2 px-1 text-[0.65rem] text-muted-foreground">
          <time dateTime={message.createdAt}>{formatMessageTime(message.createdAt)}</time>
          {message.editedAt ? <span>edited</span> : null}
          {receiptLabel ? <span>· {receiptLabel}</span> : null}
          {!deleted ? (
            <button
              type="button"
              onClick={() => setActionsOpen((current) => !current)}
              aria-label="Message actions"
              aria-expanded={actionsOpen}
              className="grid size-5 place-items-center rounded-full opacity-60 transition-opacity hover:bg-muted hover:opacity-100"
            >
              <MoreHorizontal className="size-3.5" aria-hidden="true" />
            </button>
          ) : null}
        </div>

        {actionsOpen && !deleted ? (
          <div className="mt-1 flex flex-wrap items-center gap-0.5 rounded-xl border border-border/70 bg-background p-1 shadow-sm">
            <Button type="button" size="xs" variant="ghost" onClick={() => runAction(onReply)}>
              <Reply className="size-3" aria-hidden="true" />
              Reply
            </Button>
            {QUICK_REACTIONS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                aria-label={`React with ${emoji}`}
                onClick={() => runAction(() => onReact(emoji))}
                className="grid size-7 place-items-center rounded-lg text-sm hover:bg-muted"
              >
                {emoji}
              </button>
            ))}
            {own ? (
              <>
                <Button type="button" size="xs" variant="ghost" onClick={() => runAction(onEdit)}>
                  <Pencil className="size-3" aria-hidden="true" />
                  Edit
                </Button>
                <Button
                  type="button"
                  size="xs"
                  variant="ghost"
                  className="text-destructive hover:text-destructive"
                  onClick={() => runAction(onDelete)}
                >
                  <Trash2 className="size-3" aria-hidden="true" />
                  Delete
                </Button>
              </>
            ) : canModerate ? (
              <Button
                type="button"
                size="xs"
                variant="ghost"
                className="text-destructive hover:text-destructive"
                onClick={() => runAction(onDelete)}
              >
                <Trash2 className="size-3" aria-hidden="true" />
                Delete
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
