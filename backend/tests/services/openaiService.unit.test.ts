import { OpenAI } from 'openai';
import config from '../../src/config';
import { logger } from '../../src/utils/logger';

// Mock all dependencies
jest.mock('openai');
jest.mock('../../src/config');
jest.mock('../../src/utils/logger');

const MockedOpenAI = OpenAI as jest.MockedClass<typeof OpenAI>;
const MockedConfig = config as jest.Mocked<typeof config>;
const MockedLogger = logger as jest.Mocked<typeof logger>;

// Import the service after mocking dependencies
import openaiService from '../../src/services/openaiService';

describe('OpenAIService Unit Tests', () => {
  let mockClient: jest.Mocked<OpenAI>;

  const mockRecommendationRequest = {
    favoriteGenres: ['Fiction', 'Mystery'],
    highRatedBooks: [
      { title: 'Great Book', author: 'Great Author', rating: 5, genre: 'Fiction' }
    ],
    averageRating: 4.2,
    totalReviews: 10,
    recentGenres: ['Fiction'],
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
                genre: 'Mystery',
                reason: 'A gripping psychological thriller that matches your love for mystery novels',
                confidence: 0.9
              },
              {
                title: 'Where the Crawdads Sing',
                author: 'Delia Owens',
                genre: 'Fiction',
                reason: 'A beautifully written novel that combines mystery and literary fiction',
                confidence: 0.85
              },
              {
                title: 'The Seven Husbands of Evelyn Hugo',
                author: 'Taylor Jenkins Reid',
                genre: 'Fiction',
                reason: 'A compelling story that fiction lovers consistently rate highly',
                confidence: 0.8
              }
            ]
          })
        }
      }
    ]
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup config mocks
    MockedConfig.openaiApiKey = 'test-api-key';
    MockedConfig.openaiModel = 'gpt-3.5-turbo';

    // Create mock client instance
    mockClient = {
      chat: {
        completions: {
          create: jest.fn(),
        },
      },
    } as any;

    // Mock OpenAI constructor
    MockedOpenAI.mockImplementation(() => mockClient);

    // Setup default successful response
    (mockClient.chat.completions.create as jest.Mock).mockResolvedValue(mockOpenAIResponse);

    // Mock the private client property
    (openaiService as any).client = mockClient;
    (openaiService as any).isConfigured = true;
  });

  describe('isAvailable', () => {
    it('should return true when API key is configured', () => {
      MockedConfig.openaiApiKey = 'test-api-key';
      
      const result = openaiService.isAvailable();
      
      expect(result).toBe(true);
    });

    it('should return false when API key is not configured', () => {
      (openaiService as any).isConfigured = false;
      
      const result = openaiService.isAvailable();
      
      expect(result).toBe(false);
    });

    it('should return false when API key is undefined', () => {
      (openaiService as any).isConfigured = false;
      
      const result = openaiService.isAvailable();
      
      expect(result).toBe(false);
    });
  });

  describe('generateRecommendations', () => {
    it('should generate recommendations successfully', async () => {
      const result = await openaiService.generateRecommendations(mockRecommendationRequest);

      expect(result).toHaveLength(3);
      expect(result[0]).toEqual({
        title: 'The Silent Patient',
        author: 'Alex Michaelides',
        genre: 'Mystery',
        reason: 'A gripping psychological thriller that matches your love for mystery novels',
        confidence: 0.9
      });

      expect(mockClient.chat.completions.create).toHaveBeenCalledWith({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: expect.stringContaining('You are a book recommendation expert')
          },
          {
            role: 'user',
            content: expect.stringContaining('Fiction, Mystery')
          }
        ],
        temperature: 0.7,
        max_tokens: 1000,
      });
    });

    it('should handle API errors gracefully', async () => {
      const apiError = new Error('OpenAI API Error');
      (mockClient.chat.completions.create as jest.Mock).mockRejectedValue(apiError);

      await expect(openaiService.generateRecommendations(mockRecommendationRequest)).rejects.toThrow('OpenAI API Error');
      expect(MockedLogger.error).toHaveBeenCalledWith('Error generating AI recommendations:', apiError);
    });

    it('should handle invalid JSON response', async () => {
      const invalidResponse = {
        choices: [
          {
            message: {
              content: 'Invalid JSON content'
            }
          }
        ]
      };
      (mockClient.chat.completions.create as jest.Mock).mockResolvedValue(invalidResponse);

      await expect(openaiService.generateRecommendations(mockRecommendationRequest)).rejects.toThrow('Failed to parse AI recommendations');
      expect(MockedLogger.error).toHaveBeenCalledWith('Error parsing OpenAI response:', expect.any(Object));
    });

    it('should handle empty response', async () => {
      const emptyResponse = {
        choices: []
      };
      (mockClient.chat.completions.create as jest.Mock).mockResolvedValue(emptyResponse);

      await expect(openaiService.generateRecommendations(mockRecommendationRequest)).rejects.toThrow('No response from OpenAI');
      expect(MockedLogger.error).toHaveBeenCalledWith('Error generating AI recommendations:', expect.any(Error));
    });

    it('should handle response without message content', async () => {
      const responseWithoutContent = {
        choices: [
          {
            message: {}
          }
        ]
      };
      (mockClient.chat.completions.create as jest.Mock).mockResolvedValue(responseWithoutContent);

      await expect(openaiService.generateRecommendations(mockRecommendationRequest)).rejects.toThrow('No response from OpenAI');
      expect(MockedLogger.error).toHaveBeenCalledWith('Error generating AI recommendations:', expect.any(Error));
    });

    it('should validate and filter recommendations', async () => {
      const responseWithInvalidRecs = {
        choices: [
          {
            message: {
              content: JSON.stringify({
                recommendations: [
                  {
                    title: 'Valid Book',
                    author: 'Valid Author',
                    genre: 'Fiction',
                    reason: 'Valid reason',
                    confidence: 0.8
                  },
                  {
                    // Missing required fields
                    title: 'Invalid Book',
                    confidence: 0.7
                  },
                  {
                    title: 'Another Valid Book',
                    author: 'Another Author',
                    genre: 'Mystery',
                    reason: 'Another valid reason',
                    confidence: 0.9
                  }
                ]
              })
            }
          }
        ]
      };
      (mockClient.chat.completions.create as jest.Mock).mockResolvedValue(responseWithInvalidRecs);

      // This should throw an error due to invalid recommendation
      await expect(openaiService.generateRecommendations(mockRecommendationRequest)).rejects.toThrow('Failed to parse AI recommendations');
    });

    it('should handle confidence validation', async () => {
      const responseWithInvalidConfidence = {
        choices: [
          {
            message: {
              content: JSON.stringify([
                {
                  title: 'Book 1',
                  author: 'Author 1',
                  genre: 'Fiction',
                  reason: 'Good book',
                  confidence: 1.5 // Invalid confidence > 1
                },
                {
                  title: 'Book 2',
                  author: 'Author 2',
                  genre: 'Mystery',
                  reason: 'Great book',
                  confidence: -0.1 // Invalid confidence < 0
                },
                {
                  title: 'Book 3',
                  author: 'Author 3',
                  genre: 'Fiction',
                  reason: 'Amazing book',
                  confidence: 0.8 // Valid confidence
                }
              ])
            }
          }
        ]
      };
      (mockClient.chat.completions.create as jest.Mock).mockResolvedValue(responseWithInvalidConfidence);

      const result = await openaiService.generateRecommendations(mockRecommendationRequest);

      expect(result).toHaveLength(1); // Only the valid recommendation
      expect(result[0].title).toBe('Book 3');
      expect(result[0].confidence).toBe(0.8);
    });

    it('should limit recommendations to maximum 5', async () => {
      const responseWithManyRecs = {
        choices: [
          {
            message: {
              content: JSON.stringify(Array.from({ length: 10 }, (_, i) => ({
                title: `Book ${i + 1}`,
                author: `Author ${i + 1}`,
                genre: 'Fiction',
                reason: `Reason ${i + 1}`,
                confidence: 0.8
              })))
            }
          }
        ]
      };
      (mockClient.chat.completions.create as jest.Mock).mockResolvedValue(responseWithManyRecs);

      const result = await openaiService.generateRecommendations(mockRecommendationRequest);

      expect(result).toHaveLength(5); // Limited to 5
    });

    it('should build correct prompt with user preferences', async () => {
      await openaiService.generateRecommendations(mockRecommendationRequest);

      const callArgs = (mockClient.chat.completions.create as jest.Mock).mock.calls[0][0];
      const userMessage = callArgs.messages[1].content;

      expect(userMessage).toContain('Fiction, Mystery');
      expect(userMessage).toContain('Great Book by Great Author (5 stars)');
      expect(userMessage).toContain('average rating: 4.2');
      expect(userMessage).toContain('total reviews: 10');
    });

    it('should handle empty favorite genres', async () => {
      const requestWithoutGenres = {
        ...mockRecommendationRequest,
        favoriteGenres: [],
      };

      await openaiService.generateRecommendations(requestWithoutGenres);

      const callArgs = (mockClient.chat.completions.create as jest.Mock).mock.calls[0][0];
      const userMessage = callArgs.messages[1].content;

      expect(userMessage).toContain('No specific genre preferences');
    });

    it('should handle empty high-rated books', async () => {
      const requestWithoutBooks = {
        ...mockRecommendationRequest,
        highRatedBooks: [],
      };

      await openaiService.generateRecommendations(requestWithoutBooks);

      const callArgs = (mockClient.chat.completions.create as jest.Mock).mock.calls[0][0];
      const userMessage = callArgs.messages[1].content;

      expect(userMessage).toContain('No specific book preferences available');
    });

    it('should use correct model and parameters', async () => {
      MockedConfig.openaiModel = 'gpt-4';

      await openaiService.generateRecommendations(mockRecommendationRequest);

      expect(mockClient.chat.completions.create).toHaveBeenCalledWith({
        model: 'gpt-4',
        messages: expect.any(Array),
        temperature: 0.7,
        max_tokens: 1000,
      });
    });
  });

  describe('testConnection', () => {
    it('should return true for successful connection test', async () => {
      const testResponse = {
        choices: [
          {
            message: {
              content: 'Test response'
            }
          }
        ]
      };
      (mockClient.chat.completions.create as jest.Mock).mockResolvedValue(testResponse);

      const result = await openaiService.testConnection();

      expect(result).toBe(true);
      expect(mockClient.chat.completions.create).toHaveBeenCalledWith({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'user',
            content: 'Test connection'
          }
        ],
        max_tokens: 10,
      });
    });

    it('should return false for failed connection test', async () => {
      (mockClient.chat.completions.create as jest.Mock).mockRejectedValue(new Error('Connection failed'));

      const result = await openaiService.testConnection();

      expect(result).toBe(false);
      expect(MockedLogger.error).toHaveBeenCalledWith('OpenAI connection test failed:', expect.any(Error));
    });

    it('should return false when service is not available', async () => {
      (openaiService as any).isConfigured = false;

      const result = await openaiService.testConnection();

      expect(result).toBe(false);
      expect(mockClient.chat.completions.create).not.toHaveBeenCalled();
    });
  });

  describe('Private Methods Coverage', () => {
    it('should build prompt correctly with all user data', async () => {
      const fullRequest = {
        favoriteGenres: ['Fiction', 'Mystery', 'Thriller'],
        highRatedBooks: [
          { title: 'Book 1', author: 'Author 1', rating: 5, genre: 'Fiction' },
          { title: 'Book 2', author: 'Author 2', rating: 4, genre: 'Mystery' }
        ],
        averageRating: 4.5,
        totalReviews: 25,
        recentGenres: ['Thriller', 'Fiction'],
      };

      await openaiService.generateRecommendations(fullRequest);

      const callArgs = (mockClient.chat.completions.create as jest.Mock).mock.calls[0][0];
      const userMessage = callArgs.messages[1].content;

      expect(userMessage).toContain('Fiction, Mystery, Thriller');
      expect(userMessage).toContain('Book 1 by Author 1 (5 stars)');
      expect(userMessage).toContain('Book 2 by Author 2 (4 stars)');
      expect(userMessage).toContain('average rating: 4.5');
      expect(userMessage).toContain('total reviews: 25');
      expect(userMessage).toContain('recently enjoyed: Thriller, Fiction');
    });

    it('should parse recommendations correctly', async () => {
      const complexResponse = {
        choices: [
          {
            message: {
              content: JSON.stringify([
                {
                  title: 'Book with Special Characters: A Tale',
                  author: 'Author-Name O\'Connor',
                  genre: 'Historical Fiction',
                  reason: 'This book features complex characters and explores themes you\'ve enjoyed in your recent reads.',
                  confidence: 0.92
                }
              ])
            }
          }
        ]
      };
      (mockClient.chat.completions.create as jest.Mock).mockResolvedValue(complexResponse);

      const result = await openaiService.generateRecommendations(mockRecommendationRequest);

      expect(result).toHaveLength(1);
      expect(result[0].title).toBe('Book with Special Characters: A Tale');
      expect(result[0].author).toBe('Author-Name O\'Connor');
      expect(result[0].genre).toBe('Historical Fiction');
      expect(result[0].confidence).toBe(0.92);
    });

    it('should validate confidence scores correctly', async () => {
      const responseWithEdgeCases = {
        choices: [
          {
            message: {
              content: JSON.stringify([
                {
                  title: 'Book 1',
                  author: 'Author 1',
                  genre: 'Fiction',
                  reason: 'Good book',
                  confidence: 0 // Edge case: exactly 0
                },
                {
                  title: 'Book 2',
                  author: 'Author 2',
                  genre: 'Mystery',
                  reason: 'Great book',
                  confidence: 1 // Edge case: exactly 1
                },
                {
                  title: 'Book 3',
                  author: 'Author 3',
                  genre: 'Fiction',
                  reason: 'Amazing book',
                  confidence: 'invalid' // Invalid type
                }
              ])
            }
          }
        ]
      };
      (mockClient.chat.completions.create as jest.Mock).mockResolvedValue(responseWithEdgeCases);

      const result = await openaiService.generateRecommendations(mockRecommendationRequest);

      expect(result).toHaveLength(2); // Only valid confidence scores
      expect(result[0].confidence).toBe(0);
      expect(result[1].confidence).toBe(1);
    });

    it('should handle whitespace in recommendations', async () => {
      const responseWithWhitespace = {
        choices: [
          {
            message: {
              content: JSON.stringify([
                {
                  title: '  Book with Spaces  ',
                  author: '  Author Name  ',
                  genre: '  Fiction  ',
                  reason: '  This is a great book with extra spaces  ',
                  confidence: 0.8
                }
              ])
            }
          }
        ]
      };
      (mockClient.chat.completions.create as jest.Mock).mockResolvedValue(responseWithWhitespace);

      const result = await openaiService.generateRecommendations(mockRecommendationRequest);

      expect(result).toHaveLength(1);
      expect(result[0].title).toBe('Book with Spaces'); // Trimmed
      expect(result[0].author).toBe('Author Name'); // Trimmed
      expect(result[0].genre).toBe('Fiction'); // Trimmed
      expect(result[0].reason).toBe('This is a great book with extra spaces'); // Trimmed
    });
  });

  describe('Error Handling Edge Cases', () => {
    it('should handle network timeout errors', async () => {
      const timeoutError = new Error('Request timeout');
      timeoutError.name = 'TimeoutError';
      (mockClient.chat.completions.create as jest.Mock).mockRejectedValue(timeoutError);

      await expect(openaiService.generateRecommendations(mockRecommendationRequest)).rejects.toThrow('Request timeout');
      expect(MockedLogger.error).toHaveBeenCalledWith('Error generating AI recommendations:', timeoutError);
    });

    it('should handle rate limit errors', async () => {
      const rateLimitError = new Error('Rate limit exceeded');
      rateLimitError.name = 'RateLimitError';
      (mockClient.chat.completions.create as jest.Mock).mockRejectedValue(rateLimitError);

      await expect(openaiService.generateRecommendations(mockRecommendationRequest)).rejects.toThrow('Rate limit exceeded');
      expect(MockedLogger.error).toHaveBeenCalledWith('Error generating AI recommendations:', rateLimitError);
    });

    it('should handle malformed JSON with extra content', async () => {
      const malformedResponse = {
        choices: [
          {
            message: {
              content: 'Here are some recommendations: [{"title":"Book","author":"Author","genre":"Fiction","reason":"Good","confidence":0.8}] Hope this helps!'
            }
          }
        ]
      };
      (mockClient.chat.completions.create as jest.Mock).mockResolvedValue(malformedResponse);

      // Should attempt to extract JSON from the content
      await expect(openaiService.generateRecommendations(mockRecommendationRequest)).rejects.toThrow('Failed to parse AI recommendations');
    });

    it('should handle empty array response', async () => {
      const emptyArrayResponse = {
        choices: [
          {
            message: {
              content: JSON.stringify([])
            }
          }
        ]
      };
      (mockClient.chat.completions.create as jest.Mock).mockResolvedValue(emptyArrayResponse);

      const result = await openaiService.generateRecommendations(mockRecommendationRequest);

      expect(result).toEqual([]);
    });

    it('should handle null/undefined values in recommendations', async () => {
      const responseWithNulls = {
        choices: [
          {
            message: {
              content: JSON.stringify([
                {
                  title: null,
                  author: 'Author',
                  genre: 'Fiction',
                  reason: 'Good book',
                  confidence: 0.8
                },
                {
                  title: 'Book',
                  author: undefined,
                  genre: 'Mystery',
                  reason: 'Great book',
                  confidence: 0.7
                }
              ])
            }
          }
        ]
      };
      (mockClient.chat.completions.create as jest.Mock).mockResolvedValue(responseWithNulls);

      const result = await openaiService.generateRecommendations(mockRecommendationRequest);

      expect(result).toEqual([]); // Both should be filtered out due to null/undefined required fields
    });
  });

  describe('Configuration Edge Cases', () => {
    it('should handle missing OpenAI model configuration', async () => {
      MockedConfig.openaiModel = undefined as any;

      await openaiService.generateRecommendations(mockRecommendationRequest);

      // Should use default model
      expect(mockClient.chat.completions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          model: undefined // Will use whatever default the service has
        })
      );
    });

    it('should handle very long user preferences', async () => {
      const longRequest = {
        favoriteGenres: Array.from({ length: 50 }, (_, i) => `Genre${i}`),
        highRatedBooks: Array.from({ length: 100 }, (_, i) => ({
          title: `Very Long Book Title That Goes On And On ${i}`,
          author: `Very Long Author Name That Also Goes On ${i}`,
          rating: 5,
          genre: `Genre${i % 10}`
        })),
        averageRating: 4.8,
        totalReviews: 1000,
        recentGenres: Array.from({ length: 20 }, (_, i) => `RecentGenre${i}`),
      };

      await openaiService.generateRecommendations(longRequest);

      const callArgs = (mockClient.chat.completions.create as jest.Mock).mock.calls[0][0];
      const userMessage = callArgs.messages[1].content;

      // Should handle long content without crashing
      expect(userMessage).toBeDefined();
      expect(userMessage.length).toBeGreaterThan(0);
    });
  });
});
