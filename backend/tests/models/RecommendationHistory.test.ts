import mongoose from 'mongoose';
import { RecommendationHistory, User } from '../../src/models';
import type { IRecommendationHistory } from '../../src/models';

describe('RecommendationHistory Model', () => {
  let testUserId: any;

  beforeAll(async () => {
    // Ensure database connection
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/book_review_platform_test');
    }

    // Create test user
    const testUser = await User.create({
      name: 'Test User',
      email: 'test@example.com',
      password: 'password123',
    });
    testUserId = testUser._id;
  });

  afterAll(async () => {
    // Clean up
    await Promise.all([
      RecommendationHistory.deleteMany({}),
      User.deleteMany({}),
    ]);
    await mongoose.connection.close();
  });

  beforeEach(async () => {
    // Clear recommendation history before each test
    await RecommendationHistory.deleteMany({});
  });

  describe('Schema Validation', () => {
    it('should create a valid recommendation history', async () => {
      const recommendationData = {
        userId: testUserId,
        recommendations: [
          {
            title: 'Test Book',
            author: 'Test Author',
            genre: 'Fiction',
            reason: 'This book matches your preference for fiction novels.',
            confidence: 0.85,
            source: 'ai' as const,
            averageRating: 4.2,
            reviewCount: 150,
          },
          {
            title: 'Another Book',
            author: 'Another Author',
            reason: 'Based on your reading history.',
            confidence: 0.75,
            source: 'fallback' as const,
          },
        ],
        metadata: {
          generatedAt: new Date(),
          source: 'hybrid' as const,
          userPreferences: {
            favoriteGenres: ['Fiction', 'Mystery'],
            averageRating: 4.2,
            totalReviews: 5,
            hasEnoughData: true,
          },
          processingTime: 1250,
          openaiModel: 'gpt-3.5-turbo',
          cacheHit: false,
        },
        expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
        isActive: true,
      };

      const recommendation = new RecommendationHistory(recommendationData);
      const savedRecommendation = await recommendation.save();

      expect(savedRecommendation._id).toBeDefined();
      expect(savedRecommendation.userId.toString()).toBe(testUserId.toString());
      expect(savedRecommendation.recommendations).toHaveLength(2);
      expect(savedRecommendation.metadata.source).toBe('hybrid');
      expect(savedRecommendation.isActive).toBe(true);
    });

    it('should require userId', async () => {
      const recommendationData = {
        recommendations: [
          {
            title: 'Test Book',
            author: 'Test Author',
            reason: 'Test reason',
            confidence: 0.85,
            source: 'ai' as const,
          },
        ],
        metadata: {
          generatedAt: new Date(),
          source: 'ai' as const,
          userPreferences: {
            favoriteGenres: [],
            averageRating: 0,
            totalReviews: 0,
            hasEnoughData: false,
          },
          processingTime: 1000,
          cacheHit: false,
        },
      };

      const recommendation = new RecommendationHistory(recommendationData);
      
      await expect(recommendation.save()).rejects.toThrow();
    });

    it('should require at least one recommendation', async () => {
      const recommendationData = {
        userId: testUserId,
        recommendations: [],
        metadata: {
          generatedAt: new Date(),
          source: 'ai' as const,
          userPreferences: {
            favoriteGenres: [],
            averageRating: 0,
            totalReviews: 0,
            hasEnoughData: false,
          },
          processingTime: 1000,
          cacheHit: false,
        },
      };

      const recommendation = new RecommendationHistory(recommendationData);
      
      await expect(recommendation.save()).rejects.toThrow();
    });

    it('should validate confidence scores', async () => {
      const recommendationData = {
        userId: testUserId,
        recommendations: [
          {
            title: 'Test Book',
            author: 'Test Author',
            reason: 'Test reason',
            confidence: 1.5, // Invalid - should be <= 1
            source: 'ai' as const,
          },
        ],
        metadata: {
          generatedAt: new Date(),
          source: 'ai' as const,
          userPreferences: {
            favoriteGenres: [],
            averageRating: 0,
            totalReviews: 0,
            hasEnoughData: false,
          },
          processingTime: 1000,
          cacheHit: false,
        },
      };

      const recommendation = new RecommendationHistory(recommendationData);
      
      await expect(recommendation.save()).rejects.toThrow();
    });

    it('should validate source enum values', async () => {
      const recommendationData = {
        userId: testUserId,
        recommendations: [
          {
            title: 'Test Book',
            author: 'Test Author',
            reason: 'Test reason',
            confidence: 0.85,
            source: 'invalid' as any, // Invalid source
          },
        ],
        metadata: {
          generatedAt: new Date(),
          source: 'ai' as const,
          userPreferences: {
            favoriteGenres: [],
            averageRating: 0,
            totalReviews: 0,
            hasEnoughData: false,
          },
          processingTime: 1000,
          cacheHit: false,
        },
      };

      const recommendation = new RecommendationHistory(recommendationData);
      
      await expect(recommendation.save()).rejects.toThrow();
    });

    it('should set default expiresAt if not provided', async () => {
      const recommendationData = {
        userId: testUserId,
        recommendations: [
          {
            title: 'Test Book',
            author: 'Test Author',
            reason: 'Test reason',
            confidence: 0.85,
            source: 'ai' as const,
          },
        ],
        metadata: {
          generatedAt: new Date(),
          source: 'ai' as const,
          userPreferences: {
            favoriteGenres: [],
            averageRating: 0,
            totalReviews: 0,
            hasEnoughData: false,
          },
          processingTime: 1000,
          cacheHit: false,
        },
      };

      const recommendation = new RecommendationHistory(recommendationData);
      const savedRecommendation = await recommendation.save();

      expect(savedRecommendation.expiresAt).toBeDefined();
      expect(savedRecommendation.expiresAt.getTime()).toBeGreaterThan(Date.now());
    });
  });

  describe('Instance Methods', () => {
    let testRecommendation: IRecommendationHistory;

    beforeEach(async () => {
      const recommendationData = {
        userId: testUserId,
        recommendations: [
          {
            title: 'Test Book',
            author: 'Test Author',
            reason: 'Test reason',
            confidence: 0.85,
            source: 'ai' as const,
          },
        ],
        metadata: {
          generatedAt: new Date(),
          source: 'ai' as const,
          userPreferences: {
            favoriteGenres: ['Fiction'],
            averageRating: 4.0,
            totalReviews: 3,
            hasEnoughData: true,
          },
          processingTime: 1000,
          cacheHit: false,
        },
        expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
        isActive: true,
      };

      testRecommendation = await RecommendationHistory.create(recommendationData);
    });

    it('should check if recommendation is expired', () => {
      expect(testRecommendation.isExpired()).toBe(false);

      // Test with expired recommendation
      testRecommendation.expiresAt = new Date(Date.now() - 1000); // 1 second ago
      expect(testRecommendation.isExpired()).toBe(true);
    });

    it('should deactivate recommendation', async () => {
      expect(testRecommendation.isActive).toBe(true);

      await testRecommendation.deactivate();
      expect(testRecommendation.isActive).toBe(false);

      // Verify in database
      const updated = await RecommendationHistory.findById(testRecommendation._id);
      expect(updated?.isActive).toBe(false);
    });
  });

  describe('Static Methods', () => {
    beforeEach(async () => {
      // Create test data
      const now = new Date();
      const oneHourLater = new Date(now.getTime() + 60 * 60 * 1000);
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

      await RecommendationHistory.create([
        {
          userId: testUserId,
          recommendations: [
            {
              title: 'Active Book 1',
              author: 'Author 1',
              reason: 'Test reason',
              confidence: 0.85,
              source: 'ai',
            },
          ],
          metadata: {
            generatedAt: now,
            source: 'ai',
            userPreferences: {
              favoriteGenres: ['Fiction'],
              averageRating: 4.0,
              totalReviews: 3,
              hasEnoughData: true,
            },
            processingTime: 1000,
            cacheHit: false,
          },
          expiresAt: oneHourLater,
          isActive: true,
        },
        {
          userId: testUserId,
          recommendations: [
            {
              title: 'Expired Book',
              author: 'Author 2',
              reason: 'Test reason',
              confidence: 0.75,
              source: 'fallback',
            },
          ],
          metadata: {
            generatedAt: new Date(now.getTime() - 2 * 60 * 60 * 1000),
            source: 'fallback',
            userPreferences: {
              favoriteGenres: ['Fiction'],
              averageRating: 4.0,
              totalReviews: 3,
              hasEnoughData: true,
            },
            processingTime: 800,
            cacheHit: false,
          },
          expiresAt: oneHourAgo,
          isActive: true,
        },
        {
          userId: testUserId,
          recommendations: [
            {
              title: 'Inactive Book',
              author: 'Author 3',
              reason: 'Test reason',
              confidence: 0.90,
              source: 'ai',
            },
          ],
          metadata: {
            generatedAt: now,
            source: 'ai',
            userPreferences: {
              favoriteGenres: ['Fiction'],
              averageRating: 4.0,
              totalReviews: 3,
              hasEnoughData: true,
            },
            processingTime: 1200,
            cacheHit: false,
          },
          expiresAt: oneHourLater,
          isActive: false,
        },
      ]);
    });

    it('should find active recommendation for user', async () => {
      const activeRec = await (RecommendationHistory as any).findActiveForUser(testUserId.toString());
      
      expect(activeRec).toBeTruthy();
      expect(activeRec.isActive).toBe(true);
      expect(activeRec.recommendations[0].title).toBe('Active Book 1');
      expect(activeRec.isExpired()).toBe(false);
    });

    it('should return null if no active recommendation found', async () => {
      const nonExistentUserId = new mongoose.Types.ObjectId();
      const activeRec = await (RecommendationHistory as any).findActiveForUser(nonExistentUserId.toString());
      
      expect(activeRec).toBeNull();
    });

    it('should get user history', async () => {
      const history = await (RecommendationHistory as any).getUserHistory(testUserId.toString(), 10, 0);
      
      expect(history).toHaveLength(3);
      expect(history[0].createdAt.getTime()).toBeGreaterThanOrEqual(history[1].createdAt.getTime());
    });

    it('should get analytics', async () => {
      const analytics = await (RecommendationHistory as any).getAnalytics();
      
      expect(analytics).toBeInstanceOf(Array);
      expect(analytics.length).toBeGreaterThan(0);
      
      const aiAnalytics = analytics.find((a: any) => a._id === 'ai');
      const fallbackAnalytics = analytics.find((a: any) => a._id === 'fallback');
      
      expect(aiAnalytics).toBeTruthy();
      expect(fallbackAnalytics).toBeTruthy();
      expect(aiAnalytics.count).toBe(2);
      expect(fallbackAnalytics.count).toBe(1);
    });

    it('should get analytics with date range', async () => {
      const startDate = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours ago
      const endDate = new Date();
      
      const analytics = await (RecommendationHistory as any).getAnalytics(startDate, endDate);
      
      expect(analytics).toBeInstanceOf(Array);
      expect(analytics.length).toBeGreaterThan(0);
    });
  });

  describe('Indexes and Performance', () => {
    it('should have proper indexes', async () => {
      const indexes = await RecommendationHistory.collection.getIndexes();
      
      // Check for expected indexes
      const indexNames = Object.keys(indexes);
      expect(indexNames).toContain('userId_1');
      expect(indexNames).toContain('createdAt_1');
      expect(indexNames).toContain('isActive_1');
      expect(indexNames).toContain('expiresAt_1');
    });

    it('should handle TTL expiration', async () => {
      // Create a recommendation that expires immediately
      const expiredRec = await RecommendationHistory.create({
        userId: testUserId,
        recommendations: [
          {
            title: 'TTL Test Book',
            author: 'TTL Author',
            reason: 'TTL test',
            confidence: 0.85,
            source: 'ai',
          },
        ],
        metadata: {
          generatedAt: new Date(),
          source: 'ai',
          userPreferences: {
            favoriteGenres: [],
            averageRating: 0,
            totalReviews: 0,
            hasEnoughData: false,
          },
          processingTime: 1000,
          cacheHit: false,
        },
        expiresAt: new Date(Date.now() - 1000), // Already expired
        isActive: true,
      });

      expect(expiredRec._id).toBeDefined();
      
      // Note: TTL deletion happens in background, so we just verify the document was created
      // In a real scenario, MongoDB would delete this automatically
    });
  });

  describe('Population and References', () => {
    it('should populate user information', async () => {
      const recommendation = await RecommendationHistory.create({
        userId: testUserId,
        recommendations: [
          {
            title: 'Population Test',
            author: 'Test Author',
            reason: 'Test reason',
            confidence: 0.85,
            source: 'ai',
          },
        ],
        metadata: {
          generatedAt: new Date(),
          source: 'ai',
          userPreferences: {
            favoriteGenres: [],
            averageRating: 0,
            totalReviews: 0,
            hasEnoughData: false,
          },
          processingTime: 1000,
          cacheHit: false,
        },
      });

      const populated = await RecommendationHistory
        .findById(recommendation._id)
        .populate('userId', 'name email');

      expect(populated?.userId).toBeTruthy();
      expect((populated?.userId as any).name).toBe('Test User');
      expect((populated?.userId as any).email).toBe('test@example.com');
    });
  });
});
