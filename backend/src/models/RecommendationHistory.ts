import mongoose, { Document, Schema } from 'mongoose';

// Interface for individual recommendation item
interface IRecommendationItem {
  title: string;
  author: string;
  genre?: string;
  reason: string;
  confidence: number;
  source: 'ai' | 'fallback';
  averageRating?: number;
  reviewCount?: number;
}

// Interface for user preferences snapshot
interface IUserPreferencesSnapshot {
  favoriteGenres: string[];
  averageRating: number;
  totalReviews: number;
  hasEnoughData: boolean;
}

// Interface for recommendation metadata
interface IRecommendationMetadata {
  generatedAt: Date;
  source: 'ai' | 'fallback' | 'hybrid';
  userPreferences: IUserPreferencesSnapshot;
  processingTime: number;
  openaiModel?: string;
  cacheHit: boolean;
}

// Main interface for recommendation history document
export interface IRecommendationHistory extends Document {
  userId: mongoose.Types.ObjectId;
  recommendations: IRecommendationItem[];
  metadata: IRecommendationMetadata;
  createdAt: Date;
  expiresAt: Date;
  isActive: boolean;
  
  // Instance methods
  isExpired(): boolean;
  deactivate(): Promise<IRecommendationHistory>;
}

// Interface for static methods
interface IRecommendationHistoryModel extends mongoose.Model<IRecommendationHistory> {
  findActiveForUser(_userId: string): Promise<IRecommendationHistory | null>;
  getUserHistory(_userId: string, _limit?: number, _skip?: number): Promise<IRecommendationHistory[]>;
  getAnalytics(_startDate?: Date, _endDate?: Date): Promise<any>;
}

// Schema for individual recommendation item
const RecommendationItemSchema = new Schema<IRecommendationItem>({
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200,
  },
  author: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100,
  },
  genre: {
    type: String,
    trim: true,
    maxlength: 50,
  },
  reason: {
    type: String,
    required: true,
    trim: true,
    maxlength: 500,
  },
  confidence: {
    type: Number,
    required: true,
    min: 0,
    max: 1,
  },
  source: {
    type: String,
    required: true,
    enum: ['ai', 'fallback'],
  },
  averageRating: {
    type: Number,
    min: 1,
    max: 5,
  },
  reviewCount: {
    type: Number,
    min: 0,
  },
}, { _id: false });

// Schema for user preferences snapshot
const UserPreferencesSnapshotSchema = new Schema<IUserPreferencesSnapshot>({
  favoriteGenres: [{
    type: String,
    trim: true,
  }],
  averageRating: {
    type: Number,
    required: true,
    min: 1,
    max: 5,
  },
  totalReviews: {
    type: Number,
    required: true,
    min: 0,
  },
  hasEnoughData: {
    type: Boolean,
    required: true,
  },
}, { _id: false });

// Schema for recommendation metadata
const RecommendationMetadataSchema = new Schema<IRecommendationMetadata>({
  generatedAt: {
    type: Date,
    required: true,
    default: Date.now,
  },
  source: {
    type: String,
    required: true,
    enum: ['ai', 'fallback', 'hybrid'],
  },
  userPreferences: {
    type: UserPreferencesSnapshotSchema,
    required: true,
  },
  processingTime: {
    type: Number,
    required: true,
    min: 0,
  },
  openaiModel: {
    type: String,
    trim: true,
  },
  cacheHit: {
    type: Boolean,
    required: true,
    default: false,
  },
}, { _id: false });

// Main recommendation history schema
const RecommendationHistorySchema = new Schema<IRecommendationHistory>({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  recommendations: {
    type: [RecommendationItemSchema],
    required: true,
    validate: {
      validator: function(recommendations: IRecommendationItem[]) {
        return recommendations.length > 0 && recommendations.length <= 10;
      },
      message: 'Must have between 1 and 10 recommendations',
    },
  },
  metadata: {
    type: RecommendationMetadataSchema,
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true,
  },
  expiresAt: {
    type: Date,
    required: true,
    index: { expireAfterSeconds: 0 }, // TTL index for automatic cleanup
  },
  isActive: {
    type: Boolean,
    default: true,
    index: true,
  },
}, {
  timestamps: true,
  collection: 'recommendation_history',
});

// Compound indexes for efficient queries
RecommendationHistorySchema.index({ userId: 1, createdAt: -1 });
RecommendationHistorySchema.index({ userId: 1, isActive: 1 });
RecommendationHistorySchema.index({ 'metadata.source': 1, createdAt: -1 });

// Instance methods
RecommendationHistorySchema.methods.isExpired = function(): boolean {
  return new Date() > this.expiresAt;
};

RecommendationHistorySchema.methods.deactivate = function(): Promise<IRecommendationHistory> {
  this.isActive = false;
  return this.save();
};

// Static methods
RecommendationHistorySchema.statics.findActiveForUser = function(userId: string) {
  return this.findOne({
    userId,
    isActive: true,
    expiresAt: { $gt: new Date() },
  }).sort({ createdAt: -1 });
};

RecommendationHistorySchema.statics.getUserHistory = function(
  userId: string,
  limit: number = 10,
  skip: number = 0
) {
  return this.find({ userId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .skip(skip)
    .lean();
};

RecommendationHistorySchema.statics.getAnalytics = function(
  startDate?: Date,
  endDate?: Date
) {
  const match: any = {};
  if (startDate || endDate) {
    match.createdAt = {};
    if (startDate) match.createdAt.$gte = startDate;
    if (endDate) match.createdAt.$lte = endDate;
  }

  return this.aggregate([
    { $match: match },
    {
      $group: {
        _id: '$metadata.source',
        count: { $sum: 1 },
        avgProcessingTime: { $avg: '$metadata.processingTime' },
        avgConfidence: { $avg: { $avg: '$recommendations.confidence' } },
      },
    },
  ]);
};

// Pre-save middleware
RecommendationHistorySchema.pre('save', function(next) {
  // Set expiration time if not already set (default 1 hour)
  if (!this.expiresAt) {
    this.expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
  }
  next();
});

// Create and export the model
const RecommendationHistory = mongoose.model<IRecommendationHistory, IRecommendationHistoryModel>(
  'RecommendationHistory',
  RecommendationHistorySchema
);

export default RecommendationHistory;
export { IRecommendationItem, IUserPreferencesSnapshot, IRecommendationMetadata };
