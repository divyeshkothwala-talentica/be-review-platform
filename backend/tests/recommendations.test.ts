import request from 'supertest';
import mongoose from 'mongoose';
import app from '../src/app';
import User from '../src/models/User';
import Book from '../src/models/Book';
import Review from '../src/models/Review';
import Favorite from '../src/models/Favorite';
import { RecommendationHistory, RecommendationFeedback } from '../src/models';
import recommendationsService from '../src/services/recommendationsService';
import openaiService from '../src/services/openaiService';
import { JWTService } from '../src/services/jwtService';

const jwtService = new JWTService();

describe('Recommendations API', () => {
  let authToken: string;
  let userId: string;
  let testBooks: any[] = [];
  let testUser: any;

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
      RecommendationHistory.deleteMany({}),
      RecommendationFeedback.deleteMany({}),
    ]);

    // Create test user
    testUser = await User.create({
      name: 'Test User',
      email: 'test@example.com',
      password: 'password123',
    });
    userId = testUser._id;

    // Generate auth token
    authToken = jwtService.generateToken({
      id: userId,
      email: testUser.email,
    });

    // Create test books with different genres
    const booksData = [
      {
        title: 'The Great Gatsby',
        author: 'F. Scott Fitzgerald',
        genres: ['Fiction'],
        publishedYear: 1925,
        description: 'A classic American novel about the Jazz Age',
        coverImageUrl: 'https://example.com/gatsby.jpg',
      },
      {
        title: 'To Kill a Mockingbird',
        author: 'Harper Lee',
        genres: ['Fiction'],
        publishedYear: 1960,
        description: 'A gripping tale of racial injustice and moral growth',
        coverImageUrl: 'https://example.com/mockingbird.jpg',
      },
      {
        title: 'Dune',
        author: 'Frank Herbert',
        genres: ['Science Fiction'],
        publishedYear: 1965,
        description: 'Epic science fiction novel set on the desert planet Arrakis',
        coverImageUrl: 'https://example.com/dune.jpg',
      },
      {
        title: 'The Hobbit',
        author: 'J.R.R. Tolkien',
        genres: ['Fantasy'],
        publishedYear: 1937,
        description: 'A fantasy adventure about a hobbit\'s unexpected journey',
        coverImageUrl: 'https://example.com/hobbit.jpg',
      },
      {
        title: '1984',
        author: 'George Orwell',
        genres: ['Science Fiction', 'Fiction'],
        publishedYear: 1949,
        description: 'A dystopian social science fiction novel about totalitarianism',
        coverImageUrl: 'https://example.com/1984.jpg',
      },
      {
        title: 'Pride and Prejudice',
        author: 'Jane Austen',
        genres: ['Romance', 'Fiction'],
        publishedYear: 1813,
        description: 'A romantic novel about love and social class in Regency England',
        coverImageUrl: 'https://example.com/pride.jpg',
      },
    ];

    testBooks = await Book.insertMany(booksData);

    // Create some reviews to establish user preferences
    await Review.create({
      userId,
      bookId: testBooks[0]._id, // The Great Gatsby
      text: 'Excellent classic fiction!',
      rating: 5,
    });

    await Review.create({
      userId,
      bookId: testBooks[1]._id, // To Kill a Mockingbird
      text: 'Powerful and moving story.',
      rating: 5,
    });

    await Review.create({
      userId,
      bookId: testBooks[2]._id, // Dune
      text: 'Great sci-fi epic.',
      rating: 4,
    });

    // Add some favorites
    await Favorite.create({
      userId,
      bookId: testBooks[0]._id, // The Great Gatsby
    });

    await Favorite.create({
      userId,
      bookId: testBooks[3]._id, // The Hobbit
    });
  });

  afterAll(async () => {
    // Clean up
    await Promise.all([
      User.deleteMany({}),
      Book.deleteMany({}),
      Review.deleteMany({}),
      Favorite.deleteMany({}),
      RecommendationHistory.deleteMany({}),
      RecommendationFeedback.deleteMany({}),
    ]);
    
    // Clear recommendation cache
    await recommendationsService.clearCache();
    
    // Close database connection
    await mongoose.connection.close();
  });

  beforeEach(async () => {
    // Clear cache before each test
    await recommendationsService.clearCache();
  });

  describe('GET /api/v1/recommendations', () => {
    it('should return recommendations for authenticated user', async () => {
      const response = await request(app)
        .get('/api/v1/recommendations')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('recommendations');
      expect(response.body.data).toHaveProperty('metadata');
      expect(response.body.data.recommendations).toBeInstanceOf(Array);
      expect(response.body.data.recommendations.length).toBeGreaterThan(0);
      expect(response.body.data.recommendations.length).toBeLessThanOrEqual(3);

      // Check recommendation structure
      const recommendation = response.body.data.recommendations[0];
      expect(recommendation).toHaveProperty('title');
      expect(recommendation).toHaveProperty('author');
      expect(recommendation).toHaveProperty('reason');
      expect(recommendation).toHaveProperty('confidence');
      expect(recommendation).toHaveProperty('source');
      expect(recommendation.confidence).toBeGreaterThan(0);
      expect(recommendation.confidence).toBeLessThanOrEqual(1);
      expect(['ai', 'fallback']).toContain(recommendation.source);
    });

    it('should return 401 for unauthenticated requests', async () => {
      const response = await request(app)
        .get('/api/v1/recommendations')
        .expect(401);

      expect(response.body.success).toBe(false);
    });

    it('should return cached recommendations on subsequent requests', async () => {
      // First request
      const response1 = await request(app)
        .get('/api/v1/recommendations')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const generatedAt1 = response1.body.data.metadata.generatedAt;

      // Second request (should be cached)
      const response2 = await request(app)
        .get('/api/v1/recommendations')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const generatedAt2 = response2.body.data.metadata.generatedAt;

      // Should return the same cached response
      expect(generatedAt1).toBe(generatedAt2);
      expect(response1.body.data.recommendations).toEqual(response2.body.data.recommendations);
    });

    it('should respect rate limiting', async () => {
      const requests = [];
      
      // Make 11 requests (rate limit is 10 per 10 minutes)
      for (let i = 0; i < 11; i++) {
        requests.push(
          request(app)
            .get('/api/v1/recommendations')
            .set('Authorization', `Bearer ${authToken}`)
        );
      }

      const responses = await Promise.all(requests);
      
      // First 10 should succeed, 11th should be rate limited
      const successfulResponses = responses.filter(r => r.status === 200);
      const rateLimitedResponses = responses.filter(r => r.status === 429);

      expect(successfulResponses.length).toBe(1); // Only first one due to caching
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    });

    it('should include user preference metadata', async () => {
      const response = await request(app)
        .get('/api/v1/recommendations')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const metadata = response.body.data.metadata;
      expect(metadata).toHaveProperty('userId');
      expect(metadata).toHaveProperty('generatedAt');
      expect(metadata).toHaveProperty('source');
      expect(metadata).toHaveProperty('userPreferences');
      expect(metadata.userPreferences).toHaveProperty('favoriteGenres');
      expect(metadata.userPreferences).toHaveProperty('averageRating');
      expect(metadata.userPreferences).toHaveProperty('totalReviews');
      expect(metadata.userPreferences).toHaveProperty('hasEnoughData');
      expect(metadata).toHaveProperty('processingTime');

      expect(metadata.userId).toBe(userId);
      expect(metadata.userPreferences.totalReviews).toBe(3);
      expect(metadata.userPreferences.hasEnoughData).toBe(true);
      expect(metadata.userPreferences.favoriteGenres).toContain('Fiction');
    });
  });

  describe('DELETE /api/v1/recommendations/cache', () => {
    it('should invalidate user cache', async () => {
      // First, get recommendations to populate cache
      await request(app)
        .get('/api/v1/recommendations')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Invalidate cache
      const response = await request(app)
        .delete('/api/v1/recommendations/cache')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('invalidated');
    });

    it('should return 401 for unauthenticated requests', async () => {
      await request(app)
        .delete('/api/v1/recommendations/cache')
        .expect(401);
    });
  });

  describe('GET /api/v1/recommendations/health', () => {
    it('should return system health status', async () => {
      const response = await request(app)
        .get('/api/v1/recommendations/health')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('status');
      expect(response.body.data).toHaveProperty('services');
      expect(response.body.data).toHaveProperty('timestamp');

      const services = response.body.data.services;
      expect(services).toHaveProperty('openai');
      expect(services).toHaveProperty('fallback');
      expect(services).toHaveProperty('cache');

      expect(services.fallback.status).toBe('operational');
      expect(services.cache.status).toBe('operational');
    });

    it('should be accessible without authentication', async () => {
      const response = await request(app)
        .get('/api/v1/recommendations/health')
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  describe('GET /api/v1/recommendations/cache/stats', () => {
    it('should return cache statistics', async () => {
      // Populate cache first
      await request(app)
        .get('/api/v1/recommendations')
        .set('Authorization', `Bearer ${authToken}`);

      const response = await request(app)
        .get('/api/v1/recommendations/cache/stats')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('cache');
      expect(response.body.data).toHaveProperty('timestamp');
      expect(response.body.data.cache).toHaveProperty('size');
      expect(response.body.data.cache).toHaveProperty('entries');
      expect(response.body.data.cache.entries).toBeInstanceOf(Array);
    });
  });

  describe('DELETE /api/v1/recommendations/cache/all', () => {
    it('should clear all cache', async () => {
      // Populate cache first
      await request(app)
        .get('/api/v1/recommendations')
        .set('Authorization', `Bearer ${authToken}`);

      const response = await request(app)
        .delete('/api/v1/recommendations/cache/all')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('cleared');

      // Verify memory cache is empty
      const statsResponse = await request(app)
        .get('/api/v1/recommendations/cache/stats')
        .expect(200);

      expect(statsResponse.body.data.cache.size).toBe(0);
      
      // Verify database cache is also cleared
      const activeCount = await RecommendationHistory.countDocuments({ isActive: true });
      expect(activeCount).toBe(0);
    });
  });

  describe('Fallback System Tests', () => {
    it('should work when OpenAI is unavailable', async () => {
      // Mock OpenAI service to be unavailable
      const originalIsAvailable = openaiService.isAvailable;
      openaiService.isAvailable = jest.fn().mockReturnValue(false);

      const response = await request(app)
        .get('/api/v1/recommendations')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.data.metadata.source).toBe('fallback');
      expect(response.body.data.recommendations.length).toBeGreaterThan(0);

      // Restore original method
      openaiService.isAvailable = originalIsAvailable;
    });

    it('should provide genre-based recommendations', async () => {
      // Mock OpenAI to be unavailable to force fallback
      const originalIsAvailable = openaiService.isAvailable;
      openaiService.isAvailable = jest.fn().mockReturnValue(false);

      const response = await request(app)
        .get('/api/v1/recommendations')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const recommendations = response.body.data.recommendations;
      
      // Should have recommendations
      expect(recommendations.length).toBeGreaterThan(0);
      
      // All should be from fallback system
      recommendations.forEach((rec: any) => {
        expect(rec.source).toBe('fallback');
        expect(rec.confidence).toBeGreaterThan(0);
        expect(rec.reason).toBeTruthy();
      });

      // Restore original method
      openaiService.isAvailable = originalIsAvailable;
    });
  });

  describe('Cache Invalidation Integration', () => {
    it('should invalidate cache when user creates a review', async () => {
      // Get initial recommendations
      const response1 = await request(app)
        .get('/api/v1/recommendations')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const generatedAt1 = response1.body.data.metadata.generatedAt;

      // Create a new review (this should invalidate cache)
      await request(app)
        .post('/api/v1/reviews')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          bookId: testBooks[4]._id, // 1984
          text: 'Thought-provoking dystopian novel',
          rating: 4,
        })
        .expect(201);

      // Get recommendations again (should be fresh)
      const response2 = await request(app)
        .get('/api/v1/recommendations')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const generatedAt2 = response2.body.data.metadata.generatedAt;

      // Should be different timestamps (new generation)
      expect(generatedAt1).not.toBe(generatedAt2);
    });

    it('should invalidate cache when user adds to favorites', async () => {
      // Clear cache first
      await recommendationsService.clearCache();

      // Get initial recommendations
      const response1 = await request(app)
        .get('/api/v1/recommendations')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const generatedAt1 = response1.body.data.metadata.generatedAt;

      // Add to favorites (this should invalidate cache)
      await request(app)
        .post('/api/v1/favorites')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          bookId: testBooks[5]._id, // Pride and Prejudice
        })
        .expect(201);

      // Get recommendations again (should be fresh)
      const response2 = await request(app)
        .get('/api/v1/recommendations')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const generatedAt2 = response2.body.data.metadata.generatedAt;

      // Should be different timestamps (new generation)
      expect(generatedAt1).not.toBe(generatedAt2);
    });
  });

  describe('User with No Data', () => {
    let newUser: any;
    let newUserToken: string;

    beforeAll(async () => {
      // Create user with no reviews or favorites
      newUser = await User.create({
        name: 'New User',
        email: 'newuser@example.com',
        password: 'password123',
      });

      newUserToken = jwtService.generateToken({
        id: newUser._id,
        email: newUser.email,
      });
    });

    afterAll(async () => {
      await User.findByIdAndDelete(newUser._id);
    });

    it('should provide recommendations for users with no data', async () => {
      const response = await request(app)
        .get('/api/v1/recommendations')
        .set('Authorization', `Bearer ${newUserToken}`)
        .expect(200);

      expect(response.body.data.recommendations.length).toBeGreaterThan(0);
      expect(response.body.data.metadata.source).toBe('fallback');
      expect(response.body.data.metadata.userPreferences.hasEnoughData).toBe(false);
    });
  });

  describe('Performance Tests', () => {
    it('should respond within reasonable time', async () => {
      const startTime = Date.now();
      
      await request(app)
        .get('/api/v1/recommendations')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const endTime = Date.now();
      const responseTime = endTime - startTime;

      // Should respond within 5 seconds (including potential AI call)
      expect(responseTime).toBeLessThan(5000);
    });

    it('should have fast cached responses', async () => {
      // First request to populate cache
      await request(app)
        .get('/api/v1/recommendations')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Second request should be fast (cached)
      const startTime = Date.now();
      
      await request(app)
        .get('/api/v1/recommendations')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const endTime = Date.now();
      const responseTime = endTime - startTime;

      // Cached response should be very fast
      expect(responseTime).toBeLessThan(500);
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid user ID gracefully', async () => {
      const invalidToken = jwtService.generateToken({
        id: 'invalid-user-id',
        email: 'invalid@example.com',
      });

      const response = await request(app)
        .get('/api/v1/recommendations')
        .set('Authorization', `Bearer ${invalidToken}`)
        .expect(500);

      expect(response.body.success).toBe(false);
    });

    it('should handle malformed auth token', async () => {
      await request(app)
        .get('/api/v1/recommendations')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);
    });
  });
});
