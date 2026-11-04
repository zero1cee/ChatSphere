'use client';

import type { LoginInput } from '@chatsphere/shared';
import { loginSchema } from '@chatsphere/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';

import { FieldError, FormError } from '@/components/auth/form-error';
import { PasswordInput } from '@/components/auth/password-input';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ApiError, loginRequest } from '@/lib/api-client';
import { useAuthStore } from '@/stores/auth-store';

function safeNextPath(value: string | null): string {
  if (!value?.startsWith('/') || value.startsWith('//')) {
    return '/chats';
  }

  return value;
}

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const setSession = useAuthStore((state) => state.setSession);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = handleSubmit(async (values) => {
    try {
      const session = await loginRequest(values);
      setSession(session.user, session.accessToken);

      if (!session.user.emailVerified) {
        router.replace('/verify-email');
        return;
      }

      router.replace(safeNextPath(searchParams.get('next')));
    } catch (error) {
      setError('root', {
        message:
          error instanceof ApiError ? error.message : 'We could not sign you in. Please try again.',
      });
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      <FormError message={errors.root?.message} />

      <div>
        <Label htmlFor="login-email">Email</Label>
        <Input
          id="login-email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          className="mt-1.5 h-10"
          aria-invalid={errors.email ? true : undefined}
          aria-describedby={errors.email ? 'login-email-error' : undefined}
          {...register('email')}
        />
        <div id="login-email-error">
          <FieldError message={errors.email?.message} />
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between">
          <Label htmlFor="login-password">Password</Label>
          <Link
            href="/forgot-password"
            className="text-xs font-medium text-primary underline-offset-4 hover:underline"
          >
            Forgot password?
          </Link>
        </div>
        <PasswordInput
          id="login-password"
          autoComplete="current-password"
          placeholder="Your password"
          className="mt-1.5"
          aria-invalid={errors.password ? true : undefined}
          aria-describedby={errors.password ? 'login-password-error' : undefined}
          {...register('password')}
        />
        <div id="login-password-error">
          <FieldError message={errors.password?.message} />
        </div>
      </div>

      <Button type="submit" disabled={isSubmitting} className="h-11 w-full rounded-xl">
        {isSubmitting ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
        {isSubmitting ? 'Signing in…' : 'Sign in'}
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        New to ChatSphere?{' '}
        <Link
          href="/register"
          className="font-medium text-foreground underline-offset-4 hover:underline"
        >
          Create an account
        </Link>
      </p>
    </form>
  );
}
