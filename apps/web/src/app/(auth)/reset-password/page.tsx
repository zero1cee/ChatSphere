import type { Metadata } from 'next';
import { Suspense } from 'react';

import { AuthHeading } from '@/components/auth/auth-heading';
import { ResetPasswordForm } from '@/components/auth/reset-password-form';

export const metadata: Metadata = {
  title: 'Reset password',
  description: 'Choose a new password for your ChatSphere account.',
};

export default function ResetPasswordPage() {
  return (
    <div>
      <AuthHeading
        eyebrow="Password reset"
        title="Choose a new password."
        description="Make it memorable, but not easy to guess. This will sign you out of your other sessions."
      />
      <Suspense fallback={<div className="h-72 animate-pulse rounded-2xl bg-muted/60" />}>
        <ResetPasswordForm />
      </Suspense>
    </div>
  );
}
