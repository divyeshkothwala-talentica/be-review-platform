import { Types } from 'mongoose';
import Book from '../models/Book';
import Review from '../models/Review';
import Favorite from '../models/Favorite';
import { logger } from '../utils/logger';
import { UserPreferences } from './userPreferenceService';

interface FallbackRecommendation {
  title: string;
  author: string;
  reason: string;
  confidence: number;
  genre?: string;
  averageRating?: number;
  reviewCount?: number;
}

interface BookWithStats {
  _id: Types.ObjectId;
  title: string;
  author: string;
  genres: string[];
  publishedYear: number;
  description?: string;
  averageRating: number;
  reviewCount: number;
}

class FallbackRecommendationService {
  /**
   * Generate fallback recommendations using algorithmic approach
   */
  public async generateRecommendations(
    userId: string,
    userPreferences: UserPreferences,
    excludeBooks: string[] = []
  ): Promise<FallbackRecommendation[]> {
    try {
      logger.info('Generating fallback recommendations', { userId });

      const recommendations: FallbackRecommendation[] = [];
      // Handle both ObjectId and UUID string formats
      let userObjectId: Types.ObjectId;
      try {
        userObjectId = new Types.ObjectId(userId);
      } catch (error) {
        // If userId is not a valid ObjectId (e.g., UUID), we'll use it as string
        // This is a fallback for when User model uses UUID instead of ObjectId
        logger.warn('UserId is not a valid ObjectId, using string format:', { userId });
        userObjectId = userId as any; // Use as string for queries
      }

      // Get books user has already interacted with
      const userBookIds = await this.getUserBookIds(userObjectId);

      // Strategy 1: Genre-based recommendations (40% weight)
      const genreRecs = await this.getGenreBasedRecommendations(
        userPreferences,
        userBookIds,
        excludeBooks,
        2
      );
      recommendations.push(...genreRecs);

      // Strategy 2: Highly rated books (30% weight)
      if (recommendations.length < 3) {
        const highRatedRecs = await this.getHighlyRatedRecommendations(
          userPreferences,
          userBookIds,
          excludeBooks,
          3 - recommendations.length
        );
        recommendations.push(...highRatedRecs);
      }

      // Strategy 3: Popular books in preferred genres (20% weight)
      if (recommendations.length < 3) {
        const popularRecs = await this.getPopularRecommendations(
          userPreferences,
          userBookIds,
          excludeBooks,
          3 - recommendations.length
        );
        recommendations.push(...popularRecs);
      }

      // Strategy 4: Similar user recommendations (10% weight)
      if (recommendations.length < 3) {
        const similarUserRecs = await this.getSimilarUserRecommendations(
          userObjectId,
          userPreferences,
          userBookIds,
          excludeBooks,
          3 - recommendations.length
        );
        recommendations.push(...similarUserRecs);
      }

      // Ensure we have at least 3 recommendations
      if (recommendations.length < 3) {
        const additionalRecs = await this.getAdditionalRecommendations(
          userBookIds,
          excludeBooks,
          3 - recommendations.length
        );
        recommendations.push(...additionalRecs);
      }

      // Sort by confidence and return top 3
      const finalRecommendations = recommendations
        .sort((a, b) => b.confidence - a.confidence)
        .slice(0, 3);

      logger.info('Fallback recommendations generated', {
        userId,
        count: finalRecommendations.length,
        avgConfidence: finalRecommendations.reduce((sum, rec) => sum + rec.confidence, 0) / finalRecommendations.length,
      });

      return finalRecommendations;
    } catch (error) {
      logger.error('Error generating fallback recommendations:', { 
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        userId 
      });
      throw error;
    }
  }

