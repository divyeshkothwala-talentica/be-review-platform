import openaiService, { RecommendationRequest } from './openaiService';
import fallbackRecommendationService from './fallbackRecommendationService';
import userPreferenceService, { UserPreferences } from './userPreferenceService';
import { logger } from '../utils/logger';

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

      // Check cache first
      const cachedRecommendations = this.getCachedRecommendations(userId);
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

      // Cache the recommendations
      this.cacheRecommendations(userId, recommendations);

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
   */
  private getCachedRecommendations(userId: string): RecommendationResponse | null {
    const cached = this.cache.get(userId);
    
    if (!cached) {
      return null;
    }

    if (Date.now() > cached.expiresAt) {
      this.cache.delete(userId);
      return null;
    }

    return cached.data;
  }

  /**
   * Cache recommendations for user
   */
  private cacheRecommendations(userId: string, recommendations: RecommendationResponse): void {
    const now = Date.now();
    
    this.cache.set(userId, {
      data: recommendations,
      timestamp: now,
      expiresAt: now + this.CACHE_DURATION,
    });

    // Clean up expired cache entries periodically
    this.cleanupExpiredCache();
  }

  /**
   * Invalidate cache for user (call when user adds review/favorite)
   */
  public invalidateUserCache(userId: string): void {
    this.cache.delete(userId);
    logger.info('User recommendation cache invalidated', { userId });
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
   * Clear all cached recommendations
   */
  public clearCache(): void {
    this.cache.clear();
    logger.info('Recommendation cache cleared');
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
}

export default new RecommendationsService();
export { RecommendationResponse };
