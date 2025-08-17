import { Request, Response, NextFunction } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { ApiResponse } from '../utils/response';
import { logger } from '../utils/logger';

/**
 * Validation middleware for creating a review
 */
export const validateCreateReview = [
  body('bookId')
    .notEmpty()
    .withMessage('Book ID is required')
    .isString()
    .withMessage('Book ID must be a string')
    .isLength({ min: 36, max: 36 })
    .withMessage('Book ID must be a valid UUID')
    .matches(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)
    .withMessage('Book ID must be a valid UUID format'),

  body('text')
    .notEmpty()
    .withMessage('Review text is required')
    .isString()
    .withMessage('Review text must be a string')
    .trim()
    .isLength({ min: 1, max: 2000 })
    .withMessage('Review text must be between 1 and 2000 characters')
    .escape(), // Sanitize HTML entities

  body('rating')
    .notEmpty()
    .withMessage('Rating is required')
    .isInt({ min: 1, max: 5 })
    .withMessage('Rating must be an integer between 1 and 5')
    .toInt(),

  // Validation result handler
  (req: Request, res: Response, next: NextFunction): void => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      logger.warn('Review creation validation failed', { 
        errors: errors.array(),
        body: req.body 
      });
      
      res.status(400).json(
        ApiResponse.error('Validation failed', 400, 'VALIDATION_ERROR', {
          validationErrors: errors.array().map(error => ({
            field: error.type === 'field' ? error.path : 'unknown',
            message: error.msg,
            value: error.type === 'field' ? error.value : undefined,
          })),
        })
      );
      return;
    }
    next();
  },
];

/**
 * Validation middleware for updating a review
 */
export const validateUpdateReview = [
  param('reviewId')
    .notEmpty()
    .withMessage('Review ID is required')
    .isString()
    .withMessage('Review ID must be a string')
    .isLength({ min: 36, max: 36 })
    .withMessage('Review ID must be a valid UUID')
    .matches(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)
    .withMessage('Review ID must be a valid UUID format'),

  body('text')
    .optional()
    .isString()
    .withMessage('Review text must be a string')
    .trim()
    .isLength({ min: 1, max: 2000 })
    .withMessage('Review text must be between 1 and 2000 characters')
    .escape(), // Sanitize HTML entities

  body('rating')
    .optional()
    .isInt({ min: 1, max: 5 })
    .withMessage('Rating must be an integer between 1 and 5')
    .toInt(),

  // Ensure at least one field is provided for update
  body()
    .custom((_value, { req }) => {
      if (!req.body.text && !req.body.rating) {
        throw new Error('At least one field (text or rating) must be provided for update');
      }
      return true;
    }),

  // Validation result handler
  (req: Request, res: Response, next: NextFunction): void => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      logger.warn('Review update validation failed', { 
        errors: errors.array(),
        params: req.params,
        body: req.body 
      });
      
      res.status(400).json(
        ApiResponse.error('Validation failed', 400, 'VALIDATION_ERROR', {
          validationErrors: errors.array().map(error => ({
            field: error.type === 'field' ? error.path : 'unknown',
            message: error.msg,
            value: error.type === 'field' ? error.value : undefined,
          })),
        })
      );
      return;
    }
    next();
  },
];

/**
 * Validation middleware for review ID parameter
 */
export const validateReviewId = [
  param('reviewId')
    .notEmpty()
    .withMessage('Review ID is required')
    .isString()
    .withMessage('Review ID must be a string')
    .isLength({ min: 36, max: 36 })
    .withMessage('Review ID must be a valid UUID')
    .matches(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)
    .withMessage('Review ID must be a valid UUID format'),

  // Validation result handler
  (req: Request, res: Response, next: NextFunction): void => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      logger.warn('Review ID validation failed', { 
        errors: errors.array(),
        params: req.params 
      });
      
      res.status(400).json(
        ApiResponse.error('Invalid review ID', 400, 'VALIDATION_ERROR', {
          validationErrors: errors.array().map(error => ({
            field: error.type === 'field' ? error.path : 'unknown',
            message: error.msg,
            value: error.type === 'field' ? error.value : undefined,
          })),
        })
      );
      return;
    }
    next();
  },
];

/**
 * Validation middleware for user ID parameter
 */
