import Book, { IBook, VALID_GENRES } from '../models/Book';
import Review from '../models/Review';
import { logger } from '../utils/logger';

export interface BookSearchOptions {
  page?: number;
  limit?: number;
  search?: string;
  genres?: string[];
  sort?: string;
  author?: string;
  minRating?: number;
  publishedYear?: number;
}

export interface BookReviewsOptions {
  page?: number;
  limit?: number;
  sort?: string;
}

export interface PaginatedResult<T> {
  data: T[];
  totalItems: number;
  currentPage: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
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

export class BooksService {
  /**
   * Search and filter books with pagination
   */
  static async searchBooks(options: BookSearchOptions): Promise<PaginatedResult<IBook>> {
    try {
      const {
        page = 1,
        limit = 12,
        search,
        genres,
        sort = 'newest',
        author,
        minRating,
        publishedYear,
      } = options;

      // Validate and sanitize inputs
      const pageNum = Math.max(1, page);
      const limitNum = Math.min(50, Math.max(1, limit));
      const skip = (pageNum - 1) * limitNum;

      // Build query filter
      const filter: any = {};

      // Search functionality using text index
      if (search && search.trim()) {
        filter.$text = { $search: search.trim() };
      }

      // Genre filtering
      if (genres && genres.length > 0) {
        const validGenres = genres.filter(genre => VALID_GENRES.includes(genre));
        if (validGenres.length > 0) {
          filter.genres = { $in: validGenres };
        }
      }

      // Author filtering (case-insensitive partial match)
      if (author && author.trim()) {
        filter.author = { $regex: author.trim(), $options: 'i' };
      }

      // Minimum rating filtering
      if (minRating !== undefined && minRating >= 0 && minRating <= 5) {
        filter.averageRating = { $gte: minRating };
      }

      // Published year filtering
      if (publishedYear && publishedYear >= 1000 && publishedYear <= new Date().getFullYear()) {
        filter.publishedYear = publishedYear;
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

      const totalPages = Math.ceil(totalItems / limitNum);

      logger.info('Books search executed', {
        filter,
        sort: sortCriteria,
        page: pageNum,
        limit: limitNum,
        totalItems,
        resultCount: books.length,
      });

      return {
        data: books as IBook[],
        totalItems,
        currentPage: pageNum,
        totalPages,
        hasNextPage: pageNum < totalPages,
        hasPrevPage: pageNum > 1,
      };
    } catch (error) {
      logger.error('Error in books search service:', error);
      throw new Error('Failed to search books');
    }
  }

  /**
   * Get book by ID
   */
  static async getBookById(bookId: string): Promise<IBook | null> {
    try {
      const book = await Book.findById(bookId).lean().exec();
      
      if (book) {
        logger.info(`Book retrieved: ${bookId}`);
      }

      return book as IBook | null;
    } catch (error) {
      logger.error(`Error retrieving book ${bookId}:`, error);
      throw new Error('Failed to retrieve book');
    }
  }

  /**
   * Get reviews for a specific book with pagination
   */
  static async getBookReviews(
    bookId: string,
    options: BookReviewsOptions
  ): Promise<PaginatedResult<any>> {
    try {
      const { page = 1, limit = 10, sort = 'newest' } = options;

      // Validate and sanitize inputs
      const pageNum = Math.max(1, page);
      const limitNum = Math.min(50, Math.max(1, limit));
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

      const totalPages = Math.ceil(totalItems / limitNum);

      logger.info(`Book reviews retrieved for book: ${bookId}`, {
        page: pageNum,
        limit: limitNum,
        totalItems,
        resultCount: reviews.length,
      });

      return {
        data: reviews,
        totalItems,
        currentPage: pageNum,
        totalPages,
        hasNextPage: pageNum < totalPages,
        hasPrevPage: pageNum > 1,
      };
    } catch (error) {
      logger.error(`Error retrieving reviews for book ${bookId}:`, error);
      throw new Error('Failed to retrieve book reviews');
    }
  }

  /**
   * Get available genres
   */
  static getGenres(): string[] {
    return VALID_GENRES.sort();
  }

  /**
   * Check if book exists
   */
  static async bookExists(bookId: string): Promise<boolean> {
    try {
      const book = await Book.findById(bookId).select('_id').lean().exec();
      return !!book;
    } catch (error) {
      logger.error(`Error checking if book exists ${bookId}:`, error);
      return false;
    }
  }

  /**
   * Get books by genre
   */
  static async getBooksByGenre(
    genre: string,
    options: Omit<BookSearchOptions, 'genres'> = {}
  ): Promise<PaginatedResult<IBook>> {
    if (!VALID_GENRES.includes(genre)) {
      throw new Error('Invalid genre provided');
    }

    return this.searchBooks({ ...options, genres: [genre] });
  }

  /**
   * Get books by author
   */
  static async getBooksByAuthor(
    author: string,
    options: Omit<BookSearchOptions, 'author'> = {}
  ): Promise<PaginatedResult<IBook>> {
    return this.searchBooks({ ...options, author });
  }

  /**
   * Get recently published books (within last 2 years)
   */
  static async getRecentBooks(
    options: Omit<BookSearchOptions, 'publishedYear'> = {}
  ): Promise<PaginatedResult<IBook>> {
    const currentYear = new Date().getFullYear();
    const twoYearsAgo = currentYear - 2;

    const filter: any = {
      publishedYear: { $gte: twoYearsAgo },
    };

    // Build additional filters from options
    if (options.search) {
      filter.$text = { $search: options.search };
    }
    if (options.genres && options.genres.length > 0) {
      filter.genres = { $in: options.genres };
    }
    if (options.author) {
      filter.author = { $regex: options.author, $options: 'i' };
    }
    if (options.minRating !== undefined) {
      filter.averageRating = { $gte: options.minRating };
    }

    const pageNum = Math.max(1, options.page || 1);
    const limitNum = Math.min(50, Math.max(1, options.limit || 12));
    const skip = (pageNum - 1) * limitNum;

    const sortCriteria = options.sort && options.sort in SORT_OPTIONS 
      ? SORT_OPTIONS[options.sort as keyof typeof SORT_OPTIONS]
      : SORT_OPTIONS.newest;

    try {
      const [books, totalItems] = await Promise.all([
        Book.find(filter)
          .sort(sortCriteria)
          .skip(skip)
          .limit(limitNum)
          .lean()
          .exec(),
        Book.countDocuments(filter),
      ]);

      const totalPages = Math.ceil(totalItems / limitNum);

      return {
        data: books as IBook[],
        totalItems,
        currentPage: pageNum,
        totalPages,
        hasNextPage: pageNum < totalPages,
        hasPrevPage: pageNum > 1,
      };
    } catch (error) {
      logger.error('Error retrieving recent books:', error);
      throw new Error('Failed to retrieve recent books');
    }
  }

  /**
   * Get top-rated books
   */
  static async getTopRatedBooks(
    options: Omit<BookSearchOptions, 'sort' | 'minRating'> = {}
  ): Promise<PaginatedResult<IBook>> {
    return this.searchBooks({ 
      ...options, 
      sort: 'rating',
      minRating: 4.0 // Only books with rating 4.0 or higher
    });
  }

  /**
   * Get most reviewed books
   */
  static async getMostReviewedBooks(
    options: Omit<BookSearchOptions, 'sort'> = {}
  ): Promise<PaginatedResult<IBook>> {
    return this.searchBooks({ ...options, sort: 'reviews' });
  }
}
