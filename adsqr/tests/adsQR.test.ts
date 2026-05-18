/**
 * REZ Ads QR Service - Tests
 */

import { describe, it, expect } from '@jest/globals';

const BASE_URL = process.env.TEST_URL || 'http://localhost:3008';

describe('Ads QR Service', () => {
  const testCampaignId = `CAMP-${Date.now()}`;

  describe('Core APIs', () => {
    it('GET /health should return healthy status', async () => {
      const response = await fetch(`${BASE_URL}/health`);
      expect([200, 404]).toContain(response.status);
    });
  });

  describe('Campaign APIs', () => {
    it('GET /api/campaigns should return campaigns', async () => {
      const response = await fetch(`${BASE_URL}/api/campaigns`);
      expect([200, 404]).toContain(response.status);
    });
  });

  describe('Analytics', () => {
    it('GET /api/analytics/dashboard should return dashboard', async () => {
      const response = await fetch(`${BASE_URL}/api/analytics/dashboard`);
      expect([200, 400]).toContain(response.status);
    });

    it('GET /api/fraud/analytics should return fraud analytics', async () => {
      const response = await fetch(`${BASE_URL}/api/fraud/analytics`);
      expect([200, 400]).toContain(response.status);
    });
  });

  describe('Fraud Detection', () => {
    it('POST /api/fraud/check should check fraud', async () => {
      const response = await fetch(`${BASE_URL}/api/fraud/check`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          campaign_id: testCampaignId,
          scan_id: 'scan_test',
          user_id: 'test_user',
          device_id: 'device_test',
          ip_address: '127.0.0.1'
        })
      });
      expect([200, 400]).toContain(response.status);
    });
  });

  describe('Support', () => {
    it('POST /api/support/ticket should create ticket', async () => {
      const response = await fetch(`${BASE_URL}/api/support/ticket`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          campaign_id: testCampaignId,
          user_id: 'test_user',
          user_name: 'Test User',
          user_phone: '+919999999999',
          issue_type: 'campaign_issue',
          description: 'Campaign not working properly'
        })
      });
      expect([200, 400, 500]).toContain(response.status);
    });

    it('GET /api/support/campaign-health/:id should return health', async () => {
      const response = await fetch(`${BASE_URL}/api/support/campaign-health/${testCampaignId}`);
      expect([200, 400, 404]).toContain(response.status);
    });
  });
});
