#!/usr/bin/env node

/**
 * Additional Test Data Generation Script for Book Review Platform
 * 
 * This script creates additional test data with better rate limit handling:
 * - More test users (with delays)
 * - More reviews (with proper error handling)
 * - Additional favorites
 * - More recommendations
 * 
 * Usage: node generate-additional-test-data.js
 */

const axios = require('axios');
const { faker } = require('@faker-js/faker');

// Configuration
const BASE_URL = 'http://localhost:5001';
const API_VERSION = 'v1';
const API_BASE = `${BASE_URL}/${API_VERSION}`;

// Delays to handle rate limits
const DELAYS = {
  USER_CREATION: 2000, // 2 seconds between user creations
  REVIEW_CREATION: 1000, // 1 second between reviews
  FAVORITE_CREATION: 500, // 0.5 seconds between favorites
  RECOMMENDATION_GENERATION: 3000, // 3 seconds between recommendations
};

// Test data storage
const testData = {
  users: [],
  books: [],
  reviews: [],
  favorites: [],
  recommendations: []
};

// Helper function to sleep
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

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
    if (error.response?.status === 429) {
      // Rate limit hit, wait and retry
      console.log('⏳ Rate limit hit, waiting 30 seconds...');
      await sleep(30000);
      return makeRequest(method, url, data, headers);
    }
    
    console.error(`Error making ${method} request to ${url}:`, {
      status: error.response?.status,
      statusText: error.response?.statusText,
      message: error.response?.data?.message || error.message
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

// Generate test review data
function generateReviewData(userId, bookId) {
  return {
    bookId,
    text: faker.lorem.paragraphs(faker.number.int({ min: 1, max: 3 }), '\n\n'),
    rating: faker.number.int({ min: 1, max: 5 })
  };
}

// Create additional test users
async function createAdditionalUsers(targetCount = 6) {
  console.log(`\n🔄 Creating ${targetCount} additional test users...`);
  
  for (let i = 0; i < targetCount; i++) {
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
      
      // Wait to avoid rate limits
      if (i < targetCount - 1) {
        await sleep(DELAYS.USER_CREATION);
      }
      
    } catch (error) {
      console.error(`❌ Failed to create user ${i + 1}:`, error.message);
      // Continue with next user
    }
  }
  
  console.log(`\n✅ Created ${testData.users.length} additional test users`);
}

// Get existing books
async function getExistingBooks() {
  console.log('\n🔄 Fetching existing books...');
  
  try {
    const booksResponse = await makeRequest('GET', `${API_BASE}/books?limit=50`);
    if (booksResponse.data && booksResponse.data.books) {
      testData.books = booksResponse.data.books;
      console.log(`📚 Retrieved ${testData.books.length} existing books`);
    }
  } catch (error) {
    console.error('❌ Could not retrieve books:', error.message);
  }
}

// Create test reviews with better error handling
async function createTestReviews(targetCount = 50) {
  console.log(`\n🔄 Creating ${targetCount} test reviews...`);
  
  if (testData.users.length === 0 || testData.books.length === 0) {
    console.error('❌ Cannot create reviews without users and books');
    return;
  }
  
  let reviewsCreated = 0;
  let attempts = 0;
  const maxAttempts = targetCount * 3; // Allow more attempts than target
  
  while (reviewsCreated < targetCount && attempts < maxAttempts) {
    try {
      const user = faker.helpers.arrayElement(testData.users);
      const book = faker.helpers.arrayElement(testData.books);
      
      // Check if user already reviewed this book
      const existingReview = testData.reviews.find(r => 
        r.userId === user._id && r.bookId === book._id
      );
      
      if (existingReview) {
        attempts++;
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
      
      // Wait to avoid rate limits
      if (reviewsCreated < targetCount) {
        await sleep(DELAYS.REVIEW_CREATION);
      }
      
    } catch (error) {
      if (error.response?.status === 409) {
        // Duplicate review, just continue
        console.log(`⚠️  Duplicate review detected, continuing...`);
      } else {
        console.error(`❌ Failed to create review:`, error.message);
      }
    }
    
    attempts++;
  }
  
  console.log(`\n✅ Created ${testData.reviews.length} test reviews`);
}

// Create additional favorites
async function createAdditionalFavorites(targetCount = 13) {
  console.log(`\n🔄 Creating ${targetCount} additional test favorites...`);
  
  if (testData.users.length === 0 || testData.books.length === 0) {
    console.error('❌ Cannot create favorites without users and books');
    return;
  }
  
  let favoritesCreated = 0;
  let attempts = 0;
  const maxAttempts = targetCount * 3;
  
  while (favoritesCreated < targetCount && attempts < maxAttempts) {
    try {
      const user = faker.helpers.arrayElement(testData.users);
      const book = faker.helpers.arrayElement(testData.books);
      
      // Check if user already favorited this book
      const existingFavorite = testData.favorites.find(f => 
        f.userId === user._id && f.bookId === book._id
      );
      
      if (existingFavorite) {
        attempts++;
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
      
      // Wait to avoid rate limits
      if (favoritesCreated < targetCount) {
        await sleep(DELAYS.FAVORITE_CREATION);
      }
      
    } catch (error) {
      if (error.response?.status === 400) {
        // Already favorited, just continue
        console.log(`⚠️  Book already favorited, continuing...`);
      } else {
        console.error(`❌ Failed to create favorite:`, error.message);
      }
    }
    
    attempts++;
  }
  
  console.log(`\n✅ Created ${testData.favorites.length} additional favorites`);
}

// Generate additional recommendations
async function generateAdditionalRecommendations(targetCount = 11) {
  console.log(`\n🔄 Generating ${targetCount} additional test recommendations...`);
  
  if (testData.users.length === 0) {
    console.error('❌ Cannot generate recommendations without users');
    return;
  }
  
  let recommendationsGenerated = 0;
  
  // Select users to generate recommendations for
  const usersForRecommendations = faker.helpers.arrayElements(
    testData.users, 
    Math.min(targetCount, testData.users.length)
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
      
      // Add a delay to avoid overwhelming the AI service
      if (recommendationsGenerated < targetCount) {
        await sleep(DELAYS.RECOMMENDATION_GENERATION);
      }
      
    } catch (error) {
      console.error(`❌ Failed to generate recommendations for user "${user.name}":`, error.message);
    }
  }
  
  console.log(`\n✅ Generated ${testData.recommendations.length} additional recommendations`);
}

// Display summary
function displaySummary() {
  console.log('\n' + '='.repeat(60));
  console.log('📊 ADDITIONAL TEST DATA GENERATION SUMMARY');
  console.log('='.repeat(60));
  console.log(`👥 Additional users created: ${testData.users.length}`);
  console.log(`📚 Books available: ${testData.books.length}`);
  console.log(`📝 Additional reviews created: ${testData.reviews.length}`);
  console.log(`❤️  Additional favorites created: ${testData.favorites.length}`);
  console.log(`🎯 Additional recommendations generated: ${testData.recommendations.length}`);
  console.log('='.repeat(60));
  
  if (testData.users.length > 0) {
    console.log('\n🔑 Sample New User Credentials:');
    console.log(`Email: ${testData.users[0].email}`);
    console.log(`Password: ${testData.users[0].password}`);
  }
  
  console.log('\n✅ Additional test data generation completed!');
  console.log('🚀 You now have more comprehensive test data for all APIs.');
}

// Main execution function
async function main() {
  console.log('🚀 Starting Additional Test Data Generation for Book Review Platform');
  console.log('='.repeat(70));
  
  try {
    // Get existing books first
    await getExistingBooks();
    
    // Generate additional test data
    await createAdditionalUsers(6); // Create 6 more users (total 10)
    await createTestReviews(50); // Try to create 50 reviews
    await createAdditionalFavorites(13); // Create 13 more favorites (total 25)
    await generateAdditionalRecommendations(11); // Generate 11 more recommendations (total 15)
    
    // Display summary
    displaySummary();
    
  } catch (error) {
    console.error('❌ Additional test data generation failed:', error.message);
    process.exit(1);
  }
}

// Handle script termination
process.on('SIGINT', () => {
  console.log('\n⚠️  Additional test data generation interrupted');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n⚠️  Additional test data generation terminated');
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
  generateReviewData
};
