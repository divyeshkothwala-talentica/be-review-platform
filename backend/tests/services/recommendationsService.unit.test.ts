import recommendationsService from '../../src/services/recommendationsService';
import openaiService from '../../src/services/openaiService';
import fallbackRecommendationService from '../../src/services/fallbackRecommendationService';
import userPreferenceService from '../../src/services/userPreferenceService';
import { RecommendationHistory } from '../../src/models';
import { logger } from '../../src/utils/logger';
import config from '../../src/config';

// Mock all dependencies
jest.mock('../../src/services/openaiService');
jest.mock('../../src/services/fallbackRecommendationService');
jest.mock('../../src/services/userPreferenceService');
jest.mock('../../src/models');
jest.mock('../../src/utils/logger');
jest.mock('../../src/config');

const MockedOpenAIService = openaiService as jest.Mocked<typeof openaiService>;
const MockedFallbackService = fallbackRecommendationService as jest.Mocked<typeof fallbackRecommendationService>;
const MockedUserPreferenceService = userPreferenceService as jest.Mocked<typeof userPreferenceService>;
const MockedRecommendationHistory = RecommendationHistory as jest.Mocked<typeof RecommendationHistory>;
const MockedLogger = logger as jest.Mocked<typeof logger>;
const MockedConfig = config as jest.Mocked<typeof config>;