  /**
   * Get books user has already reviewed or favorited
   */
  private async getUserBookIds(userId: Types.ObjectId | string): Promise<Types.ObjectId[]> {
    const [reviews, favorites] = await Promise.all([
      Review.find({ userId }).select('bookId').lean(),
      Favorite.find({ userId }).select('bookId').lean(),
    ]);

    const bookIds = new Set<string>();
    reviews.forEach(review => bookIds.add(review.bookId.toString()));
    favorites.forEach(favorite => bookIds.add(favorite.bookId.toString()));

    return Array.from(bookIds).map(id => {
      try {
        return new Types.ObjectId(id);
      } catch (error) {
        // If bookId is not a valid ObjectId, return it as string
        return id as any;
      }
    });
  }

  /**
   * Genre-based recommendations
   */
  private async getGenreBasedRecommendations(
    userPreferences: UserPreferences,
    userBookIds: Types.ObjectId[],
    excludeBooks: string[],
    limit: number
  ): Promise<FallbackRecommendation[]> {
    if (userPreferences.favoriteGenres.length === 0) {
      return [];
    }

    const books = await this.getBooksWithStats({
      genres: { $in: userPreferences.favoriteGenres },
      _id: { $nin: userBookIds },
    });

    const filteredBooks = this.filterExcludedBooks(books, excludeBooks);

    return filteredBooks
      .slice(0, limit)
      .map(book => ({
        title: book.title,
        author: book.author,
        genre: book.genres ? book.genres[0] : 'Unknown',
        reason: `Recommended because you enjoy ${book.genres ? book.genres[0] : 'this genre'} books. This book has an average rating of ${book.averageRating.toFixed(1)}/5.0 from ${book.reviewCount} reviews.`,
        confidence: this.calculateGenreConfidence(book, userPreferences),
        averageRating: book.averageRating,
        reviewCount: book.reviewCount,
      }));
  }

  /**
   * Highly rated books recommendations
   */
  private async getHighlyRatedRecommendations(
    userPreferences: UserPreferences,
    userBookIds: Types.ObjectId[],
    excludeBooks: string[],
    limit: number
  ): Promise<FallbackRecommendation[]> {
    const books = await this.getBooksWithStats({
      _id: { $nin: userBookIds },
      averageRating: { $gte: 4.0 },
      reviewCount: { $gte: 10 },
    });

    const filteredBooks = this.filterExcludedBooks(books, excludeBooks);

    return filteredBooks
      .slice(0, limit)
      .map(book => ({
        title: book.title,
        author: book.author,
        genre: book.genres ? book.genres[0] : 'Unknown',
        reason: `Highly rated book with ${book.averageRating.toFixed(1)}/5.0 stars from ${book.reviewCount} reviews. Great choice for readers who appreciate quality literature.`,
        confidence: this.calculateRatingConfidence(book, userPreferences),
        averageRating: book.averageRating,
        reviewCount: book.reviewCount,
      }));
  }

  /**
   * Popular books in preferred genres
   */
  private async getPopularRecommendations(
    userPreferences: UserPreferences,
    userBookIds: Types.ObjectId[],
    excludeBooks: string[],
    limit: number
  ): Promise<FallbackRecommendation[]> {
    const genreFilter = userPreferences.favoriteGenres.length > 0
      ? { genres: { $in: userPreferences.favoriteGenres } }
      : {};

    const books = await this.getBooksWithStats({
      ...genreFilter,
      _id: { $nin: userBookIds },
      reviewCount: { $gte: 20 },
    });

    const filteredBooks = this.filterExcludedBooks(books, excludeBooks);

    return filteredBooks
      .slice(0, limit)
      .map(book => ({
        title: book.title,
        author: book.author,
        genre: book.genres ? book.genres[0] : 'Unknown',
        reason: `Popular choice with ${book.reviewCount} reviews and ${book.averageRating.toFixed(1)}/5.0 rating. Many readers in your preferred genres have enjoyed this book.`,
        confidence: this.calculatePopularityConfidence(book, userPreferences),
        averageRating: book.averageRating,
        reviewCount: book.reviewCount,
      }));
  }

