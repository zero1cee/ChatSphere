import type { Metadata } from 'next';

import { SettingsView } from '@/components/app/settings-view';

export const metadata: Metadata = {
  title: 'Settings',
  description: 'Manage your ChatSphere profile and password.',
};

export default function SettingsPage() {
  return <SettingsView />;
}
