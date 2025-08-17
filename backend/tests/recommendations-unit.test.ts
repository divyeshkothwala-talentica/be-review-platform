import mongoose from 'mongoose';
import User from '../src/models/User';
import Book from '../src/models/Book';
import Review from '../src/models/Review';
import Favorite from '../src/models/Favorite';
import recommendationsService from '../src/services/recommendationsService';
import userPreferenceService from '../src/services/userPreferenceService';
import fallbackRecommendationService from '../src/services/fallbackRecommendationService';

describe('Recommendations Services - Unit Tests', () => {
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
        genres: ['Fiction'],
        publishedYear: 2020,
        description: 'A great fiction book',
        coverImageUrl: 'https://example.com/cover1.jpg',
      },
      {
        title: 'Fiction Book 2',
        author: 'Author 2',
        genres: ['Fiction'],
        publishedYear: 2021,
        description: 'Another great fiction book',
        coverImageUrl: 'https://example.com/cover2.jpg',
      },
      {
        title: 'Sci-Fi Book 1',
        author: 'Author 3',
        genres: ['Science Fiction'],
        publishedYear: 2019,
        description: 'An amazing sci-fi book',
        coverImageUrl: 'https://example.com/cover3.jpg',
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
    // Clean up
    await Promise.all([
      User.deleteMany({}),
      Book.deleteMany({}),
      Review.deleteMany({}),
      Favorite.deleteMany({}),
    ]);
    
    // Clear recommendation cache
    recommendationsService.clearCache();
    
    // Close database connection
    await mongoose.connection.close();
  });

  beforeEach(() => {
    // Clear cache before each test
    recommendationsService.clearCache();
  });

  describe('UserPreferenceService', () => {
    it('should analyze user preferences', async () => {
      const preferences = await userPreferenceService.analyzeUserPreferences(testUser._id);

      expect(preferences).toHaveProperty('favoriteGenres');
      expect(preferences).toHaveProperty('highRatedBooks');
      expect(preferences).toHaveProperty('averageRating');
      expect(preferences).toHaveProperty('totalReviews');
      expect(preferences).toHaveProperty('readingPatterns');

      expect(preferences.totalReviews).toBe(1);
      expect(preferences.averageRating).toBe(5);
      expect(preferences.favoriteGenres).toContain('Fiction');
    });

    it('should check if user has enough data for personalization', async () => {
      const hasEnoughData = await userPreferenceService.hasEnoughDataForPersonalization(testUser._id);
      
      // User has 1 review and 1 favorite, but needs 3 reviews or 2 favorites
      expect(hasEnoughData).toBe(false);
    });

    it('should get user reviewed books', async () => {
      const reviewedBooks = await userPreferenceService.getUserReviewedBooks(testUser._id);
      
      expect(reviewedBooks).toBeInstanceOf(Array);
      expect(reviewedBooks.length).toBe(1);
      expect(reviewedBooks[0]).toContain('Fiction Book 1');
    });
  });

  describe('FallbackRecommendationService', () => {
    it('should generate fallback recommendations', async () => {
      const userPreferences = await userPreferenceService.analyzeUserPreferences(testUser._id);
      
      const recommendations = await fallbackRecommendationService.generateRecommendations(
        testUser._id,
        userPreferences,
        []
      );

      expect(recommendations).toBeInstanceOf(Array);
      expect(recommendations.length).toBeGreaterThan(0);
      expect(recommendations.length).toBeLessThanOrEqual(3);

      // Check recommendation structure
      const rec = recommendations[0];
      expect(rec).toHaveProperty('title');
      expect(rec).toHaveProperty('author');
      expect(rec).toHaveProperty('reason');
      expect(rec).toHaveProperty('confidence');
      expect(rec.confidence).toBeGreaterThan(0);
      expect(rec.confidence).toBeLessThanOrEqual(1);
    });

    it('should exclude specified books', async () => {
      const userPreferences = await userPreferenceService.analyzeUserPreferences(testUser._id);
      const excludeBooks = ['Fiction Book 1 by Author 1'];
      
      const recommendations = await fallbackRecommendationService.generateRecommendations(
        testUser._id,
        userPreferences,
        excludeBooks
      );

      // Should not recommend the excluded book
      const titles = recommendations.map(rec => `${rec.title} by ${rec.author}`);
      expect(titles).not.toContain('Fiction Book 1 by Author 1');
    });
  });

  describe('RecommendationsService', () => {
    it('should generate recommendations', async () => {
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

    it('should cache recommendations', async () => {
      // First request
      const recommendations1 = await recommendationsService.generateRecommendations(testUser._id);
      const generatedAt1 = recommendations1.metadata.generatedAt;

      // Second request (should be cached)
      const recommendations2 = await recommendationsService.generateRecommendations(testUser._id);
      const generatedAt2 = recommendations2.metadata.generatedAt;

      // Should return the same cached response
      expect(generatedAt1).toBe(generatedAt2);
      expect(recommendations1.recommendations).toEqual(recommendations2.recommendations);
    });

    it('should invalidate cache', async () => {
      // Generate recommendations to populate cache
      await recommendationsService.generateRecommendations(testUser._id);

      // Invalidate cache
      recommendationsService.invalidateUserCache(testUser._id);

      // Check cache stats
      const stats = recommendationsService.getCacheStats();
      expect(stats.size).toBe(0);
    });

    it('should provide cache statistics', async () => {
      // Generate recommendations to populate cache
      await recommendationsService.generateRecommendations(testUser._id);

      const stats = recommendationsService.getCacheStats();
      expect(stats).toHaveProperty('size');
      expect(stats).toHaveProperty('entries');
      expect(stats.size).toBeGreaterThan(0);
      expect(stats.entries).toBeInstanceOf(Array);
    });

    it('should test recommendation system', async () => {
      const testResults = await recommendationsService.testRecommendationSystem();

      expect(testResults).toHaveProperty('openaiAvailable');
      expect(testResults).toHaveProperty('fallbackWorking');
      expect(testResults).toHaveProperty('cacheWorking');

      expect(typeof testResults.openaiAvailable).toBe('boolean');
      expect(testResults.fallbackWorking).toBe(true); // Should always work
      expect(testResults.cacheWorking).toBe(true); // Should always work
    });
  });

  describe('Performance Tests', () => {
    it('should complete within reasonable time', async () => {
      const startTime = Date.now();
      
      await recommendationsService.generateRecommendations(testUser._id);

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should complete within 10 seconds (including potential AI call)
      expect(duration).toBeLessThan(10000);
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
});
