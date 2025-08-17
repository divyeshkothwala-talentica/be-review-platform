import openaiService, { RecommendationRequest } from './openaiService';
import fallbackRecommendationService from './fallbackRecommendationService';
import userPreferenceService, { UserPreferences } from './userPreferenceService';
import { logger } from '../utils/logger';
import { RecommendationHistory, IRecommendationHistory } from '../models';
import config from '../config';

interface RecommendationResponse {
  recommendations: Array<{
    title: string;
    author: string;
    genre?: string;
    reason: string;
    confidence: number;
    source: 'ai' | 'fallback';
    averageRating?: number;
    reviewCount?: number;
  }>;
  metadata: {
    userId: string;
    generatedAt: string;
    source: 'ai' | 'fallback' | 'hybrid';
    userPreferences: {
      favoriteGenres: string[];
      averageRating: number;
      totalReviews: number;
      hasEnoughData: boolean;
    };
    processingTime: number;
  };
}

interface CacheEntry {
  data: RecommendationResponse;
  timestamp: number;
  expiresAt: number;
}

class RecommendationsService {
  private cache: Map<string, CacheEntry> = new Map();
  private readonly CACHE_DURATION = 60 * 60 * 1000; // 1 hour in milliseconds

  /**
   * Generate personalized book recommendations
   */
  public async generateRecommendations(userId: string): Promise<RecommendationResponse> {
    const startTime = Date.now();
    
    try {
      logger.info('Starting recommendation generation', { userId });

      // Check cache first (both memory and database)
      const cachedRecommendations = await this.getCachedRecommendations(userId);
      if (cachedRecommendations) {
        logger.info('Returning cached recommendations', { userId });
        return cachedRecommendations;
      }

      // Analyze user preferences
      const userPreferences = await userPreferenceService.analyzeUserPreferences(userId);
      const hasEnoughData = await userPreferenceService.hasEnoughDataForPersonalization(userId);

      // Get books user has already reviewed to exclude from recommendations
      const reviewedBooks = await userPreferenceService.getUserReviewedBooks(userId);

      let recommendations: RecommendationResponse;

      if (hasEnoughData && openaiService.isAvailable()) {
        // Try AI recommendations first
        try {
          recommendations = await this.generateAIRecommendations(
            userId,
            userPreferences,
            reviewedBooks,
            startTime
          );
        } catch (error) {
          logger.warn('AI recommendations failed, falling back to algorithmic approach', {
            userId,
            error: error instanceof Error ? error.message : String(error),
          });
          
          recommendations = await this.generateFallbackRecommendations(
            userId,
            userPreferences,
            reviewedBooks,
            startTime
          );
        }
      } else {
        // Use fallback recommendations
        const reason = !hasEnoughData 
          ? 'insufficient user data' 
          : 'AI service unavailable';
          
        logger.info(`Using fallback recommendations due to ${reason}`, { userId });
        
        recommendations = await this.generateFallbackRecommendations(
          userId,
          userPreferences,
          reviewedBooks,
          startTime
        );
      }

      // Cache the recommendations (both memory and database)
      await this.cacheRecommendations(userId, recommendations);

      logger.info('Recommendations generated successfully', {
        userId,
        source: recommendations.metadata.source,
        processingTime: recommendations.metadata.processingTime,
        count: recommendations.recommendations.length,
      });

      return recommendations;
    } catch (error) {
      logger.error('Error generating recommendations:', error);
      throw new Error('Failed to generate recommendations');
    }
  }

