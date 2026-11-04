import {
  CheckCheck,
  MoreHorizontal,
  Paperclip,
  Phone,
  Search,
  SendHorizontal,
  Smile,
  Video,
} from 'lucide-react';

import { cn } from '@/lib/utils';

function Avatar({ initials, className }: { initials: string; className?: string }) {
  return (
    <span
      className={cn(
        'grid size-8 shrink-0 place-items-center rounded-full text-[0.65rem] font-semibold',
        className,
      )}
    >
      {initials}
    </span>
  );
}

const conversations = [
  { name: 'Design crew', initials: 'DC', active: true, color: 'bg-primary/10 text-primary' },
  { name: 'Maya Chen', initials: 'MC', active: false, color: 'bg-accent text-accent-foreground' },
  {
    name: 'Ship notes',
    initials: 'SN',
    active: false,
    color: 'bg-secondary text-secondary-foreground',
  },
  { name: 'Jon Bell', initials: 'JB', active: false, color: 'bg-warning/15 text-warning' },
];

export function AppPreview() {
  return (
    <figure
      className="relative mx-auto w-full max-w-[36rem]"
      aria-label="Preview of the ChatSphere conversation interface"
    >
      <div
        aria-hidden="true"
        className="absolute -inset-8 -z-10 rounded-[3rem] bg-[radial-gradient(ellipse_at_30%_20%,color-mix(in_oklch,var(--primary)_16%,transparent),transparent_60%),radial-gradient(ellipse_at_75%_80%,color-mix(in_oklch,var(--accent)_45%,transparent),transparent_55%)] blur-2xl"
      />

      <div className="overflow-hidden rounded-[1.75rem] border border-border/80 bg-card shadow-[0_30px_80px_-30px_rgba(0,0,0,0.35)]">
        <div className="flex h-11 items-center gap-2 border-b border-border/70 bg-surface-raised/80 px-4">
          <span className="flex gap-1.5" aria-hidden="true">
            <span className="size-2 rounded-full bg-destructive/70" />
            <span className="size-2 rounded-full bg-warning/80" />
            <span className="size-2 rounded-full bg-presence-online/80" />
          </span>
          <span className="ml-2 text-xs font-medium text-muted-foreground">ChatSphere</span>
          <span className="ml-auto rounded-full border border-border/70 px-2 py-0.5 text-[0.6rem] font-medium uppercase tracking-[0.14em] text-muted-foreground">
            Preview
          </span>
        </div>

        <div aria-hidden="true" className="grid grid-cols-1 sm:grid-cols-[7.5rem_1fr]">
          <aside className="hidden border-r border-border/70 bg-sidebar/70 p-2.5 sm:block">
            <div className="mb-3 flex items-center gap-1.5 rounded-lg border border-border/70 bg-background px-2 py-1.5 text-[0.6rem] text-muted-foreground">
              <Search className="size-3" />
              <span>Search</span>
            </div>
            <div className="space-y-1">
              {conversations.map((conversation) => (
                <div
                  key={conversation.name}
                  className={cn(
                    'flex items-center gap-2 rounded-lg px-1.5 py-1.5',
                    conversation.active && 'bg-background shadow-sm',
                  )}
                >
                  <Avatar
                    initials={conversation.initials}
                    className={cn('size-6 text-[0.55rem]', conversation.color)}
                  />
                  <span className="truncate text-[0.62rem] font-medium">{conversation.name}</span>
                </div>
              ))}
            </div>
          </aside>

          <div className="flex min-h-[25rem] flex-col">
            <div className="flex items-center gap-2 border-b border-border/70 px-3 py-2.5">
              <Avatar initials="DC" className="size-7 bg-primary/10 text-[0.6rem] text-primary" />
              <div className="min-w-0">
                <p className="truncate text-xs font-semibold">Design crew</p>
                <p className="flex items-center gap-1 text-[0.6rem] text-muted-foreground">
                  <span className="size-1.5 rounded-full bg-presence-online" />4 members · 2 online
                </p>
              </div>
              <div className="ml-auto hidden items-center gap-1 text-muted-foreground sm:flex">
                <Phone className="size-3.5" />
                <Video className="size-3.5" />
                <MoreHorizontal className="size-3.5" />
              </div>
            </div>

            <div className="flex-1 space-y-4 px-3 py-4 sm:px-4">
              <div className="flex items-end gap-2">
                <Avatar
                  initials="MC"
                  className="size-6 bg-accent text-[0.55rem] text-accent-foreground"
                />
                <div className="space-y-1">
                  <div className="rounded-2xl rounded-bl-md border border-border/60 bg-surface-raised px-3 py-2 text-[0.68rem] leading-relaxed">
                    The new composer is on staging. Attachments and replies both feel solid.
                  </div>
                  <p className="pl-1 text-[0.55rem] text-muted-foreground">Maya · 09:38</p>
                </div>
              </div>

              <div className="flex flex-col items-end gap-1">
                <div className="max-w-[85%] rounded-2xl rounded-br-md bg-primary px-3 py-2 text-[0.68rem] leading-relaxed text-primary-foreground">
                  Perfect. I&apos;ll run the read-receipt tests after lunch.
                </div>
                <p className="flex items-center gap-1 pr-1 text-[0.55rem] text-muted-foreground">
                  09:40 <CheckCheck className="size-3 text-primary" /> Read
                </p>
              </div>

              <div className="flex items-end gap-2">
                <Avatar
                  initials="JB"
                  className="size-6 bg-warning/15 text-[0.55rem] text-warning"
                />
                <div className="space-y-1">
                  <div className="rounded-2xl rounded-bl-md border border-border/60 bg-surface-raised px-3 py-2 text-[0.68rem] leading-relaxed">
                    Shipping the build notes now — the room feels fast.
                  </div>
                  <p className="pl-1 text-[0.55rem] text-muted-foreground">Jon · 09:41</p>
                </div>
              </div>

              <div className="flex items-center gap-1.5 pl-8 text-[0.6rem] text-muted-foreground">
                <span className="flex gap-0.5">
                  <span className="size-1 animate-pulse rounded-full bg-muted-foreground/70" />
                  <span className="size-1 animate-pulse rounded-full bg-muted-foreground/70 [animation-delay:150ms]" />
                  <span className="size-1 animate-pulse rounded-full bg-muted-foreground/70 [animation-delay:300ms]" />
                </span>
                Maya is typing…
              </div>
            </div>

            <div className="p-2.5 pt-0">
              <div className="flex items-center gap-2 rounded-xl border border-border/80 bg-background px-2.5 py-2 text-[0.62rem] text-muted-foreground">
                <Paperclip className="size-3.5" />
                <span className="flex-1">Message #design-crew</span>
                <Smile className="size-3.5" />
                <span className="grid size-6 place-items-center rounded-lg bg-primary text-primary-foreground">
                  <SendHorizontal className="size-3" />
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <figcaption className="sr-only">
        Illustration of the ChatSphere interface showing a group conversation, presence, delivery
        and read receipts, and the message composer.
      </figcaption>
    </figure>
  );
}
