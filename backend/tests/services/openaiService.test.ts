import OpenAI from 'openai';
import openaiService, { BookRecommendation, RecommendationRequest } from '../../src/services/openaiService';
import config from '../../src/config';
import { logger } from '../../src/utils/logger';

// Mock dependencies
jest.mock('openai');
jest.mock('../../src/config', () => ({
  openaiApiKey: 'test-api-key',
  openaiModel: 'gpt-3.5-turbo',
  openaiMaxTokens: 1000,
  openaiTemperature: 0.7,
}));
jest.mock('../../src/utils/logger');

const MockedOpenAI = OpenAI as jest.MockedClass<typeof OpenAI>;
const mockedLogger = logger as jest.Mocked<typeof logger>;

describe('OpenAIService', () => {
  let mockClient: jest.Mocked<OpenAI>;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockClient = {
      chat: {
        completions: {
          create: jest.fn(),
        },
      },
    } as any;

    MockedOpenAI.mockImplementation(() => mockClient);
  });

  const mockRequest: RecommendationRequest = {
    favoriteGenres: ['Fiction', 'Mystery'],
    highRatedBooks: [
      { title: 'The Great Gatsby', author: 'F. Scott Fitzgerald', rating: 5 },
      { title: '1984', author: 'George Orwell', rating: 4.5 },
    ],
    averageRating: 4.2,
    totalReviews: 15,
    recentGenres: ['Thriller', 'Science Fiction'],
  };

  const mockOpenAIResponse = {
    choices: [
      {
        message: {
          content: JSON.stringify({
            recommendations: [
              {
                title: 'The Silent Patient',
                author: 'Alex Michaelides',
                genre: 'Psychological Thriller',
                reason: 'Based on your love for mystery and high ratings for psychological narratives, this gripping thriller will keep you engaged.',
                confidence: 0.9,
              },
              {
                title: 'Klara and the Sun',
                author: 'Kazuo Ishiguro',
                genre: 'Science Fiction',
                reason: 'Given your recent interest in science fiction and appreciation for literary fiction, this beautifully written novel combines both elements.',
                confidence: 0.85,
              },
              {
                title: 'The Seven Husbands of Evelyn Hugo',
                author: 'Taylor Jenkins Reid',
                genre: 'Historical Fiction',
                reason: 'Your high average rating suggests you appreciate well-crafted stories, and this novel offers compelling characters and storytelling.',
                confidence: 0.8,
              },
            ],
          }),
        },
      },
    ],
  };

  describe('constructor and configuration', () => {
    it('should initialize with API key configured', () => {
      expect(openaiService.isAvailable()).toBe(true);
      expect(MockedOpenAI).toHaveBeenCalledWith({
        apiKey: 'test-api-key',
      });
    });

    it('should handle missing API key gracefully', () => {
      // Mock config without API key
      jest.doMock('../../src/config', () => ({
        openaiApiKey: undefined,
      }));

      // Re-import to get new instance
      const { default: newService } = require('../../src/services/openaiService');
      
      expect(newService.isAvailable()).toBe(false);
      expect(mockedLogger.warn).toHaveBeenCalledWith(
        'OpenAI API key not configured. AI recommendations will use fallback system.'
      );
    });
  });

  describe('isAvailable', () => {
    it('should return true when properly configured', () => {
      expect(openaiService.isAvailable()).toBe(true);
    });
  });

  describe('generateRecommendations', () => {
    beforeEach(() => {
      mockClient.chat.completions.create.mockResolvedValue(mockOpenAIResponse as any);
    });

    it('should generate recommendations successfully', async () => {
      const result = await openaiService.generateRecommendations(mockRequest);

      expect(result).toHaveLength(3);
      expect(result[0]).toEqual({
        title: 'The Silent Patient',
        author: 'Alex Michaelides',
        genre: 'Psychological Thriller',
        reason: 'Based on your love for mystery and high ratings for psychological narratives, this gripping thriller will keep you engaged.',
        confidence: 0.9,
      });

      expect(mockClient.chat.completions.create).toHaveBeenCalledWith({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: 'You are a knowledgeable book recommendation expert. Provide personalized book recommendations based on user preferences in valid JSON format.',
          },
          {
            role: 'user',
            content: expect.stringContaining('Favorite Genres: Fiction, Mystery'),
          },
        ],
        max_tokens: 1000,
        temperature: 0.7,
        response_format: { type: 'json_object' },
      });

      expect(mockedLogger.info).toHaveBeenCalledWith('Generating AI recommendations', expect.any(Object));
      expect(mockedLogger.info).toHaveBeenCalledWith('AI recommendations generated successfully', expect.any(Object));
    });

    it('should throw error when service is not configured', async () => {
      // Create a new service instance without API key
      const unconfiguredService = new (require('../../src/services/openaiService').default.constructor)();
      unconfiguredService.isConfigured = false;

      await expect(unconfiguredService.generateRecommendations(mockRequest)).rejects.toThrow(
        'OpenAI service is not configured'
      );
    });

    it('should handle OpenAI API errors', async () => {
      const apiError = new Error('OpenAI API error');
      mockClient.chat.completions.create.mockRejectedValue(apiError);

      await expect(openaiService.generateRecommendations(mockRequest)).rejects.toThrow('OpenAI API error');
      expect(mockedLogger.error).toHaveBeenCalledWith('Error generating AI recommendations:', apiError);
    });

    it('should handle empty response from OpenAI', async () => {
      mockClient.chat.completions.create.mockResolvedValue({
        choices: [{ message: { content: null } }],
      } as any);

      await expect(openaiService.generateRecommendations(mockRequest)).rejects.toThrow('No response from OpenAI');
    });

    it('should handle malformed JSON response', async () => {
      mockClient.chat.completions.create.mockResolvedValue({
        choices: [{ message: { content: 'invalid json' } }],
      } as any);

      await expect(openaiService.generateRecommendations(mockRequest)).rejects.toThrow(
        'Failed to parse AI recommendations'
      );
      expect(mockedLogger.error).toHaveBeenCalledWith('Error parsing OpenAI response:', expect.any(Object));
    });

    it('should handle response without recommendations array', async () => {
      mockClient.chat.completions.create.mockResolvedValue({
        choices: [{ message: { content: JSON.stringify({ data: 'invalid' }) } }],
      } as any);

      await expect(openaiService.generateRecommendations(mockRequest)).rejects.toThrow(
        'Failed to parse AI recommendations'
      );
    });

    it('should handle recommendations with missing required fields', async () => {
      const invalidResponse = {
        choices: [
          {
            message: {
              content: JSON.stringify({
                recommendations: [
                  {
                    title: 'Book Title',
                    // Missing author and reason
                    confidence: 0.8,
                  },
                ],
              }),
            },
          },
        ],
      };

      mockClient.chat.completions.create.mockResolvedValue(invalidResponse as any);

      await expect(openaiService.generateRecommendations(mockRequest)).rejects.toThrow(
        'Failed to parse AI recommendations'
      );
    });

    it('should limit recommendations to maximum of 3', async () => {
      const responseWithManyRecs = {
        choices: [
          {
            message: {
              content: JSON.stringify({
                recommendations: Array(10).fill({
                  title: 'Book Title',
                  author: 'Author Name',
                  reason: 'Good book',
                  confidence: 0.8,
                }),
              }),
            },
          },
        ],
      };

      mockClient.chat.completions.create.mockResolvedValue(responseWithManyRecs as any);

      const result = await openaiService.generateRecommendations(mockRequest);
      expect(result).toHaveLength(3);
    });

    it('should handle empty recommendations array', async () => {
      mockClient.chat.completions.create.mockResolvedValue({
        choices: [
          {
            message: {
              content: JSON.stringify({
                recommendations: [],
              }),
            },
          },
        ],
      } as any);

      await expect(openaiService.generateRecommendations(mockRequest)).rejects.toThrow(
        'Failed to parse AI recommendations'
      );
    });
  });

  describe('buildPrompt', () => {
    it('should build prompt with all user data', async () => {
      mockClient.chat.completions.create.mockResolvedValue(mockOpenAIResponse as any);
      
      await openaiService.generateRecommendations(mockRequest);

      const callArgs = mockClient.chat.completions.create.mock.calls[0][0];
      const prompt = callArgs.messages[1].content;

      expect(prompt).toContain('Favorite Genres: Fiction, Mystery');
      expect(prompt).toContain('Recent Genre Interests: Thriller, Science Fiction');
      expect(prompt).toContain('"The Great Gatsby" by F. Scott Fitzgerald (rated 5/5)');
      expect(prompt).toContain('Average Rating Given: 4.2/5.0');
      expect(prompt).toContain('Total Reviews Written: 15');
    });

    it('should handle empty favorite genres', async () => {
      const requestWithoutGenres = { ...mockRequest, favoriteGenres: [] };
      mockClient.chat.completions.create.mockResolvedValue(mockOpenAIResponse as any);
      
      await openaiService.generateRecommendations(requestWithoutGenres);

      const callArgs = mockClient.chat.completions.create.mock.calls[0][0];
      const prompt = callArgs.messages[1].content;

      expect(prompt).toContain('Favorite Genres: No specific genre preferences');
    });

    it('should handle empty high-rated books', async () => {
      const requestWithoutBooks = { ...mockRequest, highRatedBooks: [] };
      mockClient.chat.completions.create.mockResolvedValue(mockOpenAIResponse as any);
      
      await openaiService.generateRecommendations(requestWithoutBooks);

      const callArgs = mockClient.chat.completions.create.mock.calls[0][0];
      const prompt = callArgs.messages[1].content;

      expect(prompt).toContain('Highly Rated Books: No previous high-rated books');
    });

    it('should limit high-rated books to top 5', async () => {
      const requestWithManyBooks = {
        ...mockRequest,
        highRatedBooks: Array(10).fill({ title: 'Book', author: 'Author', rating: 5 }),
      };
      mockClient.chat.completions.create.mockResolvedValue(mockOpenAIResponse as any);
      
      await openaiService.generateRecommendations(requestWithManyBooks);

      const callArgs = mockClient.chat.completions.create.mock.calls[0][0];
      const prompt = callArgs.messages[1].content;

      // Should only contain 5 books (count occurrences of "rated 5/5")
      const bookCount = (prompt.match(/rated 5\/5/g) || []).length;
      expect(bookCount).toBe(5);
    });

    it('should handle empty recent genres', async () => {
      const requestWithoutRecentGenres = { ...mockRequest, recentGenres: [] };
      mockClient.chat.completions.create.mockResolvedValue(mockOpenAIResponse as any);
      
      await openaiService.generateRecommendations(requestWithoutRecentGenres);

      const callArgs = mockClient.chat.completions.create.mock.calls[0][0];
      const prompt = callArgs.messages[1].content;

      expect(prompt).toContain('Recent Genre Interests: No recent reading patterns');
    });
  });

  describe('parseRecommendations', () => {
    it('should parse valid recommendations correctly', async () => {
      mockClient.chat.completions.create.mockResolvedValue(mockOpenAIResponse as any);

      const result = await openaiService.generateRecommendations(mockRequest);

      expect(result).toHaveLength(3);
      expect(result[0].title).toBe('The Silent Patient');
      expect(result[0].author).toBe('Alex Michaelides');
      expect(result[0].confidence).toBe(0.9);
      expect(result[0].genre).toBe('Psychological Thriller');
    });

    it('should handle recommendations without genre', async () => {
      const responseWithoutGenre = {
        choices: [
          {
            message: {
              content: JSON.stringify({
                recommendations: [
                  {
                    title: 'Book Title',
                    author: 'Author Name',
                    reason: 'Good book',
                    confidence: 0.8,
                  },
                ],
              }),
            },
          },
        ],
      };

      mockClient.chat.completions.create.mockResolvedValue(responseWithoutGenre as any);

      const result = await openaiService.generateRecommendations(mockRequest);
      expect(result[0].genre).toBeUndefined();
    });

    it('should trim whitespace from fields', async () => {
      const responseWithWhitespace = {
        choices: [
          {
            message: {
              content: JSON.stringify({
                recommendations: [
                  {
                    title: '  Book Title  ',
                    author: '  Author Name  ',
                    reason: '  Good book  ',
                    genre: '  Fiction  ',
                    confidence: 0.8,
                  },
                ],
              }),
            },
          },
        ],
      };

      mockClient.chat.completions.create.mockResolvedValue(responseWithWhitespace as any);

      const result = await openaiService.generateRecommendations(mockRequest);
      expect(result[0].title).toBe('Book Title');
      expect(result[0].author).toBe('Author Name');
      expect(result[0].reason).toBe('Good book');
      expect(result[0].genre).toBe('Fiction');
    });
  });

  describe('validateConfidence', () => {
    it('should handle valid confidence scores', async () => {
      const responseWithValidConfidence = {
        choices: [
          {
            message: {
              content: JSON.stringify({
                recommendations: [
                  {
                    title: 'Book',
                    author: 'Author',
                    reason: 'Reason',
                    confidence: 0.75,
                  },
                ],
              }),
            },
          },
        ],
      };

      mockClient.chat.completions.create.mockResolvedValue(responseWithValidConfidence as any);

      const result = await openaiService.generateRecommendations(mockRequest);
      expect(result[0].confidence).toBe(0.75);
    });

    it('should clamp confidence scores to valid range', async () => {
      const responseWithInvalidConfidence = {
        choices: [
          {
            message: {
              content: JSON.stringify({
                recommendations: [
                  {
                    title: 'Book1',
                    author: 'Author1',
                    reason: 'Reason1',
                    confidence: 1.5, // Too high
                  },
                  {
                    title: 'Book2',
                    author: 'Author2',
                    reason: 'Reason2',
                    confidence: -0.5, // Too low
                  },
                  {
                    title: 'Book3',
                    author: 'Author3',
                    reason: 'Reason3',
                    confidence: 'invalid', // Not a number
                  },
                ],
              }),
            },
          },
        ],
      };

      mockClient.chat.completions.create.mockResolvedValue(responseWithInvalidConfidence as any);

      const result = await openaiService.generateRecommendations(mockRequest);
      expect(result[0].confidence).toBe(1.0); // Clamped to max
      expect(result[1].confidence).toBe(0.0); // Clamped to min
      expect(result[2].confidence).toBe(0.5); // Default for invalid
    });
  });

  describe('testConnection', () => {
    it('should return true for successful connection test', async () => {
      mockClient.chat.completions.create.mockResolvedValue({
        choices: [{ message: { content: 'Test response' } }],
      } as any);

      const result = await openaiService.testConnection();

      expect(result).toBe(true);
      expect(mockClient.chat.completions.create).toHaveBeenCalledWith({
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: 'Test connection' }],
        max_tokens: 10,
      });
    });

    it('should return false when service is not configured', async () => {
      const unconfiguredService = new (require('../../src/services/openaiService').default.constructor)();
      unconfiguredService.isConfigured = false;

      const result = await unconfiguredService.testConnection();

      expect(result).toBe(false);
    });

    it('should return false for connection errors', async () => {
      mockClient.chat.completions.create.mockRejectedValue(new Error('Connection failed'));

      const result = await openaiService.testConnection();

      expect(result).toBe(false);
      expect(mockedLogger.error).toHaveBeenCalledWith('OpenAI connection test failed:', expect.any(Error));
    });

    it('should return false for empty response', async () => {
      mockClient.chat.completions.create.mockResolvedValue({
        choices: [{ message: { content: null } }],
      } as any);

      const result = await openaiService.testConnection();

      expect(result).toBe(false);
    });

    it('should return false for missing response structure', async () => {
      mockClient.chat.completions.create.mockResolvedValue({
        choices: [],
      } as any);

      const result = await openaiService.testConnection();

      expect(result).toBe(false);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle very long user input gracefully', async () => {
      const longRequest = {
        ...mockRequest,
        favoriteGenres: Array(100).fill('Genre'),
        highRatedBooks: Array(100).fill({ title: 'Book', author: 'Author', rating: 5 }),
      };

      mockClient.chat.completions.create.mockResolvedValue(mockOpenAIResponse as any);

      const result = await openaiService.generateRecommendations(longRequest);
      expect(result).toHaveLength(3);
    });

    it('should handle special characters in book titles and authors', async () => {
      const specialRequest = {
        ...mockRequest,
        highRatedBooks: [
          { title: 'Book with "Quotes" & Symbols!', author: 'Author-Name O\'Connor', rating: 5 },
        ],
      };

      mockClient.chat.completions.create.mockResolvedValue(mockOpenAIResponse as any);

      await openaiService.generateRecommendations(specialRequest);

      const callArgs = mockClient.chat.completions.create.mock.calls[0][0];
      const prompt = callArgs.messages[1].content;

      expect(prompt).toContain('Book with "Quotes" & Symbols!');
      expect(prompt).toContain('Author-Name O\'Connor');
    });

    it('should handle zero average rating', async () => {
      const zeroRatingRequest = { ...mockRequest, averageRating: 0 };
      mockClient.chat.completions.create.mockResolvedValue(mockOpenAIResponse as any);

      await openaiService.generateRecommendations(zeroRatingRequest);

      const callArgs = mockClient.chat.completions.create.mock.calls[0][0];
      const prompt = callArgs.messages[1].content;

      expect(prompt).toContain('Average Rating Given: 0.0/5.0');
    });

    it('should handle zero total reviews', async () => {
      const zeroReviewsRequest = { ...mockRequest, totalReviews: 0 };
      mockClient.chat.completions.create.mockResolvedValue(mockOpenAIResponse as any);

      await openaiService.generateRecommendations(zeroReviewsRequest);

      const callArgs = mockClient.chat.completions.create.mock.calls[0][0];
      const prompt = callArgs.messages[1].content;

      expect(prompt).toContain('Total Reviews Written: 0');
    });
  });
});
