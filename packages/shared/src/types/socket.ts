import type { ConversationUpdatedEvent, MessageDTO } from '../dto/messages.js';
import type { SendMessageInput } from '../schemas/messages.js';

export type Ack<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: string; message: string } };

export interface ClientToServerEvents {
  'conversation:join': (
    input: { conversationId: string },
    ack: (response: Ack<{ joined: true }>) => void,
  ) => void;
  'conversation:leave': (
    input: { conversationId: string },
    ack: (response: Ack<null>) => void,
  ) => void;
  'message:send': (
    input: SendMessageInput,
    ack: (response: Ack<{ message: MessageDTO; duplicate: boolean }>) => void,
  ) => void;
}

export interface ServerToClientEvents {
  'message:new': (payload: { message: MessageDTO }) => void;
  'conversation:updated': (payload: ConversationUpdatedEvent) => void;
  'auth:expired': () => void;
}

export type InterServerEvents = Record<string, never>;

export interface SocketData {
  auth?: {
    userId: string;
    sessionId: string;
    expiresAt: number;
  };
  joinedConversationIds?: Set<string>;
  messageTimestamps?: number[];
}
