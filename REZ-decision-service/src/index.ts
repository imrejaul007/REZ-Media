import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { targetingEngine } from './services/targeting';
import { actionEngine } from './services/action';
import samplingRoutes from './routes/sampling';
import samplingAnalyticsRoutes from './routes/samplingAnalytics';
import merchantCoinAnalyticsRoutes from './routes/merchantCoinAnalytics';
import doohAnalyticsRoutes from './routes/doohAnalytics';
import { attributionTracker, AttributionModel } from './engines/sampling/attribution';
import supremeControllerRoutes from './routes/supremeController';
import realtimeTriggerRoutes from './routes/realtimeTriggers';
import auctionRoutes from './routes/auctionEngine';

const app = express();
const PORT = process.env.PORT || 4027;

app.use(helmet());
app.use(cors());
app.use(express.json());

// ============================================
// SUPREME CONTROLLER (MUST BE CALLED BY ALL CHANNELS)
// ============================================
app.use('/api/rde', supremeControllerRoutes);

// ============================================
// REAL-TIME TRIGGERS (Event-driven)
// ============================================
app.use('/api/triggers', realtimeTriggerRoutes);

// ============================================
// AUCTION ENGINE (Competition Layer)
// ============================================
app.use('/api/auction', auctionRoutes);

// ============================================
// TARGETING ROUTES
// ============================================

app.get('/api/targeting/segments/:userId', async (req, res) => {
  try {
    const segments = await targetingEngine.evaluate(req.params.userId);
    res.json({ success: true, data: segments });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to evaluate segments' });
  }
});

app.post('/api/targeting/evaluate', async (req, res) => {
  try {
    const { userId, campaignId } = req.body;
    const segments = await targetingEngine.evaluate(userId);
    const variant = targetingEngine.assignVariant(userId, campaignId);
    res.json({ success: true, segments, variant });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to evaluate' });
  }
});

// ============================================
// FREQUENCY ROUTES
// ============================================

app.get('/api/frequency/:userId/:campaignId/:channel', async (req, res) => {
  try {
    const { userId, campaignId, channel } = req.params;
    const allowed = await targetingEngine.checkFrequencyCap(userId, campaignId, channel);
    res.json({ success: true, allowed });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to check frequency' });
  }
});

app.post('/api/frequency/record', async (req, res) => {
  try {
    const { userId, campaignId, channel } = req.body;
    await targetingEngine.recordImpression(userId, campaignId, channel);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to record' });
  }
});

// ============================================
// ACTION ROUTES
// ============================================

app.post('/api/actions/execute', async (req, res) => {
  try {
    const { type, payload, userId, level } = req.body;
    const result = await actionEngine.execute({
      id: `action-${Date.now()}`,
      type,
      payload,
      userId,
      level
    });
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to execute' });
  }
});

app.get('/api/actions/pending', async (req, res) => {
  try {
    const actions = await actionEngine.getPending();
    res.json({ success: true, data: actions });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to get pending' });
  }
});

app.post('/api/actions/:id/approve', async (req, res) => {
  try {
    const result = await actionEngine.approve(req.params.id);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to approve' });
  }
});

app.post('/api/actions/:id/reject', async (req, res) => {
  try {
    const { reason } = req.body;
    await actionEngine.reject(req.params.id, reason);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to reject' });
  }
});

// ============================================
// SAMPLING ROUTES (NEW)
// ============================================

app.use('/api/sampling', samplingRoutes);

// ============================================
// SAMPLING ANALYTICS ROUTES (Phase 3)
// ============================================

app.use('/api/sampling/analytics', samplingAnalyticsRoutes);

// ============================================
// MERCHANT COIN ANALYTICS ROUTES (Phase 4)
// ============================================

app.use('/api/merchant', merchantCoinAnalyticsRoutes);

// ============================================
// DOOH ANALYTICS ROUTES (Phase 5)
// ============================================

app.use('/api/dooh/analytics', doohAnalyticsRoutes);

// ============================================
// ATTRIBUTION ROUTES (Phase 3)
// ============================================

/**
 * Track an attribution event
 * POST /api/attribution/track
 */
app.post('/api/attribution/track', async (req, res) => {
  try {
    const { userId, campaignId, merchantId, event, value, metadata } = req.body;

    if (!userId || !campaignId || !merchantId || !event) {
      return res.status(400).json({
        success: false,
        error: 'userId, campaignId, merchantId, and event are required'
      });
    }

    const result = await attributionTracker.trackEvent({
      userId,
      campaignId,
      merchantId,
      event,
      timestamp: new Date(),
      value,
      metadata
    });

    res.json({
      success: result.success,
      eventId: result.eventId,
      error: result.error
    });
  } catch (error) {
    console.error('[ATTRIBUTION] Track error:', error);
    res.status(500).json({ success: false, error: 'Failed to track event' });
  }
});

