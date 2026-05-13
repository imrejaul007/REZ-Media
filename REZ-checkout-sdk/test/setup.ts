// Test setup file
// This file is run before each test file

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-key';
process.env.MONGODB_URI = 'mongodb://localhost:27017/rez-checkout-test';
process.env.REDIS_URL = 'redis://localhost:6379';

// Increase timeout for async operations
jest.setTimeout(10000);

// Suppress console logs during tests
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};
