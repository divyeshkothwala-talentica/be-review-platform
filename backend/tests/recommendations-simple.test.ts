import request from 'supertest';
import mongoose from 'mongoose';
import app from '../src/app';
import User from '../src/models/User';
import Book from '../src/models/Book';
import Review from '../src/models/Review';
import Favorite from '../src/models/Favorite';
import recommendationsService from '../src/services/recommendationsService';
import { JWTService } from '../src/services/jwtService';

describe('Recommendations API - Simple Tests', () => {
  let authToken: string;
  let userId: string;
  let testUser: any;
  let testBook: any;

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
    userId = testUser._id;

    // Generate auth token
    authToken = JWTService.generateToken(testUser);

    // Create a test book
    testBook = await Book.create({
      title: 'Test Book',
      author: 'Test Author',
      genres: ['Fiction'],
      publishedYear: 2020,
      description: 'A test book for recommendations testing',
      coverImageUrl: 'https://example.com/test-cover.jpg',
    });

    // Create a review to give user some preferences
    await Review.create({
      userId,
      bookId: testBook._id,
      text: 'Great book!',
      rating: 5,
    });
  });

  afterAll(async () => {
    // Clean up
    await Promise.all([
      User.deleteMany({}),
      Book.deleteMany({}),
      Review.deleteMany({}),
      Favorite.deleteMany({}),
    ]);
    
    // Clear recommendation cache
    recommendationsService.clearCache();
    
    // Close database connection
    await mongoose.connection.close();
  });

  beforeEach(() => {
    // Clear cache before each test
    recommendationsService.clearCache();
  });

  describe('GET /api/v1/recommendations', () => {
    it('should return 401 for unauthenticated requests', async () => {
      const response = await request(app)
        .get('/api/v1/recommendations')
        .expect(401);

      expect(response.body.success).toBe(false);
    });

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

    it('should include metadata in response', async () => {
      const response = await request(app)
        .get('/api/v1/recommendations')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const metadata = response.body.data.metadata;
      expect(metadata).toHaveProperty('userId');
      expect(metadata).toHaveProperty('generatedAt');
      expect(metadata).toHaveProperty('source');
      expect(metadata).toHaveProperty('userPreferences');
      expect(metadata).toHaveProperty('processingTime');

      expect(metadata.userId).toBe(userId);
      expect(['ai', 'fallback', 'hybrid']).toContain(metadata.source);
    });
  });

  describe('DELETE /api/v1/recommendations/cache', () => {
    it('should invalidate user cache', async () => {
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
      const response = await request(app)
        .delete('/api/v1/recommendations/cache/all')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('cleared');
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

      // Should respond within 10 seconds (including potential AI call)
      expect(responseTime).toBeLessThan(10000);
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
      expect(responseTime).toBeLessThan(1000);
    });
  });

  describe('Error Handling', () => {
    it('should handle malformed auth token', async () => {
      await request(app)
        .get('/api/v1/recommendations')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);
    });

    it('should handle missing auth header', async () => {
      await request(app)
        .get('/api/v1/recommendations')
        .expect(401);
    });
  });
});