/**
 * Get attribution summary for a user
 * GET /api/attribution/summary/:userId
 */
app.get('/api/attribution/summary/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const windowDays = parseInt(req.query.window as string) || 7;

    const summary = await attributionTracker.getAttributionSummary(userId, windowDays);

    res.json({
      success: true,
      data: summary
    });
  } catch (error) {
    console.error('[ATTRIBUTION] Summary error:', error);
    res.status(500).json({ success: false, error: 'Failed to get summary' });
  }
});

/**
 * Calculate attribution for a conversion
 * POST /api/attribution/attribute
 */
app.post('/api/attribution/attribute', async (req, res) => {
  try {
    const { userId, campaignId, conversionValue, model } = req.body;

    if (!userId || !campaignId || conversionValue === undefined) {
      return res.status(400).json({
        success: false,
        error: 'userId, campaignId, and conversionValue are required'
      });
    }

    const attributionModel: AttributionModel = model || 'last-touch';
    const results = await attributionTracker.calculateAttribution(
      userId,
      campaignId,
      conversionValue,
      'purchase',
      attributionModel
    );

    res.json({
      success: true,
      data: results
    });
  } catch (error) {
    console.error('[ATTRIBUTION] Attribute error:', error);
    res.status(500).json({ success: false, error: 'Failed to calculate attribution' });
  }
});

/**
 * Record a conversion (track + attribute)
 * POST /api/attribution/conversion
 */
app.post('/api/attribution/conversion', async (req, res) => {
  try {
    const { userId, campaignId, merchantId, conversionType, value, model } = req.body;

    if (!userId || !campaignId || !merchantId || !conversionType || value === undefined) {
      return res.status(400).json({
        success: false,
        error: 'userId, campaignId, merchantId, conversionType, and value are required'
      });
    }

    const attributionModel: AttributionModel = model || 'last-touch';
    const results = await attributionTracker.recordConversion(
      userId,
      campaignId,
      merchantId,
      conversionType,
      value,
      attributionModel
    );

    res.json({
      success: true,
      data: results
    });
  } catch (error) {
    console.error('[ATTRIBUTION] Conversion error:', error);
    res.status(500).json({ success: false, error: 'Failed to record conversion' });
  }
});

/**
 * Get campaign attribution stats
 * GET /api/attribution/campaign/:campaignId
 */
app.get('/api/attribution/campaign/:campaignId', async (req, res) => {
  try {
    const { campaignId } = req.params;

    const stats = await attributionTracker.getCampaignAttribution(campaignId);

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('[ATTRIBUTION] Campaign stats error:', error);
    res.status(500).json({ success: false, error: 'Failed to get campaign stats' });
  }
});

/**
 * Quick attribution event tracking
 * POST /api/attribution/event/:eventType
 */
app.post('/api/attribution/event/:eventType', async (req, res) => {
  try {
    const { eventType } = req.params;
    const { userId, campaignId, merchantId, value, metadata } = req.body;

    const validEvents = ['scan', 'visit', 'redeem', 'purchase', 'repeat'];
    if (!validEvents.includes(eventType)) {
      return res.status(400).json({
        success: false,
        error: `Invalid event type. Must be one of: ${validEvents.join(', ')}`
      });
    }

    if (!userId || !campaignId || !merchantId) {
      return res.status(400).json({
        success: false,
        error: 'userId, campaignId, and merchantId are required'
      });
    }

    const { trackScan, trackVisit, trackRedeem, trackPurchase, trackRepeat } = await import('./engines/sampling/attribution');

    let result;
    switch (eventType) {
      case 'scan':
        result = await trackScan(userId, campaignId, merchantId, metadata);
        break;
      case 'visit':
        result = await trackVisit(userId, campaignId, merchantId, metadata);
        break;
      case 'redeem':
        result = await trackRedeem(userId, campaignId, merchantId, value, metadata);
        break;
      case 'purchase':
        result = await trackPurchase(userId, campaignId, merchantId, value, metadata);
        break;
      case 'repeat':
        result = await trackRepeat(userId, campaignId, merchantId, metadata);
        break;
    }

    res.json({
      success: result.success,
      eventId: result.eventId,
      error: result.error
    });
  } catch (error) {
    console.error('[ATTRIBUTION] Event tracking error:', error);
    res.status(500).json({ success: false, error: 'Failed to track event' });
  }
});

// ============================================
// HEALTH
// ============================================

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'decision-service' });
});

app.listen(PORT, () => {
  console.log(`Decision service running on port ${PORT}`);
});

export default app;
