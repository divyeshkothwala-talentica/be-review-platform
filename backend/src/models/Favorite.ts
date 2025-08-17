import mongoose, { Document, Schema } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import Book from './Book';
import User from './User';

// Interface for Favorite document
export interface IFavorite extends Document {
  _id: string;
  userId: string;
  bookId: string;
  createdAt: Date;
}

// Favorite schema definition
const favoriteSchema = new Schema<IFavorite>(
  {
    _id: {
      type: String,
      default: uuidv4,
    },
    userId: {
      type: String,
      required: [true, 'User ID is required'],
      ref: 'User',
      validate: {
        validator: async function (userId: string) {
          const user = await User.findById(userId);
          return !!user;
        },
        message: 'Referenced user does not exist',
      },
    },
    bookId: {
      type: String,
      required: [true, 'Book ID is required'],
      ref: 'Book',
      validate: {
        validator: async function (bookId: string) {
          const book = await Book.findById(bookId);
          return !!book;
        },
        message: 'Referenced book does not exist',
      },
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false }, // Only track creation time
    versionKey: false,
    _id: false, // Disable automatic _id generation since we're using custom UUID
  }
);

// Compound unique index to ensure one favorite per user per book
favoriteSchema.index({ userId: 1, bookId: 1 }, { unique: true });

// Indexes for performance
favoriteSchema.index({ userId: 1 }); // For finding favorites by user
favoriteSchema.index({ bookId: 1 }); // For finding users who favorited a book
favoriteSchema.index({ createdAt: -1 }); // For sorting by newest favorites

// Virtual populate for book details
favoriteSchema.virtual('book', {
  ref: 'Book',
  localField: 'bookId',
  foreignField: '_id',
  justOne: true,
});

// Virtual populate for user details
favoriteSchema.virtual('user', {
  ref: 'User',
  localField: 'userId',
  foreignField: '_id',
  justOne: true,
});

// Static method to find user's favorites with book details
favoriteSchema.statics.findUserFavoritesWithBooks = function (userId: string) {
  return this.find({ userId })
    .populate('book', 'title author coverImageUrl averageRating totalReviews genres')
    .sort({ createdAt: -1 });
};

// Static method to find users who favorited a specific book
favoriteSchema.statics.findBookFavorites = function (bookId: string) {
  return this.find({ bookId })
    .populate('user', 'name')
    .sort({ createdAt: -1 });
};

// Static method to check if user has favorited a book
favoriteSchema.statics.isBookFavoritedByUser = async function (
  userId: string,
  bookId: string
): Promise<boolean> {
  const favorite = await this.findOne({ userId, bookId });
  return !!favorite;
};

// Static method to get favorite count for a book
favoriteSchema.statics.getFavoriteCountForBook = async function (
  bookId: string
): Promise<number> {
  return this.countDocuments({ bookId });
};

// Static method to get user's favorite count
favoriteSchema.statics.getUserFavoriteCount = async function (
  userId: string
): Promise<number> {
  return this.countDocuments({ userId });
};

// Static method to toggle favorite (add if not exists, remove if exists)
favoriteSchema.statics.toggleFavorite = async function (
  userId: string,
  bookId: string
): Promise<{ action: 'added' | 'removed'; favorite?: IFavorite }> {
  const existingFavorite = await this.findOne({ userId, bookId });
  
  if (existingFavorite) {
    // Remove favorite
    await this.findByIdAndDelete(existingFavorite._id);
    return { action: 'removed' };
  } else {
    // Add favorite
    const newFavorite = new this({ userId, bookId });
    await newFavorite.save();
    return { action: 'added', favorite: newFavorite };
  }
};

// Static method to get popular books based on favorites
favoriteSchema.statics.getPopularBooks = async function (limit: number = 10) {
  const result = await this.aggregate([
    {
      $group: {
        _id: '$bookId',
        favoriteCount: { $sum: 1 },
      },
    },
    {
      $sort: { favoriteCount: -1 },
    },
    {
      $limit: limit,
    },
    {
      $lookup: {
        from: 'books',
        localField: '_id',
        foreignField: '_id',
        as: 'book',
      },
    },
    {
      $unwind: '$book',
    },
    {
      $project: {
        _id: 0,
        bookId: '$_id',
        favoriteCount: 1,
        book: 1,
      },
    },
  ]);

  return result;
};

// Instance method to get formatted creation date
favoriteSchema.methods.getFormattedDate = function (): string {
  return this.createdAt.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
};

// Handle duplicate favorite error
favoriteSchema.post('save', function (error: any, _doc: any, next: any) {
  if (error.name === 'MongoServerError' && error.code === 11000) {
    if (error.keyPattern && error.keyPattern.userId && error.keyPattern.bookId) {
      next(new Error('Book is already in your favorites'));
    } else {
      next(error);
    }
  } else {
    next(error);
  }
});

// Ensure virtuals are included in JSON output
favoriteSchema.set('toJSON', { virtuals: true });
favoriteSchema.set('toObject', { virtuals: true });

// Create and export the Favorite model
const Favorite = mongoose.model<IFavorite>('Favorite', favoriteSchema);

export default Favorite;
