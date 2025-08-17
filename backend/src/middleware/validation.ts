import { Request, Response, NextFunction } from 'express';
import { ApiResponse } from '../utils/response';

/**
 * Validation result interface
 */
interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

/**
 * Field validation rules interface
 */
interface ValidationRule {
  required?: boolean;
  type?: 'string' | 'number' | 'email' | 'boolean';
  minLength?: number;
  maxLength?: number;
  pattern?: RegExp;
  custom?: (value: any) => string | null;
}

/**
 * Schema validation interface
 */
interface ValidationSchema {
  [key: string]: ValidationRule;
}

/**
 * Validation middleware factory
 */
export const validateRequest = (schema: ValidationSchema, source: 'body' | 'query' | 'params' = 'body') => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const data = req[source];
    const result = validateSchema(data, schema);

    if (!result.isValid) {
      res.status(400).json(
        ApiResponse.error('Validation failed', 400, 'VALIDATION_ERROR', {
          errors: result.errors,
        })
      );
      return;
    }

    next();
  };
};

/**
 * Validate data against schema
 */
const validateSchema = (data: any, schema: ValidationSchema): ValidationResult => {
  const errors: string[] = [];

  for (const [field, rules] of Object.entries(schema)) {
    const value = data?.[field];
    const fieldErrors = validateField(field, value, rules);
    errors.push(...fieldErrors);
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};

/**
 * Validate individual field
 */
const validateField = (fieldName: string, value: any, rules: ValidationRule): string[] => {
  const errors: string[] = [];

  // Required validation
  if (rules.required && (value === undefined || value === null || value === '')) {
    errors.push(`${fieldName} is required`);
    return errors; // Skip other validations if required field is missing
  }

  // Skip other validations if field is not provided and not required
  if (value === undefined || value === null || value === '') {
    return errors;
  }

  // Type validation
  if (rules.type) {
    const typeError = validateType(fieldName, value, rules.type);
    if (typeError) {
      errors.push(typeError);
      return errors; // Skip other validations if type is wrong
    }
  }

  // String-specific validations
  if (typeof value === 'string') {
    // Min length validation
    if (rules.minLength && value.length < rules.minLength) {
      errors.push(`${fieldName} must be at least ${rules.minLength} characters long`);
    }

    // Max length validation
    if (rules.maxLength && value.length > rules.maxLength) {
      errors.push(`${fieldName} cannot exceed ${rules.maxLength} characters`);
    }

    // Pattern validation
    if (rules.pattern && !rules.pattern.test(value)) {
      errors.push(`${fieldName} format is invalid`);
    }
  }

  // Custom validation
  if (rules.custom) {
    const customError = rules.custom(value);
    if (customError) {
      errors.push(customError);
    }
  }

  return errors;
};

/**
 * Validate field type
 */
const validateType = (fieldName: string, value: any, expectedType: string): string | null => {
  switch (expectedType) {
    case 'string':
      if (typeof value !== 'string') {
        return `${fieldName} must be a string`;
      }
      break;

    case 'number':
      if (typeof value !== 'number' || isNaN(value)) {
        return `${fieldName} must be a valid number`;
      }
      break;

    case 'email':
      if (typeof value !== 'string') {
        return `${fieldName} must be a string`;
      }
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(value)) {
        return `${fieldName} must be a valid email address`;
      }
      break;

    case 'boolean':
      if (typeof value !== 'boolean') {
        return `${fieldName} must be a boolean`;
      }
      break;

    default:
      return `Unknown type validation: ${expectedType}`;
  }

  return null;
};

/**
 * Authentication validation schemas
 */
export const authValidationSchemas = {
  register: {
    name: {
      required: true,
      type: 'string' as const,
      minLength: 2,
      maxLength: 100,
      pattern: /^[a-zA-Z\s]+$/,
      custom: (value: string) => {
        if (value && value.trim().length < 2) {
          return 'Name must contain at least 2 non-whitespace characters';
        }
        return null;
      },
    },
    email: {
      required: true,
      type: 'email' as const,
      maxLength: 255,
      custom: (value: string) => {
        if (value && value.toLowerCase() !== value) {
          return null; // Will be normalized to lowercase
        }
        return null;
      },
    },
    password: {
      required: true,
      type: 'string' as const,
      minLength: 8,
      maxLength: 128,
      pattern: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d@$!%*?&]{8,}$/,
      custom: (value: string) => {
        if (!value) return null;
        
        const hasLower = /[a-z]/.test(value);
        const hasUpper = /[A-Z]/.test(value);
        const hasNumber = /\d/.test(value);
        
        if (!hasLower) return 'Password must contain at least one lowercase letter';
        if (!hasUpper) return 'Password must contain at least one uppercase letter';
        if (!hasNumber) return 'Password must contain at least one number';
        
        return null;
      },
    },
  },

  login: {
    email: {
      required: true,
      type: 'email' as const,
      maxLength: 255,
    },
    password: {
      required: true,
      type: 'string' as const,
      minLength: 1,
      maxLength: 128,
    },
  },

  changePassword: {
    currentPassword: {
      required: true,
      type: 'string' as const,
      minLength: 1,
      maxLength: 128,
    },
    newPassword: {
      required: true,
      type: 'string' as const,
      minLength: 8,
      maxLength: 128,
      pattern: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d@$!%*?&]{8,}$/,
      custom: (value: string) => {
        if (!value) return null;
        
        const hasLower = /[a-z]/.test(value);
        const hasUpper = /[A-Z]/.test(value);
        const hasNumber = /\d/.test(value);
        
        if (!hasLower) return 'New password must contain at least one lowercase letter';
        if (!hasUpper) return 'New password must contain at least one uppercase letter';
        if (!hasNumber) return 'New password must contain at least one number';
        
        return null;
      },
    },
  },

  validateToken: {
    token: {
      required: true,
      type: 'string' as const,
      minLength: 10,
      custom: (value: string) => {
        if (!value) return null;
        
        // Basic JWT format validation (header.payload.signature)
        const parts = value.split('.');
        if (parts.length !== 3) {
          return 'Token must be a valid JWT format';
        }
        
        return null;
      },
    },
  },
};

/**
 * Sanitization middleware
 */
export const sanitizeInput = (req: Request, _res: Response, next: NextFunction): void => {
  // Sanitize string inputs
  const sanitizeObject = (obj: any): any => {
    if (typeof obj === 'string') {
      return obj.trim();
    }
    
    if (Array.isArray(obj)) {
      return obj.map(sanitizeObject);
    }
    
    if (obj && typeof obj === 'object') {
      const sanitized: any = {};
      for (const [key, value] of Object.entries(obj)) {
        sanitized[key] = sanitizeObject(value);
      }
      return sanitized;
    }
    
    return obj;
  };

  // Sanitize request body
  if (req.body) {
    req.body = sanitizeObject(req.body);
  }

  // Sanitize query parameters
  if (req.query) {
    req.query = sanitizeObject(req.query);
  }

  next();
};

/**
 * Normalize email middleware
 */
export const normalizeEmail = (req: Request, _res: Response, next: NextFunction): void => {
  if (req.body?.email) {
    req.body.email = req.body.email.toLowerCase().trim();
  }
  
  if (req.query?.email) {
    req.query.email = (req.query.email as string).toLowerCase().trim();
  }

  next();
};

export default {
  validateRequest,
  authValidationSchemas,
  sanitizeInput,
  normalizeEmail,
};
