'use client';

import type { MessageAttachmentDTO, MessageDTO } from '@chatsphere/shared';
import { ArrowUp, FileText, Loader2, Paperclip, X } from 'lucide-react';
import { type FormEvent, type KeyboardEvent, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  ALLOWED_ATTACHMENT_TYPES,
  MAX_ATTACHMENT_SIZE,
  MAX_ATTACHMENTS,
  uploadAttachment,
} from '@/features/attachments/api';
import { formatFileSize } from '@/lib/format-file';
import { cn } from '@/lib/utils';

const MAX_LENGTH = 4000;

export interface ComposerSendInput {
  content: string;
  attachmentIds: string[];
  replyToId?: string;
}

export function MessageComposer({
  conversationLabel,
  connected,
  replyTo,
  focusRequest,
  onCancelReply,
  onSend,
  onTypingActivity,
  onTypingStop,
}: {
  conversationLabel: string;
  connected: boolean;
  replyTo: MessageDTO | null;
  focusRequest: number;
  onCancelReply: () => void;
  onSend: (input: ComposerSendInput) => Promise<boolean>;
  onTypingActivity: () => void;
  onTypingStop: () => void;
}) {
  const [value, setValue] = useState('');
  const [attachments, setAttachments] = useState<MessageAttachmentDTO[]>([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (focusRequest > 0) {
      textareaRef.current?.focus();
    }
  }, [focusRequest]);

  const resizeTextarea = () => {
    const textarea = textareaRef.current;

    if (!textarea) {
      return;
    }

    textarea.style.height = '0px';
    textarea.style.height = `${Math.min(textarea.scrollHeight, 128)}px`;
  };

  const uploadFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) {
      return;
    }

    const remaining = MAX_ATTACHMENTS - attachments.length;
    const selected = [...files].slice(0, remaining);
    setUploading(true);

    for (const file of selected) {
      if (!ALLOWED_ATTACHMENT_TYPES.has(file.type)) {
        toast.error(`${file.name} is not a supported file type.`);
        continue;
      }

      if (file.size > MAX_ATTACHMENT_SIZE) {
        toast.error(`${file.name} is larger than 10 MB.`);
        continue;
      }

      try {
        const attachment = await uploadAttachment(file);
        setAttachments((current) => [...current, attachment]);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'That file could not be uploaded.');
      }
    }

    setUploading(false);

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const submit = async () => {
    const content = value.trim();

    if ((!content && attachments.length === 0) || submitting || uploading || !connected) {
      return;
    }

    setSubmitting(true);
    onTypingStop();

    try {
      const sent = await onSend({
        content,
        attachmentIds: attachments.map((attachment) => attachment.id),
        replyToId: replyTo?.id,
      });

      if (sent) {
        setValue('');
        setAttachments([]);
        requestAnimationFrame(() => {
          if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
          }
        });
      }
    } finally {
      setSubmitting(false);
      textareaRef.current?.focus();
    }
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void submit();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void submit();
    }
  };

  return (
    <div className="shrink-0 border-t border-border/70 bg-background p-3 sm:p-4">
      <div className="mx-auto w-full max-w-3xl">
        {replyTo ? (
          <div className="mb-2 flex items-start gap-2 rounded-xl border-l-2 border-primary bg-muted/40 px-3 py-2">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium">Replying to {replyTo.sender.name}</p>
              <p className="truncate text-xs text-muted-foreground">
                {replyTo.content || (replyTo.attachments.length ? 'Attachment' : 'Message')}
              </p>
            </div>
            <button
              type="button"
              onClick={onCancelReply}
              aria-label="Cancel reply"
              className="grid size-6 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-background hover:text-foreground"
            >
              <X className="size-3.5" aria-hidden="true" />
            </button>
          </div>
        ) : null}

        {attachments.length > 0 ? (
          <div className="mb-2 flex flex-wrap gap-2">
            {attachments.map((attachment) => (
              <div
                key={attachment.id}
                className="relative flex items-center gap-2 rounded-xl border border-border/70 bg-card px-2.5 py-2 pr-7 text-xs"
              >
                {attachment.mimeType.startsWith('image/') ? (
                  // biome-ignore lint/performance/noImgElement: S3-signed URL
                  <img
                    src={attachment.url}
                    alt=""
                    className="size-8 rounded-md object-cover"
                    loading="lazy"
                  />
                ) : (
                  <FileText className="size-4 text-muted-foreground" aria-hidden="true" />
                )}
                <span className="max-w-36 truncate">
                  <span className="block truncate font-medium">{attachment.fileName}</span>
                  <span className="block text-[0.65rem] text-muted-foreground">
                    {formatFileSize(attachment.fileSize)}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() =>
                    setAttachments((current) => current.filter((item) => item.id !== attachment.id))
                  }
                  aria-label={`Remove ${attachment.fileName}`}
                  className="absolute right-1 top-1 grid size-5 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <X className="size-3" aria-hidden="true" />
                </button>
              </div>
            ))}
          </div>
        ) : null}

        {!connected ? (
          <div className="mb-2 flex items-center gap-2 px-1 text-xs text-muted-foreground">
            <Loader2 className="size-3 animate-spin" aria-hidden="true" />
            Reconnecting. You can keep typing; sending resumes when you are back.
          </div>
        ) : null}

        <form
          onSubmit={handleSubmit}
          className={cn(
            'flex items-end gap-1 rounded-2xl border border-border bg-card p-1.5 shadow-sm focus-within:border-primary/40 focus-within:ring-3 focus-within:ring-ring/15',
            !connected && 'opacity-80',
          )}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/jpeg,image/png,image/webp,image/gif,application/pdf,text/plain"
            className="sr-only"
            onChange={(event) => void uploadFiles(event.target.files)}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-9 shrink-0 rounded-xl text-muted-foreground"
            aria-label="Attach files"
            title="Attach files"
            disabled={!connected || uploading || attachments.length >= MAX_ATTACHMENTS}
            onClick={() => fileInputRef.current?.click()}
          >
            {uploading ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <Paperclip className="size-4" aria-hidden="true" />
            )}
          </Button>

          <Textarea
            ref={textareaRef}
            value={value}
            onChange={(event) => {
              setValue(event.target.value);
              onTypingActivity();
              resizeTextarea();
            }}
            onKeyDown={handleKeyDown}
            onBlur={onTypingStop}
            rows={1}
            maxLength={MAX_LENGTH}
            placeholder={connected ? `Message ${conversationLabel}` : 'Reconnecting to ChatSphere…'}
            aria-label={`Message ${conversationLabel}`}
            className="max-h-32 min-h-10 flex-1 resize-none border-0 bg-transparent px-2 py-2 text-sm shadow-none focus-visible:ring-0 dark:bg-transparent"
          />

          <Button
            type="submit"
            size="icon"
            className="size-9 shrink-0 rounded-xl"
            aria-label="Send message"
            disabled={
              !connected ||
              submitting ||
              uploading ||
              (value.trim().length === 0 && attachments.length === 0)
            }
          >
            {submitting ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <ArrowUp className="size-4" aria-hidden="true" />
            )}
          </Button>
        </form>

        <div className="mt-1.5 flex items-center justify-between px-1 text-[0.65rem] text-muted-foreground">
          <span className="hidden sm:inline">Enter to send · Shift + Enter for a new line</span>
          <span className="sm:hidden">Enter to send</span>
          <span className={cn(attachments.length > 0 && 'text-primary')}>
            {attachments.length > 0 ? `${attachments.length}/${MAX_ATTACHMENTS} files · ` : ''}
            {value.length}/{MAX_LENGTH}
          </span>
        </div>
      </div>
    </div>
  );
}
