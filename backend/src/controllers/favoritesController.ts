import { Request, Response } from 'express';
import { ResponseUtil } from '../utils/response';
import Favorite from '../models/Favorite';
import Book from '../models/Book';
import { logger } from '../utils/logger';

// Interface for query parameters
interface FavoritesQuery {
  page?: string;
  limit?: string;
}

// Interface for add favorite request body
interface AddFavoriteBody {
  bookId: string;
}

export class FavoritesController {
  /**
   * GET /favorites - Get paginated list of user's favorite books
   */
  static async getUserFavorites(
    req: Request<{}, {}, {}, FavoritesQuery>,
    res: Response
  ): Promise<Response> {
    try {
      const userId = req.userId;
      if (!userId) {
        return ResponseUtil.unauthorized(res, 'Authentication required');
      }

      const { page = '1', limit = '12' } = req.query;

      // Parse and validate pagination parameters
      const pageNum = Math.max(1, parseInt(page, 10) || 1);
      const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10) || 12));
      const skip = (pageNum - 1) * limitNum;

      // Get user's favorites with book details
      const [favorites, totalItems] = await Promise.all([
        Favorite.find({ userId })
          .populate({
            path: 'book',
            select: 'title author coverImageUrl averageRating totalReviews genres publishedYear description',
          })
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limitNum)
          .lean()
          .exec(),
        Favorite.countDocuments({ userId }),
      ]);

      // Transform the response to include book data directly
      const favoritesWithBooks = favorites.map((favorite: any) => ({
        id: favorite._id,
        bookId: favorite.bookId,
        book: favorite.book,
        createdAt: favorite.createdAt,
      }));

      // Create pagination metadata
      const pagination = ResponseUtil.createPaginationMeta(pageNum, totalItems, limitNum);

      logger.info(`User favorites retrieved`, {
        userId,
        page: pageNum,
        limit: limitNum,
        totalItems,
        resultCount: favorites.length,
      });

      return ResponseUtil.success(
        res,
        { favorites: favoritesWithBooks },
        'Favorites retrieved successfully',
        200,
        { pagination }
      );
    } catch (error) {
      logger.error('Error retrieving user favorites:', error);
      return ResponseUtil.internalError(res, 'Failed to retrieve favorites');
    }
  }

  /**
   * POST /favorites - Add a book to user's favorites
   */
  static async addToFavorites(
    req: Request<{}, {}, AddFavoriteBody>,
    res: Response
  ): Promise<Response> {
    try {
      const userId = req.userId;
      if (!userId) {
        return ResponseUtil.unauthorized(res, 'Authentication required');
      }

      const { bookId } = req.body;

      // Validate book ID
      if (!bookId || typeof bookId !== 'string' || bookId.trim().length === 0) {
        return ResponseUtil.badRequest(res, 'Book ID is required');
      }

      // Check if book exists
      const book = await Book.findById(bookId.trim()).lean().exec();
      if (!book) {
        return ResponseUtil.notFound(res, 'Book not found');
      }

      // Check if already favorited
      const existingFavorite = await Favorite.findOne({
        userId,
        bookId: bookId.trim(),
      }).lean().exec();

      if (existingFavorite) {
        return ResponseUtil.badRequest(res, 'Book is already in your favorites');
      }

      // Create new favorite
      const newFavorite = new Favorite({
        userId,
        bookId: bookId.trim(),
      });

      await newFavorite.save();

      // Populate book details for response
      const favoriteWithBook = await Favorite.findById(newFavorite._id)
        .populate({
          path: 'book',
          select: 'title author coverImageUrl averageRating totalReviews genres',
        })
        .lean()
        .exec() as any;

      logger.info(`Book added to favorites`, {
        userId,
        bookId: bookId.trim(),
        favoriteId: newFavorite._id,
      });

      return ResponseUtil.success(
        res,
        {
          favorite: {
            id: favoriteWithBook?._id,
            bookId: favoriteWithBook?.bookId,
            book: favoriteWithBook?.book,
            createdAt: favoriteWithBook?.createdAt,
          },
        },
        'Book added to favorites successfully',
        201
      );
    } catch (error) {
      logger.error('Error adding book to favorites:', error);

      // Handle duplicate key error specifically
      if (error instanceof Error && error.message.includes('already in your favorites')) {
        return ResponseUtil.badRequest(res, 'Book is already in your favorites');
      }

      return ResponseUtil.internalError(res, 'Failed to add book to favorites');
    }
  }

  /**
   * DELETE /favorites/:bookId - Remove a book from user's favorites
   */
  static async removeFromFavorites(
    req: Request<{ bookId: string }>,
    res: Response
  ): Promise<Response> {
    try {
      const userId = req.userId;
      if (!userId) {
        return ResponseUtil.unauthorized(res, 'Authentication required');
      }

      const { bookId } = req.params;

      // Validate book ID
      if (!bookId || bookId.trim().length === 0) {
        return ResponseUtil.badRequest(res, 'Book ID is required');
      }

      // Find and remove the favorite
      const removedFavorite = await Favorite.findOneAndDelete({
        userId,
        bookId: bookId.trim(),
      }).lean().exec();

      if (!removedFavorite) {
        return ResponseUtil.notFound(res, 'Favorite not found');
      }

      logger.info(`Book removed from favorites`, {
        userId,
        bookId: bookId.trim(),
        favoriteId: removedFavorite._id,
      });

      return ResponseUtil.success(
        res,
        {
          message: 'Book removed from favorites successfully',
          removedFavorite: {
            id: removedFavorite._id,
            bookId: removedFavorite.bookId,
            createdAt: removedFavorite.createdAt,
          },
        },
        'Book removed from favorites successfully'
      );
    } catch (error) {
      logger.error('Error removing book from favorites:', error);
      return ResponseUtil.internalError(res, 'Failed to remove book from favorites');
    }
  }

  /**
   * GET /favorites/check/:bookId - Check if a book is in user's favorites
   */
  static async checkFavoriteStatus(
    req: Request<{ bookId: string }>,
    res: Response
  ): Promise<Response> {
    try {
      const userId = req.userId;
      if (!userId) {
        return ResponseUtil.unauthorized(res, 'Authentication required');
      }

      const { bookId } = req.params;

      // Validate book ID
      if (!bookId || bookId.trim().length === 0) {
        return ResponseUtil.badRequest(res, 'Book ID is required');
      }

      // Check if book is favorited
      const isFavorited = await Favorite.isBookFavoritedByUser(userId, bookId.trim());

      logger.info(`Favorite status checked`, {
        userId,
        bookId: bookId.trim(),
        isFavorited,
      });

      return ResponseUtil.success(
        res,
        {
          bookId: bookId.trim(),
          isFavorited,
        },
        'Favorite status retrieved successfully'
      );
    } catch (error) {
      logger.error('Error checking favorite status:', error);
      return ResponseUtil.internalError(res, 'Failed to check favorite status');
    }
  }

  /**
   * GET /favorites/stats - Get user's favorites statistics
   */
  static async getFavoritesStats(req: Request, res: Response): Promise<Response> {
    try {
      const userId = req.userId;
      if (!userId) {
        return ResponseUtil.unauthorized(res, 'Authentication required');
      }

      // Get total favorites count
      const totalFavorites = await Favorite.getUserFavoriteCount(userId);

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
        { $limit: 10 },
      ]);

      // Get recent favorites (last 5)
      const recentFavorites = await Favorite.find({ userId })
        .populate({
          path: 'book',
          select: 'title author coverImageUrl',
        })
        .sort({ createdAt: -1 })
        .limit(5)
        .lean()
        .exec();

      logger.info(`Favorites stats retrieved`, {
        userId,
        totalFavorites,
        genreStatsCount: genreStats.length,
        recentFavoritesCount: recentFavorites.length,
      });

      return ResponseUtil.success(
        res,
        {
          totalFavorites,
          favoriteGenres: genreStats.map((stat: any) => ({
            genre: stat._id,
            count: stat.count,
          })),
          recentFavorites: recentFavorites.map((fav: any) => ({
            id: fav._id,
            bookId: fav.bookId,
            book: fav.book,
            createdAt: fav.createdAt,
          })),
        },
        'Favorites statistics retrieved successfully'
      );
    } catch (error) {
      logger.error('Error retrieving favorites stats:', error);
      return ResponseUtil.internalError(res, 'Failed to retrieve favorites statistics');
    }
  }
}
