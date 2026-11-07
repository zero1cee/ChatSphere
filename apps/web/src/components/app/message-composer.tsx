'use client';

import { ArrowUp, Loader2 } from 'lucide-react';
import { type FormEvent, type KeyboardEvent, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

const MAX_LENGTH = 4000;

export function MessageComposer({
  conversationLabel,
  connected,
  onSend,
}: {
  conversationLabel: string;
  connected: boolean;
  onSend: (content: string) => Promise<boolean>;
}) {
  const [value, setValue] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const resizeTextarea = () => {
    const textarea = textareaRef.current;

    if (!textarea) {
      return;
    }

    textarea.style.height = '0px';
    textarea.style.height = `${Math.min(textarea.scrollHeight, 128)}px`;
  };

  const submit = async () => {
    const content = value.trim();

    if (!content || submitting || !connected) {
      return;
    }

    setSubmitting(true);

    try {
      const sent = await onSend(content);

      if (sent) {
        setValue((current) => (current.trim() === content ? '' : current));
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
        {!connected ? (
          <div className="mb-2 flex items-center gap-2 px-1 text-xs text-muted-foreground">
            <Loader2 className="size-3 animate-spin" aria-hidden="true" />
            Reconnecting. You can keep typing; sending resumes when you are back.
          </div>
        ) : null}

        <form
          onSubmit={handleSubmit}
          className="flex items-end gap-2 rounded-2xl border border-border bg-card p-1.5 shadow-sm focus-within:border-primary/40 focus-within:ring-3 focus-within:ring-ring/15"
        >
          <Textarea
            ref={textareaRef}
            value={value}
            onChange={(event) => {
              setValue(event.target.value);
              resizeTextarea();
            }}
            onKeyDown={handleKeyDown}
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
            disabled={!connected || submitting || value.trim().length === 0}
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
          <span className={cn(value.length > MAX_LENGTH - 200 && 'text-amber-600')}>
            {value.length}/{MAX_LENGTH}
          </span>
        </div>
      </div>
    </div>
  );
}
