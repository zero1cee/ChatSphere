import type { SelfUser } from '@chatsphere/shared';
import { create } from 'zustand';

export type AuthStatus = 'idle' | 'loading' | 'authenticated' | 'unauthenticated';

interface AuthState {
  user: SelfUser | null;
  accessToken: string | null;
  status: AuthStatus;
  setSession: (user: SelfUser, accessToken: string) => void;
  setUser: (user: SelfUser) => void;
  setStatus: (status: AuthStatus) => void;
  clearSession: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  accessToken: null,
  status: 'idle',
  setSession: (user, accessToken) => set({ user, accessToken, status: 'authenticated' }),
  setUser: (user) => set({ user }),
  setStatus: (status) => set({ status }),
  clearSession: () => set({ user: null, accessToken: null, status: 'unauthenticated' }),
}));
