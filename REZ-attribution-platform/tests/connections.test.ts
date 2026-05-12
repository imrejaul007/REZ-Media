/**
 * REZ Attribution Platform - Connection Tests
 */

import axios from 'axios';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

const INTELLIGENCE_API = process.env.INTELLIGENCE_API || 'https://rez-intelligence.onrender.com';
const ANALYTICS_API = process.env.ANALYTICS_API || 'https://rez-analytics.onrender.com';
const MERCHANT_API = process.env.MERCHANT_API || 'https://rez-merchant.onrender.com';

describe('REZ-Attribution Connection Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Intelligence Connections', () => {
    test('POST /api/attribution/track - track attribution event', async () => {
      mockedAxios.post.mockResolvedValueOnce({ data: { success: true } });

      const data = {
        event_type: 'attribution.conversion',
        user_id: 'user123',
        campaign_id: 'camp123',
        touchpoints: [
          { type: 'ad_view', timestamp: new Date() },
          { type: 'store_visit', timestamp: new Date() },
          { type: 'purchase', timestamp: new Date() }
        ]
      };

      await axios.post(`${INTELLIGENCE_API}/api/attribution/track`, data);

      expect(mockedAxios.post).toHaveBeenCalledWith(
        `${INTELLIGENCE_API}/api/attribution/track`,
        data
      );
    });

    test('POST /api/intent/track - track intent', async () => {
      mockedAxios.post.mockResolvedValueOnce({ data: { success: true } });

      const data = {
        user_id: 'user123',
        intent_type: 'attribution_touchpoint',
        entities: { campaign_id: 'camp123' },
        action: 'view'
      };

      await axios.post(`${INTELLIGENCE_API}/api/intent/track`, data);

      expect(mockedAxios.post).toHaveBeenCalled();
    });
  });

  describe('Analytics Connections', () => {
    test('POST /api/events - send event to analytics', async () => {
      mockedAxios.post.mockResolvedValueOnce({ data: { success: true } });

      const data = {
        event_type: 'conversion',
        amount: 1000,
        user_id: 'user123'
      };

      await axios.post(`${ANALYTICS_API}/api/events`, data);

      expect(mockedAxios.post).toHaveBeenCalledWith(
        `${ANALYTICS_API}/api/events`,
        data
      );
    });
  });

  describe('Merchant Connections', () => {
    test('GET /api/merchants/:id - get merchant data', async () => {
      mockedAxios.get.mockResolvedValueOnce({
        data: {
          merchant_id: 'merchant123',
          name: 'Test Merchant',
          campaigns: []
        }
      });

      await axios.get(`${MERCHANT_API}/api/merchants/merchant123`);

      expect(mockedAxios.get).toHaveBeenCalledWith(
        `${MERCHANT_API}/api/merchants/merchant123`
      );
    });

    test('POST /api/merchants/:id/campaigns - create campaign', async () => {
      mockedAxios.post.mockResolvedValueOnce({ data: { campaign_id: 'new123' } });

      const data = {
        name: 'Test Campaign',
        budget: 10000,
        start_date: new Date()
      };

      await axios.post(`${MERCHANT_API}/api/merchants/merchant123/campaigns`, data);

      expect(mockedAxios.post).toHaveBeenCalled();
    });
  });
});
