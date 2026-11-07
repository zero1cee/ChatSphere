export * from './constants.js';
/**
 * Shared API contracts.
 *
 * Business objects that need runtime validation live in `schemas/`; transport
 * DTOs live in `dto/`. Both the web app and the API import from this package.
 */

export const APP_NAME = 'ChatSphere' as const;

export interface ApiSuccess<TData, TMeta = Record<string, unknown>> {
  data: TData;
  meta?: TMeta;
  requestId: string;
}

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
  requestId: string;
}

export interface HealthData {
  status: 'ok';
  uptimeSeconds: number;
  timestamp: string;
}

export interface ReadinessData {
  status: 'ready' | 'unavailable';
  checks: {
    database: 'up' | 'down';
    redis?: 'up' | 'down' | 'disabled';
  };
  timestamp: string;
}

export * from './dto/auth.js';
export * from './dto/conversations.js';
export * from './dto/messages.js';
export * from './dto/notifications.js';
export * from './dto/users.js';
export * from './schemas/auth.js';
export * from './schemas/conversations.js';
export * from './schemas/messages.js';
export * from './schemas/users.js';
export * from './types/socket.js';
