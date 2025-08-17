import { Request, Response } from 'express';
import userProfileService, { UpdateProfileData } from '../services/userProfileService';
import { ApiResponse } from '../utils/response';
import { logger } from '../utils/logger';

/**
 * User Profile Controller
 * Handles user profile retrieval and updates
 */
export class UserProfileController {
  /**
   * Get current user's profile with statistics
   * GET /users/profile
   */
  static async getProfile(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json(
          ApiResponse.error('Authentication required', 401, 'AUTH_REQUIRED')
        );
        return;
      }

      logger.info('Fetching user profile', { userId: req.user._id });

      // Get complete user profile with statistics
      const userProfile = await userProfileService.getUserProfile(req.user._id);

      res.status(200).json(
        ApiResponse.success(
          'Profile retrieved successfully',
          {
            profile: userProfile.profile,
            statistics: userProfile.statistics,
          }
        )
      );
    } catch (error) {
      logger.error('Error fetching user profile', { 
        error: (error as Error).message, 
        userId: req.user?._id 
      });

      if ((error as Error).message === 'User not found') {
        res.status(404).json(
          ApiResponse.error('User not found', 404, 'USER_NOT_FOUND')
        );
        return;
      }

      res.status(500).json(
        ApiResponse.error('Failed to retrieve profile', 500, 'PROFILE_FETCH_ERROR')
      );
    }
  }

  /**
   * Update current user's profile
   * PUT /users/profile
   */
  static async updateProfile(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json(
          ApiResponse.error('Authentication required', 401, 'AUTH_REQUIRED')
        );
        return;
      }

      const { name, email } = req.body;
      const updateData: UpdateProfileData = {};

      // Build update data object
      if (name !== undefined) {
        updateData.name = name;
      }
      if (email !== undefined) {
        updateData.email = email;
      }

      logger.info('Updating user profile', { 
        userId: req.user._id,
        fields: Object.keys(updateData)
      });

      // Validate update data
      const validation = userProfileService.validateUpdateData(updateData);
      if (!validation.isValid) {
        res.status(400).json(
          ApiResponse.error(
            'Profile validation failed',
            400,
            'PROFILE_VALIDATION_ERROR',
            { errors: validation.errors }
          )
        );
        return;
      }

      // Update user profile
      const updatedProfile = await userProfileService.updateUserProfile(req.user._id, updateData);

      res.status(200).json(
        ApiResponse.success(
          'Profile updated successfully',
          {
            profile: updatedProfile.profile,
            statistics: updatedProfile.statistics,
          }
        )
      );
    } catch (error) {
      logger.error('Error updating user profile', { 
        error: (error as Error).message, 
        userId: req.user?._id 
      });

      const errorMessage = (error as Error).message;

      if (errorMessage === 'User not found') {
        res.status(404).json(
          ApiResponse.error('User not found', 404, 'USER_NOT_FOUND')
        );
        return;
      }

      if (errorMessage === 'Email address is already registered') {
        res.status(409).json(
          ApiResponse.error('Email address is already registered', 409, 'EMAIL_EXISTS')
        );
        return;
      }

      res.status(500).json(
        ApiResponse.error('Failed to update profile', 500, 'PROFILE_UPDATE_ERROR')
      );
    }
  }

  /**
   * Get user statistics only (lightweight endpoint)
   * GET /users/profile/statistics
   */
  static async getStatistics(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json(
          ApiResponse.error('Authentication required', 401, 'AUTH_REQUIRED')
        );
        return;
      }

      logger.info('Fetching user statistics', { userId: req.user._id });

      // Get user statistics
      const statistics = await userProfileService.getUserStatistics(req.user._id);

      res.status(200).json(
        ApiResponse.success(
          'Statistics retrieved successfully',
          { statistics }
        )
      );
    } catch (error) {
      logger.error('Error fetching user statistics', { 
        error: (error as Error).message, 
        userId: req.user?._id 
      });

      if ((error as Error).message === 'User not found') {
        res.status(404).json(
          ApiResponse.error('User not found', 404, 'USER_NOT_FOUND')
        );
        return;
      }

      res.status(500).json(
        ApiResponse.error('Failed to retrieve statistics', 500, 'STATISTICS_FETCH_ERROR')
      );
    }
  }

  /**
   * Get basic profile information (without statistics)
   * GET /users/profile/basic
   */
  static async getBasicProfile(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json(
          ApiResponse.error('Authentication required', 401, 'AUTH_REQUIRED')
        );
        return;
      }

      logger.info('Fetching basic user profile', { userId: req.user._id });

      // Get basic user profile
      const profile = await userProfileService.getBasicUserProfile(req.user._id);

      res.status(200).json(
        ApiResponse.success(
          'Basic profile retrieved successfully',
          { profile }
        )
      );
    } catch (error) {
      logger.error('Error fetching basic user profile', { 
        error: (error as Error).message, 
        userId: req.user?._id 
      });

      if ((error as Error).message === 'User not found') {
        res.status(404).json(
          ApiResponse.error('User not found', 404, 'USER_NOT_FOUND')
        );
        return;
      }

      res.status(500).json(
        ApiResponse.error('Failed to retrieve basic profile', 500, 'BASIC_PROFILE_FETCH_ERROR')
      );
    }
  }

  /**
   * Check email availability
   * POST /users/profile/check-email
   */
  static async checkEmailAvailability(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json(
          ApiResponse.error('Authentication required', 401, 'AUTH_REQUIRED')
        );
        return;
      }

      const { email } = req.body;

      if (!email || typeof email !== 'string') {
        res.status(400).json(
          ApiResponse.error('Email is required', 400, 'EMAIL_REQUIRED')
        );
        return;
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email.trim())) {
        res.status(400).json(
          ApiResponse.error('Invalid email format', 400, 'INVALID_EMAIL_FORMAT')
        );
        return;
      }

      logger.info('Checking email availability', { 
        userId: req.user._id,
        email: '[REDACTED]'
      });

      // Check if email is available (excluding current user's email)
      const isAvailable = await userProfileService.isEmailAvailable(email.trim(), req.user._id);

      res.status(200).json(
        ApiResponse.success(
          'Email availability checked',
          {
            email: email.trim().toLowerCase(),
            available: isAvailable,
          }
        )
      );
    } catch (error) {
      logger.error('Error checking email availability', { 
        error: (error as Error).message, 
        userId: req.user?._id 
      });

      res.status(500).json(
        ApiResponse.error('Failed to check email availability', 500, 'EMAIL_CHECK_ERROR')
      );
    }
  }
}

export default UserProfileController;