describe('RecommendationsService Unit Tests', () => {
  const mockUserId = '507f1f77bcf86cd799439011';
  
  const mockUserPreferences = {
    favoriteGenres: ['Fiction', 'Mystery'],
    highRatedBooks: [
      { title: 'Great Book', author: 'Great Author', rating: 5, genre: 'Fiction' }
    ],
    averageRating: 4.2,
    totalReviews: 10,
    recentGenres: ['Fiction'],
    ratingDistribution: { 1: 0, 2: 1, 3: 2, 4: 3, 5: 4 },
    preferredAuthors: ['Great Author'],
    readingPatterns: {
      isSelectiveReader: true,
      isActiveReviewer: true,
      hasGenrePreference: true,
    },
  };

  const mockAIRecommendations = [
    {
      title: 'AI Book 1',
      author: 'AI Author 1',
      genre: 'Fiction',
      reason: 'AI-generated recommendation based on your reading history',
      confidence: 0.9,
    },
    {
      title: 'AI Book 2',
      author: 'AI Author 2',
      genre: 'Mystery',
      reason: 'AI-generated recommendation for mystery lovers',
      confidence: 0.85,
    },
    {
      title: 'AI Book 3',
      author: 'AI Author 3',
      genre: 'Fiction',
      reason: 'AI-generated recommendation for fiction enthusiasts',
      confidence: 0.8,
    },
  ];

  const mockFallbackRecommendations = [
    {
      title: 'Fallback Book 1',
      author: 'Fallback Author 1',
      genre: 'Fiction',
      reason: 'Based on your reading history',
      confidence: 0.7,
      averageRating: 4.2,
      reviewCount: 150,
    },
    {
      title: 'Fallback Book 2',
      author: 'Fallback Author 2',
      genre: 'Mystery',
      reason: 'Popular in your favorite genres',
      confidence: 0.65,
      averageRating: 4.0,
      reviewCount: 120,
    },
    {
      title: 'Fallback Book 3',
      author: 'Fallback Author 3',
      genre: 'Fiction',
      reason: 'Highly rated similar book',
      confidence: 0.6,
      averageRating: 4.3,
      reviewCount: 200,
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Clear the internal cache
    (recommendationsService as any).cache.clear();
    
    // Setup default mocks
    MockedUserPreferenceService.analyzeUserPreferences.mockResolvedValue(mockUserPreferences);
    MockedUserPreferenceService.hasEnoughDataForPersonalization.mockResolvedValue(true);
    MockedUserPreferenceService.getUserReviewedBooks.mockResolvedValue([]);
    MockedFallbackService.generateRecommendations.mockResolvedValue(mockFallbackRecommendations);
    MockedOpenAIService.isAvailable.mockReturnValue(true);
    MockedOpenAIService.generateRecommendations.mockResolvedValue(mockAIRecommendations);
    MockedOpenAIService.testConnection.mockResolvedValue(true);
    MockedConfig.openaiModel = 'gpt-3.5-turbo';

    // Mock RecommendationHistory static methods
    (MockedRecommendationHistory as any).findActiveForUser = jest.fn().mockResolvedValue(null);
    (MockedRecommendationHistory as any).getUserHistory = jest.fn().mockResolvedValue([]);
    (MockedRecommendationHistory as any).getAnalytics = jest.fn().mockResolvedValue([]);
    
    // Mock RecommendationHistory instance methods
    MockedRecommendationHistory.updateMany = jest.fn().mockResolvedValue({
      acknowledged: true,
      matchedCount: 0,
      modifiedCount: 0,
      upsertedCount: 0,
      upsertedId: null,
    } as any);
    
    MockedRecommendationHistory.countDocuments = jest.fn().mockResolvedValue(0);
    MockedRecommendationHistory.findOne = jest.fn().mockResolvedValue(null);
    MockedRecommendationHistory.aggregate = jest.fn().mockResolvedValue([]);
    
    // Mock constructor and save
    const mockRecommendationHistoryInstance = {
      save: jest.fn().mockResolvedValue({ _id: 'mock-id' }),
      _id: 'mock-id',
    };
    (MockedRecommendationHistory as any).mockImplementation(() => mockRecommendationHistoryInstance);
  });

  describe('generateRecommendations', () => {
    it('should generate AI recommendations when conditions are met', async () => {
      const result = await recommendationsService.generateRecommendations(mockUserId);

      expect(result).toHaveProperty('recommendations');
      expect(result).toHaveProperty('metadata');
      expect(result.recommendations).toHaveLength(3);
      expect(result.metadata.source).toBe('ai');
      expect(result.metadata.userId).toBe(mockUserId);
      expect(result.metadata.userPreferences.hasEnoughData).toBe(true);
      expect(result.metadata.processingTime).toBeGreaterThan(0);

      // Verify service calls
      expect(MockedUserPreferenceService.analyzeUserPreferences).toHaveBeenCalledWith(mockUserId);
      expect(MockedUserPreferenceService.hasEnoughDataForPersonalization).toHaveBeenCalledWith(mockUserId);
      expect(MockedOpenAIService.generateRecommendations).toHaveBeenCalled();
      expect(MockedLogger.info).toHaveBeenCalledWith('Starting recommendation generation', { userId: mockUserId });
    });

    it('should use fallback when OpenAI is unavailable', async () => {
      MockedOpenAIService.isAvailable.mockReturnValue(false);

      const result = await recommendationsService.generateRecommendations(mockUserId);

      expect(result.metadata.source).toBe('fallback');
      expect(result.recommendations).toHaveLength(3);
      expect(MockedFallbackService.generateRecommendations).toHaveBeenCalled();
      expect(MockedOpenAIService.generateRecommendations).not.toHaveBeenCalled();
      expect(MockedLogger.info).toHaveBeenCalledWith(
        'Using fallback recommendations due to AI service unavailable',
        { userId: mockUserId }
      );
    });

    it('should use fallback when user has insufficient data', async () => {
      MockedUserPreferenceService.hasEnoughDataForPersonalization.mockResolvedValue(false);

      const result = await recommendationsService.generateRecommendations(mockUserId);

      expect(result.metadata.source).toBe('fallback');
      expect(result.metadata.userPreferences.hasEnoughData).toBe(false);
      expect(MockedFallbackService.generateRecommendations).toHaveBeenCalled();
      expect(MockedOpenAIService.generateRecommendations).not.toHaveBeenCalled();
      expect(MockedLogger.info).toHaveBeenCalledWith(
        'Using fallback recommendations due to insufficient user data',
        { userId: mockUserId }
      );
    });

    it('should fall back to algorithmic when AI fails', async () => {
      MockedOpenAIService.generateRecommendations.mockRejectedValue(new Error('AI service error'));

      const result = await recommendationsService.generateRecommendations(mockUserId);

      expect(result.metadata.source).toBe('fallback');
      expect(MockedFallbackService.generateRecommendations).toHaveBeenCalled();
      expect(MockedLogger.warn).toHaveBeenCalledWith(
        'AI recommendations failed, falling back to algorithmic approach',
        expect.objectContaining({ userId: mockUserId, error: 'AI service error' })
      );
    });

    it('should create hybrid recommendations when AI returns insufficient results', async () => {
      // Mock AI to return only 1 recommendation
      MockedOpenAIService.generateRecommendations.mockResolvedValue([mockAIRecommendations[0]]);

      const result = await recommendationsService.generateRecommendations(mockUserId);

      expect(result.metadata.source).toBe('hybrid');
      expect(result.recommendations).toHaveLength(3);
      
      const sources = result.recommendations.map(rec => rec.source);
      expect(sources).toContain('ai');
      expect(sources).toContain('fallback');
      
      expect(MockedLogger.info).toHaveBeenCalledWith(
        'Supplementing AI recommendations with fallback',
        expect.objectContaining({ userId: mockUserId, aiCount: 1, needed: 2 })
      );
    });

    it('should filter out already reviewed books', async () => {
      MockedUserPreferenceService.getUserReviewedBooks.mockResolvedValue([
        'AI Book 1 by AI Author 1'
      ]);

      const result = await recommendationsService.generateRecommendations(mockUserId);

      // Should still get 3 recommendations but AI Book 1 should be filtered out
      expect(result.recommendations).toHaveLength(3);
      expect(result.recommendations.find(rec => rec.title === 'AI Book 1')).toBeUndefined();
    });

    it('should handle errors gracefully', async () => {
      MockedUserPreferenceService.analyzeUserPreferences.mockRejectedValue(new Error('Database error'));

      await expect(recommendationsService.generateRecommendations(mockUserId)).rejects.toThrow('Failed to generate recommendations');
      expect(MockedLogger.error).toHaveBeenCalledWith('Error generating recommendations:', expect.any(Error));
    });
  });

  describe('Cache Management', () => {
    it('should return cached recommendations when available', async () => {
      const cachedData = {
        recommendations: mockFallbackRecommendations.map(rec => ({
          ...rec,
          source: 'fallback' as const,
        })),
        metadata: {
          userId: mockUserId,
          generatedAt: new Date().toISOString(),
          source: 'fallback' as const,
          userPreferences: {
            favoriteGenres: ['Fiction'],
            averageRating: 4.0,
            totalReviews: 3,
            hasEnoughData: true,
          },
          processingTime: 1000,
        },
      };

      // Mock in-memory cache hit
      (recommendationsService as any).cache.set(mockUserId, {
        data: cachedData,
        timestamp: Date.now(),
        expiresAt: Date.now() + 60 * 60 * 1000,
      });

      const result = await recommendationsService.generateRecommendations(mockUserId);

      expect(result).toEqual(cachedData);
      expect(MockedUserPreferenceService.analyzeUserPreferences).not.toHaveBeenCalled();
      expect(MockedLogger.info).toHaveBeenCalledWith('Returning cached recommendations', { userId: mockUserId });
    });

    it('should retrieve from database cache when memory cache is empty', async () => {
      const mockDbCache = {
        userId: mockUserId,
        recommendations: mockFallbackRecommendations.map(rec => ({ ...rec, source: 'fallback' })),
        metadata: {
          generatedAt: new Date(),
          source: 'fallback',
          userPreferences: {
            favoriteGenres: ['Fiction'],
            averageRating: 4.0,
            totalReviews: 3,
            hasEnoughData: true,
          },
          processingTime: 1000,
        },
        isExpired: jest.fn().mockReturnValue(false),
      };

      (MockedRecommendationHistory as any).findActiveForUser.mockResolvedValue(mockDbCache);

      const result = await recommendationsService.generateRecommendations(mockUserId);

      expect(result.recommendations).toHaveLength(3);
      expect(MockedLogger.debug).toHaveBeenCalledWith('Returning database cached recommendations', { userId: mockUserId });
    });

    it('should invalidate user cache', async () => {
      // Set up cache
      (recommendationsService as any).cache.set(mockUserId, {
        data: {},
        timestamp: Date.now(),
        expiresAt: Date.now() + 60 * 60 * 1000,
      });

      await recommendationsService.invalidateUserCache(mockUserId);

      expect((recommendationsService as any).cache.has(mockUserId)).toBe(false);
      expect(MockedRecommendationHistory.updateMany).toHaveBeenCalledWith(
        { userId: mockUserId, isActive: true },
        { isActive: false }
      );
      expect(MockedLogger.info).toHaveBeenCalledWith(
        'User recommendation cache invalidated (memory and database)',
        { userId: mockUserId }
      );
    });

    it('should handle database invalidation errors gracefully', async () => {
      MockedRecommendationHistory.updateMany.mockRejectedValue(new Error('Database error'));

      await recommendationsService.invalidateUserCache(mockUserId);

      expect(MockedLogger.warn).toHaveBeenCalledWith(
        'Failed to invalidate database cache',
        expect.objectContaining({ userId: mockUserId, error: 'Database error' })
      );
      expect(MockedLogger.info).toHaveBeenCalledWith(
        'User recommendation cache invalidated (memory only)',
        { userId: mockUserId }
      );
    });

    it('should clear all cache', async () => {
      // Set up cache
      (recommendationsService as any).cache.set(mockUserId, {});
      (recommendationsService as any).cache.set('user2', {});

      MockedRecommendationHistory.updateMany.mockResolvedValue({
        acknowledged: true,
        matchedCount: 2,
        modifiedCount: 2,
        upsertedCount: 0,
        upsertedId: null,
      } as any);

      await recommendationsService.clearCache();

      expect((recommendationsService as any).cache.size).toBe(0);
      expect(MockedRecommendationHistory.updateMany).toHaveBeenCalledWith(
        { isActive: true },
        { isActive: false }
      );
      expect(MockedLogger.info).toHaveBeenCalledWith(
        'All recommendation cache cleared',
        { memoryCleared: true, databaseDeactivated: 2 }
      );
    });

    it('should get cache statistics', () => {
      const now = Date.now();
      (recommendationsService as any).cache.set(mockUserId, {
        data: {},
        timestamp: now,
        expiresAt: now + 60 * 60 * 1000,
      });
      (recommendationsService as any).cache.set('user2', {
        data: {},
        timestamp: now,
        expiresAt: now + 30 * 60 * 1000,
      });

      const stats = recommendationsService.getCacheStats();

      expect(stats.size).toBe(2);
      expect(stats.entries).toHaveLength(2);
      expect(stats.entries[0]).toHaveProperty('userId');
      expect(stats.entries[0]).toHaveProperty('expiresIn');
      expect(stats.entries[0].expiresIn).toBeGreaterThan(0);
    });

    it('should clean up expired cache entries', () => {
      const now = Date.now();
      // Add expired entry
      (recommendationsService as any).cache.set('expired-user', {
        data: {},
        timestamp: now - 2 * 60 * 60 * 1000,
        expiresAt: now - 60 * 60 * 1000,
      });
      // Add valid entry
      (recommendationsService as any).cache.set(mockUserId, {
        data: {},
        timestamp: now,
        expiresAt: now + 60 * 60 * 1000,
      });

      // Trigger cleanup by calling private method
      (recommendationsService as any).cleanupExpiredCache();

      expect((recommendationsService as any).cache.has('expired-user')).toBe(false);
      expect((recommendationsService as any).cache.has(mockUserId)).toBe(true);
      expect(MockedLogger.info).toHaveBeenCalledWith('Cleaned up expired cache entries', { count: 1 });
    });
  });

  describe('System Testing', () => {
    it('should test recommendation system components', async () => {
      const result = await recommendationsService.testRecommendationSystem();

      expect(result).toHaveProperty('openaiAvailable');
      expect(result).toHaveProperty('fallbackWorking');
      expect(result).toHaveProperty('cacheWorking');
      expect(result.fallbackWorking).toBe(true);
      expect(result.cacheWorking).toBe(true);
      expect(MockedFallbackService.generateRecommendations).toHaveBeenCalledWith(
        'test-user',
        expect.any(Object),
        []
      );
    });

    it('should handle test system errors', async () => {
      MockedFallbackService.generateRecommendations.mockRejectedValue(new Error('Test error'));

      const result = await recommendationsService.testRecommendationSystem();

      expect(result.openaiAvailable).toBe(false);
      expect(result.fallbackWorking).toBe(false);
      expect(result.cacheWorking).toBe(false);
      expect(MockedLogger.error).toHaveBeenCalledWith('Error testing recommendation system:', expect.any(Error));
    });
  });

  describe('Analytics and History', () => {
    it('should get user recommendation history', async () => {
      const mockHistory = [
        { _id: 'history1', userId: mockUserId, createdAt: new Date() },
        { _id: 'history2', userId: mockUserId, createdAt: new Date() },
      ];
      (MockedRecommendationHistory as any).getUserHistory.mockResolvedValue(mockHistory);

      const result = await recommendationsService.getUserRecommendationHistory(mockUserId, 10, 0);

      expect(result).toEqual(mockHistory);
      expect((MockedRecommendationHistory as any).getUserHistory).toHaveBeenCalledWith(mockUserId, 10, 0);
    });

    it('should handle history retrieval errors', async () => {
      (MockedRecommendationHistory as any).getUserHistory.mockRejectedValue(new Error('Database error'));

      await expect(recommendationsService.getUserRecommendationHistory(mockUserId)).rejects.toThrow('Failed to retrieve recommendation history');
      expect(MockedLogger.error).toHaveBeenCalledWith('Error retrieving user recommendation history:', expect.any(Error));
    });

    it('should get recommendation analytics', async () => {
      const mockAnalytics = [
        { _id: 'ai', count: 10, avgProcessingTime: 2000 },
        { _id: 'fallback', count: 5, avgProcessingTime: 500 },
      ];
      (MockedRecommendationHistory as any).getAnalytics.mockResolvedValue(mockAnalytics);

      const result = await recommendationsService.getRecommendationAnalytics();

      expect(result).toEqual(mockAnalytics);
      expect((MockedRecommendationHistory as any).getAnalytics).toHaveBeenCalledWith(undefined, undefined);
    });

    it('should get analytics with date range', async () => {
      const startDate = new Date('2023-01-01');
      const endDate = new Date('2023-12-31');
      (MockedRecommendationHistory as any).getAnalytics.mockResolvedValue([]);

      await recommendationsService.getRecommendationAnalytics(startDate, endDate);

      expect((MockedRecommendationHistory as any).getAnalytics).toHaveBeenCalledWith(startDate, endDate);
    });

    it('should handle analytics errors', async () => {
      (MockedRecommendationHistory as any).getAnalytics.mockRejectedValue(new Error('Database error'));

      await expect(recommendationsService.getRecommendationAnalytics()).rejects.toThrow('Failed to retrieve recommendation analytics');
      expect(MockedLogger.error).toHaveBeenCalledWith('Error retrieving recommendation analytics:', expect.any(Error));
    });

    it('should get database cache statistics', async () => {
      const mockStats = {
        totalActive: 5,
        totalExpired: 3,
        bySource: [
          { source: 'ai', count: 3 },
          { source: 'fallback', count: 2 },
        ],
        oldestActive: new Date('2023-01-01'),
        newestActive: new Date('2023-12-31'),
      };

      MockedRecommendationHistory.countDocuments
        .mockResolvedValueOnce(5) // active count
        .mockResolvedValueOnce(3); // expired count
      MockedRecommendationHistory.aggregate.mockResolvedValue(mockStats.bySource);
      MockedRecommendationHistory.findOne
        .mockResolvedValueOnce({ createdAt: mockStats.oldestActive }) // oldest
        .mockResolvedValueOnce({ createdAt: mockStats.newestActive }); // newest

      const result = await recommendationsService.getDatabaseCacheStats();

      expect(result).toEqual(mockStats);
      expect(MockedRecommendationHistory.countDocuments).toHaveBeenCalledTimes(2);
      expect(MockedRecommendationHistory.aggregate).toHaveBeenCalled();
      expect(MockedRecommendationHistory.findOne).toHaveBeenCalledTimes(2);
    });

    it('should handle database cache stats errors', async () => {
      MockedRecommendationHistory.countDocuments.mockRejectedValue(new Error('Database error'));

      await expect(recommendationsService.getDatabaseCacheStats()).rejects.toThrow('Failed to retrieve database cache statistics');
      expect(MockedLogger.error).toHaveBeenCalledWith('Error retrieving database cache statistics:', expect.any(Error));
    });
  });

  describe('Private Methods Coverage', () => {
    it('should cache recommendations in memory and database', async () => {
      const mockRecommendations = {
        recommendations: mockFallbackRecommendations.map(rec => ({ ...rec, source: 'fallback' as const })),
        metadata: {
          userId: mockUserId,
          generatedAt: new Date().toISOString(),
          source: 'fallback' as const,
          userPreferences: {
            favoriteGenres: ['Fiction'],
            averageRating: 4.0,
            totalReviews: 3,
            hasEnoughData: true,
          },
          processingTime: 1000,
        },
      };

      const mockSave = jest.fn().mockResolvedValue({ _id: 'saved-id' });
      (MockedRecommendationHistory as any).mockImplementation(() => ({ save: mockSave }));

      await (recommendationsService as any).cacheRecommendations(mockUserId, mockRecommendations);

      // Check memory cache
      expect((recommendationsService as any).cache.has(mockUserId)).toBe(true);
      
      // Check database operations
      expect(MockedRecommendationHistory.updateMany).toHaveBeenCalledWith(
        { userId: mockUserId, isActive: true },
        { isActive: false }
      );
      expect(mockSave).toHaveBeenCalled();
      expect(MockedLogger.debug).toHaveBeenCalledWith(
        'Recommendations cached in database',
        { userId: mockUserId, recommendationId: 'saved-id' }
      );
    });

    it('should handle database caching errors gracefully', async () => {
      const mockRecommendations = {
        recommendations: [],
        metadata: {
          userId: mockUserId,
          generatedAt: new Date().toISOString(),
          source: 'fallback' as const,
          userPreferences: {
            favoriteGenres: [],
            averageRating: 0,
            totalReviews: 0,
            hasEnoughData: false,
          },
          processingTime: 1000,
        },
      };

      MockedRecommendationHistory.updateMany.mockRejectedValue(new Error('Database error'));

      await (recommendationsService as any).cacheRecommendations(mockUserId, mockRecommendations);

      // Should still cache in memory
      expect((recommendationsService as any).cache.has(mockUserId)).toBe(true);
      expect(MockedLogger.warn).toHaveBeenCalledWith(
        'Failed to cache recommendations in database',
        expect.objectContaining({ userId: mockUserId, error: 'Database error' })
      );
    });

    it('should handle database cache retrieval warnings', async () => {
      (MockedRecommendationHistory as any).findActiveForUser.mockRejectedValue(new Error('Database error'));

      const result = await (recommendationsService as any).getCachedRecommendations(mockUserId);

      expect(result).toBeNull();
      expect(MockedLogger.warn).toHaveBeenCalledWith(
        'Error retrieving cached recommendations from database',
        expect.objectContaining({ userId: mockUserId, error: 'Database error' })
      );
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty AI recommendations', async () => {
      MockedOpenAIService.generateRecommendations.mockResolvedValue([]);

      const result = await recommendationsService.generateRecommendations(mockUserId);

      expect(result.metadata.source).toBe('hybrid');
      expect(result.recommendations).toHaveLength(3);
      expect(result.recommendations.every(rec => rec.source === 'fallback')).toBe(true);
    });

    it('should handle expired memory cache', async () => {
      const now = Date.now();
      (recommendationsService as any).cache.set(mockUserId, {
        data: {},
        timestamp: now - 2 * 60 * 60 * 1000,
        expiresAt: now - 60 * 60 * 1000, // Expired
      });

      const result = await recommendationsService.generateRecommendations(mockUserId);

      // Should generate new recommendations, not use expired cache
      expect(result).toBeDefined();
      expect(MockedUserPreferenceService.analyzeUserPreferences).toHaveBeenCalled();
    });

    it('should handle database cache expiration', async () => {
      const mockExpiredDbCache = {
        userId: mockUserId,
        recommendations: [],
        metadata: {},
        isExpired: jest.fn().mockReturnValue(true), // Expired
      };

      (MockedRecommendationHistory as any).findActiveForUser.mockResolvedValue(mockExpiredDbCache);

      const result = await recommendationsService.generateRecommendations(mockUserId);

      // Should generate new recommendations, not use expired cache
      expect(result).toBeDefined();
      expect(MockedUserPreferenceService.analyzeUserPreferences).toHaveBeenCalled();
    });
  });
});