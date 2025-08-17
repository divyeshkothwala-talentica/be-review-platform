import mongoose from 'mongoose';
import { RecommendationFeedback, RecommendationHistory, User } from '../../src/models';
import type { IRecommendationFeedback, IRecommendationHistory } from '../../src/models';

describe('RecommendationFeedback Model', () => {
  let testUserId: any;
  let testRecommendationId: any;

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

    // Create test recommendation history
    const testRecommendation = await RecommendationHistory.create({
      userId: testUserId,
      recommendations: [
        {
          title: 'Test Book',
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
          favoriteGenres: ['Fiction'],
          averageRating: 4.0,
          totalReviews: 3,
          hasEnoughData: true,
        },
        processingTime: 1000,
        cacheHit: false,
      },
    });
    testRecommendationId = testRecommendation._id;
  });

  afterAll(async () => {
    // Clean up
    await Promise.all([
      RecommendationFeedback.deleteMany({}),
      RecommendationHistory.deleteMany({}),
      User.deleteMany({}),
    ]);
    await mongoose.connection.close();
  });

  beforeEach(async () => {
    // Clear feedback before each test
    await RecommendationFeedback.deleteMany({});
  });

  describe('Schema Validation', () => {
    it('should create valid recommendation feedback', async () => {
      const feedbackData = {
        userId: testUserId,
        recommendationHistoryId: testRecommendationId,
        bookTitle: 'Test Book',
        bookAuthor: 'Test Author',
        feedbackType: 'like' as const,
        rating: 4,
        comment: 'Great recommendation!',
        actionTaken: 'added_to_favorites' as const,
      };

      const feedback = new RecommendationFeedback(feedbackData);
      const savedFeedback = await feedback.save();

      expect(savedFeedback._id).toBeDefined();
      expect(savedFeedback.userId.toString()).toBe(testUserId.toString());
      expect(savedFeedback.recommendationHistoryId.toString()).toBe(testRecommendationId.toString());
      expect(savedFeedback.feedbackType).toBe('like');
      expect(savedFeedback.rating).toBe(4);
      expect(savedFeedback.comment).toBe('Great recommendation!');
      expect(savedFeedback.actionTaken).toBe('added_to_favorites');
    });

    it('should require userId', async () => {
      const feedbackData = {
        recommendationHistoryId: testRecommendationId,
        bookTitle: 'Test Book',
        bookAuthor: 'Test Author',
        feedbackType: 'like' as const,
      };

      const feedback = new RecommendationFeedback(feedbackData);
      
      await expect(feedback.save()).rejects.toThrow();
    });

    it('should require recommendationHistoryId', async () => {
      const feedbackData = {
        userId: testUserId,
        bookTitle: 'Test Book',
        bookAuthor: 'Test Author',
        feedbackType: 'like' as const,
      };

      const feedback = new RecommendationFeedback(feedbackData);
      
      await expect(feedback.save()).rejects.toThrow();
    });

    it('should require bookTitle and bookAuthor', async () => {
      const feedbackData = {
        userId: testUserId,
        recommendationHistoryId: testRecommendationId,
        feedbackType: 'like' as const,
      };

      const feedback = new RecommendationFeedback(feedbackData);
      
      await expect(feedback.save()).rejects.toThrow();
    });

    it('should validate feedbackType enum', async () => {
      const feedbackData = {
        userId: testUserId,
        recommendationHistoryId: testRecommendationId,
        bookTitle: 'Test Book',
        bookAuthor: 'Test Author',
        feedbackType: 'invalid' as any,
      };

      const feedback = new RecommendationFeedback(feedbackData);
      
      await expect(feedback.save()).rejects.toThrow();
    });

    it('should validate rating range', async () => {
      const feedbackData = {
        userId: testUserId,
        recommendationHistoryId: testRecommendationId,
        bookTitle: 'Test Book',
        bookAuthor: 'Test Author',
        feedbackType: 'like' as const,
        rating: 6, // Invalid - should be 1-5
      };

      const feedback = new RecommendationFeedback(feedbackData);
      
      await expect(feedback.save()).rejects.toThrow();
    });

    it('should validate rating is integer', async () => {
      const feedbackData = {
        userId: testUserId,
        recommendationHistoryId: testRecommendationId,
        bookTitle: 'Test Book',
        bookAuthor: 'Test Author',
        feedbackType: 'like' as const,
        rating: 3.5, // Invalid - should be integer
      };

      const feedback = new RecommendationFeedback(feedbackData);
      
      await expect(feedback.save()).rejects.toThrow();
    });

    it('should validate actionTaken enum', async () => {
      const feedbackData = {
        userId: testUserId,
        recommendationHistoryId: testRecommendationId,
        bookTitle: 'Test Book',
        bookAuthor: 'Test Author',
        feedbackType: 'like' as const,
        actionTaken: 'invalid' as any,
      };

      const feedback = new RecommendationFeedback(feedbackData);
      
      await expect(feedback.save()).rejects.toThrow();
    });

    it('should enforce unique constraint', async () => {
      const feedbackData = {
        userId: testUserId,
        recommendationHistoryId: testRecommendationId,
        bookTitle: 'Test Book',
        bookAuthor: 'Test Author',
        feedbackType: 'like' as const,
      };

      // Create first feedback
      await RecommendationFeedback.create(feedbackData);

      // Try to create duplicate
      const duplicateFeedback = new RecommendationFeedback(feedbackData);
      
      await expect(duplicateFeedback.save()).rejects.toThrow();
    });

    it('should trim string fields', async () => {
      const feedbackData = {
        userId: testUserId,
        recommendationHistoryId: testRecommendationId,
        bookTitle: '  Test Book  ',
        bookAuthor: '  Test Author  ',
        feedbackType: 'like' as const,
        comment: '  Great book!  ',
      };

      const feedback = await RecommendationFeedback.create(feedbackData);

      expect(feedback.bookTitle).toBe('Test Book');
      expect(feedback.bookAuthor).toBe('Test Author');
      expect(feedback.comment).toBe('Great book!');
    });

    it('should validate string length limits', async () => {
      const feedbackData = {
        userId: testUserId,
        recommendationHistoryId: testRecommendationId,
        bookTitle: 'A'.repeat(201), // Too long
        bookAuthor: 'Test Author',
        feedbackType: 'like' as const,
      };

      const feedback = new RecommendationFeedback(feedbackData);
      
      await expect(feedback.save()).rejects.toThrow();
    });
  });

  describe('Instance Methods', () => {
    let testFeedback: IRecommendationFeedback;

    beforeEach(async () => {
      testFeedback = await RecommendationFeedback.create({
        userId: testUserId,
        recommendationHistoryId: testRecommendationId,
        bookTitle: 'Test Book',
        bookAuthor: 'Test Author',
        feedbackType: 'like',
        rating: 4,
        comment: 'Good recommendation',
        actionTaken: 'added_to_favorites',
      });
    });

    it('should identify positive feedback', () => {
      expect(testFeedback.isPositive()).toBe(true);

      testFeedback.feedbackType = 'purchased';
      expect(testFeedback.isPositive()).toBe(true);

      testFeedback.feedbackType = 'added_to_wishlist';
      expect(testFeedback.isPositive()).toBe(true);

      testFeedback.feedbackType = 'dislike';
      expect(testFeedback.isPositive()).toBe(false);
    });

    it('should identify negative feedback', () => {
      testFeedback.feedbackType = 'dislike';
      expect(testFeedback.isNegative()).toBe(true);

      testFeedback.feedbackType = 'not_interested';
      expect(testFeedback.isNegative()).toBe(true);

      testFeedback.feedbackType = 'like';
      expect(testFeedback.isNegative()).toBe(false);

      testFeedback.feedbackType = 'already_read';
      expect(testFeedback.isNegative()).toBe(false);
    });

    it('should update feedback', async () => {
      const updatedFeedback = await testFeedback.updateFeedback(
        'dislike',
        2,
        'Not what I expected',
        'ignored'
      );

      expect(updatedFeedback.feedbackType).toBe('dislike');
      expect(updatedFeedback.rating).toBe(2);
      expect(updatedFeedback.comment).toBe('Not what I expected');
      expect(updatedFeedback.actionTaken).toBe('ignored');
      expect(updatedFeedback.updatedAt.getTime()).toBeGreaterThan(testFeedback.createdAt.getTime());

      // Verify in database
      const dbFeedback = await RecommendationFeedback.findById(testFeedback._id);
      expect(dbFeedback?.feedbackType).toBe('dislike');
    });
  });

  describe('Static Methods', () => {
    beforeEach(async () => {
      // Create test feedback data
      const feedbackData = [
        {
          userId: testUserId,
          recommendationHistoryId: testRecommendationId,
          bookTitle: 'Book 1',
          bookAuthor: 'Author 1',
          feedbackType: 'like',
          rating: 5,
          actionTaken: 'added_to_favorites',
        },
        {
          userId: testUserId,
          recommendationHistoryId: testRecommendationId,
          bookTitle: 'Book 2',
          bookAuthor: 'Author 2',
          feedbackType: 'dislike',
          rating: 2,
          actionTaken: 'ignored',
        },
        {
          userId: testUserId,
          recommendationHistoryId: testRecommendationId,
          bookTitle: 'Book 3',
          bookAuthor: 'Author 3',
          feedbackType: 'purchased',
          rating: 4,
          actionTaken: 'purchased',
        },
      ];

      await RecommendationFeedback.create(feedbackData);
    });

    it('should get user feedback', async () => {
      const userFeedback = await (RecommendationFeedback as any).getUserFeedback(
        testUserId.toString(),
        10,
        0
      );

      expect(userFeedback).toHaveLength(3);
      expect(userFeedback[0].createdAt.getTime()).toBeGreaterThanOrEqual(
        userFeedback[1].createdAt.getTime()
      );
    });

    it('should get recommendation feedback', async () => {
      const recFeedback = await (RecommendationFeedback as any).getRecommendationFeedback(
        testRecommendationId.toString()
      );

      expect(recFeedback).toHaveLength(3);
      expect(recFeedback.every((f: any) => f.recommendationHistoryId.toString() === testRecommendationId.toString())).toBe(true);
    });

    it('should get feedback statistics', async () => {
      const stats = await (RecommendationFeedback as any).getFeedbackStats();

      expect(stats).toHaveLength(1);
      const stat = stats[0];
      expect(stat.totalFeedback).toBe(3);
      expect(stat.feedbackBreakdown).toHaveLength(3);

      const likeStats = stat.feedbackBreakdown.find((f: any) => f.type === 'like');
      const dislikeStats = stat.feedbackBreakdown.find((f: any) => f.type === 'dislike');
      const purchasedStats = stat.feedbackBreakdown.find((f: any) => f.type === 'purchased');

      expect(likeStats.count).toBe(1);
      expect(dislikeStats.count).toBe(1);
      expect(purchasedStats.count).toBe(1);
    });

    it('should get feedback statistics for specific user', async () => {
      const stats = await (RecommendationFeedback as any).getFeedbackStats(testUserId.toString());

      expect(stats).toHaveLength(1);
      expect(stats[0].totalFeedback).toBe(3);
    });

    it('should get feedback statistics with date range', async () => {
      const startDate = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours ago
      const endDate = new Date();

      const stats = await (RecommendationFeedback as any).getFeedbackStats(
        undefined,
        startDate,
        endDate
      );

      expect(stats).toHaveLength(1);
      expect(stats[0].totalFeedback).toBe(3);
    });

    it('should get book feedback statistics', async () => {
      const bookStats = await (RecommendationFeedback as any).getBookFeedbackStats(
        'Book 1',
        'Author 1'
      );

      expect(bookStats).toHaveLength(1);
      expect(bookStats[0]._id).toBe('like');
      expect(bookStats[0].count).toBe(1);
      expect(bookStats[0].avgRating).toBe(5);
    });

    it('should get recommendation effectiveness', async () => {
      const effectiveness = await (RecommendationFeedback as any).getRecommendationEffectiveness();

      expect(effectiveness).toHaveLength(1);
      const aiEffectiveness = effectiveness.find((e: any) => e._id === 'ai');
      
      expect(aiEffectiveness).toBeTruthy();
      expect(aiEffectiveness.totalRecommendations).toBe(3);
      expect(aiEffectiveness.positiveCount).toBe(2); // like + purchased
      expect(aiEffectiveness.negativeCount).toBe(1); // dislike
      expect(aiEffectiveness.positiveRate).toBeCloseTo(2/3);
      expect(aiEffectiveness.negativeRate).toBeCloseTo(1/3);
    });

    it('should get recommendation effectiveness with date range', async () => {
      const startDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const endDate = new Date();

      const effectiveness = await (RecommendationFeedback as any).getRecommendationEffectiveness(
        startDate,
        endDate
      );

      expect(effectiveness).toHaveLength(1);
      expect(effectiveness[0].totalRecommendations).toBe(3);
    });
  });

  describe('Indexes and Performance', () => {
    it('should have proper indexes', async () => {
      const indexes = await RecommendationFeedback.collection.getIndexes();
      
      const indexNames = Object.keys(indexes);
      expect(indexNames).toContain('userId_1');
      expect(indexNames).toContain('recommendationHistoryId_1');
      expect(indexNames).toContain('feedbackType_1');
      expect(indexNames).toContain('createdAt_1');
    });

    it('should have unique compound index', async () => {
      const indexes = await RecommendationFeedback.collection.getIndexes();
      
      // Check for compound unique index
      const compoundIndex = Object.values(indexes).find((index: any) => 
        index.unique && 
        Object.keys(index.key).length === 4 &&
        index.key.userId === 1 &&
        index.key.recommendationHistoryId === 1 &&
        index.key.bookTitle === 1 &&
        index.key.bookAuthor === 1
      );
      
      expect(compoundIndex).toBeTruthy();
    });
  });

  describe('Population and References', () => {
    it('should populate user and recommendation history', async () => {
      const feedback = await RecommendationFeedback.create({
        userId: testUserId,
        recommendationHistoryId: testRecommendationId,
        bookTitle: 'Population Test',
        bookAuthor: 'Test Author',
        feedbackType: 'like',
      });

      const populated = await RecommendationFeedback
        .findById(feedback._id)
        .populate('userId', 'name email')
        .populate('recommendationHistoryId', 'metadata.source metadata.generatedAt');

      expect(populated?.userId).toBeTruthy();
      expect((populated?.userId as any).name).toBe('Test User');
      expect((populated?.userId as any).email).toBe('test@example.com');

      expect(populated?.recommendationHistoryId).toBeTruthy();
      expect((populated?.recommendationHistoryId as any).metadata.source).toBe('ai');
    });
  });

  describe('Feedback Types and Actions', () => {
    it('should handle all valid feedback types', async () => {
      const feedbackTypes = ['like', 'dislike', 'not_interested', 'already_read', 'purchased', 'added_to_wishlist'];
      
      for (let i = 0; i < feedbackTypes.length; i++) {
        const feedback = await RecommendationFeedback.create({
          userId: testUserId,
          recommendationHistoryId: testRecommendationId,
          bookTitle: `Book ${i}`,
          bookAuthor: `Author ${i}`,
          feedbackType: feedbackTypes[i],
        });

        expect(feedback.feedbackType).toBe(feedbackTypes[i]);
      }
    });

    it('should handle all valid action types', async () => {
      const actionTypes = ['viewed_details', 'added_to_favorites', 'purchased', 'reviewed_book', 'ignored'];
      
      for (let i = 0; i < actionTypes.length; i++) {
        const feedback = await RecommendationFeedback.create({
          userId: testUserId,
          recommendationHistoryId: testRecommendationId,
          bookTitle: `Action Book ${i}`,
          bookAuthor: `Action Author ${i}`,
          feedbackType: 'like',
          actionTaken: actionTypes[i],
        });

        expect(feedback.actionTaken).toBe(actionTypes[i]);
      }
    });
  });

  describe('Timestamps', () => {
    it('should set createdAt and updatedAt automatically', async () => {
      const feedback = await RecommendationFeedback.create({
        userId: testUserId,
        recommendationHistoryId: testRecommendationId,
        bookTitle: 'Timestamp Test',
        bookAuthor: 'Test Author',
        feedbackType: 'like',
      });

      expect(feedback.createdAt).toBeDefined();
      expect(feedback.updatedAt).toBeDefined();
      expect(feedback.createdAt.getTime()).toBeCloseTo(feedback.updatedAt.getTime(), -2);
    });

    it('should update updatedAt on modification', async () => {
      const feedback = await RecommendationFeedback.create({
        userId: testUserId,
        recommendationHistoryId: testRecommendationId,
        bookTitle: 'Update Test',
        bookAuthor: 'Test Author',
        feedbackType: 'like',
      });

      const originalUpdatedAt = feedback.updatedAt;

      // Wait a bit to ensure timestamp difference
      await new Promise(resolve => setTimeout(resolve, 10));

      feedback.comment = 'Updated comment';
      await feedback.save();

      expect(feedback.updatedAt.getTime()).toBeGreaterThan(originalUpdatedAt.getTime());
    });
  });
});
