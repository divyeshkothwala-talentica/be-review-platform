import mongoose, { Document, Schema } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import Book from './Book';

// Interface for Review document
export interface IReview extends Document {
  _id: string;
  bookId: string;
  userId: string;
  text: string;
  rating: number;
  createdAt: Date;
  updatedAt: Date;
}

// Review schema definition
const reviewSchema = new Schema<IReview>(
  {
    _id: {
      type: String,
      default: uuidv4,
    },
    bookId: {
      type: String,
      required: [true, 'Book ID is required'],
      ref: 'Book',
    },
    userId: {
      type: String,
      required: [true, 'User ID is required'],
      ref: 'User',
    },
    text: {
      type: String,
      required: [true, 'Review text is required'],
      trim: true,
      minlength: [1, 'Review text must be at least 1 character long'],
      maxlength: [2000, 'Review text cannot exceed 2000 characters'],
    },
    rating: {
      type: Number,
      required: [true, 'Rating is required'],
      min: [1, 'Rating must be at least 1'],
      max: [5, 'Rating cannot exceed 5'],
      validate: {
        validator: function (rating: number) {
          return Number.isInteger(rating);
        },
        message: 'Rating must be a whole number between 1 and 5',
      },
    },
  },
  {
    timestamps: true,
    versionKey: false,
    _id: false, // Disable automatic _id generation since we're using custom UUID
  }
);

// Compound unique index to ensure one review per user per book
reviewSchema.index({ userId: 1, bookId: 1 }, { unique: true });

// Indexes for performance
reviewSchema.index({ bookId: 1 }); // For finding reviews by book
reviewSchema.index({ userId: 1 }); // For finding reviews by user
reviewSchema.index({ rating: -1 }); // For sorting by rating
reviewSchema.index({ createdAt: -1 }); // For sorting by newest

// Virtual populate for book details
reviewSchema.virtual('book', {
  ref: 'Book',
  localField: 'bookId',
  foreignField: '_id',
  justOne: true,
});

// Virtual populate for user details
reviewSchema.virtual('user', {
  ref: 'User',
  localField: 'userId',
  foreignField: '_id',
  justOne: true,
});

// Pre-save middleware to update book rating statistics
// Temporarily disabled - moved to service layer to avoid race conditions
// reviewSchema.pre('save', async function (next) {
//   try {
//     if (this.isNew) {
//       // New review - update book statistics
//       const book = await Book.findById(this.bookId);
//       if (book) {
//         await book.updateRatingStats(this.rating, true);
//       }
//     } else if (this.isModified('rating')) {
//       // Rating updated - recalculate book statistics
//       const originalReview = await mongoose.model('Review').findById(this._id);
//       if (originalReview) {
//         const book = await Book.findById(this.bookId);
//         if (book) {
//           await book.updateRatingStats(this.rating, false, originalReview.rating);
//         }
//       }
//     }
//     next();
//   } catch (error) {
//     next(error as Error);
//   }
// });

// Post-remove middleware to update book rating statistics
reviewSchema.post('findOneAndDelete', async function (doc) {
  if (doc) {
    try {
      const book = await Book.findById(doc.bookId);
      if (book) {
        await book.removeRatingFromStats(doc.rating);
      }
    } catch (error) {
      console.error('Error updating book statistics after review deletion:', error);
    }
  }
});

// Post-remove middleware for deleteOne
reviewSchema.post('deleteOne', { document: true, query: false }, async function (_doc) {
  try {
    const book = await Book.findById(this.bookId);
    if (book) {
      await book.removeRatingFromStats(this.rating);
    }
  } catch (error) {
    console.error('Error updating book statistics after review deletion:', error);
  }
});

// Static method to find reviews by book with user population
reviewSchema.statics.findByBookWithUser = function (bookId: string) {
  return this.find({ bookId })
    .populate('user', 'name')
    .sort({ createdAt: -1 });
};

// Static method to find reviews by user with book population
reviewSchema.statics.findByUserWithBook = function (userId: string) {
  return this.find({ userId })
    .populate('book', 'title author coverImageUrl')
    .sort({ createdAt: -1 });
};

// Static method to get average rating for a book
reviewSchema.statics.getAverageRatingForBook = async function (bookId: string) {
  const result = await this.aggregate([
    { $match: { bookId } },
    {
      $group: {
        _id: '$bookId',
        averageRating: { $avg: '$rating' },
        totalReviews: { $sum: 1 },
      },
    },
  ]);

  return result.length > 0 
    ? {
        averageRating: Math.round(result[0].averageRating * 10) / 10,
        totalReviews: result[0].totalReviews,
      }
    : { averageRating: 0, totalReviews: 0 };
};

// Static method to check if user has already reviewed a book
reviewSchema.statics.hasUserReviewedBook = async function (
  userId: string,
  bookId: string
): Promise<boolean> {
  const existingReview = await this.findOne({ userId, bookId });
  return !!existingReview;
};

// Instance method to get formatted creation date
reviewSchema.methods.getFormattedDate = function (): string {
  return this.createdAt.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
};

// Handle duplicate review error
reviewSchema.post('save', function (error: any, _doc: any, next: any) {
  if (error.name === 'MongoServerError' && error.code === 11000) {
    if (error.keyPattern && error.keyPattern.userId && error.keyPattern.bookId) {
      next(new Error('You have already reviewed this book'));
    } else {
      next(error);
    }
  } else {
    next(error);
  }
});

// Ensure virtuals are included in JSON output
reviewSchema.set('toJSON', { virtuals: true });
reviewSchema.set('toObject', { virtuals: true });

// Create and export the Review model
const Review = mongoose.model<IReview>('Review', reviewSchema);

export default Review;
