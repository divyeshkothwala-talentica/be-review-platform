import { UserProfileService, UpdateProfileData } from '../../src/services/userProfileService';
import User from '../../src/models/User';
import Review from '../../src/models/Review';
import Favorite from '../../src/models/Favorite';
import { logger } from '../../src/utils/logger';

// Mock dependencies
jest.mock('../../src/models/User');
jest.mock('../../src/models/Review');
jest.mock('../../src/models/Favorite');
jest.mock('../../src/utils/logger');

const MockedUser = User as jest.Mocked<typeof User>;
const MockedReview = Review as jest.Mocked<typeof Review>;
const MockedFavorite = Favorite as jest.Mocked<typeof Favorite>;
const mockedLogger = logger as jest.Mocked<typeof logger>;

describe('UserProfileService', () => {
  let userProfileService: UserProfileService;

  beforeEach(() => {
    jest.clearAllMocks();
    userProfileService = new UserProfileService();
  });

  const mockUser = {
    _id: 'user1',
    name: 'John Doe',
    email: 'john@example.com',
    createdAt: new Date('2023-01-01'),
    updatedAt: new Date('2023-01-02'),
    save: jest.fn().mockResolvedValue(undefined),
  };

  describe('getUserProfile', () => {
    beforeEach(() => {
      MockedUser.findById = jest.fn().mockResolvedValue(mockUser);
      jest.spyOn(userProfileService, 'getUserStatistics').mockResolvedValue({
        totalReviews: 5,
        totalFavorites: 3,
        averageRating: 4.2,
        memberSince: mockUser.createdAt,
        ratingDistribution: { 1: 0, 2: 0, 3: 1, 4: 2, 5: 2 },
        favoriteGenres: [{ genre: 'Fiction', count: 2 }],
      });
    });

    it('should get complete user profile successfully', async () => {
      const result = await userProfileService.getUserProfile('user1');

      expect(result).toEqual({
        profile: {
          _id: 'user1',
          name: 'John Doe',
          email: 'john@example.com',
          createdAt: mockUser.createdAt,
          updatedAt: mockUser.updatedAt,
        },
        statistics: {
          totalReviews: 5,
          totalFavorites: 3,
          averageRating: 4.2,
          memberSince: mockUser.createdAt,
          ratingDistribution: { 1: 0, 2: 0, 3: 1, 4: 2, 5: 2 },
          favoriteGenres: [{ genre: 'Fiction', count: 2 }],
        },
      });

      expect(MockedUser.findById).toHaveBeenCalledWith('user1');
      expect(userProfileService.getUserStatistics).toHaveBeenCalledWith('user1');
      expect(mockedLogger.info).toHaveBeenCalledWith('Fetching user profile', { userId: 'user1' });
      expect(mockedLogger.info).toHaveBeenCalledWith('User profile fetched successfully', { userId: 'user1' });
    });

    it('should throw error when user not found', async () => {
      MockedUser.findById = jest.fn().mockResolvedValue(null);

      await expect(userProfileService.getUserProfile('nonexistent')).rejects.toThrow('User not found');
      expect(mockedLogger.error).toHaveBeenCalledWith('Error fetching user profile', expect.any(Object));
    });

    it('should handle database errors', async () => {
      MockedUser.findById = jest.fn().mockRejectedValue(new Error('Database error'));

      await expect(userProfileService.getUserProfile('user1')).rejects.toThrow('Database error');
      expect(mockedLogger.error).toHaveBeenCalledWith('Error fetching user profile', expect.any(Object));
    });
  });

  describe('updateUserProfile', () => {
    beforeEach(() => {
      MockedUser.findById = jest.fn().mockResolvedValue(mockUser);
      MockedUser.findOne = jest.fn().mockResolvedValue(null);
      jest.spyOn(userProfileService, 'getUserProfile').mockResolvedValue({
        profile: {
          _id: 'user1',
          name: 'Updated Name',
          email: 'updated@example.com',
          createdAt: mockUser.createdAt,
          updatedAt: new Date(),
        },
        statistics: {
          totalReviews: 5,
          totalFavorites: 3,
          averageRating: 4.2,
          memberSince: mockUser.createdAt,
          ratingDistribution: { 1: 0, 2: 0, 3: 1, 4: 2, 5: 2 },
          favoriteGenres: [{ genre: 'Fiction', count: 2 }],
        },
      });
    });

    it('should update user name successfully', async () => {
      const updateData: UpdateProfileData = { name: 'Updated Name' };
      const result = await userProfileService.updateUserProfile('user1', updateData);

      expect(mockUser.name).toBe('Updated Name');
      expect(mockUser.save).toHaveBeenCalled();
      expect(result.profile.name).toBe('Updated Name');
      expect(mockedLogger.info).toHaveBeenCalledWith('Updating user profile', expect.any(Object));
      expect(mockedLogger.info).toHaveBeenCalledWith('User profile updated successfully', { userId: 'user1' });
    });

    it('should update user email successfully', async () => {
      const updateData: UpdateProfileData = { email: 'updated@example.com' };
      await userProfileService.updateUserProfile('user1', updateData);

      expect(mockUser.email).toBe('updated@example.com');
      expect(mockUser.save).toHaveBeenCalled();
      expect(MockedUser.findOne).toHaveBeenCalledWith({
        email: 'updated@example.com',
        _id: { $ne: 'user1' },
      });
    });

    it('should update both name and email successfully', async () => {
      const updateData: UpdateProfileData = { name: 'Updated Name', email: 'updated@example.com' };
      await userProfileService.updateUserProfile('user1', updateData);

      expect(mockUser.name).toBe('Updated Name');
      expect(mockUser.email).toBe('updated@example.com');
      expect(mockUser.save).toHaveBeenCalled();
    });

    it('should throw error when user not found', async () => {
      MockedUser.findById = jest.fn().mockResolvedValue(null);
      const updateData: UpdateProfileData = { name: 'Updated Name' };

      await expect(userProfileService.updateUserProfile('nonexistent', updateData)).rejects.toThrow('User not found');
      expect(mockedLogger.error).toHaveBeenCalledWith('Error updating user profile', expect.any(Object));
    });

    it('should throw error when email already exists', async () => {
      const existingUser = { _id: 'other-user', email: 'existing@example.com' };
      MockedUser.findOne = jest.fn().mockResolvedValue(existingUser);
      const updateData: UpdateProfileData = { email: 'existing@example.com' };

      await expect(userProfileService.updateUserProfile('user1', updateData)).rejects.toThrow(
        'Email address is already registered'
      );
      expect(mockedLogger.error).toHaveBeenCalledWith('Error updating user profile', expect.any(Object));
    });

    it('should allow updating to same email', async () => {
      const updateData: UpdateProfileData = { email: 'john@example.com' }; // Same as current email
      await userProfileService.updateUserProfile('user1', updateData);

      // Should still check uniqueness but exclude current user
      expect(MockedUser.findOne).toHaveBeenCalledWith({
        email: 'john@example.com',
        _id: { $ne: 'user1' },
      });
      expect(mockUser.save).toHaveBeenCalled();
    });

    it('should trim name and lowercase email', async () => {
      const updateData: UpdateProfileData = { name: '  Updated Name  ', email: '  UPDATED@EXAMPLE.COM  ' };
      await userProfileService.updateUserProfile('user1', updateData);

      expect(mockUser.name).toBe('Updated Name');
      expect(mockUser.email).toBe('updated@example.com');
    });

    it('should handle database errors', async () => {
      MockedUser.findById = jest.fn().mockRejectedValue(new Error('Database error'));
      const updateData: UpdateProfileData = { name: 'Updated Name' };

      await expect(userProfileService.updateUserProfile('user1', updateData)).rejects.toThrow('Database error');
      expect(mockedLogger.error).toHaveBeenCalledWith('Error updating user profile', expect.any(Object));
    });
  });

  describe('getUserStatistics', () => {
    beforeEach(() => {
      MockedUser.findById = jest.fn().mockResolvedValue(mockUser);
      jest.spyOn(userProfileService as any, 'getReviewStatistics').mockResolvedValue({
        totalReviews: 5,
        averageRating: 4.2,
        ratingDistribution: { 1: 0, 2: 0, 3: 1, 4: 2, 5: 2 },
      });
      jest.spyOn(userProfileService as any, 'getFavoritesStatistics').mockResolvedValue({
        totalFavorites: 3,
        favoriteGenres: [{ genre: 'Fiction', count: 2 }],
      });
    });

    it('should calculate user statistics successfully', async () => {
      const result = await userProfileService.getUserStatistics('user1');

      expect(result).toEqual({
        totalReviews: 5,
        totalFavorites: 3,
        averageRating: 4.2,
        memberSince: mockUser.createdAt,
        ratingDistribution: { 1: 0, 2: 0, 3: 1, 4: 2, 5: 2 },
        favoriteGenres: [{ genre: 'Fiction', count: 2 }],
      });

      expect(MockedUser.findById).toHaveBeenCalledWith('user1');
      expect(mockedLogger.info).toHaveBeenCalledWith('Calculating user statistics', { userId: 'user1' });
      expect(mockedLogger.info).toHaveBeenCalledWith('User statistics calculated successfully', expect.any(Object));
    });

    it('should throw error when user not found', async () => {
      MockedUser.findById = jest.fn().mockResolvedValue(null);

      await expect(userProfileService.getUserStatistics('nonexistent')).rejects.toThrow('User not found');
      expect(mockedLogger.error).toHaveBeenCalledWith('Error calculating user statistics', expect.any(Object));
    });

    it('should handle database errors', async () => {
      MockedUser.findById = jest.fn().mockRejectedValue(new Error('Database error'));

      await expect(userProfileService.getUserStatistics('user1')).rejects.toThrow('Database error');
      expect(mockedLogger.error).toHaveBeenCalledWith('Error calculating user statistics', expect.any(Object));
    });
  });

  describe('getReviewStatistics', () => {
    it('should calculate review statistics successfully', async () => {
      const mockReviewStats = [
        {
          _id: null,
          totalReviews: 5,
          averageRating: 4.2,
          ratings: [5, 4, 4, 3, 5],
        },
      ];
      MockedReview.aggregate = jest.fn().mockResolvedValue(mockReviewStats);

      const result = await (userProfileService as any).getReviewStatistics('user1');

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

      const result = await (userProfileService as any).getReviewStatistics('user1');

      expect(result).toEqual({
        totalReviews: 0,
        averageRating: 0,
        ratingDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
      });
    });

    it('should handle invalid ratings in distribution', async () => {
      const mockReviewStats = [
        {
          _id: null,
          totalReviews: 3,
          averageRating: 4.0,
          ratings: [5, 0, 6], // Invalid ratings
        },
      ];
      MockedReview.aggregate = jest.fn().mockResolvedValue(mockReviewStats);

      const result = await (userProfileService as any).getReviewStatistics('user1');

      expect(result.ratingDistribution).toEqual({ 1: 0, 2: 0, 3: 0, 4: 0, 5: 1 });
    });

    it('should round average rating to one decimal place', async () => {
      const mockReviewStats = [
        {
          _id: null,
          totalReviews: 3,
          averageRating: 4.166666666666667,
          ratings: [4, 4, 5],
        },
      ];
      MockedReview.aggregate = jest.fn().mockResolvedValue(mockReviewStats);

      const result = await (userProfileService as any).getReviewStatistics('user1');

      expect(result.averageRating).toBe(4.2);
    });

    it('should handle database errors', async () => {
      MockedReview.aggregate = jest.fn().mockRejectedValue(new Error('Database error'));

      await expect((userProfileService as any).getReviewStatistics('user1')).rejects.toThrow('Database error');
      expect(mockedLogger.error).toHaveBeenCalledWith('Error calculating review statistics', expect.any(Object));
    });
  });

  describe('getFavoritesStatistics', () => {
    it('should calculate favorites statistics successfully', async () => {
      const mockGenreStats = [
        { genre: 'Fiction', count: 3 },
        { genre: 'Mystery', count: 2 },
      ];
      MockedFavorite.countDocuments = jest.fn().mockResolvedValue(5);
      MockedFavorite.aggregate = jest.fn().mockResolvedValue(mockGenreStats);

      const result = await (userProfileService as any).getFavoritesStatistics('user1');

      expect(result).toEqual({
        totalFavorites: 5,
        favoriteGenres: mockGenreStats,
      });

      expect(MockedFavorite.countDocuments).toHaveBeenCalledWith({ userId: 'user1' });
      expect(MockedFavorite.aggregate).toHaveBeenCalledWith(expect.arrayContaining([
        { $match: { userId: 'user1' } },
      ]));
    });

    it('should handle database errors', async () => {
      MockedFavorite.countDocuments = jest.fn().mockRejectedValue(new Error('Database error'));

      await expect((userProfileService as any).getFavoritesStatistics('user1')).rejects.toThrow('Database error');
      expect(mockedLogger.error).toHaveBeenCalledWith('Error calculating favorites statistics', expect.any(Object));
    });
  });

  describe('validateUpdateData', () => {
    it('should validate valid data successfully', () => {
      const data: UpdateProfileData = {
        name: 'John Doe',
        email: 'john@example.com',
      };

      const result = userProfileService.validateUpdateData(data);

      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should validate name constraints', () => {
      const testCases = [
        { name: 'A', expectedError: 'Name must be at least 2 characters long' },
        { name: 'A'.repeat(101), expectedError: 'Name cannot exceed 100 characters' },
        { name: 'John123', expectedError: 'Name can only contain letters and spaces' },
        { name: 123 as any, expectedError: 'Name must be a string' },
      ];

      testCases.forEach(({ name, expectedError }) => {
        const result = userProfileService.validateUpdateData({ name });
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain(expectedError);
      });
    });

    it('should validate email constraints', () => {
      const testCases = [
        { email: 'invalid-email', expectedError: 'Please provide a valid email address' },
        { email: 'test@', expectedError: 'Please provide a valid email address' },
        { email: '@example.com', expectedError: 'Please provide a valid email address' },
        { email: 123 as any, expectedError: 'Email must be a string' },
      ];

      testCases.forEach(({ email, expectedError }) => {
        const result = userProfileService.validateUpdateData({ email });
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain(expectedError);
      });
    });

    it('should accept valid names and emails', () => {
      const validData = [
        { name: 'John Doe' },
        { name: 'Mary Jane Smith' },
        { email: 'test@example.com' },
        { email: 'user.name+tag@domain.co.uk' },
      ];

      validData.forEach((data) => {
        const result = userProfileService.validateUpdateData(data);
        expect(result.isValid).toBe(true);
        expect(result.errors).toEqual([]);
      });
    });

    it('should handle multiple validation errors', () => {
      const data: UpdateProfileData = {
        name: 'A',
        email: 'invalid-email',
      };

      const result = userProfileService.validateUpdateData(data);

      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(2);
      expect(result.errors).toContain('Name must be at least 2 characters long');
      expect(result.errors).toContain('Please provide a valid email address');
    });
  });

  describe('isEmailAvailable', () => {
    it('should return true when email is available', async () => {
      MockedUser.findOne = jest.fn().mockResolvedValue(null);

      const result = await userProfileService.isEmailAvailable('available@example.com');

      expect(result).toBe(true);
      expect(MockedUser.findOne).toHaveBeenCalledWith({ email: 'available@example.com' });
    });

    it('should return false when email is taken', async () => {
      MockedUser.findOne = jest.fn().mockResolvedValue({ _id: 'existing-user' });

      const result = await userProfileService.isEmailAvailable('taken@example.com');

      expect(result).toBe(false);
    });

    it('should exclude specific user ID from check', async () => {
      MockedUser.findOne = jest.fn().mockResolvedValue(null);

      await userProfileService.isEmailAvailable('test@example.com', 'user1');

      expect(MockedUser.findOne).toHaveBeenCalledWith({
        email: 'test@example.com',
        _id: { $ne: 'user1' },
      });
    });

    it('should handle database errors', async () => {
      MockedUser.findOne = jest.fn().mockRejectedValue(new Error('Database error'));

      await expect(userProfileService.isEmailAvailable('test@example.com')).rejects.toThrow('Database error');
      expect(mockedLogger.error).toHaveBeenCalledWith('Error checking email availability', expect.any(Object));
    });
  });

  describe('getBasicUserProfile', () => {
    it('should get basic user profile successfully', async () => {
      const freshMockUser = {
        _id: 'user1',
        name: 'John Doe',
        email: 'john@example.com',
        createdAt: new Date('2023-01-01'),
        updatedAt: new Date('2023-01-02'),
        save: jest.fn().mockResolvedValue(undefined),
      };
      MockedUser.findById = jest.fn().mockResolvedValue(freshMockUser);

      const result = await userProfileService.getBasicUserProfile('user1');

      expect(result).toEqual({
        _id: 'user1',
        name: 'John Doe',
        email: 'john@example.com',
        createdAt: freshMockUser.createdAt,
        updatedAt: freshMockUser.updatedAt,
      });

      expect(MockedUser.findById).toHaveBeenCalledWith('user1');
    });

    it('should throw error when user not found', async () => {
      MockedUser.findById = jest.fn().mockResolvedValue(null);

      await expect(userProfileService.getBasicUserProfile('nonexistent')).rejects.toThrow('User not found');
      expect(mockedLogger.error).toHaveBeenCalledWith('Error fetching basic user profile', expect.any(Object));
    });

    it('should handle database errors', async () => {
      MockedUser.findById = jest.fn().mockRejectedValue(new Error('Database error'));

      await expect(userProfileService.getBasicUserProfile('user1')).rejects.toThrow('Database error');
      expect(mockedLogger.error).toHaveBeenCalledWith('Error fetching basic user profile', expect.any(Object));
    });
  });
});
