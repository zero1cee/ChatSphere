'use client';

import { passwordSchema } from '@chatsphere/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowRight, CheckCircle2, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';

import { FieldError, FormError } from '@/components/auth/form-error';
import { PasswordInput } from '@/components/auth/password-input';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ApiError, resetPasswordRequest } from '@/lib/api-client';

const resetFormSchema = z
  .object({
    password: passwordSchema,
    confirmPassword: z.string().min(1, 'Confirm your new password.'),
  })
  .refine((values) => values.password === values.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match.',
  });

type ResetFormValues = z.infer<typeof resetFormSchema>;

export function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const [done, setDone] = useState(false);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ResetFormValues>({
    resolver: zodResolver(resetFormSchema),
    defaultValues: { password: '', confirmPassword: '' },
  });

  if (!token) {
    return (
      <div className="rounded-2xl border border-border/80 bg-card p-6 text-center shadow-sm">
        <h2 className="text-lg font-semibold">This link is incomplete</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Password reset links contain a one-time token. Request a fresh link to continue.
        </p>
        <Button asChild className="mt-6 w-full rounded-xl">
          <Link href="/forgot-password">
            Request a new link
            <ArrowRight aria-hidden="true" />
          </Link>
        </Button>
      </div>
    );
  }

  const onSubmit = handleSubmit(async (values) => {
    try {
      await resetPasswordRequest({ token, password: values.password });
      setDone(true);
      toast.success('Password updated. You can sign in now.');
    } catch (error) {
      setError('root', {
        message:
          error instanceof ApiError
            ? error.message
            : 'We could not update your password. Please try again.',
      });
    }
  });

  if (done) {
    return (
      <div className="rounded-2xl border border-border/80 bg-card p-6 text-center shadow-sm">
        <span className="mx-auto grid size-12 place-items-center rounded-full bg-presence-online/10 text-presence-online">
          <CheckCircle2 className="size-5" aria-hidden="true" />
        </span>
        <h2 className="mt-4 text-lg font-semibold">Password updated</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Your other sessions have been signed out. Use your new password to sign in.
        </p>
        <Button asChild className="mt-6 w-full rounded-xl">
          <Link href="/login">
            Sign in
            <ArrowRight aria-hidden="true" />
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      <FormError message={errors.root?.message} />

      <div>
        <Label htmlFor="reset-password">New password</Label>
        <PasswordInput
          id="reset-password"
          autoComplete="new-password"
          placeholder="At least 10 characters"
          className="mt-1.5"
          aria-invalid={errors.password ? true : undefined}
          aria-describedby={errors.password ? 'reset-password-error' : undefined}
          {...register('password')}
        />
        <div id="reset-password-error">
          <FieldError message={errors.password?.message} />
        </div>
      </div>

      <div>
        <Label htmlFor="reset-confirm">Confirm new password</Label>
        <Input
          id="reset-confirm"
          type="password"
          autoComplete="new-password"
          placeholder="Repeat your new password"
          className="mt-1.5 h-10"
          aria-invalid={errors.confirmPassword ? true : undefined}
          aria-describedby={errors.confirmPassword ? 'reset-confirm-error' : undefined}
          {...register('confirmPassword')}
        />
        <div id="reset-confirm-error">
          <FieldError message={errors.confirmPassword?.message} />
        </div>
      </div>

      <Button type="submit" disabled={isSubmitting} className="h-11 w-full rounded-xl">
        {isSubmitting ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
        {isSubmitting ? 'Updating…' : 'Update password'}
      </Button>
    </form>
  );
}
