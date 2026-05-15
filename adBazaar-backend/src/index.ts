/**
 * AdBazaar Backend - Entry Point
 * Screen marketplace connecting owners with advertisers
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import {
  screenOwnerService,
  advertiserService,
} from './services/screenOwnerService';
import {
  advertiserService as advService,
} from './services/advertiserService';

const app = express();
const PORT = parseInt(process.env.PORT || '4085', 10);

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  message: { error: 'Too many requests' },
});
app.use('/api/', limiter);

// Health check
app.get('/health', (_req, res) => {
  res.json({
    status: 'healthy',
    service: 'adbazaar-backend',
    timestamp: new Date().toISOString(),
  });
});

// ============================================================================
// SCREEN OWNER ROUTES
// ============================================================================

/**
 * POST /api/owners/register
 * Register a new screen owner
 */
app.post('/api/owners/register', (req, res) => {
  try {
    const owner = screenOwnerService.registerOwner(req.body);
    res.status(201).json({ success: true, data: owner });
  } catch (error) {
    res.status(400).json({ success: false, error: 'Registration failed' });
  }
});

/**
 * GET /api/owners/:id
 * Get owner details
 */
app.get('/api/owners/:id', (req, res) => {
  const owner = screenOwnerService.getOwner(req.params.id);
  if (!owner) {
    res.status(404).json({ success: false, error: 'Owner not found' });
    return;
  }
  res.json({ success: true, data: owner });
});

/**
 * POST /api/owners/:id/screens
 * Add a new screen listing
 */
app.post('/api/owners/:id/screens', (req, res) => {
  try {
    const screen = screenOwnerService.addScreen(req.params.id, req.body);
    if (!screen) {
      res.status(404).json({ success: false, error: 'Owner not found' });
      return;
    }
    res.status(201).json({ success: true, data: screen });
  } catch (error) {
    res.status(400).json({ success: false, error: 'Failed to add screen' });
  }
});

/**
 * GET /api/owners/:id/screens
 * Get owner's screens
 */
app.get('/api/owners/:id/screens', (req, res) => {
  const screens = screenOwnerService.getOwnerScreens(req.params.id);
  res.json({ success: true, data: screens });
});

/**
 * PATCH /api/owners/:id/screens/:screenId
 * Update screen details
 */
app.patch('/api/owners/:id/screens/:screenId', (req, res) => {
  const screen = screenOwnerService.updateScreen(req.params.id, req.params.screenId, req.body);
  if (!screen) {
    res.status(404).json({ success: false, error: 'Screen not found' });
    return;
  }
  res.json({ success: true, data: screen });
});

/**
 * PATCH /api/owners/:id/screens/:screenId/status
 * Update screen status
 */
app.patch('/api/owners/:id/screens/:screenId/status', (req, res) => {
  const { status } = req.body;
  const screen = screenOwnerService.updateScreenStatus(req.params.id, req.params.screenId, status);
  if (!screen) {
    res.status(404).json({ success: false, error: 'Screen not found' });
    return;
  }
  res.json({ success: true, data: screen });
});

/**
 * PATCH /api/owners/:id/screens/:screenId/price
 * Update screen floor price
 */
app.patch('/api/owners/:id/screens/:screenId/price', (req, res) => {
  const screen = screenOwnerService.updateScreenPrice(req.params.id, req.params.screenId, req.body);
  if (!screen) {
    res.status(404).json({ success: false, error: 'Screen not found' });
    return;
  }
  res.json({ success: true, data: screen });
});

// ============================================================================
// ADVERTISER ROUTES
// ============================================================================

/**
 * POST /api/advertisers/register
 * Register a new advertiser
 */
app.post('/api/advertisers/register', (req, res) => {
  try {
    const advertiser = advertiserService.registerAdvertiser(req.body);
    res.status(201).json({ success: true, data: advertiser });
  } catch (error) {
    res.status(400).json({ success: false, error: 'Registration failed' });
  }
});

/**
 * GET /api/advertisers/:id
 * Get advertiser details
 */
app.get('/api/advertisers/:id', (req, res) => {
  const advertiser = advertiserService.getAdvertiser(req.params.id);
  if (!advertiser) {
    res.status(404).json({ success: false, error: 'Advertiser not found' });
    return;
  }
  res.json({ success: true, data: advertiser });
});

// ============================================================================
// CAMPAIGN ROUTES
// ============================================================================

/**
 * POST /api/campaigns
 * Create a new campaign
 */
app.post('/api/campaigns', (req, res) => {
  try {
    const { advertiserId, ...campaignData } = req.body;
    const campaign = advertiserService.createCampaign(advertiserId, campaignData);
    if (!campaign) {
      res.status(404).json({ success: false, error: 'Advertiser not found' });
      return;
    }
    res.status(201).json({ success: true, data: campaign });
  } catch (error) {
    res.status(400).json({ success: false, error: 'Failed to create campaign' });
  }
});

/**
 * GET /api/campaigns/:id
 * Get campaign details
 */
app.get('/api/campaigns/:id', (req, res) => {
  const campaign = advertiserService.getCampaign(req.params.id);
  if (!campaign) {
    res.status(404).json({ success: false, error: 'Campaign not found' });
    return;
  }
  res.json({ success: true, data: campaign });
});

/**
 * GET /api/advertisers/:id/campaigns
 * Get advertiser's campaigns
 */
app.get('/api/advertisers/:id/campaigns', (req, res) => {
  const campaigns = advertiserService.getAdvertiserCampaigns(req.params.id);
  res.json({ success: true, data: campaigns });
});

