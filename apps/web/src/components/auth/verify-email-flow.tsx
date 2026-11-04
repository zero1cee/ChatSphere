'use client';

import { CheckCircle2, Loader2, MailCheck, TriangleAlert } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import { ResendVerificationForm } from '@/components/auth/resend-verification-form';
import { Button } from '@/components/ui/button';
import { ApiError, fetchMe, refreshSession, verifyEmailRequest } from '@/lib/api-client';
import { useAuthStore } from '@/stores/auth-store';

type VerificationState = 'idle' | 'verifying' | 'success' | 'error';

export function VerifyEmailFlow() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const emailParam = searchParams.get('email') ?? '';
  const user = useAuthStore((state) => state.user);
  const accessToken = useAuthStore((state) => state.accessToken);
  const setUser = useAuthStore((state) => state.setUser);
  const [state, setState] = useState<VerificationState>(token ? 'verifying' : 'idle');
  const [message, setMessage] = useState('');
  const attempted = useRef(false);

  useEffect(() => {
    if (!token || attempted.current) {
      return;
    }

    attempted.current = true;

    const verify = async () => {
      try {
        await verifyEmailRequest({ token });
        setState('success');

        if (useAuthStore.getState().accessToken) {
          try {
            const me = await fetchMe();
            setUser(me.user);
          } catch {
            // The verification itself succeeded. The session will refresh on the
            // next protected navigation.
          }
        } else {
          // The email link often opens in a fresh tab where the in-memory access
          // token is gone. The HttpOnly refresh cookie is still available.
          await refreshSession();
        }
      } catch (error) {
        setState('error');
        setMessage(
          error instanceof ApiError
            ? error.message
            : 'We could not verify this link. Please request a new one.',
        );
      }
    };

    void verify();
  }, [setUser, token]);

  const defaultEmail = emailParam || user?.email || '';

  if (state === 'verifying') {
    return (
      <div className="rounded-2xl border border-border/80 bg-card p-6 text-center shadow-sm">
        <span className="mx-auto grid size-12 place-items-center rounded-full bg-primary/10 text-primary">
          <Loader2 className="size-5 animate-spin" aria-hidden="true" />
        </span>
        <h2 className="mt-4 text-lg font-semibold">Verifying your email…</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          This only takes a moment. Please keep this page open.
        </p>
      </div>
    );
  }

  if (state === 'success') {
    const destination = accessToken ? '/chats' : '/login';
    const action = accessToken ? 'Continue to ChatSphere' : 'Sign in';

    return (
      <div className="rounded-2xl border border-border/80 bg-card p-6 text-center shadow-sm">
        <span className="mx-auto grid size-12 place-items-center rounded-full bg-presence-online/10 text-presence-online">
          <CheckCircle2 className="size-5" aria-hidden="true" />
        </span>
        <h2 className="mt-4 text-lg font-semibold">You&apos;re verified.</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Your email address is confirmed. Your conversations can now stay secure and in sync.
        </p>
        <Button asChild className="mt-6 w-full rounded-xl">
          <Link href={destination}>{action}</Link>
        </Button>
      </div>
    );
  }

  if (state === 'error') {
    return (
      <div className="rounded-2xl border border-border/80 bg-card p-6 shadow-sm">
        <span className="mx-auto grid size-12 place-items-center rounded-full bg-destructive/10 text-destructive">
          <TriangleAlert className="size-5" aria-hidden="true" />
        </span>
        <h2 className="mt-4 text-center text-lg font-semibold">That link didn&apos;t work.</h2>
        <p className="mt-2 text-center text-sm leading-relaxed text-muted-foreground">{message}</p>
        <div className="mt-6 border-t border-border/70 pt-5">
          <ResendVerificationForm defaultEmail={defaultEmail} />
        </div>
        <p className="mt-4 text-center text-xs text-muted-foreground">
          <Link href="/login" className="underline-offset-4 hover:underline">
            Back to sign in
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border/80 bg-card p-6 text-center shadow-sm">
      <span className="mx-auto grid size-12 place-items-center rounded-full bg-primary/10 text-primary">
        <MailCheck className="size-5" aria-hidden="true" />
      </span>
      <h2 className="mt-4 text-lg font-semibold">Check your inbox.</h2>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        We sent a verification link{defaultEmail ? ` to ${defaultEmail}` : ''}. Open it to finish
        setting up your account.
      </p>

      <div className="mt-5 rounded-xl border border-border/70 bg-background/60 p-4 text-left">
        <ResendVerificationForm defaultEmail={defaultEmail} />
      </div>

      {process.env.NODE_ENV === 'development' ? (
        <p className="mt-4 text-xs text-muted-foreground">
          Local development: view the email in{' '}
          <a
            href="http://localhost:8025"
            target="_blank"
            rel="noreferrer"
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            Mailpit
          </a>
          .
        </p>
      ) : null}

      <p className="mt-5 text-xs text-muted-foreground">
        <Link href="/login" className="underline-offset-4 hover:underline">
          Back to sign in
        </Link>
      </p>
    </div>
  );
}
