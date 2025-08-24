import { BooksService, BookSearchOptions, BookReviewsOptions } from '../../src/services/booksService';
import Book, { IBook } from '../../src/models/Book';
import Review from '../../src/models/Review';
import { logger } from '../../src/utils/logger';

// Mock VALID_GENRES since it's not exported from the service
const VALID_GENRES = [
  'Fiction',
  'Non-Fiction',
  'Mystery',
  'Thriller',
  'Romance',
  'Science Fiction',
  'Fantasy',
  'Horror',
  'Biography',
  'History',
  'Self-Help',
  'Business',
  'Health',
  'Travel',
  'Cooking',
  'Art',
  'Poetry',
  'Drama',
  'Adventure',
  'Young Adult',
  'Children',
  'Philosophy',
  'Religion',
  'Politics',
  'Science',
  'Technology',
];

// Mock dependencies
jest.mock('../../src/models/Book');
jest.mock('../../src/models/Review');
jest.mock('../../src/utils/logger');

// Mock the VALID_GENRES import in the service
jest.mock('../../src/models/Book', () => {
  const originalModule = jest.requireActual('../../src/models/Book');
  return {
    ...originalModule,
    VALID_GENRES: [
      'Fiction',
      'Non-Fiction',
      'Mystery',
      'Thriller',
      'Romance',
      'Science Fiction',
      'Fantasy',
      'Horror',
      'Biography',
      'History',
      'Self-Help',
      'Business',
      'Health',
      'Travel',
      'Cooking',
      'Art',
      'Poetry',
      'Drama',
      'Adventure',
      'Young Adult',
      'Children',
      'Philosophy',
      'Religion',
      'Politics',
      'Science',
      'Technology',
    ],
  };
});

const MockedBook = Book as jest.Mocked<typeof Book>;
const MockedReview = Review as jest.Mocked<typeof Review>;
const mockedLogger = logger as jest.Mocked<typeof logger>;