/**
 * PATCH /api/campaigns/:id/status
 * Update campaign status
 */
app.patch('/api/campaigns/:id/status', (req, res) => {
  const { status } = req.body;
  const campaign = advertiserService.updateCampaignStatus(req.params.id, status);
  if (!campaign) {
    res.status(404).json({ success: false, error: 'Campaign not found' });
    return;
  }
  res.json({ success: true, data: campaign });
});

/**
 * POST /api/campaigns/:id/creatives
 * Add creative to campaign
 */
app.post('/api/campaigns/:id/creatives', (req, res) => {
  const campaign = advertiserService.addCreative(req.params.id, req.body);
  if (!campaign) {
    res.status(404).json({ success: false, error: 'Campaign not found' });
    return;
  }
  res.status(201).json({ success: true, data: campaign });
});

// ============================================================================
// MARKETPLACE ROUTES
// ============================================================================

/**
 * GET /api/marketplace/screens
 * Search available screens
 */
app.get('/api/marketplace/screens', async (req, res) => {
  try {
    const search = {
      filters: {
        screenTypes: req.query.screenTypes
          ? req.query.screenTypes.toString().split(',')
          : undefined,
        cities: req.query.cities
          ? req.query.cities.toString().split(',')
          : undefined,
        captivityLevels: req.query.captivityLevels
          ? req.query.captivityLevels.toString().split(',')
          : undefined,
      },
      sort: (req.query.sort as any) || 'popularity',
      pagination: {
        page: parseInt(req.query.page as string) || 1,
        limit: parseInt(req.query.limit as string) || 20,
      },
    };

    const result = await advertiserService.searchMarketplace(search);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Search failed' });
  }
});

/**
 * GET /api/marketplace/screens/:id
 * Get screen details
 */
app.get('/api/marketplace/screens/:id', (req, res) => {
  const screen = screenOwnerService.getScreen(req.params.id);
  if (!screen) {
    res.status(404).json({ success: false, error: 'Screen not found' });
    return;
  }
  res.json({ success: true, data: screen });
});

/**
 * POST /api/marketplace/quote
 * Get pricing quote for screen
 */
app.post('/api/marketplace/quote', async (req, res) => {
  try {
    const { campaignId, screenId } = req.body;
    const quote = await advertiserService.getPricingQuote(campaignId, screenId);
    if (!quote) {
      res.status(404).json({ success: false, error: 'Campaign or screen not found' });
      return;
    }
    res.json({ success: true, data: quote });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to get quote' });
  }
});

// ============================================================================
// ANALYTICS ROUTES
// ============================================================================

/**
 * GET /api/owners/:id/analytics
 * Get owner analytics
 */
app.get('/api/owners/:id/analytics', (req, res) => {
  const owner = screenOwnerService.getOwner(req.params.id);
  if (!owner) {
    res.status(404).json({ success: false, error: 'Owner not found' });
    return;
  }

  const analytics = {
    ownerId: owner.ownerId,
    revenue: {
      total: owner.stats.totalEarnings,
      pending: owner.stats.pendingPayout,
    },
    screens: {
      total: owner.stats.totalScreens,
      active: owner.stats.activeScreens,
    },
    impressions: {
      total: owner.stats.totalImpressions,
      fillRate: owner.stats.avgFillRate,
    },
  };

  res.json({ success: true, data: analytics });
});

/**
 * GET /api/campaigns/:id/analytics
 * Get campaign analytics
 */
app.get('/api/campaigns/:id/analytics', (req, res) => {
  const campaign = advertiserService.getCampaign(req.params.id);
  if (!campaign) {
    res.status(404).json({ success: false, error: 'Campaign not found' });
    return;
  }
  res.json({ success: true, data: campaign.stats });
});

// ============================================================================
// SCREEN TYPES REFERENCE
// ============================================================================

/**
 * GET /api/reference/screen-types
 * Get all screen types with pricing info
 */
app.get('/api/reference/screen-types', (_req, res) => {
  const screenTypes = [
    { type: 'hotel_tv', captivity: 'captive_private', description: 'Hotel Smart TV', baseCPM: 200 },
    { type: 'cab_screen', captivity: 'captive_private', description: 'Cab/Taxi Screen', baseCPM: 150 },
    { type: 'flight_seat', captivity: 'captive_private', description: 'Flight Seat', baseCPM: 200 },
    { type: 'bus_seat', captivity: 'captive_private', description: 'Bus Seat', baseCPM: 100 },
    { type: 'mall_kiosk', captivity: 'semi_captive', description: 'Mall Kiosk', baseCPM: 80 },
    { type: 'office_lobby', captivity: 'semi_captive', description: 'Office Lobby', baseCPM: 100 },
    { type: 'gym_screen', captivity: 'semi_captive', description: 'Gym Screen', baseCPM: 70 },
    { type: 'cinema_screen', captivity: 'semi_captive', description: 'Cinema', baseCPM: 90 },
    { type: 'billboard_led', captivity: 'public', description: 'Billboard LED', baseCPM: 40 },
    { type: 'bus_shelter', captivity: 'public', description: 'Bus Shelter', baseCPM: 20 },
  ];

  res.json({ success: true, data: screenTypes });
});

// Error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Error:', err);
  res.status(500).json({ success: false, error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`[${new Date().toISOString()}] AdBazaar Backend running on port ${PORT}`);
});

export default app;
