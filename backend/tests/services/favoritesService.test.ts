import { FavoritesService } from '../../src/services/favoritesService';
import Favorite from '../../src/models/Favorite';
import Book from '../../src/models/Book';
import { logger } from '../../src/utils/logger';

// Mock dependencies
jest.mock('../../src/models/Favorite');
jest.mock('../../src/models/Book');
jest.mock('../../src/utils/logger');

const MockedFavorite = Favorite as jest.Mocked<typeof Favorite>;
const MockedBook = Book as jest.Mocked<typeof Book>;
const mockedLogger = logger as jest.Mocked<typeof logger>;

describe('FavoritesService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getUserFavorites', () => {
    const mockFavorites = [
      {
        _id: 'fav1',
        userId: 'user1',
        bookId: 'book1',
        book: {
          _id: 'book1',
          title: 'Test Book 1',
          author: 'Test Author 1',
          coverImageUrl: 'image1.jpg',
          averageRating: 4.5,
          totalReviews: 10,
          genres: ['Fiction'],
        },
        createdAt: new Date('2023-01-01'),
      },
      {
        _id: 'fav2',
        userId: 'user1',
        bookId: 'book2',
        book: {
          _id: 'book2',
          title: 'Test Book 2',
          author: 'Test Author 2',
          coverImageUrl: 'image2.jpg',
          averageRating: 4.0,
          totalReviews: 5,
          genres: ['Mystery'],
        },
        createdAt: new Date('2023-01-02'),
      },
    ];

    beforeEach(() => {
      const mockQuery = {
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(mockFavorites),
      };

      MockedFavorite.find = jest.fn().mockReturnValue(mockQuery);
      MockedFavorite.countDocuments = jest.fn().mockResolvedValue(2);
    });

    it('should get user favorites with default pagination', async () => {
      const result = await FavoritesService.getUserFavorites('user1');

      expect(result).toEqual({
        favorites: [
          {
            id: 'fav1',
            bookId: 'book1',
            book: mockFavorites[0].book,
            createdAt: mockFavorites[0].createdAt,
          },
          {
            id: 'fav2',
            bookId: 'book2',
            book: mockFavorites[1].book,
            createdAt: mockFavorites[1].createdAt,
          },
        ],
        totalItems: 2,
        currentPage: 1,
        totalPages: 1,
        hasNextPage: false,
        hasPrevPage: false,
      });

      expect(MockedFavorite.find).toHaveBeenCalledWith({ userId: 'user1' });
      expect(MockedFavorite.countDocuments).toHaveBeenCalledWith({ userId: 'user1' });
      expect(mockedLogger.info).toHaveBeenCalledWith('Retrieved user favorites', expect.any(Object));
    });

    it('should handle pagination correctly', async () => {
      await FavoritesService.getUserFavorites('user1', 2, 5);

      const mockQuery = MockedFavorite.find({ userId: 'user1' });
      expect(mockQuery.skip).toHaveBeenCalledWith(5);
      expect(mockQuery.limit).toHaveBeenCalledWith(5);
    });

    it('should handle database errors', async () => {
      MockedFavorite.find = jest.fn().mockImplementation(() => {
        throw new Error('Database error');
      });

      await expect(FavoritesService.getUserFavorites('user1')).rejects.toThrow(
        'Failed to retrieve user favorites'
      );
      expect(mockedLogger.error).toHaveBeenCalledWith('Error in getUserFavorites service:', expect.any(Error));
    });
  });

  describe('addToFavorites', () => {
    const mockBook = {
      _id: 'book1',
      title: 'Test Book',
      author: 'Test Author',
    };

    const mockFavorite = {
      _id: 'fav1',
      userId: 'user1',
      bookId: 'book1',
      createdAt: new Date(),
      save: jest.fn().mockResolvedValue(undefined),
    };

    beforeEach(() => {
      const mockBookQuery = {
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(mockBook),
      };

      const mockFavoriteQuery = {
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(null),
      };

      const mockPopulatedQuery = {
        populate: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue({
          _id: 'fav1',
          bookId: 'book1',
          book: mockBook,
          createdAt: mockFavorite.createdAt,
        }),
      };

      MockedBook.findById = jest.fn().mockReturnValue(mockBookQuery);
      MockedFavorite.findOne = jest.fn().mockReturnValue(mockFavoriteQuery);
      MockedFavorite.findById = jest.fn().mockReturnValue(mockPopulatedQuery);
      (MockedFavorite as any).mockImplementation(() => mockFavorite);
    });

    it('should add book to favorites successfully', async () => {
      const result = await FavoritesService.addToFavorites('user1', 'book1');

      expect(result.success).toBe(true);
      expect(result.message).toBe('Book added to favorites successfully');
      expect(result.favorite).toEqual({
        id: 'fav1',
        bookId: 'book1',
        book: mockBook,
        createdAt: mockFavorite.createdAt,
      });

      expect(MockedBook.findById).toHaveBeenCalledWith('book1');
      expect(MockedFavorite.findOne).toHaveBeenCalledWith({ userId: 'user1', bookId: 'book1' });
      expect(mockFavorite.save).toHaveBeenCalled();
      expect(mockedLogger.info).toHaveBeenCalledWith('Book added to favorites', expect.any(Object));
    });

    it('should return error when book not found', async () => {
      const mockBookQuery = {
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(null),
      };
      MockedBook.findById = jest.fn().mockReturnValue(mockBookQuery);

      const result = await FavoritesService.addToFavorites('user1', 'nonexistent');

      expect(result.success).toBe(false);
      expect(result.message).toBe('Book not found');
      expect(result.error).toBe('BOOK_NOT_FOUND');
    });

    it('should return error when book already favorited', async () => {
      const mockFavoriteQuery = {
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue({ _id: 'existing-fav' }),
      };
      MockedFavorite.findOne = jest.fn().mockReturnValue(mockFavoriteQuery);

      const result = await FavoritesService.addToFavorites('user1', 'book1');

      expect(result.success).toBe(false);
      expect(result.message).toBe('Book is already in your favorites');
      expect(result.error).toBe('ALREADY_FAVORITED');
    });

    it('should handle MongoDB duplicate key error', async () => {
      const duplicateError = new Error('E11000 duplicate key error');
      (MockedFavorite as any).mockImplementation(() => {
        throw duplicateError;
      });

      const result = await FavoritesService.addToFavorites('user1', 'book1');

      expect(result.success).toBe(false);
      expect(result.message).toBe('Book is already in your favorites');
      expect(result.error).toBe('DUPLICATE_FAVORITE');
    });

    it('should handle other database errors', async () => {
      MockedBook.findById = jest.fn().mockImplementation(() => {
        throw new Error('Database error');
      });

      await expect(FavoritesService.addToFavorites('user1', 'book1')).rejects.toThrow(
        'Failed to add book to favorites'
      );
      expect(mockedLogger.error).toHaveBeenCalledWith('Error in addToFavorites service:', expect.any(Error));
    });
  });

  describe('removeFromFavorites', () => {
    const mockRemovedFavorite = {
      _id: 'fav1',
      userId: 'user1',
      bookId: 'book1',
      createdAt: new Date(),
    };

    beforeEach(() => {
      const mockQuery = {
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(mockRemovedFavorite),
      };
      MockedFavorite.findOneAndDelete = jest.fn().mockReturnValue(mockQuery);
    });

    it('should remove book from favorites successfully', async () => {
      const result = await FavoritesService.removeFromFavorites('user1', 'book1');

      expect(result.success).toBe(true);
      expect(result.message).toBe('Book removed from favorites successfully');
      expect(result.favorite).toEqual({
        id: 'fav1',
        bookId: 'book1',
        createdAt: mockRemovedFavorite.createdAt,
      });

      expect(MockedFavorite.findOneAndDelete).toHaveBeenCalledWith({ userId: 'user1', bookId: 'book1' });
      expect(mockedLogger.info).toHaveBeenCalledWith('Book removed from favorites', expect.any(Object));
    });

    it('should return error when favorite not found', async () => {
      const mockQuery = {
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(null),
      };
      MockedFavorite.findOneAndDelete = jest.fn().mockReturnValue(mockQuery);

      const result = await FavoritesService.removeFromFavorites('user1', 'book1');

      expect(result.success).toBe(false);
      expect(result.message).toBe('Favorite not found');
      expect(result.error).toBe('FAVORITE_NOT_FOUND');
    });

    it('should handle database errors', async () => {
      MockedFavorite.findOneAndDelete = jest.fn().mockImplementation(() => {
        throw new Error('Database error');
      });

      await expect(FavoritesService.removeFromFavorites('user1', 'book1')).rejects.toThrow(
        'Failed to remove book from favorites'
      );
      expect(mockedLogger.error).toHaveBeenCalledWith('Error in removeFromFavorites service:', expect.any(Error));
    });
  });

  describe('checkFavoriteStatus', () => {
    beforeEach(() => {
      const mockQuery = {
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn(),
      };
      MockedFavorite.findOne = jest.fn().mockReturnValue(mockQuery);
    });

    it('should return true when book is favorited', async () => {
      const mockQuery = MockedFavorite.findOne({ userId: 'user1', bookId: 'book1' });
      mockQuery.exec = jest.fn().mockResolvedValue({ _id: 'fav1' });

      const result = await FavoritesService.checkFavoriteStatus('user1', 'book1');

      expect(result).toBe(true);
      expect(MockedFavorite.findOne).toHaveBeenCalledWith({ userId: 'user1', bookId: 'book1' });
    });

    it('should return false when book is not favorited', async () => {
      const mockQuery = MockedFavorite.findOne({ userId: 'user1', bookId: 'book1' });
      mockQuery.exec = jest.fn().mockResolvedValue(null);

      const result = await FavoritesService.checkFavoriteStatus('user1', 'book1');

      expect(result).toBe(false);
    });

    it('should handle database errors', async () => {
      MockedFavorite.findOne = jest.fn().mockImplementation(() => {
        throw new Error('Database error');
      });

      await expect(FavoritesService.checkFavoriteStatus('user1', 'book1')).rejects.toThrow(
        'Failed to check favorite status'
      );
      expect(mockedLogger.error).toHaveBeenCalledWith('Error in checkFavoriteStatus service:', expect.any(Error));
    });
  });

  describe('getFavoritesStats', () => {
    const mockGenreStats = [
      { _id: 'Fiction', count: 5 },
      { _id: 'Mystery', count: 3 },
    ];

    const mockRecentFavorites = [
      {
        _id: 'fav1',
        bookId: 'book1',
        book: { title: 'Recent Book 1', author: 'Author 1' },
        createdAt: new Date(),
      },
    ];

    beforeEach(() => {
      MockedFavorite.countDocuments = jest.fn().mockResolvedValue(8);
      MockedFavorite.aggregate = jest.fn().mockResolvedValue(mockGenreStats);

      const mockQuery = {
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(mockRecentFavorites),
      };
      MockedFavorite.find = jest.fn().mockReturnValue(mockQuery);
    });

    it('should get favorites statistics successfully', async () => {
      const result = await FavoritesService.getFavoritesStats('user1');

      expect(result).toEqual({
        totalFavorites: 8,
        favoriteGenres: [
          { genre: 'Fiction', count: 5 },
          { genre: 'Mystery', count: 3 },
        ],
        recentFavorites: [
          {
            id: 'fav1',
            bookId: 'book1',
            book: { title: 'Recent Book 1', author: 'Author 1' },
            createdAt: mockRecentFavorites[0].createdAt,
          },
        ],
      });

      expect(MockedFavorite.countDocuments).toHaveBeenCalledWith({ userId: 'user1' });
      expect(MockedFavorite.aggregate).toHaveBeenCalledWith(expect.arrayContaining([
        { $match: { userId: 'user1' } },
      ]));
      expect(mockedLogger.info).toHaveBeenCalledWith('Retrieved favorites stats', expect.any(Object));
    });

    it('should handle database errors', async () => {
      MockedFavorite.countDocuments = jest.fn().mockRejectedValue(new Error('Database error'));

      await expect(FavoritesService.getFavoritesStats('user1')).rejects.toThrow(
        'Failed to retrieve favorites statistics'
      );
      expect(mockedLogger.error).toHaveBeenCalledWith('Error in getFavoritesStats service:', expect.any(Error));
    });
  });

  describe('toggleFavorite', () => {
    const mockBook = {
      _id: 'book1',
      title: 'Test Book',
    };

    beforeEach(() => {
      const mockBookQuery = {
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(mockBook),
      };
      MockedBook.findById = jest.fn().mockReturnValue(mockBookQuery);
    });

    it('should add favorite when not exists', async () => {
      const mockFavoriteQuery = {
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(null),
      };
      MockedFavorite.findOne = jest.fn().mockReturnValue(mockFavoriteQuery);

      const mockFavorite = {
        _id: 'fav1',
        userId: 'user1',
        bookId: 'book1',
        createdAt: new Date(),
        save: jest.fn().mockResolvedValue(undefined),
      };

      const mockPopulatedQuery = {
        populate: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue({
          _id: 'fav1',
          bookId: 'book1',
          book: mockBook,
          createdAt: mockFavorite.createdAt,
        }),
      };

      MockedFavorite.findById = jest.fn().mockReturnValue(mockPopulatedQuery);
      (MockedFavorite as any).mockImplementation(() => mockFavorite);

      const result = await FavoritesService.toggleFavorite('user1', 'book1');

      expect(result.success).toBe(true);
      expect(result.message).toBe('Book added to favorites');
      expect(mockFavorite.save).toHaveBeenCalled();
      expect(mockedLogger.info).toHaveBeenCalledWith('Favorite toggled - added', expect.any(Object));
    });

    it('should remove favorite when exists', async () => {
      const existingFavorite = {
        _id: 'fav1',
        userId: 'user1',
        bookId: 'book1',
        createdAt: new Date(),
      };

      const mockFavoriteQuery = {
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(existingFavorite),
      };
      MockedFavorite.findOne = jest.fn().mockReturnValue(mockFavoriteQuery);
      MockedFavorite.findByIdAndDelete = jest.fn().mockResolvedValue(existingFavorite);

      const result = await FavoritesService.toggleFavorite('user1', 'book1');

      expect(result.success).toBe(true);
      expect(result.message).toBe('Book removed from favorites');
      expect(MockedFavorite.findByIdAndDelete).toHaveBeenCalledWith('fav1');
      expect(mockedLogger.info).toHaveBeenCalledWith('Favorite toggled - removed', expect.any(Object));
    });

    it('should return error when book not found', async () => {
      const mockBookQuery = {
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(null),
      };
      MockedBook.findById = jest.fn().mockReturnValue(mockBookQuery);

      const result = await FavoritesService.toggleFavorite('user1', 'nonexistent');

      expect(result.success).toBe(false);
      expect(result.message).toBe('Book not found');
      expect(result.error).toBe('BOOK_NOT_FOUND');
    });

    it('should handle database errors', async () => {
      MockedBook.findById = jest.fn().mockImplementation(() => {
        throw new Error('Database error');
      });

      await expect(FavoritesService.toggleFavorite('user1', 'book1')).rejects.toThrow(
        'Failed to toggle favorite status'
      );
      expect(mockedLogger.error).toHaveBeenCalledWith('Error in toggleFavorite service:', expect.any(Error));
    });
  });

  describe('getPopularBooks', () => {
    const mockPopularBooks = [
      {
        bookId: 'book1',
        favoriteCount: 10,
        book: {
          _id: 'book1',
          title: 'Popular Book 1',
          author: 'Author 1',
          averageRating: 4.5,
        },
      },
      {
        bookId: 'book2',
        favoriteCount: 8,
        book: {
          _id: 'book2',
          title: 'Popular Book 2',
          author: 'Author 2',
          averageRating: 4.2,
        },
      },
    ];

    beforeEach(() => {
      MockedFavorite.aggregate = jest.fn().mockResolvedValue(mockPopularBooks);
    });

    it('should get popular books successfully', async () => {
      const result = await FavoritesService.getPopularBooks(5);

      expect(result).toEqual(mockPopularBooks);
      expect(MockedFavorite.aggregate).toHaveBeenCalledWith(expect.arrayContaining([
        { $group: { _id: '$bookId', favoriteCount: { $sum: 1 } } },
        { $sort: { favoriteCount: -1 } },
        { $limit: 5 },
      ]));
      expect(mockedLogger.info).toHaveBeenCalledWith('Retrieved popular books by favorites', expect.any(Object));
    });

    it('should use default limit when not provided', async () => {
      await FavoritesService.getPopularBooks();

      expect(MockedFavorite.aggregate).toHaveBeenCalledWith(expect.arrayContaining([
        { $limit: 10 },
      ]));
    });

    it('should handle database errors', async () => {
      MockedFavorite.aggregate = jest.fn().mockRejectedValue(new Error('Database error'));

      await expect(FavoritesService.getPopularBooks()).rejects.toThrow('Failed to retrieve popular books');
      expect(mockedLogger.error).toHaveBeenCalledWith('Error in getPopularBooks service:', expect.any(Error));
    });
  });

  describe('bulkFavoritesOperation', () => {
    beforeEach(() => {
      // Mock the static methods
      jest.spyOn(FavoritesService, 'addToFavorites').mockResolvedValue({
        success: true,
        message: 'Added successfully',
      });
      jest.spyOn(FavoritesService, 'removeFromFavorites').mockResolvedValue({
        success: true,
        message: 'Removed successfully',
      });
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('should perform bulk add operation successfully', async () => {
      const bookIds = ['book1', 'book2', 'book3'];
      const result = await FavoritesService.bulkFavoritesOperation('user1', bookIds, 'add');

      expect(result).toEqual({
        success: true,
        processed: 3,
        errors: [],
      });

      expect(FavoritesService.addToFavorites).toHaveBeenCalledTimes(3);
      expect(mockedLogger.info).toHaveBeenCalledWith('Bulk favorites operation completed', expect.any(Object));
    });

    it('should perform bulk remove operation successfully', async () => {
      const bookIds = ['book1', 'book2'];
      const result = await FavoritesService.bulkFavoritesOperation('user1', bookIds, 'remove');

      expect(result).toEqual({
        success: true,
        processed: 2,
        errors: [],
      });

      expect(FavoritesService.removeFromFavorites).toHaveBeenCalledTimes(2);
    });

    it('should handle partial failures in bulk operation', async () => {
      jest.spyOn(FavoritesService, 'addToFavorites')
        .mockResolvedValueOnce({ success: true, message: 'Success' })
        .mockResolvedValueOnce({ success: false, message: 'Already exists', error: 'ALREADY_FAVORITED' })
        .mockResolvedValueOnce({ success: true, message: 'Success' });

      const bookIds = ['book1', 'book2', 'book3'];
      const result = await FavoritesService.bulkFavoritesOperation('user1', bookIds, 'add');

      expect(result).toEqual({
        success: false,
        processed: 2,
        errors: [{ bookId: 'book2', error: 'ALREADY_FAVORITED' }],
      });
    });

    it('should handle exceptions in bulk operation', async () => {
      jest.spyOn(FavoritesService, 'addToFavorites')
        .mockResolvedValueOnce({ success: true, message: 'Success' })
        .mockRejectedValueOnce(new Error('Database error'))
        .mockResolvedValueOnce({ success: true, message: 'Success' });

      const bookIds = ['book1', 'book2', 'book3'];
      const result = await FavoritesService.bulkFavoritesOperation('user1', bookIds, 'add');

      expect(result).toEqual({
        success: false,
        processed: 2,
        errors: [{ bookId: 'book2', error: 'Database error' }],
      });
    });

    it('should handle database errors in bulk operation', async () => {
      jest.spyOn(FavoritesService, 'addToFavorites').mockImplementation(() => {
        throw new Error('Database error');
      });

      await expect(
        FavoritesService.bulkFavoritesOperation('user1', ['book1'], 'add')
      ).rejects.toThrow('Failed to perform bulk favorites operation');
      expect(mockedLogger.error).toHaveBeenCalledWith('Error in bulkFavoritesOperation service:', expect.any(Error));
    });
  });
});
