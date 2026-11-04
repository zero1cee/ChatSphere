import type { Metadata } from 'next';

import { ConversationView } from '@/components/app/conversation-view';

export const metadata: Metadata = {
  title: 'Conversation',
  description: 'A ChatSphere conversation.',
};

export default async function ConversationPage({
  params,
}: {
  params: Promise<{ conversationId: string }>;
}) {
  const { conversationId } = await params;

  return <ConversationView conversationId={conversationId} />;
}
