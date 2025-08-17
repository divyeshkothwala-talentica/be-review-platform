import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { FavoritesController } from '../controllers/favoritesController';
import { authenticateToken } from '../middleware/auth';
import { favoritesValidation } from '../middleware/favoritesValidation';

const router = Router();

/**
 * All favorites routes require authentication
 * Apply authentication middleware to all routes
 */
router.use(authenticateToken);

/**
 * @route   GET /favorites
 * @desc    Get paginated list of user's favorite books
 * @access  Private (authenticated users only)
 * @query   page (optional) - Page number (default: 1)
 * @query   limit (optional) - Items per page (default: 12, max: 50)
 */
router.get(
  '/',
  rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 60, // 60 requests per minute
    message: 'Too many requests to get favorites',
    standardHeaders: true,
    legacyHeaders: false,
  }),
  favoritesValidation.getUserFavorites,
  FavoritesController.getUserFavorites
);

/**
 * @route   POST /favorites
 * @desc    Add a book to user's favorites
 * @access  Private (authenticated users only)
 * @body    bookId (required) - ID of the book to add to favorites
 */
router.post(
  '/',
  rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 30, // 30 add operations per minute
    message: 'Too many requests to add favorites',
    standardHeaders: true,
    legacyHeaders: false,
  }),
  favoritesValidation.addToFavorites,
  FavoritesController.addToFavorites
);

/**
 * @route   DELETE /favorites/:bookId
 * @desc    Remove a book from user's favorites
 * @access  Private (authenticated users only)
 * @param   bookId - ID of the book to remove from favorites
 */
router.delete(
  '/:bookId',
  rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 30, // 30 remove operations per minute
    message: 'Too many requests to remove favorites',
    standardHeaders: true,
    legacyHeaders: false,
  }),
  favoritesValidation.removeFromFavorites,
  FavoritesController.removeFromFavorites
);

/**
 * @route   GET /favorites/check/:bookId
 * @desc    Check if a book is in user's favorites
 * @access  Private (authenticated users only)
 * @param   bookId - ID of the book to check
 */
router.get(
  '/check/:bookId',
  rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 100, // 100 check requests per minute
    message: 'Too many requests to check favorite status',
    standardHeaders: true,
    legacyHeaders: false,
  }),
  favoritesValidation.checkFavoriteStatus,
  FavoritesController.checkFavoriteStatus
);

/**
 * @route   GET /favorites/stats
 * @desc    Get user's favorites statistics
 * @access  Private (authenticated users only)
 */
router.get(
  '/stats',
  rateLimit({
    windowMs: 5 * 60 * 1000, // 5 minutes
    max: 20, // 20 stats requests per 5 minutes
    message: 'Too many requests to get favorites statistics',
    standardHeaders: true,
    legacyHeaders: false,
  }),
  FavoritesController.getFavoritesStats
);

/**
 * Future enhancement routes (commented out for now)
 */

/**
 * @route   POST /favorites/toggle/:bookId
 * @desc    Toggle favorite status (add if not exists, remove if exists)
 * @access  Private (authenticated users only)
 * @param   bookId - ID of the book to toggle
 */
/*
router.post(
  '/toggle/:bookId',
  rateLimiter.createLimiter({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 30, // 30 toggle operations per minute
    message: 'Too many requests to toggle favorites',
    standardHeaders: true,
    legacyHeaders: false,
  }),
  favoritesValidation.checkFavoriteStatus, // Reuse validation
  FavoritesController.toggleFavorite
);
*/

/**
 * @route   POST /favorites/bulk
 * @desc    Bulk add/remove favorites
 * @access  Private (authenticated users only)
 * @body    bookIds (required) - Array of book IDs
 * @body    operation (required) - 'add' or 'remove'
 */
/*
router.post(
  '/bulk',
  rateLimiter.createLimiter({
    windowMs: 5 * 60 * 1000, // 5 minutes
    max: 5, // 5 bulk operations per 5 minutes
    message: 'Too many bulk favorites requests',
    standardHeaders: true,
    legacyHeaders: false,
  }),
  favoritesValidation.bulkOperation,
  FavoritesController.bulkFavoritesOperation
);
*/

/**
 * @route   GET /favorites/popular
 * @desc    Get popular books based on favorites count
 * @access  Public (no authentication required)
 * @query   limit (optional) - Number of books to return (default: 10, max: 50)
 */
/*
router.get(
  '/popular',
  rateLimiter.createLimiter({
    windowMs: 5 * 60 * 1000, // 5 minutes
    max: 30, // 30 requests per 5 minutes
    message: 'Too many requests to get popular books',
    standardHeaders: true,
    legacyHeaders: false,
  }),
  // No authentication required for popular books
  FavoritesController.getPopularBooks
);
*/

export default router;
