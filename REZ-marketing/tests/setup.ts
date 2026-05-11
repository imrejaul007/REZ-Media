/**
 * Jest Test Setup
 *
 * Sets up the test environment with:
 * - Environment variables for testing
 * - MongoDB memory server
 * - Test utilities and helpers
 */

import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import jwt from 'jsonwebtoken';

let mongoServer: MongoMemoryServer;

// Increase timeout for MongoDB memory server startup
jest.setTimeout(60000);

// Set up test environment variables BEFORE any imports
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-for-integration-tests';
process.env.REDIS_URL = 'redis://localhost:6379';
process.env.PORT = '4001';
process.env.SENTRY_DSN = '';
process.env.NOTIFICATION_SERVICE_URL = 'http://localhost:3001';
process.env.INTERNAL_SERVICE_TOKENS_JSON = JSON.stringify({
  'rez-notification-events': 'test-notification-token',
  'rez-marketing-service': 'test-marketing-token',
});

// Global test utilities
export const testMerchantId = new mongoose.Types.ObjectId().toString();
export const testUserId = new mongoose.Types.ObjectId().toString();
export const testOrderId = new mongoose.Types.ObjectId().toString();

// Generate test JWT tokens
export function generateMerchantToken(merchantId?: string): string {
  const id = merchantId || testMerchantId;
  return jwt.sign(
    {
      _id: id,
      merchantId: id,
      merchant: { _id: id, name: 'Test Merchant' },
      role: 'merchant',
    },
    process.env.JWT_SECRET!,
    { expiresIn: '1h' }
  );
}

export function generateUserToken(userId?: string): string {
  const id = userId || testUserId;
  return jwt.sign(
    {
      _id: id,
      userId: id,
      role: 'user',
    },
    process.env.JWT_SECRET!,
    { expiresIn: '1h' }
  );
}

export function generateAdminToken(): string {
  return jwt.sign(
    {
      _id: 'admin-id',
      userId: 'admin-id',
      role: 'admin',
      isAdmin: true,
    },
    process.env.JWT_SECRET!,
    { expiresIn: '1h' }
  );
}

// Test data factories
export const testCampaignData = {
  merchantId: testMerchantId,
  name: 'Test Campaign',
  objective: 'awareness' as const,
  channel: 'push' as const,
  message: 'Hello from test campaign!',
  audience: { segment: 'all' as const },
  createdBy: testMerchantId,
};

export const testVoucherData = {
  type: 'percentage' as const,
  value: 10,
  minOrderValue: 100,
  maxDiscount: 500,
  maxUses: 100,
  validFrom: new Date(),
  validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
  applicableTo: 'all' as const,
  merchantId: testMerchantId,
  createdBy: testMerchantId,
};

export const testBroadcastData = {
  segment: 'all' as const,
  message: 'Test broadcast message',
  channels: ['push', 'in_app'] as const,
  merchantId: testMerchantId,
  name: 'Test Broadcast',
};

// Setup before all tests
beforeAll(async () => {
  // Create MongoDB Memory Server
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();

  // Set the MongoDB URI
  process.env.MONGODB_URI = mongoUri;

  // Connect to the in-memory database
  await mongoose.connect(mongoUri, {
    maxPoolSize: 10,
    minPoolSize: 2,
    serverSelectionTimeoutMS: 10000,
    socketTimeoutMS: 45000,
  });
});

// Cleanup after all tests
afterAll(async () => {
  if (mongoose.connection.readyState === 1) {
    await mongoose.connection.dropDatabase();
    await mongoose.connection.close();
  }
  if (mongoServer) {
    await mongoServer.stop();
  }
});

// Clean up between tests
afterEach(async () => {
  if (mongoose.connection.readyState === 1) {
    const collections = mongoose.connection.collections;
    for (const key in collections) {
      const collection = collections[key];
      await collection.deleteMany({});
    }
  }
});
