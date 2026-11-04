import type { Metadata } from 'next';

import { ChatsView } from '@/components/app/chats-view';

export const metadata: Metadata = {
  title: 'Chats',
  description: 'Your ChatSphere conversations.',
};

export default function ChatsPage() {
  return <ChatsView />;
}
