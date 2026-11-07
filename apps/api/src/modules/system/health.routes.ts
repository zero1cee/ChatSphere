import type { HealthData, ReadinessData } from '@chatsphere/shared';
import { Router } from 'express';

import { sendSuccess } from '../../lib/api-response.js';
import { logger } from '../../lib/logger.js';
import { prisma } from '../../lib/prisma.js';
import { getRedisClient, isRedisConfigured } from '../../lib/redis.js';

export const healthRouter = Router();

healthRouter.get('/health', (_req, res) => {
  const data: HealthData = {
    status: 'ok',
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
  };

  sendSuccess(res, data);
});

healthRouter.get('/health/ready', async (_req, res) => {
  let database: ReadinessData['checks']['database'] = 'down';
  let redis: NonNullable<ReadinessData['checks']['redis']> = 'disabled';

  try {
    await prisma.$queryRaw`SELECT 1`;
    database = 'up';
  } catch (error) {
    logger.error({ err: error }, 'Database readiness check failed');
  }

  if (isRedisConfigured()) {
    try {
      const client = getRedisClient();

      if (client?.isOpen) {
        await client.ping();
        redis = 'up';
      } else {
        redis = 'down';
      }
    } catch (error) {
      logger.error({ err: error }, 'Redis readiness check failed');
      redis = 'down';
    }
  }

  const ready = database === 'up' && redis !== 'down';
  const checks: ReadinessData['checks'] = {
    database,
    ...(isRedisConfigured() ? { redis } : {}),
  };

  const data: ReadinessData = {
    status: ready ? 'ready' : 'unavailable',
    checks,
    timestamp: new Date().toISOString(),
  };

  sendSuccess(res, data, ready ? 200 : 503);
});
