// Export all models from a single entry point
export { default as User, IUser } from './User';
export { default as Book, IBook, VALID_GENRES } from './Book';
export { default as Review, IReview } from './Review';
export { default as Favorite, IFavorite } from './Favorite';
export { 
  default as RecommendationHistory, 
  IRecommendationHistory,
  IRecommendationItem,
  IUserPreferencesSnapshot,
  IRecommendationMetadata
} from './RecommendationHistory';
export { default as RecommendationFeedback, IRecommendationFeedback } from './RecommendationFeedback';
