import type { ServerToClientEvents } from '@chatsphere/shared';

type UserEmitter = (userIds: string[], event: keyof ServerToClientEvents, payload: unknown) => void;

let userEmitter: UserEmitter | null = null;

export function registerUserEmitter(emitter: UserEmitter): void {
  userEmitter = emitter;
}

export function emitToUsers<K extends keyof ServerToClientEvents>(
  userIds: string[],
  event: K,
  payload: Parameters<ServerToClientEvents[K]>[0],
): void {
  if (!userEmitter || userIds.length === 0) {
    return;
  }

  userEmitter(userIds, event, payload);
}
