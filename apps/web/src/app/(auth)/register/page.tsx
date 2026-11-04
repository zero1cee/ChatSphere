import type { Metadata } from 'next';

import { AuthHeading } from '@/components/auth/auth-heading';
import { RegisterForm } from '@/components/auth/register-form';

export const metadata: Metadata = {
  title: 'Create account',
  description: 'Create your ChatSphere account.',
};

export default function RegisterPage() {
  return (
    <div>
      <AuthHeading
        eyebrow="Join ChatSphere"
        title="Make a place for your conversations."
        description="A calmer workspace for direct messages and focused groups. Start with your account."
      />
      <RegisterForm />
    </div>
  );
}
