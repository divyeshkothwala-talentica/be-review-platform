#!/usr/bin/env node

/**
 * Test Data Generation Script for Book Review Platform
 * 
 * This script generates comprehensive test data by calling the actual APIs:
 * - 10 test users
 * - 50 test books
 * - 100 reviews
 * - 25 favourites
 * - 15 recommendations
 * 
 * Usage: node generate-test-data.js
 */

const axios = require('axios');
const { faker } = require('@faker-js/faker');

// Configuration
const BASE_URL = 'http://localhost:5001';
const API_VERSION = 'v1';
const API_BASE = `${BASE_URL}/${API_VERSION}`;

// Test data storage
const testData = {
  users: [],
  books: [],
  reviews: [],
  favorites: [],
  recommendations: []
};

// Book genres from the backend model
const VALID_GENRES = [
  'Fiction', 'Non-Fiction', 'Mystery', 'Thriller', 'Romance',
  'Science Fiction', 'Fantasy', 'Horror', 'Biography', 'History',
  'Self-Help', 'Business', 'Health', 'Travel', 'Cooking',
  'Art', 'Poetry', 'Drama', 'Adventure', 'Young Adult',
  'Children', 'Philosophy', 'Religion', 'Politics', 'Science', 'Technology'
];

// Helper function to make API requests with error handling
async function makeRequest(method, url, data = null, headers = {}) {
  try {
    const config = {
      method,
      url,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    };
    
    if (data) {
      config.data = data;
    }

    const response = await axios(config);
    return response.data;
  } catch (error) {
    console.error(`Error making ${method} request to ${url}:`, {
      status: error.response?.status,
      statusText: error.response?.statusText,
      message: error.response?.data?.message || error.message,
      data: error.response?.data
    });
    throw error;
  }
}

// Generate test user data
function generateUserData() {
  return {
    name: faker.person.fullName(),
    email: faker.internet.email().toLowerCase(),
    password: 'TestPassword123!' // Standard password for all test users
  };
}

// Generate test book data
function generateBookData() {
  const numGenres = faker.number.int({ min: 1, max: 3 });
  const selectedGenres = faker.helpers.arrayElements(VALID_GENRES, numGenres);
  
  return {
    title: faker.lorem.words({ min: 1, max: 4 }),
    author: faker.person.fullName(),
    description: faker.lorem.paragraphs(2, '\n\n'),
    coverImageUrl: faker.image.url({ width: 300, height: 450 }),
    genres: selectedGenres,
    publishedYear: faker.number.int({ min: 1950, max: 2024 })
  };
}

// Generate test review data
function generateReviewData(userId, bookId) {
  return {
    bookId,
    text: faker.lorem.paragraphs(faker.number.int({ min: 1, max: 3 }), '\n\n'),
    rating: faker.number.int({ min: 1, max: 5 })
  };
}

// Create test users
async function createTestUsers() {
  console.log('\n🔄 Creating 10 test users...');
  
  for (let i = 0; i < 10; i++) {
    try {
      const userData = generateUserData();
      console.log(`Creating user ${i + 1}: ${userData.email}`);
      
      const response = await makeRequest('POST', `${API_BASE}/auth/register`, userData);
      
      // Login to get token
      const loginResponse = await makeRequest('POST', `${API_BASE}/auth/login`, {
        email: userData.email,
        password: userData.password
      });
      
      testData.users.push({
        ...response.data.user,
        token: loginResponse.data.token,
        password: userData.password
      });
      
      console.log(`✅ User ${i + 1} created successfully`);
    } catch (error) {
      console.error(`❌ Failed to create user ${i + 1}:`, error.message);
    }
  }
  
  console.log(`\n✅ Created ${testData.users.length}/10 test users`);
}

