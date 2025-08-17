import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import reviewsController from '../controllers/reviewsController';
import { authenticateToken } from '../middleware/auth';
import {
  validateCreateReview,
  validateUpdateReview,
  validateReviewId,
  validateUserId,
  validateUserReviewsQuery,
  validateBookReviewsQuery,
  sanitizeReviewText,
  reviewRateLimit,
} from '../middleware/reviewsValidation';

const router = Router();

// Rate limiters for different operations
const createReviewLimiter = rateLimit(reviewRateLimit.create);
const readReviewLimiter = rateLimit(reviewRateLimit.read);
const modifyReviewLimiter = rateLimit(reviewRateLimit.modify);

/**
 * @route   POST /reviews
 * @desc    Create a new review
 * @access  Private (JWT required)
 * @body    { bookId: string, text: string, rating: number }
 */
router.post(
  '/',
  createReviewLimiter,
  authenticateToken,
  validateCreateReview,
  sanitizeReviewText,
  reviewsController.createReview.bind(reviewsController)
);

/**
 * @route   PUT /reviews/:reviewId
 * @desc    Update an existing review
 * @access  Private (JWT required, owner only)
 * @params  reviewId: string (UUID)
 * @body    { text?: string, rating?: number }
 */
router.put(
  '/:reviewId',
  modifyReviewLimiter,
  authenticateToken,
  validateUpdateReview,
  sanitizeReviewText,
  reviewsController.updateReview.bind(reviewsController)
);

/**
 * @route   DELETE /reviews/:reviewId
 * @desc    Delete a review
 * @access  Private (JWT required, owner only)
 * @params  reviewId: string (UUID)
 */
router.delete(
  '/:reviewId',
  modifyReviewLimiter,
  authenticateToken,
  validateReviewId,
  reviewsController.deleteReview.bind(reviewsController)
);

/**
 * @route   GET /reviews/:reviewId
 * @desc    Get a specific review by ID
 * @access  Public
 * @params  reviewId: string (UUID)
 */
router.get(
  '/:reviewId',
  readReviewLimiter,
  validateReviewId,
  reviewsController.getReviewById.bind(reviewsController)
);

/**
 * @route   GET /reviews/user/:userId
 * @desc    Get reviews by user with pagination
 * @access  Public
 * @params  userId: string (UUID)
 * @query   page?: number, limit?: number, sort?: string
 */
router.get(
  '/user/:userId',
  readReviewLimiter,
  validateUserId,
  validateUserReviewsQuery,
  reviewsController.getUserReviews.bind(reviewsController)
);

/**
 * @route   GET /reviews/book/:bookId
 * @desc    Get reviews for a specific book with pagination
 * @access  Public
 * @params  bookId: string (UUID)
 * @query   page?: number, limit?: number, sort?: string
 */
router.get(
  '/book/:bookId',
  readReviewLimiter,
  validateBookReviewsQuery,
  reviewsController.getBookReviews.bind(reviewsController)
);

/**
 * @route   GET /reviews/check/:bookId
 * @desc    Check if current user has reviewed a specific book
 * @access  Private (JWT required)
 * @params  bookId: string (UUID)
 */
router.get(
  '/check/:bookId',
  readReviewLimiter,
  authenticateToken,
  validateBookReviewsQuery,
  reviewsController.checkUserBookReview.bind(reviewsController)
);

/**
 * @route   GET /reviews/stats/user/:userId
 * @desc    Get user review statistics
 * @access  Public
 * @params  userId: string (UUID)
 */
router.get(
  '/stats/user/:userId',
  readReviewLimiter,
  validateUserId,
  reviewsController.getUserReviewStats.bind(reviewsController)
);

export default router;