  /**
   * Generate AI-powered recommendations
   */
  private async generateAIRecommendations(
    userId: string,
    userPreferences: UserPreferences,
    reviewedBooks: string[],
    startTime: number
  ): Promise<RecommendationResponse> {
    const request: RecommendationRequest = {
      favoriteGenres: userPreferences.favoriteGenres,
      highRatedBooks: userPreferences.highRatedBooks,
      averageRating: userPreferences.averageRating,
      totalReviews: userPreferences.totalReviews,
      recentGenres: userPreferences.recentGenres,
    };

    const aiRecommendations = await openaiService.generateRecommendations(request);

    // Filter out books user has already reviewed
    const filteredRecommendations = aiRecommendations.filter(rec => {
      const bookIdentifier = `${rec.title} by ${rec.author}`;
      return !reviewedBooks.some(reviewed => 
        reviewed.toLowerCase().includes(bookIdentifier.toLowerCase()) ||
        bookIdentifier.toLowerCase().includes(reviewed.toLowerCase())
      );
    });

    // If AI didn't provide enough unique recommendations, supplement with fallback
    let finalRecommendations = filteredRecommendations.slice(0, 3);
    let source: 'ai' | 'fallback' | 'hybrid' = 'ai';

    if (finalRecommendations.length < 3) {
      logger.info('Supplementing AI recommendations with fallback', {
        userId,
        aiCount: finalRecommendations.length,
        needed: 3 - finalRecommendations.length,
      });

      const fallbackRecs = await fallbackRecommendationService.generateRecommendations(
        userId,
        userPreferences,
        reviewedBooks.concat(finalRecommendations.map(rec => `${rec.title} by ${rec.author}`))
      );

      const supplementalRecs = fallbackRecs.slice(0, 3 - finalRecommendations.length);
      finalRecommendations = finalRecommendations.concat(
        supplementalRecs.map(rec => ({
          title: rec.title,
          author: rec.author,
          genre: rec.genre,
          reason: rec.reason,
          confidence: rec.confidence,
          source: 'fallback' as const,
          averageRating: rec.averageRating,
          reviewCount: rec.reviewCount,
        }))
      );

      source = 'hybrid';
    }

    return {
      recommendations: finalRecommendations.map(rec => ({
        title: rec.title,
        author: rec.author,
        genre: rec.genre,
        reason: rec.reason,
        confidence: rec.confidence,
        source: ('source' in rec ? rec.source : 'ai') as 'ai' | 'fallback',
        averageRating: ('averageRating' in rec ? rec.averageRating : undefined) as number | undefined,
        reviewCount: ('reviewCount' in rec ? rec.reviewCount : undefined) as number | undefined,
      })),
      metadata: {
        userId,
        generatedAt: new Date().toISOString(),
        source,
        userPreferences: {
          favoriteGenres: userPreferences.favoriteGenres,
          averageRating: userPreferences.averageRating,
          totalReviews: userPreferences.totalReviews,
          hasEnoughData: true,
        },
        processingTime: Date.now() - startTime,
      },
    };
  }

  /**
   * Generate fallback recommendations
   */
  private async generateFallbackRecommendations(
    userId: string,
    userPreferences: UserPreferences,
    reviewedBooks: string[],
    startTime: number
  ): Promise<RecommendationResponse> {
    const fallbackRecs = await fallbackRecommendationService.generateRecommendations(
      userId,
      userPreferences,
      reviewedBooks
    );

    return {
      recommendations: fallbackRecs.map(rec => ({
        title: rec.title,
        author: rec.author,
        genre: rec.genre,
        reason: rec.reason,
        confidence: rec.confidence,
        source: 'fallback' as const,
        averageRating: rec.averageRating,
        reviewCount: rec.reviewCount,
      })),
      metadata: {
        userId,
        generatedAt: new Date().toISOString(),
        source: 'fallback',
        userPreferences: {
          favoriteGenres: userPreferences.favoriteGenres,
          averageRating: userPreferences.averageRating,
          totalReviews: userPreferences.totalReviews,
          hasEnoughData: userPreferences.totalReviews >= 3,
        },
        processingTime: Date.now() - startTime,
      },
    };
  }

