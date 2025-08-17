import rateLimit from 'express-rate-limit';
import { Request, Response } from 'express';
import config from '../config';
import { ResponseUtil } from '../utils/response';

// General rate limiter for all requests
export const generalLimiter = rateLimit({
  windowMs: config.rateLimitWindowMs,
  max: config.rateLimitMaxRequests,
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests from this IP, please try again later.',
      timestamp: new Date().toISOString(),
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req: Request, res: Response) => {
    ResponseUtil.tooManyRequests(
      res,
      `Too many requests from this IP, please try again in ${Math.ceil(
        config.rateLimitWindowMs / 1000 / 60
      )} minutes.`
    );
  },
});

// Stricter rate limiter for authentication endpoints
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 requests per windowMs
  message: {
    success: false,
    error: {
      code: 'AUTH_RATE_LIMIT_EXCEEDED',
      message: 'Too many authentication attempts, please try again later.',
      timestamp: new Date().toISOString(),
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req: Request, res: Response) => {
    ResponseUtil.tooManyRequests(
      res,
      'Too many authentication attempts from this IP, please try again in 15 minutes.'
    );
  },
});

// Rate limiter for creating reviews (to prevent spam)
export const reviewLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // Limit each IP to 10 review creations per hour
  message: {
    success: false,
    error: {
      code: 'REVIEW_RATE_LIMIT_EXCEEDED',
      message: 'Too many reviews created, please try again later.',
      timestamp: new Date().toISOString(),
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req: Request, res: Response) => {
    ResponseUtil.tooManyRequests(
      res,
      'Too many reviews created from this IP, please try again in 1 hour.'
    );
  },
});
