'use client';

import { usePathname, useRouter } from 'next/navigation';
import type { ReactNode } from 'react';
import { useEffect, useRef } from 'react';

import { Logo } from '@/components/brand/logo';
import { refreshSession } from '@/lib/api-client';
import { useAuthStore } from '@/stores/auth-store';

export function AuthGate({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const user = useAuthStore((state) => state.user);
  const accessToken = useAuthStore((state) => state.accessToken);
  const status = useAuthStore((state) => state.status);
  const bootstrapped = useRef(false);

  useEffect(() => {
    if (bootstrapped.current) {
      return;
    }

    bootstrapped.current = true;
    useAuthStore.getState().setStatus('loading');
    void refreshSession();
  }, []);

  useEffect(() => {
    if (status === 'unauthenticated') {
      const next = encodeURIComponent(pathname || '/chats');
      router.replace(`/login?next=${next}`);
      return;
    }

    if (status === 'authenticated' && user && !user.emailVerified) {
      router.replace('/verify-email');
    }
  }, [pathname, router, status, user]);

  if (status === 'idle' || status === 'loading' || !accessToken || !user) {
    return (
      <div className="grid min-h-svh place-items-center bg-canvas">
        <div className="flex flex-col items-center gap-4">
          <Logo />
          <span className="sr-only">Loading your session</span>
          <span className="size-5 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
        </div>
      </div>
    );
  }

  if (!user.emailVerified) {
    return (
      <div className="grid min-h-svh place-items-center bg-canvas">
        <div className="flex flex-col items-center gap-3 text-center">
          <Logo />
          <p className="text-sm text-muted-foreground">Verify your email to continue…</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