  /**
   * Get cached recommendations if available and not expired
   * First checks in-memory cache, then falls back to database
   */
  private async getCachedRecommendations(userId: string): Promise<RecommendationResponse | null> {
    // Check in-memory cache first (fastest)
    const memoryCache = this.cache.get(userId);
    if (memoryCache && Date.now() <= memoryCache.expiresAt) {
      logger.debug('Returning in-memory cached recommendations', { userId });
      return memoryCache.data;
    }

    // Clean up expired memory cache
    if (memoryCache && Date.now() > memoryCache.expiresAt) {
      this.cache.delete(userId);
    }

    // Check database cache
    try {
      const dbCache = await (RecommendationHistory as any).findActiveForUser(userId);
      if (dbCache && !dbCache.isExpired()) {
        logger.debug('Returning database cached recommendations', { userId });
        
        // Convert database format to response format
        const response: RecommendationResponse = {
          recommendations: dbCache.recommendations,
          metadata: {
            userId: dbCache.userId.toString(),
            generatedAt: dbCache.metadata.generatedAt.toISOString(),
            source: dbCache.metadata.source,
            userPreferences: dbCache.metadata.userPreferences,
            processingTime: dbCache.metadata.processingTime,
          },
        };

        // Also cache in memory for faster subsequent access
        this.cacheRecommendations(userId, response);
        
        return response;
      }
    } catch (error) {
      logger.warn('Error retrieving cached recommendations from database', {
        userId,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    return null;
  }

  /**
   * Cache recommendations for user (both memory and database)
   */
  private async cacheRecommendations(userId: string, recommendations: RecommendationResponse): Promise<void> {
    const now = Date.now();
    
    // Cache in memory for fastest access
    this.cache.set(userId, {
      data: recommendations,
      timestamp: now,
      expiresAt: now + this.CACHE_DURATION,
    });

    // Cache in database for persistence across server restarts
    try {
      // Deactivate any existing active recommendations for this user
      await RecommendationHistory.updateMany(
        { userId, isActive: true },
        { isActive: false }
      );

      // Create new recommendation history entry
      const recommendationHistory = new RecommendationHistory({
        userId,
        recommendations: recommendations.recommendations,
        metadata: {
          generatedAt: new Date(recommendations.metadata.generatedAt),
          source: recommendations.metadata.source,
          userPreferences: recommendations.metadata.userPreferences,
          processingTime: recommendations.metadata.processingTime,
          openaiModel: config.openaiModel,
          cacheHit: false,
        },
        expiresAt: new Date(now + this.CACHE_DURATION),
        isActive: true,
      });

      await recommendationHistory.save();
      
      logger.debug('Recommendations cached in database', { 
        userId, 
        recommendationId: recommendationHistory._id 
      });
    } catch (error) {
      logger.warn('Failed to cache recommendations in database', {
        userId,
        error: error instanceof Error ? error.message : String(error),
      });
      // Don't throw error - memory cache is still working
    }

    // Clean up expired cache entries periodically
    this.cleanupExpiredCache();
  }

  /**
   * Invalidate cache for user (call when user adds review/favorite)
   */
  public async invalidateUserCache(userId: string): Promise<void> {
    // Clear memory cache
    this.cache.delete(userId);
    
    // Deactivate database cache
    try {
      await RecommendationHistory.updateMany(
        { userId, isActive: true },
        { isActive: false }
      );
      logger.info('User recommendation cache invalidated (memory and database)', { userId });
    } catch (error) {
      logger.warn('Failed to invalidate database cache', {
        userId,
        error: error instanceof Error ? error.message : String(error),
      });
      logger.info('User recommendation cache invalidated (memory only)', { userId });
    }
  }

  /**
   * Clean up expired cache entries
   */
  private cleanupExpiredCache(): void {
    const now = Date.now();
    const expiredKeys: string[] = [];

    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        expiredKeys.push(key);
      }
    }

    expiredKeys.forEach(key => this.cache.delete(key));

    if (expiredKeys.length > 0) {
      logger.info('Cleaned up expired cache entries', { count: expiredKeys.length });
    }
  }

  /**
   * Get cache statistics
   */
  public getCacheStats(): { size: number; entries: Array<{ userId: string; expiresIn: number }> } {
    const now = Date.now();
    const entries = Array.from(this.cache.entries()).map(([userId, entry]) => ({
      userId,
      expiresIn: Math.max(0, entry.expiresAt - now),
    }));

    return {
      size: this.cache.size,
      entries,
    };
  }

  /**
   * Clear all cached recommendations (memory and database)
   */
  public async clearCache(): Promise<void> {
    // Clear memory cache
    this.cache.clear();
    
    // Deactivate all database cache entries
    try {
      const result = await RecommendationHistory.updateMany(
        { isActive: true },
        { isActive: false }
      );
      logger.info('All recommendation cache cleared', { 
        memoryCleared: true,
        databaseDeactivated: result.modifiedCount 
      });
    } catch (error) {
      logger.warn('Failed to clear database cache', {
        error: error instanceof Error ? error.message : String(error),
      });
      logger.info('Recommendation cache cleared (memory only)');
    }
  }

  /**
   * Test the recommendation system
   */
  public async testRecommendationSystem(): Promise<{
    openaiAvailable: boolean;
    fallbackWorking: boolean;
    cacheWorking: boolean;
  }> {
    try {
      const openaiAvailable = openaiService.isAvailable() && await openaiService.testConnection();
      
      // Test fallback with minimal data
      const testPreferences: UserPreferences = {
        favoriteGenres: ['Fiction'],
        highRatedBooks: [],
        averageRating: 4.0,
        totalReviews: 0,
        recentGenres: ['Fiction'],
        ratingDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
        preferredAuthors: [],
        readingPatterns: {
          isSelectiveReader: false,
          isActiveReviewer: false,
          hasGenrePreference: false,
        },
      };

      const fallbackRecs = await fallbackRecommendationService.generateRecommendations(
        'test-user',
        testPreferences,
        []
      );
      const fallbackWorking = fallbackRecs.length > 0;

      // Test cache
      const testData: RecommendationResponse = {
        recommendations: [],
        metadata: {
          userId: 'test',
          generatedAt: new Date().toISOString(),
          source: 'fallback',
          userPreferences: {
            favoriteGenres: [],
            averageRating: 0,
            totalReviews: 0,
            hasEnoughData: false,
          },
          processingTime: 0,
        },
      };

      this.cacheRecommendations('test-cache-user', testData);
      const cachedData = this.getCachedRecommendations('test-cache-user');
      const cacheWorking = !!cachedData;
      
      // Clean up test cache
      this.cache.delete('test-cache-user');

      return {
        openaiAvailable,
        fallbackWorking,
        cacheWorking,
      };
    } catch (error) {
      logger.error('Error testing recommendation system:', error);
      return {
        openaiAvailable: false,
        fallbackWorking: false,
        cacheWorking: false,
      };
    }
  }

  /**
   * Get user's recommendation history
   */
  public async getUserRecommendationHistory(
    userId: string,
    limit: number = 10,
    skip: number = 0
  ): Promise<IRecommendationHistory[]> {
    try {
      return await (RecommendationHistory as any).getUserHistory(userId, limit, skip);
    } catch (error) {
      logger.error('Error retrieving user recommendation history:', error);
      throw new Error('Failed to retrieve recommendation history');
    }
  }

  /**
   * Get recommendation analytics
   */
  public async getRecommendationAnalytics(
    startDate?: Date,
    endDate?: Date
  ): Promise<any> {
    try {
      return await (RecommendationHistory as any).getAnalytics(startDate, endDate);
    } catch (error) {
      logger.error('Error retrieving recommendation analytics:', error);
      throw new Error('Failed to retrieve recommendation analytics');
    }
  }

  /**
   * Get database cache statistics
   */
  public async getDatabaseCacheStats(): Promise<{
    totalActive: number;
    totalExpired: number;
    bySource: Array<{ source: string; count: number }>;
    oldestActive?: Date;
    newestActive?: Date;
  }> {
    try {
      const now = new Date();
      
      const [activeCount, expiredCount, bySource, oldestActive, newestActive] = await Promise.all([
        RecommendationHistory.countDocuments({ isActive: true, expiresAt: { $gt: now } }),
        RecommendationHistory.countDocuments({ $or: [{ isActive: false }, { expiresAt: { $lte: now } }] }),
        RecommendationHistory.aggregate([
          { $match: { isActive: true, expiresAt: { $gt: now } } },
          { $group: { _id: '$metadata.source', count: { $sum: 1 } } },
          { $project: { source: '$_id', count: 1, _id: 0 } },
        ]),
        RecommendationHistory.findOne({ isActive: true, expiresAt: { $gt: now } })
          .sort({ createdAt: 1 })
          .select('createdAt')
          .lean(),
        RecommendationHistory.findOne({ isActive: true, expiresAt: { $gt: now } })
          .sort({ createdAt: -1 })
          .select('createdAt')
          .lean(),
      ]);

      return {
        totalActive: activeCount,
        totalExpired: expiredCount,
        bySource,
        oldestActive: oldestActive?.createdAt,
        newestActive: newestActive?.createdAt,
      };
    } catch (error) {
      logger.error('Error retrieving database cache statistics:', error);
      throw new Error('Failed to retrieve database cache statistics');
    }
  }
}

export default new RecommendationsService();
export { RecommendationResponse };
