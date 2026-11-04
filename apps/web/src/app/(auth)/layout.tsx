import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';

import { Logo } from '@/components/brand/logo';
import { ThemeToggle } from '@/components/theme-toggle';

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-svh lg:grid-cols-[1.02fr_1fr]">
      <aside className="relative hidden overflow-hidden bg-[#0b0e14] px-10 py-12 text-white lg:flex lg:flex-col">
        <div
          aria-hidden="true"
          className="absolute -right-32 -top-32 size-[30rem] rounded-full bg-primary/25 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="absolute -bottom-40 -left-24 size-[28rem] rounded-full bg-accent/15 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="absolute right-[-8rem] top-1/3 size-[24rem] rounded-full border border-white/10"
        />
        <div
          aria-hidden="true"
          className="absolute right-[-4rem] top-1/3 size-[18rem] rounded-full border border-white/10"
        />

        <Link href="/" aria-label="ChatSphere home" className="relative w-fit rounded-lg">
          <Logo inverted />
        </Link>

        <div className="relative mt-auto max-w-md pb-10">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/50">
            A calmer place to talk
          </p>
          <h1 className="mt-4 font-display text-5xl leading-[0.98] tracking-[-0.02em] text-balance">
            Every conversation has a place.
          </h1>
          <p className="mt-5 text-sm leading-relaxed text-white/60">
            Direct messages, focused groups, and the small signals that make a conversation feel
            human — presence, typing, receipts.
          </p>

          <ul className="mt-8 space-y-3 text-sm text-white/70">
            <li className="flex items-center gap-3">
              <span className="size-1.5 rounded-full bg-presence-online" aria-hidden="true" />
              Private conversations, server-enforced membership
            </li>
            <li className="flex items-center gap-3">
              <span className="size-1.5 rounded-full bg-presence-online" aria-hidden="true" />
              Real-time delivery without a refresh
            </li>
            <li className="flex items-center gap-3">
              <span className="size-1.5 rounded-full bg-presence-online" aria-hidden="true" />
              Files kept behind signed, short-lived URLs
            </li>
          </ul>
        </div>

        <p className="relative text-[0.68rem] text-white/35">
          ChatSphere · a 2027 SDE portfolio project
        </p>
      </aside>

      <div className="flex min-h-svh flex-col">
        <header className="flex items-center justify-between px-5 py-5 sm:px-8">
          <Link href="/" aria-label="ChatSphere home" className="rounded-lg lg:hidden">
            <Logo />
          </Link>
          <div className="ml-auto flex items-center gap-1.5">
            <ThemeToggle />
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <ArrowLeft className="size-4" aria-hidden="true" />
              Home
            </Link>
          </div>
        </header>

        <main id="main" className="flex flex-1 items-center justify-center px-4 pb-16 pt-2 sm:px-8">
          <div className="w-full max-w-[26rem]">{children}</div>
        </main>

        <footer className="px-5 pb-6 text-center text-[0.68rem] text-muted-foreground sm:px-8">
          © 2026 ChatSphere · Conversations, in orbit.
        </footer>
      </div>
    </div>
  );
}
