/**
 * Shared API contracts.
 *
 * These types are intentionally transport-oriented: the web app and the API
 * agree on the shape of envelopes and simple DTOs. Business objects that need
 * runtime validation will live in `schemas/` once those features exist.
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
  };
  timestamp: string;
}
