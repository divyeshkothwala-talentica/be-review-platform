import Review from '../models/Review';
import Favorite from '../models/Favorite';
import { logger } from '../utils/logger';

interface UserPreferences {
  favoriteGenres: string[];
  highRatedBooks: Array<{
    title: string;
    author: string;
    rating: number;
    genre?: string;
  }>;
  averageRating: number;
  totalReviews: number;
  recentGenres: string[];
  ratingDistribution: {
    1: number;
    2: number;
    3: number;
    4: number;
    5: number;
  };
  preferredAuthors: string[];
  readingPatterns: {
    isSelectiveReader: boolean; // High average rating
    isActiveReviewer: boolean; // Many reviews
    hasGenrePreference: boolean; // Concentrated in few genres
  };
}

interface GenreFrequency {
  [genre: string]: number;
}

class UserPreferenceService {
  /**
   * Analyze user preferences based on reviews and favorites
   */
  public async analyzeUserPreferences(userId: string): Promise<UserPreferences> {
    try {
      logger.info('Analyzing user preferences', { userId });

      const [reviews, favorites] = await Promise.all([
        this.getUserReviews(userId),
        this.getUserFavorites(userId),
      ]);

      const preferences = await this.buildUserPreferences(reviews, favorites);
      
      logger.info('User preferences analyzed', {
        userId,
        totalReviews: preferences.totalReviews,
        favoriteGenres: preferences.favoriteGenres.length,
        averageRating: preferences.averageRating,
      });

      return preferences;
    } catch (error) {
      logger.error('Error analyzing user preferences:', error);
      throw error;
    }
  }

  /**
   * Get user reviews with book details
   */
  private async getUserReviews(userId: string) {
    return await Review.find({ userId })
      .populate({
        path: 'bookId',
        select: 'title author genres publishedYear',
      })
      .sort({ createdAt: -1 })
      .limit(50) // Limit to recent 50 reviews for performance
      .lean();
  }

  /**
   * Get user favorites with book details
   */
  private async getUserFavorites(userId: string) {
    return await Favorite.find({ userId })
      .populate({
        path: 'bookId',
        select: 'title author genres publishedYear',
      })
      .sort({ createdAt: -1 })
      .lean();
  }

  /**
   * Build comprehensive user preferences
   */
  private async buildUserPreferences(reviews: any[], favorites: any[]): Promise<UserPreferences> {
    // Calculate basic statistics
    const totalReviews = reviews.length;
    const averageRating = totalReviews > 0 
      ? reviews.reduce((sum, review) => sum + review.rating, 0) / totalReviews 
      : 0;

    // Get rating distribution
    const ratingDistribution = this.calculateRatingDistribution(reviews);

    // Analyze genres from reviews and favorites
    const genreAnalysis = this.analyzeGenres(reviews, favorites);

    // Get high-rated books (4+ stars)
    const highRatedBooks = reviews
      .filter(review => review.rating >= 4 && review.bookId && typeof review.bookId === 'object')
      .map(review => ({
        title: (review.bookId as any).title,
        author: (review.bookId as any).author,
        rating: review.rating,
        genre: (review.bookId as any).genres ? (review.bookId as any).genres[0] : undefined,
      }))
      .slice(0, 10); // Top 10 high-rated books

    // Analyze recent reading patterns (last 6 months)
    const recentReviews = reviews.filter(review => {
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
      return new Date(review.createdAt) > sixMonthsAgo;
    });

    const recentGenres = this.extractTopGenres(
      this.getGenreFrequency(recentReviews),
      3
    );

    // Analyze preferred authors
    const preferredAuthors = this.analyzePreferredAuthors(reviews);

    // Determine reading patterns
    const readingPatterns = this.analyzeReadingPatterns(
      reviews,
      averageRating,
      genreAnalysis.genreFrequency
    );

    return {
      favoriteGenres: genreAnalysis.topGenres,
      highRatedBooks,
      averageRating,
      totalReviews,
      recentGenres,
      ratingDistribution,
      preferredAuthors,
      readingPatterns,
    };
  }

  /**
   * Calculate rating distribution
   */
  private calculateRatingDistribution(reviews: any[]) {
    const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    
    reviews.forEach(review => {
      const rating = Math.round(review.rating) as keyof typeof distribution;
      if (rating >= 1 && rating <= 5) {
        distribution[rating]++;
      }
    });

    return distribution;
  }

