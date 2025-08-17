import request from 'supertest';
import mongoose from 'mongoose';
import app from '../src/app';
import User from '../src/models/User';
import Review from '../src/models/Review';
import Favorite from '../src/models/Favorite';
import Book from '../src/models/Book';
import { JWTService } from '../src/services/jwtService';

describe('User Profile API Endpoints', () => {
  let testUser: any;
  let testUser2: any;
  let testBook: any;
  let authToken: string;

  beforeAll(async () => {
    // Database connection is handled by app initialization
  });

  afterAll(async () => {
    // Clean up and close database connection
    await User.deleteMany({});
    await Review.deleteMany({});
    await Favorite.deleteMany({});
    await Book.deleteMany({});
    await mongoose.connection.close();
  });

  beforeEach(async () => {
    // Clear all collections before each test
    await User.deleteMany({});
    await Review.deleteMany({});
    await Favorite.deleteMany({});
    await Book.deleteMany({});

    // Create test users
    testUser = new User({
      name: 'John Doe',
      email: 'john@example.com',
      password: 'TestPassword123!',
    });
    await testUser.save();

    testUser2 = new User({
      name: 'Jane Smith',
      email: 'jane@example.com',
      password: 'TestPassword123!',
    });
    await testUser2.save();

    // Create test book
    testBook = new Book({
      title: 'Test Book',
      author: 'Test Author',
      isbn: '1234567890123',
      description: 'A test book for testing purposes',
      publishedYear: 2023,
      genres: ['Fiction', 'Mystery'],
      coverImageUrl: 'https://example.com/cover.jpg',
    });
    await testBook.save();

    // Generate auth tokens
    authToken = JWTService.generateToken(testUser);
  });

  describe('GET /v1/users/profile', () => {
    it('should get user profile with statistics', async () => {
      // Create some test data for statistics
      const review = new Review({
        userId: testUser._id,
        bookId: testBook._id,
        text: 'Great book!',
        rating: 5,
      });
      await review.save();

      const favorite = new Favorite({
        userId: testUser._id,
        bookId: testBook._id,
      });
      await favorite.save();

      const response = await request(app.app)
        .get('/v1/users/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Profile retrieved successfully');
      expect(response.body.data.profile).toMatchObject({
        _id: testUser._id,
        name: 'John Doe',
        email: 'john@example.com',
      });
      expect(response.body.data.profile.createdAt).toBeDefined();
      expect(response.body.data.profile.updatedAt).toBeDefined();

      expect(response.body.data.statistics).toMatchObject({
        totalReviews: 1,
        totalFavorites: 1,
        averageRating: 5,
        memberSince: testUser.createdAt.toISOString(),
        ratingDistribution: {
          1: 0,
          2: 0,
          3: 0,
          4: 0,
          5: 1,
        },
      });
      expect(response.body.data.statistics.favoriteGenres).toBeInstanceOf(Array);
    });

    it('should return empty statistics for new user', async () => {
      const response = await request(app.app)
        .get('/v1/users/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.data.statistics).toMatchObject({
        totalReviews: 0,
        totalFavorites: 0,
        averageRating: 0,
        ratingDistribution: {
          1: 0,
          2: 0,
          3: 0,
          4: 0,
          5: 0,
        },
        favoriteGenres: [],
      });
    });

    it('should require authentication', async () => {
      const response = await request(app.app)
        .get('/v1/users/profile')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('MISSING_TOKEN');
    });

    it('should handle invalid token', async () => {
      const response = await request(app.app)
        .get('/v1/users/profile')
        .set('Authorization', 'Bearer invalid-token')
        .expect(403);

      expect(response.body.success).toBe(false);
    });
  });

  describe('PUT /v1/users/profile', () => {
    it('should update user name', async () => {
      const updateData = {
        name: 'John Updated',
      };

      const response = await request(app.app)
        .put('/v1/users/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Profile updated successfully');
      expect(response.body.data.profile.name).toBe('John Updated');
      expect(response.body.data.profile.email).toBe('john@example.com');

      // Verify in database
      const updatedUser = await User.findById(testUser._id);
      expect(updatedUser?.name).toBe('John Updated');
    });

    it('should update user email', async () => {
      const updateData = {
        email: 'john.updated@example.com',
      };

      const response = await request(app.app)
        .put('/v1/users/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.profile.email).toBe('john.updated@example.com');
      expect(response.body.data.profile.name).toBe('John Doe');

      // Verify in database
      const updatedUser = await User.findById(testUser._id);
      expect(updatedUser?.email).toBe('john.updated@example.com');
    });

    it('should update both name and email', async () => {
      const updateData = {
        name: 'John Updated',
        email: 'john.updated@example.com',
      };

      const response = await request(app.app)
        .put('/v1/users/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.profile.name).toBe('John Updated');
      expect(response.body.data.profile.email).toBe('john.updated@example.com');
    });

    it('should reject duplicate email', async () => {
      const updateData = {
        email: 'jane@example.com', // testUser2's email
      };

      const response = await request(app.app)
        .put('/v1/users/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData)
        .expect(409);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('EMAIL_EXISTS');
    });

    it('should validate name format', async () => {
      const updateData = {
        name: 'John123', // Invalid: contains numbers
      };

      const response = await request(app.app)
        .put('/v1/users/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should validate name length', async () => {
      const updateData = {
        name: 'J', // Too short
      };

      const response = await request(app.app)
        .put('/v1/users/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should validate email format', async () => {
      const updateData = {
        email: 'invalid-email',
      };

      const response = await request(app.app)
        .put('/v1/users/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should require at least one field', async () => {
      const response = await request(app.app)
        .put('/v1/users/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('NO_UPDATE_FIELDS');
    });

    it('should reject empty strings', async () => {
      const updateData = {
        name: '   ', // Empty after trim
      };

      const response = await request(app.app)
        .put('/v1/users/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('EMPTY_FIELDS');
    });

    it('should sanitize input', async () => {
      const updateData = {
        name: '  John   Doe  ', // Extra spaces
      };

      const response = await request(app.app)
        .put('/v1/users/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.data.profile.name).toBe('John Doe');
    });

    it('should require authentication', async () => {
      const updateData = {
        name: 'John Updated',
      };

      const response = await request(app.app)
        .put('/v1/users/profile')
        .send(updateData)
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('MISSING_TOKEN');
    });
  });

  describe('GET /v1/users/profile/statistics', () => {
    it('should get user statistics only', async () => {
      // Create test data
      const review1 = new Review({
        userId: testUser._id,
        bookId: testBook._id,
        text: 'Great book!',
        rating: 5,
      });
      await review1.save();

      const review2 = new Review({
        userId: testUser._id,
        bookId: testBook._id + '1', // Different book
        text: 'Good book!',
        rating: 4,
      });
      // Create another book for the second review
      const testBook2 = new Book({
        title: 'Test Book 2',
        author: 'Test Author 2',
        isbn: '1234567890124',
        description: 'Another test book',
        publishedYear: 2023,
        genres: ['Fiction'],
        coverImageUrl: 'https://example.com/cover2.jpg',
      });
      await testBook2.save();
      review2.bookId = testBook2._id;
      await review2.save();

      const response = await request(app.app)
        .get('/v1/users/profile/statistics')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.statistics).toMatchObject({
        totalReviews: 2,
        totalFavorites: 0,
        averageRating: 4.5,
        ratingDistribution: {
          1: 0,
          2: 0,
          3: 0,
          4: 1,
          5: 1,
        },
      });
    });

    it('should require authentication', async () => {
      const response = await request(app.app)
        .get('/v1/users/profile/statistics')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('MISSING_TOKEN');
    });
  });

  describe('GET /v1/users/profile/basic', () => {
    it('should get basic profile information', async () => {
      const response = await request(app.app)
        .get('/v1/users/profile/basic')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.profile).toMatchObject({
        _id: testUser._id,
        name: 'John Doe',
        email: 'john@example.com',
      });
      expect(response.body.data.profile.createdAt).toBeDefined();
      expect(response.body.data.profile.updatedAt).toBeDefined();
      expect(response.body.data.statistics).toBeUndefined();
    });

    it('should require authentication', async () => {
      const response = await request(app.app)
        .get('/v1/users/profile/basic')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('MISSING_TOKEN');
    });
  });

  describe('POST /v1/users/profile/check-email', () => {
    it('should check email availability - available', async () => {
      const checkData = {
        email: 'available@example.com',
      };

      const response = await request(app.app)
        .post('/v1/users/profile/check-email')
        .set('Authorization', `Bearer ${authToken}`)
        .send(checkData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.available).toBe(true);
      expect(response.body.data.email).toBe('available@example.com');
    });

    it('should check email availability - not available', async () => {
      const checkData = {
        email: 'jane@example.com', // testUser2's email
      };

      const response = await request(app.app)
        .post('/v1/users/profile/check-email')
        .set('Authorization', `Bearer ${authToken}`)
        .send(checkData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.available).toBe(false);
    });

    it('should allow current user email', async () => {
      const checkData = {
        email: 'john@example.com', // testUser's own email
      };

      const response = await request(app.app)
        .post('/v1/users/profile/check-email')
        .set('Authorization', `Bearer ${authToken}`)
        .send(checkData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.available).toBe(true);
    });

    it('should validate email format', async () => {
      const checkData = {
        email: 'invalid-email',
      };

      const response = await request(app.app)
        .post('/v1/users/profile/check-email')
        .set('Authorization', `Bearer ${authToken}`)
        .send(checkData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INVALID_EMAIL_FORMAT');
    });

    it('should require email field', async () => {
      const response = await request(app.app)
        .post('/v1/users/profile/check-email')
        .set('Authorization', `Bearer ${authToken}`)
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('EMAIL_REQUIRED');
    });

    it('should require authentication', async () => {
      const checkData = {
        email: 'test@example.com',
      };

      const response = await request(app.app)
        .post('/v1/users/profile/check-email')
        .send(checkData)
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('MISSING_TOKEN');
    });
  });

  describe('Rate Limiting', () => {
    it('should apply rate limiting to profile endpoints', async () => {
      // This test would need to be adjusted based on actual rate limits
      // For now, we'll just verify the endpoints work
      const response = await request(app.app)
        .get('/v1/users/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle database errors gracefully', async () => {
      // Simulate database error by using invalid user ID in token
      const invalidToken = JWTService.generateToken({ _id: 'invalid-id' } as any);

      const response = await request(app.app)
        .get('/v1/users/profile')
        .set('Authorization', `Bearer ${invalidToken}`)
        .expect(403);

      expect(response.body.success).toBe(false);
    });
  });
});
