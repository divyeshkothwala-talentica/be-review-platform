import { Router } from 'express';
import { BooksController } from '../controllers/booksController';
import {
  validateBooksQuery,
  validateBookId,
  validateBookReviewsQuery,
  sanitizeQuery,
  searchRateLimit,
} from '../middleware/booksValidation';
import { requestLogger } from '../middleware/requestLogger';

const router = Router();

// Apply request logging to all book routes
router.use(requestLogger);

// Apply query sanitization to all routes
router.use(sanitizeQuery);

/**
 * @route   GET /books/genres
 * @desc    Get list of available genres
 * @access  Public
 * @cache   1 hour
 */
router.get('/genres', BooksController.getGenres);

/**
 * @route   GET /books/:bookId/reviews
 * @desc    Get paginated reviews for a specific book
 * @access  Public
 * @params  bookId - UUID of the book
 * @query   page, limit, sort
 */
router.get(
  '/:bookId/reviews',
  validateBookReviewsQuery,
  BooksController.getBookReviews
);

/**
 * @route   GET /books/:bookId
 * @desc    Get detailed information about a specific book
 * @access  Public
 * @params  bookId - UUID of the book
 */
router.get('/:bookId', validateBookId, BooksController.getBookById);

/**
 * @route   GET /books
 * @desc    Get paginated list of books with filtering and sorting
 * @access  Public
 * @query   page, limit, search, genres, sort, author, minRating, publishedYear
 */
router.get(
  '/',
  searchRateLimit,
  validateBooksQuery,
  BooksController.getBooks
);

export default router;