// Create test books (using first user's token for authentication if needed)
async function createTestBooks() {
  console.log('\n🔄 Creating 50 test books...');
  
  // For this demo, we'll assume books can be created without authentication
  // If authentication is required, we'll use the first user's token
  const authHeaders = testData.users.length > 0 ? {
    'Authorization': `Bearer ${testData.users[0].token}`
  } : {};
  
  for (let i = 0; i < 50; i++) {
    try {
      const bookData = generateBookData();
      console.log(`Creating book ${i + 1}: "${bookData.title}" by ${bookData.author}`);
      
      // Note: If there's no direct book creation endpoint, we might need to seed books differently
      // For now, we'll try to create via API or use existing books
      
      // Since there might not be a direct book creation API, let's first try to get existing books
      try {
        const existingBooks = await makeRequest('GET', `${API_BASE}/books?limit=50`);
        if (existingBooks.data && existingBooks.data.books && existingBooks.data.books.length > 0) {
          // Use existing books instead of creating new ones
          testData.books = existingBooks.data.books;
          console.log(`📚 Using ${testData.books.length} existing books from database`);
          break;
        }
      } catch (error) {
        console.log('No existing books found, will need to seed books first');
      }
      
      // If we reach here, we need to create books via seeding or admin API
      console.log('⚠️  Book creation via API not available. Please run: npm run seed');
      break;
      
    } catch (error) {
      console.error(`❌ Failed to create book ${i + 1}:`, error.message);
    }
  }
  
  // If no books were created/found, try to get books again
  if (testData.books.length === 0) {
    try {
      const booksResponse = await makeRequest('GET', `${API_BASE}/books?limit=50`);
      if (booksResponse.data && booksResponse.data.books) {
        testData.books = booksResponse.data.books;
        console.log(`📚 Retrieved ${testData.books.length} existing books`);
      }
    } catch (error) {
      console.error('❌ Could not retrieve books. Make sure to run: npm run seed');
    }
  }
  
  console.log(`\n✅ Available books: ${testData.books.length}`);
}

// Create test reviews
async function createTestReviews() {
  console.log('\n🔄 Creating 100 test reviews...');
  
  if (testData.users.length === 0 || testData.books.length === 0) {
    console.error('❌ Cannot create reviews without users and books');
    return;
  }
  
  const reviewsToCreate = Math.min(100, testData.users.length * testData.books.length);
  let reviewsCreated = 0;
  
  for (let i = 0; i < reviewsToCreate && reviewsCreated < 100; i++) {
    try {
      const user = faker.helpers.arrayElement(testData.users);
      const book = faker.helpers.arrayElement(testData.books);
      
      // Check if user already reviewed this book
      const existingReview = testData.reviews.find(r => 
        r.userId === user._id && r.bookId === book._id
      );
      
      if (existingReview) {
        continue; // Skip if user already reviewed this book
      }
      
      const reviewData = generateReviewData(user._id, book._id);
      console.log(`Creating review ${reviewsCreated + 1}: User "${user.name}" reviewing "${book.title}"`);
      
      const response = await makeRequest('POST', `${API_BASE}/reviews`, reviewData, {
        'Authorization': `Bearer ${user.token}`
      });
      
      testData.reviews.push(response.data.review);
      reviewsCreated++;
      
      console.log(`✅ Review ${reviewsCreated} created successfully`);
    } catch (error) {
      console.error(`❌ Failed to create review ${reviewsCreated + 1}:`, error.message);
    }
  }
  
  console.log(`\n✅ Created ${testData.reviews.length}/100 test reviews`);
}

// Create test favorites
async function createTestFavorites() {
  console.log('\n🔄 Creating 25 test favorites...');
  
  if (testData.users.length === 0 || testData.books.length === 0) {
    console.error('❌ Cannot create favorites without users and books');
    return;
  }
  
  let favoritesCreated = 0;
  
  for (let i = 0; i < 25; i++) {
    try {
      const user = faker.helpers.arrayElement(testData.users);
      const book = faker.helpers.arrayElement(testData.books);
      
      // Check if user already favorited this book
      const existingFavorite = testData.favorites.find(f => 
        f.userId === user._id && f.bookId === book._id
      );
      
      if (existingFavorite) {
        continue; // Skip if user already favorited this book
      }
      
      console.log(`Creating favorite ${favoritesCreated + 1}: User "${user.name}" favoriting "${book.title}"`);
      
      const response = await makeRequest('POST', `${API_BASE}/favorites`, {
        bookId: book._id
      }, {
        'Authorization': `Bearer ${user.token}`
      });
      
      testData.favorites.push(response.data.favorite);
      favoritesCreated++;
      
      console.log(`✅ Favorite ${favoritesCreated} created successfully`);
    } catch (error) {
      console.error(`❌ Failed to create favorite ${favoritesCreated + 1}:`, error.message);
    }
  }
  
  console.log(`\n✅ Created ${testData.favorites.length}/25 test favorites`);
}

