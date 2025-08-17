import { Request, Response, NextFunction } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { ApiResponse } from '../utils/response';
import { logger } from '../utils/logger';

/**
 * Validation middleware for favorites endpoints
 */

/**
 * Validation rules for adding a book to favorites
 */
export const validateAddToFavorites = [
  body('bookId')
    .notEmpty()
    .withMessage('Book ID is required')
    .isString()
    .withMessage('Book ID must be a string')
    .trim()
    .isLength({ min: 10, max: 100 })
    .withMessage('Book ID must be between 10 and 100 characters')
    .matches(/^[a-zA-Z0-9-_]+$/)
    .withMessage('Book ID contains invalid characters'),
];

/**
 * Validation rules for removing a book from favorites (path parameter)
 */
export const validateRemoveFromFavorites = [
  param('bookId')
    .notEmpty()
    .withMessage('Book ID is required')
    .isString()
    .withMessage('Book ID must be a string')
    .trim()
    .isLength({ min: 10, max: 100 })
    .withMessage('Book ID must be between 10 and 100 characters')
    .matches(/^[a-zA-Z0-9-_]+$/)
    .withMessage('Book ID contains invalid characters'),
];

/**
 * Validation rules for checking favorite status (path parameter)
 */
export const validateCheckFavoriteStatus = [
  param('bookId')
    .notEmpty()
    .withMessage('Book ID is required')
    .isString()
    .withMessage('Book ID must be a string')
    .trim()
    .isLength({ min: 10, max: 100 })
    .withMessage('Book ID must be between 10 and 100 characters')
    .matches(/^[a-zA-Z0-9-_]+$/)
    .withMessage('Book ID contains invalid characters'),
];

/**
 * Validation rules for getting user favorites (query parameters)
 */
export const validateGetUserFavorites = [
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
];

/**
 * Generic validation error handler
 */
export const handleValidationErrors = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    const errorMessages = errors.array().map(error => ({
      field: error.type === 'field' ? error.path : 'unknown',
      message: error.msg,
      value: error.type === 'field' ? error.value : undefined,
    }));

    logger.warn('Validation errors in favorites request:', {
      path: req.path,
      method: req.method,
      errors: errorMessages,
      body: req.body,
      params: req.params,
      query: req.query,
    });

    res.status(400).json(
      ApiResponse.error(
        'Validation failed',
        400,
        'VALIDATION_ERROR',
        { errors: errorMessages }
      )
    );
    return;
  }

  next();
};

/**
 * Sanitization middleware for favorites requests
 */
export const sanitizeFavoritesInput = (
  req: Request,
  _res: Response,
  next: NextFunction
): void => {
  try {
    // Sanitize body
    if (req.body) {
      if (req.body.bookId && typeof req.body.bookId === 'string') {
        req.body.bookId = req.body.bookId.trim();
      }
    }

    // Sanitize params
    if (req.params) {
      if (req.params.bookId && typeof req.params.bookId === 'string') {
        req.params.bookId = req.params.bookId.trim();
      }
    }

    // Sanitize query parameters
    if (req.query) {
      if (req.query.page && typeof req.query.page === 'string') {
        req.query.page = req.query.page.trim();
      }
      if (req.query.limit && typeof req.query.limit === 'string') {
        req.query.limit = req.query.limit.trim();
      }
    }

    next();
  } catch (error) {
    logger.error('Error in favorites input sanitization:', error);
    next(); // Continue even if sanitization fails
  }
};

/**
 * Rate limiting validation for favorites operations
 */
export const validateFavoritesRateLimit = (
  req: Request,
  _res: Response,
  next: NextFunction
): void => {
  // Simple rate limiting check - can be enhanced with Redis or more sophisticated logic
  const userId = req.userId;

  if (!userId) {
    next();
    return;
  }

  // In a production environment, this should use Redis or a proper rate limiting solution
  // For now, we'll use a simple in-memory approach (not suitable for production clusters)
  // This is a simplified implementation - in production, use proper rate limiting
  // middleware like express-rate-limit with Redis store
  
  next(); // For now, just pass through
};

/**
 * Validation middleware for bulk favorites operations (future enhancement)
 */
export const validateBulkFavoritesOperation = [
  body('bookIds')
    .isArray({ min: 1, max: 20 })
    .withMessage('Book IDs must be an array with 1-20 items'),
  body('bookIds.*')
    .isString()
    .withMessage('Each book ID must be a string')
    .trim()
    .isLength({ min: 10, max: 100 })
    .withMessage('Each book ID must be between 10 and 100 characters')
    .matches(/^[a-zA-Z0-9-_]+$/)
    .withMessage('Book ID contains invalid characters'),
  body('operation')
    .isIn(['add', 'remove'])
    .withMessage('Operation must be either "add" or "remove"'),
];

/**
 * Combined validation middleware for different endpoints
 */
export const favoritesValidation = {
  addToFavorites: [
    sanitizeFavoritesInput,
    ...validateAddToFavorites,
    handleValidationErrors,
    validateFavoritesRateLimit,
  ],
  removeFromFavorites: [
    sanitizeFavoritesInput,
    ...validateRemoveFromFavorites,
    handleValidationErrors,
    validateFavoritesRateLimit,
  ],
  checkFavoriteStatus: [
    sanitizeFavoritesInput,
    ...validateCheckFavoriteStatus,
    handleValidationErrors,
  ],
  getUserFavorites: [
    sanitizeFavoritesInput,
    ...validateGetUserFavorites,
    handleValidationErrors,
  ],
  bulkOperation: [
    sanitizeFavoritesInput,
    ...validateBulkFavoritesOperation,
    handleValidationErrors,
    validateFavoritesRateLimit,
  ],
};

export default favoritesValidation;
