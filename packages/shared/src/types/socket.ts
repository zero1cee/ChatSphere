import type { ConversationUpdatedEvent, MessageDTO } from '../dto/messages.js';
import type { NotificationDTO } from '../dto/notifications.js';
import type { SendMessageInput } from '../schemas/messages.js';

export type Ack<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: string; message: string } };

export interface PresenceState {
  userId: string;
  online: boolean;
  lastSeenAt: string | null;
}

export interface TypingUpdate {
  conversationId: string;
  userId: string;
  name: string;
  isTyping: boolean;
}

export interface ReceiptUpdate {
  conversationId: string;
  userId: string;
  lastDeliveredAt: string | null;
  lastReadAt: string | null;
}

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
  'message:delivered': (
    input: { conversationId: string; messageId: string },
    ack: (response: Ack<null>) => void,
  ) => void;
  'message:read': (
    input: { conversationId: string; messageId: string },
    ack: (response: Ack<null>) => void,
  ) => void;
  'typing:start': (input: { conversationId: string }) => void;
  'typing:stop': (input: { conversationId: string }) => void;
}

export interface ServerToClientEvents {
  'message:new': (payload: { message: MessageDTO }) => void;
  'message:updated': (payload: { message: MessageDTO }) => void;
  'conversation:updated': (payload: ConversationUpdatedEvent) => void;
  'receipt:updated': (payload: ReceiptUpdate) => void;
  'typing:updated': (payload: TypingUpdate) => void;
  'presence:updated': (payload: PresenceState) => void;
  'presence:snapshot': (payload: { users: PresenceState[] }) => void;
  'notification:new': (payload: { notification: NotificationDTO }) => void;
  'auth:expired': () => void;
}

export type InterServerEvents = Record<string, never>;

export interface SocketData {
  auth?: {
    userId: string;
    sessionId: string;
    expiresAt: number;
    name: string;
  };
  joinedConversationIds?: Set<string>;
  messageTimestamps?: number[];
  typingTimestamps?: number[];
}
