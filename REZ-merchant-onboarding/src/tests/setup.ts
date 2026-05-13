// Test setup file
beforeAll(() => {
  // Set test environment variables
  process.env.JWT_SECRET = 'test-secret-key';
  process.env.JWT_EXPIRES_IN = '1h';
  process.env.NODE_ENV = 'test';
});

afterAll(() => {
  // Cleanup
});
