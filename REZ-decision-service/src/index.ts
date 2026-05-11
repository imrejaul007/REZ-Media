import express, { Express, Request, Response, NextFunction } from 'express';
import http from 'http';
import cors from 'cors';
import helmet from 'helmet';
import mongoSanitize from 'express-mongo-sanitize';
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
import { verifyInternal } from './middleware/auth';
import { randomUUID } from 'crypto';

const app: Express = express();
const PORT = process.env.PORT || 4027;

// ============================================
// ENVIRONMENT VALIDATION
// ============================================

function validateEnv(): void {
  const required = ['REDIS_URL'];
  const missing = required.filter(key => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(`Missing required env vars: ${missing.join(', ')}`);
  }
  console.log('[CONFIG] Environment validated');
}

validateEnv();

// ============================================
// MIDDLEWARE
// ============================================

app.use(helmet());
app.use(cors({
  origin: (process.env.CORS_ORIGIN || 'https://rez.money').split(',').map(s => s.trim()),
  credentials: true,
}));
app.use(express.json({ limit: '1mb' }));
app.use(mongoSanitize());

// Request logging with request ID
app.use((req: Request, res: Response, next: NextFunction) => {
  const requestId = (req.headers['x-request-id'] as string) || randomUUID();
  res.setHeader('X-Request-ID', requestId);
  console.log(`[${requestId}] ${req.method} ${req.path}`, {
    ip: req.ip,
    userAgent: req.get('user-agent'),
  });
  next();
});

// ============================================
// GRACEFUL SHUTDOWN STATE
// ============================================

let server: http.Server | null = null;
let isShuttingDown = false;

async function gracefulShutdown(signal: string): Promise<void> {
  if (isShuttingDown) return;
  isShuttingDown = true;

  console.log(`[SHUTDOWN] Received ${signal}, starting graceful shutdown...`);

  try {
    if (server) {
      await new Promise<void>((resolve) => {
        server!.close(() => resolve());
      });
      console.log('[SHUTDOWN] HTTP server closed');
    }

    // Close Redis connections
    if (targetingEngine.redis && typeof targetingEngine.redis.quit === 'function') {
      await targetingEngine.redis.quit();
    }
    if (actionEngine.redis && typeof actionEngine.redis.quit === 'function') {
      await actionEngine.redis.quit();
    }

    console.log('[SHUTDOWN] Graceful shutdown complete');
    process.exit(0);
  } catch (error) {
    console.error('[SHUTDOWN] Error during shutdown:', error);
    process.exit(1);
  }
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('uncaughtException', (error: Error) => {
  console.error('[UNCAUGHT] Exception:', error.message);
  gracefulShutdown('uncaughtException');
});
process.on('unhandledRejection', (reason: unknown) => {
  console.error('[UNHANDLED] Rejection:', reason);
  gracefulShutdown('unhandledRejection');
});

// ============================================
// SECURED ROUTES (require internal auth)
// ============================================

// Supreme Controller
app.use('/api/rde', verifyInternal, supremeControllerRoutes);

// Real-time Triggers
app.use('/api/triggers', verifyInternal, realtimeTriggerRoutes);

// Auction Engine
app.use('/api/auction', verifyInternal, auctionRoutes);

// Sampling Routes
app.use('/api/sampling', verifyInternal, samplingRoutes);

// Sampling Analytics
app.use('/api/sampling/analytics', verifyInternal, samplingAnalyticsRoutes);

// Merchant Analytics
app.use('/api/merchant', verifyInternal, merchantCoinAnalyticsRoutes);

// DOOH Analytics
app.use('/api/dooh/analytics', verifyInternal, doohAnalyticsRoutes);

// ============================================
// TARGETING ROUTES (require internal auth)
// ============================================

app.get('/api/targeting/segments/:userId', verifyInternal, async (req: Request, res: Response) => {
  try {
    const segments = await targetingEngine.evaluate(req.params.userId);
    res.json({ success: true, data: segments });
  } catch (error) {
    console.error('[TARGETING] Evaluate error:', error);
    res.status(500).json({ success: false, error: 'Failed to evaluate segments' });
  }
});

app.post('/api/targeting/evaluate', verifyInternal, async (req: Request, res: Response) => {
  try {
    const { userId, campaignId } = req.body;
    const segments = await targetingEngine.evaluate(userId);
    const variant = targetingEngine.assignVariant(userId, campaignId);
    res.json({ success: true, segments, variant });
  } catch (error) {
    console.error('[TARGETING] Evaluate error:', error);
    res.status(500).json({ success: false, error: 'Failed to evaluate' });
  }
});

// ============================================
// FREQUENCY ROUTES (require internal auth)
// ============================================

app.get('/api/frequency/:userId/:campaignId/:channel', verifyInternal, async (req: Request, res: Response) => {
  try {
    const { userId, campaignId, channel } = req.params;
    const allowed = await targetingEngine.checkFrequencyCap(userId, campaignId, channel);
    res.json({ success: true, allowed });
  } catch (error) {
    console.error('[FREQUENCY] Check error:', error);
    res.status(500).json({ success: false, error: 'Failed to check frequency' });
  }
});

app.post('/api/frequency/record', verifyInternal, async (req: Request, res: Response) => {
  try {
    const { userId, campaignId, channel } = req.body;
    await targetingEngine.recordImpression(userId, campaignId, channel);
    res.json({ success: true });
  } catch (error) {
    console.error('[FREQUENCY] Record error:', error);
    res.status(500).json({ success: false, error: 'Failed to record' });
  }
});

// ============================================
// ACTION ROUTES (require internal auth)
// ============================================

app.post('/api/actions/execute', verifyInternal, async (req: Request, res: Response) => {
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
    console.error('[ACTIONS] Execute error:', error);
    res.status(500).json({ success: false, error: 'Failed to execute' });
  }
});

