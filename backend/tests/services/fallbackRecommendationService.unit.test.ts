import fallbackRecommendationService from '../../src/services/fallbackRecommendationService';
import Book from '../../src/models/Book';
import Review from '../../src/models/Review';
import Favorite from '../../src/models/Favorite';
import { logger } from '../../src/utils/logger';
import { Types } from 'mongoose';

// Mock all dependencies
jest.mock('../../src/models/Book');
jest.mock('../../src/models/Review');
jest.mock('../../src/models/Favorite');
jest.mock('../../src/utils/logger');

const MockedBook = Book as jest.Mocked<typeof Book>;
const MockedReview = Review as jest.Mocked<typeof Review>;
const MockedFavorite = Favorite as jest.Mocked<typeof Favorite>;
const MockedLogger = logger as jest.Mocked<typeof logger>;

describe('FallbackRecommendationService Unit Tests', () => {
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

  const mockBooksWithStats = [
    {
      _id: new Types.ObjectId(),
      title: 'Fiction Book 1',
      author: 'Fiction Author 1',
      genres: ['Fiction'],
      publishedYear: 2020,
      description: 'A great fiction book',
      averageRating: 4.5,
      reviewCount: 25,
    },
    {
      _id: new Types.ObjectId(),
      title: 'Mystery Book 1',
      author: 'Mystery Author 1',
      genres: ['Mystery'],
      publishedYear: 2021,
      description: 'A thrilling mystery',
      averageRating: 4.3,
      reviewCount: 30,
    },
    {
      _id: new Types.ObjectId(),
      title: 'Highly Rated Book',
      author: 'Popular Author',
      genres: ['Drama'],
      publishedYear: 2019,
      description: 'Critically acclaimed',
      averageRating: 4.8,
      reviewCount: 100,
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup default mocks
    const mockReviewQuery = {
      select: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue([]),
    };
    MockedReview.find.mockReturnValue(mockReviewQuery as any);

    const mockFavoriteQuery = {
      select: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue([]),
    };
    MockedFavorite.find.mockReturnValue(mockFavoriteQuery as any);

    MockedBook.aggregate.mockResolvedValue(mockBooksWithStats);
    MockedBook.find.mockReturnValue({
      lean: jest.fn().mockResolvedValue([]),
    } as any);

    MockedReview.aggregate.mockResolvedValue([]);
  });

  describe('generateRecommendations', () => {
    it('should generate recommendations using genre-based strategy', async () => {
      const result = await fallbackRecommendationService.generateRecommendations(
        mockUserId,
        mockUserPreferences
      );

      expect(result).toBeInstanceOf(Array);
      expect(result.length).toBeGreaterThan(0);
      expect(result.length).toBeLessThanOrEqual(3);

      // Check recommendation structure
      const rec = result[0];
      expect(rec).toHaveProperty('title');
      expect(rec).toHaveProperty('author');
      expect(rec).toHaveProperty('genre');
      expect(rec).toHaveProperty('reason');
      expect(rec).toHaveProperty('confidence');
      expect(rec).toHaveProperty('averageRating');
      expect(rec).toHaveProperty('reviewCount');

      expect(rec.confidence).toBeGreaterThan(0);
      expect(rec.confidence).toBeLessThanOrEqual(1);

      expect(MockedLogger.info).toHaveBeenCalledWith('Generating fallback recommendations', { userId: mockUserId });
      expect(MockedLogger.info).toHaveBeenCalledWith('Fallback recommendations generated', expect.any(Object));
    });

    it('should handle UUID format user IDs', async () => {
      const uuidUserId = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';
      
      const result = await fallbackRecommendationService.generateRecommendations(
        uuidUserId,
        mockUserPreferences
      );

      expect(result).toBeInstanceOf(Array);
      expect(MockedLogger.warn).toHaveBeenCalledWith(
        'UserId is not a valid ObjectId, using string format:',
        { userId: uuidUserId }
      );
    });

    it('should exclude user\'s existing books', async () => {
      const userReviews = [
        { bookId: mockBooksWithStats[0]._id },
        { bookId: mockBooksWithStats[1]._id },
      ];

      const mockReviewQueryWithData = {
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue(userReviews),
      };
      MockedReview.find.mockReturnValue(mockReviewQueryWithData as any);

      // Mock aggregate to return books that should be filtered out
      MockedBook.aggregate.mockResolvedValue([mockBooksWithStats[2]]); // Only return the third book

      const result = await fallbackRecommendationService.generateRecommendations(
        mockUserId,
        mockUserPreferences
      );

      expect(result).toBeInstanceOf(Array);
      // Should not include the user's already reviewed books
      expect(result.every(rec => rec.title !== 'Fiction Book 1')).toBe(true);
      expect(result.every(rec => rec.title !== 'Mystery Book 1')).toBe(true);
    });

    it('should exclude books by string matching', async () => {
      const excludeBooks = ['Fiction Book 1 by Fiction Author 1'];

      const result = await fallbackRecommendationService.generateRecommendations(
        mockUserId,
        mockUserPreferences,
        excludeBooks
      );

      expect(result).toBeInstanceOf(Array);
      // Should not include excluded books
      expect(result.every(rec => 
        `${rec.title} by ${rec.author}` !== 'Fiction Book 1 by Fiction Author 1'
      )).toBe(true);
    });

    it('should handle user with no favorite genres', async () => {
      const preferencesWithoutGenres = {
        ...mockUserPreferences,
        favoriteGenres: [],
      };

      const result = await fallbackRecommendationService.generateRecommendations(
        mockUserId,
        preferencesWithoutGenres
      );

      expect(result).toBeInstanceOf(Array);
      // Should still return recommendations using other strategies
      expect(result.length).toBeGreaterThan(0);
    });

    it('should use multiple strategies to reach 3 recommendations', async () => {
      // Mock limited results for each strategy
      MockedBook.aggregate
        .mockResolvedValueOnce([mockBooksWithStats[0]]) // Genre-based: 1 book
        .mockResolvedValueOnce([mockBooksWithStats[1]]) // Highly rated: 1 book  
        .mockResolvedValueOnce([mockBooksWithStats[2]]); // Popular: 1 book

      const result = await fallbackRecommendationService.generateRecommendations(
        mockUserId,
        mockUserPreferences
      );

      expect(result).toBeInstanceOf(Array);
      expect(result.length).toBe(3);
      expect(MockedBook.aggregate).toHaveBeenCalledTimes(3);
    });

    it('should sort recommendations by confidence', async () => {
      const booksWithDifferentRatings = [
        { ...mockBooksWithStats[0], averageRating: 3.5, reviewCount: 10 }, // Lower confidence
        { ...mockBooksWithStats[1], averageRating: 4.8, reviewCount: 100 }, // Higher confidence
        { ...mockBooksWithStats[2], averageRating: 4.0, reviewCount: 50 }, // Medium confidence
      ];

      MockedBook.aggregate.mockResolvedValue(booksWithDifferentRatings);

      const result = await fallbackRecommendationService.generateRecommendations(
        mockUserId,
        mockUserPreferences
      );

      expect(result).toBeInstanceOf(Array);
      expect(result.length).toBeGreaterThan(1);
      
      // Should be sorted by confidence (descending)
      for (let i = 0; i < result.length - 1; i++) {
        expect(result[i].confidence).toBeGreaterThanOrEqual(result[i + 1].confidence);
      }
    });

    it('should handle errors gracefully', async () => {
      MockedBook.aggregate.mockRejectedValue(new Error('Database error'));

      await expect(
        fallbackRecommendationService.generateRecommendations(mockUserId, mockUserPreferences)
      ).rejects.toThrow('Database error');

      expect(MockedLogger.error).toHaveBeenCalledWith(
        'Error generating fallback recommendations:',
        expect.objectContaining({
          error: 'Database error',
          userId: mockUserId,
        })
      );
    });
  });

  describe('Genre-based recommendations', () => {
    it('should prioritize books in user\'s favorite genres', async () => {
      const genreBooks = [
        { ...mockBooksWithStats[0], genres: ['Fiction'] },
        { ...mockBooksWithStats[1], genres: ['Mystery'] },
      ];

      MockedBook.aggregate.mockResolvedValue(genreBooks);

      const result = await fallbackRecommendationService.generateRecommendations(
        mockUserId,
        mockUserPreferences
      );

      expect(result).toBeInstanceOf(Array);
      expect(result.length).toBeGreaterThan(0);
      
      // Should include books from favorite genres
      const genres = result.map(rec => rec.genre).filter((genre): genre is string => genre !== undefined);
      expect(genres.some(genre => ['Fiction', 'Mystery'].includes(genre))).toBe(true);
    });

    it('should calculate genre confidence correctly', async () => {
      const highRatedGenreBook = {
        ...mockBooksWithStats[0],
        genres: ['Fiction'], // User's favorite genre
        averageRating: 4.6,
        reviewCount: 60,
      };

      MockedBook.aggregate.mockResolvedValue([highRatedGenreBook]);

      const result = await fallbackRecommendationService.generateRecommendations(
        mockUserId,
        mockUserPreferences
      );

      expect(result).toBeInstanceOf(Array);
      expect(result.length).toBeGreaterThan(0);
      
      const rec = result[0];
      expect(rec.confidence).toBeGreaterThan(0.6); // Base genre confidence
      expect(rec.reason).toContain('you enjoy Fiction books');
    });
  });

  describe('Highly rated recommendations', () => {
    it('should recommend books with high ratings and sufficient reviews', async () => {
      MockedBook.aggregate
        .mockResolvedValueOnce([]) // No genre-based results
        .mockResolvedValueOnce([{ // Highly rated results
          ...mockBooksWithStats[2],
          averageRating: 4.7,
          reviewCount: 50,
        }]);

      const result = await fallbackRecommendationService.generateRecommendations(
        mockUserId,
        mockUserPreferences
      );

      expect(result).toBeInstanceOf(Array);
      expect(result.length).toBeGreaterThan(0);
      
      const rec = result[0];
      expect(rec.reason).toContain('Highly rated book');
      expect(rec.reason).toContain('4.7/5.0 stars');
    });

    it('should boost confidence for selective readers', async () => {
      const selectiveUserPrefs = {
        ...mockUserPreferences,
        readingPatterns: {
          ...mockUserPreferences.readingPatterns,
          isSelectiveReader: true,
        },
      };

      MockedBook.aggregate
        .mockResolvedValueOnce([]) // No genre-based results
        .mockResolvedValueOnce([{
          ...mockBooksWithStats[0],
          averageRating: 4.2,
          reviewCount: 25,
        }]);

      const result = await fallbackRecommendationService.generateRecommendations(
        mockUserId,
        selectiveUserPrefs
      );

      expect(result).toBeInstanceOf(Array);
      expect(result.length).toBeGreaterThan(0);
      
      // Confidence should be boosted for selective readers
      const rec = result[0];
      expect(rec.confidence).toBeGreaterThan(0.5);
    });
  });

  describe('Popular recommendations', () => {
    it('should recommend popular books with many reviews', async () => {
      MockedBook.aggregate
        .mockResolvedValueOnce([]) // No genre-based results
        .mockResolvedValueOnce([]) // No highly rated results
        .mockResolvedValueOnce([{ // Popular results
          ...mockBooksWithStats[0],
          reviewCount: 150,
          averageRating: 4.1,
        }]);

      const result = await fallbackRecommendationService.generateRecommendations(
        mockUserId,
        mockUserPreferences
      );

      expect(result).toBeInstanceOf(Array);
      expect(result.length).toBeGreaterThan(0);
      
      const rec = result[0];
      expect(rec.reason).toContain('Popular choice');
      expect(rec.reason).toContain('150 reviews');
    });

    it('should work without favorite genres', async () => {
      const preferencesWithoutGenres = {
        ...mockUserPreferences,
        favoriteGenres: [],
      };

      MockedBook.aggregate
        .mockResolvedValueOnce([]) // No genre-based results
        .mockResolvedValueOnce([]) // No highly rated results
        .mockResolvedValueOnce([mockBooksWithStats[0]]); // Popular results

      const result = await fallbackRecommendationService.generateRecommendations(
        mockUserId,
        preferencesWithoutGenres
      );

      expect(result).toBeInstanceOf(Array);
      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe('Collaborative filtering recommendations', () => {
    it('should find similar users and recommend their liked books', async () => {
      const similarUsers = [
        { _id: new Types.ObjectId(), commonGenreBooks: 5, avgRating: 4.1 },
        { _id: new Types.ObjectId(), commonGenreBooks: 4, avgRating: 4.3 },
      ];

      const similarUserReviews = [
        { bookId: mockBooksWithStats[0]._id, rating: 4.5 },
        { bookId: mockBooksWithStats[0]._id, rating: 4.2 },
        { bookId: mockBooksWithStats[1]._id, rating: 4.8 },
      ];

      MockedBook.aggregate
        .mockResolvedValueOnce([]) // No genre-based results
        .mockResolvedValueOnce([]) // No highly rated results
        .mockResolvedValueOnce([]); // No popular results

      MockedReview.aggregate.mockResolvedValue(similarUsers);
      MockedReview.find.mockReturnValue({
        lean: jest.fn().mockResolvedValue(similarUserReviews),
      } as any);

      MockedBook.find.mockReturnValue({
        lean: jest.fn().mockResolvedValue([
          mockBooksWithStats[0],
          mockBooksWithStats[1],
        ]),
      } as any);

      const result = await fallbackRecommendationService.generateRecommendations(
        mockUserId,
        mockUserPreferences
      );

      expect(result).toBeInstanceOf(Array);
      expect(result.length).toBeGreaterThan(0);
      
      if (result.length > 0) {
        const rec = result[0];
        expect(rec.reason).toContain('readers with similar preferences');
      }
    });

    it('should handle collaborative filtering errors gracefully', async () => {
      MockedBook.aggregate
        .mockResolvedValueOnce([]) // No genre-based results
        .mockResolvedValueOnce([]) // No highly rated results
        .mockResolvedValueOnce([]) // No popular results
        .mockResolvedValueOnce([mockBooksWithStats[0]]); // Additional results

      MockedReview.aggregate.mockRejectedValue(new Error('Collaborative filtering error'));

      const result = await fallbackRecommendationService.generateRecommendations(
        mockUserId,
        mockUserPreferences
      );

      expect(result).toBeInstanceOf(Array);
      // May be 0 if all strategies fail, which is expected
      expect(MockedLogger.error).toHaveBeenCalledWith(
        'Error getting similar user recommendations:',
        expect.any(Error)
      );
    });
  });

  describe('Additional recommendations (fallback)', () => {
    it('should provide generic recommendations as last resort', async () => {
      // Mock all strategies returning empty results
      MockedBook.aggregate
        .mockResolvedValueOnce([]) // No genre-based results
        .mockResolvedValueOnce([]) // No highly rated results
        .mockResolvedValueOnce([]) // No popular results
        .mockResolvedValueOnce([mockBooksWithStats[0]]); // Additional results

      MockedReview.aggregate.mockResolvedValue([]); // No similar users

      const result = await fallbackRecommendationService.generateRecommendations(
        mockUserId,
        mockUserPreferences
      );

      expect(result).toBeInstanceOf(Array);
      expect(result.length).toBeGreaterThan(0);
      
      const rec = result[0];
      expect(rec.confidence).toBeGreaterThan(0); // Should have some confidence
      expect(rec.reason).toBeDefined(); // Should have a reason
    });
  });

  describe('Confidence calculation methods', () => {
    it('should calculate genre confidence with all boosts', async () => {
      const perfectGenreBook = {
        ...mockBooksWithStats[0],
        genres: ['Fiction'], // Favorite genre
        averageRating: 4.6, // High rating
        reviewCount: 60, // Many reviews
      };

      MockedBook.aggregate.mockResolvedValue([perfectGenreBook]);

      const result = await fallbackRecommendationService.generateRecommendations(
        mockUserId,
        mockUserPreferences
      );

      expect(result).toBeInstanceOf(Array);
      expect(result.length).toBeGreaterThan(0);
      
      const rec = result[0];
      // Should have high confidence due to genre match and high rating
      expect(rec.confidence).toBeGreaterThan(0.6);
    });

    it('should calculate rating confidence correctly', async () => {
      MockedBook.aggregate
        .mockResolvedValueOnce([]) // No genre-based results
        .mockResolvedValueOnce([{
          ...mockBooksWithStats[0],
          genres: ['Fiction'], // Matching genre
          averageRating: 4.7, // Very high rating
          reviewCount: 25,
        }]);

      const result = await fallbackRecommendationService.generateRecommendations(
        mockUserId,
        mockUserPreferences
      );

      expect(result).toBeInstanceOf(Array);
      expect(result.length).toBeGreaterThan(0);
      
      const rec = result[0];
      // Should have high confidence due to rating and genre match
      expect(rec.confidence).toBeGreaterThan(0.7);
    });

    it('should calculate popularity confidence with review count boost', async () => {
      MockedBook.aggregate
        .mockResolvedValueOnce([]) // No genre-based results
        .mockResolvedValueOnce([]) // No highly rated results
        .mockResolvedValueOnce([{
          ...mockBooksWithStats[0],
          genres: ['Fiction'], // Matching genre
          averageRating: 4.2, // Good rating
          reviewCount: 120, // Many reviews
        }]);

      const result = await fallbackRecommendationService.generateRecommendations(
        mockUserId,
        mockUserPreferences
      );

      expect(result).toBeInstanceOf(Array);
      expect(result.length).toBeGreaterThan(0);
      
      const rec = result[0];
      // Base 0.4 + genre 0.2 + reviews 0.1 + rating 0.1 = 0.8, capped at 0.75
      expect(rec.confidence).toBeCloseTo(0.75, 1);
    });
  });

  describe('Edge cases and error handling', () => {
    it('should handle empty database results', async () => {
      MockedBook.aggregate.mockResolvedValue([]);
      MockedReview.aggregate.mockResolvedValue([]);

      const result = await fallbackRecommendationService.generateRecommendations(
        mockUserId,
        mockUserPreferences
      );

      expect(result).toBeInstanceOf(Array);
      expect(result.length).toBe(0);
    });

    it('should handle books without genres', async () => {
      const booksWithoutGenres = [{
        ...mockBooksWithStats[0],
        genres: [],
      }];

      MockedBook.aggregate.mockResolvedValue(booksWithoutGenres);

      const result = await fallbackRecommendationService.generateRecommendations(
        mockUserId,
        mockUserPreferences
      );

      expect(result).toBeInstanceOf(Array);
      expect(result.length).toBeGreaterThan(0);
      
      const rec = result[0];
      // Genre may be undefined or 'Unknown' for books without genres
      expect(rec).toHaveProperty('genre');
    });

    it('should handle case-insensitive book exclusion', async () => {
      const excludeBooks = ['FICTION BOOK 1 BY FICTION AUTHOR 1'];

      const result = await fallbackRecommendationService.generateRecommendations(
        mockUserId,
        mockUserPreferences,
        excludeBooks
      );

      expect(result).toBeInstanceOf(Array);
      // Should exclude the book regardless of case
      expect(result.every(rec => 
        `${rec.title} by ${rec.author}`.toLowerCase() !== 'fiction book 1 by fiction author 1'
      )).toBe(true);
    });

    it('should limit results to maximum 3 recommendations', async () => {
      const manyBooks = Array.from({ length: 10 }, (_, i) => ({
        ...mockBooksWithStats[0],
        _id: new Types.ObjectId(),
        title: `Book ${i + 1}`,
        author: `Author ${i + 1}`,
      }));

      MockedBook.aggregate.mockResolvedValue(manyBooks);

      const result = await fallbackRecommendationService.generateRecommendations(
        mockUserId,
        mockUserPreferences
      );

      expect(result).toBeInstanceOf(Array);
      expect(result.length).toBeLessThanOrEqual(3);
    });
  });

  describe('Database query optimization', () => {
    it('should use efficient aggregation pipelines', async () => {
      await fallbackRecommendationService.generateRecommendations(
        mockUserId,
        mockUserPreferences
      );

      // Should use aggregation for efficient statistics calculation
      expect(MockedBook.aggregate).toHaveBeenCalled();
      
      // Check that aggregation pipeline includes necessary stages
      const aggregationCalls = MockedBook.aggregate.mock.calls;
      expect(aggregationCalls.length).toBeGreaterThan(0);
      
      // Each call should be an array (aggregation pipeline)
      aggregationCalls.forEach(call => {
        expect(Array.isArray(call[0])).toBe(true);
      });
    });

    it('should limit query results for performance', async () => {
      await fallbackRecommendationService.generateRecommendations(
        mockUserId,
        mockUserPreferences
      );

      // Verify that aggregation pipelines include $limit stage
      const aggregationCalls = MockedBook.aggregate.mock.calls;
      aggregationCalls.forEach(call => {
        const pipeline = call[0];
        const hasLimit = pipeline.some((stage: any) => stage.$limit !== undefined);
        expect(hasLimit).toBe(true);
      });
    });
  });
});
