import mongoose, { Document, Schema } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

// Interface for Book document
export interface IBook extends Document {
  _id: string;
  title: string;
  author: string;
  description: string;
  coverImageUrl: string;
  genres: string[];
  publishedYear: number;
  averageRating: number;
  totalReviews: number;
  createdAt: Date;
  updatedAt: Date;
  updateRatingStats(_newRating: number, _isNewReview?: boolean, _oldRating?: number): Promise<IBook>;
  removeRatingFromStats(_ratingToRemove: number): Promise<IBook>;
}

// Predefined genres for validation
const VALID_GENRES = [
  'Fiction',
  'Non-Fiction',
  'Mystery',
  'Thriller',
  'Romance',
  'Science Fiction',
  'Fantasy',
  'Horror',
  'Biography',
  'History',
  'Self-Help',
  'Business',
  'Health',
  'Travel',
  'Cooking',
  'Art',
  'Poetry',
  'Drama',
  'Adventure',
  'Young Adult',
  'Children',
  'Philosophy',
  'Religion',
  'Politics',
  'Science',
  'Technology',
];

// Book schema definition
const bookSchema = new Schema<IBook>(
  {
    _id: {
      type: String,
      default: uuidv4,
    },
    title: {
      type: String,
      required: [true, 'Title is required'],
      trim: true,
      minlength: [1, 'Title must be at least 1 character long'],
      maxlength: [200, 'Title cannot exceed 200 characters'],
    },
    author: {
      type: String,
      required: [true, 'Author is required'],
      trim: true,
      minlength: [1, 'Author name must be at least 1 character long'],
      maxlength: [100, 'Author name cannot exceed 100 characters'],
    },
    description: {
      type: String,
      required: [true, 'Description is required'],
      trim: true,
      minlength: [10, 'Description must be at least 10 characters long'],
      maxlength: [2000, 'Description cannot exceed 2000 characters'],
    },
    coverImageUrl: {
      type: String,
      required: [true, 'Cover image URL is required'],
      validate: {
        validator: function (url: string) {
          // Basic URL validation
          try {
            new URL(url);
            return true;
          } catch {
            return false;
          }
        },
        message: 'Please provide a valid URL for cover image',
      },
    },
    genres: {
      type: [String],
      required: [true, 'At least one genre is required'],
      validate: [
        {
          validator: function (genres: string[]) {
            return genres.length >= 1 && genres.length <= 5;
          },
          message: 'A book must have between 1 and 5 genres',
        },
        {
          validator: function (genres: string[]) {
            return genres.every(genre => VALID_GENRES.includes(genre));
          },
          message: 'Invalid genre provided. Please use valid genres only.',
        },
      ],
    },
    publishedYear: {
      type: Number,
      required: [true, 'Published year is required'],
      min: [1000, 'Published year must be at least 1000'],
      max: [new Date().getFullYear(), 'Published year cannot be in the future'],
      validate: {
        validator: function (year: number) {
          return Number.isInteger(year);
        },
        message: 'Published year must be a valid integer',
      },
    },
    averageRating: {
      type: Number,
      default: 0.0,
      min: [0.0, 'Average rating cannot be negative'],
      max: [5.0, 'Average rating cannot exceed 5.0'],
      set: function (rating: number) {
        // Round to 1 decimal place
        return Math.round(rating * 10) / 10;
      },
    },
    totalReviews: {
      type: Number,
      default: 0,
      min: [0, 'Total reviews cannot be negative'],
      validate: {
        validator: function (count: number) {
          return Number.isInteger(count);
        },
        message: 'Total reviews must be a valid integer',
      },
    },
  },
  {
    timestamps: true,
    versionKey: false,
    _id: false, // Disable automatic _id generation since we're using custom UUID
  }
);

// Indexes for performance and search
bookSchema.index({ title: 1 }); // Index for title queries
bookSchema.index({ author: 1 }); // Index for author queries
bookSchema.index({ genres: 1 }); // Index for genre filtering
bookSchema.index({ averageRating: -1 }); // Index for sorting by rating (descending)
bookSchema.index({ totalReviews: -1 }); // Index for sorting by review count (descending)
bookSchema.index({ createdAt: -1 }); // Index for sorting by newest
bookSchema.index({ publishedYear: -1 }); // Index for sorting by publication year

// Text search index for title and author
bookSchema.index(
  { title: 'text', author: 'text', description: 'text' },
  {
    weights: {
      title: 10,
      author: 5,
      description: 1,
    },
    name: 'book_text_search',
  }
);

// Virtual field for formatted rating display
bookSchema.virtual('formattedRating').get(function () {
  return this.averageRating.toFixed(1);
});

// Virtual field to check if book is recently published (within last 2 years)
bookSchema.virtual('isRecentlyPublished').get(function () {
  const currentYear = new Date().getFullYear();
  return currentYear - this.publishedYear <= 2;
});

// Static method to find books by genre
bookSchema.statics.findByGenre = function (genre: string) {
  return this.find({ genres: genre });
};

// Static method to find books by author
bookSchema.statics.findByAuthor = function (author: string) {
  return this.find({ author: new RegExp(author, 'i') });
};

// Static method for text search
bookSchema.statics.searchBooks = function (searchTerm: string) {
  return this.find(
    { $text: { $search: searchTerm } },
    { score: { $meta: 'textScore' } }
  ).sort({ score: { $meta: 'textScore' } });
};

// Method to update rating statistics
bookSchema.methods.updateRatingStats = async function (
  newRating: number,
  isNewReview: boolean = true,
  oldRating?: number
) {
  if (isNewReview) {
    // Adding a new review
    const totalRatingPoints = this.averageRating * this.totalReviews + newRating;
    this.totalReviews += 1;
    this.averageRating = totalRatingPoints / this.totalReviews;
  } else if (oldRating !== undefined) {
    // Updating an existing review
    const totalRatingPoints = this.averageRating * this.totalReviews - oldRating + newRating;
    this.averageRating = this.totalReviews > 0 ? totalRatingPoints / this.totalReviews : 0;
  }
  
  // Round to 1 decimal place
  this.averageRating = Math.round(this.averageRating * 10) / 10;
  
  return this.save();
};

// Method to remove rating from statistics
bookSchema.methods.removeRatingFromStats = async function (ratingToRemove: number) {
  if (this.totalReviews > 0) {
    const totalRatingPoints = this.averageRating * this.totalReviews - ratingToRemove;
    this.totalReviews -= 1;
    this.averageRating = this.totalReviews > 0 ? totalRatingPoints / this.totalReviews : 0;
    
    // Round to 1 decimal place
    this.averageRating = Math.round(this.averageRating * 10) / 10;
  }
  
  return this.save();
};

// Ensure virtuals are included in JSON output
bookSchema.set('toJSON', { virtuals: true });
bookSchema.set('toObject', { virtuals: true });

// Create and export the Book model
const Book = mongoose.model<IBook>('Book', bookSchema);

export default Book;
export { VALID_GENRES };
