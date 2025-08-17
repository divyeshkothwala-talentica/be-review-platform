import recommendationsService from '../src/services/recommendationsService';
import openaiService from '../src/services/openaiService';

describe('Recommendations Services - Basic Tests', () => {
  beforeEach(() => {
    // Clear cache before each test
    recommendationsService.clearCache();
  });

  describe('RecommendationsService', () => {
    it('should have cache management methods', () => {
      expect(typeof recommendationsService.clearCache).toBe('function');
      expect(typeof recommendationsService.getCacheStats).toBe('function');
      expect(typeof recommendationsService.invalidateUserCache).toBe('function');
    });

    it('should provide cache statistics', () => {
      const stats = recommendationsService.getCacheStats();
      expect(stats).toHaveProperty('size');
      expect(stats).toHaveProperty('entries');
      expect(stats.size).toBe(0); // Should be empty after clearCache
      expect(stats.entries).toBeInstanceOf(Array);
      expect(stats.entries.length).toBe(0);
    });

    it('should test recommendation system components', async () => {
      const testResults = await recommendationsService.testRecommendationSystem();

      expect(testResults).toHaveProperty('openaiAvailable');
      expect(testResults).toHaveProperty('fallbackWorking');
      expect(testResults).toHaveProperty('cacheWorking');

      expect(typeof testResults.openaiAvailable).toBe('boolean');
      expect(testResults.fallbackWorking).toBe(true); // Should always work
      expect(testResults.cacheWorking).toBe(true); // Should always work
    });

    it('should clear cache successfully', () => {
      // Add some dummy cache entry by calling clearCache multiple times
      recommendationsService.clearCache();
      
      const stats = recommendationsService.getCacheStats();
      expect(stats.size).toBe(0);
    });

    it('should invalidate user cache without errors', () => {
      // Should not throw error even for non-existent user
      expect(() => {
        recommendationsService.invalidateUserCache('non-existent-user');
      }).not.toThrow();
    });
  });

  describe('OpenAIService', () => {
    it('should check availability', () => {
      const isAvailable = openaiService.isAvailable();
      expect(typeof isAvailable).toBe('boolean');
    });

    it('should test connection if available', async () => {
      if (openaiService.isAvailable()) {
        const connectionTest = await openaiService.testConnection();
        expect(typeof connectionTest).toBe('boolean');
      } else {
        // If not available, should return false
        const connectionTest = await openaiService.testConnection();
        expect(connectionTest).toBe(false);
      }
    });
  });

  describe('Service Integration', () => {
    it('should handle missing OpenAI configuration gracefully', () => {
      // The service should not crash if OpenAI is not configured
      expect(() => {
        const isAvailable = openaiService.isAvailable();
        expect(typeof isAvailable).toBe('boolean');
      }).not.toThrow();
    });

    it('should provide fallback when AI is unavailable', async () => {
      // Mock OpenAI to be unavailable
      const originalIsAvailable = openaiService.isAvailable;
      openaiService.isAvailable = jest.fn().mockReturnValue(false);

      // Test that the system can still function
      const testResults = await recommendationsService.testRecommendationSystem();
      expect(testResults.openaiAvailable).toBe(false);
      expect(testResults.fallbackWorking).toBe(true);

      // Restore original method
      openaiService.isAvailable = originalIsAvailable;
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid user IDs gracefully in cache operations', () => {
      expect(() => {
        recommendationsService.invalidateUserCache('');
        recommendationsService.invalidateUserCache('invalid-id');
        recommendationsService.invalidateUserCache('123');
      }).not.toThrow();
    });

    it('should provide meaningful cache statistics', () => {
      const stats = recommendationsService.getCacheStats();
      
      expect(stats.size).toBeGreaterThanOrEqual(0);
      expect(Array.isArray(stats.entries)).toBe(true);
      expect(stats.entries.length).toBe(stats.size);
    });
  });

  describe('Performance', () => {
    it('should complete cache operations quickly', () => {
      const startTime = Date.now();
      
      recommendationsService.clearCache();
      const stats = recommendationsService.getCacheStats();
      recommendationsService.invalidateUserCache('test-user');
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      expect(duration).toBeLessThan(100); // Should be very fast
      expect(stats).toBeDefined();
    });

    it('should handle multiple cache operations', () => {
      expect(() => {
        for (let i = 0; i < 10; i++) {
          recommendationsService.invalidateUserCache(`user-${i}`);
        }
        recommendationsService.clearCache();
        recommendationsService.getCacheStats();
      }).not.toThrow();
    });
  });
});
