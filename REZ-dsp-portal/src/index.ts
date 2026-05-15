/**
 * REZ DSP Portal - Entry Point
 * Self-serve advertising platform
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import { DSPPortalService } from './services/DSPPortalService';

const app = express();
const PORT = parseInt(process.env.PORT || '4064', 10);

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { success: false, error: 'Too many requests, please try again later' },
});
app.use('/api/', limiter);

// Initialize service
const dspService = new DSPPortalService();

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'healthy', service: 'rez-dsp-portal' });
});

// Register advertiser
app.post('/api/advertisers', async (req, res) => {
  try {
    const advertiser = await dspService.registerAdvertiser(req.body);
    res.json({ success: true, data: advertiser });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(400).json({ success: false, error: message });
  }
});

// Create campaign
app.post('/api/campaigns', async (req, res) => {
  try {
    const { advertiserId, ...campaignData } = req.body;
    const campaign = await dspService.createCampaign(advertiserId, campaignData);
    res.json({ success: true, data: campaign });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(400).json({ success: false, error: message });
  }
});

// Add creative
app.post('/api/campaigns/:id/creatives', async (req, res) => {
  try {
    const { id } = req.params;
    const creative = await dspService.addCreative(id, req.body);
    res.json({ success: true, data: creative });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(400).json({ success: false, error: message });
  }
});

// Launch campaign
app.post('/api/campaigns/:id/launch', async (req, res) => {
  try {
    const { id } = req.params;
    await dspService.launchCampaign(id);
    res.json({ success: true, message: 'Campaign launched' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(400).json({ success: false, error: message });
  }
});

// Pause campaign
app.post('/api/campaigns/:id/pause', async (req, res) => {
  try {
    const { id } = req.params;
    await dspService.pauseCampaign(id);
    res.json({ success: true, message: 'Campaign paused' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(400).json({ success: false, error: message });
  }
});

// Get campaign metrics
app.get('/api/campaigns/:id/metrics', async (req, res) => {
  try {
    const { id } = req.params;
    const metrics = await dspService.getCampaignMetrics(id);
    res.json({ success: true, data: metrics });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(400).json({ success: false, error: message });
  }
});

// Generate report
app.get('/api/campaigns/:id/report', async (req, res) => {
  try {
    const { id } = req.params;
    const { startDate, endDate } = req.query;
    const report = await dspService.generateReport(
      id,
      new Date(startDate as string),
      new Date(endDate as string)
    );
    res.json({ success: true, data: report });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(400).json({ success: false, error: message });
  }
});

// Estimate reach
app.post('/api/reach/estimate', async (req, res) => {
  try {
    const { targeting, budget } = req.body;
    const estimate = await dspService.estimateReach(targeting, budget);
    res.json({ success: true, data: estimate });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(400).json({ success: false, error: message });
  }
});

// Add funds
app.post('/api/advertisers/:id/funds', async (req, res) => {
  try {
    const { id } = req.params;
    const { amount } = req.body;
    const result = await dspService.addFunds(id, amount);
    res.json({ success: true, data: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(400).json({ success: false, error: message });
  }
});

// Get billing summary
app.get('/api/advertisers/:id/billing', async (req, res) => {
  try {
    const { id } = req.params;
    const summary = await dspService.getBillingSummary(id);
    res.json({ success: true, data: summary });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(400).json({ success: false, error: message });
  }
});

// ============================================================================
// DOOH INTELLIGENCE ENDPOINTS
// ============================================================================

// Get screen types with pricing
app.get('/api/dooh/screen-types', async (_req, res) => {
  try {
    const screenTypes = await dspService.getScreenTypes();
    res.json({ success: true, data: screenTypes });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to get screen types' });
  }
});

// Get demo pricing (all screen types)
app.get('/api/dooh/pricing/demo', async (_req, res) => {
  try {
    const pricing = await dspService.getDemoPricing();
    res.json({ success: true, data: pricing });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to get pricing' });
  }
});

// Get dynamic pricing for a screen
app.post('/api/dooh/pricing/calculate', async (req, res) => {
  try {
    const { screenType, city, tier, scheduledTime } = req.body;
    const pricing = await dspService.getDOOHPricing({
      screenType,
      city,
      tier,
      scheduledTime,
    });
    if (!pricing) {
      res.status(404).json({ success: false, error: 'Pricing not available' });
      return;
    }
    res.json({ success: true, data: pricing });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to calculate pricing' });
  }
});

// Calculate campaign estimate
app.post('/api/dooh/estimate', async (req, res) => {
  try {
    const { screenTypes, cities, budget, objective } = req.body;
    const estimate = await dspService.calculateCampaignEstimate({
      screenTypes,
      cities,
      budget,
      objective,
    });
    if (!estimate) {
      res.status(404).json({ success: false, error: 'Cannot calculate estimate' });
      return;
    }
    res.json({ success: true, data: estimate });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to calculate estimate' });
  }
});

// Error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Error:', err);
  res.status(500).json({ success: false, error: 'Internal server error' });
});

// Start server
app.listen(PORT, () => {
  console.log(`[${new Date().toISOString()}] DSP Portal service running on port ${PORT}`);
});

export default app;
