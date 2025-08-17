import { beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals';

// Set test environment
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'error'; // Reduce log noise during tests
process.env.JWT_SECRET = 'test-jwt-secret';
process.env.PORT = '0'; // Use random available port for tests

// Global test setup
beforeAll(async () => {
  // Setup code that runs once before all tests
  console.log('🧪 Setting up test environment...');
});

afterAll(async () => {
  // Cleanup code that runs once after all tests
  console.log('🧹 Cleaning up test environment...');
});

beforeEach(async () => {
  // Setup code that runs before each test
});

afterEach(async () => {
  // Cleanup code that runs after each test
});

// Increase timeout for integration tests
jest.setTimeout(30000);