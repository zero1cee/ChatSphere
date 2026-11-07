import type {
  ApiErrorBody,
  ApiSuccess,
  AuthSessionData,
  ForgotPasswordInput,
  LoginInput,
  MeData,
  RegisterInput,
  ResendVerificationInput,
  ResetPasswordInput,
  VerifyEmailInput,
} from '@chatsphere/shared';

import { useAuthStore } from '@/stores/auth-store';

const configuredApiUrl = process.env.NEXT_PUBLIC_API_URL;

export const API_BASE_URL = (
  configuredApiUrl === undefined ? 'http://localhost:4000' : configuredApiUrl
).replace(/\/$/, '');

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  headers?: Record<string, string>;
  skipAuthRefresh?: boolean;
}

async function performRefresh(): Promise<AuthSessionData | null> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });

    if (!response.ok) {
      useAuthStore.getState().clearSession();
      return null;
    }

    const payload = (await response.json()) as ApiSuccess<AuthSessionData>;
    useAuthStore.getState().setSession(payload.data.user, payload.data.accessToken);
    return payload.data;
  } catch {
    useAuthStore.getState().clearSession();
    return null;
  }
}

let refreshInFlight: Promise<AuthSessionData | null> | null = null;

/**
 * Refreshes the access token at most once at a time. When supported, the Web
 * Locks API serializes the refresh across tabs so two tabs cannot rotate the
 * same refresh token concurrently.
 */
export function refreshSession(): Promise<AuthSessionData | null> {
  if (refreshInFlight) {
    return refreshInFlight;
  }

  const run = async (): Promise<AuthSessionData | null> => {
    if (typeof navigator !== 'undefined' && navigator.locks) {
      return navigator.locks.request('chatsphere-auth-refresh', performRefresh);
    }

    return performRefresh();
  };

  refreshInFlight = run().finally(() => {
    refreshInFlight = null;
  });

  return refreshInFlight;
}

async function requestEnvelope<T, TMeta>(
  path: string,
  options: RequestOptions = {},
): Promise<ApiSuccess<T, TMeta>> {
  const { body, headers, skipAuthRefresh, method = 'GET' } = options;

  const execute = async (): Promise<Response> => {
    const accessToken = useAuthStore.getState().accessToken;

    return fetch(`${API_BASE_URL}${path}`, {
      method,
      credentials: 'include',
      headers: {
        Accept: 'application/json',
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        ...headers,
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  };

  let response = await execute();

  if (response.status === 401 && !skipAuthRefresh && !path.startsWith('/api/auth/')) {
    const refreshed = await refreshSession();

    if (refreshed) {
      response = await execute();
    }
  }

  if (response.status === 204) {
    return {
      data: undefined as T,
      requestId: response.headers.get('x-request-id') ?? 'unknown',
    };
  }

  const payload = (await response.json().catch(() => null)) as ApiSuccess<T> | ApiErrorBody | null;

  if (!response.ok) {
    const errorBody = payload as ApiErrorBody | null;

    throw new ApiError(
      response.status,
      errorBody?.error?.code ?? 'REQUEST_FAILED',
      errorBody?.error?.message ?? 'Something went wrong. Please try again.',
      errorBody?.error?.details,
    );
  }

  return payload as ApiSuccess<T, TMeta>;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  return (await requestEnvelope<T, never>(path, options)).data;
}

export function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  return request<T>(path, options);
}

export function apiRequestWithMeta<T, TMeta>(
  path: string,
  options: RequestOptions = {},
): Promise<ApiSuccess<T, TMeta>> {
  return requestEnvelope<T, TMeta>(path, options);
}

export function loginRequest(input: LoginInput): Promise<AuthSessionData> {
  return request<AuthSessionData>('/api/auth/login', {
    method: 'POST',
    body: input,
    skipAuthRefresh: true,
  });
}

export function registerRequest(input: RegisterInput): Promise<AuthSessionData> {
  return request<AuthSessionData>('/api/auth/register', {
    method: 'POST',
    body: input,
    skipAuthRefresh: true,
  });
}

export async function logoutRequest(): Promise<void> {
  try {
    await request<void>('/api/auth/logout', {
      method: 'POST',
      skipAuthRefresh: true,
    });
  } finally {
    useAuthStore.getState().clearSession();
  }
}

export function fetchMe(): Promise<MeData> {
  return request<MeData>('/api/users/me');
}

export function verifyEmailRequest(input: VerifyEmailInput): Promise<{ verified: true }> {
  return request<{ verified: true }>('/api/auth/verify-email', {
    method: 'POST',
    body: input,
    skipAuthRefresh: true,
  });
}

export function resendVerificationRequest(input: ResendVerificationInput): Promise<{
  message: string;
}> {
  return request<{ message: string }>('/api/auth/resend-verification', {
    method: 'POST',
    body: input,
    skipAuthRefresh: true,
  });
}

export function forgotPasswordRequest(input: ForgotPasswordInput): Promise<{ message: string }> {
  return request<{ message: string }>('/api/auth/forgot-password', {
    method: 'POST',
    body: input,
    skipAuthRefresh: true,
  });
}

export function resetPasswordRequest(input: ResetPasswordInput): Promise<void> {
  return request<void>('/api/auth/reset-password', {
    method: 'POST',
    body: input,
    skipAuthRefresh: true,
  });
}