app.get('/api/actions/pending', verifyInternal, async (req: Request, res: Response) => {
  try {
    const actions = await actionEngine.getPending();
    res.json({ success: true, data: actions });
  } catch (error) {
    console.error('[ACTIONS] Pending error:', error);
    res.status(500).json({ success: false, error: 'Failed to get pending' });
  }
});

app.post('/api/actions/:id/approve', verifyInternal, async (req: Request, res: Response) => {
  try {
    const result = await actionEngine.approve(req.params.id);
    res.json(result);
  } catch (error) {
    console.error('[ACTIONS] Approve error:', error);
    res.status(500).json({ success: false, error: 'Failed to approve' });
  }
});

app.post('/api/actions/:id/reject', verifyInternal, async (req: Request, res: Response) => {
  try {
    const { reason } = req.body;
    await actionEngine.reject(req.params.id, reason);
    res.json({ success: true });
  } catch (error) {
    console.error('[ACTIONS] Reject error:', error);
    res.status(500).json({ success: false, error: 'Failed to reject' });
  }
});

// ============================================
// ATTRIBUTION ROUTES (require internal auth)
// ============================================

app.post('/api/attribution/track', verifyInternal, async (req: Request, res: Response) => {
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

    res.json({ success: result.success, eventId: result.eventId, error: result.error });
  } catch (error) {
    console.error('[ATTRIBUTION] Track error:', error);
    res.status(500).json({ success: false, error: 'Failed to track event' });
  }
});

app.get('/api/attribution/summary/:userId', verifyInternal, async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const windowDays = parseInt(req.query.window as string) || 7;
    const summary = await attributionTracker.getAttributionSummary(userId, windowDays);
    res.json({ success: true, data: summary });
  } catch (error) {
    console.error('[ATTRIBUTION] Summary error:', error);
    res.status(500).json({ success: false, error: 'Failed to get summary' });
  }
});

app.post('/api/attribution/attribute', verifyInternal, async (req: Request, res: Response) => {
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
      userId, campaignId, conversionValue, 'purchase', attributionModel
    );

    res.json({ success: true, data: results });
  } catch (error) {
    console.error('[ATTRIBUTION] Attribute error:', error);
    res.status(500).json({ success: false, error: 'Failed to calculate attribution' });
  }
});

app.post('/api/attribution/conversion', verifyInternal, async (req: Request, res: Response) => {
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
      userId, campaignId, merchantId, conversionType, value, attributionModel
    );

    res.json({ success: true, data: results });
  } catch (error) {
    console.error('[ATTRIBUTION] Conversion error:', error);
    res.status(500).json({ success: false, error: 'Failed to record conversion' });
  }
});

app.get('/api/attribution/campaign/:campaignId', verifyInternal, async (req: Request, res: Response) => {
  try {
    const { campaignId } = req.params;
    const stats = await attributionTracker.getCampaignAttribution(campaignId);
    res.json({ success: true, data: stats });
  } catch (error) {
    console.error('[ATTRIBUTION] Campaign stats error:', error);
    res.status(500).json({ success: false, error: 'Failed to get campaign stats' });
  }
});

app.post('/api/attribution/event/:eventType', verifyInternal, async (req: Request, res: Response) => {
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
      case 'scan': result = await trackScan(userId, campaignId, merchantId, metadata); break;
      case 'visit': result = await trackVisit(userId, campaignId, merchantId, metadata); break;
      case 'redeem': result = await trackRedeem(userId, campaignId, merchantId, value, metadata); break;
      case 'purchase': result = await trackPurchase(userId, campaignId, merchantId, value, metadata); break;
      case 'repeat': result = await trackRepeat(userId, campaignId, merchantId, metadata); break;
    }

    res.json({ success: result.success, eventId: result.eventId, error: result.error });
  } catch (error) {
    console.error('[ATTRIBUTION] Event tracking error:', error);
    res.status(500).json({ success: false, error: 'Failed to track event' });
  }
});

// ============================================
// HEALTH (public)
// ============================================

app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', service: 'decision-service', timestamp: new Date().toISOString() });
});

// ============================================
// ERROR HANDLER
// ============================================

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('[ERROR]', err.message);
  res.status(500).json({ success: false, error: 'Internal server error' });
});

// ============================================
// START SERVER
// ============================================

server = app.listen(PORT, () => {
  console.log(`Decision service running on port ${PORT}`);
});

export default app;
