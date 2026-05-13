import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import mongoose from 'mongoose';
import { Cart } from '../src/models/Cart';

// Mock Redis
jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => ({
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue('OK'),
    setex: jest.fn().mockResolvedValue('OK'),
    del: jest.fn().mockResolvedValue(1),
    exists: jest.fn().mockResolvedValue(0),
    zadd: jest.fn().mockResolvedValue(1),
    zcard: jest.fn().mockResolvedValue(0),
    zremrangebyscore: jest.fn().mockResolvedValue(0),
    expire: jest.fn().mockResolvedValue(1),
    quit: jest.fn().mockResolvedValue('OK'),
  }));
});

describe('Cart Model', () => {
  beforeAll(async () => {
    // Connect to test database
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/rez-checkout-test';
    await mongoose.connect(mongoUri);
  });

  afterAll(async () => {
    // Clean up and disconnect
    await mongoose.connection.dropDatabase();
    await mongoose.connection.close();
  });

  describe('Cart Creation', () => {
    it('should create a cart with session ID', async () => {
      const cart = new Cart({
        sessionId: 'test-session-123',
        items: [],
        currency: 'INR',
      });

      await cart.save();

      expect(cart.sessionId).toBe('test-session-123');
      expect(cart.items).toEqual([]);
      expect(cart.currency).toBe('INR');
      expect(cart.isGuest).toBe(true);
    });

    it('should create a cart with user ID', async () => {
      const cart = new Cart({
        userId: 'user-123',
        sessionId: 'session-456',
        items: [],
        isGuest: false,
      });

      await cart.save();

      expect(cart.userId).toBe('user-123');
      expect(cart.isGuest).toBe(false);
    });
  });

  describe('Cart Items', () => {
    it('should add items to cart', async () => {
      const cart = new Cart({
        sessionId: 'test-session-items',
        items: [
          {
            productId: 'prod-001',
            merchantId: 'merchant-001',
            name: 'Test Product',
            price: 999,
            quantity: 2,
          },
        ],
      });

      await cart.save();

      expect(cart.items).toHaveLength(1);
      expect(cart.items[0].productId).toBe('prod-001');
      expect(cart.items[0].quantity).toBe(2);
    });

    it('should calculate subtotal automatically', async () => {
      const cart = new Cart({
        sessionId: 'test-session-total',
        items: [
          {
            productId: 'prod-001',
            merchantId: 'merchant-001',
            name: 'Product 1',
            price: 500,
            quantity: 2,
          },
          {
            productId: 'prod-002',
            merchantId: 'merchant-001',
            name: 'Product 2',
            price: 300,
            quantity: 1,
          },
        ],
      });

      await cart.save();

      expect(cart.subtotal).toBe(1100); // 500*2 + 300*1
      expect(cart.total).toBe(1100); // subtotal - discount (0) + tax (0)
    });
  });

  describe('Cart Expiration', () => {
    it('should set expiration date for guest carts', async () => {
      const cart = new Cart({
        sessionId: 'test-session-expire',
        items: [],
        isGuest: true,
      });

      await cart.save();

      expect(cart.expiresAt).toBeDefined();
      expect(cart.expiresAt!.getTime()).toBeGreaterThan(Date.now());
    });

    it('should not set expiration for user carts', async () => {
      const cart = new Cart({
        userId: 'user-expire',
        sessionId: 'session-expire',
        items: [],
        isGuest: false,
      });

      await cart.save();

      expect(cart.expiresAt).toBeUndefined();
    });
  });

  describe('findOrCreateBySession', () => {
    it('should create a new cart if none exists', async () => {
      const sessionId = `session-new-${Date.now()}`;
      const cart = await Cart.findOrCreateBySession(sessionId);

      expect(cart.sessionId).toBe(sessionId);
      expect(cart.items).toEqual([]);
    });

    it('should return existing cart if it exists', async () => {
      const sessionId = `session-existing-${Date.now()}`;

      // Create initial cart
      await Cart.findOrCreateBySession(sessionId);

      // Find it again
      const existingCart = await Cart.findOrCreateBySession(sessionId);

      const count = await Cart.countDocuments({ sessionId });
      expect(count).toBe(1);
      expect(existingCart.sessionId).toBe(sessionId);
    });
  });

  describe('findByUser', () => {
    it('should find cart by user ID', async () => {
      const userId = `user-find-${Date.now()}`;

      const cart = new Cart({
        userId,
        sessionId: `session-find-${Date.now()}`,
        items: [],
      });

      await cart.save();

      const foundCart = await Cart.findByUser(userId);
      expect(foundCart).not.toBeNull();
      expect(foundCart!.userId).toBe(userId);
    });

    it('should return null for non-existent user', async () => {
      const foundCart = await Cart.findByUser('non-existent-user');
      expect(foundCart).toBeNull();
    });
  });
});
