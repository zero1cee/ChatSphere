'use client';

import type { ResendVerificationInput } from '@chatsphere/shared';
import { resendVerificationSchema } from '@chatsphere/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, MailCheck } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';

import { FieldError, FormError } from '@/components/auth/form-error';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ApiError, resendVerificationRequest } from '@/lib/api-client';

export function ResendVerificationForm({ defaultEmail = '' }: { defaultEmail?: string }) {
  const [sent, setSent] = useState(false);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ResendVerificationInput>({
    resolver: zodResolver(resendVerificationSchema),
    defaultValues: { email: defaultEmail },
  });

  const onSubmit = handleSubmit(async (values) => {
    try {
      await resendVerificationRequest(values);
      setSent(true);
      toast.success('If that account needs verification, a new email is on its way.');
    } catch (error) {
      setError('root', {
        message:
          error instanceof ApiError
            ? error.message
            : 'We could not resend the email. Please try again.',
      });
    }
  });

  if (sent) {
    return (
      <div className="flex items-start gap-3 rounded-xl border border-presence-online/25 bg-presence-online/5 px-3.5 py-3 text-sm">
        <MailCheck className="mt-0.5 size-4 shrink-0 text-presence-online" aria-hidden="true" />
        <p className="text-muted-foreground">
          If that account still needs verification, a fresh link is on its way. Check your inbox.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-3 text-left">
      <FormError message={errors.root?.message} />
      <div>
        <Label htmlFor="resend-email" className="text-xs text-muted-foreground">
          Resend verification email
        </Label>
        <Input
          id="resend-email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          className="mt-1.5 h-10"
          aria-invalid={errors.email ? true : undefined}
          {...register('email')}
        />
        <FieldError message={errors.email?.message} />
      </div>
      <Button type="submit" variant="outline" disabled={isSubmitting} className="w-full rounded-xl">
        {isSubmitting ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
        {isSubmitting ? 'Sending…' : 'Resend verification email'}
      </Button>
    </form>
  );
}
