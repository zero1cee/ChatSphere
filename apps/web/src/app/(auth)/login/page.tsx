import type { Metadata } from 'next';
import { Suspense } from 'react';

import { AuthHeading } from '@/components/auth/auth-heading';
import { LoginForm } from '@/components/auth/login-form';

export const metadata: Metadata = {
  title: 'Sign in',
  description: 'Sign in to your ChatSphere account.',
};

export default function LoginPage() {
  return (
    <div>
      <AuthHeading
        eyebrow="Welcome back"
        title="Sign in to ChatSphere."
        description="Pick up where you left off with your conversations and your people."
      />
      <Suspense fallback={<div className="h-80 animate-pulse rounded-2xl bg-muted/60" />}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
