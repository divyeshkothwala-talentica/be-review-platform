import mongoose, { Document, Schema } from 'mongoose';

// Interface for recommendation feedback document
export interface IRecommendationFeedback extends Document {
  userId: mongoose.Types.ObjectId;
  recommendationHistoryId: mongoose.Types.ObjectId;
  bookTitle: string;
  bookAuthor: string;
  feedbackType: 'like' | 'dislike' | 'not_interested' | 'already_read' | 'purchased' | 'added_to_wishlist';
  rating?: number; // Optional rating if user rates the recommendation itself
  comment?: string; // Optional user comment about the recommendation
  actionTaken?: 'viewed_details' | 'added_to_favorites' | 'purchased' | 'reviewed_book' | 'ignored';
  createdAt: Date;
  updatedAt: Date;
}

// Recommendation feedback schema
const RecommendationFeedbackSchema = new Schema<IRecommendationFeedback>({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  recommendationHistoryId: {
    type: Schema.Types.ObjectId,
    ref: 'RecommendationHistory',
    required: true,
    index: true,
  },
  bookTitle: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200,
  },
  bookAuthor: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100,
  },
  feedbackType: {
    type: String,
    required: true,
    enum: ['like', 'dislike', 'not_interested', 'already_read', 'purchased', 'added_to_wishlist'],
    index: true,
  },
  rating: {
    type: Number,
    min: 1,
    max: 5,
    validate: {
      validator: function(value: number) {
        return Number.isInteger(value);
      },
      message: 'Rating must be an integer between 1 and 5',
    },
  },
  comment: {
    type: String,
    trim: true,
    maxlength: 500,
  },
  actionTaken: {
    type: String,
    enum: ['viewed_details', 'added_to_favorites', 'purchased', 'reviewed_book', 'ignored'],
    index: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
}, {
  timestamps: true,
  collection: 'recommendation_feedback',
});

// Compound indexes for efficient queries
RecommendationFeedbackSchema.index({ userId: 1, createdAt: -1 });
RecommendationFeedbackSchema.index({ userId: 1, feedbackType: 1 });
RecommendationFeedbackSchema.index({ recommendationHistoryId: 1, feedbackType: 1 });
RecommendationFeedbackSchema.index({ bookTitle: 1, bookAuthor: 1 });

// Unique constraint: one feedback per user per recommendation per book
RecommendationFeedbackSchema.index(
  { userId: 1, recommendationHistoryId: 1, bookTitle: 1, bookAuthor: 1 },
  { unique: true }
);

// Instance methods
RecommendationFeedbackSchema.methods.isPositive = function(): boolean {
  return ['like', 'purchased', 'added_to_wishlist'].includes(this.feedbackType);
};

RecommendationFeedbackSchema.methods.isNegative = function(): boolean {
  return ['dislike', 'not_interested'].includes(this.feedbackType);
};

RecommendationFeedbackSchema.methods.updateFeedback = function(
  feedbackType: string,
  rating?: number,
  comment?: string,
  actionTaken?: string
): Promise<IRecommendationFeedback> {
  this.feedbackType = feedbackType;
  if (rating !== undefined) this.rating = rating;
  if (comment !== undefined) this.comment = comment;
  if (actionTaken !== undefined) this.actionTaken = actionTaken;
  this.updatedAt = new Date();
  return this.save();
};

// Static methods
RecommendationFeedbackSchema.statics.getUserFeedback = function(
  userId: string,
  limit: number = 20,
  skip: number = 0
) {
  return this.find({ userId })
    .populate('recommendationHistoryId', 'metadata.source metadata.generatedAt')
    .sort({ createdAt: -1 })
    .limit(limit)
    .skip(skip)
    .lean();
};

RecommendationFeedbackSchema.statics.getRecommendationFeedback = function(
  recommendationHistoryId: string
) {
  return this.find({ recommendationHistoryId })
    .populate('userId', 'name email')
    .sort({ createdAt: -1 })
    .lean();
};

RecommendationFeedbackSchema.statics.getFeedbackStats = function(
  userId?: string,
  startDate?: Date,
  endDate?: Date
) {
  const match: any = {};
  if (userId) match.userId = new mongoose.Types.ObjectId(userId);
  if (startDate || endDate) {
    match.createdAt = {};
    if (startDate) match.createdAt.$gte = startDate;
    if (endDate) match.createdAt.$lte = endDate;
  }

  return this.aggregate([
    { $match: match },
    {
      $group: {
        _id: '$feedbackType',
        count: { $sum: 1 },
        avgRating: { $avg: '$rating' },
      },
    },
    {
      $group: {
        _id: null,
        totalFeedback: { $sum: '$count' },
        feedbackBreakdown: {
          $push: {
            type: '$_id',
            count: '$count',
            avgRating: '$avgRating',
          },
        },
      },
    },
  ]);
};

RecommendationFeedbackSchema.statics.getBookFeedbackStats = function(
  bookTitle: string,
  bookAuthor: string
) {
  return this.aggregate([
    {
      $match: {
        bookTitle: bookTitle,
        bookAuthor: bookAuthor,
      },
    },
    {
      $group: {
        _id: '$feedbackType',
        count: { $sum: 1 },
        avgRating: { $avg: '$rating' },
      },
    },
  ]);
};

RecommendationFeedbackSchema.statics.getRecommendationEffectiveness = function(
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
      $lookup: {
        from: 'recommendation_history',
        localField: 'recommendationHistoryId',
        foreignField: '_id',
        as: 'recommendation',
      },
    },
    { $unwind: '$recommendation' },
    {
      $group: {
        _id: '$recommendation.metadata.source',
        totalRecommendations: { $sum: 1 },
        positiveCount: {
          $sum: {
            $cond: [
              { $in: ['$feedbackType', ['like', 'purchased', 'added_to_wishlist']] },
              1,
              0,
            ],
          },
        },
        negativeCount: {
          $sum: {
            $cond: [
              { $in: ['$feedbackType', ['dislike', 'not_interested']] },
              1,
              0,
            ],
          },
        },
        avgRating: { $avg: '$rating' },
      },
    },
    {
      $addFields: {
        positiveRate: {
          $divide: ['$positiveCount', '$totalRecommendations'],
        },
        negativeRate: {
          $divide: ['$negativeCount', '$totalRecommendations'],
        },
      },
    },
  ]);
};

// Pre-save middleware
RecommendationFeedbackSchema.pre('save', function(next) {
  if (this.isModified() && !this.isNew) {
    this.updatedAt = new Date();
  }
  next();
});

// Create and export the model
const RecommendationFeedback = mongoose.model<IRecommendationFeedback>(
  'RecommendationFeedback',
  RecommendationFeedbackSchema
);

export default RecommendationFeedback;
