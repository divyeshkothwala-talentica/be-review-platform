import Review, { IReview } from '../models/Review';
import Book from '../models/Book';
import User from '../models/User';
import { logger } from '../utils/logger';

export interface CreateReviewData {
  bookId: string;
  userId: string;
  text: string;
  rating: number;
}

export interface UpdateReviewData {
  text?: string;
  rating?: number;
}

export interface ReviewsQuery {
  page?: number;
  limit?: number;
  sort?: 'newest' | 'oldest' | 'rating_high' | 'rating_low';
}

export interface PaginatedReviews {
  reviews: IReview[];
  pagination: {
    currentPage: number;
    totalPages: number;
    totalReviews: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}

export class ReviewsService {
  /**
   * Create a new review
   */
  async createReview(reviewData: CreateReviewData): Promise<IReview> {
    try {
      logger.info('Creating new review', { 
        bookId: reviewData.bookId, 
        userId: reviewData.userId 
      });

      // Check if book exists
      const book = await Book.findById(reviewData.bookId);
      if (!book) {
        throw new Error('Book not found');
      }

      // Check if user exists
      const user = await User.findById(reviewData.userId);
      if (!user) {
        throw new Error('User not found');
      }

      // Check if user has already reviewed this book
      const existingReview = await Review.findOne({
        userId: reviewData.userId,
        bookId: reviewData.bookId,
      });

      if (existingReview) {
        throw new Error('You have already reviewed this book');
      }

      // Create the review
      const review = new Review(reviewData);
      await review.save();

      // Update book rating statistics
      await book.updateRatingStats(reviewData.rating, true);

      // Populate user and book information
      await review.populate('user', 'name');
      await review.populate('book', 'title author coverImageUrl');

      logger.info('Review created successfully', { reviewId: review._id });
      return review;
    } catch (error) {
      logger.error('Error creating review', { error: (error as Error).message, reviewData });
      throw error;
    }
  }

  /**
   * Update an existing review
   */
  async updateReview(
    reviewId: string,
    userId: string,
    updateData: UpdateReviewData
  ): Promise<IReview> {
    try {
      logger.info('Updating review', { reviewId, userId });

      // Find the review
      const review = await Review.findById(reviewId);
      if (!review) {
        throw new Error('Review not found');
      }

      // Check ownership
      if (review.userId !== userId) {
        throw new Error('You can only update your own reviews');
      }

      // Store old rating for book statistics update
      const oldRating = review.rating;
      
      // Update the review
      if (updateData.text !== undefined) {
        review.text = updateData.text;
      }
      if (updateData.rating !== undefined) {
        review.rating = updateData.rating;
      }

      await review.save();

      // Update book statistics if rating changed
      if (updateData.rating !== undefined && updateData.rating !== oldRating) {
        const book = await Book.findById(review.bookId);
        if (book) {
          await book.updateRatingStats(updateData.rating, false, oldRating);
        }
      }

      // Populate user and book information
      await review.populate('user', 'name');
      await review.populate('book', 'title author coverImageUrl');

      logger.info('Review updated successfully', { reviewId });
      return review;
    } catch (error) {
      logger.error('Error updating review', { error: (error as Error).message, reviewId, userId });
      throw error;
    }
  }

  /**
   * Delete a review
   */
  async deleteReview(reviewId: string, userId: string): Promise<void> {
    try {
      logger.info('Deleting review', { reviewId, userId });

      // Find the review
      const review = await Review.findById(reviewId);
      if (!review) {
        throw new Error('Review not found');
      }

      // Check ownership
      if (review.userId !== userId) {
        throw new Error('You can only delete your own reviews');
      }

      // Delete the review (this will trigger the post-remove middleware to update book stats)
      await Review.findByIdAndDelete(reviewId);

      logger.info('Review deleted successfully', { reviewId });
    } catch (error) {
      logger.error('Error deleting review', { error: (error as Error).message, reviewId, userId });
      throw error;
    }
  }

  /**
   * Get a specific review by ID
   */
  async getReviewById(reviewId: string): Promise<IReview | null> {
    try {
      const review = await Review.findById(reviewId)
        .populate('user', 'name')
        .populate('book', 'title author coverImageUrl');

      return review;
    } catch (error) {
      logger.error('Error fetching review by ID', { error: (error as Error).message, reviewId });
      throw error;
    }
  }

