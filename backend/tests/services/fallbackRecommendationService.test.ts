import mongoose from 'mongoose';
import User from '../../src/models/User';
import Book from '../../src/models/Book';
import Review from '../../src/models/Review';
import Favorite from '../../src/models/Favorite';
import fallbackRecommendationService from '../../src/services/fallbackRecommendationService';
import userPreferenceService, { UserPreferences } from '../../src/services/userPreferenceService';

describe('FallbackRecommendationService', () => {
  let testUser: any;
  let testBooks: any[] = [];
  let userPreferences: UserPreferences;

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

    // Create test books with various genres and ratings
    const booksData = [
      {
        title: 'Popular Fiction 1',
        author: 'Author A',
        genre: 'Fiction',
        publicationYear: 2020,
        description: 'A popular fiction book',
      },
      {
        title: 'Popular Fiction 2',
        author: 'Author B',
        genre: 'Fiction',
        publicationYear: 2021,
        description: 'Another popular fiction book',
      },
      {
        title: 'Sci-Fi Classic',
        author: 'Author C',
        genre: 'Science Fiction',
        publicationYear: 2019,
        description: 'A classic sci-fi book',
      },
      {
        title: 'Fantasy Epic',
        author: 'Author D',
        genre: 'Fantasy',
        publicationYear: 2018,
        description: 'An epic fantasy book',
      },
      {
        title: 'Mystery Thriller',
        author: 'Author E',
        genre: 'Mystery',
        publicationYear: 2022,
        description: 'A thrilling mystery',
      },
      {
        title: 'Romance Novel',
        author: 'Author F',
        genre: 'Romance',
        publicationYear: 2020,
        description: 'A romantic story',
      },
    ];

    testBooks = await Book.insertMany(booksData);

    // Create some reviews to make books have ratings
    const otherUser = await User.create({
      name: 'Other User',
      email: 'other@example.com',
      password: 'password123',
    });

    // Create reviews for books to give them ratings
    await Review.insertMany([
      { userId: otherUser._id, bookId: testBooks[0]._id, text: 'Great!', rating: 5 },
      { userId: otherUser._id, bookId: testBooks[1]._id, text: 'Good!', rating: 4 },
      { userId: otherUser._id, bookId: testBooks[2]._id, text: 'Amazing!', rating: 5 },
      { userId: otherUser._id, bookId: testBooks[3]._id, text: 'Excellent!', rating: 5 },
      { userId: otherUser._id, bookId: testBooks[4]._id, text: 'Nice!', rating: 4 },
      { userId: otherUser._id, bookId: testBooks[5]._id, text: 'Lovely!', rating: 4 },
    ]);

    // Create user preferences by adding reviews and favorites
    await Review.create({
      userId: testUser._id,
      bookId: testBooks[0]._id, // Popular Fiction 1
      text: 'Loved this fiction book!',
      rating: 5,
    });

    await Favorite.create({
      userId: testUser._id,
      bookId: testBooks[0]._id, // Popular Fiction 1
    });

    // Get user preferences
    userPreferences = await userPreferenceService.analyzeUserPreferences(testUser._id);
  });

  afterAll(async () => {
    await Promise.all([
      User.deleteMany({}),
      Book.deleteMany({}),
      Review.deleteMany({}),
      Favorite.deleteMany({}),
    ]);
    await mongoose.connection.close();
  });

  describe('generateRecommendations', () => {
    it('should generate recommendations for user with preferences', async () => {
      const recommendations = await fallbackRecommendationService.generateRecommendations(
        testUser._id,
        userPreferences,
        []
      );

      expect(recommendations).toBeInstanceOf(Array);
      expect(recommendations.length).toBeGreaterThan(0);
      expect(recommendations.length).toBeLessThanOrEqual(3);

      // Check recommendation structure
      const recommendation = recommendations[0];
      expect(recommendation).toHaveProperty('title');
      expect(recommendation).toHaveProperty('author');
      expect(recommendation).toHaveProperty('reason');
      expect(recommendation).toHaveProperty('confidence');
      expect(recommendation.confidence).toBeGreaterThan(0);
      expect(recommendation.confidence).toBeLessThanOrEqual(1);
    });

    it('should exclude books user has already reviewed', async () => {
      const excludeBooks = ['Popular Fiction 1 by Author A'];
      
      const recommendations = await fallbackRecommendationService.generateRecommendations(
        testUser._id,
        userPreferences,
        excludeBooks
      );

      // Should not recommend the excluded book
      const titles = recommendations.map(rec => `${rec.title} by ${rec.author}`);
      expect(titles).not.toContain('Popular Fiction 1 by Author A');
    });

    it('should provide genre-based recommendations', async () => {
      const recommendations = await fallbackRecommendationService.generateRecommendations(
        testUser._id,
        userPreferences,
        []
      );

      // Should include fiction books since user likes fiction
      const fictionRecs = recommendations.filter(rec => rec.genre === 'Fiction');
      expect(fictionRecs.length).toBeGreaterThan(0);
    });

    it('should handle user with no preferences', async () => {
      const emptyPreferences: UserPreferences = {
        favoriteGenres: [],
        highRatedBooks: [],
        averageRating: 0,
        totalReviews: 0,
        recentGenres: [],
        ratingDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
        preferredAuthors: [],
        readingPatterns: {
          isSelectiveReader: false,
          isActiveReviewer: false,
          hasGenrePreference: false,
        },
      };

      const recommendations = await fallbackRecommendationService.generateRecommendations(
        testUser._id,
        emptyPreferences,
        []
      );

      expect(recommendations).toBeInstanceOf(Array);
      expect(recommendations.length).toBeGreaterThan(0);
    });

    it('should provide recommendations with confidence scores', async () => {
      const recommendations = await fallbackRecommendationService.generateRecommendations(
        testUser._id,
        userPreferences,
        []
      );

      recommendations.forEach(rec => {
        expect(rec.confidence).toBeGreaterThan(0);
        expect(rec.confidence).toBeLessThanOrEqual(1);
        expect(rec.reason).toBeTruthy();
        expect(rec.reason.length).toBeGreaterThan(10); // Should have meaningful reason
      });
    });

    it('should prioritize highly rated books', async () => {
      const recommendations = await fallbackRecommendationService.generateRecommendations(
        testUser._id,
        userPreferences,
        []
      );

      // Should include some highly rated books
      const highRatedRecs = recommendations.filter(rec => 
        rec.averageRating && rec.averageRating >= 4.0
      );
      expect(highRatedRecs.length).toBeGreaterThan(0);
    });

    it('should provide diverse recommendations', async () => {
      const recommendations = await fallbackRecommendationService.generateRecommendations(
        testUser._id,
        userPreferences,
        []
      );

      // Should have different confidence levels (showing different strategies)
      const confidenceScores = recommendations.map(rec => rec.confidence);
      const uniqueConfidences = [...new Set(confidenceScores)];
      
      // Should have some variety in confidence scores
      expect(uniqueConfidences.length).toBeGreaterThan(1);
    });
  });

  describe('Recommendation Strategies', () => {
    it('should use genre-based strategy', async () => {
      const genrePreferences: UserPreferences = {
        ...userPreferences,
        favoriteGenres: ['Fiction', 'Science Fiction'],
      };

      const recommendations = await fallbackRecommendationService.generateRecommendations(
        testUser._id,
        genrePreferences,
        []
      );

      // Should include books from preferred genres
      const preferredGenreBooks = recommendations.filter(rec => 
        ['Fiction', 'Science Fiction'].includes(rec.genre || '')
      );
      expect(preferredGenreBooks.length).toBeGreaterThan(0);
    });

    it('should use rating-based strategy', async () => {
      const selectivePreferences: UserPreferences = {
        ...userPreferences,
        averageRating: 4.5,
        readingPatterns: {
          ...userPreferences.readingPatterns,
          isSelectiveReader: true,
        },
      };

      const recommendations = await fallbackRecommendationService.generateRecommendations(
        testUser._id,
        selectivePreferences,
        []
      );

      // Should include highly rated books for selective readers
      const highRatedRecs = recommendations.filter(rec => 
        rec.averageRating && rec.averageRating >= 4.0
      );
      expect(highRatedRecs.length).toBeGreaterThan(0);
    });

    it('should provide fallback recommendations when no preferences match', async () => {
      const obscurePreferences: UserPreferences = {
        ...userPreferences,
        favoriteGenres: ['Non-existent Genre'],
        highRatedBooks: [],
      };

      const recommendations = await fallbackRecommendationService.generateRecommendations(
        testUser._id,
        obscurePreferences,
        []
      );

      // Should still provide some recommendations
      expect(recommendations.length).toBeGreaterThan(0);
      
      // Should have lower confidence scores for generic recommendations
      const avgConfidence = recommendations.reduce((sum, rec) => sum + rec.confidence, 0) / recommendations.length;
      expect(avgConfidence).toBeLessThan(0.8); // Should be less confident
    });
  });

  describe('Performance and Edge Cases', () => {
    it('should handle large exclude list', async () => {
      const largeExcludeList = testBooks.map(book => `${book.title} by ${book.author}`);
      
      const recommendations = await fallbackRecommendationService.generateRecommendations(
        testUser._id,
        userPreferences,
        largeExcludeList
      );

      // Should still try to provide recommendations even with large exclude list
      expect(recommendations).toBeInstanceOf(Array);
    });

    it('should complete within reasonable time', async () => {
      const startTime = Date.now();
      
      await fallbackRecommendationService.generateRecommendations(
        testUser._id,
        userPreferences,
        []
      );

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should complete within 2 seconds
      expect(duration).toBeLessThan(2000);
    });

    it('should handle invalid user ID gracefully', async () => {
      const invalidUserId = new mongoose.Types.ObjectId().toString();
      
      const recommendations = await fallbackRecommendationService.generateRecommendations(
        invalidUserId,
        userPreferences,
        []
      );

      // Should still provide recommendations based on preferences
      expect(recommendations).toBeInstanceOf(Array);
    });
  });
});
