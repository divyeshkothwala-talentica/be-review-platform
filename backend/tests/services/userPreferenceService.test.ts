import mongoose from 'mongoose';
import User from '../../src/models/User';
import Book from '../../src/models/Book';
import Review from '../../src/models/Review';
import Favorite from '../../src/models/Favorite';
import userPreferenceService from '../../src/services/userPreferenceService';

describe('UserPreferenceService', () => {
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
        description: 'A fiction book',
      },
      {
        title: 'Fiction Book 2',
        author: 'Author 1',
        genre: 'Fiction',
        publicationYear: 2021,
        description: 'Another fiction book',
      },
      {
        title: 'Sci-Fi Book 1',
        author: 'Author 2',
        genre: 'Science Fiction',
        publicationYear: 2019,
        description: 'A sci-fi book',
      },
      {
        title: 'Fantasy Book 1',
        author: 'Author 3',
        genre: 'Fantasy',
        publicationYear: 2018,
        description: 'A fantasy book',
      },
    ];

    testBooks = await Book.insertMany(booksData);
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

  beforeEach(async () => {
    // Clear reviews and favorites before each test
    await Review.deleteMany({});
    await Favorite.deleteMany({});
  });

  describe('analyzeUserPreferences', () => {
    it('should analyze user preferences with reviews and favorites', async () => {
      // Create test reviews
      await Review.create({
        userId: testUser._id,
        bookId: testBooks[0]._id, // Fiction Book 1
        text: 'Great book!',
        rating: 5,
      });

      await Review.create({
        userId: testUser._id,
        bookId: testBooks[1]._id, // Fiction Book 2
        text: 'Good read',
        rating: 4,
      });

      await Review.create({
        userId: testUser._id,
        bookId: testBooks[2]._id, // Sci-Fi Book 1
        text: 'Interesting',
        rating: 3,
      });

      // Create test favorites
      await Favorite.create({
        userId: testUser._id,
        bookId: testBooks[0]._id, // Fiction Book 1
      });

      const preferences = await userPreferenceService.analyzeUserPreferences(testUser._id);

      expect(preferences).toHaveProperty('favoriteGenres');
      expect(preferences).toHaveProperty('highRatedBooks');
      expect(preferences).toHaveProperty('averageRating');
      expect(preferences).toHaveProperty('totalReviews');
      expect(preferences).toHaveProperty('recentGenres');
      expect(preferences).toHaveProperty('ratingDistribution');
      expect(preferences).toHaveProperty('preferredAuthors');
      expect(preferences).toHaveProperty('readingPatterns');

      expect(preferences.totalReviews).toBe(3);
      expect(preferences.averageRating).toBeCloseTo(4.0);
      expect(preferences.favoriteGenres).toContain('Fiction');
      expect(preferences.highRatedBooks.length).toBe(2); // Books rated 4+
      expect(preferences.ratingDistribution[5]).toBe(1);
      expect(preferences.ratingDistribution[4]).toBe(1);
      expect(preferences.ratingDistribution[3]).toBe(1);
    });

    it('should handle user with no data', async () => {
      const preferences = await userPreferenceService.analyzeUserPreferences(testUser._id);

      expect(preferences.totalReviews).toBe(0);
      expect(preferences.averageRating).toBe(0);
      expect(preferences.favoriteGenres).toEqual([]);
      expect(preferences.highRatedBooks).toEqual([]);
      expect(preferences.preferredAuthors).toEqual([]);
    });

    it('should identify preferred authors', async () => {
      // Create multiple reviews for the same author
      await Review.create({
        userId: testUser._id,
        bookId: testBooks[0]._id, // Fiction Book 1 by Author 1
        text: 'Great book!',
        rating: 5,
      });

      await Review.create({
        userId: testUser._id,
        bookId: testBooks[1]._id, // Fiction Book 2 by Author 1
        text: 'Another great book!',
        rating: 4,
      });

      const preferences = await userPreferenceService.analyzeUserPreferences(testUser._id);

      expect(preferences.preferredAuthors).toContain('Author 1');
    });

    it('should identify reading patterns', async () => {
      // Create reviews showing selective reading (high average rating)
      await Review.create({
        userId: testUser._id,
        bookId: testBooks[0]._id,
        text: 'Excellent!',
        rating: 5,
      });

      await Review.create({
        userId: testUser._id,
        bookId: testBooks[1]._id,
        text: 'Great!',
        rating: 5,
      });

      await Review.create({
        userId: testUser._id,
        bookId: testBooks[2]._id,
        text: 'Good!',
        rating: 4,
      });

      const preferences = await userPreferenceService.analyzeUserPreferences(testUser._id);

      expect(preferences.readingPatterns.isSelectiveReader).toBe(true);
      expect(preferences.readingPatterns.hasGenrePreference).toBe(true);
    });
  });

  describe('getUserReviewedBooks', () => {
    it('should return list of reviewed books', async () => {
      await Review.create({
        userId: testUser._id,
        bookId: testBooks[0]._id,
        text: 'Great book!',
        rating: 5,
      });

      await Review.create({
        userId: testUser._id,
        bookId: testBooks[1]._id,
        text: 'Good read',
        rating: 4,
      });

      const reviewedBooks = await userPreferenceService.getUserReviewedBooks(testUser._id);

      expect(reviewedBooks).toBeInstanceOf(Array);
      expect(reviewedBooks.length).toBe(2);
      expect(reviewedBooks[0]).toContain('Fiction Book');
      expect(reviewedBooks[0]).toContain('Author');
    });

    it('should return empty array for user with no reviews', async () => {
      const reviewedBooks = await userPreferenceService.getUserReviewedBooks(testUser._id);

      expect(reviewedBooks).toEqual([]);
    });
  });

  describe('hasEnoughDataForPersonalization', () => {
    it('should return true for user with sufficient reviews', async () => {
      // Create 3 reviews (minimum threshold)
      for (let i = 0; i < 3; i++) {
        await Review.create({
          userId: testUser._id,
          bookId: testBooks[i]._id,
          text: `Review ${i + 1}`,
          rating: 4,
        });
      }

      const hasEnoughData = await userPreferenceService.hasEnoughDataForPersonalization(testUser._id);

      expect(hasEnoughData).toBe(true);
    });

    it('should return true for user with sufficient favorites', async () => {
      // Create 2 favorites (minimum threshold)
      await Favorite.create({
        userId: testUser._id,
        bookId: testBooks[0]._id,
      });

      await Favorite.create({
        userId: testUser._id,
        bookId: testBooks[1]._id,
      });

      const hasEnoughData = await userPreferenceService.hasEnoughDataForPersonalization(testUser._id);

      expect(hasEnoughData).toBe(true);
    });

    it('should return false for user with insufficient data', async () => {
      // Create only 1 review and 1 favorite (below thresholds)
      await Review.create({
        userId: testUser._id,
        bookId: testBooks[0]._id,
        text: 'Review',
        rating: 4,
      });

      await Favorite.create({
        userId: testUser._id,
        bookId: testBooks[1]._id,
      });

      const hasEnoughData = await userPreferenceService.hasEnoughDataForPersonalization(testUser._id);

      expect(hasEnoughData).toBe(false);
    });

    it('should return false for new user', async () => {
      const hasEnoughData = await userPreferenceService.hasEnoughDataForPersonalization(testUser._id);

      expect(hasEnoughData).toBe(false);
    });
  });
});
