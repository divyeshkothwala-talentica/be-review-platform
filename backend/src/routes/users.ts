import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import UserProfileController from '../controllers/userProfileController';
import { authenticateToken } from '../middleware/auth';
import UserProfileValidation from '../middleware/userProfileValidation';

const router = Router();

/**
 * User Profile Routes
 * All routes require authentication
 */

// Apply authentication middleware to all routes
router.use(authenticateToken);

/**
 * @route   GET /users/profile
 * @desc    Get current user's complete profile with statistics
 * @access  Private
 */
router.get(
  '/profile',
  rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 30, // 30 requests per window
    message: 'Too many profile requests, please try again later',
    standardHeaders: true,
    legacyHeaders: false,
  }),
  UserProfileController.getProfile
);

/**
 * @route   PUT /users/profile
 * @desc    Update current user's profile information
 * @access  Private
 */
router.put(
  '/profile',
  rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // 10 updates per window
    message: 'Too many profile update requests, please try again later',
    standardHeaders: true,
    legacyHeaders: false,
  }),
  UserProfileValidation.validateProfileUpdate,
  UserProfileController.updateProfile
);

/**
 * @route   GET /users/profile/statistics
 * @desc    Get current user's statistics only (lightweight)
 * @access  Private
 */
router.get(
  '/profile/statistics',
  rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 50, // 50 requests per window
    message: 'Too many statistics requests, please try again later',
    standardHeaders: true,
    legacyHeaders: false,
  }),
  UserProfileController.getStatistics
);

/**
 * @route   GET /users/profile/basic
 * @desc    Get current user's basic profile information (without statistics)
 * @access  Private
 */
router.get(
  '/profile/basic',
  rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // 100 requests per window
    message: 'Too many basic profile requests, please try again later',
    standardHeaders: true,
    legacyHeaders: false,
  }),
  UserProfileController.getBasicProfile
);

/**
 * @route   POST /users/profile/check-email
 * @desc    Check if email address is available for update
 * @access  Private
 */
router.post(
  '/profile/check-email',
  rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 20, // 20 requests per window
    message: 'Too many email check requests, please try again later',
    standardHeaders: true,
    legacyHeaders: false,
  }),
  UserProfileController.checkEmailAvailability
);

export default router;
