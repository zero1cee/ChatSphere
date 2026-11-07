import { MessageSquare } from 'lucide-react';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Chats',
  description: 'Your ChatSphere conversations.',
};

export default function ChatsPage() {
  return (
    <div className="relative flex h-full w-full flex-col items-center justify-center overflow-hidden bg-canvas px-6 text-center">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-70"
        style={{
          backgroundImage:
            'radial-gradient(circle at 50% 38%, color-mix(in oklch, var(--primary) 8%, transparent), transparent 38%)',
        }}
      />

      <span className="relative grid size-16 place-items-center rounded-2xl border border-border/80 bg-card text-primary shadow-sm">
        <MessageSquare className="size-6" aria-hidden="true" />
      </span>
      <p className="relative mt-5 text-xs font-semibold uppercase tracking-[0.18em] text-primary">
        ChatSphere
      </p>
      <h1 className="relative mt-2 max-w-md font-display text-4xl tracking-[-0.02em] text-balance">
        Pick a conversation.
      </h1>
      <p className="relative mt-3 max-w-sm text-sm leading-relaxed text-muted-foreground">
        Choose a conversation from the sidebar, or start a new one. Your messages arrive in real
        time.
      </p>
    </div>
  );
}
