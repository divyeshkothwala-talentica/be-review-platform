import { Request, Response } from 'express';
import recommendationsService from '../services/recommendationsService';
import { ResponseUtil } from '../utils/response';
import { logger } from '../utils/logger';

interface AuthenticatedRequest extends Request {
  userId?: string;
}

/**
 * Get AI-powered book recommendations for authenticated user
 * GET /api/v1/recommendations
 */
export const getRecommendations = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId;

    if (!userId) {
      ResponseUtil.unauthorized(res, 'User not authenticated');
      return;
    }

    logger.info('Generating recommendations for user', { userId });

    const recommendations = await recommendationsService.generateRecommendations(userId);

    ResponseUtil.success(res, recommendations, 'Recommendations generated successfully');
  } catch (error) {
    logger.error('Error in getRecommendations controller:', error);
    
    if (error instanceof Error && error.message === 'Failed to generate recommendations') {
      ResponseUtil.error(res, 'SERVICE_UNAVAILABLE', 'Unable to generate recommendations at this time. Please try again later.', 503);
    } else {
      ResponseUtil.error(res, 'INTERNAL_ERROR', 'Internal server error', 500);
    }
  }
};

/**
 * Invalidate user's recommendation cache
 * DELETE /api/v1/recommendations/cache
 */
export const invalidateRecommendationCache = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId;

    if (!userId) {
      ResponseUtil.unauthorized(res, 'User not authenticated');
      return;
    }

    recommendationsService.invalidateUserCache(userId);

    logger.info('Recommendation cache invalidated', { userId });

    ResponseUtil.success(res, null, 'Recommendation cache invalidated successfully');
  } catch (error) {
    logger.error('Error in invalidateRecommendationCache controller:', error);
    ResponseUtil.error(res, 'INTERNAL_ERROR', 'Internal server error', 500);
  }
};

/**
 * Get recommendation system health status
 * GET /api/v1/recommendations/health
 */
export const getRecommendationHealth = async (_req: Request, res: Response): Promise<void> => {
  try {
    const healthStatus = await recommendationsService.testRecommendationSystem();
    const cacheStats = recommendationsService.getCacheStats();

    const overallHealth = healthStatus.fallbackWorking && healthStatus.cacheWorking;

    const response = {
      status: overallHealth ? 'healthy' : 'degraded',
      services: {
        openai: {
          available: healthStatus.openaiAvailable,
          status: healthStatus.openaiAvailable ? 'operational' : 'unavailable',
        },
        fallback: {
          working: healthStatus.fallbackWorking,
          status: healthStatus.fallbackWorking ? 'operational' : 'error',
        },
        cache: {
          working: healthStatus.cacheWorking,
          status: healthStatus.cacheWorking ? 'operational' : 'error',
          stats: {
            size: cacheStats.size,
            entries: cacheStats.entries.length,
          },
        },
      },
      timestamp: new Date().toISOString(),
    };

    if (overallHealth) {
      ResponseUtil.success(res, response, 'Recommendation system is healthy');
    } else {
      ResponseUtil.error(res, 'SERVICE_DEGRADED', 'Recommendation system is experiencing issues', 503, response);
    }
  } catch (error) {
    logger.error('Error in getRecommendationHealth controller:', error);
    ResponseUtil.error(res, 'INTERNAL_ERROR', 'Unable to check system health', 500);
  }
};

/**
 * Get cache statistics (admin endpoint)
 * GET /api/v1/recommendations/cache/stats
 */
export const getCacheStats = async (_req: Request, res: Response): Promise<void> => {
  try {
    const stats = recommendationsService.getCacheStats();

    const response = {
      cache: {
        size: stats.size,
        entries: stats.entries.map(entry => ({
          userId: entry.userId,
          expiresInMs: entry.expiresIn,
          expiresInMinutes: Math.round(entry.expiresIn / (1000 * 60)),
        })),
      },
      timestamp: new Date().toISOString(),
    };

    ResponseUtil.success(res, response, 'Cache statistics retrieved successfully');
  } catch (error) {
    logger.error('Error in getCacheStats controller:', error);
    ResponseUtil.error(res, 'INTERNAL_ERROR', 'Internal server error', 500);
  }
};

/**
 * Clear all recommendation cache (admin endpoint)
 * DELETE /api/v1/recommendations/cache/all
 */
export const clearAllCache = async (_req: Request, res: Response): Promise<void> => {
  try {
    recommendationsService.clearCache();

    logger.info('All recommendation cache cleared by admin');

    ResponseUtil.success(res, null, 'All recommendation cache cleared successfully');
  } catch (error) {
    logger.error('Error in clearAllCache controller:', error);
    ResponseUtil.error(res, 'INTERNAL_ERROR', 'Internal server error', 500);
  }
};