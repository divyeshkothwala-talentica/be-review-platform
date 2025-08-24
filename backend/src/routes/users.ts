import { Router } from 'express';
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
  UserProfileController.getProfile
);

/**
 * @route   PUT /users/profile
 * @desc    Update current user's profile information
 * @access  Private
 */
router.put(
  '/profile',
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
  UserProfileController.getStatistics
);

/**
 * @route   GET /users/profile/basic
 * @desc    Get current user's basic profile information (without statistics)
 * @access  Private
 */
router.get(
  '/profile/basic',
  UserProfileController.getBasicProfile
);

/**
 * @route   POST /users/profile/check-email
 * @desc    Check if email address is available for update
 * @access  Private
 */
router.post(
  '/profile/check-email',
  UserProfileController.checkEmailAvailability
);

export default router;
