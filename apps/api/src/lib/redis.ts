import { createClient, type RedisClientType } from 'redis';

import { env } from '../config/env.js';
import { logger } from './logger.js';

let redisClient: RedisClientType | null = null;
let connection: Promise<RedisClientType | null> | null = null;

export function isRedisConfigured(): boolean {
  return Boolean(env.REDIS_URL);
}

export function getRedisClient(): RedisClientType | null {
  return redisClient;
}

export async function connectRedis(): Promise<RedisClientType | null> {
  if (!env.REDIS_URL) {
    return null;
  }

  if (redisClient?.isOpen) {
    return redisClient;
  }

  if (connection) {
    return connection;
  }

  connection = (async () => {
    const client: RedisClientType = createClient({ url: env.REDIS_URL });

    client.on('error', (error) => {
      logger.error({ err: error }, 'Redis client error');
    });

    await client.connect();
    redisClient = client;
    logger.info('Redis connection established');
    return client;
  })().finally(() => {
    connection = null;
  });

  return connection;
}

export async function closeRedis(): Promise<void> {
  if (!redisClient) {
    return;
  }

  try {
    if (redisClient.isOpen) {
      await redisClient.quit();
    }
  } finally {
    redisClient = null;
  }
}
