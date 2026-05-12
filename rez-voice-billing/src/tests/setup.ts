/**
 * Test Setup - Jest configuration
 */

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.MONGODB_URI = 'mongodb://localhost:27017/rez-voice-billing-test';
process.env.REDIS_URL = 'redis://localhost:6379';
process.env.JWT_SECRET = 'test-secret';
process.env.DEFAULT_RATE_PER_MINUTE = '0.05';

// Global test timeout
jest.setTimeout(10000);

// Mock logger to prevent console output during tests
jest.mock('../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));
