'use client';

import type { ForgotPasswordInput } from '@chatsphere/shared';
import { forgotPasswordSchema } from '@chatsphere/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, Loader2, MailCheck } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';

import { FieldError, FormError } from '@/components/auth/form-error';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ApiError, forgotPasswordRequest } from '@/lib/api-client';

export function ForgotPasswordForm() {
  const [sent, setSent] = useState(false);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordInput>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: '' },
  });

  const onSubmit = handleSubmit(async (values) => {
    try {
      await forgotPasswordRequest(values);
      setSent(true);
      toast.success('If an account exists, a reset link is on its way.');
    } catch (error) {
      setError('root', {
        message:
          error instanceof ApiError
            ? error.message
            : 'We could not send the reset email. Please try again.',
      });
    }
  });

  if (sent) {
    return (
      <div className="rounded-2xl border border-border/80 bg-card p-6 text-center shadow-sm">
        <span className="mx-auto grid size-12 place-items-center rounded-full bg-presence-online/10 text-presence-online">
          <MailCheck className="size-5" aria-hidden="true" />
        </span>
        <h2 className="mt-4 text-lg font-semibold">Check your inbox</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          If an account exists for that email, we sent a link to reset your password. The link
          expires in one hour.
        </p>
        <Button asChild variant="outline" className="mt-6 w-full rounded-xl">
          <Link href="/login">
            <ArrowLeft aria-hidden="true" />
            Back to sign in
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      <FormError message={errors.root?.message} />

      <div>
        <Label htmlFor="forgot-email">Email</Label>
        <Input
          id="forgot-email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          className="mt-1.5 h-10"
          aria-invalid={errors.email ? true : undefined}
          aria-describedby={errors.email ? 'forgot-email-error' : undefined}
          {...register('email')}
        />
        <div id="forgot-email-error">
          <FieldError message={errors.email?.message} />
        </div>
      </div>

      <Button type="submit" disabled={isSubmitting} className="h-11 w-full rounded-xl">
        {isSubmitting ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
        {isSubmitting ? 'Sending…' : 'Send reset link'}
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        Remembered it?{' '}
        <Link
          href="/login"
          className="font-medium text-foreground underline-offset-4 hover:underline"
        >
          Back to sign in
        </Link>
      </p>
    </form>
  );
}
