import Favorite, { IFavorite } from '../models/Favorite';
import Book, { IBook } from '../models/Book';
import { logger } from '../utils/logger';

// Interface for paginated favorites result
export interface PaginatedFavoritesResult {
  favorites: Array<{
    id: string;
    bookId: string;
    book: Partial<IBook>;
    createdAt: Date;
  }>;
  totalItems: number;
  currentPage: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

// Interface for favorite operation result
export interface FavoriteOperationResult {
  success: boolean;
  favorite?: {
    id: string;
    bookId: string;
    book?: Partial<IBook>;
    createdAt: Date;
  };
  message: string;
  error?: string;
}

// Interface for favorite statistics
export interface FavoriteStats {
  totalFavorites: number;
  favoriteGenres: Array<{
    genre: string;
    count: number;
  }>;
  recentFavorites: Array<{
    id: string;
    bookId: string;
    book: Partial<IBook>;
    createdAt: Date;
  }>;
}

export class FavoritesService {
  /**
   * Get paginated list of user's favorites with book details
   */
  static async getUserFavorites(
    userId: string,
    page: number = 1,
    limit: number = 12
  ): Promise<PaginatedFavoritesResult> {
    try {
      const skip = (page - 1) * limit;

      // Get favorites with book details
      const [favorites, totalItems] = await Promise.all([
        Favorite.find({ userId })
          .populate({
            path: 'book',
            select: 'title author coverImageUrl averageRating totalReviews genres publishedYear description',
          })
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .lean()
          .exec(),
        Favorite.countDocuments({ userId }),
      ]);

      // Transform the response
      const transformedFavorites = favorites.map((favorite: any) => ({
        id: favorite._id,
        bookId: favorite.bookId,
        book: favorite.book,
        createdAt: favorite.createdAt,
      }));

      const totalPages = Math.ceil(totalItems / limit);

      logger.info(`Retrieved user favorites`, {
        userId,
        page,
        limit,
        totalItems,
        resultCount: favorites.length,
      });

      return {
        favorites: transformedFavorites,
        totalItems,
        currentPage: page,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      };
    } catch (error) {
      logger.error('Error in getUserFavorites service:', error);
      throw new Error('Failed to retrieve user favorites');
    }
  }

  /**
   * Add a book to user's favorites
   */
  static async addToFavorites(userId: string, bookId: string): Promise<FavoriteOperationResult> {
    try {
      // Check if book exists
      const book = await Book.findById(bookId).lean().exec();
      if (!book) {
        return {
          success: false,
          message: 'Book not found',
          error: 'BOOK_NOT_FOUND',
        };
      }

      // Check if already favorited
      const existingFavorite = await Favorite.findOne({ userId, bookId }).lean().exec();
      if (existingFavorite) {
        return {
          success: false,
          message: 'Book is already in your favorites',
          error: 'ALREADY_FAVORITED',
        };
      }

      // Create new favorite
      const newFavorite = new Favorite({ userId, bookId });
      await newFavorite.save();

      // Get favorite with book details for response
      const favoriteWithBook = await Favorite.findById(newFavorite._id)
        .populate({
          path: 'book',
          select: 'title author coverImageUrl averageRating totalReviews genres',
        })
        .lean()
        .exec();

      logger.info(`Book added to favorites`, {
        userId,
        bookId,
        favoriteId: newFavorite._id,
      });

      return {
        success: true,
        favorite: {
          id: favoriteWithBook?._id || newFavorite._id,
          bookId: favoriteWithBook?.bookId || bookId,
          book: favoriteWithBook?.book,
          createdAt: favoriteWithBook?.createdAt || newFavorite.createdAt,
        },
        message: 'Book added to favorites successfully',
      };
    } catch (error) {
      logger.error('Error in addToFavorites service:', error);

      // Handle specific MongoDB duplicate key error
      if (error instanceof Error && error.message.includes('E11000')) {
        return {
          success: false,
          message: 'Book is already in your favorites',
          error: 'DUPLICATE_FAVORITE',
        };
      }

      throw new Error('Failed to add book to favorites');
    }
  }

  /**
   * Remove a book from user's favorites
   */
  static async removeFromFavorites(userId: string, bookId: string): Promise<FavoriteOperationResult> {
    try {
      // Find and remove the favorite
      const removedFavorite = await Favorite.findOneAndDelete({ userId, bookId }).lean().exec();

      if (!removedFavorite) {
        return {
          success: false,
          message: 'Favorite not found',
          error: 'FAVORITE_NOT_FOUND',
        };
      }

      logger.info(`Book removed from favorites`, {
        userId,
        bookId,
        favoriteId: removedFavorite._id,
      });

      return {
        success: true,
        favorite: {
          id: removedFavorite._id,
          bookId: removedFavorite.bookId,
          createdAt: removedFavorite.createdAt,
        },
        message: 'Book removed from favorites successfully',
      };
    } catch (error) {
      logger.error('Error in removeFromFavorites service:', error);
      throw new Error('Failed to remove book from favorites');
    }
  }

  /**
   * Check if a book is in user's favorites
   */
  static async checkFavoriteStatus(userId: string, bookId: string): Promise<boolean> {
    try {
      const favorite = await Favorite.findOne({ userId, bookId }).lean().exec();
      return !!favorite;
    } catch (error) {
      logger.error('Error in checkFavoriteStatus service:', error);
      throw new Error('Failed to check favorite status');
    }
  }

