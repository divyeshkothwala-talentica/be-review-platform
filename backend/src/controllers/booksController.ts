import { Request, Response } from 'express';
import { ResponseUtil } from '../utils/response';
import Book, { VALID_GENRES } from '../models/Book';
import Review from '../models/Review';
import { logger } from '../utils/logger';

// Interface for query parameters
interface BooksQuery {
  page?: string;
  limit?: string;
  search?: string;
  genres?: string | string[];
  sort?: string;
  author?: string;
  minRating?: string;
  publishedYear?: string;
}

interface BookReviewsQuery {
  page?: string;
  limit?: string;
  sort?: string;
}

// Sort options mapping
const SORT_OPTIONS = {
  newest: { createdAt: -1 },
  oldest: { createdAt: 1 },
  rating: { averageRating: -1 },
  rating_low: { averageRating: 1 },
  reviews: { totalReviews: -1 },
  title: { title: 1 },
  author: { author: 1 },
} as const;

const REVIEW_SORT_OPTIONS = {
  newest: { createdAt: -1 },
  oldest: { createdAt: 1 },
  rating_high: { rating: -1 },
  rating_low: { rating: 1 },
} as const;

export class BooksController {
  /**
   * GET /books - Get paginated list of books with filtering and sorting
   */
  static async getBooks(req: Request<{}, {}, {}, BooksQuery>, res: Response): Promise<Response> {
    try {
      const {
        page = '1',
        limit = '12',
        search,
        genres,
        sort = 'newest',
        author,
        minRating,
        publishedYear,
      } = req.query;

      // Parse and validate pagination parameters
      const pageNum = Math.max(1, parseInt(page, 10) || 1);
      const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10) || 12));
      const skip = (pageNum - 1) * limitNum;

      // Build query filter
      const filter: any = {};

      // Search functionality
      if (search && search.trim()) {
        filter.$text = { $search: search.trim() };
      }

      // Genre filtering
      if (genres) {
        const genreArray = Array.isArray(genres) ? genres : [genres];
        const validGenres = genreArray.filter(genre => VALID_GENRES.includes(genre));
        if (validGenres.length > 0) {
          filter.genres = { $in: validGenres };
        }
      }

      // Author filtering
      if (author && author.trim()) {
        filter.author = { $regex: author.trim(), $options: 'i' };
      }

      // Minimum rating filtering
      if (minRating) {
        const minRatingNum = parseFloat(minRating);
        if (!isNaN(minRatingNum) && minRatingNum >= 0 && minRatingNum <= 5) {
          filter.averageRating = { $gte: minRatingNum };
        }
      }

      // Published year filtering
      if (publishedYear) {
        const yearNum = parseInt(publishedYear, 10);
        if (!isNaN(yearNum) && yearNum >= 1000 && yearNum <= new Date().getFullYear()) {
          filter.publishedYear = yearNum;
        }
      }

      // Build sort criteria
      let sortCriteria: any = SORT_OPTIONS.newest; // default
      if (sort && sort in SORT_OPTIONS) {
        sortCriteria = SORT_OPTIONS[sort as keyof typeof SORT_OPTIONS];
      }

      // Add text search score sorting if search is present
      if (search && search.trim()) {
        sortCriteria = { score: { $meta: 'textScore' }, ...sortCriteria };
      }

      // Execute query with pagination
      const [books, totalItems] = await Promise.all([
        Book.find(filter)
          .sort(sortCriteria)
          .skip(skip)
          .limit(limitNum)
          .lean()
          .exec(),
        Book.countDocuments(filter),
      ]);

      // Create pagination metadata
      const pagination = ResponseUtil.createPaginationMeta(pageNum, totalItems, limitNum);

      logger.info(`Books query executed`, {
        filter,
        sort: sortCriteria,
        page: pageNum,
        limit: limitNum,
        totalItems,
        resultCount: books.length,
      });

      return ResponseUtil.success(
        res,
        { books },
        'Books retrieved successfully',
        200,
        { pagination }
      );
    } catch (error) {
      logger.error('Error retrieving books:', error);
      return ResponseUtil.internalError(res, 'Failed to retrieve books');
    }
  }

  /**
   * GET /books/:bookId - Get detailed information about a specific book
   */
  static async getBookById(req: Request<{ bookId: string }>, res: Response): Promise<Response> {
    try {
      const { bookId } = req.params;

      // Validate UUID format (basic check)
      if (!bookId || bookId.length < 10) {
        return ResponseUtil.badRequest(res, 'Invalid book ID format');
      }

      const book = await Book.findById(bookId).lean().exec();

      if (!book) {
        return ResponseUtil.notFound(res, 'Book not found');
      }

      logger.info(`Book retrieved: ${bookId}`);

      return ResponseUtil.success(res, { book }, 'Book retrieved successfully');
    } catch (error) {
      logger.error(`Error retrieving book ${req.params.bookId}:`, error);
      return ResponseUtil.internalError(res, 'Failed to retrieve book');
    }
  }

  /**
   * GET /books/:bookId/reviews - Get paginated reviews for a specific book
   */
  static async getBookReviews(
    req: Request<{ bookId: string }, {}, {}, BookReviewsQuery>,
    res: Response
  ): Promise<Response> {
    try {
      const { bookId } = req.params;
      const { page = '1', limit = '10', sort = 'newest' } = req.query;

      // Validate book ID format
      if (!bookId || bookId.length < 10) {
        return ResponseUtil.badRequest(res, 'Invalid book ID format');
      }

      // Check if book exists
      const book = await Book.findById(bookId).lean().exec();
      if (!book) {
        return ResponseUtil.notFound(res, 'Book not found');
      }

      // Parse and validate pagination parameters
      const pageNum = Math.max(1, parseInt(page, 10) || 1);
      const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10) || 10));
      const skip = (pageNum - 1) * limitNum;

      // Build sort criteria
      let sortCriteria: any = REVIEW_SORT_OPTIONS.newest; // default
      if (sort && sort in REVIEW_SORT_OPTIONS) {
        sortCriteria = REVIEW_SORT_OPTIONS[sort as keyof typeof REVIEW_SORT_OPTIONS];
      }

      // Execute query with pagination
      const [reviews, totalItems] = await Promise.all([
        Review.find({ bookId })
          .populate('user', 'name')
          .sort(sortCriteria)
          .skip(skip)
          .limit(limitNum)
          .lean()
          .exec(),
        Review.countDocuments({ bookId }),
      ]);

      // Create pagination metadata
      const pagination = ResponseUtil.createPaginationMeta(pageNum, totalItems, limitNum);

      logger.info(`Book reviews retrieved for book: ${bookId}`, {
        page: pageNum,
        limit: limitNum,
        totalItems,
        resultCount: reviews.length,
      });

      return ResponseUtil.success(
        res,
        { reviews },
        'Book reviews retrieved successfully',
        200,
        { pagination }
      );
    } catch (error) {
      logger.error(`Error retrieving reviews for book ${req.params.bookId}:`, error);
      return ResponseUtil.internalError(res, 'Failed to retrieve book reviews');
    }
  }

  /**
   * GET /books/genres - Get list of available genres
   */
  static async getGenres(_req: Request, res: Response): Promise<Response> {
    try {
      // Return the predefined genres list
      const genres = VALID_GENRES.sort();

      logger.info('Genres list retrieved');

      // Set cache headers for 1 hour
      res.set('Cache-Control', 'public, max-age=3600');

      return ResponseUtil.success(res, { genres }, 'Genres retrieved successfully');
    } catch (error) {
      logger.error('Error retrieving genres:', error);
      return ResponseUtil.internalError(res, 'Failed to retrieve genres');
    }
  }
}
