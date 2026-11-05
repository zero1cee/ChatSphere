import type { Ack } from '@chatsphere/shared';

import { AppError } from '../lib/errors.js';
import { logger } from '../lib/logger.js';

export function replyWithError<T>(
  ack: ((response: Ack<T>) => void) | undefined,
  error: unknown,
): void {
  if (typeof ack !== 'function') {
    return;
  }

  if (error instanceof AppError) {
    ack({
      ok: false,
      error: {
        code: error.code,
        message: error.message,
      },
    });
    return;
  }

  logger.error({ err: error }, 'Unhandled socket handler error');
  ack({
    ok: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: 'Something went wrong. Please try again.',
    },
  });
}
