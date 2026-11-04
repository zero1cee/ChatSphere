'use client';

import type { ChangePasswordInput, UpdateProfileInput } from '@chatsphere/shared';
import { passwordSchema, updateProfileSchema } from '@chatsphere/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, CheckCircle2, Loader2, LogOut } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';

import { UserAvatar } from '@/components/app/user-avatar';
import { Logo } from '@/components/brand/logo';
import { ThemeToggle } from '@/components/theme-toggle';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { changePassword, updateProfile } from '@/features/conversations/api';
import { conversationKeys } from '@/features/conversations/queries';
import { ApiError, logoutRequest } from '@/lib/api-client';
import { useAuthStore } from '@/stores/auth-store';

const passwordFormSchema = z
  .object({
    currentPassword: z.string().min(1, 'Enter your current password.'),
    newPassword: passwordSchema,
    confirmPassword: z.string().min(1, 'Confirm your new password.'),
  })
  .refine((values) => values.newPassword === values.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match.',
  });

type PasswordFormValues = z.infer<typeof passwordFormSchema>;

export function SettingsView() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const setUser = useAuthStore((state) => state.setUser);

  const profileForm = useForm<UpdateProfileInput>({
    resolver: zodResolver(updateProfileSchema),
    defaultValues: {
      name: user?.name ?? '',
      username: user?.username ?? '',
      bio: user?.bio ?? '',
    },
  });

  const passwordForm = useForm<PasswordFormValues>({
    resolver: zodResolver(passwordFormSchema),
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  });

  const profileMutation = useMutation({
    mutationFn: (input: UpdateProfileInput) => updateProfile(input),
    onSuccess: (data) => {
      setUser(data.user);
      profileForm.reset({
        name: data.user.name,
        username: data.user.username,
        bio: data.user.bio ?? '',
      });
      void queryClient.invalidateQueries({ queryKey: conversationKeys.all });
      toast.success('Profile updated.');
    },
    onError: (error) => {
      toast.error(error instanceof ApiError ? error.message : 'Profile could not be updated.');
    },
  });

  const passwordMutation = useMutation({
    mutationFn: (input: ChangePasswordInput) => changePassword(input),
    onSuccess: () => {
      passwordForm.reset({ currentPassword: '', newPassword: '', confirmPassword: '' });
      toast.success('Password updated. Other sessions have been signed out.');
    },
    onError: (error) => {
      toast.error(error instanceof ApiError ? error.message : 'Password could not be updated.');
    },
  });

  if (!user) {
    return null;
  }

  const handleSignOut = async () => {
    try {
      await logoutRequest();
    } catch {
      // The local session is cleared in logoutRequest's finally block.
    } finally {
      router.replace('/login');
    }
  };

  return (
    <div className="min-h-svh bg-canvas">
      <header className="border-b border-border/70 bg-background">
        <div className="mx-auto flex h-16 w-full max-w-5xl items-center justify-between gap-4 px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <Link
              href="/chats"
              aria-label="Back to conversations"
              className="grid size-9 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <ArrowLeft className="size-4" aria-hidden="true" />
            </Link>
            <Link href="/chats" aria-label="ChatSphere conversations">
              <Logo />
            </Link>
          </div>
          <div className="flex items-center gap-1.5">
            <ThemeToggle />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="rounded-full"
              onClick={() => void handleSignOut()}
            >
              <LogOut className="size-4" aria-hidden="true" />
              Sign out
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Account</p>
          <h1 className="mt-2 font-display text-4xl tracking-[-0.02em]">Settings.</h1>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">
            Manage how you appear in conversations and keep your account secure.
          </p>
        </div>

        <div className="mt-8 grid gap-5 lg:grid-cols-2">
          <section className="rounded-2xl border border-border/80 bg-card p-5 sm:p-6">
            <div className="flex items-center gap-3">
              <UserAvatar name={user.name} size="lg" />
              <div className="min-w-0">
                <h2 className="truncate text-base font-semibold">{user.name}</h2>
                <p className="truncate text-xs text-muted-foreground">@{user.username}</p>
              </div>
              <Badge
                variant="outline"
                className="ml-auto border-presence-online/25 bg-presence-online/10"
              >
                <CheckCircle2 className="size-3 text-presence-online" aria-hidden="true" />
                Verified
              </Badge>
            </div>

            <form
              onSubmit={profileForm.handleSubmit((values) => profileMutation.mutate(values))}
              noValidate
              className="mt-6 space-y-4"
            >
              <div>
                <Label htmlFor="settings-name">Name</Label>
                <Input
                  id="settings-name"
                  className="mt-1.5 h-10"
                  aria-invalid={profileForm.formState.errors.name ? true : undefined}
                  {...profileForm.register('name')}
                />
                {profileForm.formState.errors.name ? (
                  <p className="mt-1 text-xs text-destructive">
                    {profileForm.formState.errors.name.message}
                  </p>
                ) : null}
              </div>

              <div>
                <Label htmlFor="settings-username">Username</Label>
                <Input
                  id="settings-username"
                  className="mt-1.5 h-10"
                  aria-invalid={profileForm.formState.errors.username ? true : undefined}
                  {...profileForm.register('username')}
                />
                {profileForm.formState.errors.username ? (
                  <p className="mt-1 text-xs text-destructive">
                    {profileForm.formState.errors.username.message}
                  </p>
                ) : null}
              </div>

              <div>
                <Label htmlFor="settings-bio">Bio</Label>
                <Textarea
                  id="settings-bio"
                  className="mt-1.5 min-h-24 resize-none"
                  maxLength={280}
                  placeholder="A short note about you."
                  aria-invalid={profileForm.formState.errors.bio ? true : undefined}
                  {...profileForm.register('bio')}
                />
                {profileForm.formState.errors.bio ? (
                  <p className="mt-1 text-xs text-destructive">
                    {profileForm.formState.errors.bio.message}
                  </p>
                ) : null}
              </div>

              <div className="flex items-center justify-between gap-3 border-t border-border/70 pt-4">
                <p className="text-xs text-muted-foreground">{user.email}</p>
                <Button type="submit" className="rounded-xl" disabled={profileMutation.isPending}>
                  {profileMutation.isPending ? (
                    <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  ) : null}
                  Save profile
                </Button>
              </div>
            </form>
          </section>

          <section className="rounded-2xl border border-border/80 bg-card p-5 sm:p-6">
            <h2 className="text-base font-semibold">Change password</h2>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              Your other sessions will be signed out when the password changes.
            </p>

            <form
              onSubmit={passwordForm.handleSubmit((values) =>
                passwordMutation.mutate({
                  currentPassword: values.currentPassword,
                  newPassword: values.newPassword,
                }),
              )}
              noValidate
              className="mt-6 space-y-4"
            >
              <div>
                <Label htmlFor="current-password">Current password</Label>
                <Input
                  id="current-password"
                  type="password"
                  autoComplete="current-password"
                  className="mt-1.5 h-10"
                  {...passwordForm.register('currentPassword')}
                />
                {passwordForm.formState.errors.currentPassword ? (
                  <p className="mt-1 text-xs text-destructive">
                    {passwordForm.formState.errors.currentPassword.message}
                  </p>
                ) : null}
              </div>

              <div>
                <Label htmlFor="new-password">New password</Label>
                <Input
                  id="new-password"
                  type="password"
                  autoComplete="new-password"
                  className="mt-1.5 h-10"
                  {...passwordForm.register('newPassword')}
                />
                {passwordForm.formState.errors.newPassword ? (
                  <p className="mt-1 text-xs text-destructive">
                    {passwordForm.formState.errors.newPassword.message}
                  </p>
                ) : null}
              </div>

              <div>
                <Label htmlFor="confirm-new-password">Confirm new password</Label>
                <Input
                  id="confirm-new-password"
                  type="password"
                  autoComplete="new-password"
                  className="mt-1.5 h-10"
                  {...passwordForm.register('confirmPassword')}
                />
                {passwordForm.formState.errors.confirmPassword ? (
                  <p className="mt-1 text-xs text-destructive">
                    {passwordForm.formState.errors.confirmPassword.message}
                  </p>
                ) : null}
              </div>

              <div className="border-t border-border/70 pt-4">
                <Button
                  type="submit"
                  variant="outline"
                  className="w-full rounded-xl"
                  disabled={passwordMutation.isPending}
                >
                  {passwordMutation.isPending ? (
                    <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  ) : null}
                  Update password
                </Button>
              </div>
            </form>
          </section>
        </div>
      </main>
    </div>
  );
}