  /**
   * Get user's favorites statistics
   */
  static async getFavoritesStats(userId: string): Promise<FavoriteStats> {
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
        { $limit: 10 },
      ]);

      // Get recent favorites (last 5)
      const recentFavorites = await Favorite.find({ userId })
        .populate({
          path: 'book',
          select: 'title author coverImageUrl averageRating',
        })
        .sort({ createdAt: -1 })
        .limit(5)
        .lean()
        .exec();

      logger.info(`Retrieved favorites stats`, {
        userId,
        totalFavorites,
        genreStatsCount: genreStats.length,
        recentFavoritesCount: recentFavorites.length,
      });

      return {
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
      };
    } catch (error) {
      logger.error('Error in getFavoritesStats service:', error);
      throw new Error('Failed to retrieve favorites statistics');
    }
  }

  /**
   * Toggle favorite status (add if not exists, remove if exists)
   */
  static async toggleFavorite(userId: string, bookId: string): Promise<FavoriteOperationResult> {
    try {
      // Check if book exists first
      const book = await Book.findById(bookId).lean().exec();
      if (!book) {
        return {
          success: false,
          message: 'Book not found',
          error: 'BOOK_NOT_FOUND',
        };
      }

      // Check current status
      const existingFavorite = await Favorite.findOne({ userId, bookId }).lean().exec();

      if (existingFavorite) {
        // Remove favorite
        await Favorite.findByIdAndDelete(existingFavorite._id);

        logger.info(`Favorite toggled - removed`, {
          userId,
          bookId,
          favoriteId: existingFavorite._id,
        });

        return {
          success: true,
          favorite: {
            id: existingFavorite._id,
            bookId: existingFavorite.bookId,
            createdAt: existingFavorite.createdAt,
          },
          message: 'Book removed from favorites',
        };
      } else {
        // Add favorite
        const newFavorite = new Favorite({ userId, bookId });
        await newFavorite.save();

        // Get favorite with book details
        const favoriteWithBook = await Favorite.findById(newFavorite._id)
          .populate({
            path: 'book',
            select: 'title author coverImageUrl averageRating totalReviews genres',
          })
          .lean()
          .exec();

        logger.info(`Favorite toggled - added`, {
          userId,
          bookId,
          favoriteId: newFavorite._id,
        });

        return {
          success: true,
          favorite: {
            id: favoriteWithBook?._id || newFavorite._id,
            bookId: favoriteWithBook?.bookId || bookId,
            book: favoriteWithBook?.book,
            createdAt: favoriteWithBook?.createdAt || newFavorite.createdAt,
          },
          message: 'Book added to favorites',
        };
      }
    } catch (error) {
      logger.error('Error in toggleFavorite service:', error);
      throw new Error('Failed to toggle favorite status');
    }
  }

  /**
   * Get popular books based on favorites count
   */
  static async getPopularBooks(limit: number = 10): Promise<Array<{
    bookId: string;
    favoriteCount: number;
    book: Partial<IBook>;
  }>> {
    try {
      const popularBooks = await Favorite.aggregate([
        {
          $group: {
            _id: '$bookId',
            favoriteCount: { $sum: 1 },
          },
        },
        {
          $sort: { favoriteCount: -1 },
        },
        {
          $limit: limit,
        },
        {
          $lookup: {
            from: 'books',
            localField: '_id',
            foreignField: '_id',
            as: 'book',
          },
        },
        {
          $unwind: '$book',
        },
        {
          $project: {
            _id: 0,
            bookId: '$_id',
            favoriteCount: 1,
            book: {
              _id: '$book._id',
              title: '$book.title',
              author: '$book.author',
              coverImageUrl: '$book.coverImageUrl',
              averageRating: '$book.averageRating',
              totalReviews: '$book.totalReviews',
              genres: '$book.genres',
            },
          },
        },
      ]);

      logger.info(`Retrieved popular books by favorites`, {
        limit,
        resultCount: popularBooks.length,
      });

      return popularBooks;
    } catch (error) {
      logger.error('Error in getPopularBooks service:', error);
      throw new Error('Failed to retrieve popular books');
    }
  }

  /**
   * Bulk add/remove favorites (future enhancement)
   */
  static async bulkFavoritesOperation(
    userId: string,
    bookIds: string[],
    operation: 'add' | 'remove'
  ): Promise<{
    success: boolean;
    processed: number;
    errors: Array<{ bookId: string; error: string }>;
  }> {
    try {
      const results = {
        success: true,
        processed: 0,
        errors: [] as Array<{ bookId: string; error: string }>,
      };

      for (const bookId of bookIds) {
        try {
          if (operation === 'add') {
            const result = await this.addToFavorites(userId, bookId);
            if (result.success) {
              results.processed++;
            } else {
              results.errors.push({ bookId, error: result.error || result.message });
            }
          } else {
            const result = await this.removeFromFavorites(userId, bookId);
            if (result.success) {
              results.processed++;
            } else {
              results.errors.push({ bookId, error: result.error || result.message });
            }
          }
        } catch (error) {
          results.errors.push({
            bookId,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }

      results.success = results.errors.length === 0;

      logger.info(`Bulk favorites operation completed`, {
        userId,
        operation,
        totalBooks: bookIds.length,
        processed: results.processed,
        errors: results.errors.length,
      });

      return results;
    } catch (error) {
      logger.error('Error in bulkFavoritesOperation service:', error);
      throw new Error('Failed to perform bulk favorites operation');
    }
  }
}
