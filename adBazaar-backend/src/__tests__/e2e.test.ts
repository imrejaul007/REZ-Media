/**
 * AdBazaar Backend E2E Tests
 */

const BASE_URL = process.env.API_URL || 'http://localhost:4085';

describe('AdBazaar E2E Flow', () => {
  describe('Full Campaign Flow', () => {
    it('should complete owner → screen → campaign → payment flow', async () => {
      // 1. Register owner
      const ownerRes = await fetch(`${BASE_URL}/api/owners/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: `user-${Date.now()}`,
          businessName: 'Test Hotel Chain',
        }),
      });
      expect(ownerRes.status).toBe(201);
      const owner = await ownerRes.json();
      expect(owner.success).toBe(true);
      const ownerId = owner.data.ownerId;

      // 2. Add screen
      const screenRes = await fetch(`${BASE_URL}/api/owners/${ownerId}/screens`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Hotel Lobby TV',
          screenType: 'hotel_tv',
          address: {
            street: '123 Main St',
            city: 'Mumbai',
            state: 'Maharashtra',
            country: 'India',
            pincode: '400001',
          },
          coordinates: { lat: 19.076, lng: 72.8777 },
          dimensions: { width: 55, height: 32, unit: 'inches' as const },
          floorPrice: { cpm: 200, currency: 'INR', minCampaignBudget: 10000 },
          availability: {
            timezone: 'Asia/Kolkata',
            slots: [],
          },
        }),
      });
      expect(screenRes.status).toBe(201);
      const screen = await screenRes.json();
      const screenId = screen.data.screenId;

      // 3. Register advertiser
      const advRes = await fetch(`${BASE_URL}/api/advertisers/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: `user-adv-${Date.now()}`,
          companyName: 'Brand XYZ',
          industry: 'food',
        }),
      });
      expect(advRes.status).toBe(201);
      const advertiser = await advRes.json();
      const advertiserId = advertiser.data.advertiserId;

      // 4. Create campaign
      const campaignRes = await fetch(`${BASE_URL}/api/campaigns`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          advertiserId,
          name: 'Summer Sale',
          budget: { total: 50000 },
          objective: 'conversions',
          targeting: {
            screenTypes: ['hotel_tv'],
            locations: ['Mumbai'],
          },
          schedule: { startDate: new Date() },
        }),
      });
      expect(campaignRes.status).toBe(201);
      const campaign = await campaignRes.json();
      expect(campaign.success).toBe(true);

      // 5. Get pricing quote
      const quoteRes = await fetch(`${BASE_URL}/api/marketplace/quote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          campaignId: campaign.data.campaignId,
          screenId,
        }),
      });
      expect(quoteRes.status).toBe(200);
      const quote = await quoteRes.json();
      expect(quote.success).toBe(true);
      expect(quote.data.dynamicCPM).toBeGreaterThan(0);
    });
  });

  describe('Marketplace Flow', () => {
    it('should search and filter screens', async () => {
      const res = await fetch(`${BASE_URL}/api/marketplace/screens?screenTypes=hotel_tv,cab_screen`);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(Array.isArray(data.data.listings)).toBe(true);
    });

    it('should get screen types', async () => {
      const res = await fetch(`${BASE_URL}/api/reference/screen-types`);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.length).toBeGreaterThan(0);
    });
  });

  describe('Health Check', () => {
    it('should return healthy status', async () => {
      const res = await fetch(`${BASE_URL}/health`);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.status).toBe('healthy');
      expect(data.service).toBe('adbazaar-backend');
    });
  });
});
