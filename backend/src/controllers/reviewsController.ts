import { Request, Response } from 'express';
import reviewsService, { CreateReviewData, UpdateReviewData, ReviewsQuery } from '../services/reviewsService';
import { ApiResponse } from '../utils/response';
import { logger } from '../utils/logger';
import { IUser } from '../models/User';

// Extend Request interface to include user information from auth middleware
interface AuthenticatedRequest extends Request {
  user?: IUser;
}

export class ReviewsController {
  /**
   * Create a new review
   * POST /reviews
   */
  async createReview(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { bookId, text, rating } = req.body;
      const userId = req.user?._id;

      if (!userId) {
        res.status(401).json(
          ApiResponse.error('Authentication required', 401, 'AUTH_REQUIRED')
        );
        return;
      }

      const reviewData: CreateReviewData = {
        bookId,
        userId,
        text,
        rating,
      };

      const review = await reviewsService.createReview(reviewData);

      logger.info('Review created successfully', { 
        reviewId: review._id, 
        userId, 
        bookId 
      });

      res.status(201).json(
        ApiResponse.success('Review created successfully', {
          review: {
            id: review._id,
            bookId: review.bookId,
            userId: review.userId,
            text: review.text,
            rating: review.rating,
            createdAt: review.createdAt,
            updatedAt: review.updatedAt,
            user: (review as any).user,
            book: (review as any).book,
          },
        }, 201)
      );
    } catch (error: any) {
      logger.error('Error creating review', { 
        error: error.message, 
        userId: req.user?._id,
        body: req.body 
      });

      if (error.message === 'Book not found') {
        res.status(404).json(
          ApiResponse.error('Book not found', 404, 'BOOK_NOT_FOUND')
        );
      } else if (error.message === 'You have already reviewed this book') {
        res.status(409).json(
          ApiResponse.error('You have already reviewed this book', 409, 'DUPLICATE_REVIEW')
        );
      } else if (error.message.includes('validation')) {
        res.status(400).json(
          ApiResponse.error('Validation error', 400, 'VALIDATION_ERROR', { error: error.message })
        );
      } else {
        res.status(500).json(
          ApiResponse.error('Internal server error', 500, 'INTERNAL_ERROR')
        );
      }
    }
  }

  /**
   * Update an existing review
   * PUT /reviews/:reviewId
   */
  async updateReview(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { reviewId } = req.params;
      const { text, rating } = req.body;
      const userId = req.user?._id;

      if (!userId) {
        res.status(401).json(
          ApiResponse.error('Authentication required', 401, 'AUTH_REQUIRED')
        );
        return;
      }

      const updateData: UpdateReviewData = {};
      if (text !== undefined) updateData.text = text;
      if (rating !== undefined) updateData.rating = rating;

      const review = await reviewsService.updateReview(reviewId, userId, updateData);

      logger.info('Review updated successfully', { 
        reviewId, 
        userId 
      });

      res.status(200).json(
        ApiResponse.success('Review updated successfully', {
          review: {
            id: review._id,
            bookId: review.bookId,
            userId: review.userId,
            text: review.text,
            rating: review.rating,
            createdAt: review.createdAt,
            updatedAt: review.updatedAt,
            user: (review as any).user,
            book: (review as any).book,
          },
        })
      );
    } catch (error: any) {
      logger.error('Error updating review', { 
        error: error.message, 
        reviewId: req.params.reviewId,
        userId: req.user?._id 
      });

      if (error.message === 'Review not found') {
        res.status(404).json(
          ApiResponse.error('Review not found', 404, 'REVIEW_NOT_FOUND')
        );
      } else if (error.message === 'You can only update your own reviews') {
        res.status(403).json(
          ApiResponse.error('You can only update your own reviews', 403, 'ACCESS_DENIED')
        );
      } else if (error.message.includes('validation')) {
        res.status(400).json(
          ApiResponse.error('Validation error', 400, 'VALIDATION_ERROR', { error: error.message })
        );
      } else {
        res.status(500).json(
          ApiResponse.error('Internal server error', 500, 'INTERNAL_ERROR')
        );
      }
    }
  }

  /**
   * Delete a review
   * DELETE /reviews/:reviewId
   */
  async deleteReview(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { reviewId } = req.params;
      const userId = req.user?._id;

      if (!userId) {
        res.status(401).json(
          ApiResponse.error('Authentication required', 401, 'AUTH_REQUIRED')
        );
        return;
      }

      await reviewsService.deleteReview(reviewId, userId);

      logger.info('Review deleted successfully', { 
        reviewId, 
        userId 
      });

      res.status(200).json(
        ApiResponse.success('Review deleted successfully')
      );
    } catch (error: any) {
      logger.error('Error deleting review', { 
        error: error.message, 
        reviewId: req.params.reviewId,
        userId: req.user?._id 
      });

      if (error.message === 'Review not found') {
        res.status(404).json(
          ApiResponse.error('Review not found', 404, 'REVIEW_NOT_FOUND')
        );
      } else if (error.message === 'You can only delete your own reviews') {
        res.status(403).json(
          ApiResponse.error('You can only delete your own reviews', 403, 'ACCESS_DENIED')
        );
      } else {
        res.status(500).json(
          ApiResponse.error('Internal server error', 500, 'INTERNAL_ERROR')
        );
      }
    }
  }

  /**
   * Get a specific review by ID
   * GET /reviews/:reviewId
   */
  async getReviewById(req: Request, res: Response): Promise<void> {
    try {
      const { reviewId } = req.params;

      const review = await reviewsService.getReviewById(reviewId);

      if (!review) {
        res.status(404).json(
          ApiResponse.error('Review not found', 404, 'REVIEW_NOT_FOUND')
        );
        return;
      }

      res.status(200).json(
        ApiResponse.success('Review retrieved successfully', {
          review: {
            id: review._id,
            bookId: review.bookId,
            userId: review.userId,
            text: review.text,
            rating: review.rating,
            createdAt: review.createdAt,
            updatedAt: review.updatedAt,
            user: (review as any).user,
            book: (review as any).book,
          },
        })
      );
    } catch (error: any) {
      logger.error('Error fetching review by ID', { 
        error: error.message, 
        reviewId: req.params.reviewId 
      });

      res.status(500).json(
        ApiResponse.error('Internal server error', 500, 'INTERNAL_ERROR')
      );
    }
  }

  /**
   * Get reviews by user with pagination
   * GET /reviews/user/:userId
   */
  async getUserReviews(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req.params;
      const query: ReviewsQuery = {
        page: req.query.page ? parseInt(req.query.page as string) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string) : 10,
        sort: req.query.sort as 'newest' | 'oldest' | 'rating_high' | 'rating_low',
      };

      const result = await reviewsService.getUserReviews(userId, query);

      logger.info('User reviews fetched successfully', { 
        userId, 
        reviewCount: result.reviews.length,
        totalReviews: result.pagination.totalReviews 
      });

      res.status(200).json(
        ApiResponse.success('User reviews retrieved successfully', {
          reviews: result.reviews.map(review => ({
            id: review._id,
            bookId: review.bookId,
            userId: review.userId,
            text: review.text,
            rating: review.rating,
            createdAt: review.createdAt,
            updatedAt: review.updatedAt,
            book: (review as any).book,
          })),
          pagination: result.pagination,
        })
      );
    } catch (error: any) {
      logger.error('Error fetching user reviews', { 
        error: error.message, 
        userId: req.params.userId,
        query: req.query 
      });

      res.status(500).json(
        ApiResponse.error('Internal server error', 500, 'INTERNAL_ERROR')
      );
    }
  }

  /**
   * Get reviews for a specific book with pagination
   * GET /reviews/book/:bookId
   */
  async getBookReviews(req: Request, res: Response): Promise<void> {
    try {
      const { bookId } = req.params;
      const query: ReviewsQuery = {
        page: req.query.page ? parseInt(req.query.page as string) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string) : 10,
        sort: req.query.sort as 'newest' | 'oldest' | 'rating_high' | 'rating_low',
      };

      const result = await reviewsService.getBookReviews(bookId, query);

      logger.info('Book reviews fetched successfully', { 
        bookId, 
        reviewCount: result.reviews.length,
        totalReviews: result.pagination.totalReviews 
      });

      res.status(200).json(
        ApiResponse.success('Book reviews retrieved successfully', {
          reviews: result.reviews.map(review => ({
            id: review._id,
            bookId: review.bookId,
            userId: review.userId,
            text: review.text,
            rating: review.rating,
            createdAt: review.createdAt,
            updatedAt: review.updatedAt,
            user: (review as any).user,
          })),
          pagination: result.pagination,
        })
      );
    } catch (error: any) {
      logger.error('Error fetching book reviews', { 
        error: error.message, 
        bookId: req.params.bookId,
        query: req.query 
      });

      res.status(500).json(
        ApiResponse.error('Internal server error', 500, 'INTERNAL_ERROR')
      );
    }
  }

  /**
   * Check if current user has reviewed a specific book
   * GET /reviews/check/:bookId
   */
  async checkUserBookReview(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { bookId } = req.params;
      const userId = req.user?._id;

      if (!userId) {
        res.status(401).json(
          ApiResponse.error('Authentication required', 401, 'AUTH_REQUIRED')
        );
        return;
      }

      const hasReviewed = await reviewsService.hasUserReviewedBook(userId, bookId);
      const review = hasReviewed 
        ? await reviewsService.getUserBookReview(userId, bookId)
        : null;

      res.status(200).json(
        ApiResponse.success('Review check completed', {
          hasReviewed,
          review: review ? {
            id: review._id,
            bookId: review.bookId,
            userId: review.userId,
            text: review.text,
            rating: review.rating,
            createdAt: review.createdAt,
            updatedAt: review.updatedAt,
          } : null,
        })
      );
    } catch (error: any) {
      logger.error('Error checking user book review', { 
        error: error.message, 
        bookId: req.params.bookId,
        userId: req.user?._id 
      });

      res.status(500).json(
        ApiResponse.error('Internal server error', 500, 'INTERNAL_ERROR')
      );
    }
  }

  /**
   * Get user review statistics
   * GET /reviews/stats/user/:userId
   */
  async getUserReviewStats(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req.params;

      const stats = await reviewsService.getUserReviewStats(userId);

      logger.info('User review stats fetched successfully', { 
        userId, 
        totalReviews: stats.totalReviews 
      });

      res.status(200).json(
        ApiResponse.success('User review statistics retrieved successfully', {
          stats,
        })
      );
    } catch (error: any) {
      logger.error('Error fetching user review stats', { 
        error: error.message, 
        userId: req.params.userId 
      });

      res.status(500).json(
        ApiResponse.error('Internal server error', 500, 'INTERNAL_ERROR')
      );
    }
  }
}

export default new ReviewsController();