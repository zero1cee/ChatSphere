import type { ApiErrorBody, ApiSuccess } from '@chatsphere/shared';
import type { Response } from 'express';

export function getRequestId(res: Response): string {
  const header = res.getHeader('x-request-id');

  return typeof header === 'string' && header.length > 0 ? header : 'unknown';
}

export function sendSuccess<T, TMeta = Record<string, unknown>>(
  res: Response,
  data: T,
  status = 200,
  meta?: TMeta,
): void {
  const body: ApiSuccess<T, TMeta> = {
    data,
    ...(meta === undefined ? {} : { meta }),
    requestId: getRequestId(res),
  };

  res.status(status).json(body);
}

export function sendError(
  res: Response,
  status: number,
  code: string,
  message: string,
  details?: unknown,
): void {
  const body: ApiErrorBody = {
    error: {
      code,
      message,
      ...(details === undefined ? {} : { details }),
    },
    requestId: getRequestId(res),
  };

  res.status(status).json(body);
}
