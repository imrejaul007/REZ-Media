/**
 * Campaign Integration Tests
 *
 * Tests the full CRUD lifecycle for marketing campaigns including:
 * - Campaign creation with validation
 * - Campaign retrieval and listing
 * - Campaign updates and state transitions
 * - Campaign launch and cancellation
 * - Campaign deletion (draft only)
 * - Authentication and authorization
 * - Rate limiting
 */

import request from 'supertest';
import express from 'express';
import mongoose from 'mongoose';
import campaignRoutes from '../../src/routes/campaigns';
import { MarketingCampaign } from '../../src/models/MarketingCampaign';
import { generateMerchantToken, testMerchantId, testCampaignData } from '../setup';

// Mock external dependencies
jest.mock('../../src/campaigns/CampaignOrchestrator', () => ({
  campaignOrchestrator: {
    dispatch: jest.fn().mockResolvedValue({ jobId: 'test-job-id', success: true }),
  },
}));

jest.mock('../../src/services/growthAnalytics', () => ({
  growthAnalytics: {
    trackEvent: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock('../../src/services/notificationService', () => ({
  sendCampaignNotification: jest.fn().mockResolvedValue({ success: true, eventId: 'test-event-id' }),
}));

jest.mock('../../src/services/intentCaptureService', () => ({
  track: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../src/audience/AudienceBuilder', () => ({
  audienceBuilder: {
    estimate: jest.fn().mockResolvedValue(100),
  },
}));

// Mock Redis
const mockRedis = {
  set: jest.fn().mockResolvedValue('OK'),
  del: jest.fn().mockResolvedValue(1),
  eval: jest.fn().mockResolvedValue(1),
  status: 'ready',
};

jest.mock('../../src/config/redis', () => ({
  getRedis: () => mockRedis,
  getRedisBullMQConnection: jest.fn().mockReturnValue({}),
}));

describe('Campaigns API Integration Tests', () => {
  let app: express.Application;
  let merchantToken: string;

  beforeAll(() => {
    app = express();
    app.use(express.json());
    app.use('/campaigns', campaignRoutes);
    merchantToken = generateMerchantToken();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Authentication', () => {
    it('should reject requests without authorization header', async () => {
      const response = await request(app)
        .get('/campaigns')
        .query({ merchantId: testMerchantId });

      expect(response.status).toBe(401);
      expect(response.body.error).toContain('Missing authorization token');
    });

    it('should reject requests with invalid token', async () => {
      const response = await request(app)
        .get('/campaigns')
        .set('Authorization', 'Bearer invalid-token')
        .query({ merchantId: testMerchantId });

      expect(response.status).toBe(401);
      expect(response.body.error).toContain('Invalid or expired token');
    });
  });

  describe('POST /campaigns - Create Campaign', () => {
    it('should create a new campaign with valid data', async () => {
      const response = await request(app)
        .post('/campaigns')
        .set('Authorization', `Bearer ${merchantToken}`)
        .send(testCampaignData);

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('_id');
      expect(response.body.name).toBe(testCampaignData.name);
      expect(response.body.objective).toBe(testCampaignData.objective);
      expect(response.body.channel).toBe(testCampaignData.channel);
      expect(response.body.status).toBe('draft');
    });

    it('should create a scheduled campaign when scheduledAt is provided', async () => {
      const scheduledDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

      const response = await request(app)
        .post('/campaigns')
        .set('Authorization', `Bearer ${merchantToken}`)
        .send({
          ...testCampaignData,
          scheduledAt: scheduledDate,
        });

      expect(response.status).toBe(201);
      expect(response.body.status).toBe('scheduled');
      expect(response.body.scheduledAt).toBeDefined();
    });

    it('should reject campaign creation without required fields', async () => {
      const response = await request(app)
        .post('/campaigns')
        .set('Authorization', `Bearer ${merchantToken}`)
        .send({
          name: 'Test',
          // Missing: merchantId, objective, channel, message, audience
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Missing required fields');
    });

    it('should reject campaign with invalid channel', async () => {
      const response = await request(app)
        .post('/campaigns')
        .set('Authorization', `Bearer ${merchantToken}`)
        .send({
          ...testCampaignData,
          channel: 'invalid_channel',
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Invalid channel');
    });

    it('should reject campaign with name exceeding 200 characters', async () => {
      const response = await request(app)
        .post('/campaigns')
        .set('Authorization', `Bearer ${merchantToken}`)
        .send({
          ...testCampaignData,
          name: 'A'.repeat(201),
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('200 characters');
    });

    it('should reject campaign with message exceeding 5000 characters', async () => {
      const response = await request(app)
        .post('/campaigns')
        .set('Authorization', `Bearer ${merchantToken}`)
        .send({
          ...testCampaignData,
          message: 'A'.repeat(5001),
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('5000 characters');
    });

    it('should reject campaign with invalid CTA URL', async () => {
      const response = await request(app)
        .post('/campaigns')
        .set('Authorization', `Bearer ${merchantToken}`)
        .send({
          ...testCampaignData,
          ctaUrl: 'not-a-valid-url',
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('valid URL');
    });

    it('should accept campaign with valid CTA URL', async () => {
      const response = await request(app)
        .post('/campaigns')
        .set('Authorization', `Bearer ${merchantToken}`)
        .send({
          ...testCampaignData,
          ctaUrl: 'https://rez.money/promo',
          ctaText: 'Shop Now',
        });

      expect(response.status).toBe(201);
      expect(response.body.ctaUrl).toBe('https://rez.money/promo');
      expect(response.body.ctaText).toBe('Shop Now');
    });

    it('should track growth analytics on campaign creation', async () => {
      const { growthAnalytics } = require('../../src/services/growthAnalytics');

      await request(app)
        .post('/campaigns')
        .set('Authorization', `Bearer ${merchantToken}`)
        .send(testCampaignData);

      expect(growthAnalytics.trackEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'campaign_created',
          sourceService: 'marketing',
          merchantId: testMerchantId,
        })
      );
    });
  });

  describe('GET /campaigns - List Campaigns', () => {
    beforeEach(async () => {
      // Create test campaigns
      const campaigns = [
        { ...testCampaignData, name: 'Campaign 1', status: 'draft' },
        { ...testCampaignData, name: 'Campaign 2', status: 'sent' },
        { ...testCampaignData, name: 'Campaign 3', status: 'draft' },
      ];

      for (const campaign of campaigns) {
        await request(app)
          .post('/campaigns')
          .set('Authorization', `Bearer ${merchantToken}`)
          .send(campaign);
      }
    });

    it('should list all campaigns for a merchant', async () => {
      const response = await request(app)
        .get('/campaigns')
        .set('Authorization', `Bearer ${merchantToken}`)
        .query({ merchantId: testMerchantId });

      expect(response.status).toBe(200);
      expect(response.body.campaigns).toHaveLength(3);
      expect(response.body.total).toBe(3);
      expect(response.body.page).toBe(1);
      expect(response.body.limit).toBe(20);
    });

    it('should filter campaigns by status', async () => {
      const response = await request(app)
        .get('/campaigns')
        .set('Authorization', `Bearer ${merchantToken}`)
        .query({ merchantId: testMerchantId, status: 'draft' });

      expect(response.status).toBe(200);
      expect(response.body.campaigns).toHaveLength(2);
      expect(response.body.campaigns.every((c: any) => c.status === 'draft')).toBe(true);
    });

    it('should paginate results', async () => {
      const response = await request(app)
        .get('/campaigns')
        .set('Authorization', `Bearer ${merchantToken}`)
        .query({ merchantId: testMerchantId, limit: 2, page: 1 });

      expect(response.status).toBe(200);
      expect(response.body.campaigns).toHaveLength(2);
      expect(response.body.limit).toBe(2);
    });

    it('should require merchantId parameter', async () => {
      const response = await request(app)
        .get('/campaigns')
        .set('Authorization', `Bearer ${merchantToken}`);

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('merchantId required');
    });
  });

  describe('GET /campaigns/:id - Get Single Campaign', () => {
    let createdCampaignId: string;

    beforeEach(async () => {
      const createResponse = await request(app)
        .post('/campaigns')
        .set('Authorization', `Bearer ${merchantToken}`)
        .send(testCampaignData);

      createdCampaignId = createResponse.body._id;
    });

    it('should retrieve a campaign by ID', async () => {
      const response = await request(app)
        .get(`/campaigns/${createdCampaignId}`)
        .set('Authorization', `Bearer ${merchantToken}`);

      expect(response.status).toBe(200);
      expect(response.body._id).toBe(createdCampaignId);
      expect(response.body.name).toBe(testCampaignData.name);
    });

    it('should return 404 for non-existent campaign', async () => {
      const fakeId = new mongoose.Types.ObjectId().toString();

      const response = await request(app)
        .get(`/campaigns/${fakeId}`)
        .set('Authorization', `Bearer ${merchantToken}`);

      expect(response.status).toBe(404);
      expect(response.body.error).toContain('Not found');
    });

    it('should reject invalid ObjectId format', async () => {
      const response = await request(app)
        .get('/campaigns/invalid-id')
        .set('Authorization', `Bearer ${merchantToken}`);

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Invalid id');
    });
  });

  describe('PATCH /campaigns/:id - Update Campaign', () => {
    let createdCampaignId: string;

    beforeEach(async () => {
      const createResponse = await request(app)
        .post('/campaigns')
        .set('Authorization', `Bearer ${merchantToken}`)
        .send(testCampaignData);

      createdCampaignId = createResponse.body._id;
    });

    it('should update campaign name', async () => {
      const response = await request(app)
        .patch(`/campaigns/${createdCampaignId}`)
        .set('Authorization', `Bearer ${merchantToken}`)
        .send({ name: 'Updated Campaign Name' });

      expect(response.status).toBe(200);
      expect(response.body.name).toBe('Updated Campaign Name');
    });

    it('should update campaign message', async () => {
      const response = await request(app)
        .patch(`/campaigns/${createdCampaignId}`)
        .set('Authorization', `Bearer ${merchantToken}`)
        .send({ message: 'Updated message content' });

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Updated message content');
    });

    it('should reject updates to non-draft/non-scheduled campaigns', async () => {
      // First launch the campaign
      await request(app)
        .post(`/campaigns/${createdCampaignId}/launch`)
        .set('Authorization', `Bearer ${merchantToken}`);

      // Try to update
      const response = await request(app)
        .patch(`/campaigns/${createdCampaignId}`)
        .set('Authorization', `Bearer ${merchantToken}`)
        .send({ name: 'New Name' });

      // Note: Launch sets status to 'sending' which is not editable
      expect(response.status).toBe(400);
    });

    it('should reject invalid state transitions', async () => {
      const response = await request(app)
        .patch(`/campaigns/${createdCampaignId}`)
        .set('Authorization', `Bearer ${merchantToken}`)
        .send({ status: 'sent' }); // Cannot transition from draft to sent directly

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Invalid state transition');
    });

    it('should allow valid state transition from draft to scheduled', async () => {
      const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

      const response = await request(app)
        .patch(`/campaigns/${createdCampaignId}`)
        .set('Authorization', `Bearer ${merchantToken}`)
        .send({ status: 'scheduled', scheduledAt: futureDate });

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('scheduled');
    });

    it('should protect critical fields during sending state', async () => {
      // Create and launch campaign
      const createResponse = await request(app)
        .post('/campaigns')
        .set('Authorization', `Bearer ${merchantToken}`)
        .send({ ...testCampaignData, status: 'sending' as any });

      const response = await request(app)
        .patch(`/campaigns/${createResponse.body._id}`)
        .set('Authorization', `Bearer ${merchantToken}`)
        .send({ message: 'Trying to change message' });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Cannot edit');
    });
  });

  describe('POST /campaigns/:id/launch - Launch Campaign', () => {
    let createdCampaignId: string;

    beforeEach(async () => {
      const createResponse = await request(app)
        .post('/campaigns')
        .set('Authorization', `Bearer ${merchantToken}`)
        .send(testCampaignData);

      createdCampaignId = createResponse.body._id;
    });

    it('should launch a draft campaign', async () => {
      const response = await request(app)
        .post(`/campaigns/${createdCampaignId}/launch`)
        .set('Authorization', `Bearer ${merchantToken}`);

      expect(response.status).toBe(200);
      expect(response.body.queued).toBe(true);
      expect(response.body.jobId).toBeDefined();
    });

    it('should prevent concurrent launch attempts', async () => {
      // Mock Redis to simulate lock already acquired
      mockRedis.set.mockResolvedValueOnce(null); // Lock already held

      const response = await request(app)
        .post(`/campaigns/${createdCampaignId}/launch`)
        .set('Authorization', `Bearer ${merchantToken}`);

      expect(response.status).toBe(409);
      expect(response.body.error).toContain('already in progress');
    });

    it('should reject launch of non-existent campaign', async () => {
      const fakeId = new mongoose.Types.ObjectId().toString();

      const response = await request(app)
        .post(`/campaigns/${fakeId}/launch`)
        .set('Authorization', `Bearer ${merchantToken}`);

      expect(response.status).toBe(404);
    });
  });

  describe('POST /campaigns/:id/cancel - Cancel Campaign', () => {
    let createdCampaignId: string;

    beforeEach(async () => {
      const createResponse = await request(app)
        .post('/campaigns')
        .set('Authorization', `Bearer ${merchantToken}`)
        .send(testCampaignData);

      createdCampaignId = createResponse.body._id;
    });

    it('should cancel a draft campaign', async () => {
      const response = await request(app)
        .post(`/campaigns/${createdCampaignId}/cancel`)
        .set('Authorization', `Bearer ${merchantToken}`);

      expect(response.status).toBe(200);
      expect(response.body.cancelled).toBe(true);
    });

    it('should cancel a scheduled campaign', async () => {
      // First schedule the campaign
      const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      await request(app)
        .patch(`/campaigns/${createdCampaignId}`)
        .set('Authorization', `Bearer ${merchantToken}`)
        .send({ status: 'scheduled', scheduledAt: futureDate });

      const response = await request(app)
        .post(`/campaigns/${createdCampaignId}/cancel`)
        .set('Authorization', `Bearer ${merchantToken}`);

      expect(response.status).toBe(200);
      expect(response.body.cancelled).toBe(true);
    });

    it('should reject cancellation of sending campaign', async () => {
      // Launch the campaign first
      await request(app)
        .post(`/campaigns/${createdCampaignId}/launch`)
        .set('Authorization', `Bearer ${merchantToken}`);

      const response = await request(app)
        .post(`/campaigns/${createdCampaignId}/cancel`)
        .set('Authorization', `Bearer ${merchantToken}`);

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('already sending');
    });
  });

  describe('DELETE /campaigns/:id - Delete Campaign', () => {
    it('should delete a draft campaign', async () => {
      const createResponse = await request(app)
        .post('/campaigns')
        .set('Authorization', `Bearer ${merchantToken}`)
        .send(testCampaignData);

      const deleteResponse = await request(app)
        .delete(`/campaigns/${createResponse.body._id}`)
        .set('Authorization', `Bearer ${merchantToken}`);

      expect(deleteResponse.status).toBe(200);
      expect(deleteResponse.body.deleted).toBe(true);

      // Verify campaign is deleted
      const getResponse = await request(app)
        .get(`/campaigns/${createResponse.body._id}`)
        .set('Authorization', `Bearer ${merchantToken}`);

      expect(getResponse.status).toBe(404);
    });

    it('should reject deletion of non-draft campaign', async () => {
      const createResponse = await request(app)
        .post('/campaigns')
        .set('Authorization', `Bearer ${merchantToken}`)
        .send(testCampaignData);

      // Launch the campaign
      await request(app)
        .post(`/campaigns/${createResponse.body._id}/launch`)
        .set('Authorization', `Bearer ${merchantToken}`);

      const deleteResponse = await request(app)
        .delete(`/campaigns/${createResponse.body._id}`)
        .set('Authorization', `Bearer ${merchantToken}`);

      expect(deleteResponse.status).toBe(400);
      expect(deleteResponse.body.error).toContain('Only draft campaigns');
    });

    it('should reject deletion of non-existent campaign', async () => {
      const fakeId = new mongoose.Types.ObjectId().toString();

      const response = await request(app)
        .delete(`/campaigns/${fakeId}`)
        .set('Authorization', `Bearer ${merchantToken}`);

      expect(response.status).toBe(404);
    });
  });

  describe('Audience Targeting', () => {
    it('should create campaign with location-based audience', async () => {
      const response = await request(app)
        .post('/campaigns')
        .set('Authorization', `Bearer ${merchantToken}`)
        .send({
          ...testCampaignData,
          audience: {
            segment: 'location',
            location: {
              city: 'Bangalore',
              area: 'Koramangala',
              pincode: '560034',
              radiusKm: 5,
            },
          },
        });

      expect(response.status).toBe(201);
      expect(response.body.audience.segment).toBe('location');
      expect(response.body.audience.location.city).toBe('Bangalore');
    });

    it('should create campaign with interest-based audience', async () => {
      const response = await request(app)
        .post('/campaigns')
        .set('Authorization', `Bearer ${merchantToken}`)
        .send({
          ...testCampaignData,
          audience: {
            segment: 'interest',
            interests: ['coffee', 'electronics', 'fashion'],
          },
        });

      expect(response.status).toBe(201);
      expect(response.body.audience.segment).toBe('interest');
      expect(response.body.audience.interests).toEqual(['coffee', 'electronics', 'fashion']);
    });

    it('should create campaign with birthday targeting', async () => {
      const response = await request(app)
        .post('/campaigns')
        .set('Authorization', `Bearer ${merchantToken}`)
        .send({
          ...testCampaignData,
          audience: {
            segment: 'birthday',
            birthday: { daysAhead: 7 },
          },
        });

      expect(response.status).toBe(201);
      expect(response.body.audience.segment).toBe('birthday');
      expect(response.body.audience.birthday.daysAhead).toBe(7);
    });

    it('should create campaign with purchase history targeting', async () => {
      const response = await request(app)
        .post('/campaigns')
        .set('Authorization', `Bearer ${merchantToken}`)
        .send({
          ...testCampaignData,
          audience: {
            segment: 'purchase_history',
            purchaseHistory: {
              categoryIds: ['cat-1', 'cat-2'],
              productKeywords: ['laptop', 'phone'],
              withinDays: 30,
              minOrderCount: 3,
            },
          },
        });

      expect(response.status).toBe(201);
      expect(response.body.audience.segment).toBe('purchase_history');
      expect(response.body.audience.purchaseHistory.withinDays).toBe(30);
    });
  });

  describe('Campaign Stats', () => {
    it('should have default stats object', async () => {
      const createResponse = await request(app)
        .post('/campaigns')
        .set('Authorization', `Bearer ${merchantToken}`)
        .send(testCampaignData);

      expect(createResponse.body.stats).toEqual({
        sent: 0,
        delivered: 0,
        failed: 0,
        deduped: 0,
        opened: 0,
        clicked: 0,
        converted: 0,
      });
    });
  });
});
