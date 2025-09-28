import { Router, Request, Response } from 'express';
import { ResponseUtil } from '../utils/response';
import { asyncHandler } from '../middleware/errorHandler';
import config from '../config';
import database from '../config/database';
import * as fs from 'fs';
import * as path from 'path';

const router = Router();

// Helper function to read deployment timestamps
function getDeploymentInfo() {
  try {
    const deploymentTimestampPath = path.join(__dirname, '../../deployment-timestamp.txt');
    const buildTimestampPath = path.join(__dirname, '../../build-timestamp.txt');
    
    let deploymentTime: string | undefined;
    let buildTime: string | undefined;
    
    if (fs.existsSync(deploymentTimestampPath)) {
      deploymentTime = fs.readFileSync(deploymentTimestampPath, 'utf8').trim();
    }
    
    if (fs.existsSync(buildTimestampPath)) {
      buildTime = fs.readFileSync(buildTimestampPath, 'utf8').trim();
    }
    
    return { deploymentTime, buildTime };
  } catch (error) {
    console.warn('Could not read deployment timestamps:', error);
    return { deploymentTime: undefined, buildTime: undefined };
  }
}

interface HealthCheckResponse {
  status: string;
  timestamp: string;
  uptime: number;
  environment: string;
  version: string;
  deploymentTime?: string;
  buildTime?: string;
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
    
    // Get deployment timestamps
    const { deploymentTime, buildTime } = getDeploymentInfo();
    
    const healthData: HealthCheckResponse = {
      status: dbHealth.status === 'healthy' ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: config.nodeEnv,
      version: config.apiVersion,
      deploymentTime,
      buildTime,
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
