import type { Metadata } from 'next';

import { AuthHeading } from '@/components/auth/auth-heading';
import { ForgotPasswordForm } from '@/components/auth/forgot-password-form';

export const metadata: Metadata = {
  title: 'Forgot password',
  description: 'Request a password reset link for ChatSphere.',
};

export default function ForgotPasswordPage() {
  return (
    <div>
      <AuthHeading
        eyebrow="Password reset"
        title="Forgot your password?"
        description="Enter the email address on your account and we’ll send you a secure reset link."
      />
      <ForgotPasswordForm />
    </div>
  );
}
