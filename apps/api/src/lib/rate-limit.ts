import { rateLimit } from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';

import { env } from '../config/env.js';
import { sendError } from './api-response.js';
import { connectRedis, getRedisClient } from './redis.js';

export function createRateLimiter(options: {
  windowMs: number;
  limit: number;
  prefix: string;
}): ReturnType<typeof rateLimit> {
  const store = env.REDIS_URL
    ? new RedisStore({
        prefix: `chatsphere:rl:${options.prefix}:`,
        sendCommand: async (...args: string[]) => {
          const client = getRedisClient() ?? (await connectRedis());

          if (!client) {
            throw new Error('Redis rate-limit store is not connected.');
          }

          return client.sendCommand(args);
        },
      })
    : undefined;

  return rateLimit({
    windowMs: options.windowMs,
    limit: options.limit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    ...(store ? { store } : {}),
    skip: () => !env.RATE_LIMIT_ENABLED,
    handler: (_req, res) => {
      sendError(res, 429, 'RATE_LIMITED', 'Too many requests. Please try again later.');
    },
  });
}
