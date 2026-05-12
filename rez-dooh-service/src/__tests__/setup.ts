/**
 * DOOH Service - Test Setup
 *
 * Jest setup file for all tests.
 */

// Set test environment
process.env.NODE_ENV = 'test';
process.env.JEST_WORKER_ID = String(process.env.JEST_WORKER_ID || 1);

// Increase timeout for async operations
jest.setTimeout(10000);

// Global beforeAll/afterAll hooks
beforeAll(async () => {
  // Any global setup
});

afterAll(async () => {
  // Any global cleanup
});
