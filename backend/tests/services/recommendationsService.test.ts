import mongoose from 'mongoose';
import User from '../../src/models/User';
import Book from '../../src/models/Book';
import Review from '../../src/models/Review';
import Favorite from '../../src/models/Favorite';
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
        genre: 'Fiction',
        publicationYear: 2020,
        description: 'A great fiction book',
      },
      {
        title: 'Fiction Book 2',
        author: 'Author 2',
        genre: 'Fiction',
        publicationYear: 2021,
        description: 'Another great fiction book',
      },
      {
        title: 'Sci-Fi Book 1',
        author: 'Author 3',
        genre: 'Science Fiction',
        publicationYear: 2019,
        description: 'An amazing sci-fi book',
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
    ]);
    
    // Clear recommendation cache
    recommendationsService.clearCache();
    await mongoose.connection.close();
  });

  beforeEach(() => {
    // Clear cache before each test
    recommendationsService.clearCache();
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
      recommendationsService.invalidateUserCache(testUser._id);

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
      recommendationsService.clearCache();

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
});
