import { createServer } from 'node:http';

import { createApp } from './app.js';
import { env } from './config/env.js';
import { logger } from './lib/logger.js';
import { prisma } from './lib/prisma.js';
import { closeRedis, connectRedis } from './lib/redis.js';
import { createSocketServer } from './realtime/io.js';
import { closeSocketAdapter, setupSocketAdapter } from './realtime/redis-adapter.js';

const app = createApp();
const server = createServer(app);
const io = createSocketServer(server);

try {
  await connectRedis();
  await setupSocketAdapter(io);
} catch (error) {
  logger.fatal({ err: error }, 'Redis initialization failed');
  process.exit(1);
}

async function shutdown(signal: NodeJS.Signals): Promise<void> {
  logger.info({ signal }, 'Shutting down');

  const forceExit = setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 10_000);
  forceExit.unref();

  io.close(async () => {
    try {
      await closeSocketAdapter();
      await closeRedis();
      await prisma.$disconnect();
    } catch (shutdownError) {
      logger.error({ err: shutdownError }, 'Shutdown cleanup failed');
    }

    process.exit(0);
  });
}

process.once('SIGINT', () => {
  void shutdown('SIGINT');
});
process.once('SIGTERM', () => {
  void shutdown('SIGTERM');
});

server.on('error', (error) => {
  logger.error({ err: error }, 'HTTP server error');
  process.exitCode = 1;
});

server.listen(env.API_PORT, () => {
  logger.info(
    { port: env.API_PORT, environment: env.NODE_ENV, redis: Boolean(env.REDIS_URL) },
    'ChatSphere API listening',
  );
});