  /**
   * Similar user recommendations (collaborative filtering)
   */
  private async getSimilarUserRecommendations(
    userId: Types.ObjectId,
    userPreferences: UserPreferences,
    userBookIds: Types.ObjectId[],
    excludeBooks: string[],
    limit: number
  ): Promise<FallbackRecommendation[]> {
    try {
      // Find users with similar rating patterns
      const similarUsers = await this.findSimilarUsers(userId, userPreferences);
      
      if (similarUsers.length === 0) {
        return [];
      }

      // Get books highly rated by similar users
      const similarUserBooks = await Review.find({
        userId: { $in: similarUsers },
        bookId: { $nin: userBookIds.map(id => id.toString()) },
        rating: { $gte: 4 },
      }).lean();

      // Get book details for the similar user books
      const bookIds = [...new Set(similarUserBooks.map(review => review.bookId))];
      const books = await Book.find({ _id: { $in: bookIds } }).lean();
      const bookMap = new Map(books.map(book => [book._id.toString(), book]));

      const bookFrequency: { [bookId: string]: { book: any; count: number; avgRating: number } } = {};

      similarUserBooks.forEach(review => {
        const book = bookMap.get(review.bookId);
        if (book) {
          const bookId = book._id.toString();
          if (!bookFrequency[bookId]) {
            bookFrequency[bookId] = { book, count: 0, avgRating: 0 };
          }
          bookFrequency[bookId].count++;
          bookFrequency[bookId].avgRating = 
            (bookFrequency[bookId].avgRating * (bookFrequency[bookId].count - 1) + review.rating) / 
            bookFrequency[bookId].count;
        }
      });

      const recommendations = Object.values(bookFrequency)
        .filter(item => item.count >= 2) // At least 2 similar users liked it
        .sort((a, b) => b.count - a.count || b.avgRating - a.avgRating)
        .slice(0, limit)
        .map(item => ({
          title: item.book.title,
          author: item.book.author,
          genre: item.book.genres ? item.book.genres[0] : 'Unknown',
          reason: `Recommended by ${item.count} readers with similar preferences. They gave it an average rating of ${item.avgRating.toFixed(1)}/5.0.`,
          confidence: Math.min(0.8, 0.4 + (item.count * 0.1)), // Max 0.8 confidence
          averageRating: item.avgRating,
          reviewCount: item.count,
        }));

      return this.filterExcludedBooks(recommendations, excludeBooks);
    } catch (error) {
      logger.error('Error getting similar user recommendations:', error);
      return [];
    }
  }

  /**
   * Additional recommendations as last resort
   */
  private async getAdditionalRecommendations(
    userBookIds: Types.ObjectId[],
    excludeBooks: string[],
    limit: number
  ): Promise<FallbackRecommendation[]> {
    const books = await this.getBooksWithStats({
      _id: { $nin: userBookIds },
      averageRating: { $gte: 3.5 },
      reviewCount: { $gte: 5 },
    });

    const filteredBooks = this.filterExcludedBooks(books, excludeBooks);

    return filteredBooks
      .slice(0, limit)
      .map(book => ({
        title: book.title,
        author: book.author,
        genre: book.genres ? book.genres[0] : 'Unknown',
        reason: `Well-reviewed book with ${book.averageRating.toFixed(1)}/5.0 rating. A solid choice for expanding your reading horizons.`,
        confidence: 0.3, // Low confidence for generic recommendations
        averageRating: book.averageRating,
        reviewCount: book.reviewCount,
      }));
  }

  /**
   * Get books with aggregated statistics
   */
  private async getBooksWithStats(filter: any): Promise<BookWithStats[]> {
    return await Book.aggregate([
      { $match: filter },
      {
        $lookup: {
          from: 'reviews',
          localField: '_id',
          foreignField: 'bookId',
          as: 'reviews',
        },
      },
      {
        $addFields: {
          reviewCount: { $size: '$reviews' },
          averageRating: {
            $cond: {
              if: { $gt: [{ $size: '$reviews' }, 0] },
              then: { $avg: '$reviews.rating' },
              else: 0,
            },
          },
        },
      },
      {
        $match: {
          reviewCount: { $gt: 0 }, // Only books with reviews
        },
      },
      {
        $sort: { averageRating: -1, reviewCount: -1 },
      },
              {
          $project: {
            title: 1,
            author: 1,
            genres: 1,
            publishedYear: 1,
            description: 1,
            averageRating: 1,
            reviewCount: 1,
          },
        },
      { $limit: 50 }, // Limit for performance
    ]);
  }

