#!/usr/bin/env ts-node

/**
 * Comprehensive Test Data Generation Script
 * 
 * This script directly inserts test data into MongoDB bypassing API rate limits:
 * - 10 test users
 * - 50 test books (using existing + new ones)
 * - 100 reviews
 * - 25 favourites
 * - Test recommendations (by calling API with delays)
 * 
 * Usage: ts-node scripts/generate-comprehensive-test-data.ts
 */

import database from '../src/config/database';
import { User, Book, Review, Favorite } from '../src/models';
import { logger } from '../src/utils/logger';
import { faker } from '@faker-js/faker';
import axios from 'axios';

// Configuration
const BASE_URL = 'http://localhost:5001';
const API_VERSION = 'v1';
const API_BASE = `${BASE_URL}/${API_VERSION}`;

// Book genres are defined in the Book model and used in additionalBooks data

// Additional sample books to reach 50 total
const additionalBooks = [
  {
    title: "The Midnight Library",
    author: "Matt Haig",
    description: "Between life and death there is a library, and within that library, the shelves go on forever. Every book provides a chance to try another life you could have lived.",
    coverImageUrl: "https://images-na.ssl-images-amazon.com/images/I/81StSOpmkjL.jpg",
    genres: ["Fiction", "Philosophy"],
    publishedYear: 2020
  },
  {
    title: "Educated",
    author: "Tara Westover",
    description: "A memoir about a young girl who, kept out of school, leaves her survivalist family and goes on to earn a PhD from Cambridge University.",
    coverImageUrl: "https://images-na.ssl-images-amazon.com/images/I/81NjDXGtHRL.jpg",
    genres: ["Biography", "Non-Fiction"],
    publishedYear: 2018
  },
  {
    title: "The Seven Husbands of Evelyn Hugo",
    author: "Taylor Jenkins Reid",
    description: "A reclusive Hollywood icon finally tells her story to a young journalist, revealing stunning secrets about her glamorous and scandalous life.",
    coverImageUrl: "https://images-na.ssl-images-amazon.com/images/I/81Uf0FoK8PL.jpg",
    genres: ["Fiction", "Romance"],
    publishedYear: 2017
  },
  {
    title: "Atomic Habits",
    author: "James Clear",
    description: "An easy and proven way to build good habits and break bad ones through tiny changes that deliver remarkable results.",
    coverImageUrl: "https://images-na.ssl-images-amazon.com/images/I/81bGKUa1e0L.jpg",
    genres: ["Self-Help", "Business"],
    publishedYear: 2018
  },
  {
    title: "The Silent Patient",
    author: "Alex Michaelides",
    description: "A woman's act of violence against her husband and her refusal to speak sends shockwaves through London.",
    coverImageUrl: "https://images-na.ssl-images-amazon.com/images/I/81b9XrNBzjL.jpg",
    genres: ["Mystery", "Thriller"],
    publishedYear: 2019
  },
  {
    title: "Becoming",
    author: "Michelle Obama",
    description: "A memoir by former First Lady of the United States Michelle Obama, published in 2018.",
    coverImageUrl: "https://images-na.ssl-images-amazon.com/images/I/81h2gWPTYJL.jpg",
    genres: ["Biography", "Non-Fiction"],
    publishedYear: 2018
  },
  {
    title: "The Handmaid's Tale",
    author: "Margaret Atwood",
    description: "Set in a dystopian future, a woman struggles to survive as a reproductive surrogate under a totalitarian regime.",
    coverImageUrl: "https://images-na.ssl-images-amazon.com/images/I/91QiMTObNkL.jpg",
    genres: ["Fiction", "Science Fiction"],
    publishedYear: 1985
  },
  {
    title: "Circe",
    author: "Madeline Miller",
    description: "A stunning reimagining of the life of Circe, the nymph of Greek mythology who transforms from a minor goddess into a formidable witch.",
    coverImageUrl: "https://images-na.ssl-images-amazon.com/images/I/A1Cw8GvGJjL.jpg",
    genres: ["Fiction", "Fantasy"],
    publishedYear: 2018
  },
  {
    title: "The Subtle Art of Not Giving a F*ck",
    author: "Mark Manson",
    description: "A counterintuitive approach to living a good life through accepting negative experiences and focusing on what truly matters.",
    coverImageUrl: "https://images-na.ssl-images-amazon.com/images/I/71QKQ9mwV7L.jpg",
    genres: ["Self-Help", "Philosophy"],
    publishedYear: 2016
  },
  {
    title: "Where the Crawdads Sing",
    author: "Delia Owens",
    description: "A mystery about a young woman who raised herself in the marshes of the deep South and becomes a suspect in a murder.",
    coverImageUrl: "https://images-na.ssl-images-amazon.com/images/I/81O3sBMdGlL.jpg",
    genres: ["Fiction", "Mystery"],
    publishedYear: 2018
  },
  {
    title: "The Power of Now",
    author: "Eckhart Tolle",
    description: "A guide to spiritual enlightenment that focuses on the importance of living in the present moment.",
    coverImageUrl: "https://images-na.ssl-images-amazon.com/images/I/71-4MkLN9eL.jpg",
    genres: ["Self-Help", "Philosophy"],
    publishedYear: 1997
  },
  {
    title: "Normal People",
    author: "Sally Rooney",
    description: "A story about the complex relationship between two Irish teenagers as they navigate friendship, love, and class differences.",
    coverImageUrl: "https://images-na.ssl-images-amazon.com/images/I/81Lpb8bLzlL.jpg",
    genres: ["Fiction", "Romance"],
    publishedYear: 2018
  },
  {
    title: "The Invisible Man",
    author: "H.G. Wells",
    description: "A science fiction novel about a scientist who discovers how to make himself invisible but struggles with the consequences.",
    coverImageUrl: "https://images-na.ssl-images-amazon.com/images/I/81rRRmZZvgL.jpg",
    genres: ["Science Fiction", "Fiction"],
    publishedYear: 1897
  },
  {
    title: "Sapiens",
    author: "Yuval Noah Harari",
    description: "A brief history of humankind, exploring how Homo sapiens came to dominate the world.",
    coverImageUrl: "https://images-na.ssl-images-amazon.com/images/I/81ac5wbisJL.jpg",
    genres: ["History", "Science"],
    publishedYear: 2011
  },
  {
    title: "The Girl with the Dragon Tattoo",
    author: "Stieg Larsson",
    description: "A journalist and a hacker investigate a wealthy family's dark secrets in this Swedish crime thriller.",
    coverImageUrl: "https://images-na.ssl-images-amazon.com/images/I/91IGU6u5MnL.jpg",
    genres: ["Mystery", "Thriller"],
    publishedYear: 2005
  },
  {
    title: "The Martian",
    author: "Andy Weir",
    description: "An astronaut becomes stranded on Mars and must use his ingenuity to survive until rescue is possible.",
    coverImageUrl: "https://images-na.ssl-images-amazon.com/images/I/81L5jZbCckL.jpg",
    genres: ["Science Fiction", "Adventure"],
    publishedYear: 2011
  },
  {
    title: "Gone Girl",
    author: "Gillian Flynn",
    description: "A psychological thriller about a marriage gone terribly wrong when a wife disappears on her wedding anniversary.",
    coverImageUrl: "https://images-na.ssl-images-amazon.com/images/I/81a5KHEkwlL.jpg",
    genres: ["Mystery", "Thriller"],
    publishedYear: 2012
  },
  {
    title: "The Hunger Games",
    author: "Suzanne Collins",
    description: "In a dystopian future, a teenage girl volunteers to take her sister's place in a televised fight to the death.",
    coverImageUrl: "https://images-na.ssl-images-amazon.com/images/I/81djg0NjnYL.jpg",
    genres: ["Young Adult", "Science Fiction"],
    publishedYear: 2008
  },
  {
    title: "The Da Vinci Code",
    author: "Dan Brown",
    description: "A symbologist uncovers a conspiracy involving the Catholic Church and the Holy Grail.",
    coverImageUrl: "https://images-na.ssl-images-amazon.com/images/I/815WORuYMML.jpg",
    genres: ["Mystery", "Thriller"],
    publishedYear: 2003
  },
  {
    title: "The Fault in Our Stars",
    author: "John Green",
    description: "Two teenagers with cancer fall in love and embark on a journey to meet their favorite author.",
    coverImageUrl: "https://images-na.ssl-images-amazon.com/images/I/81a5KHEkwlL.jpg",
    genres: ["Young Adult", "Romance"],
    publishedYear: 2012
  },
  {
    title: "Thinking, Fast and Slow",
    author: "Daniel Kahneman",
    description: "A groundbreaking exploration of the two systems that drive the way we think and make decisions.",
    coverImageUrl: "https://images-na.ssl-images-amazon.com/images/I/81-QB7nDh4L.jpg",
    genres: ["Psychology", "Science"],
    publishedYear: 2011
  },
  {
    title: "The Book Thief",
    author: "Markus Zusak",
    description: "Set during World War II, a young girl living with foster parents steals books and shares them with others.",
    coverImageUrl: "https://images-na.ssl-images-amazon.com/images/I/81meKoUjhzL.jpg",
    genres: ["Fiction", "History"],
    publishedYear: 2005
  },
  {
    title: "Steve Jobs",
    author: "Walter Isaacson",
    description: "The exclusive biography of Apple co-founder Steve Jobs, based on extensive interviews.",
    coverImageUrl: "https://images-na.ssl-images-amazon.com/images/I/81VStYnDGrL.jpg",
    genres: ["Biography", "Technology"],
    publishedYear: 2011
  },
  {
    title: "The Lean Startup",
    author: "Eric Ries",
    description: "A methodology for developing businesses and products that aims to shorten product development cycles.",
    coverImageUrl: "https://images-na.ssl-images-amazon.com/images/I/81-QB7nDh4L.jpg",
    genres: ["Business", "Technology"],
    publishedYear: 2011
  },
  {
    title: "The 4-Hour Workweek",
    author: "Timothy Ferriss",
    description: "A guide to escaping the 9-5 grind and creating a lifestyle of freedom and adventure.",
    coverImageUrl: "https://images-na.ssl-images-amazon.com/images/I/81qw5CYKG8L.jpg",
    genres: ["Business", "Self-Help"],
    publishedYear: 2007
  },
  {
    title: "Outliers",
    author: "Malcolm Gladwell",
    description: "An examination of the factors that contribute to high levels of success.",
    coverImageUrl: "https://images-na.ssl-images-amazon.com/images/I/81bGKUa1e0L.jpg",
    genres: ["Psychology", "Business"],
    publishedYear: 2008
  },
  {
    title: "The Tipping Point",
    author: "Malcolm Gladwell",
    description: "How little things can make a big difference in creating social epidemics.",
    coverImageUrl: "https://images-na.ssl-images-amazon.com/images/I/81Lpb8bLzlL.jpg",
    genres: ["Psychology", "Business"],
    publishedYear: 2000
  },
  {
    title: "Blink",
    author: "Malcolm Gladwell",
    description: "The power of thinking without thinking - how we make decisions in the blink of an eye.",
    coverImageUrl: "https://images-na.ssl-images-amazon.com/images/I/81ac5wbisJL.jpg",
    genres: ["Psychology", "Science"],
    publishedYear: 2005
  },
  {
    title: "The Immortal Life of Henrietta Lacks",
    author: "Rebecca Skloot",
    description: "The story of how cells from a poor black woman became a medical miracle and changed science forever.",
    coverImageUrl: "https://images-na.ssl-images-amazon.com/images/I/81djg0NjnYL.jpg",
    genres: ["Science", "Biography"],
    publishedYear: 2010
  },
  {
    title: "A Brief History of Time",
    author: "Stephen Hawking",
    description: "A landmark volume in science writing that explores the nature of the universe.",
    coverImageUrl: "https://images-na.ssl-images-amazon.com/images/I/815WORuYMML.jpg",
    genres: ["Science", "Physics"],
    publishedYear: 1988
  }
];

