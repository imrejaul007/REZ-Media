// Test setup file
// Runs before each test file

// Set test environment
process.env.NODE_ENV = 'test';
process.env.JEST_WORKER_ID = String(process.env.JEST_WORKER_ID || 1);

// Increase timeout for integration tests
jest.setTimeout(10000);

// Mock console.log in tests to reduce noise
if (process.env.SILENT_TESTS === 'true') {
  global.console = {
    ...console,
    log: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };
}

// Global teardown
afterAll(async () => {
  // Add any global cleanup here
});
