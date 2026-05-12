// Test setup file
// This file is run before each test file

// Mock environment variables for testing
process.env.NODE_ENV = 'test';
process.env.PORT = '4091';
process.env.LOG_LEVEL = 'error';

// Suppress console logs during tests
if (typeof jest !== 'undefined') {
  global.console = {
    ...console,
    log: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };
}

// Global test timeout
jest.setTimeout(10000);