// Test data storage
const testData = {
  users: [] as any[],
  books: [] as any[],
  reviews: [] as any[],
  favorites: [] as any[],
  recommendations: [] as any[]
};

// Generate test user data
function generateUserData() {
  return {
    name: faker.person.fullName(),
    email: faker.internet.email().toLowerCase(),
    password: 'TestPassword123!' // Standard password for all test users
  };
}

// Generate test review data
function generateReviewData(userId: string, bookId: string) {
  return {
    bookId,
    userId,
    text: faker.lorem.paragraphs(faker.number.int({ min: 1, max: 3 }), '\n\n'),
    rating: faker.number.int({ min: 1, max: 5 })
  };
}

// Create test users directly in database
async function createTestUsers() {
  logger.info('Creating 10 test users...');
  
  const existingUsers = await User.find({});
  logger.info(`Found ${existingUsers.length} existing users`);
  
  for (let i = 0; i < 10; i++) {
    try {
      const userData = generateUserData();
      
      // Check if user with this email already exists
      const existingUser = await User.findOne({ email: userData.email });
      if (existingUser) {
        logger.info(`User with email ${userData.email} already exists, skipping...`);
        continue;
      }
      
      const user = new User(userData);
      await user.save();
      
      testData.users.push(user);
      logger.info(`Created user: ${user.name} (${user.email})`);
      
    } catch (error) {
      logger.error(`Failed to create user ${i + 1}:`, error);
    }
  }
  
  logger.info(`Created ${testData.users.length} new test users`);
}

