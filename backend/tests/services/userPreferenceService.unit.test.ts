import userPreferenceService from '../../src/services/userPreferenceService';
import Review from '../../src/models/Review';
import Favorite from '../../src/models/Favorite';
import { logger } from '../../src/utils/logger';

// Mock all dependencies
jest.mock('../../src/models/Review');
jest.mock('../../src/models/Favorite');
jest.mock('../../src/utils/logger');

const MockedReview = Review as jest.Mocked<typeof Review>;
const MockedFavorite = Favorite as jest.Mocked<typeof Favorite>;
const MockedLogger = logger as jest.Mocked<typeof logger>;

describe('UserPreferenceService Unit Tests', () => {
  const mockUserId = '507f1f77bcf86cd799439011';

  const mockReviews = [
    {
      _id: 'review1',
      userId: mockUserId,
      bookId: {
        _id: 'book1',
        title: 'Fiction Book 1',
        author: 'Author A',
        genres: ['Fiction', 'Drama'],
        publishedYear: 2020,
      },
      text: 'Great book!',
      rating: 5,
      createdAt: new Date('2023-06-01'),
    },
    {
      _id: 'review2',
      userId: mockUserId,
      bookId: {
        _id: 'book2',
        title: 'Fiction Book 2',
        author: 'Author A',
        genres: ['Fiction'],
        publishedYear: 2021,
      },
      text: 'Good read',
      rating: 4,
      createdAt: new Date('2023-07-01'),
    },
    {
      _id: 'review3',
      userId: mockUserId,
      bookId: {
        _id: 'book3',
        title: 'Mystery Book 1',
        author: 'Author B',
        genres: ['Mystery', 'Thriller'],
        publishedYear: 2019,
      },
      text: 'Interesting',
      rating: 3,
      createdAt: new Date('2023-08-01'),
    },
    {
      _id: 'review4',
      userId: mockUserId,
      bookId: {
        _id: 'book4',
        title: 'Sci-Fi Book 1',
        author: 'Author C',
        genres: ['Science Fiction'],
        publishedYear: 2022,
      },
      text: 'Amazing!',
      rating: 5,
      createdAt: new Date('2023-09-01'),
    },
  ];

  const mockFavorites = [
    {
      _id: 'favorite1',
      userId: mockUserId,
      bookId: {
        _id: 'book1',
        title: 'Fiction Book 1',
        author: 'Author A',
        genres: ['Fiction', 'Drama'],
        publishedYear: 2020,
      },
      createdAt: new Date('2023-06-15'),
    },
    {
      _id: 'favorite2',
      userId: mockUserId,
      bookId: {
        _id: 'book5',
        title: 'Fantasy Book 1',
        author: 'Author D',
        genres: ['Fantasy'],
        publishedYear: 2018,
      },
      createdAt: new Date('2023-07-15'),
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('analyzeUserPreferences', () => {
    beforeEach(() => {
      // Mock the find chain for reviews
      const mockReviewQuery = {
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue(mockReviews),
      };
      MockedReview.find.mockReturnValue(mockReviewQuery as any);

      // Mock the find chain for favorites
      const mockFavoriteQuery = {
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue(mockFavorites),
      };
      MockedFavorite.find.mockReturnValue(mockFavoriteQuery as any);
    });

    it('should analyze user preferences with reviews and favorites', async () => {
      const result = await userPreferenceService.analyzeUserPreferences(mockUserId);

      expect(result).toHaveProperty('favoriteGenres');
      expect(result).toHaveProperty('highRatedBooks');
      expect(result).toHaveProperty('averageRating');
      expect(result).toHaveProperty('totalReviews');
      expect(result).toHaveProperty('recentGenres');
      expect(result).toHaveProperty('ratingDistribution');
      expect(result).toHaveProperty('preferredAuthors');
      expect(result).toHaveProperty('readingPatterns');

      expect(result.totalReviews).toBe(4);
      expect(result.averageRating).toBeCloseTo(4.25); // (5+4+3+5)/4
      expect(result.favoriteGenres).toContain('Fiction');
      expect(result.favoriteGenres).toContain('Fantasy');
      expect(result.highRatedBooks).toHaveLength(3); // Books rated 4+
      expect(result.preferredAuthors).toContain('Author A'); // Has 2 books with avg 4.5

      // Check rating distribution
      expect(result.ratingDistribution[5]).toBe(2);
      expect(result.ratingDistribution[4]).toBe(1);
      expect(result.ratingDistribution[3]).toBe(1);
      expect(result.ratingDistribution[2]).toBe(0);
      expect(result.ratingDistribution[1]).toBe(0);

      // Check reading patterns
      expect(result.readingPatterns.isSelectiveReader).toBe(true); // avg rating >= 4.0
      expect(result.readingPatterns.isActiveReviewer).toBe(false); // < 10 reviews
      expect(result.readingPatterns.hasGenrePreference).toBe(true); // concentrated genres

      expect(MockedLogger.info).toHaveBeenCalledWith('Analyzing user preferences', { userId: mockUserId });
      expect(MockedLogger.info).toHaveBeenCalledWith('User preferences analyzed', {
        userId: mockUserId,
        totalReviews: 4,
        favoriteGenres: expect.any(Number),
        averageRating: 4.25,
      });
    });

    it('should handle user with no reviews or favorites', async () => {
      const mockEmptyReviewQuery = {
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue([]),
      };
      MockedReview.find.mockReturnValue(mockEmptyReviewQuery as any);

      const mockEmptyFavoriteQuery = {
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue([]),
      };
      MockedFavorite.find.mockReturnValue(mockEmptyFavoriteQuery as any);

      const result = await userPreferenceService.analyzeUserPreferences(mockUserId);

      expect(result.totalReviews).toBe(0);
      expect(result.averageRating).toBe(0);
      expect(result.favoriteGenres).toEqual([]);
      expect(result.highRatedBooks).toEqual([]);
      expect(result.recentGenres).toEqual([]);
      expect(result.preferredAuthors).toEqual([]);
      expect(result.readingPatterns.isSelectiveReader).toBe(false);
      expect(result.readingPatterns.isActiveReviewer).toBe(false);
      expect(result.readingPatterns.hasGenrePreference).toBe(true); // No genres means default calculation
    });

    it('should handle reviews with missing book data', async () => {
      const reviewsWithMissingData = [
        {
          _id: 'review1',
          userId: mockUserId,
          bookId: null, // Missing book data
          text: 'Review without book',
          rating: 4,
          createdAt: new Date('2023-06-01'),
        },
        {
          _id: 'review2',
          userId: mockUserId,
          bookId: 'string-id', // Book not populated
          text: 'Review with string ID',
          rating: 5,
          createdAt: new Date('2023-07-01'),
        },
        mockReviews[0], // Valid review
      ];

      const mockReviewQuery = {
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue(reviewsWithMissingData),
      };
      MockedReview.find.mockReturnValue(mockReviewQuery as any);

      const result = await userPreferenceService.analyzeUserPreferences(mockUserId);

      expect(result.totalReviews).toBe(3);
      expect(result.averageRating).toBeCloseTo(4.67); // (4+5+5)/3
      expect(result.highRatedBooks).toHaveLength(1); // Only the valid review with book data
      expect(result.favoriteGenres).toContain('Fiction');
    });

    it('should calculate recent genres correctly', async () => {
      // Mock reviews with some old and some recent
      const mixedDateReviews = [
        {
          ...mockReviews[0],
          createdAt: new Date('2022-01-01'), // Old review
        },
        {
          ...mockReviews[1],
          createdAt: new Date(), // Recent review
        },
        {
          ...mockReviews[2],
          createdAt: new Date(), // Recent review
        },
      ];

      const mockReviewQuery = {
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue(mixedDateReviews),
      };
      MockedReview.find.mockReturnValue(mockReviewQuery as any);

      const result = await userPreferenceService.analyzeUserPreferences(mockUserId);

      // Recent genres should only include genres from recent reviews
      expect(result.recentGenres).toContain('Fiction');
      expect(result.recentGenres).toContain('Mystery');
      expect(result.recentGenres).toContain('Thriller');
    });

    it('should weight favorites higher in genre analysis', async () => {
      // Create scenario where favorites have different genres than reviews
      const reviewsOnlySciFi = [
        {
          _id: 'review1',
          userId: mockUserId,
          bookId: {
            _id: 'book1',
            title: 'Sci-Fi Book',
            author: 'Author A',
            genres: ['Science Fiction'],
            publishedYear: 2020,
          },
          text: 'Good sci-fi',
          rating: 4,
          createdAt: new Date('2023-06-01'),
        },
      ];

      const favoritesOnlyFantasy = [
        {
          _id: 'favorite1',
          userId: mockUserId,
          bookId: {
            _id: 'book2',
            title: 'Fantasy Book',
            author: 'Author B',
            genres: ['Fantasy'],
            publishedYear: 2020,
          },
          createdAt: new Date('2023-06-15'),
        },
        {
          _id: 'favorite2',
          userId: mockUserId,
          bookId: {
            _id: 'book3',
            title: 'Another Fantasy Book',
            author: 'Author C',
            genres: ['Fantasy'],
            publishedYear: 2021,
          },
          createdAt: new Date('2023-07-15'),
        },
      ];

      const mockReviewQuery = {
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue(reviewsOnlySciFi),
      };
      MockedReview.find.mockReturnValue(mockReviewQuery as any);

      const mockFavoriteQuery = {
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue(favoritesOnlyFantasy),
      };
      MockedFavorite.find.mockReturnValue(mockFavoriteQuery as any);

      const result = await userPreferenceService.analyzeUserPreferences(mockUserId);

      // Fantasy should be top genre due to favorites weighting (2*2=4 points vs 1 point for sci-fi)
      expect(result.favoriteGenres[0]).toBe('Fantasy');
    });

    it('should handle errors gracefully', async () => {
      MockedReview.find.mockImplementation(() => {
        throw new Error('Database error');
      });

      await expect(userPreferenceService.analyzeUserPreferences(mockUserId)).rejects.toThrow('Database error');
      expect(MockedLogger.error).toHaveBeenCalledWith('Error analyzing user preferences:', expect.any(Error));
    });

    it('should limit high-rated books to 10', async () => {
      // Create 15 high-rated books
      const manyHighRatedReviews = Array.from({ length: 15 }, (_, i) => ({
        _id: `review${i}`,
        userId: mockUserId,
        bookId: {
          _id: `book${i}`,
          title: `Book ${i}`,
          author: `Author ${i}`,
          genres: ['Fiction'],
          publishedYear: 2020,
        },
        text: `Review ${i}`,
        rating: 5,
        createdAt: new Date('2023-06-01'),
      }));

      const mockReviewQuery = {
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue(manyHighRatedReviews),
      };
      MockedReview.find.mockReturnValue(mockReviewQuery as any);

      const result = await userPreferenceService.analyzeUserPreferences(mockUserId);

      expect(result.highRatedBooks).toHaveLength(10);
    });

    it('should limit favorite genres to 5', async () => {
      // Create reviews with many different genres
      const manyGenreReviews = [
        'Fiction', 'Mystery', 'Romance', 'Thriller', 'Fantasy', 
        'Science Fiction', 'Horror', 'Biography', 'History', 'Poetry'
      ].map((genre, i) => ({
        _id: `review${i}`,
        userId: mockUserId,
        bookId: {
          _id: `book${i}`,
          title: `${genre} Book`,
          author: `Author ${i}`,
          genres: [genre],
          publishedYear: 2020,
        },
        text: `${genre} review`,
        rating: 4,
        createdAt: new Date('2023-06-01'),
      }));

      const mockReviewQuery = {
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue(manyGenreReviews),
      };
      MockedReview.find.mockReturnValue(mockReviewQuery as any);

      const result = await userPreferenceService.analyzeUserPreferences(mockUserId);

      expect(result.favoriteGenres).toHaveLength(5);
    });

    it('should limit recent genres to 3', async () => {
      // Create recent reviews with many genres
      const recentReviews = [
        'Fiction', 'Mystery', 'Romance', 'Thriller', 'Fantasy'
      ].map((genre, i) => ({
        _id: `review${i}`,
        userId: mockUserId,
        bookId: {
          _id: `book${i}`,
          title: `${genre} Book`,
          author: `Author ${i}`,
          genres: [genre],
          publishedYear: 2020,
        },
        text: `${genre} review`,
        rating: 4,
        createdAt: new Date(), // All recent
      }));

      const mockReviewQuery = {
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue(recentReviews),
      };
      MockedReview.find.mockReturnValue(mockReviewQuery as any);

      const result = await userPreferenceService.analyzeUserPreferences(mockUserId);

      expect(result.recentGenres).toHaveLength(3);
    });

    it('should limit preferred authors to 5', async () => {
      // Create reviews for many authors with high ratings
      const manyAuthorReviews = Array.from({ length: 10 }, (_, i) => [
        {
          _id: `review${i}a`,
          userId: mockUserId,
          bookId: {
            _id: `book${i}a`,
            title: `Book ${i}A`,
            author: `Author ${i}`,
            genres: ['Fiction'],
            publishedYear: 2020,
          },
          text: `Review ${i}A`,
          rating: 5,
          createdAt: new Date('2023-06-01'),
        },
        {
          _id: `review${i}b`,
          userId: mockUserId,
          bookId: {
            _id: `book${i}b`,
            title: `Book ${i}B`,
            author: `Author ${i}`,
            genres: ['Fiction'],
            publishedYear: 2021,
          },
          text: `Review ${i}B`,
          rating: 4,
          createdAt: new Date('2023-07-01'),
        },
      ]).flat();

      const mockReviewQuery = {
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue(manyAuthorReviews),
      };
      MockedReview.find.mockReturnValue(mockReviewQuery as any);

      const result = await userPreferenceService.analyzeUserPreferences(mockUserId);

      expect(result.preferredAuthors).toHaveLength(5);
    });
  });

  describe('getUserReviewedBooks', () => {
    it('should return list of reviewed books', async () => {
      const mockReviewQuery = {
        populate: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue(mockReviews),
      };
      MockedReview.find.mockReturnValue(mockReviewQuery as any);

      const result = await userPreferenceService.getUserReviewedBooks(mockUserId);

      expect(result).toBeInstanceOf(Array);
      expect(result).toHaveLength(4);
      expect(result[0]).toBe('Fiction Book 1 by Author A');
      expect(result[1]).toBe('Fiction Book 2 by Author A');
      expect(result[2]).toBe('Mystery Book 1 by Author B');
      expect(result[3]).toBe('Sci-Fi Book 1 by Author C');

      expect(MockedReview.find).toHaveBeenCalledWith({ userId: mockUserId });
    });

    it('should handle reviews with missing book data', async () => {
      const reviewsWithMissingData = [
        {
          _id: 'review1',
          userId: mockUserId,
          bookId: null,
          text: 'Review without book',
          rating: 4,
          createdAt: new Date('2023-06-01'),
        },
        {
          _id: 'review2',
          userId: mockUserId,
          bookId: 'string-id',
          text: 'Review with string ID',
          rating: 5,
          createdAt: new Date('2023-07-01'),
        },
        mockReviews[0],
      ];

      const mockReviewQuery = {
        populate: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue(reviewsWithMissingData),
      };
      MockedReview.find.mockReturnValue(mockReviewQuery as any);

      const result = await userPreferenceService.getUserReviewedBooks(mockUserId);

      expect(result).toHaveLength(1);
      expect(result[0]).toBe('Fiction Book 1 by Author A');
    });

    it('should return empty array for user with no reviews', async () => {
      const mockReviewQuery = {
        populate: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue([]),
      };
      MockedReview.find.mockReturnValue(mockReviewQuery as any);

      const result = await userPreferenceService.getUserReviewedBooks(mockUserId);

      expect(result).toEqual([]);
    });

    it('should handle database errors gracefully', async () => {
      MockedReview.find.mockImplementation(() => {
        throw new Error('Database error');
      });

      const result = await userPreferenceService.getUserReviewedBooks(mockUserId);

      expect(result).toEqual([]);
      expect(MockedLogger.error).toHaveBeenCalledWith('Error getting user reviewed books:', expect.any(Error));
    });
  });

  describe('hasEnoughDataForPersonalization', () => {
    it('should return true when user has enough reviews', async () => {
      MockedReview.countDocuments.mockResolvedValue(5);
      MockedFavorite.countDocuments.mockResolvedValue(1);

      const result = await userPreferenceService.hasEnoughDataForPersonalization(mockUserId);

      expect(result).toBe(true);
      expect(MockedReview.countDocuments).toHaveBeenCalledWith({ userId: mockUserId });
      expect(MockedFavorite.countDocuments).toHaveBeenCalledWith({ userId: mockUserId });
    });

    it('should return true when user has enough favorites', async () => {
      MockedReview.countDocuments.mockResolvedValue(1);
      MockedFavorite.countDocuments.mockResolvedValue(3);

      const result = await userPreferenceService.hasEnoughDataForPersonalization(mockUserId);

      expect(result).toBe(true);
    });

    it('should return true when user has exactly minimum reviews', async () => {
      MockedReview.countDocuments.mockResolvedValue(3);
      MockedFavorite.countDocuments.mockResolvedValue(0);

      const result = await userPreferenceService.hasEnoughDataForPersonalization(mockUserId);

      expect(result).toBe(true);
    });

    it('should return true when user has exactly minimum favorites', async () => {
      MockedReview.countDocuments.mockResolvedValue(0);
      MockedFavorite.countDocuments.mockResolvedValue(2);

      const result = await userPreferenceService.hasEnoughDataForPersonalization(mockUserId);

      expect(result).toBe(true);
    });

    it('should return false when user has insufficient data', async () => {
      MockedReview.countDocuments.mockResolvedValue(2);
      MockedFavorite.countDocuments.mockResolvedValue(1);

      const result = await userPreferenceService.hasEnoughDataForPersonalization(mockUserId);

      expect(result).toBe(false);
    });

    it('should return false for new user with no data', async () => {
      MockedReview.countDocuments.mockResolvedValue(0);
      MockedFavorite.countDocuments.mockResolvedValue(0);

      const result = await userPreferenceService.hasEnoughDataForPersonalization(mockUserId);

      expect(result).toBe(false);
    });

    it('should handle database errors gracefully', async () => {
      MockedReview.countDocuments.mockRejectedValue(new Error('Database error'));
      MockedFavorite.countDocuments.mockResolvedValue(0);

      const result = await userPreferenceService.hasEnoughDataForPersonalization(mockUserId);

      expect(result).toBe(false);
      expect(MockedLogger.error).toHaveBeenCalledWith('Error checking user data sufficiency:', expect.any(Error));
    });

    it('should handle partial database errors gracefully', async () => {
      MockedReview.countDocuments.mockResolvedValue(5);
      MockedFavorite.countDocuments.mockRejectedValue(new Error('Database error'));

      const result = await userPreferenceService.hasEnoughDataForPersonalization(mockUserId);

      expect(result).toBe(false);
      expect(MockedLogger.error).toHaveBeenCalledWith('Error checking user data sufficiency:', expect.any(Error));
    });
  });

  describe('Private Methods Coverage', () => {
    beforeEach(() => {
      const mockReviewQuery = {
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue(mockReviews),
      };
      MockedReview.find.mockReturnValue(mockReviewQuery as any);

      const mockFavoriteQuery = {
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue(mockFavorites),
      };
      MockedFavorite.find.mockReturnValue(mockFavoriteQuery as any);
    });

    it('should test rating distribution calculation', async () => {
      const reviewsWithVariedRatings = [
        { ...mockReviews[0], rating: 1 },
        { ...mockReviews[1], rating: 2 },
        { ...mockReviews[2], rating: 3 },
        { ...mockReviews[3], rating: 4 },
        { ...mockReviews[0], rating: 5, _id: 'review5' },
      ];

      const mockReviewQuery = {
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue(reviewsWithVariedRatings),
      };
      MockedReview.find.mockReturnValue(mockReviewQuery as any);

      const result = await userPreferenceService.analyzeUserPreferences(mockUserId);

      expect(result.ratingDistribution[1]).toBe(1);
      expect(result.ratingDistribution[2]).toBe(1);
      expect(result.ratingDistribution[3]).toBe(1);
      expect(result.ratingDistribution[4]).toBe(1);
      expect(result.ratingDistribution[5]).toBe(1);
    });

    it('should handle edge case ratings in distribution', async () => {
      const reviewsWithEdgeCaseRatings = [
        { ...mockReviews[0], rating: 0.5 }, // Below range
        { ...mockReviews[1], rating: 5.5 }, // Above range
        { ...mockReviews[2], rating: 3.7 }, // Should round to 4
        { ...mockReviews[3], rating: 4.2 }, // Should round to 4
      ];

      const mockReviewQuery = {
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue(reviewsWithEdgeCaseRatings),
      };
      MockedReview.find.mockReturnValue(mockReviewQuery as any);

      const result = await userPreferenceService.analyzeUserPreferences(mockUserId);

      // Only valid ratings (3.7->4 and 4.2->4) should be counted
      expect(result.ratingDistribution[4]).toBe(2);
      expect(result.ratingDistribution[1]).toBe(1); // 0.5 rounds to 1
      expect(result.ratingDistribution[5]).toBe(1); // 5.5 rounds to 6, but clamped to 5
    });

    it('should test reading patterns with active reviewer threshold', async () => {
      // Create 10+ reviews to trigger active reviewer
      const manyReviews = Array.from({ length: 12 }, (_, i) => ({
        _id: `review${i}`,
        userId: mockUserId,
        bookId: {
          _id: `book${i}`,
          title: `Book ${i}`,
          author: `Author ${i}`,
          genres: ['Fiction'],
          publishedYear: 2020,
        },
        text: `Review ${i}`,
        rating: 4,
        createdAt: new Date('2023-06-01'),
      }));

      const mockReviewQuery = {
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue(manyReviews),
      };
      MockedReview.find.mockReturnValue(mockReviewQuery as any);

      const result = await userPreferenceService.analyzeUserPreferences(mockUserId);

      expect(result.readingPatterns.isActiveReviewer).toBe(true);
      expect(result.readingPatterns.isSelectiveReader).toBe(true); // avg 4.0
      expect(result.readingPatterns.hasGenrePreference).toBe(true); // all Fiction
    });

    it('should test genre preference calculation with diverse genres', async () => {
      // Create reviews with diverse genres to test hasGenrePreference = false
      const diverseGenreReviews = [
        'Fiction', 'Mystery', 'Romance', 'Thriller', 'Fantasy', 
        'Science Fiction', 'Horror', 'Biography', 'History', 'Poetry',
        'Drama', 'Comedy', 'Adventure', 'Western', 'Crime'
      ].map((genre, i) => ({
        _id: `review${i}`,
        userId: mockUserId,
        bookId: {
          _id: `book${i}`,
          title: `${genre} Book`,
          author: `Author ${i}`,
          genres: [genre],
          publishedYear: 2020,
        },
        text: `${genre} review`,
        rating: 3,
        createdAt: new Date('2023-06-01'),
      }));

      const mockReviewQuery = {
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue(diverseGenreReviews),
      };
      MockedReview.find.mockReturnValue(mockReviewQuery as any);

      const result = await userPreferenceService.analyzeUserPreferences(mockUserId);

      expect(result.readingPatterns.hasGenrePreference).toBe(false); // Many genres, no concentration
      expect(result.readingPatterns.isSelectiveReader).toBe(false); // avg 3.0 < 4.0
    });

    it('should test author analysis with insufficient data', async () => {
      // Create reviews where authors don't meet the criteria (need 2+ books with 4+ avg rating)
      const insufficientAuthorReviews = [
        {
          _id: 'review1',
          userId: mockUserId,
          bookId: {
            _id: 'book1',
            title: 'Book 1',
            author: 'Author A',
            genres: ['Fiction'],
            publishedYear: 2020,
          },
          text: 'Review 1',
          rating: 5, // Only 1 book by this author
          createdAt: new Date('2023-06-01'),
        },
        {
          _id: 'review2',
          userId: mockUserId,
          bookId: {
            _id: 'book2',
            title: 'Book 2',
            author: 'Author B',
            genres: ['Fiction'],
            publishedYear: 2020,
          },
          text: 'Review 2',
          rating: 2, // Low rating
          createdAt: new Date('2023-06-01'),
        },
        {
          _id: 'review3',
          userId: mockUserId,
          bookId: {
            _id: 'book3',
            title: 'Book 3',
            author: 'Author B',
            genres: ['Fiction'],
            publishedYear: 2020,
          },
          text: 'Review 3',
          rating: 3, // Average rating < 4
          createdAt: new Date('2023-06-01'),
        },
      ];

      const mockReviewQuery = {
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue(insufficientAuthorReviews),
      };
      MockedReview.find.mockReturnValue(mockReviewQuery as any);

      const result = await userPreferenceService.analyzeUserPreferences(mockUserId);

      expect(result.preferredAuthors).toEqual([]); // No authors meet criteria
    });
  });
});
