import { Request, Response, NextFunction } from 'express';
import { body, validationResult } from 'express-validator';
import { ApiResponse } from '../utils/response';
import { logger } from '../utils/logger';

/**
 * Validation middleware for user profile update requests
 */
export class UserProfileValidation {
  /**
   * Validation rules for profile update
   */
  static updateProfileValidation = [
    body('name')
      .optional()
      .isString()
      .withMessage('Name must be a string')
      .trim()
      .isLength({ min: 2, max: 100 })
      .withMessage('Name must be between 2 and 100 characters')
      .matches(/^[a-zA-Z\s]+$/)
      .withMessage('Name can only contain letters and spaces')
      .customSanitizer((value: string) => {
        // Remove extra spaces and capitalize properly
        return value.replace(/\s+/g, ' ').trim();
      }),

    body('email')
      .optional()
      .isString()
      .withMessage('Email must be a string')
      .trim()
      .toLowerCase()
      .isEmail()
      .withMessage('Please provide a valid email address')
      .normalizeEmail({
        gmail_remove_dots: false,
        gmail_remove_subaddress: false,
        outlookdotcom_remove_subaddress: false,
        yahoo_remove_subaddress: false,
        icloud_remove_subaddress: false,
      }),
  ];

  /**
   * Handle validation errors
   */
  static handleValidationErrors = (
    req: Request,
    res: Response,
    next: NextFunction
  ): void => {
    try {
      const errors = validationResult(req);
      
      if (!errors.isEmpty()) {
        const errorMessages = errors.array().map(error => ({
          field: error.type === 'field' ? (error as any).path : 'unknown',
          message: error.msg,
          value: error.type === 'field' ? (error as any).value : undefined,
        }));

        logger.warn('Profile update validation failed', { 
          userId: req.user?._id,
          errors: errorMessages 
        });

        res.status(400).json(
          ApiResponse.error(
            'Validation failed',
            400,
            'VALIDATION_ERROR',
            {
              errors: errorMessages,
            }
          )
        );
        return;
      }

      next();
    } catch (error) {
      logger.error('Error in validation middleware', { error: (error as Error).message });
      res.status(500).json(
        ApiResponse.error('Validation processing failed', 500, 'VALIDATION_PROCESSING_ERROR')
      );
    }
  };

  /**
   * Validate that at least one field is provided for update
   */
  static validateUpdateFields = (
    req: Request,
    res: Response,
    next: NextFunction
  ): void => {
    try {
      const { name, email } = req.body;

      // Check if at least one field is provided
      if (name === undefined && email === undefined) {
        logger.warn('Profile update attempted with no fields', { userId: req.user?._id });
        
        res.status(400).json(
          ApiResponse.error(
            'At least one field (name or email) must be provided for update',
            400,
            'NO_UPDATE_FIELDS'
          )
        );
        return;
      }

      // Check for empty strings after trimming
      if ((name !== undefined && typeof name === 'string' && name.trim() === '') ||
          (email !== undefined && typeof email === 'string' && email.trim() === '')) {
        logger.warn('Profile update attempted with empty fields', { userId: req.user?._id });
        
        res.status(400).json(
          ApiResponse.error(
            'Fields cannot be empty strings',
            400,
            'EMPTY_FIELDS'
          )
        );
        return;
      }

      next();
    } catch (error) {
      logger.error('Error in update fields validation', { error: (error as Error).message });
      res.status(500).json(
        ApiResponse.error('Field validation failed', 500, 'FIELD_VALIDATION_ERROR')
      );
    }
  };

  /**
   * Sanitize input data to prevent XSS attacks
   */
  static sanitizeInput = (
    req: Request,
    res: Response,
    next: NextFunction
  ): void => {
    try {
      const { name, email } = req.body;

      // Sanitize name
      if (name !== undefined && typeof name === 'string') {
        // Remove any HTML tags and normalize whitespace
        req.body.name = name
          .replace(/<[^>]*>/g, '') // Remove HTML tags
          .replace(/[<>]/g, '') // Remove remaining angle brackets
          .replace(/\s+/g, ' ') // Normalize whitespace
          .trim();
      }

      // Sanitize email
      if (email !== undefined && typeof email === 'string') {
        // Remove any HTML tags and normalize
        req.body.email = email
          .replace(/<[^>]*>/g, '') // Remove HTML tags
          .replace(/[<>]/g, '') // Remove remaining angle brackets
          .toLowerCase()
          .trim();
      }

      next();
    } catch (error) {
      logger.error('Error in input sanitization', { error: (error as Error).message });
      res.status(500).json(
        ApiResponse.error('Input sanitization failed', 500, 'SANITIZATION_ERROR')
      );
    }
  };

  /**
   * Rate limiting validation for profile updates
   */
  static validateUpdateFrequency = (
    req: Request,
    res: Response,
    next: NextFunction
  ): void => {
    try {
      // This is a placeholder for rate limiting logic
      // In a production environment, you might want to limit profile updates
      // to prevent abuse (e.g., max 5 updates per hour per user)
      
      // For now, we'll just log the update attempt
      logger.info('Profile update attempt', { 
        userId: req.user?._id,
        timestamp: new Date().toISOString(),
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });

      next();
    } catch (error) {
      logger.error('Error in update frequency validation', { error: (error as Error).message });
      res.status(500).json(
        ApiResponse.error('Update frequency validation failed', 500, 'FREQUENCY_VALIDATION_ERROR')
      );
    }
  };

  /**
   * Complete validation chain for profile updates
   */
  static validateProfileUpdate = [
    UserProfileValidation.sanitizeInput,
    UserProfileValidation.validateUpdateFields,
    ...UserProfileValidation.updateProfileValidation,
    UserProfileValidation.handleValidationErrors,
    UserProfileValidation.validateUpdateFrequency,
  ];
}

export default UserProfileValidation;