  /**
   * Get reviews by user with pagination
   */
  async getUserReviews(
    userId: string,
    query: ReviewsQuery = {}
  ): Promise<PaginatedReviews> {
    try {
      logger.info('Fetching user reviews', { userId, query });

      const page = Math.max(1, query.page || 1);
      const limit = Math.min(50, Math.max(1, query.limit || 10));
      const skip = (page - 1) * limit;

      // Build sort criteria
      let sortCriteria: any = { createdAt: -1 }; // Default: newest first
      
      switch (query.sort) {
        case 'oldest':
          sortCriteria = { createdAt: 1 };
          break;
        case 'rating_high':
          sortCriteria = { rating: -1, createdAt: -1 };
          break;
        case 'rating_low':
          sortCriteria = { rating: 1, createdAt: -1 };
          break;
        case 'newest':
        default:
          sortCriteria = { createdAt: -1 };
          break;
      }

      // Get total count
      const totalReviews = await Review.countDocuments({ userId });

      // Get reviews with pagination
      const reviews = await Review.find({ userId })
        .populate('book', 'title author coverImageUrl averageRating totalReviews')
        .sort(sortCriteria)
        .skip(skip)
        .limit(limit)
        .lean();

      const totalPages = Math.ceil(totalReviews / limit);

      const result: PaginatedReviews = {
        reviews: reviews as IReview[],
        pagination: {
          currentPage: page,
          totalPages,
          totalReviews,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1,
        },
      };

      logger.info('User reviews fetched successfully', { 
        userId, 
        reviewCount: reviews.length,
        totalReviews 
      });

      return result;
    } catch (error) {
      logger.error('Error fetching user reviews', { error: (error as Error).message, userId, query });
      throw error;
    }
  }

  /**
   * Get reviews for a specific book with pagination
   */
  async getBookReviews(
    bookId: string,
    query: ReviewsQuery = {}
  ): Promise<PaginatedReviews> {
    try {
      logger.info('Fetching book reviews', { bookId, query });

      const page = Math.max(1, query.page || 1);
      const limit = Math.min(50, Math.max(1, query.limit || 10));
      const skip = (page - 1) * limit;

      // Build sort criteria
      let sortCriteria: any = { createdAt: -1 }; // Default: newest first
      
      switch (query.sort) {
        case 'oldest':
          sortCriteria = { createdAt: 1 };
          break;
        case 'rating_high':
          sortCriteria = { rating: -1, createdAt: -1 };
          break;
        case 'rating_low':
          sortCriteria = { rating: 1, createdAt: -1 };
          break;
        case 'newest':
        default:
          sortCriteria = { createdAt: -1 };
          break;
      }

      // Get total count
      const totalReviews = await Review.countDocuments({ bookId });

      // Get reviews with pagination
      const reviews = await Review.find({ bookId })
        .populate('user', 'name')
        .sort(sortCriteria)
        .skip(skip)
        .limit(limit)
        .lean();

      const totalPages = Math.ceil(totalReviews / limit);

      const result: PaginatedReviews = {
        reviews: reviews as IReview[],
        pagination: {
          currentPage: page,
          totalPages,
          totalReviews,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1,
        },
      };

      logger.info('Book reviews fetched successfully', { 
        bookId, 
        reviewCount: reviews.length,
        totalReviews 
      });

      return result;
    } catch (error) {
      logger.error('Error fetching book reviews', { error: (error as Error).message, bookId, query });
      throw error;
    }
  }

  /**
   * Check if a user has reviewed a specific book
   */
  async hasUserReviewedBook(userId: string, bookId: string): Promise<boolean> {
    try {
      const review = await Review.findOne({ userId, bookId });
      return !!review;
    } catch (error) {
      logger.error('Error checking if user reviewed book', { 
        error: (error as Error).message, 
        userId, 
        bookId 
      });
      throw error;
    }
  }

  /**
   * Get user's review for a specific book
   */
  async getUserBookReview(userId: string, bookId: string): Promise<IReview | null> {
    try {
      const review = await Review.findOne({ userId, bookId })
        .populate('user', 'name')
        .populate('book', 'title author coverImageUrl');

      return review;
    } catch (error) {
      logger.error('Error fetching user book review', { 
        error: (error as Error).message, 
        userId, 
        bookId 
      });
      throw error;
    }
  }

  /**
   * Get review statistics for a user
   */
  async getUserReviewStats(userId: string): Promise<{
    totalReviews: number;
    averageRating: number;
    ratingDistribution: { [key: number]: number };
  }> {
    try {
      const stats = await Review.aggregate([
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

      if (stats.length === 0) {
        return {
          totalReviews: 0,
          averageRating: 0,
          ratingDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
        };
      }

      const { totalReviews, averageRating, ratings } = stats[0];

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
      logger.error('Error fetching user review stats', { error: (error as Error).message, userId });
      throw error;
    }
  }
}

export default new ReviewsService();
