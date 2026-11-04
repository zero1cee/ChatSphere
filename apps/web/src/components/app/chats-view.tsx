'use client';

import { CheckCircle2, Loader2, LogOut, MessageSquare } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';

import { Logo } from '@/components/brand/logo';
import { ThemeToggle } from '@/components/theme-toggle';
import { Button } from '@/components/ui/button';
import { logoutRequest } from '@/lib/api-client';
import { useAuthStore } from '@/stores/auth-store';

function initials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

export function ChatsView() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const [signingOut, setSigningOut] = useState(false);

  if (!user) {
    return null;
  }

  const handleSignOut = async () => {
    setSigningOut(true);

    try {
      await logoutRequest();
    } catch {
      // The local session is cleared in logoutRequest's finally block. A failed
      // network logout should still remove access from this browser.
      toast.error('We could not reach the server, but you have been signed out locally.');
    } finally {
      router.replace('/login');
      setSigningOut(false);
    }
  };

  return (
    <div className="flex min-h-svh flex-col bg-canvas">
      <header className="border-b border-border/70 bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
          <Logo />
          <div className="flex items-center gap-1.5">
            <ThemeToggle />
            <div className="hidden items-center gap-2 rounded-full border border-border/80 bg-background px-2 py-1 sm:flex">
              <span className="grid size-7 place-items-center rounded-full bg-primary/10 text-[0.65rem] font-semibold text-primary">
                {initials(user.name)}
              </span>
              <span className="pr-1 text-xs font-medium">{user.name}</span>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="rounded-full"
              onClick={() => void handleSignOut()}
              disabled={signingOut}
            >
              {signingOut ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <LogOut className="size-4" aria-hidden="true" />
              )}
              Sign out
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto grid w-full max-w-7xl flex-1 gap-4 p-4 sm:p-6 lg:grid-cols-[20rem_1fr]">
        <aside className="hidden flex-col rounded-2xl border border-border/80 bg-card p-4 lg:flex">
          <div className="flex items-center justify-between">
            <h1 className="text-sm font-semibold">Conversations</h1>
            <span className="rounded-full border border-border/80 px-2 py-0.5 text-[0.65rem] text-muted-foreground">
              0
            </span>
          </div>
          <div className="mt-6 flex flex-1 flex-col items-center justify-center rounded-xl border border-dashed border-border/90 px-4 py-10 text-center">
            <span className="grid size-10 place-items-center rounded-xl bg-muted text-muted-foreground">
              <MessageSquare className="size-4" aria-hidden="true" />
            </span>
            <p className="mt-3 text-sm font-medium">No conversations yet</p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              Direct and group conversations will appear here in the next milestone.
            </p>
          </div>

          <div className="mt-4 flex items-center gap-3 rounded-xl border border-border/70 bg-background/60 p-3">
            <span className="grid size-9 place-items-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
              {initials(user.name)}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{user.name}</p>
              <p className="truncate text-xs text-muted-foreground">@{user.username}</p>
            </div>
          </div>
        </aside>

        <section className="flex flex-col items-center justify-center rounded-2xl border border-border/80 bg-card px-6 py-16 text-center">
          <div className="relative grid size-20 place-items-center">
            <span
              className="absolute inset-0 rounded-full bg-primary/10 blur-xl"
              aria-hidden="true"
            />
            <span className="relative grid size-16 place-items-center rounded-full border border-primary/15 bg-primary/10 text-xl font-semibold text-primary">
              {initials(user.name)}
            </span>
          </div>

          <p className="mt-5 text-xs font-semibold uppercase tracking-[0.18em] text-primary">
            You&apos;re in
          </p>
          <h2 className="mt-2 font-display text-4xl tracking-[-0.02em] text-balance">
            Welcome, {user.name.split(' ')[0]}.
          </h2>
          <p className="mt-3 max-w-md text-sm leading-relaxed text-muted-foreground">
            Your account is ready and your email is verified. The conversation workspace and
            real-time messaging are the next milestones.
          </p>

          <div className="mt-7 flex flex-col items-center gap-3 sm:flex-row">
            <span className="inline-flex items-center gap-2 rounded-full border border-presence-online/25 bg-presence-online/10 px-3 py-1.5 text-xs font-medium text-foreground">
              <CheckCircle2 className="size-3.5 text-presence-online" aria-hidden="true" />
              Email verified
            </span>
            <span className="rounded-full border border-border/80 px-3 py-1.5 text-xs text-muted-foreground">
              @{user.username}
            </span>
          </div>

          <div className="mt-10 w-full max-w-sm border-t border-border/70 pt-5 text-left">
            <p className="text-[0.68rem] font-medium uppercase tracking-[0.14em] text-muted-foreground">
              Account
            </p>
            <div className="mt-3 flex items-center justify-between gap-4 text-sm">
              <span className="text-muted-foreground">Email</span>
              <span className="truncate font-medium">{user.email}</span>
            </div>
            <div className="mt-2 flex items-center justify-between gap-4 text-sm">
              <span className="text-muted-foreground">Member since</span>
              <span className="font-medium">
                {new Date(user.createdAt).toLocaleDateString(undefined, {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </span>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
