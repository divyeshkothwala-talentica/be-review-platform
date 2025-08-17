import { Request, Response, NextFunction } from 'express';
import { JWTService, JWTPayload } from '../services/jwtService';
import User, { IUser } from '../models/User';
import { ApiResponse } from '../utils/response';

// Extend Express Request interface to include user
declare global {
  namespace Express {
    interface Request {
      user?: IUser;
      userId?: string;
    }
  }
}

/**
 * Authentication middleware to verify JWT tokens
 */
export const authenticateToken = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Extract token from Authorization header
    const authHeader = req.headers.authorization;
    const token = JWTService.extractTokenFromHeader(authHeader);

    if (!token) {
      res.status(401).json(
        ApiResponse.error('Access token required', 401, 'MISSING_TOKEN')
      );
      return;
    }

    // Verify token
    let decoded: JWTPayload;
    try {
      decoded = JWTService.verifyToken(token);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Invalid token';
      res.status(403).json(
        ApiResponse.error(message, 403, 'INVALID_TOKEN')
      );
      return;
    }

    // Find user by ID from token
    const user = await User.findById(decoded.userId);
    if (!user) {
      res.status(403).json(
        ApiResponse.error('User not found', 403, 'USER_NOT_FOUND')
      );
      return;
    }

    // Attach user to request object
    req.user = user;
    req.userId = user._id;

    next();
  } catch (error) {
    console.error('Authentication middleware error:', error);
    res.status(500).json(
      ApiResponse.error('Authentication failed', 500, 'AUTH_ERROR')
    );
  }
};

/**
 * Optional authentication middleware - doesn't fail if no token provided
 */
export const optionalAuth = async (
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    const token = JWTService.extractTokenFromHeader(authHeader);

    if (token) {
      try {
        const decoded = JWTService.verifyToken(token);
        const user = await User.findById(decoded.userId);
        
        if (user) {
          req.user = user;
          req.userId = user._id;
        }
      } catch (error) {
        // Silently ignore token errors for optional auth
        console.warn('Optional auth token error:', error);
      }
    }

    next();
  } catch (error) {
    console.error('Optional authentication middleware error:', error);
    next(); // Continue without authentication
  }
};

/**
 * Authorization middleware to check resource ownership
 */
export const requireOwnership = (resourceUserIdField: string = 'userId') => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json(
          ApiResponse.error('Authentication required', 401, 'AUTH_REQUIRED')
        );
        return;
      }

      // Get resource user ID from request params, body, or query
      const resourceUserId = 
        req.params[resourceUserIdField] || 
        req.body[resourceUserIdField] || 
        req.query[resourceUserIdField];

      if (!resourceUserId) {
        res.status(400).json(
          ApiResponse.error('Resource user ID not provided', 400, 'MISSING_USER_ID')
        );
        return;
      }

      // Check if the authenticated user owns the resource
      if (req.user._id !== resourceUserId) {
        res.status(403).json(
          ApiResponse.error('Access denied: insufficient permissions', 403, 'ACCESS_DENIED')
        );
        return;
      }

      next();
    } catch (error) {
      console.error('Authorization middleware error:', error);
      res.status(500).json(
        ApiResponse.error('Authorization failed', 500, 'AUTH_ERROR')
      );
    }
  };
};

/**
 * Admin authorization middleware (for future use)
 */
export const requireAdmin = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json(
        ApiResponse.error('Authentication required', 401, 'AUTH_REQUIRED')
      );
      return;
    }

    // For now, we'll implement this as a placeholder
    // In the future, add an 'isAdmin' field to the User model
    // if (req.user.isAdmin !== true) {
    //   res.status(403).json(
    //     ApiResponse.error('Admin access required', 403, 'ADMIN_REQUIRED')
    //   );
    //   return;
    // }

    // Temporary: Allow all authenticated users (remove this later)
    console.warn('Admin middleware: Currently allowing all authenticated users');
    
    next();
  } catch (error) {
    console.error('Admin authorization middleware error:', error);
    res.status(500).json(
      ApiResponse.error('Authorization failed', 500, 'AUTH_ERROR')
    );
  }
};

/**
 * Rate limiting middleware for authentication endpoints
 */
export const authRateLimit = (maxAttempts: number = 5, windowMs: number = 15 * 60 * 1000) => {
  const attempts = new Map<string, { count: number; resetTime: number }>();

  return (req: Request, res: Response, next: NextFunction): void => {
    const clientId = req.ip || 'unknown';
    const now = Date.now();
    
    // Clean up expired entries
    for (const [key, value] of attempts.entries()) {
      if (now > value.resetTime) {
        attempts.delete(key);
      }
    }

    const clientAttempts = attempts.get(clientId);
    
    if (!clientAttempts) {
      // First attempt
      attempts.set(clientId, { count: 1, resetTime: now + windowMs });
      next();
      return;
    }

    if (now > clientAttempts.resetTime) {
      // Reset window
      attempts.set(clientId, { count: 1, resetTime: now + windowMs });
      next();
      return;
    }

    if (clientAttempts.count >= maxAttempts) {
      // Rate limit exceeded
      const resetTime = new Date(clientAttempts.resetTime);
      res.status(429).json(
        ApiResponse.error(
          `Too many authentication attempts. Try again after ${resetTime.toISOString()}`,
          429,
          'RATE_LIMIT_EXCEEDED'
        )
      );
      return;
    }

    // Increment attempts
    clientAttempts.count++;
    next();
  };
};

export default {
  authenticateToken,
  optionalAuth,
  requireOwnership,
  requireAdmin,
  authRateLimit,
};
