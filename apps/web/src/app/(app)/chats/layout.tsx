import type { ReactNode } from 'react';

import { ChatsShell } from '@/components/app/chats-shell';

export default function ChatsLayout({ children }: { children: ReactNode }) {
  return <ChatsShell>{children}</ChatsShell>;
}
