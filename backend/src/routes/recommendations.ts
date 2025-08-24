import express from 'express';
import { authenticateToken } from '../middleware/auth';
import {
  getRecommendations,
  invalidateRecommendationCache,
  getRecommendationHealth,
  getCacheStats,
  clearAllCache,
} from '../controllers/recommendationsController';

const router = express.Router();

/**
 * @route   GET /api/v1/recommendations
 * @desc    Get AI-powered book recommendations for authenticated user
 * @access  Private
 * @rateLimit 10 requests per 10 minutes per user
 */
router.get(
  '/',
  authenticateToken,
  getRecommendations
);

/**
 * @route   DELETE /api/v1/recommendations/cache
 * @desc    Invalidate user's recommendation cache
 * @access  Private
 */
router.delete('/cache', authenticateToken, invalidateRecommendationCache);

/**
 * @route   GET /api/v1/recommendations/health
 * @desc    Get recommendation system health status
 * @access  Public
 */
router.get('/health', getRecommendationHealth);

/**
 * @route   GET /api/v1/recommendations/cache/stats
 * @desc    Get cache statistics (admin endpoint)
 * @access  Public (should be restricted to admin in production)
 */
router.get('/cache/stats', getCacheStats);

/**
 * @route   DELETE /api/v1/recommendations/cache/all
 * @desc    Clear all recommendation cache (admin endpoint)
 * @access  Public (should be restricted to admin in production)
 */
router.delete('/cache/all', clearAllCache);

export default router;
