import User from '../models/User';
import Review from '../models/Review';
import Favorite from '../models/Favorite';
import { logger } from '../utils/logger';

export interface UserProfileData {
  _id: string;
  name: string;
  email: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserStatistics {
  totalReviews: number;
  totalFavorites: number;
  averageRating: number;
  memberSince: Date;
  ratingDistribution: { [key: number]: number };
  favoriteGenres: { genre: string; count: number }[];
}

export interface CompleteUserProfile {
  profile: UserProfileData;
  statistics: UserStatistics;
}

export interface UpdateProfileData {
  name?: string;
  email?: string;
}

export class UserProfileService {
  /**
   * Get complete user profile with statistics
   */
  async getUserProfile(userId: string): Promise<CompleteUserProfile> {
    try {
      logger.info('Fetching user profile', { userId });

      // Get user profile data
      const user = await User.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      // Get user statistics
      const statistics = await this.getUserStatistics(userId);

      const profile: UserProfileData = {
        _id: user._id,
        name: user.name,
        email: user.email,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      };

      logger.info('User profile fetched successfully', { userId });
      return { profile, statistics };
    } catch (error) {
      logger.error('Error fetching user profile', { error: (error as Error).message, userId });
      throw error;
    }
  }

  /**
   * Update user profile information
   */
  async updateUserProfile(userId: string, updateData: UpdateProfileData): Promise<CompleteUserProfile> {
    try {
      logger.info('Updating user profile', { userId, updateData: { ...updateData, email: updateData.email ? '[REDACTED]' : undefined } });

      // Find the user
      const user = await User.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      // Check email uniqueness if email is being updated
      if (updateData.email && updateData.email !== user.email) {
        const existingUser = await User.findOne({ 
          email: updateData.email.toLowerCase(),
          _id: { $ne: userId }
        });
        
        if (existingUser) {
          throw new Error('Email address is already registered');
        }
      }

      // Update user data
      if (updateData.name !== undefined) {
        user.name = updateData.name.trim();
      }
      if (updateData.email !== undefined) {
        user.email = updateData.email.toLowerCase().trim();
      }

      await user.save();

      // Get updated profile with statistics
      const updatedProfile = await this.getUserProfile(userId);

      logger.info('User profile updated successfully', { userId });
      return updatedProfile;
    } catch (error) {
      logger.error('Error updating user profile', { error: (error as Error).message, userId });
      throw error;
    }
  }

  /**
   * Calculate user statistics
   */
  async getUserStatistics(userId: string): Promise<UserStatistics> {
    try {
      logger.info('Calculating user statistics', { userId });

      // Get user for member since date
      const user = await User.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      // Calculate statistics in parallel for better performance
      const [reviewStats, favoritesStats] = await Promise.all([
        this.getReviewStatistics(userId),
        this.getFavoritesStatistics(userId),
      ]);

      const statistics: UserStatistics = {
        totalReviews: reviewStats.totalReviews,
        totalFavorites: favoritesStats.totalFavorites,
        averageRating: reviewStats.averageRating,
        memberSince: user.createdAt,
        ratingDistribution: reviewStats.ratingDistribution,
        favoriteGenres: favoritesStats.favoriteGenres,
      };

      logger.info('User statistics calculated successfully', { 
        userId, 
        totalReviews: statistics.totalReviews,
        totalFavorites: statistics.totalFavorites 
      });

      return statistics;
    } catch (error) {
      logger.error('Error calculating user statistics', { error: (error as Error).message, userId });
      throw error;
    }
  }

  /**
   * Get review-related statistics
   */
  private async getReviewStatistics(userId: string): Promise<{
    totalReviews: number;
    averageRating: number;
    ratingDistribution: { [key: number]: number };
  }> {
    try {
      const reviewStats = await Review.aggregate([
        { $match: { userId } },
        {
          $group: {
            _id: null,
            totalReviews: { $sum: 1 },
            averageRating: { $avg: '$rating' },
            ratings: { $push: '$rating' },
          },
        },
      ]);

      if (reviewStats.length === 0) {
        return {
          totalReviews: 0,
          averageRating: 0,
          ratingDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
        };
      }

      const { totalReviews, averageRating, ratings } = reviewStats[0];

      // Calculate rating distribution
      const ratingDistribution: { [key: number]: number } = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
      ratings.forEach((rating: number) => {
        if (rating >= 1 && rating <= 5) {
          ratingDistribution[rating] = (ratingDistribution[rating] || 0) + 1;
        }
      });

      return {
        totalReviews,
        averageRating: Math.round(averageRating * 10) / 10,
        ratingDistribution,
      };
    } catch (error) {
      logger.error('Error calculating review statistics', { error: (error as Error).message, userId });
      throw error;
    }
  }

  /**
   * Get favorites-related statistics
   */
  private async getFavoritesStatistics(userId: string): Promise<{
    totalFavorites: number;
    favoriteGenres: { genre: string; count: number }[];
  }> {
    try {
      // Get total favorites count
      const totalFavorites = await Favorite.countDocuments({ userId });

      // Get favorite genres distribution
      const genreStats = await Favorite.aggregate([
        { $match: { userId } },
        {
          $lookup: {
            from: 'books',
            localField: 'bookId',
            foreignField: '_id',
            as: 'book',
          },
        },
        { $unwind: '$book' },
        { $unwind: '$book.genres' },
        {
          $group: {
            _id: '$book.genres',
            count: { $sum: 1 },
          },
        },
        { $sort: { count: -1 } },
        { $limit: 10 }, // Top 10 favorite genres
        {
          $project: {
            _id: 0,
            genre: '$_id',
            count: 1,
          },
        },
      ]);

      return {
        totalFavorites,
        favoriteGenres: genreStats,
      };
    } catch (error) {
      logger.error('Error calculating favorites statistics', { error: (error as Error).message, userId });
      throw error;
    }
  }

  /**
   * Validate profile update data
   */
  validateUpdateData(data: UpdateProfileData): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Validate name if provided
    if (data.name !== undefined) {
      if (typeof data.name !== 'string') {
        errors.push('Name must be a string');
      } else if (data.name.trim().length < 2) {
        errors.push('Name must be at least 2 characters long');
      } else if (data.name.trim().length > 100) {
        errors.push('Name cannot exceed 100 characters');
      } else if (!/^[a-zA-Z\s]+$/.test(data.name.trim())) {
        errors.push('Name can only contain letters and spaces');
      }
    }

    // Validate email if provided
    if (data.email !== undefined) {
      if (typeof data.email !== 'string') {
        errors.push('Email must be a string');
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email.trim())) {
        errors.push('Please provide a valid email address');
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Check if email is available for a user (excluding their current email)
   */
  async isEmailAvailable(email: string, excludeUserId?: string): Promise<boolean> {
    try {
      const query: any = { email: email.toLowerCase() };
      if (excludeUserId) {
        query._id = { $ne: excludeUserId };
      }

      const existingUser = await User.findOne(query);
      return !existingUser;
    } catch (error) {
      logger.error('Error checking email availability', { error: (error as Error).message, email });
      throw error;
    }
  }

  /**
   * Get basic user profile (without statistics) - for performance
   */
  async getBasicUserProfile(userId: string): Promise<UserProfileData> {
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      return {
        _id: user._id,
        name: user.name,
        email: user.email,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      };
    } catch (error) {
      logger.error('Error fetching basic user profile', { error: (error as Error).message, userId });
      throw error;
    }
  }
}

export default new UserProfileService();