// Create additional books directly in database
async function createAdditionalBooks() {
  logger.info('Creating additional books to reach 50 total...');
  
  const existingBooks = await Book.find({});
  logger.info(`Found ${existingBooks.length} existing books`);
  
  testData.books = existingBooks;
  
  const booksToCreate = Math.max(0, 50 - existingBooks.length);
  
  if (booksToCreate > 0) {
    const booksToAdd = additionalBooks.slice(0, booksToCreate);
    
    for (const bookData of booksToAdd) {
      try {
        // Check if book already exists
        const existingBook = await Book.findOne({ 
          title: bookData.title, 
          author: bookData.author 
        });
        
        if (existingBook) {
          logger.info(`Book "${bookData.title}" already exists, skipping...`);
          continue;
        }
        
        const book = new Book(bookData);
        await book.save();
        
        testData.books.push(book);
        logger.info(`Created book: "${book.title}" by ${book.author}`);
        
      } catch (error) {
        logger.error(`Failed to create book "${bookData.title}":`, error);
      }
    }
  }
  
  logger.info(`Total books available: ${testData.books.length}`);
}

// Create test reviews directly in database
async function createTestReviews() {
  logger.info('Creating 100 test reviews...');
  
  if (testData.users.length === 0 || testData.books.length === 0) {
    logger.error('Cannot create reviews without users and books');
    return;
  }
  
  // Get all users (existing + new)
  const allUsers = await User.find({});
  
  let reviewsCreated = 0;
  const targetReviews = 100;
  
  for (let i = 0; i < targetReviews; i++) {
    try {
      const user = faker.helpers.arrayElement(allUsers);
      const book = faker.helpers.arrayElement(testData.books);
      
      // Check if user already reviewed this book
      const existingReview = await Review.findOne({ 
        userId: user._id, 
        bookId: book._id 
      });
      
      if (existingReview) {
        continue; // Skip if user already reviewed this book
      }
      
      const reviewData = generateReviewData(user._id, book._id);
      const review = new Review(reviewData);
      await review.save();
      
      testData.reviews.push(review);
      reviewsCreated++;
      
      logger.info(`Created review ${reviewsCreated}: User "${user.name}" reviewed "${book.title}" (${review.rating}/5)`);
      
    } catch (error) {
      logger.error(`Failed to create review ${i + 1}:`, error);
    }
  }
  
  logger.info(`Created ${reviewsCreated} test reviews`);
}

