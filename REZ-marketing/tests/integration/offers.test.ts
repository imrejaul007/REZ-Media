/**
 * Offer Redemption Integration Tests
 *
 * Tests the complete offer lifecycle including:
 * - Rendez offer creation (couple, group, context)
 * - Offer listing with filters
 * - Contextual offer discovery
 * - Offer booking flow
 * - Offer redemption
 * - Offer sharing
 * - Dynamic offer generation
 */

import request from 'supertest';
import express from 'express';
import mongoose from 'mongoose';
import rendezRoutes from '../../src/routes/rendez';
import { generateMerchantToken, generateUserToken, testMerchantId, testUserId } from '../setup';

// Mock external dependencies
jest.mock('../../src/services/growthAnalytics', () => ({
  growthAnalytics: {
    trackEvent: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock('../../src/services/notificationService', () => ({
  sendRendezNotification: jest.fn().mockResolvedValue({ success: true, eventId: 'test-event-id' }),
  sendCampaignNotification: jest.fn().mockResolvedValue({ success: true }),
}));

jest.mock('../../src/services/intentCaptureService', () => ({
  track: jest.fn().mockResolvedValue(undefined),
}));

// Mock Redis
const mockRedis = {
  set: jest.fn().mockResolvedValue('OK'),
  del: jest.fn().mockResolvedValue(1),
  get: jest.fn().mockResolvedValue(null),
  eval: jest.fn().mockResolvedValue(1),
  status: 'ready',
};

jest.mock('../../src/config/redis', () => ({
  getRedis: () => mockRedis,
  getRedisBullMQConnection: jest.fn().mockReturnValue({}),
}));

describe('Offers (Rendez) API Integration Tests', () => {
  let app: express.Application;
  let merchantToken: string;
  let userToken: string;

  beforeAll(() => {
    app = express();
    app.use(express.json());
    app.use('/rendez', rendezRoutes);
    merchantToken = generateMerchantToken();
    userToken = generateUserToken();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Test Data Factories
  // ─────────────────────────────────────────────────────────────────────────────

  const createCoupleOffer = (overrides = {}) => ({
    merchantId: testMerchantId,
    name: 'Romantic Date Night',
    category: 'couple' as const,
    type: 'percentage' as const,
    title: '50% Off for Couples',
    description: 'Enjoy a romantic dinner with 50% discount',
    benefits: {
      discount: {
        type: 'percentage' as const,
        value: 50,
        maxDiscount: 1000,
      },
    },
    originalPrice: 2000,
    offerPrice: 1000,
    validFrom: new Date().toISOString(),
    validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    minPartySize: 2,
    maxPartySize: 2,
    tags: ['romantic', 'dinner'],
    ...overrides,
  });

  const createGroupOffer = (overrides = {}) => ({
    merchantId: testMerchantId,
    name: 'Friends Special',
    category: 'group' as const,
    type: 'bundle' as const,
    title: 'Buy 3 Get 1 Free',
    description: 'Perfect for friend groups - buy 3 mains, get 1 free!',
    benefits: {
      bundle: {
        items: ['main_course', 'main_course', 'main_course', 'main_course'],
        packagePrice: 1200,
      },
    },
    minPartySize: 3,
    maxPartySize: 8,
    validFrom: new Date().toISOString(),
    validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    tags: ['friends', 'group', 'savings'],
    ...overrides,
  });

  const createContextOffer = (overrides = {}) => ({
    merchantId: testMerchantId,
    name: 'Weekend Brunch',
    category: 'context' as const,
    type: 'experience' as const,
    title: 'Priority Brunch Access',
    description: 'Skip the queue with priority brunch booking',
    benefits: {
      experience: {
        type: 'priority_booking' as const,
        description: 'Skip the queue and get priority seating',
      },
    },
    validFrom: new Date().toISOString(),
    validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    contextTrigger: {
      dayOfWeek: ['saturday', 'sunday'],
      timeOfDay: ['morning', 'afternoon'],
    },
    tags: ['brunch', 'weekend', 'priority'],
    ...overrides,
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Offer CRUD Tests
  // ─────────────────────────────────────────────────────────────────────────────

  describe('POST /rendez/offers - Create Offer', () => {
    it('should create a couple offer', async () => {
      const response = await request(app)
        .post('/rendez/offers')
        .set('Authorization', `Bearer ${merchantToken}`)
        .send(createCoupleOffer());

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.offer).toHaveProperty('_id');
      expect(response.body.offer.category).toBe('couple');
      expect(response.body.offer.title).toBe('50% Off for Couples');
    });

    it('should create a group offer', async () => {
      const response = await request(app)
        .post('/rendez/offers')
        .set('Authorization', `Bearer ${merchantToken}`)
        .send(createGroupOffer());

      expect(response.status).toBe(201);
      expect(response.body.offer.category).toBe('group');
      expect(response.body.offer.benefits.bundle).toBeDefined();
    });

    it('should create a context offer with time triggers', async () => {
      const response = await request(app)
        .post('/rendez/offers')
        .set('Authorization', `Bearer ${merchantToken}`)
        .send(createContextOffer());

      expect(response.status).toBe(201);
      expect(response.body.offer.category).toBe('context');
      expect(response.body.offer.contextTrigger.dayOfWeek).toContain('saturday');
    });

    it('should create offer with booking slots', async () => {
      const response = await request(app)
        .post('/rendez/offers')
        .set('Authorization', `Bearer ${merchantToken}`)
        .send({
          ...createCoupleOffer(),
          bookingSlots: [
            { day: 'monday', startTime: '18:00', endTime: '22:00', capacity: 10 },
            { day: 'tuesday', startTime: '18:00', endTime: '22:00', capacity: 10 },
          ],
        });

      expect(response.status).toBe(201);
      expect(response.body.offer.bookingSlots).toHaveLength(2);
    });

    it('should reject offer without required fields', async () => {
      const response = await request(app)
        .post('/rendez/offers')
        .set('Authorization', `Bearer ${merchantToken}`)
        .send({
          merchantId: testMerchantId,
          // Missing required fields
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Validation failed');
    });

    it('should reject offer with invalid category', async () => {
      const response = await request(app)
        .post('/rendez/offers')
        .set('Authorization', `Bearer ${merchantToken}`)
        .send({
          ...createCoupleOffer(),
          category: 'invalid_category',
        });

      expect(response.status).toBe(400);
    });

    it('should send notification when sendNotification is true', async () => {
      const { sendRendezNotification } = require('../../src/services/notificationService');

      await request(app)
        .post('/rendez/offers')
        .set('Authorization', `Bearer ${merchantToken}`)
        .send({
          ...createCoupleOffer(),
          sendNotification: true,
          recipientEmail: 'user@example.com',
          recipientPhone: '+919876543210',
        });

      expect(sendRendezNotification).toHaveBeenCalled();
    });
  });

  describe('GET /rendez/offers - List Offers', () => {
    beforeEach(async () => {
      // Create test offers
      const offers = [
        createCoupleOffer(),
        createGroupOffer(),
        createContextOffer(),
      ];

      for (const offer of offers) {
        await request(app)
          .post('/rendez/offers')
          .set('Authorization', `Bearer ${merchantToken}`)
          .send(offer);
      }
    });

    it('should list all offers', async () => {
      const response = await request(app)
        .get('/rendez/offers')
        .set('Authorization', `Bearer ${merchantToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.offers.length).toBeGreaterThanOrEqual(3);
    });

    it('should filter offers by category', async () => {
      const response = await request(app)
        .get('/rendez/offers')
        .set('Authorization', `Bearer ${merchantToken}`)
        .query({ category: 'couple' });

      expect(response.status).toBe(200);
      expect(response.body.offers.every((o: any) => o.category === 'couple')).toBe(true);
    });

    it('should filter offers by type', async () => {
      const response = await request(app)
        .get('/rendez/offers')
        .set('Authorization', `Bearer ${merchantToken}`)
        .query({ type: 'percentage' });

      expect(response.status).toBe(200);
      expect(response.body.offers.every((o: any) => o.type === 'percentage')).toBe(true);
    });

    it('should filter offers by merchantId', async () => {
      const response = await request(app)
        .get('/rendez/offers')
        .set('Authorization', `Bearer ${merchantToken}`)
        .query({ merchantId: testMerchantId });

      expect(response.status).toBe(200);
      expect(response.body.offers.every((o: any) => o.merchantId === testMerchantId)).toBe(true);
    });

    it('should filter offers by tags', async () => {
      const response = await request(app)
        .get('/rendez/offers')
        .set('Authorization', `Bearer ${merchantToken}`)
        .query({ tags: 'romantic' });

      expect(response.status).toBe(200);
      expect(response.body.offers.every((o: any) => o.tags?.includes('romantic'))).toBe(true);
    });

    it('should paginate results', async () => {
      const response = await request(app)
        .get('/rendez/offers')
        .set('Authorization', `Bearer ${merchantToken}`)
        .query({ page: 1, limit: 2 });

      expect(response.status).toBe(200);
      expect(response.body.offers.length).toBeLessThanOrEqual(2);
      expect(response.body.pagination.limit).toBe(2);
    });
  });

  describe('GET /rendez/offers/:id - Get Offer', () => {
    let createdOfferId: string;

    beforeEach(async () => {
      const response = await request(app)
        .post('/rendez/offers')
        .set('Authorization', `Bearer ${merchantToken}`)
        .send(createCoupleOffer());

      createdOfferId = response.body.offer._id;
    });

    it('should retrieve an offer by ID', async () => {
      const response = await request(app)
        .get(`/rendez/offers/${createdOfferId}`)
        .set('Authorization', `Bearer ${merchantToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.offer._id).toBe(createdOfferId);
    });

    it('should return 404 for non-existent offer', async () => {
      const fakeId = new mongoose.Types.ObjectId().toString();

      const response = await request(app)
        .get(`/rendez/offers/${fakeId}`)
        .set('Authorization', `Bearer ${merchantToken}`);

      expect(response.status).toBe(404);
    });

    it('should reject invalid ObjectId format', async () => {
      const response = await request(app)
        .get('/rendez/offers/invalid-id')
        .set('Authorization', `Bearer ${merchantToken}`);

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Invalid offer ID');
    });
  });

  describe('PATCH /rendez/offers/:id - Update Offer', () => {
    let createdOfferId: string;

    beforeEach(async () => {
      const response = await request(app)
        .post('/rendez/offers')
        .set('Authorization', `Bearer ${merchantToken}`)
        .send(createCoupleOffer());

      createdOfferId = response.body.offer._id;
    });

    it('should update offer title', async () => {
      const response = await request(app)
        .patch(`/rendez/offers/${createdOfferId}`)
        .set('Authorization', `Bearer ${merchantToken}`)
        .send({ title: 'Updated Title' });

      expect(response.status).toBe(200);
      expect(response.body.offer.title).toBe('Updated Title');
    });

    it('should update offer price', async () => {
      const response = await request(app)
        .patch(`/rendez/offers/${createdOfferId}`)
        .set('Authorization', `Bearer ${merchantToken}`)
        .send({ offerPrice: 1500 });

      expect(response.status).toBe(200);
      expect(response.body.offer.offerPrice).toBe(1500);
    });

    it('should update offer status', async () => {
      const response = await request(app)
        .patch(`/rendez/offers/${createdOfferId}`)
        .set('Authorization', `Bearer ${merchantToken}`)
        .send({ status: 'paused' });

      expect(response.status).toBe(200);
      expect(response.body.offer.status).toBe('paused');
    });

    it('should return 404 for non-existent offer', async () => {
      const fakeId = new mongoose.Types.ObjectId().toString();

      const response = await request(app)
        .patch(`/rendez/offers/${fakeId}`)
        .set('Authorization', `Bearer ${merchantToken}`)
        .send({ title: 'New Title' });

      expect(response.status).toBe(404);
    });
  });

  describe('DELETE /rendez/offers/:id - Delete Offer', () => {
    it('should delete an offer', async () => {
      const createResponse = await request(app)
        .post('/rendez/offers')
        .set('Authorization', `Bearer ${merchantToken}`)
        .send(createCoupleOffer());

      const offerId = createResponse.body.offer._id;

      const response = await request(app)
        .delete(`/rendez/offers/${offerId}`)
        .set('Authorization', `Bearer ${merchantToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      // Verify offer is deleted
      const getResponse = await request(app)
        .get(`/rendez/offers/${offerId}`)
        .set('Authorization', `Bearer ${merchantToken}`);

      expect(getResponse.status).toBe(404);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Contextual Offer Discovery Tests
  // ─────────────────────────────────────────────────────────────────────────────

  describe('GET /rendez/contextual - Contextual Discovery', () => {
    beforeEach(async () => {
      // Create offers with different context triggers
      await request(app)
        .post('/rendez/offers')
        .set('Authorization', `Bearer ${merchantToken}`)
        .send({
          ...createContextOffer(),
          name: 'Weekend Brunch Special',
          contextTrigger: {
            dayOfWeek: ['saturday', 'sunday'],
            timeOfDay: ['morning', 'afternoon'],
          },
        });

      await request(app)
        .post('/rendez/offers')
        .set('Authorization', `Bearer ${merchantToken}`)
        .send({
          ...createCoupleOffer(),
          name: 'Valentine Special',
          contextTrigger: {
            occasion: [{ type: 'valentines' }],
          },
        });

      await request(app)
        .post('/rendez/offers')
        .set('Authorization', `Bearer ${merchantToken}`)
        .send({
          ...createGroupOffer(),
          name: 'Friday Night Friends',
          contextTrigger: {
            dayOfWeek: ['friday', 'saturday'],
            timeOfDay: ['evening'],
          },
        });
    });

    it('should find contextual offers based on day and time', async () => {
      const response = await request(app)
        .get('/rendez/contextual')
        .set('Authorization', `Bearer ${merchantToken}`)
        .query({
          dayOfWeek: 'saturday',
          timeOfDay: 'afternoon',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.offers.length).toBeGreaterThan(0);
      expect(response.body.context.dayOfWeek).toBe('saturday');
    });

    it('should filter by occasion', async () => {
      const response = await request(app)
        .get('/rendez/contextual')
        .set('Authorization', `Bearer ${merchantToken}`)
        .query({
          occasion: 'valentines',
        });

      expect(response.status).toBe(200);
      // Should potentially include Valentine's offer
    });

    it('should filter by party size', async () => {
      const response = await request(app)
        .get('/rendez/contextual')
        .set('Authorization', `Bearer ${merchantToken}`)
        .query({
          partySize: 4,
        });

      expect(response.status).toBe(200);
      // Should find group offers suitable for 4 people
    });

    it('should combine multiple context filters', async () => {
      const response = await request(app)
        .get('/rendez/contextual')
        .set('Authorization', `Bearer ${merchantToken}`)
        .query({
          dayOfWeek: 'friday',
          timeOfDay: 'evening',
          partySize: 4,
        });

      expect(response.status).toBe(200);
    });
  });

  describe('GET /rendez/couple - Couple Offers', () => {
    beforeEach(async () => {
      await request(app)
        .post('/rendez/offers')
        .set('Authorization', `Bearer ${merchantToken}`)
        .send(createCoupleOffer());

      await request(app)
        .post('/rendez/offers')
        .set('Authorization', `Bearer ${merchantToken}`)
        .send(createGroupOffer()); // Should not appear in couple offers
    });

    it('should list couple-specific offers', async () => {
      const response = await request(app)
        .get('/rendez/couple')
        .set('Authorization', `Bearer ${merchantToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.category).toBe('couple');
      expect(response.body.offers.every((o: any) => o.category === 'couple')).toBe(true);
    });
  });

  describe('GET /rendez/group - Group Offers', () => {
    beforeEach(async () => {
      await request(app)
        .post('/rendez/offers')
        .set('Authorization', `Bearer ${merchantToken}`)
        .send(createGroupOffer());
    });

    it('should list group offers with correct party size', async () => {
      const response = await request(app)
        .get('/rendez/group')
        .set('Authorization', `Bearer ${merchantToken}`)
        .query({ partySize: 4 });

      expect(response.status).toBe(200);
      expect(response.body.category).toBe('group');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Booking Flow Tests
  // ─────────────────────────────────────────────────────────────────────────────

  describe('POST /rendez/book - Book Offer', () => {
    let createdOfferId: string;

    beforeEach(async () => {
      const response = await request(app)
        .post('/rendez/offers')
        .set('Authorization', `Bearer ${merchantToken}`)
        .send({
          ...createCoupleOffer(),
          bookingSlots: [
            { day: 'monday', startTime: '18:00', endTime: '22:00', capacity: 10 },
          ],
        });

      createdOfferId = response.body.offer._id;
    });

    it('should create a booking', async () => {
      const bookingData = {
        offerId: createdOfferId,
        userId: testUserId,
        partySize: 2,
        bookingDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        bookingTime: '19:00',
        customerName: 'John Doe',
        customerPhone: '+919876543210',
        customerEmail: 'john@example.com',
        specialRequests: 'Window seat please',
      };

      const response = await request(app)
        .post('/rendez/book')
        .set('Authorization', `Bearer ${merchantToken}`)
        .send(bookingData);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.bookingId).toBeDefined();
    });

    it('should reject booking with invalid data', async () => {
      const response = await request(app)
        .post('/rendez/book')
        .set('Authorization', `Bearer ${merchantToken}`)
        .send({
          offerId: createdOfferId,
          // Missing required fields
        });

      expect(response.status).toBe(400);
    });

    it('should reject booking for non-existent offer', async () => {
      const fakeId = new mongoose.Types.ObjectId().toString();

      const response = await request(app)
        .post('/rendez/book')
        .set('Authorization', `Bearer ${merchantToken}`)
        .send({
          offerId: fakeId,
          userId: testUserId,
          partySize: 2,
          bookingDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          bookingTime: '19:00',
          customerName: 'John Doe',
          customerPhone: '+919876543210',
        });

      expect(response.status).toBe(400);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Offer Sharing Tests
  // ─────────────────────────────────────────────────────────────────────────────

  describe('POST /rendez/share - Share Offer', () => {
    let createdOfferId: string;

    beforeEach(async () => {
      const response = await request(app)
        .post('/rendez/offers')
        .set('Authorization', `Bearer ${merchantToken}`)
        .send(createCoupleOffer());

      createdOfferId = response.body.offer._id;
    });

    it('should generate share link for WhatsApp', async () => {
      const response = await request(app)
        .post('/rendez/share')
        .set('Authorization', `Bearer ${merchantToken}`)
        .send({
          offerId: createdOfferId,
          userId: testUserId,
          platform: 'whatsapp',
          recipientCount: 3,
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.shareUrl).toBeDefined();
    });

    it('should generate share link for copy_link', async () => {
      const response = await request(app)
        .post('/rendez/share')
        .set('Authorization', `Bearer ${merchantToken}`)
        .send({
          offerId: createdOfferId,
          userId: testUserId,
          platform: 'copy_link',
        });

      expect(response.status).toBe(200);
      expect(response.body.shareUrl).toBeDefined();
    });

    it('should reject invalid platform', async () => {
      const response = await request(app)
        .post('/rendez/share')
        .set('Authorization', `Bearer ${merchantToken}`)
        .send({
          offerId: createdOfferId,
          userId: testUserId,
          platform: 'invalid_platform',
        });

      expect(response.status).toBe(400);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Offer Redemption Tests
  // ─────────────────────────────────────────────────────────────────────────────

  describe('POST /rendez/redeem - Redeem Offer', () => {
    let createdOfferId: string;

    beforeEach(async () => {
      const response = await request(app)
        .post('/rendez/offers')
        .set('Authorization', `Bearer ${merchantToken}`)
        .send(createCoupleOffer());

      createdOfferId = response.body.offer._id;
    });

    it('should redeem an offer', async () => {
      const orderId = new mongoose.Types.ObjectId().toString();

      const response = await request(app)
        .post('/rendez/redeem')
        .set('Authorization', `Bearer ${merchantToken}`)
        .send({
          offerId: createdOfferId,
          orderId,
          revenue: 1000,
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should reject redemption without required fields', async () => {
      const response = await request(app)
        .post('/rendez/redeem')
        .set('Authorization', `Bearer ${merchantToken}`)
        .send({
          offerId: createdOfferId,
          // Missing orderId and revenue
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('offerId, orderId, and revenue are required');
    });

    it('should reject redemption for non-existent offer', async () => {
      const fakeId = new mongoose.Types.ObjectId().toString();

      const response = await request(app)
        .post('/rendez/redeem')
        .set('Authorization', `Bearer ${merchantToken}`)
        .send({
          offerId: fakeId,
          orderId: new mongoose.Types.ObjectId().toString(),
          revenue: 1000,
        });

      expect(response.status).toBe(404);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Dynamic Offer Generation Tests
  // ─────────────────────────────────────────────────────────────────────────────

  describe('GET /rendez/generate - Dynamic Offer Generation', () => {
    it('should generate offers based on context', async () => {
      const response = await request(app)
        .get('/rendez/generate')
        .set('Authorization', `Bearer ${merchantToken}`)
        .query({
          dayOfWeek: 'saturday',
          timeOfDay: 'evening',
          partySize: 4,
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.generated).toBe(true);
    });

    it('should include context in response', async () => {
      const response = await request(app)
        .get('/rendez/generate')
        .set('Authorization', `Bearer ${merchantToken}`)
        .query({
          occasion: 'birthday',
          partySize: 6,
        });

      expect(response.status).toBe(200);
      expect(response.body.context.occasion).toBe('birthday');
      expect(response.body.context.partySize).toBe(6);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Template Tests
  // ─────────────────────────────────────────────────────────────────────────────

  describe('GET /rendez/templates - Get Templates', () => {
    it('should list all templates', async () => {
      const response = await request(app)
        .get('/rendez/templates')
        .set('Authorization', `Bearer ${merchantToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.templates).toBeDefined();
      expect(Array.isArray(response.body.templates)).toBe(true);
    });

    it('should filter templates by category', async () => {
      const response = await request(app)
        .get('/rendez/templates')
        .set('Authorization', `Bearer ${merchantToken}`)
        .query({ category: 'couple' });

      expect(response.status).toBe(200);
      expect(response.body.category).toBe('couple');
    });
  });

  describe('POST /rendez/templates/:name/instantiate - Instantiate Template', () => {
    it('should create offer from template', async () => {
      // First get available templates
      const templatesResponse = await request(app)
        .get('/rendez/templates')
        .set('Authorization', `Bearer ${merchantToken}`);

      if (templatesResponse.body.templates.length > 0) {
        const templateName = templatesResponse.body.templates[0].name.toLowerCase().replace(/\s+/g, '-');

        const response = await request(app)
          .post(`/rendez/templates/${templateName}/instantiate`)
          .set('Authorization', `Bearer ${merchantToken}`)
          .send({
            merchantId: testMerchantId,
            validFrom: new Date().toISOString(),
            validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          });

        expect(response.status).toBe(201);
        expect(response.body.success).toBe(true);
        expect(response.body.offer).toBeDefined();
      }
    });

    it('should require merchantId', async () => {
      const response = await request(app)
        .post('/rendez/templates/some-template/instantiate')
        .set('Authorization', `Bearer ${merchantToken}`)
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('merchantId is required');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Stats and Cleanup Tests
  // ─────────────────────────────────────────────────────────────────────────────

  describe('GET /rendez/stats/:merchantId - Get Offer Stats', () => {
    it('should get stats for merchant', async () => {
      // Create an offer first
      await request(app)
        .post('/rendez/offers')
        .set('Authorization', `Bearer ${merchantToken}`)
        .send(createCoupleOffer());

      const response = await request(app)
        .get(`/rendez/stats/${testMerchantId}`)
        .set('Authorization', `Bearer ${merchantToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.stats).toBeDefined();
    });

    it('should reject invalid merchantId', async () => {
      const response = await request(app)
        .get('/rendez/stats/invalid-id')
        .set('Authorization', `Bearer ${merchantToken}`);

      expect(response.status).toBe(400);
    });
  });

  describe('POST /rendez/cleanup - Mark Expired Offers', () => {
    it('should mark expired offers', async () => {
      const response = await request(app)
        .post('/rendez/cleanup')
        .set('Authorization', `Bearer ${merchantToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('Marked');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Benefit Types Tests
  // ─────────────────────────────────────────────────────────────────────────────

  describe('Different Offer Benefit Types', () => {
    it('should create offer with BOGO benefit', async () => {
      const response = await request(app)
        .post('/rendez/offers')
        .set('Authorization', `Bearer ${merchantToken}`)
        .send({
          ...createGroupOffer(),
          type: 'bogo',
          benefits: {
            bogo: {
              buyQuantity: 2,
              getQuantity: 1,
              getItem: 'dessert',
            },
          },
        });

      expect(response.status).toBe(201);
      expect(response.body.offer.benefits.bogo).toBeDefined();
      expect(response.body.offer.benefits.bogo.buyQuantity).toBe(2);
    });

    it('should create offer with experience benefit', async () => {
      const response = await request(app)
        .post('/rendez/offers')
        .set('Authorization', `Bearer ${merchantToken}`)
        .send({
          ...createContextOffer(),
          benefits: {
            experience: {
              type: 'exclusive_access',
              description: 'VIP lounge access included',
            },
          },
        });

      expect(response.status).toBe(201);
      expect(response.body.offer.benefits.experience.type).toBe('exclusive_access');
    });

    it('should create offer with bundle benefit', async () => {
      const response = await request(app)
        .post('/rendez/offers')
        .set('Authorization', `Bearer ${merchantToken}`)
        .send({
          ...createGroupOffer(),
          benefits: {
            bundle: {
              items: ['starter', 'main', 'dessert', 'drinks'],
              packagePrice: 2500,
            },
          },
        });

      expect(response.status).toBe(201);
      expect(response.body.offer.benefits.bundle.packagePrice).toBe(2500);
    });
  });
});