// Generate test recommendations
async function generateTestRecommendations() {
  console.log('\n🔄 Generating 15 test recommendations...');
  
  if (testData.users.length === 0) {
    console.error('❌ Cannot generate recommendations without users');
    return;
  }
  
  let recommendationsGenerated = 0;
  
  // Select 15 users (or all if less than 15) to generate recommendations for
  const usersForRecommendations = faker.helpers.arrayElements(
    testData.users, 
    Math.min(15, testData.users.length)
  );
  
  for (const user of usersForRecommendations) {
    try {
      console.log(`Generating recommendations ${recommendationsGenerated + 1}: For user "${user.name}"`);
      
      const response = await makeRequest('GET', `${API_BASE}/recommendations`, null, {
        'Authorization': `Bearer ${user.token}`
      });
      
      testData.recommendations.push({
        userId: user._id,
        userName: user.name,
        recommendations: response.data.recommendations || response.data
      });
      
      recommendationsGenerated++;
      console.log(`✅ Recommendations ${recommendationsGenerated} generated successfully`);
      
      // Add a small delay to avoid overwhelming the AI service
      await new Promise(resolve => setTimeout(resolve, 1000));
      
    } catch (error) {
      console.error(`❌ Failed to generate recommendations for user "${user.name}":`, error.message);
    }
  }
  
  console.log(`\n✅ Generated ${testData.recommendations.length}/15 test recommendations`);
}

// Health check
async function checkServerHealth() {
  console.log('🔍 Checking server health...');
  
  try {
    const healthResponse = await makeRequest('GET', `${BASE_URL}/health`);
    console.log('✅ Server is healthy:', healthResponse);
    return true;
  } catch (error) {
    console.error('❌ Server health check failed:', error.message);
    return false;
  }
}

// Display summary
function displaySummary() {
  console.log('\n' + '='.repeat(60));
  console.log('📊 TEST DATA GENERATION SUMMARY');
  console.log('='.repeat(60));
  console.log(`👥 Users created: ${testData.users.length}/10`);
  console.log(`📚 Books available: ${testData.books.length}/50`);
  console.log(`📝 Reviews created: ${testData.reviews.length}/100`);
  console.log(`❤️  Favorites created: ${testData.favorites.length}/25`);
  console.log(`🎯 Recommendations generated: ${testData.recommendations.length}/15`);
  console.log('='.repeat(60));
  
  if (testData.users.length > 0) {
    console.log('\n🔑 Sample User Credentials:');
    console.log(`Email: ${testData.users[0].email}`);
    console.log(`Password: ${testData.users[0].password}`);
    console.log(`Token: ${testData.users[0].token.substring(0, 20)}...`);
  }
  
  console.log('\n✅ Test data generation completed!');
  console.log('🚀 You can now test all APIs with the generated data.');
}

// Main execution function
async function main() {
  console.log('🚀 Starting Test Data Generation for Book Review Platform');
  console.log('='.repeat(60));
  
  try {
    // Check if server is running
    const isHealthy = await checkServerHealth();
    if (!isHealthy) {
      console.error('❌ Server is not running. Please start the server first with: npm run dev');
      process.exit(1);
    }
    
    // Generate test data in sequence
    await createTestUsers();
    await createTestBooks();
    await createTestReviews();
    await createTestFavorites();
    await generateTestRecommendations();
    
    // Display summary
    displaySummary();
    
  } catch (error) {
    console.error('❌ Test data generation failed:', error.message);
    process.exit(1);
  }
}

// Handle script termination
process.on('SIGINT', () => {
  console.log('\n⚠️  Test data generation interrupted');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n⚠️  Test data generation terminated');
  process.exit(0);
});

// Run the script
if (require.main === module) {
  main();
}

module.exports = {
  main,
  testData,
  generateUserData,
  generateBookData,
  generateReviewData
};
