/**
 * REZ Media Analytics
 * Performance analytics for all media services
 */

import express, { Request, Response } from 'express';

const app = express();
const PORT = parseInt(process.env.PORT || '4069', 10);

app.use(express.json());

// ============================================
// TYPES
// ============================================

interface AdImpression {
  campaignId: string;
  userId: string;
  placement: string;
  timestamp: Date;
}

interface AdClick {
  campaignId: string;
  userId: string;
  impressionId: string;
  timestamp: Date;
}

interface Campaign {
  id: string;
  name: string;
  company: string;
  budget: number;
  spent: number;
  impressions: number;
  clicks: number;
  conversions: number;
  startDate: Date;
  endDate: Date;
}

interface DOOHPlacement {
  id: string;
  location: string;
  type: 'retail' | 'restaurant' | 'elevator' | 'taxi';
  impressions: number;
  revenue: number;
}

// In-memory stores
const impressions: AdImpression[] = [];
const clicks: AdClick[] = [];
const campaigns = new Map<string, Campaign>();
const doohPlacements = new Map<string, DOOHPlacement>();

// ============================================
// ENDPOINTS
// ============================================

// Health
app.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    service: 'media-analytics',
    timestamp: new Date().toISOString(),
  });
});

// Track impression
app.post('/api/track/impression', (req: Request, res: Response) => {
  const { campaignId, userId, placement } = req.body;

  const impression: AdImpression = {
    campaignId,
    userId,
    placement,
    timestamp: new Date(),
  };

  impressions.push(impression);

  // Update campaign
  const campaign = campaigns.get(campaignId);
  if (campaign) {
    campaign.impressions++;
  }

  res.json({ success: true, impression });
});

// Track click
app.post('/api/track/click', (req: Request, res: Response) => {
  const { campaignId, userId, impressionId } = req.body;

  const click: AdClick = {
    campaignId,
    userId,
    impressionId,
    timestamp: new Date(),
  };

  clicks.push(click);

  // Update campaign
  const campaign = campaigns.get(campaignId);
  if (campaign) {
    campaign.clicks++;
  }

  res.json({ success: true, click });
});

// Track conversion
app.post('/api/track/conversion', (req: Request, res: Response) => {
  const { campaignId, userId } = req.body;

  const campaign = campaigns.get(campaignId);
  if (campaign) {
    campaign.conversions++;
    campaign.spent += campaign.budget / campaign.conversions;
  }

  res.json({ success: true });
});

// Create campaign
app.post('/api/campaigns', (req: Request, res: Response) => {
  const { name, company, budget, startDate, endDate } = req.body;

  const campaign: Campaign = {
    id: `camp_${Date.now()}`,
    name,
    company: company || 'REZ',
    budget: budget || 10000,
    spent: 0,
    impressions: 0,
    clicks: 0,
    conversions: 0,
    startDate: new Date(startDate),
    endDate: new Date(endDate),
  };

  campaigns.set(campaign.id, campaign);

  res.status(201).json({ campaign });
});

// Get campaign analytics
app.get('/api/campaigns/:id/analytics', (req: Request, res: Response) => {
  const campaign = campaigns.get(req.params.id);

  if (!campaign) {
    return res.status(404).json({ error: 'Campaign not found' });
  }

  const ctr = campaign.impressions > 0
    ? (campaign.clicks / campaign.impressions * 100).toFixed(2)
    : '0.00';

  const cvr = campaign.clicks > 0
    ? (campaign.conversions / campaign.clicks * 100).toFixed(2)
    : '0.00';

  const cpm = campaign.impressions > 0
    ? (campaign.spent / campaign.impressions * 1000).toFixed(2)
    : '0.00';

  res.json({
    campaign,
    metrics: {
      ctr: `${ctr}%`,
      cvr: `${cvr}%`,
      cpm: `₹${cpm}`,
      costPerConversion: campaign.conversions > 0
        ? `₹${(campaign.spent / campaign.conversions).toFixed(2)}`
        : 'N/A',
    },
  });
});

// Get all campaigns
app.get('/api/campaigns', (req: Request, res: Response) => {
  const { company } = req.query;

  let allCampaigns = Array.from(campaigns.values());

  if (company) {
    allCampaigns = allCampaigns.filter(c => c.company === company);
  }

  res.json({ campaigns: allCampaigns });
});

// DOOH placement management
app.post('/api/dooh/placements', (req: Request, res: Response) => {
  const { location, type } = req.body;

  const placement: DOOHPlacement = {
    id: `dooh_${Date.now()}`,
    location,
    type,
    impressions: 0,
    revenue: 0,
  };

  doohPlacements.set(placement.id, placement);

  res.status(201).json({ placement });
});

// DOOH analytics
app.get('/api/dooh/analytics', (req: Request, res: Response) => {
  const { type } = req.query;

  let allPlacements = Array.from(doohPlacements.values());

  if (type) {
    allPlacements = allPlacements.filter(p => p.type === type);
  }

  const totalImpressions = allPlacements.reduce((sum, p) => sum + p.impressions, 0);
  const totalRevenue = allPlacements.reduce((sum, p) => sum + p.revenue, 0);

  res.json({
    placements: allPlacements,
    summary: {
      totalPlacements: allPlacements.length,
      totalImpressions,
      totalRevenue,
      avgRevenuePerPlacement: allPlacements.length > 0
        ? (totalRevenue / allPlacements.length).toFixed(2)
        : '0.00',
    },
    byType: {
      retail: allPlacements.filter(p => p.type === 'retail').length,
      restaurant: allPlacements.filter(p => p.type === 'restaurant').length,
      elevator: allPlacements.filter(p => p.type === 'elevator').length,
      taxi: allPlacements.filter(p => p.type === 'taxi').length,
    },
  });
});

// Revenue report
app.get('/api/reports/revenue', (req: Request, res: Response) => {
  const allCampaigns = Array.from(campaigns.values());
  const allDOOH = Array.from(doohPlacements.values());

  const adRevenue = allCampaigns.reduce((sum, c) => sum + c.spent, 0);
  const doohRevenue = allDOOH.reduce((sum, p) => sum + p.revenue, 0);

  res.json({
    revenue: {
      ads: adRevenue,
      dooh: doohRevenue,
      total: adRevenue + doohRevenue,
    },
    byCompany: allCampaigns.reduce((acc, c) => {
      acc[c.company] = (acc[c.company] || 0) + c.spent;
      return acc;
    }, {} as Record<string, number>),
    timestamp: new Date().toISOString(),
  });
});

// Attribution report
app.get('/api/reports/attribution', (req: Request, res: Response) => {
  const allCampaigns = Array.from(campaigns.values());

  res.json({
    attribution: {
      firstTouch: allCampaigns.map(c => ({
        campaign: c.name,
        conversions: c.conversions,
        weight: c.conversions > 0 ? 1 / c.conversions : 0,
      })),
      lastTouch: allCampaigns.map(c => ({
        campaign: c.name,
        conversions: c.conversions,
      })),
      linear: allCampaigns.map(c => ({
        campaign: c.name,
        conversions: c.conversions,
        weight: 1 / allCampaigns.length,
      })),
    },
  });
});

// ============================================
// START SERVER
// ============================================

app.listen(PORT, () => {
  console.log(`REZ Media Analytics running on port ${PORT}`);
  console.log('  Features: Campaign analytics, DOOH tracking, Attribution');
});

export { app };
