import { ReviewsService, CreateReviewData, UpdateReviewData, ReviewsQuery } from '../../src/services/reviewsService';
import Review from '../../src/models/Review';
import Book from '../../src/models/Book';
import User from '../../src/models/User';
import { logger } from '../../src/utils/logger';

// Mock dependencies
jest.mock('../../src/models/Review');
jest.mock('../../src/models/Book');
jest.mock('../../src/models/User');
jest.mock('../../src/utils/logger');

const MockedReview = Review as jest.Mocked<typeof Review>;
const MockedBook = Book as jest.Mocked<typeof Book>;
const MockedUser = User as jest.Mocked<typeof User>;
const mockedLogger = logger as jest.Mocked<typeof logger>;

describe('ReviewsService', () => {
  let reviewsService: ReviewsService;

  beforeEach(() => {
    jest.clearAllMocks();
    reviewsService = new ReviewsService();
  });

  describe('createReview', () => {
    const mockReviewData: CreateReviewData = {
      bookId: 'book1',
      userId: 'user1',
      text: 'Great book!',
      rating: 5,
    };

    const mockBook = {
      _id: 'book1',
      title: 'Test Book',
      updateRatingStats: jest.fn().mockResolvedValue(undefined),
    };

    const mockUser = {
      _id: 'user1',
      name: 'Test User',
    };

    const mockReview = {
      _id: 'review1',
      ...mockReviewData,
      save: jest.fn().mockResolvedValue(undefined),
      populate: jest.fn().mockResolvedValue(undefined),
    };

    beforeEach(() => {
      MockedBook.findById = jest.fn().mockResolvedValue(mockBook);
      MockedUser.findById = jest.fn().mockResolvedValue(mockUser);
      MockedReview.findOne = jest.fn().mockResolvedValue(null);
      MockedReview.prototype.save = jest.fn().mockResolvedValue(undefined);
      MockedReview.prototype.populate = jest.fn().mockResolvedValue(undefined);
      (MockedReview as any).mockImplementation(() => mockReview);
    });

    it('should create a review successfully', async () => {
      await reviewsService.createReview(mockReviewData);

      expect(MockedBook.findById).toHaveBeenCalledWith('book1');
      expect(MockedUser.findById).toHaveBeenCalledWith('user1');
      expect(MockedReview.findOne).toHaveBeenCalledWith({
        userId: 'user1',
        bookId: 'book1',
      });
      expect(mockBook.updateRatingStats).toHaveBeenCalledWith(5, true);
      expect(mockedLogger.info).toHaveBeenCalledWith('Creating new review', {
        bookId: 'book1',
        userId: 'user1',
      });
      expect(mockedLogger.info).toHaveBeenCalledWith('Review created successfully', {
        reviewId: 'review1',
      });
    });

    it('should throw error when book not found', async () => {
      MockedBook.findById = jest.fn().mockResolvedValue(null);

      await expect(reviewsService.createReview(mockReviewData)).rejects.toThrow('Book not found');
      expect(mockedLogger.error).toHaveBeenCalledWith('Error creating review', expect.any(Object));
    });

    it('should throw error when user not found', async () => {
      MockedUser.findById = jest.fn().mockResolvedValue(null);

      await expect(reviewsService.createReview(mockReviewData)).rejects.toThrow('User not found');
      expect(mockedLogger.error).toHaveBeenCalledWith('Error creating review', expect.any(Object));
    });

    it('should throw error when user has already reviewed the book', async () => {
      MockedReview.findOne = jest.fn().mockResolvedValue({ _id: 'existing-review' });

      await expect(reviewsService.createReview(mockReviewData)).rejects.toThrow(
        'You have already reviewed this book'
      );
      expect(mockedLogger.error).toHaveBeenCalledWith('Error creating review', expect.any(Object));
    });

    it('should handle database errors', async () => {
      MockedBook.findById = jest.fn().mockRejectedValue(new Error('Database error'));

      await expect(reviewsService.createReview(mockReviewData)).rejects.toThrow('Database error');
      expect(mockedLogger.error).toHaveBeenCalledWith('Error creating review', expect.any(Object));
    });
  });

  describe('updateReview', () => {
    const mockReview = {
      _id: 'review1',
      userId: 'user1',
      bookId: 'book1',
      rating: 4,
      text: 'Original text',
      save: jest.fn().mockResolvedValue(undefined),
      populate: jest.fn().mockResolvedValue(undefined),
    };

    const mockBook = {
      _id: 'book1',
      updateRatingStats: jest.fn().mockResolvedValue(undefined),
    };

    const updateData: UpdateReviewData = {
      text: 'Updated text',
      rating: 5,
    };

    beforeEach(() => {
      MockedReview.findById = jest.fn().mockResolvedValue(mockReview);
      MockedBook.findById = jest.fn().mockResolvedValue(mockBook);
    });

    it('should update review successfully', async () => {
      await reviewsService.updateReview('review1', 'user1', updateData);

      expect(MockedReview.findById).toHaveBeenCalledWith('review1');
      expect(mockReview.text).toBe('Updated text');
      expect(mockReview.rating).toBe(5);
      expect(mockReview.save).toHaveBeenCalled();
      expect(mockBook.updateRatingStats).toHaveBeenCalledWith(5, false, 4);
      expect(mockedLogger.info).toHaveBeenCalledWith('Updating review', {
        reviewId: 'review1',
        userId: 'user1',
      });
      expect(mockedLogger.info).toHaveBeenCalledWith('Review updated successfully', {
        reviewId: 'review1',
      });
    });

    it('should throw error when review not found', async () => {
      MockedReview.findById = jest.fn().mockResolvedValue(null);

      await expect(reviewsService.updateReview('review1', 'user1', updateData)).rejects.toThrow(
        'Review not found'
      );
      expect(mockedLogger.error).toHaveBeenCalledWith('Error updating review', expect.any(Object));
    });

    it('should throw error when user is not the owner', async () => {
      const reviewWithDifferentUser = { ...mockReview, userId: 'different-user' };
      MockedReview.findById = jest.fn().mockResolvedValue(reviewWithDifferentUser);

      await expect(reviewsService.updateReview('review1', 'user1', updateData)).rejects.toThrow(
        'You can only update your own reviews'
      );
      expect(mockedLogger.error).toHaveBeenCalledWith('Error updating review', expect.any(Object));
    });

    it('should update only text when rating is not provided', async () => {
      const textOnlyUpdate: UpdateReviewData = { text: 'Only text update' };
      
      await reviewsService.updateReview('review1', 'user1', textOnlyUpdate);

      expect(mockReview.text).toBe('Only text update');
      expect(mockReview.rating).toBe(4); // Should remain unchanged
      expect(mockBook.updateRatingStats).not.toHaveBeenCalled();
    });

    it('should update only rating when text is not provided', async () => {
      const ratingOnlyUpdate: UpdateReviewData = { rating: 3 };
      
      await reviewsService.updateReview('review1', 'user1', ratingOnlyUpdate);

      expect(mockReview.rating).toBe(3);
      expect(mockBook.updateRatingStats).toHaveBeenCalledWith(3, false, 4);
    });

    it('should not update book stats when rating remains the same', async () => {
      const sameRatingUpdate: UpdateReviewData = { rating: 4, text: 'New text' };
      
      await reviewsService.updateReview('review1', 'user1', sameRatingUpdate);

      expect(mockBook.updateRatingStats).not.toHaveBeenCalled();
    });

    it('should handle database errors', async () => {
      MockedReview.findById = jest.fn().mockRejectedValue(new Error('Database error'));

      await expect(reviewsService.updateReview('review1', 'user1', updateData)).rejects.toThrow(
        'Database error'
      );
      expect(mockedLogger.error).toHaveBeenCalledWith('Error updating review', expect.any(Object));
    });
  });

  describe('deleteReview', () => {
    const mockReview = {
      _id: 'review1',
      userId: 'user1',
      bookId: 'book1',
    };

    beforeEach(() => {
      MockedReview.findById = jest.fn().mockResolvedValue(mockReview);
      MockedReview.findByIdAndDelete = jest.fn().mockResolvedValue(mockReview);
    });

    it('should delete review successfully', async () => {
      await reviewsService.deleteReview('review1', 'user1');

      expect(MockedReview.findById).toHaveBeenCalledWith('review1');
      expect(MockedReview.findByIdAndDelete).toHaveBeenCalledWith('review1');
      expect(mockedLogger.info).toHaveBeenCalledWith('Deleting review', {
        reviewId: 'review1',
        userId: 'user1',
      });
      expect(mockedLogger.info).toHaveBeenCalledWith('Review deleted successfully', {
        reviewId: 'review1',
      });
    });

    it('should throw error when review not found', async () => {
      MockedReview.findById = jest.fn().mockResolvedValue(null);

      await expect(reviewsService.deleteReview('review1', 'user1')).rejects.toThrow('Review not found');
      expect(mockedLogger.error).toHaveBeenCalledWith('Error deleting review', expect.any(Object));
    });

    it('should throw error when user is not the owner', async () => {
      const reviewWithDifferentUser = { ...mockReview, userId: 'different-user' };
      MockedReview.findById = jest.fn().mockResolvedValue(reviewWithDifferentUser);

      await expect(reviewsService.deleteReview('review1', 'user1')).rejects.toThrow(
        'You can only delete your own reviews'
      );
      expect(mockedLogger.error).toHaveBeenCalledWith('Error deleting review', expect.any(Object));
    });

    it('should handle database errors', async () => {
      MockedReview.findById = jest.fn().mockRejectedValue(new Error('Database error'));

      await expect(reviewsService.deleteReview('review1', 'user1')).rejects.toThrow('Database error');
      expect(mockedLogger.error).toHaveBeenCalledWith('Error deleting review', expect.any(Object));
    });
  });

  describe('getReviewById', () => {
    const mockReview = {
      _id: 'review1',
      text: 'Great book!',
      rating: 5,
      populate: jest.fn().mockReturnThis(),
    };

    beforeEach(() => {
      MockedReview.findById = jest.fn().mockReturnValue(mockReview);
    });

    it('should get review by ID successfully', async () => {
      await reviewsService.getReviewById('review1');

      expect(MockedReview.findById).toHaveBeenCalledWith('review1');
      expect(mockReview.populate).toHaveBeenCalledWith('user', 'name');
      expect(mockReview.populate).toHaveBeenCalledWith('book', 'title author coverImageUrl');
    });

    it('should handle database errors', async () => {
      MockedReview.findById = jest.fn().mockImplementation(() => {
        throw new Error('Database error');
      });

      await expect(reviewsService.getReviewById('review1')).rejects.toThrow('Database error');
      expect(mockedLogger.error).toHaveBeenCalledWith('Error fetching review by ID', expect.any(Object));
    });
  });

  describe('getUserReviews', () => {
    const mockReviews = [
      { _id: 'review1', rating: 5, text: 'Great!', createdAt: new Date() },
      { _id: 'review2', rating: 4, text: 'Good!', createdAt: new Date() },
    ];

    beforeEach(() => {
      const mockQuery = {
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue(mockReviews),
      };

      MockedReview.find = jest.fn().mockReturnValue(mockQuery);
      MockedReview.countDocuments = jest.fn().mockResolvedValue(2);
    });

    it('should get user reviews with default options', async () => {
      const result = await reviewsService.getUserReviews('user1');

      expect(result.reviews).toEqual(mockReviews);
      expect(result.pagination).toEqual({
        currentPage: 1,
        totalPages: 1,
        totalReviews: 2,
        hasNextPage: false,
        hasPrevPage: false,
      });

      expect(MockedReview.find).toHaveBeenCalledWith({ userId: 'user1' });
      expect(MockedReview.countDocuments).toHaveBeenCalledWith({ userId: 'user1' });
      expect(mockedLogger.info).toHaveBeenCalledWith('Fetching user reviews', expect.any(Object));
      expect(mockedLogger.info).toHaveBeenCalledWith('User reviews fetched successfully', expect.any(Object));
    });

    it('should handle pagination correctly', async () => {
      const query: ReviewsQuery = { page: 2, limit: 5 };
      await reviewsService.getUserReviews('user1', query);

      const mockQuery = MockedReview.find({ userId: 'user1' });
      expect(mockQuery.skip).toHaveBeenCalledWith(5);
      expect(mockQuery.limit).toHaveBeenCalledWith(5);
    });

    it('should sanitize pagination values', async () => {
      const query: ReviewsQuery = { page: -1, limit: 100 };
      await reviewsService.getUserReviews('user1', query);

      const mockQuery = MockedReview.find({ userId: 'user1' });
      expect(mockQuery.skip).toHaveBeenCalledWith(0); // page 1
      expect(mockQuery.limit).toHaveBeenCalledWith(50); // max limit
    });

    it('should sort by different criteria', async () => {
      const sortOptions = ['newest', 'oldest', 'rating_high', 'rating_low'];
      const expectedSorts = [
        { createdAt: -1 },
        { createdAt: 1 },
        { rating: -1, createdAt: -1 },
        { rating: 1, createdAt: -1 },
      ];

      for (let i = 0; i < sortOptions.length; i++) {
        const query: ReviewsQuery = { sort: sortOptions[i] as any };
        await reviewsService.getUserReviews('user1', query);

        const mockQuery = MockedReview.find({ userId: 'user1' });
        expect(mockQuery.sort).toHaveBeenCalledWith(expectedSorts[i]);
      }
    });

    it('should handle database errors', async () => {
      MockedReview.find = jest.fn().mockImplementation(() => {
        throw new Error('Database error');
      });

      await expect(reviewsService.getUserReviews('user1')).rejects.toThrow('Database error');
      expect(mockedLogger.error).toHaveBeenCalledWith('Error fetching user reviews', expect.any(Object));
    });
  });

  describe('getBookReviews', () => {
    const mockReviews = [
      { _id: 'review1', rating: 5, text: 'Great!', user: { name: 'User 1' } },
      { _id: 'review2', rating: 4, text: 'Good!', user: { name: 'User 2' } },
    ];

    beforeEach(() => {
      const mockQuery = {
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue(mockReviews),
      };

      MockedReview.find = jest.fn().mockReturnValue(mockQuery);
      MockedReview.countDocuments = jest.fn().mockResolvedValue(2);
    });

    it('should get book reviews with default options', async () => {
      const result = await reviewsService.getBookReviews('book1');

      expect(result.reviews).toEqual(mockReviews);
      expect(result.pagination).toEqual({
        currentPage: 1,
        totalPages: 1,
        totalReviews: 2,
        hasNextPage: false,
        hasPrevPage: false,
      });

      expect(MockedReview.find).toHaveBeenCalledWith({ bookId: 'book1' });
      expect(MockedReview.countDocuments).toHaveBeenCalledWith({ bookId: 'book1' });
      expect(mockedLogger.info).toHaveBeenCalledWith('Fetching book reviews', expect.any(Object));
      expect(mockedLogger.info).toHaveBeenCalledWith('Book reviews fetched successfully', expect.any(Object));
    });

    it('should handle pagination and sorting', async () => {
      const query: ReviewsQuery = { page: 2, limit: 5, sort: 'rating_high' };
      await reviewsService.getBookReviews('book1', query);

      const mockQuery = MockedReview.find({ bookId: 'book1' });
      expect(mockQuery.skip).toHaveBeenCalledWith(5);
      expect(mockQuery.limit).toHaveBeenCalledWith(5);
      expect(mockQuery.sort).toHaveBeenCalledWith({ rating: -1, createdAt: -1 });
    });

    it('should handle database errors', async () => {
      MockedReview.find = jest.fn().mockImplementation(() => {
        throw new Error('Database error');
      });

      await expect(reviewsService.getBookReviews('book1')).rejects.toThrow('Database error');
      expect(mockedLogger.error).toHaveBeenCalledWith('Error fetching book reviews', expect.any(Object));
    });
  });

  describe('hasUserReviewedBook', () => {
    it('should return true when user has reviewed the book', async () => {
      MockedReview.findOne = jest.fn().mockResolvedValue({ _id: 'review1' });

      const result = await reviewsService.hasUserReviewedBook('user1', 'book1');

      expect(result).toBe(true);
      expect(MockedReview.findOne).toHaveBeenCalledWith({ userId: 'user1', bookId: 'book1' });
    });

    it('should return false when user has not reviewed the book', async () => {
      MockedReview.findOne = jest.fn().mockResolvedValue(null);

      const result = await reviewsService.hasUserReviewedBook('user1', 'book1');

      expect(result).toBe(false);
    });

    it('should handle database errors', async () => {
      MockedReview.findOne = jest.fn().mockRejectedValue(new Error('Database error'));

      await expect(reviewsService.hasUserReviewedBook('user1', 'book1')).rejects.toThrow('Database error');
      expect(mockedLogger.error).toHaveBeenCalledWith('Error checking if user reviewed book', expect.any(Object));
    });
  });

  describe('getUserBookReview', () => {
    const mockReview = {
      _id: 'review1',
      userId: 'user1',
      bookId: 'book1',
      populate: jest.fn().mockReturnThis(),
    };

    beforeEach(() => {
      MockedReview.findOne = jest.fn().mockReturnValue(mockReview);
    });

    it('should get user book review successfully', async () => {
      await reviewsService.getUserBookReview('user1', 'book1');

      expect(MockedReview.findOne).toHaveBeenCalledWith({ userId: 'user1', bookId: 'book1' });
      expect(mockReview.populate).toHaveBeenCalledWith('user', 'name');
      expect(mockReview.populate).toHaveBeenCalledWith('book', 'title author coverImageUrl');
    });

    it('should handle database errors', async () => {
      MockedReview.findOne = jest.fn().mockImplementation(() => {
        throw new Error('Database error');
      });

      await expect(reviewsService.getUserBookReview('user1', 'book1')).rejects.toThrow('Database error');
      expect(mockedLogger.error).toHaveBeenCalledWith('Error fetching user book review', expect.any(Object));
    });
  });

  describe('getUserReviewStats', () => {
    it('should get user review statistics successfully', async () => {
      const mockStats = [
        {
          _id: null,
          totalReviews: 5,
          averageRating: 4.2,
          ratings: [5, 4, 4, 3, 5],
        },
      ];

      MockedReview.aggregate = jest.fn().mockResolvedValue(mockStats);

      const result = await reviewsService.getUserReviewStats('user1');

      expect(result).toEqual({
        totalReviews: 5,
        averageRating: 4.2,
        ratingDistribution: { 1: 0, 2: 0, 3: 1, 4: 2, 5: 2 },
      });

      expect(MockedReview.aggregate).toHaveBeenCalledWith([
        { $match: { userId: 'user1' } },
        {
          $group: {
            _id: null,
            totalReviews: { $sum: 1 },
            averageRating: { $avg: '$rating' },
            ratings: { $push: '$rating' },
          },
        },
      ]);
    });

    it('should return default stats when user has no reviews', async () => {
      MockedReview.aggregate = jest.fn().mockResolvedValue([]);

      const result = await reviewsService.getUserReviewStats('user1');

      expect(result).toEqual({
        totalReviews: 0,
        averageRating: 0,
        ratingDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
      });
    });

    it('should handle invalid ratings in distribution', async () => {
      const mockStats = [
        {
          _id: null,
          totalReviews: 3,
          averageRating: 4.0,
          ratings: [5, 0, 6], // Invalid ratings
        },
      ];

      MockedReview.aggregate = jest.fn().mockResolvedValue(mockStats);

      const result = await reviewsService.getUserReviewStats('user1');

      expect(result.ratingDistribution).toEqual({ 1: 0, 2: 0, 3: 0, 4: 0, 5: 1 });
    });

    it('should round average rating to one decimal place', async () => {
      const mockStats = [
        {
          _id: null,
          totalReviews: 3,
          averageRating: 4.166666666666667,
          ratings: [4, 4, 5],
        },
      ];

      MockedReview.aggregate = jest.fn().mockResolvedValue(mockStats);

      const result = await reviewsService.getUserReviewStats('user1');

      expect(result.averageRating).toBe(4.2);
    });

    it('should handle database errors', async () => {
      MockedReview.aggregate = jest.fn().mockRejectedValue(new Error('Database error'));

      await expect(reviewsService.getUserReviewStats('user1')).rejects.toThrow('Database error');
      expect(mockedLogger.error).toHaveBeenCalledWith('Error fetching user review stats', expect.any(Object));
    });
  });
});
