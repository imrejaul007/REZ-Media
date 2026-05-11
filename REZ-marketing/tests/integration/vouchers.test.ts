/**
 * Voucher Integration Tests
 *
 * Tests the complete voucher lifecycle including:
 * - Voucher creation with validation
 * - Voucher retrieval (by ID and code)
 * - Voucher listing with filters
 * - Voucher updates
 * - Voucher validation for orders
 * - Voucher redemption (atomic)
 * - Redemption history
 * - Expiration handling
 */

import request from 'supertest';
import express from 'express';
import mongoose from 'mongoose';
import voucherRoutes from '../../src/routes/vouchers';
import { Voucher } from '../../src/models/Voucher';
import { VoucherRedemption } from '../../src/models/VoucherRedemption';
import { generateMerchantToken, generateUserToken, testMerchantId, testUserId, testVoucherData } from '../setup';

// Mock external dependencies
jest.mock('../../src/services/growthAnalytics', () => ({
  growthAnalytics: {
    trackEvent: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock('../../src/services/notificationService', () => ({
  sendVoucherNotification: jest.fn().mockResolvedValue({ success: true, eventId: 'test-event-id' }),
}));

jest.mock('../../src/services/offerStackingService', () => ({
  offerStackingService: {
    calculateStacking: jest.fn().mockResolvedValue({
      canApply: true,
      finalDiscount: 10,
      appliedDiscounts: [],
    }),
  },
}));

describe('Vouchers API Integration Tests', () => {
  let app: express.Application;
  let merchantToken: string;
  let userToken: string;

  beforeAll(() => {
    app = express();
    app.use(express.json());
    app.use('/vouchers', voucherRoutes);
    merchantToken = generateMerchantToken();
    userToken = generateUserToken();
  });

  beforeEach(async () => {
    jest.clearAllMocks();
  });

  describe('POST /vouchers - Create Voucher', () => {
    it('should create a percentage voucher with all fields', async () => {
      const voucherData = {
        type: 'percentage',
        value: 15,
        minOrderValue: 200,
        maxDiscount: 1000,
        maxUses: 50,
        validFrom: new Date().toISOString(),
        validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        applicableTo: 'all',
        merchantId: testMerchantId,
        createdBy: testMerchantId,
      };

      const response = await request(app)
        .post('/vouchers')
        .set('Authorization', `Bearer ${merchantToken}`)
        .send(voucherData);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.voucher).toHaveProperty('_id');
      expect(response.body.voucher.code).toMatch(/^REZ[A-Z0-9]{6}$/);
      expect(response.body.voucher.type).toBe('percentage');
      expect(response.body.voucher.value).toBe(15);
      expect(response.body.voucher.status).toBe('active');
      expect(response.body.voucher.usedCount).toBe(0);
    });

    it('should create a fixed amount voucher', async () => {
      const voucherData = {
        type: 'fixed',
        value: 100,
        minOrderValue: 500,
        validFrom: new Date().toISOString(),
        validUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        merchantId: testMerchantId,
      };

      const response = await request(app)
        .post('/vouchers')
        .set('Authorization', `Bearer ${merchantToken}`)
        .send(voucherData);

      expect(response.status).toBe(201);
      expect(response.body.voucher.type).toBe('fixed');
      expect(response.body.voucher.value).toBe(100);
    });

    it('should create a BOGO voucher', async () => {
      const voucherData = {
        type: 'bogo',
        value: 100,
        validFrom: new Date().toISOString(),
        validUntil: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
        merchantId: testMerchantId,
      };

      const response = await request(app)
        .post('/vouchers')
        .set('Authorization', `Bearer ${merchantToken}`)
        .send(voucherData);

      expect(response.status).toBe(201);
      expect(response.body.voucher.type).toBe('bogo');
    });

    it('should create a free delivery voucher', async () => {
      const voucherData = {
        type: 'free_delivery',
        value: 0,
        validFrom: new Date().toISOString(),
        validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        merchantId: testMerchantId,
      };

      const response = await request(app)
        .post('/vouchers')
        .set('Authorization', `Bearer ${merchantToken}`)
        .send(voucherData);

      expect(response.status).toBe(201);
      expect(response.body.voucher.type).toBe('free_delivery');
    });

    it('should create voucher with custom code', async () => {
      const voucherData = {
        code: 'SAVE20',
        type: 'percentage',
        value: 20,
        validFrom: new Date().toISOString(),
        validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        merchantId: testMerchantId,
      };

      const response = await request(app)
        .post('/vouchers')
        .set('Authorization', `Bearer ${merchantToken}`)
        .send(voucherData);

      expect(response.status).toBe(201);
      expect(response.body.voucher.code).toBe('SAVE20');
    });

    it('should reject duplicate voucher codes', async () => {
      const voucherData = {
        code: 'UNIQUE1',
        type: 'percentage',
        value: 10,
        validFrom: new Date().toISOString(),
        validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        merchantId: testMerchantId,
      };

      // Create first voucher
      await request(app)
        .post('/vouchers')
        .set('Authorization', `Bearer ${merchantToken}`)
        .send(voucherData);

      // Try to create duplicate
      const response = await request(app)
        .post('/vouchers')
        .set('Authorization', `Bearer ${merchantToken}`)
        .send(voucherData);

      expect(response.status).toBe(400);
    });

    it('should reject invalid voucher type', async () => {
      const voucherData = {
        type: 'invalid_type',
        value: 10,
        validFrom: new Date().toISOString(),
        validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        merchantId: testMerchantId,
      };

      const response = await request(app)
        .post('/vouchers')
        .set('Authorization', `Bearer ${merchantToken}`)
        .send(voucherData);

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Validation failed');
    });

    it('should reject percentage value over 100', async () => {
      const voucherData = {
        type: 'percentage',
        value: 150,
        validFrom: new Date().toISOString(),
        validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        merchantId: testMerchantId,
      };

      const response = await request(app)
        .post('/vouchers')
        .set('Authorization', `Bearer ${merchantToken}`)
        .send(voucherData);

      expect(response.status).toBe(400);
    });

    it('should reject validUntil before validFrom', async () => {
      const voucherData = {
        type: 'percentage',
        value: 10,
        validFrom: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        validUntil: new Date().toISOString(),
        merchantId: testMerchantId,
      };

      const response = await request(app)
        .post('/vouchers')
        .set('Authorization', `Bearer ${merchantToken}`)
        .send(voucherData);

      expect(response.status).toBe(400);
    });

    it('should create voucher with category-specific applicability', async () => {
      const voucherData = {
        type: 'percentage',
        value: 10,
        validFrom: new Date().toISOString(),
        validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        applicableTo: 'category',
        applicableIds: ['cat-electronics', 'cat-fashion'],
        merchantId: testMerchantId,
      };

      const response = await request(app)
        .post('/vouchers')
        .set('Authorization', `Bearer ${merchantToken}`)
        .send(voucherData);

      expect(response.status).toBe(201);
      expect(response.body.voucher.applicableTo).toBe('category');
      expect(response.body.voucher.applicableIds).toEqual(['cat-electronics', 'cat-fashion']);
    });

    it('should send notification when sendNotification is true', async () => {
      const { sendVoucherNotification } = require('../../src/services/notificationService');

      const voucherData = {
        type: 'percentage',
        value: 10,
        validFrom: new Date().toISOString(),
        validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        merchantId: testMerchantId,
        sendNotification: true,
        recipientEmail: 'test@example.com',
        recipientUserId: testUserId,
      };

      await request(app)
        .post('/vouchers')
        .set('Authorization', `Bearer ${merchantToken}`)
        .send(voucherData);

      expect(sendVoucherNotification).toHaveBeenCalled();
    });
  });

  describe('GET /vouchers - List Vouchers', () => {
    beforeEach(async () => {
      // Create test vouchers
      const vouchers = [
        { ...testVoucherData, type: 'percentage', value: 10 },
        { ...testVoucherData, type: 'percentage', value: 20 },
        { ...testVoucherData, type: 'fixed', value: 100 },
      ];

      for (const voucher of vouchers) {
        await request(app)
          .post('/vouchers')
          .set('Authorization', `Bearer ${merchantToken}`)
          .send(voucher);
      }
    });

    it('should list all vouchers', async () => {
      const response = await request(app)
        .get('/vouchers')
        .set('Authorization', `Bearer ${merchantToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.vouchers.length).toBeGreaterThanOrEqual(3);
      expect(response.body.pagination).toBeDefined();
    });

    it('should filter vouchers by type', async () => {
      const response = await request(app)
        .get('/vouchers')
        .set('Authorization', `Bearer ${merchantToken}`)
        .query({ type: 'percentage' });

      expect(response.status).toBe(200);
      expect(response.body.vouchers.every((v: any) => v.type === 'percentage')).toBe(true);
    });

    it('should filter vouchers by status', async () => {
      const response = await request(app)
        .get('/vouchers')
        .set('Authorization', `Bearer ${merchantToken}`)
        .query({ status: 'active' });

      expect(response.status).toBe(200);
      expect(response.body.vouchers.every((v: any) => v.status === 'active')).toBe(true);
    });

    it('should paginate results', async () => {
      const response = await request(app)
        .get('/vouchers')
        .set('Authorization', `Bearer ${merchantToken}`)
        .query({ page: 1, limit: 2 });

      expect(response.status).toBe(200);
      expect(response.body.vouchers.length).toBeLessThanOrEqual(2);
      expect(response.body.pagination.page).toBe(1);
      expect(response.body.pagination.limit).toBe(2);
    });

    it('should reject invalid filter parameters', async () => {
      const response = await request(app)
        .get('/vouchers')
        .set('Authorization', `Bearer ${merchantToken}`)
        .query({ type: 'invalid' });

      expect(response.status).toBe(400);
    });
  });

  describe('GET /vouchers/:id - Get Voucher by ID', () => {
    let createdVoucherId: string;

    beforeEach(async () => {
      const createResponse = await request(app)
        .post('/vouchers')
        .set('Authorization', `Bearer ${merchantToken}`)
        .send(testVoucherData);

      createdVoucherId = createResponse.body.voucher._id;
    });

    it('should retrieve a voucher by ID', async () => {
      const response = await request(app)
        .get(`/vouchers/${createdVoucherId}`)
        .set('Authorization', `Bearer ${merchantToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.voucher._id).toBe(createdVoucherId);
    });

    it('should return 404 for non-existent voucher', async () => {
      const fakeId = new mongoose.Types.ObjectId().toString();

      const response = await request(app)
        .get(`/vouchers/${fakeId}`)
        .set('Authorization', `Bearer ${merchantToken}`);

      expect(response.status).toBe(404);
      expect(response.body.error).toContain('Voucher not found');
    });
  });

  describe('GET /vouchers/code/:code - Get Voucher by Code', () => {
    it('should retrieve an active voucher by code', async () => {
      // Create voucher with known code
      const createResponse = await request(app)
        .post('/vouchers')
        .set('Authorization', `Bearer ${merchantToken}`)
        .send({
          ...testVoucherData,
          code: 'TESTCODE',
        });

      const response = await request(app)
        .get('/vouchers/code/TESTCODE')
        .set('Authorization', `Bearer ${merchantToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.voucher.code).toBe('TESTCODE');
    });

    it('should return 404 for non-existent code', async () => {
      const response = await request(app)
        .get('/vouchers/code/NONEXISTENT')
        .set('Authorization', `Bearer ${merchantToken}`);

      expect(response.status).toBe(404);
    });

    it('should return inactive voucher by code', async () => {
      // Create and deactivate voucher
      const createResponse = await request(app)
        .post('/vouchers')
        .set('Authorization', `Bearer ${merchantToken}`)
        .send({
          ...testVoucherData,
          code: 'INACTIVE',
        });

      await request(app)
        .delete(`/vouchers/${createResponse.body.voucher._id}`)
        .set('Authorization', `Bearer ${merchantToken}`);

      // getByCode only returns active vouchers
      const response = await request(app)
        .get('/vouchers/code/INACTIVE')
        .set('Authorization', `Bearer ${merchantToken}`);

      expect(response.status).toBe(404);
    });
  });

  describe('PATCH /vouchers/:id - Update Voucher', () => {
    let createdVoucherId: string;

    beforeEach(async () => {
      const createResponse = await request(app)
        .post('/vouchers')
        .set('Authorization', `Bearer ${merchantToken}`)
        .send(testVoucherData);

      createdVoucherId = createResponse.body.voucher._id;
    });

    it('should update voucher value', async () => {
      const response = await request(app)
        .patch(`/vouchers/${createdVoucherId}`)
        .set('Authorization', `Bearer ${merchantToken}`)
        .send({ value: 25 });

      expect(response.status).toBe(200);
      expect(response.body.voucher.value).toBe(25);
    });

    it('should update voucher maxUses', async () => {
      const response = await request(app)
        .patch(`/vouchers/${createdVoucherId}`)
        .set('Authorization', `Bearer ${merchantToken}`)
        .send({ maxUses: 200 });

      expect(response.status).toBe(200);
      expect(response.body.voucher.maxUses).toBe(200);
    });

    it('should update voucher validUntil', async () => {
      const newDate = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString();

      const response = await request(app)
        .patch(`/vouchers/${createdVoucherId}`)
        .set('Authorization', `Bearer ${merchantToken}`)
        .send({ validUntil: newDate });

      expect(response.status).toBe(200);
    });

    it('should update voucher status', async () => {
      const response = await request(app)
        .patch(`/vouchers/${createdVoucherId}`)
        .set('Authorization', `Bearer ${merchantToken}`)
        .send({ status: 'cancelled' });

      expect(response.status).toBe(200);
      expect(response.body.voucher.status).toBe('cancelled');
    });

    it('should return 404 for non-existent voucher', async () => {
      const fakeId = new mongoose.Types.ObjectId().toString();

      const response = await request(app)
        .patch(`/vouchers/${fakeId}`)
        .set('Authorization', `Bearer ${merchantToken}`)
        .send({ value: 50 });

      expect(response.status).toBe(404);
    });
  });

  describe('DELETE /vouchers/:id - Deactivate Voucher', () => {
    it('should deactivate a voucher', async () => {
      const createResponse = await request(app)
        .post('/vouchers')
        .set('Authorization', `Bearer ${merchantToken}`)
        .send(testVoucherData);

      const voucherId = createResponse.body.voucher._id;

      const response = await request(app)
        .delete(`/vouchers/${voucherId}`)
        .set('Authorization', `Bearer ${merchantToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.voucher.status).toBe('cancelled');
    });

    it('should return 404 for non-existent voucher', async () => {
      const fakeId = new mongoose.Types.ObjectId().toString();

      const response = await request(app)
        .delete(`/vouchers/${fakeId}`)
        .set('Authorization', `Bearer ${merchantToken}`);

      expect(response.status).toBe(404);
    });
  });

  describe('POST /vouchers/validate - Validate Voucher', () => {
    it('should validate a valid voucher for sufficient order', async () => {
      const createResponse = await request(app)
        .post('/vouchers')
        .set('Authorization', `Bearer ${merchantToken}`)
        .send(testVoucherData);

      const voucherCode = createResponse.body.voucher.code;

      const response = await request(app)
        .post('/vouchers/validate')
        .set('Authorization', `Bearer ${merchantToken}`)
        .send({
          code: voucherCode,
          orderValue: 500,
          userId: testUserId,
        });

      expect(response.status).toBe(200);
      expect(response.body.valid).toBe(true);
      expect(response.body.discount).toBe(50); // 10% of 500
    });

    it('should reject voucher when order value is below minimum', async () => {
      const createResponse = await request(app)
        .post('/vouchers')
        .set('Authorization', `Bearer ${merchantToken}`)
        .send(testVoucherData);

      const voucherCode = createResponse.body.voucher.code;

      const response = await request(app)
        .post('/vouchers/validate')
        .set('Authorization', `Bearer ${merchantToken}`)
        .send({
          code: voucherCode,
          orderValue: 50, // Below minOrderValue of 100
          userId: testUserId,
        });

      expect(response.status).toBe(200);
      expect(response.body.valid).toBe(false);
      expect(response.body.errorCode).toBe('MIN_ORDER_NOT_MET');
    });

    it('should reject non-existent voucher', async () => {
      const response = await request(app)
        .post('/vouchers/validate')
        .set('Authorization', `Bearer ${merchantToken}`)
        .send({
          code: 'FAKE123',
          orderValue: 500,
          userId: testUserId,
        });

      expect(response.status).toBe(200);
      expect(response.body.valid).toBe(false);
      expect(response.body.errorCode).toBe('NOT_FOUND');
    });

    it('should reject already used voucher for same user', async () => {
      const createResponse = await request(app)
        .post('/vouchers')
        .set('Authorization', `Bearer ${merchantToken}`)
        .send(testVoucherData);

      const voucherCode = createResponse.body.voucher.code;
      const orderId = new mongoose.Types.ObjectId().toString();

      // First redeem
      await request(app)
        .post('/vouchers/redeem')
        .set('Authorization', `Bearer ${merchantToken}`)
        .send({
          code: voucherCode,
          userId: testUserId,
          orderId: orderId,
          orderValue: 500,
          merchantId: testMerchantId,
        });

      // Try to validate again
      const response = await request(app)
        .post('/vouchers/validate')
        .set('Authorization', `Bearer ${merchantToken}`)
        .send({
          code: voucherCode,
          orderValue: 500,
          userId: testUserId,
        });

      expect(response.status).toBe(200);
      expect(response.body.valid).toBe(false);
      expect(response.body.errorCode).toBe('ALREADY_USED');
    });

    it('should respect maxDiscount cap for percentage vouchers', async () => {
      const createResponse = await request(app)
        .post('/vouchers')
        .set('Authorization', `Bearer ${merchantToken}`)
        .send({
          ...testVoucherData,
          value: 50, // 50%
          maxDiscount: 100, // But capped at 100
        });

      const voucherCode = createResponse.body.voucher.code;

      const response = await request(app)
        .post('/vouchers/validate')
        .set('Authorization', `Bearer ${merchantToken}`)
        .send({
          code: voucherCode,
          orderValue: 1000, // Would be 500 without cap
          userId: testUserId,
        });

      expect(response.status).toBe(200);
      expect(response.body.valid).toBe(true);
      expect(response.body.discount).toBe(100); // Capped at maxDiscount
    });
  });

  describe('POST /vouchers/redeem - Redeem Voucher', () => {
    it('should successfully redeem a valid voucher', async () => {
      const createResponse = await request(app)
        .post('/vouchers')
        .set('Authorization', `Bearer ${merchantToken}`)
        .send(testVoucherData);

      const voucherCode = createResponse.body.voucher.code;
      const voucherId = createResponse.body.voucher._id;

      const response = await request(app)
        .post('/vouchers/redeem')
        .set('Authorization', `Bearer ${merchantToken}`)
        .send({
          code: voucherCode,
          userId: testUserId,
          orderId: new mongoose.Types.ObjectId().toString(),
          orderValue: 500,
          merchantId: testMerchantId,
        });

      expect(response.status).toBe(200);
      expect(response.body.valid).toBe(true);
      expect(response.body.discount).toBe(50);

      // Verify usedCount increased
      const getResponse = await request(app)
        .get(`/vouchers/${voucherId}`)
        .set('Authorization', `Bearer ${merchantToken}`);

      expect(getResponse.body.voucher.usedCount).toBe(1);
    });

    it('should mark voucher as exhausted when maxUses reached', async () => {
      // Create voucher with maxUses = 1
      const createResponse = await request(app)
        .post('/vouchers')
        .set('Authorization', `Bearer ${merchantToken}`)
        .send({
          ...testVoucherData,
          maxUses: 1,
        });

      const voucherCode = createResponse.body.voucher.code;
      const voucherId = createResponse.body.voucher._id;

      // First redemption
      await request(app)
        .post('/vouchers/redeem')
        .set('Authorization', `Bearer ${merchantToken}`)
        .send({
          code: voucherCode,
          userId: testUserId,
          orderId: new mongoose.Types.ObjectId().toString(),
          orderValue: 500,
          merchantId: testMerchantId,
        });

      // Verify status is exhausted
      const getResponse = await request(app)
        .get(`/vouchers/${voucherId}`)
        .set('Authorization', `Bearer ${merchantToken}`);

      expect(getResponse.body.voucher.status).toBe('exhausted');
    });

    it('should prevent duplicate redemption for same order', async () => {
      const createResponse = await request(app)
        .post('/vouchers')
        .set('Authorization', `Bearer ${merchantToken}`)
        .send(testVoucherData);

      const voucherCode = createResponse.body.voucher.code;
      const orderId = new mongoose.Types.ObjectId().toString();

      // First redemption
      await request(app)
        .post('/vouchers/redeem')
        .set('Authorization', `Bearer ${merchantToken}`)
        .send({
          code: voucherCode,
          userId: testUserId,
          orderId: orderId,
          orderValue: 500,
          merchantId: testMerchantId,
        });

      // Try to redeem same order again
      const response = await request(app)
        .post('/vouchers/redeem')
        .set('Authorization', `Bearer ${merchantToken}`)
        .send({
          code: voucherCode,
          userId: testUserId,
          orderId: orderId,
          orderValue: 500,
          merchantId: testMerchantId,
        });

      expect(response.status).toBe(400);
      expect(response.body.errorCode).toBe('ALREADY_USED');
    });

    it('should prevent same user from using voucher twice', async () => {
      const createResponse = await request(app)
        .post('/vouchers')
        .set('Authorization', `Bearer ${merchantToken}`)
        .send(testVoucherData);

      const voucherCode = createResponse.body.voucher.code;

      // First redemption
      await request(app)
        .post('/vouchers/redeem')
        .set('Authorization', `Bearer ${merchantToken}`)
        .send({
          code: voucherCode,
          userId: testUserId,
          orderId: new mongoose.Types.ObjectId().toString(),
          orderValue: 500,
          merchantId: testMerchantId,
        });

      // Try with same user again
      const response = await request(app)
        .post('/vouchers/redeem')
        .set('Authorization', `Bearer ${merchantToken}`)
        .send({
          code: voucherCode,
          userId: testUserId,
          orderId: new mongoose.Types.ObjectId().toString(),
          orderValue: 500,
          merchantId: testMerchantId,
        });

      expect(response.status).toBe(400);
      expect(response.body.errorCode).toBe('ALREADY_USED');
    });

    it('should allow different users to use the same voucher', async () => {
      const createResponse = await request(app)
        .post('/vouchers')
        .set('Authorization', `Bearer ${merchantToken}`)
        .send(testVoucherData);

      const voucherCode = createResponse.body.voucher.code;
      const otherUserId = new mongoose.Types.ObjectId().toString();

      // First user redemption
      await request(app)
        .post('/vouchers/redeem')
        .set('Authorization', `Bearer ${merchantToken}`)
        .send({
          code: voucherCode,
          userId: testUserId,
          orderId: new mongoose.Types.ObjectId().toString(),
          orderValue: 500,
          merchantId: testMerchantId,
        });

      // Different user redemption
      const response = await request(app)
        .post('/vouchers/redeem')
        .set('Authorization', `Bearer ${merchantToken}`)
        .send({
          code: voucherCode,
          userId: otherUserId,
          orderId: new mongoose.Types.ObjectId().toString(),
          orderValue: 500,
          merchantId: testMerchantId,
        });

      expect(response.status).toBe(200);
      expect(response.body.valid).toBe(true);
    });

    it('should reject redemption of cancelled voucher', async () => {
      const createResponse = await request(app)
        .post('/vouchers')
        .set('Authorization', `Bearer ${merchantToken}`)
        .send(testVoucherData);

      const voucherCode = createResponse.body.voucher.code;
      const voucherId = createResponse.body.voucher._id;

      // Cancel voucher
      await request(app)
        .delete(`/vouchers/${voucherId}`)
        .set('Authorization', `Bearer ${merchantToken}`);

      // Try to redeem
      const response = await request(app)
        .post('/vouchers/redeem')
        .set('Authorization', `Bearer ${merchantToken}`)
        .send({
          code: voucherCode,
          userId: testUserId,
          orderId: new mongoose.Types.ObjectId().toString(),
          orderValue: 500,
          merchantId: testMerchantId,
        });

      expect(response.status).toBe(400);
      expect(response.body.errorCode).toBe('CANCELLED');
    });
  });

  describe('GET /vouchers/:id/redemptions - Get Redemptions', () => {
    it('should list redemptions for a voucher', async () => {
      // Create and redeem voucher
      const createResponse = await request(app)
        .post('/vouchers')
        .set('Authorization', `Bearer ${merchantToken}`)
        .send(testVoucherData);

      const voucherId = createResponse.body.voucher._id;

      await request(app)
        .post('/vouchers/redeem')
        .set('Authorization', `Bearer ${merchantToken}`)
        .send({
          code: createResponse.body.voucher.code,
          userId: testUserId,
          orderId: new mongoose.Types.ObjectId().toString(),
          orderValue: 500,
          merchantId: testMerchantId,
        });

      const response = await request(app)
        .get(`/vouchers/${voucherId}/redemptions`)
        .set('Authorization', `Bearer ${merchantToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.redemptions.length).toBe(1);
      expect(response.body.redemptions[0].voucherCode).toBe(createResponse.body.voucher.code);
    });
  });

  describe('GET /vouchers/user/:userId - Get User Redemptions', () => {
    it('should list all redemptions for a user', async () => {
      // Create multiple vouchers and redeem them
      for (let i = 0; i < 3; i++) {
        const createResponse = await request(app)
          .post('/vouchers')
          .set('Authorization', `Bearer ${merchantToken}`)
          .send(testVoucherData);

        await request(app)
          .post('/vouchers/redeem')
          .set('Authorization', `Bearer ${merchantToken}`)
          .send({
            code: createResponse.body.voucher.code,
            userId: testUserId,
            orderId: new mongoose.Types.ObjectId().toString(),
            orderValue: 500,
            merchantId: testMerchantId,
          });
      }

      const response = await request(app)
        .get(`/vouchers/user/${testUserId}`)
        .set('Authorization', `Bearer ${merchantToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.redemptions.length).toBe(3);
    });
  });

  describe('POST /vouchers/cleanup - Mark Expired Vouchers', () => {
    it('should mark expired vouchers as expired', async () => {
      // Create voucher that's already expired
      const expiredDate = new Date(Date.now() - 24 * 60 * 60 * 1000); // Yesterday
      const validDate = new Date(Date.now() - 48 * 60 * 60 * 1000); // 2 days ago

      await request(app)
        .post('/vouchers')
        .set('Authorization', `Bearer ${merchantToken}`)
        .send({
          ...testVoucherData,
          validFrom: validDate.toISOString(),
          validUntil: expiredDate.toISOString(),
        });

      const response = await request(app)
        .post('/vouchers/cleanup')
        .set('Authorization', `Bearer ${merchantToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(parseInt(response.body.message.match(/\d+/)[0])).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Fixed Amount Voucher Calculations', () => {
    it('should cap fixed discount at order value', async () => {
      const createResponse = await request(app)
        .post('/vouchers')
        .set('Authorization', `Bearer ${merchantToken}`)
        .send({
          ...testVoucherData,
          type: 'fixed',
          value: 500,
        });

      const response = await request(app)
        .post('/vouchers/validate')
        .set('Authorization', `Bearer ${merchantToken}`)
        .send({
          code: createResponse.body.voucher.code,
          orderValue: 300, // Less than voucher value
          userId: testUserId,
        });

      expect(response.body.discount).toBe(300); // Capped at order value
    });
  });
});
