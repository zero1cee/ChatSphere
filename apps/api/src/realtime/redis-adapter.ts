import { createAdapter } from '@socket.io/redis-adapter';
import { createClient, type RedisClientType } from 'redis';

import { env } from '../config/env.js';
import { logger } from '../lib/logger.js';
import type { ChatServer } from './io.js';

let pubClient: RedisClientType | null = null;
let subClient: RedisClientType | null = null;

export async function setupSocketAdapter(io: ChatServer): Promise<void> {
  if (!env.REDIS_URL) {
    return;
  }

  const publisher: RedisClientType = createClient({ url: env.REDIS_URL });
  const subscriber = publisher.duplicate();
  publisher.on('error', (error) => {
    logger.error({ err: error }, 'Socket.IO Redis publisher error');
  });
  subscriber.on('error', (error) => {
    logger.error({ err: error }, 'Socket.IO Redis subscriber error');
  });

  try {
    await Promise.all([publisher.connect(), subscriber.connect()]);
    io.adapter(createAdapter(publisher, subscriber));
    pubClient = publisher;
    subClient = subscriber;
    logger.info('Socket.IO Redis adapter enabled');
  } catch (error) {
    await Promise.allSettled([publisher.quit(), subscriber.quit()]);
    throw error;
  }
}

export async function closeSocketAdapter(): Promise<void> {
  const clients = [pubClient, subClient].filter((client): client is RedisClientType =>
    Boolean(client),
  );
  await Promise.allSettled(
    clients.map((client) => (client.isOpen ? client.quit() : Promise.resolve())),
  );
  pubClient = null;
  subClient = null;
}
