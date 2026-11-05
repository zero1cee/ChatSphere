import { z } from 'zod';

import { AppError } from './errors.js';

const cursorSchema = z.object({
  createdAt: z.string(),
  id: z.uuid(),
});

export interface MessageCursor {
  createdAt: Date;
  id: string;
}

export function encodeMessageCursor(cursor: MessageCursor): string {
  return Buffer.from(
    JSON.stringify({
      createdAt: cursor.createdAt.toISOString(),
      id: cursor.id,
    }),
  ).toString('base64url');
}

export function decodeMessageCursor(value: string): MessageCursor {
  try {
    const raw = JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as unknown;
    const parsed = cursorSchema.parse(raw);
    const createdAt = new Date(parsed.createdAt);

    if (Number.isNaN(createdAt.getTime())) {
      throw new Error('Invalid date');
    }

    return { createdAt, id: parsed.id };
  } catch {
    throw new AppError(400, 'INVALID_CURSOR', 'The message cursor is invalid.');
  }
}
