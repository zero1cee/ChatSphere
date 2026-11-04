import type { HealthData, ReadinessData } from '@chatsphere/shared';
import { Router } from 'express';

import { sendSuccess } from '../../lib/api-response.js';
import { logger } from '../../lib/logger.js';
import { prisma } from '../../lib/prisma.js';

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

  try {
    await prisma.$queryRaw`SELECT 1`;
    database = 'up';
  } catch (error) {
    logger.error({ err: error }, 'Database readiness check failed');
  }

  const data: ReadinessData = {
    status: database === 'up' ? 'ready' : 'unavailable',
    checks: { database },
    timestamp: new Date().toISOString(),
  };

  sendSuccess(res, data, database === 'up' ? 200 : 503);
});
