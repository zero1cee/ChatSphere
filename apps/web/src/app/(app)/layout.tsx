import type { ReactNode } from 'react';

import { AuthGate } from '@/providers/auth-gate';
import { SocketProvider } from '@/providers/socket-provider';

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <AuthGate>
      <SocketProvider>{children}</SocketProvider>
    </AuthGate>
  );
}