// Create test favorites directly in database
async function createTestFavorites() {
  logger.info('Creating 25 test favorites...');
  
  if (testData.books.length === 0) {
    logger.error('Cannot create favorites without books');
    return;
  }
  
  // Get all users (existing + new)
  const allUsers = await User.find({});
  
  let favoritesCreated = 0;
  const targetFavorites = 25;
  
  for (let i = 0; i < targetFavorites; i++) {
    try {
      const user = faker.helpers.arrayElement(allUsers);
      const book = faker.helpers.arrayElement(testData.books);
      
      // Check if user already favorited this book
      const existingFavorite = await Favorite.findOne({ 
        userId: user._id, 
        bookId: book._id 
      });
      
      if (existingFavorite) {
        continue; // Skip if user already favorited this book
      }
      
      const favorite = new Favorite({
        userId: user._id,
        bookId: book._id
      });
      await favorite.save();
      
      testData.favorites.push(favorite);
      favoritesCreated++;
      
      logger.info(`Created favorite ${favoritesCreated}: User "${user.name}" favorited "${book.title}"`);
      
    } catch (error) {
      logger.error(`Failed to create favorite ${i + 1}:`, error);
    }
  }
  
  logger.info(`Created ${favoritesCreated} test favorites`);
}

// Generate recommendations via API (with authentication)
async function generateTestRecommendations() {
  logger.info('Generating 15 test recommendations via API...');
  
  // Get all users and create tokens for them
  const allUsers = await User.find({});
  
  if (allUsers.length === 0) {
    logger.error('Cannot generate recommendations without users');
    return;
  }
  
  // Select 15 users (or all if less than 15)
  const usersForRecommendations = faker.helpers.arrayElements(
    allUsers, 
    Math.min(15, allUsers.length)
  );
  
  let recommendationsGenerated = 0;
  
  for (const user of usersForRecommendations) {
    try {
      // First, login to get a token
      const loginResponse = await axios.post(`${API_BASE}/auth/login`, {
        email: user.email,
        password: 'TestPassword123!' // Our standard test password
      });
      
      const token = loginResponse.data.data.token;
      
      // Then get recommendations
      const recommendationsResponse = await axios.get(`${API_BASE}/recommendations`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      testData.recommendations.push({
        userId: user._id,
        userName: user.name,
        recommendations: recommendationsResponse.data.data.recommendations || recommendationsResponse.data.data
      });
      
      recommendationsGenerated++;
      logger.info(`Generated recommendations ${recommendationsGenerated}: For user "${user.name}"`);
      
      // Add delay to avoid overwhelming the AI service
      if (recommendationsGenerated < usersForRecommendations.length) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
      
    } catch (error) {
      logger.error(`Failed to generate recommendations for user "${user.name}":`, error);
    }
  }
  
  logger.info(`Generated ${recommendationsGenerated} test recommendations`);
}

// Display comprehensive summary
function displaySummary() {
  logger.info('='.repeat(60));
  logger.info('📊 COMPREHENSIVE TEST DATA GENERATION SUMMARY');
  logger.info('='.repeat(60));
  logger.info(`👥 Test users created: ${testData.users.length}`);
  logger.info(`📚 Total books available: ${testData.books.length}`);
  logger.info(`📝 Test reviews created: ${testData.reviews.length}`);
  logger.info(`❤️  Test favorites created: ${testData.favorites.length}`);
  logger.info(`🎯 Test recommendations generated: ${testData.recommendations.length}`);
  logger.info('='.repeat(60));
  
  if (testData.users.length > 0) {
    logger.info('🔑 Sample Test User Credentials:');
    logger.info(`Email: ${testData.users[0].email}`);
    logger.info(`Password: TestPassword123!`);
  }
  
  logger.info('✅ Comprehensive test data generation completed!');
  logger.info('🚀 All APIs now have comprehensive test data for testing.');
}

// Main execution function
async function main() {
  try {
    logger.info('🚀 Starting Comprehensive Test Data Generation');
    logger.info('='.repeat(60));
    
    // Connect to database
    await database.connect();
    logger.info('Database connected successfully');
    
    // Generate test data
    await createTestUsers();
    await createAdditionalBooks();
    await createTestReviews();
    await createTestFavorites();
    await generateTestRecommendations();
    
    // Display summary
    displaySummary();
    
  } catch (error) {
    logger.error('Comprehensive test data generation failed:', error);
    process.exit(1);
  } finally {
    // Disconnect from database
    try {
      await database.disconnect();
      logger.info('Database connection closed');
    } catch (error) {
      logger.error('Error closing database connection:', error);
    }
  }
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection:', { promise, reason });
  process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', { error });
  process.exit(1);
});

// Run the script
main();