  /**
   * Analyze genres from reviews and favorites
   */
  private analyzeGenres(reviews: any[], favorites: any[]) {
    // Combine genres from reviews and favorites (favorites get extra weight)
    const genreFrequency: GenreFrequency = {};

    // Add genres from reviews
    reviews.forEach(review => {
      if (review.bookId && typeof review.bookId === 'object' && (review.bookId as any).genres) {
        const genres = (review.bookId as any).genres;
        genres.forEach((genre: string) => {
          genreFrequency[genre] = (genreFrequency[genre] || 0) + 1;
          
          // Give extra weight to highly rated books
          if (review.rating >= 4) {
            genreFrequency[genre] += 1;
          }
        });
      }
    });

    // Add genres from favorites (with extra weight)
    favorites.forEach(favorite => {
      if (favorite.bookId && typeof favorite.bookId === 'object' && (favorite.bookId as any).genres) {
        const genres = (favorite.bookId as any).genres;
        genres.forEach((genre: string) => {
          genreFrequency[genre] = (genreFrequency[genre] || 0) + 2; // Extra weight for favorites
        });
      }
    });

    const topGenres = this.extractTopGenres(genreFrequency, 5);

    return {
      genreFrequency,
      topGenres,
    };
  }

  /**
   * Extract top genres from frequency map
   */
  private extractTopGenres(genreFrequency: GenreFrequency, limit: number): string[] {
    return Object.entries(genreFrequency)
      .sort(([, a], [, b]) => b - a)
      .slice(0, limit)
      .map(([genre]) => genre);
  }

  /**
   * Get genre frequency from reviews
   */
  private getGenreFrequency(reviews: any[]): GenreFrequency {
    const frequency: GenreFrequency = {};
    
    reviews.forEach(review => {
      if (review.bookId && typeof review.bookId === 'object' && (review.bookId as any).genres) {
        const genres = (review.bookId as any).genres;
        genres.forEach((genre: string) => {
          frequency[genre] = (frequency[genre] || 0) + 1;
        });
      }
    });

    return frequency;
  }

  /**
   * Analyze preferred authors
   */
  private analyzePreferredAuthors(reviews: any[]): string[] {
    const authorFrequency: { [author: string]: { count: number; avgRating: number; totalRating: number } } = {};

    reviews.forEach(review => {
      if (review.bookId && typeof review.bookId === 'object' && (review.bookId as any).author) {
        const author = (review.bookId as any).author;
        if (!authorFrequency[author]) {
          authorFrequency[author] = { count: 0, avgRating: 0, totalRating: 0 };
        }
        authorFrequency[author].count++;
        authorFrequency[author].totalRating += review.rating;
        authorFrequency[author].avgRating = authorFrequency[author].totalRating / authorFrequency[author].count;
      }
    });

    // Return authors with multiple books and high average ratings
    return Object.entries(authorFrequency)
      .filter(([, data]) => data.count >= 2 && data.avgRating >= 4)
      .sort(([, a], [, b]) => b.avgRating - a.avgRating || b.count - a.count)
      .slice(0, 5)
      .map(([author]) => author);
  }

  /**
   * Analyze reading patterns
   */
  private analyzeReadingPatterns(
    reviews: any[],
    averageRating: number,
    genreFrequency: GenreFrequency
  ) {
    const totalReviews = reviews.length;
    const totalGenres = Object.keys(genreFrequency).length;
    const topGenreCount = Math.max(...Object.values(genreFrequency));

    return {
      isSelectiveReader: averageRating >= 4.0, // High average rating indicates selectivity
      isActiveReviewer: totalReviews >= 10, // 10+ reviews indicates active engagement
      hasGenrePreference: totalGenres <= 3 || (topGenreCount / totalReviews) >= 0.4, // Concentrated in few genres
    };
  }

  /**
   * Get books user has already reviewed (to avoid recommending them)
   */
  public async getUserReviewedBooks(userId: string): Promise<string[]> {
    try {
      const reviews = await Review.find({ userId })
        .populate('bookId', 'title author')
        .lean();

      return reviews
        .filter(review => review.bookId && typeof review.bookId === 'object')
        .map(review => `${(review.bookId as any).title} by ${(review.bookId as any).author}`);
    } catch (error) {
      logger.error('Error getting user reviewed books:', error);
      return [];
    }
  }

  /**
   * Check if user has sufficient data for personalized recommendations
   */
  public async hasEnoughDataForPersonalization(userId: string): Promise<boolean> {
    try {
      const [reviewCount, favoriteCount] = await Promise.all([
        Review.countDocuments({ userId }),
        Favorite.countDocuments({ userId }),
      ]);

      // Need at least 3 reviews or 2 favorites for basic personalization
      return reviewCount >= 3 || favoriteCount >= 2;
    } catch (error) {
      logger.error('Error checking user data sufficiency:', error);
      return false;
    }
  }
}

export default new UserPreferenceService();
export { UserPreferences };
