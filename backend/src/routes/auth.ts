import { Router } from 'express';
import AuthController from '../controllers/authController';
import { authenticateToken, authRateLimit } from '../middleware/auth';
import { 
  validateRequest, 
  authValidationSchemas, 
  sanitizeInput, 
  normalizeEmail 
} from '../middleware/validation';

const router = Router();

/**
 * Authentication Routes
 * Base path: /api/v1/auth
 */

/**
 * @route   POST /auth/register
 * @desc    Register a new user
 * @access  Public
 * @body    { name: string, email: string, password: string }
 */
router.post(
  '/register',
  authRateLimit(5, 15 * 60 * 1000), // 5 attempts per 15 minutes
  sanitizeInput,
  normalizeEmail,
  validateRequest(authValidationSchemas.register),
  AuthController.register
);

/**
 * @route   POST /auth/login
 * @desc    Login user and get JWT token
 * @access  Public
 * @body    { email: string, password: string }
 */
router.post(
  '/login',
  authRateLimit(5, 15 * 60 * 1000), // 5 attempts per 15 minutes
  sanitizeInput,
  normalizeEmail,
  validateRequest(authValidationSchemas.login),
  AuthController.login
);

/**
 * @route   POST /auth/logout
 * @desc    Logout user (client-side token invalidation)
 * @access  Private
 * @headers Authorization: Bearer <token>
 */
router.post(
  '/logout',
  authenticateToken,
  AuthController.logout
);

/**
 * @route   GET /auth/me
 * @desc    Get current user profile
 * @access  Private
 * @headers Authorization: Bearer <token>
 */
router.get(
  '/me',
  authenticateToken,
  AuthController.getProfile
);

/**
 * @route   PUT /auth/password
 * @desc    Change user password
 * @access  Private
 * @headers Authorization: Bearer <token>
 * @body    { currentPassword: string, newPassword: string }
 */
router.put(
  '/password',
  authRateLimit(3, 15 * 60 * 1000), // 3 attempts per 15 minutes
  authenticateToken,
  sanitizeInput,
  validateRequest(authValidationSchemas.changePassword),
  AuthController.changePassword
);

/**
 * @route   POST /auth/validate
 * @desc    Validate JWT token (for debugging/testing)
 * @access  Public
 * @body    { token: string }
 */
router.post(
  '/validate',
  authRateLimit(10, 5 * 60 * 1000), // 10 attempts per 5 minutes
  sanitizeInput,
  validateRequest(authValidationSchemas.validateToken),
  AuthController.validateToken
);

/**
 * @route   POST /auth/refresh
 * @desc    Refresh JWT token (future implementation)
 * @access  Private
 * @headers Authorization: Bearer <token>
 */
router.post(
  '/refresh',
  authenticateToken,
  AuthController.refreshToken
);

export default router;
