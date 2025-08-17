import { Request, Response, NextFunction } from 'express';
import { query, param, validationResult } from 'express-validator';
import { ResponseUtil } from '../utils/response';
import { VALID_GENRES } from '../models/Book';

/**
 * Validation middleware for books listing endpoint
 */
export const validateBooksQuery = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer')
    .toInt(),
  
  query('limit')
    .optional()
    .isInt({ min: 1, max: 50 })
    .withMessage('Limit must be between 1 and 50')
    .toInt(),
  
  query('search')
    .optional()
    .isString()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Search term must be between 1 and 100 characters'),
  
  query('genres')
    .optional()
    .custom((value: any) => {
      // Handle both single genre and array of genres
      const genres = Array.isArray(value) ? value : [value];
      
      // Check if all genres are valid
      const invalidGenres = genres.filter((genre: string) => !VALID_GENRES.includes(genre));
      if (invalidGenres.length > 0) {
        throw new Error(`Invalid genres: ${invalidGenres.join(', ')}`);
      }
      
      // Check maximum number of genres
      if (genres.length > 5) {
        throw new Error('Maximum 5 genres allowed');
      }
      
      return true;
    }),
  
  query('sort')
    .optional()
    .isIn(['newest', 'oldest', 'rating', 'rating_low', 'reviews', 'title', 'author'])
    .withMessage('Sort must be one of: newest, oldest, rating, rating_low, reviews, title, author'),
  
  query('author')
    .optional()
    .isString()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Author filter must be between 1 and 100 characters'),
  
  query('minRating')
    .optional()
    .isFloat({ min: 0, max: 5 })
    .withMessage('Minimum rating must be between 0 and 5')
    .toFloat(),
  
  query('publishedYear')
    .optional()
    .isInt({ min: 1000, max: new Date().getFullYear() })
    .withMessage(`Published year must be between 1000 and ${new Date().getFullYear()}`)
    .toInt(),

  // Validation result handler
  (req: Request, res: Response, next: NextFunction): void => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const errorDetails = errors.array().map((error: any) => ({
        field: error.type === 'field' ? error.path : 'unknown',
        message: error.msg,
        value: error.type === 'field' ? error.value : undefined,
      }));
      
      ResponseUtil.validationError(res, errorDetails, 'Invalid query parameters');
      return;
    }
    next();
  },
];

/**
 * Validation middleware for book ID parameter
 */
export const validateBookId = [
  param('bookId')
    .notEmpty()
    .withMessage('Book ID is required')
    .isLength({ min: 10 })
    .withMessage('Invalid book ID format')
    .custom((value: any) => {
      // Basic UUID format validation (more lenient than strict UUID)
      if (typeof value !== 'string' || value.length < 10) {
        throw new Error('Invalid book ID format');
      }
      return true;
    }),

  // Validation result handler
  (req: Request, res: Response, next: NextFunction): void => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const errorDetails = errors.array().map((error: any) => ({
        field: error.type === 'field' ? error.path : 'unknown',
        message: error.msg,
        value: error.type === 'field' ? error.value : undefined,
      }));
      
      ResponseUtil.validationError(res, errorDetails, 'Invalid book ID');
      return;
    }
    next();
  },
];

/**
 * Validation middleware for book reviews query parameters
 */
export const validateBookReviewsQuery = [
  param('bookId')
    .notEmpty()
    .withMessage('Book ID is required')
    .isLength({ min: 10 })
    .withMessage('Invalid book ID format'),

  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer')
    .toInt(),
  
  query('limit')
    .optional()
    .isInt({ min: 1, max: 50 })
    .withMessage('Limit must be between 1 and 50')
    .toInt(),
  
  query('sort')
    .optional()
    .isIn(['newest', 'oldest', 'rating_high', 'rating_low'])
    .withMessage('Sort must be one of: newest, oldest, rating_high, rating_low'),

  // Validation result handler
  (req: Request, res: Response, next: NextFunction): void => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const errorDetails = errors.array().map((error: any) => ({
        field: error.type === 'field' ? error.path : 'unknown',
        message: error.msg,
        value: error.type === 'field' ? error.value : undefined,
      }));
      
      ResponseUtil.validationError(res, errorDetails, 'Invalid parameters');
      return;
    }
    next();
  },
];

/**
 * Validation middleware for genre parameter
 */
export const validateGenre = [
  param('genre')
    .notEmpty()
    .withMessage('Genre is required')
    .isIn(VALID_GENRES)
    .withMessage(`Genre must be one of: ${VALID_GENRES.join(', ')}`),

  // Validation result handler
  (req: Request, res: Response, next: NextFunction): void => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const errorDetails = errors.array().map((error: any) => ({
        field: error.type === 'field' ? error.path : 'unknown',
        message: error.msg,
        value: error.type === 'field' ? error.value : undefined,
      }));
      
      ResponseUtil.validationError(res, errorDetails, 'Invalid genre');
      return;
    }
    next();
  },
];

/**
 * Custom validation for search parameters
 */
export const validateSearchQuery = [
  query('q')
    .notEmpty()
    .withMessage('Search query is required')
    .isString()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Search query must be between 1 and 100 characters'),

  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer')
    .toInt(),
  
  query('limit')
    .optional()
    .isInt({ min: 1, max: 50 })
    .withMessage('Limit must be between 1 and 50')
    .toInt(),

  // Validation result handler
  (req: Request, res: Response, next: NextFunction): void => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const errorDetails = errors.array().map((error: any) => ({
        field: error.type === 'field' ? error.path : 'unknown',
        message: error.msg,
        value: error.type === 'field' ? error.value : undefined,
      }));
      
      ResponseUtil.validationError(res, errorDetails, 'Invalid search parameters');
      return;
    }
    next();
  },
];

/**
 * Sanitize and normalize query parameters
 */
export const sanitizeQuery = (req: Request, _res: Response, next: NextFunction) => {
  // Normalize genres to array format
  if (req.query.genres && !Array.isArray(req.query.genres)) {
    req.query.genres = [req.query.genres as string];
  }

  // Trim string parameters
  const stringParams = ['search', 'author', 'sort'];
  stringParams.forEach(param => {
    if (req.query[param] && typeof req.query[param] === 'string') {
      req.query[param] = (req.query[param] as string).trim();
    }
  });

  // Convert numeric parameters
  const numericParams = ['page', 'limit', 'minRating', 'publishedYear'];
  numericParams.forEach(param => {
    if (req.query[param]) {
      const value = req.query[param] as string;
      if (param === 'minRating') {
        (req.query as any)[param] = parseFloat(value);
      } else {
        (req.query as any)[param] = parseInt(value, 10);
      }
    }
  });

  next();
};

/**
 * Rate limiting for search endpoints (more restrictive)
 */
export const searchRateLimit = (_req: Request, _res: Response, next: NextFunction) => {
  // This would typically use a rate limiting library like express-rate-limit
  // For now, we'll just pass through
  // TODO: Implement proper rate limiting for search endpoints
  next();
};
