'use client';

import type { RegisterInput } from '@chatsphere/shared';
import { registerSchema } from '@chatsphere/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';

import { FieldError, FormError } from '@/components/auth/form-error';
import { PasswordInput } from '@/components/auth/password-input';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ApiError, registerRequest } from '@/lib/api-client';
import { useAuthStore } from '@/stores/auth-store';

export function RegisterForm() {
  const router = useRouter();
  const setSession = useAuthStore((state) => state.setSession);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    defaultValues: { name: '', username: '', email: '', password: '' },
  });

  const onSubmit = handleSubmit(async (values) => {
    try {
      const session = await registerRequest(values);
      setSession(session.user, session.accessToken);
      toast.success('Account created. Check your inbox to verify your email.');
      router.replace(`/verify-email?email=${encodeURIComponent(session.user.email)}`);
    } catch (error) {
      if (error instanceof ApiError && typeof error.details === 'object' && error.details) {
        const field = (error.details as { field?: string }).field;
        if (field === 'email' || field === 'username') {
          setError(field, { message: error.message });
          return;
        }
      }

      setError('root', {
        message:
          error instanceof ApiError
            ? error.message
            : 'We could not create your account. Please try again.',
      });
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      <FormError message={errors.root?.message} />

      <div>
        <Label htmlFor="register-name">Name</Label>
        <Input
          id="register-name"
          autoComplete="name"
          placeholder="Ada Lovelace"
          className="mt-1.5 h-10"
          aria-invalid={errors.name ? true : undefined}
          aria-describedby={errors.name ? 'register-name-error' : undefined}
          {...register('name')}
        />
        <div id="register-name-error">
          <FieldError message={errors.name?.message} />
        </div>
      </div>

      <div>
        <Label htmlFor="register-username">Username</Label>
        <Input
          id="register-username"
          autoComplete="username"
          placeholder="ada"
          className="mt-1.5 h-10"
          aria-invalid={errors.username ? true : undefined}
          aria-describedby={
            errors.username
              ? 'register-username-error register-username-hint'
              : 'register-username-hint'
          }
          {...register('username')}
        />
        <p id="register-username-hint" className="mt-1.5 text-[0.7rem] text-muted-foreground">
          Lowercase letters, numbers, and underscores.
        </p>
        <div id="register-username-error">
          <FieldError message={errors.username?.message} />
        </div>
      </div>

      <div>
        <Label htmlFor="register-email">Email</Label>
        <Input
          id="register-email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          className="mt-1.5 h-10"
          aria-invalid={errors.email ? true : undefined}
          aria-describedby={errors.email ? 'register-email-error' : undefined}
          {...register('email')}
        />
        <div id="register-email-error">
          <FieldError message={errors.email?.message} />
        </div>
      </div>

      <div>
        <Label htmlFor="register-password">Password</Label>
        <PasswordInput
          id="register-password"
          autoComplete="new-password"
          placeholder="At least 10 characters"
          className="mt-1.5"
          aria-invalid={errors.password ? true : undefined}
          aria-describedby={
            errors.password
              ? 'register-password-error register-password-hint'
              : 'register-password-hint'
          }
          {...register('password')}
        />
        <p id="register-password-hint" className="mt-1.5 text-[0.7rem] text-muted-foreground">
          At least 10 characters, with a letter and a number.
        </p>
        <div id="register-password-error">
          <FieldError message={errors.password?.message} />
        </div>
      </div>

      <Button type="submit" disabled={isSubmitting} className="mt-2 h-11 w-full rounded-xl">
        {isSubmitting ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
        {isSubmitting ? 'Creating account…' : 'Create account'}
      </Button>

      <p className="pt-1 text-center text-sm text-muted-foreground">
        Already have an account?{' '}
        <Link
          href="/login"
          className="font-medium text-foreground underline-offset-4 hover:underline"
        >
          Sign in
        </Link>
      </p>
    </form>
  );
}