describe('BooksService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('searchBooks', () => {
    const mockBooks: Partial<IBook>[] = [
      {
        _id: 'book1',
        title: 'Test Book 1',
        author: 'Test Author 1',
        genres: ['Fiction'],
        averageRating: 4.5,
        totalReviews: 10,
        publishedYear: 2023,
        createdAt: new Date('2023-01-01'),
      },
      {
        _id: 'book2',
        title: 'Test Book 2',
        author: 'Test Author 2',
        genres: ['Mystery'],
        averageRating: 3.8,
        totalReviews: 5,
        publishedYear: 2022,
        createdAt: new Date('2022-01-01'),
      },
    ];

    beforeEach(() => {
      const mockQuery = {
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(mockBooks),
      };

      MockedBook.find = jest.fn().mockReturnValue(mockQuery);
      MockedBook.countDocuments = jest.fn().mockResolvedValue(2);
    });

    it('should search books with default options', async () => {
      const options: BookSearchOptions = {};
      const result = await BooksService.searchBooks(options);

      expect(result).toEqual({
        data: mockBooks,
        totalItems: 2,
        currentPage: 1,
        totalPages: 1,
        hasNextPage: false,
        hasPrevPage: false,
      });

      expect(MockedBook.find).toHaveBeenCalledWith({});
      expect(mockedLogger.info).toHaveBeenCalledWith('Books search executed', expect.any(Object));
    });

    it('should search books with text search', async () => {
      const options: BookSearchOptions = { search: 'test query' };
      await BooksService.searchBooks(options);

      expect(MockedBook.find).toHaveBeenCalledWith({
        $text: { $search: 'test query' }
      });
    });

    it('should filter books by genres', async () => {
      const options: BookSearchOptions = { genres: ['Fiction', 'Mystery'] };
      await BooksService.searchBooks(options);

      expect(MockedBook.find).toHaveBeenCalledWith({
        genres: { $in: ['Fiction', 'Mystery'] }
      });
    });

    it('should filter out invalid genres', async () => {
      const options: BookSearchOptions = { genres: ['Fiction', 'InvalidGenre'] };
      await BooksService.searchBooks(options);

      expect(MockedBook.find).toHaveBeenCalledWith({
        genres: { $in: ['Fiction'] }
      });
    });

    it('should filter books by author', async () => {
      const options: BookSearchOptions = { author: 'Test Author' };
      await BooksService.searchBooks(options);

      expect(MockedBook.find).toHaveBeenCalledWith({
        author: { $regex: 'Test Author', $options: 'i' }
      });
    });

    it('should filter books by minimum rating', async () => {
      const options: BookSearchOptions = { minRating: 4.0 };
      await BooksService.searchBooks(options);

      expect(MockedBook.find).toHaveBeenCalledWith({
        averageRating: { $gte: 4.0 }
      });
    });

    it('should filter books by published year', async () => {
      const options: BookSearchOptions = { publishedYear: 2023 };
      await BooksService.searchBooks(options);

      expect(MockedBook.find).toHaveBeenCalledWith({
        publishedYear: 2023
      });
    });

    it('should ignore invalid published year', async () => {
      const options: BookSearchOptions = { publishedYear: 999 };
      await BooksService.searchBooks(options);

      expect(MockedBook.find).toHaveBeenCalledWith({});
    });

    it('should ignore invalid minimum rating', async () => {
      const options: BookSearchOptions = { minRating: 6 };
      await BooksService.searchBooks(options);

      expect(MockedBook.find).toHaveBeenCalledWith({});
    });

    it('should handle pagination correctly', async () => {
      const options: BookSearchOptions = { page: 2, limit: 5 };
      await BooksService.searchBooks(options);

      const mockQuery = MockedBook.find({});
      expect(mockQuery.skip).toHaveBeenCalledWith(5);
      expect(mockQuery.limit).toHaveBeenCalledWith(5);
    });

    it('should sanitize page and limit values', async () => {
      const options: BookSearchOptions = { page: -1, limit: 100 };
      await BooksService.searchBooks(options);

      const mockQuery = MockedBook.find({});
      expect(mockQuery.skip).toHaveBeenCalledWith(0); // page 1, skip 0
      expect(mockQuery.limit).toHaveBeenCalledWith(50); // max limit 50
    });

    it('should sort by different criteria', async () => {
      const options: BookSearchOptions = { sort: 'rating' };
      await BooksService.searchBooks(options);

      const mockQuery = MockedBook.find({});
      expect(mockQuery.sort).toHaveBeenCalledWith({ averageRating: -1 });
    });

    it('should handle text search with sorting', async () => {
      const options: BookSearchOptions = { search: 'test', sort: 'newest' };
      await BooksService.searchBooks(options);

      const mockQuery = MockedBook.find({ $text: { $search: 'test' } });
      expect(mockQuery.sort).toHaveBeenCalledWith({
        score: { $meta: 'textScore' },
        createdAt: -1
      });
    });

    it('should handle database errors', async () => {
      MockedBook.find = jest.fn().mockImplementation(() => {
        throw new Error('Database error');
      });

      await expect(BooksService.searchBooks({})).rejects.toThrow('Failed to search books');
      expect(mockedLogger.error).toHaveBeenCalledWith('Error in books search service:', expect.any(Error));
    });

    it('should combine multiple filters', async () => {
      const options: BookSearchOptions = {
        search: 'test',
        genres: ['Fiction'],
        author: 'Test Author',
        minRating: 4.0,
        publishedYear: 2023
      };
      await BooksService.searchBooks(options);

      expect(MockedBook.find).toHaveBeenCalledWith({
        $text: { $search: 'test' },
        genres: { $in: ['Fiction'] },
        author: { $regex: 'Test Author', $options: 'i' },
        averageRating: { $gte: 4.0 },
        publishedYear: 2023
      });
    });
  });

  describe('getBookById', () => {
    const mockBook: Partial<IBook> = {
      _id: 'book1',
      title: 'Test Book',
      author: 'Test Author',
    };

    beforeEach(() => {
      const mockQuery = {
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(mockBook),
      };
      MockedBook.findById = jest.fn().mockReturnValue(mockQuery);
    });

    it('should get book by ID successfully', async () => {
      const result = await BooksService.getBookById('book1');

      expect(result).toEqual(mockBook);
      expect(MockedBook.findById).toHaveBeenCalledWith('book1');
      expect(mockedLogger.info).toHaveBeenCalledWith('Book retrieved: book1');
    });

    it('should return null when book not found', async () => {
      const mockQuery = {
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(null),
      };
      MockedBook.findById = jest.fn().mockReturnValue(mockQuery);

      const result = await BooksService.getBookById('nonexistent');

      expect(result).toBeNull();
      expect(mockedLogger.info).not.toHaveBeenCalled();
    });

    it('should handle database errors', async () => {
      MockedBook.findById = jest.fn().mockImplementation(() => {
        throw new Error('Database error');
      });

      await expect(BooksService.getBookById('book1')).rejects.toThrow('Failed to retrieve book');
      expect(mockedLogger.error).toHaveBeenCalledWith('Error retrieving book book1:', expect.any(Error));
    });
  });

  describe('getBookReviews', () => {
    const mockReviews = [
      { _id: 'review1', rating: 5, comment: 'Great book!', user: { name: 'User 1' } },
      { _id: 'review2', rating: 4, comment: 'Good read', user: { name: 'User 2' } },
    ];

    beforeEach(() => {
      const mockQuery = {
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(mockReviews),
      };

      MockedReview.find = jest.fn().mockReturnValue(mockQuery);
      MockedReview.countDocuments = jest.fn().mockResolvedValue(2);
    });

    it('should get book reviews with default options', async () => {
      const result = await BooksService.getBookReviews('book1', {});

      expect(result).toEqual({
        data: mockReviews,
        totalItems: 2,
        currentPage: 1,
        totalPages: 1,
        hasNextPage: false,
        hasPrevPage: false,
      });

      expect(MockedReview.find).toHaveBeenCalledWith({ bookId: 'book1' });
      expect(mockedLogger.info).toHaveBeenCalledWith(
        'Book reviews retrieved for book: book1',
        expect.any(Object)
      );
    });

    it('should handle pagination for reviews', async () => {
      const options: BookReviewsOptions = { page: 2, limit: 5 };
      await BooksService.getBookReviews('book1', options);

      const mockQuery = MockedReview.find({ bookId: 'book1' });
      expect(mockQuery.skip).toHaveBeenCalledWith(5);
      expect(mockQuery.limit).toHaveBeenCalledWith(5);
    });

    it('should sort reviews by different criteria', async () => {
      const options: BookReviewsOptions = { sort: 'rating_high' };
      await BooksService.getBookReviews('book1', options);

      const mockQuery = MockedReview.find({ bookId: 'book1' });
      expect(mockQuery.sort).toHaveBeenCalledWith({ rating: -1 });
    });

    it('should sanitize pagination values', async () => {
      const options: BookReviewsOptions = { page: -1, limit: 100 };
      await BooksService.getBookReviews('book1', options);

      const mockQuery = MockedReview.find({ bookId: 'book1' });
      expect(mockQuery.skip).toHaveBeenCalledWith(0);
      expect(mockQuery.limit).toHaveBeenCalledWith(50);
    });

    it('should handle database errors', async () => {
      MockedReview.find = jest.fn().mockImplementation(() => {
        throw new Error('Database error');
      });

      await expect(BooksService.getBookReviews('book1', {})).rejects.toThrow('Failed to retrieve book reviews');
      expect(mockedLogger.error).toHaveBeenCalledWith(
        'Error retrieving reviews for book book1:',
        expect.any(Error)
      );
    });
  });

  describe('getGenres', () => {
    it('should return sorted list of valid genres', () => {
      const result = BooksService.getGenres();
      
      expect(result).toEqual(VALID_GENRES.sort());
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe('bookExists', () => {
    beforeEach(() => {
      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn(),
      };
      MockedBook.findById = jest.fn().mockReturnValue(mockQuery);
    });

    it('should return true when book exists', async () => {
      const mockQuery = MockedBook.findById('book1');
      mockQuery.exec = jest.fn().mockResolvedValue({ _id: 'book1' });

      const result = await BooksService.bookExists('book1');

      expect(result).toBe(true);
      expect(MockedBook.findById).toHaveBeenCalledWith('book1');
    });

    it('should return false when book does not exist', async () => {
      const mockQuery = MockedBook.findById('nonexistent');
      mockQuery.exec = jest.fn().mockResolvedValue(null);

      const result = await BooksService.bookExists('nonexistent');

      expect(result).toBe(false);
    });

    it('should return false on database error', async () => {
      MockedBook.findById = jest.fn().mockImplementation(() => {
        throw new Error('Database error');
      });

      const result = await BooksService.bookExists('book1');

      expect(result).toBe(false);
      expect(mockedLogger.error).toHaveBeenCalledWith(
        'Error checking if book exists book1:',
        expect.any(Error)
      );
    });
  });

  describe('getBooksByGenre', () => {
    it('should get books by valid genre', async () => {
      const mockSearchBooks = jest.spyOn(BooksService, 'searchBooks').mockResolvedValue({
        data: [],
        totalItems: 0,
        currentPage: 1,
        totalPages: 0,
        hasNextPage: false,
        hasPrevPage: false,
      });

      await BooksService.getBooksByGenre('Fiction', { page: 1, limit: 10 });

      expect(mockSearchBooks).toHaveBeenCalledWith({
        page: 1,
        limit: 10,
        genres: ['Fiction']
      });

      mockSearchBooks.mockRestore();
    });

    it('should throw error for invalid genre', async () => {
      await expect(BooksService.getBooksByGenre('InvalidGenre')).rejects.toThrow('Invalid genre provided');
    });
  });

  describe('getBooksByAuthor', () => {
    it('should get books by author', async () => {
      const mockSearchBooks = jest.spyOn(BooksService, 'searchBooks').mockResolvedValue({
        data: [],
        totalItems: 0,
        currentPage: 1,
        totalPages: 0,
        hasNextPage: false,
        hasPrevPage: false,
      });

      await BooksService.getBooksByAuthor('Test Author', { page: 1, limit: 10 });

      expect(mockSearchBooks).toHaveBeenCalledWith({
        page: 1,
        limit: 10,
        author: 'Test Author'
      });

      mockSearchBooks.mockRestore();
    });
  });

  describe('getRecentBooks', () => {
    beforeEach(() => {
      const mockQuery = {
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([]),
      };

      MockedBook.find = jest.fn().mockReturnValue(mockQuery);
      MockedBook.countDocuments = jest.fn().mockResolvedValue(0);
    });

    it('should get recent books (within last 2 years)', async () => {
      const currentYear = new Date().getFullYear();
      const twoYearsAgo = currentYear - 2;

      await BooksService.getRecentBooks();

      expect(MockedBook.find).toHaveBeenCalledWith({
        publishedYear: { $gte: twoYearsAgo }
      });
    });

    it('should apply additional filters to recent books', async () => {
      const currentYear = new Date().getFullYear();
      const twoYearsAgo = currentYear - 2;

      await BooksService.getRecentBooks({
        search: 'test',
        genres: ['Fiction'],
        author: 'Test Author',
        minRating: 4.0
      });

      expect(MockedBook.find).toHaveBeenCalledWith({
        publishedYear: { $gte: twoYearsAgo },
        $text: { $search: 'test' },
        genres: { $in: ['Fiction'] },
        author: { $regex: 'Test Author', $options: 'i' },
        averageRating: { $gte: 4.0 }
      });
    });

    it('should handle database errors in getRecentBooks', async () => {
      MockedBook.find = jest.fn().mockImplementation(() => {
        throw new Error('Database error');
      });

      await expect(BooksService.getRecentBooks()).rejects.toThrow('Failed to retrieve recent books');
      expect(mockedLogger.error).toHaveBeenCalledWith('Error retrieving recent books:', expect.any(Error));
    });
  });

  describe('getTopRatedBooks', () => {
    it('should get top-rated books', async () => {
      const mockSearchBooks = jest.spyOn(BooksService, 'searchBooks').mockResolvedValue({
        data: [],
        totalItems: 0,
        currentPage: 1,
        totalPages: 0,
        hasNextPage: false,
        hasPrevPage: false,
      });

      await BooksService.getTopRatedBooks({ page: 1, limit: 10 });

      expect(mockSearchBooks).toHaveBeenCalledWith({
        page: 1,
        limit: 10,
        sort: 'rating',
        minRating: 4.0
      });

      mockSearchBooks.mockRestore();
    });
  });

  describe('getMostReviewedBooks', () => {
    it('should get most reviewed books', async () => {
      const mockSearchBooks = jest.spyOn(BooksService, 'searchBooks').mockResolvedValue({
        data: [],
        totalItems: 0,
        currentPage: 1,
        totalPages: 0,
        hasNextPage: false,
        hasPrevPage: false,
      });

      await BooksService.getMostReviewedBooks({ page: 1, limit: 10 });

      expect(mockSearchBooks).toHaveBeenCalledWith({
        page: 1,
        limit: 10,
        sort: 'reviews'
      });

      mockSearchBooks.mockRestore();
    });
  });
});