  /**
   * Filter out excluded books
   */
  private filterExcludedBooks(books: any[], excludeBooks: string[]): any[] {
    if (excludeBooks.length === 0) return books;

    const excludeSet = new Set(excludeBooks.map(book => book.toLowerCase()));
    
    return books.filter(book => {
      const bookIdentifier = `${book.title} by ${book.author}`.toLowerCase();
      return !excludeSet.has(bookIdentifier);
    });
  }

  /**
   * Find users with similar preferences
   */
  private async findSimilarUsers(userId: Types.ObjectId | string, userPreferences: UserPreferences): Promise<Types.ObjectId[]> {
    // Simple similarity based on favorite genres and rating patterns
    const similarUsers = await Review.aggregate([
      {
        $match: {
          userId: { $ne: userId },
          rating: { $gte: 4 },
        },
      },
      {
        $lookup: {
          from: 'books',
          localField: 'bookId',
          foreignField: '_id',
          as: 'bookInfo',
        },
      },
      {
        $unwind: '$bookInfo',
      },
              {
          $match: {
            'bookInfo.genres': { $in: userPreferences.favoriteGenres },
          },
        },
      {
        $group: {
          _id: '$userId',
          commonGenreBooks: { $sum: 1 },
          avgRating: { $avg: '$rating' },
        },
      },
      {
        $match: {
          commonGenreBooks: { $gte: 3 },
          avgRating: { $gte: userPreferences.averageRating - 0.5 },
        },
      },
      {
        $sort: { commonGenreBooks: -1 },
      },
      {
        $limit: 10,
      },
    ]);

    return similarUsers.map(user => user._id);
  }

  /**
   * Calculate confidence scores
   */
  private calculateGenreConfidence(book: BookWithStats, userPreferences: UserPreferences): number {
    let confidence = 0.6; // Base confidence for genre match

    // Boost for favorite genres
    const hasMatchingGenre = book.genres.some(genre => userPreferences.favoriteGenres.includes(genre));
    if (hasMatchingGenre) {
      confidence += 0.2;
    }

    // Boost for high ratings
    if (book.averageRating >= 4.5) confidence += 0.1;
    else if (book.averageRating >= 4.0) confidence += 0.05;

    // Boost for review count
    if (book.reviewCount >= 50) confidence += 0.05;

    return Math.min(0.9, confidence);
  }

  private calculateRatingConfidence(book: BookWithStats, userPreferences: UserPreferences): number {
    let confidence = 0.5; // Base confidence

    // Boost for very high ratings
    if (book.averageRating >= 4.5) confidence += 0.2;
    else if (book.averageRating >= 4.0) confidence += 0.1;

    // Boost for genre match
    const hasMatchingGenre = book.genres.some(genre => userPreferences.favoriteGenres.includes(genre));
    if (hasMatchingGenre) {
      confidence += 0.15;
    }

    // Boost for selective readers
    if (userPreferences.readingPatterns.isSelectiveReader && book.averageRating >= 4.0) {
      confidence += 0.1;
    }

    return Math.min(0.85, confidence);
  }

  private calculatePopularityConfidence(book: BookWithStats, userPreferences: UserPreferences): number {
    let confidence = 0.4; // Base confidence

    // Boost for genre match
    const hasMatchingGenre = book.genres.some(genre => userPreferences.favoriteGenres.includes(genre));
    if (hasMatchingGenre) {
      confidence += 0.2;
    }

    // Boost for high review count
    if (book.reviewCount >= 100) confidence += 0.1;
    else if (book.reviewCount >= 50) confidence += 0.05;

    // Boost for good ratings
    if (book.averageRating >= 4.0) confidence += 0.1;

    return Math.min(0.75, confidence);
  }
}

export default new FallbackRecommendationService();
export { FallbackRecommendation };
