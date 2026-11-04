import { rateLimit } from 'express-rate-limit';

import { env } from '../config/env.js';
import { sendError } from './api-response.js';

export function createRateLimiter(options: {
  windowMs: number;
  limit: number;
}): ReturnType<typeof rateLimit> {
  return rateLimit({
    windowMs: options.windowMs,
    limit: options.limit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    skip: () => !env.RATE_LIMIT_ENABLED,
    handler: (_req, res) => {
      sendError(res, 429, 'RATE_LIMITED', 'Too many requests. Please try again later.');
    },
  });
}
