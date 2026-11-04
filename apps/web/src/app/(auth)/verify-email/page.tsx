import type { Metadata } from 'next';
import { Suspense } from 'react';

import { AuthHeading } from '@/components/auth/auth-heading';
import { VerifyEmailFlow } from '@/components/auth/verify-email-flow';

export const metadata: Metadata = {
  title: 'Verify email',
  description: 'Verify the email address on your ChatSphere account.',
};

export default function VerifyEmailPage() {
  return (
    <div>
      <AuthHeading
        eyebrow="One more step"
        title="Verify your email."
        description="Email verification keeps your account recoverable and confirms that this address belongs to you."
      />
      <Suspense fallback={<div className="h-72 animate-pulse rounded-2xl bg-muted/60" />}>
        <VerifyEmailFlow />
      </Suspense>
    </div>
  );
}