export const validateUserId = [
  param('userId')
    .notEmpty()
    .withMessage('User ID is required')
    .isString()
    .withMessage('User ID must be a string')
    .isLength({ min: 36, max: 36 })
    .withMessage('User ID must be a valid UUID')
    .matches(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)
    .withMessage('User ID must be a valid UUID format'),

  // Validation result handler
  (req: Request, res: Response, next: NextFunction): void => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      logger.warn('User ID validation failed', { 
        errors: errors.array(),
        params: req.params 
      });
      
      res.status(400).json(
        ApiResponse.error('Invalid user ID', 400, 'VALIDATION_ERROR', {
          validationErrors: errors.array().map(error => ({
            field: error.type === 'field' ? error.path : 'unknown',
            message: error.msg,
            value: error.type === 'field' ? error.value : undefined,
          })),
        })
      );
      return;
    }
    next();
  },
];

/**
 * Validation middleware for user reviews query parameters
 */
export const validateUserReviewsQuery = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer')
    .toInt(),

  query('limit')
    .optional()
    .isInt({ min: 1, max: 50 })
    .withMessage('Limit must be an integer between 1 and 50')
    .toInt(),

  query('sort')
    .optional()
    .isIn(['newest', 'oldest', 'rating_high', 'rating_low'])
    .withMessage('Sort must be one of: newest, oldest, rating_high, rating_low'),

  // Validation result handler
  (req: Request, res: Response, next: NextFunction): void => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      logger.warn('User reviews query validation failed', { 
        errors: errors.array(),
        query: req.query 
      });
      
      res.status(400).json(
        ApiResponse.error('Invalid query parameters', 400, 'VALIDATION_ERROR', {
          validationErrors: errors.array().map(error => ({
            field: error.type === 'field' ? error.path : 'unknown',
            message: error.msg,
            value: error.type === 'field' ? error.value : undefined,
          })),
        })
      );
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
    .isString()
    .withMessage('Book ID must be a string')
    .isLength({ min: 36, max: 36 })
    .withMessage('Book ID must be a valid UUID')
    .matches(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)
    .withMessage('Book ID must be a valid UUID format'),

  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer')
    .toInt(),

  query('limit')
    .optional()
    .isInt({ min: 1, max: 50 })
    .withMessage('Limit must be an integer between 1 and 50')
    .toInt(),

  query('sort')
    .optional()
    .isIn(['newest', 'oldest', 'rating_high', 'rating_low'])
    .withMessage('Sort must be one of: newest, oldest, rating_high, rating_low'),

  // Validation result handler
  (req: Request, res: Response, next: NextFunction): void => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      logger.warn('Book reviews query validation failed', { 
        errors: errors.array(),
        params: req.params,
        query: req.query 
      });
      
      res.status(400).json(
        ApiResponse.error('Invalid parameters', 400, 'VALIDATION_ERROR', {
          validationErrors: errors.array().map(error => ({
            field: error.type === 'field' ? error.path : 'unknown',
            message: error.msg,
            value: error.type === 'field' ? error.value : undefined,
          })),
        })
      );
      return;
    }
    next();
  },
];

/**
 * Sanitize review text to prevent XSS attacks
 */
export const sanitizeReviewText = (req: Request, _res: Response, next: NextFunction): void => {
  if (req.body.text) {
    // Additional sanitization beyond express-validator's escape()
    req.body.text = req.body.text
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Remove script tags
      .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '') // Remove iframe tags
      .replace(/javascript:/gi, '') // Remove javascript: protocol
      .replace(/on\w+\s*=/gi, '') // Remove event handlers
      .trim();
  }
  next();
};

/**
 * Rate limiting specifically for review operations
 */
export const reviewRateLimit = {
  // More restrictive for create operations
  create: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // 5 reviews per 15 minutes
    message: {
      success: false,
      message: 'Too many review creation attempts. Please try again later.',
      data: null,
      meta: {
        retryAfter: '15 minutes',
      },
    },
  },
  
  // Less restrictive for read operations
  read: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // 100 requests per 15 minutes
    message: {
      success: false,
      message: 'Too many requests. Please try again later.',
      data: null,
      meta: {
        retryAfter: '15 minutes',
      },
    },
  },
  
  // Moderate for update/delete operations
  modify: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 20, // 20 modifications per 15 minutes
    message: {
      success: false,
      message: 'Too many modification attempts. Please try again later.',
      data: null,
      meta: {
        retryAfter: '15 minutes',
      },
    },
  },
};
