import OpenAI from 'openai';
import config from '../config';
import { logger } from '../utils/logger';

interface BookRecommendation {
  title: string;
  author: string;
  reason: string;
  confidence: number;
  genre?: string;
}

interface RecommendationRequest {
  favoriteGenres: string[];
  highRatedBooks: Array<{ title: string; author: string; rating: number }>;
  averageRating: number;
  totalReviews: number;
  recentGenres: string[];
}

class OpenAIService {
  private client!: OpenAI;
  private isConfigured: boolean;

  constructor() {
    this.isConfigured = !!config.openaiApiKey;
    
    if (this.isConfigured) {
      this.client = new OpenAI({
        apiKey: config.openaiApiKey,
      });
    } else {
      logger.warn('OpenAI API key not configured. AI recommendations will use fallback system.');
    }
  }

  /**
   * Check if OpenAI service is properly configured
   */
  public isAvailable(): boolean {
    return this.isConfigured;
  }

  /**
   * Generate book recommendations using OpenAI
   */
  public async generateRecommendations(
    request: RecommendationRequest
  ): Promise<BookRecommendation[]> {
    if (!this.isConfigured) {
      throw new Error('OpenAI service is not configured');
    }

    try {
      const prompt = this.buildPrompt(request);
      
      logger.info('Generating AI recommendations', {
        favoriteGenres: request.favoriteGenres.length,
        highRatedBooks: request.highRatedBooks.length,
        averageRating: request.averageRating,
      });

      const completion = await this.client.chat.completions.create({
        model: config.openaiModel,
        messages: [
          {
            role: 'system',
            content: 'You are a knowledgeable book recommendation expert. Provide personalized book recommendations based on user preferences in valid JSON format.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        max_tokens: config.openaiMaxTokens,
        temperature: config.openaiTemperature,
        response_format: { type: 'json_object' },
      });

      const response = completion.choices[0]?.message?.content;
      if (!response) {
        throw new Error('No response from OpenAI');
      }

      const recommendations = this.parseRecommendations(response);
      
      logger.info('AI recommendations generated successfully', {
        count: recommendations.length,
        avgConfidence: recommendations.reduce((sum, rec) => sum + rec.confidence, 0) / recommendations.length,
      });

      return recommendations;
    } catch (error) {
      logger.error('Error generating AI recommendations:', error);
      throw error;
    }
  }

  /**
   * Build the prompt for OpenAI based on user preferences
   */
  private buildPrompt(request: RecommendationRequest): string {
    const { favoriteGenres, highRatedBooks, averageRating, totalReviews, recentGenres } = request;

    const genreText = favoriteGenres.length > 0 
      ? favoriteGenres.join(', ') 
      : 'No specific genre preferences';

    const booksText = highRatedBooks.length > 0
      ? highRatedBooks
          .slice(0, 5) // Limit to top 5 to avoid token limits
          .map(book => `"${book.title}" by ${book.author} (rated ${book.rating}/5)`)
          .join(', ')
      : 'No previous high-rated books';

    const recentGenreText = recentGenres.length > 0
      ? recentGenres.join(', ')
      : 'No recent reading patterns';

    return `
Based on the following user reading preferences, recommend exactly 3 books that would be perfect for this reader:

**User Profile:**
- Favorite Genres: ${genreText}
- Recent Genre Interests: ${recentGenreText}
- Highly Rated Books: ${booksText}
- Average Rating Given: ${averageRating.toFixed(1)}/5.0
- Total Reviews Written: ${totalReviews}

**Requirements:**
1. Recommend 3 diverse books that match the user's preferences
2. Avoid recommending books the user has already rated
3. Consider both favorite genres and recent reading patterns
4. Provide meaningful reasons for each recommendation
5. Include confidence scores based on how well each book matches user preferences

**Response Format (JSON):**
{
  "recommendations": [
    {
      "title": "Book Title",
      "author": "Author Name",
      "genre": "Primary Genre",
      "reason": "Detailed explanation of why this book matches user preferences (2-3 sentences)",
      "confidence": 0.85
    }
  ]
}

**Guidelines:**
- Confidence scores should be between 0.0 and 1.0
- Reasons should be specific and reference user preferences
- Include a mix of popular and lesser-known quality books
- Ensure genre diversity unless user has very specific preferences
- Consider the user's rating patterns (high average = discerning reader)
`;
  }

  /**
   * Parse and validate OpenAI response
   */
  private parseRecommendations(response: string): BookRecommendation[] {
    try {
      const parsed = JSON.parse(response);
      
      if (!parsed.recommendations || !Array.isArray(parsed.recommendations)) {
        throw new Error('Invalid response format: missing recommendations array');
      }

      const recommendations: BookRecommendation[] = parsed.recommendations
        .slice(0, 3) // Ensure max 3 recommendations
        .map((rec: any, index: number) => {
          if (!rec.title || !rec.author || !rec.reason) {
            throw new Error(`Invalid recommendation at index ${index}: missing required fields`);
          }

          return {
            title: String(rec.title).trim(),
            author: String(rec.author).trim(),
            reason: String(rec.reason).trim(),
            confidence: this.validateConfidence(rec.confidence),
            genre: rec.genre ? String(rec.genre).trim() : undefined,
          };
        });

      if (recommendations.length === 0) {
        throw new Error('No valid recommendations found in response');
      }

      return recommendations;
    } catch (error) {
      logger.error('Error parsing OpenAI response:', { error: error instanceof Error ? error.message : String(error), response });
      throw new Error('Failed to parse AI recommendations');
    }
  }

  /**
   * Validate and normalize confidence score
   */
  private validateConfidence(confidence: any): number {
    const score = parseFloat(confidence);
    if (isNaN(score)) {
      return 0.5; // Default confidence
    }
    return Math.max(0.0, Math.min(1.0, score)); // Clamp between 0 and 1
  }

  /**
   * Test OpenAI connection
   */
  public async testConnection(): Promise<boolean> {
    if (!this.isConfigured) {
      return false;
    }

    try {
      const completion = await this.client.chat.completions.create({
        model: config.openaiModel,
        messages: [{ role: 'user', content: 'Test connection' }],
        max_tokens: 10,
      });

      return !!completion.choices[0]?.message?.content;
    } catch (error) {
      logger.error('OpenAI connection test failed:', error);
      return false;
    }
  }
}

export default new OpenAIService();
export { BookRecommendation, RecommendationRequest };
