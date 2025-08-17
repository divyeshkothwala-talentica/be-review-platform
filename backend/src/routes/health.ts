import { Router, Request, Response } from 'express';
import { ResponseUtil } from '../utils/response';
import { asyncHandler } from '../middleware/errorHandler';
import config from '../config';
import database from '../config/database';

const router = Router();

interface HealthCheckResponse {
  status: string;
  timestamp: string;
  uptime: number;
  environment: string;
  version: string;
  services: {
    database: string;
    redis?: string;
  };
}

// GET /health - Basic health check
router.get(
  '/',
  asyncHandler(async (_req: Request, res: Response) => {
    // Check database health
    const dbHealth = await database.healthCheck();
    
    const healthData: HealthCheckResponse = {
      status: dbHealth.status === 'healthy' ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: config.nodeEnv,
      version: config.apiVersion,
      services: {
        database: dbHealth.status,
        redis: 'not_connected', // Will be updated when Redis is implemented
      },
    };

    const statusCode = healthData.status === 'healthy' ? 200 : 503;
    const message = healthData.status === 'healthy' ? 'Service is healthy' : 'Service is degraded';
    
    ResponseUtil.success(res, healthData, message, statusCode);
  })
);

// GET /health/ready - Readiness probe (for Kubernetes)
router.get(
  '/ready',
  asyncHandler(async (_req: Request, res: Response) => {
    // Check if database is connected and healthy
    const dbHealth = await database.healthCheck();
    const isReady = dbHealth.status === 'healthy';

    if (isReady) {
      ResponseUtil.success(res, { ready: true, database: dbHealth.status }, 'Service is ready');
    } else {
      ResponseUtil.error(res, 'SERVICE_NOT_READY', `Service is not ready: ${dbHealth.message}`, 503);
    }
  })
);

// GET /health/live - Liveness probe (for Kubernetes)
router.get(
  '/live',
  asyncHandler(async (_req: Request, res: Response) => {
    ResponseUtil.success(res, { alive: true }, 'Service is alive');
  })
);

export default router;
