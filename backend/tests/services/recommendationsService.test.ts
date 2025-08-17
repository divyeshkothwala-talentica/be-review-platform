import mongoose from 'mongoose';
import User from '../../src/models/User';
import Book from '../../src/models/Book';
import Review from '../../src/models/Review';
import Favorite from '../../src/models/Favorite';
import { RecommendationHistory, RecommendationFeedback } from '../../src/models';
import recommendationsService from '../../src/services/recommendationsService';
import openaiService from '../../src/services/openaiService';

describe('RecommendationsService', () => {
  let testUser: any;
  let testBooks: any[] = [];

  beforeAll(async () => {
    // Ensure database connection
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/book_review_platform_test');
    }

    // Clear existing data
    await Promise.all([
      User.deleteMany({}),
      Book.deleteMany({}),
      Review.deleteMany({}),
      Favorite.deleteMany({}),
      RecommendationHistory.deleteMany({}),
      RecommendationFeedback.deleteMany({}),
    ]);

    // Create test user
    testUser = await User.create({
      name: 'Test User',
      email: 'test@example.com',
      password: 'password123',
    });

    // Create test books
    const booksData = [
      {
        title: 'Fiction Book 1',
        author: 'Author 1',
        genres: ['Fiction'],
        publishedYear: 2020,
        description: 'A great fiction book',
        coverImageUrl: 'https://example.com/book1.jpg',
      },
      {
        title: 'Fiction Book 2',
        author: 'Author 2',
        genres: ['Fiction'],
        publishedYear: 2021,
        description: 'Another great fiction book',
        coverImageUrl: 'https://example.com/book2.jpg',
      },
      {
        title: 'Sci-Fi Book 1',
        author: 'Author 3',
        genres: ['Science Fiction'],
        publishedYear: 2019,
        description: 'An amazing sci-fi book',
        coverImageUrl: 'https://example.com/book3.jpg',
      },
    ];

    testBooks = await Book.insertMany(booksData);

    // Create some user activity
    await Review.create({
      userId: testUser._id,
      bookId: testBooks[0]._id,
      text: 'Great fiction book!',
      rating: 5,
    });

    await Favorite.create({
      userId: testUser._id,
      bookId: testBooks[0]._id,
    });
  });

  afterAll(async () => {
    await Promise.all([
      User.deleteMany({}),
      Book.deleteMany({}),
      Review.deleteMany({}),
      Favorite.deleteMany({}),
      RecommendationHistory.deleteMany({}),
      RecommendationFeedback.deleteMany({}),
    ]);
    
    // Clear recommendation cache
    await recommendationsService.clearCache();
    await mongoose.connection.close();
  });

  beforeEach(async () => {
    // Clear cache before each test
    await recommendationsService.clearCache();
    // Also clear database cache
    await RecommendationHistory.deleteMany({});
  });

  describe('generateRecommendations', () => {
    it('should generate recommendations for user with sufficient data', async () => {
      const recommendations = await recommendationsService.generateRecommendations(testUser._id);

      expect(recommendations).toHaveProperty('recommendations');
      expect(recommendations).toHaveProperty('metadata');
      expect(recommendations.recommendations).toBeInstanceOf(Array);
      expect(recommendations.recommendations.length).toBeGreaterThan(0);
      expect(recommendations.recommendations.length).toBeLessThanOrEqual(3);

      // Check metadata
      expect(recommendations.metadata.userId).toBe(testUser._id);
      expect(recommendations.metadata).toHaveProperty('generatedAt');
      expect(recommendations.metadata).toHaveProperty('source');
      expect(recommendations.metadata).toHaveProperty('userPreferences');
      expect(recommendations.metadata).toHaveProperty('processingTime');

      // Check recommendation structure
      const rec = recommendations.recommendations[0];
      expect(rec).toHaveProperty('title');
      expect(rec).toHaveProperty('author');
      expect(rec).toHaveProperty('reason');
      expect(rec).toHaveProperty('confidence');
      expect(rec).toHaveProperty('source');
      expect(['ai', 'fallback']).toContain(rec.source);
    });

    it('should use fallback when OpenAI is unavailable', async () => {
      // Mock OpenAI to be unavailable
      const originalIsAvailable = openaiService.isAvailable;
      openaiService.isAvailable = jest.fn().mockReturnValue(false);

      const recommendations = await recommendationsService.generateRecommendations(testUser._id);

      expect(recommendations.metadata.source).toBe('fallback');
      expect(recommendations.recommendations.length).toBeGreaterThan(0);

      // Restore original method
      openaiService.isAvailable = originalIsAvailable;
    });

    it('should use fallback for users with insufficient data', async () => {
      // Create new user with no activity
      const newUser = await User.create({
        name: 'New User',
        email: 'new@example.com',
        password: 'password123',
      });

      const recommendations = await recommendationsService.generateRecommendations(newUser._id);

      expect(recommendations.metadata.source).toBe('fallback');
      expect(recommendations.metadata.userPreferences.hasEnoughData).toBe(false);
      expect(recommendations.recommendations.length).toBeGreaterThan(0);

      // Clean up
      await User.findByIdAndDelete(newUser._id);
    });

    it('should include processing time in metadata', async () => {
      const recommendations = await recommendationsService.generateRecommendations(testUser._id);

      expect(recommendations.metadata.processingTime).toBeGreaterThan(0);
      expect(recommendations.metadata.processingTime).toBeLessThan(10000); // Should be less than 10 seconds
    });

    it('should include user preferences in metadata', async () => {
      const recommendations = await recommendationsService.generateRecommendations(testUser._id);

      const userPrefs = recommendations.metadata.userPreferences;
      expect(userPrefs).toHaveProperty('favoriteGenres');
      expect(userPrefs).toHaveProperty('averageRating');
      expect(userPrefs).toHaveProperty('totalReviews');
      expect(userPrefs).toHaveProperty('hasEnoughData');

      expect(userPrefs.totalReviews).toBe(1);
      expect(userPrefs.favoriteGenres).toContain('Fiction');
      expect(userPrefs.hasEnoughData).toBe(false); // Only 1 review, need 3 for personalization
    });
  });

  describe('Caching', () => {
    it('should cache recommendations', async () => {
      // First request
      const recommendations1 = await recommendationsService.generateRecommendations(testUser._id);
      const generatedAt1 = recommendations1.metadata.generatedAt;

      // Second request (should be cached)
      const recommendations2 = await recommendationsService.generateRecommendations(testUser._id);
      const generatedAt2 = recommendations2.metadata.generatedAt;

      expect(generatedAt1).toBe(generatedAt2);
      expect(recommendations1.recommendations).toEqual(recommendations2.recommendations);
    });

    it('should invalidate user cache', async () => {
      // Generate recommendations to populate cache
      await recommendationsService.generateRecommendations(testUser._id);

      // Invalidate cache
      await recommendationsService.invalidateUserCache(testUser._id);

      // Next request should generate fresh recommendations
      const recommendations = await recommendationsService.generateRecommendations(testUser._id);
      expect(recommendations).toBeTruthy();
    });

    it('should clear all cache', async () => {
      // Generate recommendations for multiple users
      await recommendationsService.generateRecommendations(testUser._id);

      const newUser = await User.create({
        name: 'Another User',
        email: 'another@example.com',
        password: 'password123',
      });
      await recommendationsService.generateRecommendations(newUser._id);

      // Clear all cache
      await recommendationsService.clearCache();

      // Check cache stats
      const stats = recommendationsService.getCacheStats();
      expect(stats.size).toBe(0);

      // Clean up
      await User.findByIdAndDelete(newUser._id);
    });

    it('should provide cache statistics', async () => {
      // Generate recommendations to populate cache
      await recommendationsService.generateRecommendations(testUser._id);

      const stats = recommendationsService.getCacheStats();
      expect(stats).toHaveProperty('size');
      expect(stats).toHaveProperty('entries');
      expect(stats.size).toBeGreaterThan(0);
      expect(stats.entries).toBeInstanceOf(Array);
      expect(stats.entries.length).toBe(stats.size);

      if (stats.entries.length > 0) {
        const entry = stats.entries[0];
        expect(entry).toHaveProperty('userId');
        expect(entry).toHaveProperty('expiresIn');
        expect(entry.expiresIn).toBeGreaterThan(0);
      }
    });
  });

  describe('testRecommendationSystem', () => {
    it('should test all system components', async () => {
      const testResults = await recommendationsService.testRecommendationSystem();

      expect(testResults).toHaveProperty('openaiAvailable');
      expect(testResults).toHaveProperty('fallbackWorking');
      expect(testResults).toHaveProperty('cacheWorking');

      expect(typeof testResults.openaiAvailable).toBe('boolean');
      expect(testResults.fallbackWorking).toBe(true); // Should always work
      expect(testResults.cacheWorking).toBe(true); // Should always work
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid user ID', async () => {
      const invalidUserId = 'invalid-user-id';

      await expect(
        recommendationsService.generateRecommendations(invalidUserId)
      ).rejects.toThrow();
    });

    it('should handle database connection issues gracefully', async () => {
      // This test would require mocking database failures
      // For now, we'll just ensure the service doesn't crash
      const recommendations = await recommendationsService.generateRecommendations(testUser._id);
      expect(recommendations).toBeTruthy();
    });
  });

  describe('Performance', () => {
    it('should complete within reasonable time', async () => {
      const startTime = Date.now();
      
      await recommendationsService.generateRecommendations(testUser._id);

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should complete within 5 seconds (including potential AI call)
      expect(duration).toBeLessThan(5000);
    });

    it('should have fast cached responses', async () => {
      // First request to populate cache
      await recommendationsService.generateRecommendations(testUser._id);

      // Second request should be very fast (cached)
      const startTime = Date.now();
      await recommendationsService.generateRecommendations(testUser._id);
      const endTime = Date.now();

      const duration = endTime - startTime;
      expect(duration).toBeLessThan(100); // Should be very fast
    });
  });

  describe('Hybrid Recommendations', () => {
    it('should supplement AI recommendations with fallback when needed', async () => {
      // Mock OpenAI to return only 1 recommendation instead of 3
      const originalGenerateRecommendations = openaiService.generateRecommendations;
      openaiService.generateRecommendations = jest.fn().mockResolvedValue([
        {
          title: 'AI Recommended Book',
          author: 'AI Author',
          reason: 'AI generated reason',
          confidence: 0.8,
          genre: 'Fiction',
        },
      ]);

      const recommendations = await recommendationsService.generateRecommendations(testUser._id);

      expect(recommendations.recommendations.length).toBe(3); // Should be supplemented to 3
      expect(recommendations.metadata.source).toBe('hybrid');
      
      // Should have both AI and fallback recommendations
      const sources = recommendations.recommendations.map(rec => rec.source);
      expect(sources).toContain('ai');
      expect(sources).toContain('fallback');

      // Restore original method
      openaiService.generateRecommendations = originalGenerateRecommendations;
    });
  });

  describe('MongoDB Integration', () => {
    it('should store recommendations in database', async () => {
      const recommendations = await recommendationsService.generateRecommendations(testUser._id);

      // Check that recommendation was stored in database
      const dbRecommendation = await RecommendationHistory.findOne({ userId: testUser._id });
      expect(dbRecommendation).toBeTruthy();
      expect(dbRecommendation?.isActive).toBe(true);
      expect(dbRecommendation?.recommendations.length).toBe(recommendations.recommendations.length);
      expect(dbRecommendation?.metadata.source).toBe(recommendations.metadata.source);
    });

    it('should retrieve recommendations from database cache', async () => {
      // First request - generates and stores in DB
      const recommendations1 = await recommendationsService.generateRecommendations(testUser._id);
      
      // Clear memory cache but keep DB cache
      recommendationsService.clearCache();
      
      // Second request - should retrieve from DB
      const recommendations2 = await recommendationsService.generateRecommendations(testUser._id);
      
      expect(recommendations1.metadata.generatedAt).toBe(recommendations2.metadata.generatedAt);
      expect(recommendations1.recommendations).toEqual(recommendations2.recommendations);
    });

    it('should deactivate old recommendations when creating new ones', async () => {
      // Generate first set of recommendations
      await recommendationsService.generateRecommendations(testUser._id);
      
      // Clear cache to force new generation
      await recommendationsService.clearCache();
      
      // Generate second set of recommendations
      await recommendationsService.generateRecommendations(testUser._id);
      
      // Check that only one active recommendation exists
      const activeRecommendations = await RecommendationHistory.find({ 
        userId: testUser._id, 
        isActive: true 
      });
      expect(activeRecommendations.length).toBe(1);
      
      // Check that there are inactive recommendations
      const allRecommendations = await RecommendationHistory.find({ userId: testUser._id });
      expect(allRecommendations.length).toBeGreaterThan(1);
    });

    it('should handle TTL expiration correctly', async () => {
      // Create a recommendation that expires immediately
      const expiredRecommendation = await RecommendationHistory.create({
        userId: testUser._id,
        recommendations: [
          {
            title: 'Expired Book',
            author: 'Expired Author',
            reason: 'This will expire',
            confidence: 0.5,
            source: 'fallback',
          },
        ],
        metadata: {
          generatedAt: new Date(),
          source: 'fallback',
          userPreferences: {
            favoriteGenres: [],
            averageRating: 0,
            totalReviews: 0,
            hasEnoughData: false,
          },
          processingTime: 1000,
          cacheHit: false,
        },
        expiresAt: new Date(Date.now() - 1000), // Already expired
        isActive: true,
      });

      expect(expiredRecommendation.isExpired()).toBe(true);
      
      // Should not retrieve expired recommendation
      const cachedRec = await (RecommendationHistory as any).findActiveForUser(testUser._id.toString());
      expect(cachedRec).toBeNull();
    });

    it('should get user recommendation history', async () => {
      // Generate multiple recommendations over time
      await recommendationsService.generateRecommendations(testUser._id);
      await recommendationsService.clearCache();
      await recommendationsService.generateRecommendations(testUser._id);
      
      const history = await recommendationsService.getUserRecommendationHistory(testUser._id.toString());
      
      expect(history.length).toBeGreaterThan(0);
      expect(history[0].createdAt.getTime()).toBeGreaterThanOrEqual(history[history.length - 1].createdAt.getTime());
    });

    it('should get recommendation analytics', async () => {
      // Generate recommendations to have data for analytics
      await recommendationsService.generateRecommendations(testUser._id);
      
      const analytics = await recommendationsService.getRecommendationAnalytics();
      
      expect(analytics).toBeInstanceOf(Array);
      expect(analytics.length).toBeGreaterThan(0);
      
      const analyticsItem = analytics[0];
      expect(analyticsItem).toHaveProperty('_id'); // source
      expect(analyticsItem).toHaveProperty('count');
      expect(analyticsItem).toHaveProperty('avgProcessingTime');
    });

    it('should get database cache statistics', async () => {
      // Generate recommendations to populate database
      await recommendationsService.generateRecommendations(testUser._id);
      
      const stats = await recommendationsService.getDatabaseCacheStats();
      
      expect(stats).toHaveProperty('totalActive');
      expect(stats).toHaveProperty('totalExpired');
      expect(stats).toHaveProperty('bySource');
      expect(stats.totalActive).toBeGreaterThan(0);
      expect(stats.bySource).toBeInstanceOf(Array);
      
      if (stats.bySource.length > 0) {
        expect(stats.bySource[0]).toHaveProperty('source');
        expect(stats.bySource[0]).toHaveProperty('count');
      }
    });

    it('should handle database errors gracefully', async () => {
      // Mock a database error for caching
      const originalCreate = RecommendationHistory.create;
      RecommendationHistory.create = jest.fn().mockRejectedValue(new Error('Database error'));
      
      // Should still return recommendations even if DB caching fails
      const recommendations = await recommendationsService.generateRecommendations(testUser._id);
      expect(recommendations).toBeTruthy();
      expect(recommendations.recommendations.length).toBeGreaterThan(0);
      
      // Restore original method
      RecommendationHistory.create = originalCreate;
    });

    it('should invalidate database cache when user cache is invalidated', async () => {
      // Generate recommendations
      await recommendationsService.generateRecommendations(testUser._id);
      
      // Verify active recommendation exists
      let activeRec = await RecommendationHistory.findOne({ 
        userId: testUser._id, 
        isActive: true 
      });
      expect(activeRec).toBeTruthy();
      
      // Invalidate cache
      await recommendationsService.invalidateUserCache(testUser._id.toString());
      
      // Verify recommendation is deactivated
      activeRec = await RecommendationHistory.findOne({ 
        userId: testUser._id, 
        isActive: true 
      });
      expect(activeRec).toBeNull();
    });

    it('should clear all database cache when clearCache is called', async () => {
      // Generate recommendations for multiple users
      await recommendationsService.generateRecommendations(testUser._id);
      
      const newUser = await User.create({
        name: 'Cache Test User',
        email: 'cachetest@example.com',
        password: 'password123',
      });
      await recommendationsService.generateRecommendations(newUser._id);
      
      // Verify active recommendations exist
      let activeCount = await RecommendationHistory.countDocuments({ isActive: true });
      expect(activeCount).toBeGreaterThan(0);
      
      // Clear all cache
      await recommendationsService.clearCache();
      
      // Verify all recommendations are deactivated
      activeCount = await RecommendationHistory.countDocuments({ isActive: true });
      expect(activeCount).toBe(0);
      
      // Clean up
      await User.findByIdAndDelete(newUser._id);
    });

    it('should handle concurrent requests properly', async () => {
      // Clear cache first
      await recommendationsService.clearCache();
      
      // Make multiple concurrent requests
      const promises = Array(3).fill(null).map(() => 
        recommendationsService.generateRecommendations(testUser._id)
      );
      
      const results = await Promise.all(promises);
      
      // All should return the same recommendations (cached)
      expect(results[0].metadata.generatedAt).toBe(results[1].metadata.generatedAt);
      expect(results[0].metadata.generatedAt).toBe(results[2].metadata.generatedAt);
      
      // Should only have one active recommendation in database
      const activeCount = await RecommendationHistory.countDocuments({ 
        userId: testUser._id, 
        isActive: true 
      });
      expect(activeCount).toBe(1);
    });

    it('should store OpenAI model information in metadata', async () => {
      await recommendationsService.generateRecommendations(testUser._id);
      
      const dbRecommendation = await RecommendationHistory.findOne({ userId: testUser._id });
      expect(dbRecommendation?.metadata.openaiModel).toBeDefined();
      expect(dbRecommendation?.metadata.cacheHit).toBe(false);
    });

    it('should mark cache hits correctly', async () => {
      // First request - not a cache hit
      await recommendationsService.generateRecommendations(testUser._id);
      
      // Clear memory cache to force DB retrieval
      recommendationsService.clearCache();
      
      // Second request - should be marked as cache hit when retrieved from DB
      await recommendationsService.generateRecommendations(testUser._id);
      
      // The DB record should still show cacheHit: false (original generation)
      // but the service should have retrieved it from cache
      const dbRecommendation = await RecommendationHistory.findOne({ 
        userId: testUser._id, 
        isActive: true 
      });
      expect(dbRecommendation?.metadata.cacheHit).toBe(false); // Original generation
    });
  });
});
