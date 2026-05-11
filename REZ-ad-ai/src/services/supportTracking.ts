/**
 * REZ Ad Copilot - Support Copilot Integration
 *
 * Tracks ad clicks and forwards intent signals to the REZ Support Copilot
 * for customer engagement and conversion optimization.
 */

import express, { Request, Response, NextFunction } from 'express';
import axios from 'axios';

const SUPPORT_COPILOT_URL = process.env.SUPPORT_COPILOT_URL || 'https://rez-support-copilot.onrender.com';
const AD_COPILOT_PORT = parseInt(process.env.PORT || '4021', 10);

const app = express();
app.use(express.json());

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface AdClickEvent {
  adId: string;
  campaignId?: string;
  userId?: string;
  deviceId?: string;
  platform: 'web' | 'ios' | 'android';
  source: 'banner' | 'native' | 'interstitial' | 'rewarded';
  placement: string;
  metadata?: Record<string, unknown>;
  timestamp: string;
}

export interface IntentSignal {
  userId?: string;
  deviceId?: string;
  intent: 'browse' | 'compare' | 'purchase' | 're-engage' | 'churn_risk';
  confidence: number;
  context: {
    adId?: string;
    campaignId?: string;
    previousIntents?: string[];
    sessionData?: Record<string, unknown>;
  };
  recommendations: string[];
  timestamp: string;
}

export interface SupportTrackingResponse {
  success: boolean;
  tracked: boolean;
  intentSignal?: IntentSignal;
  error?: string;
}

// ─── Support Copilot API Client ─────────────────────────────────────────────────

const supportClient = axios.create({
  baseURL: SUPPORT_COPILOT_URL,
  timeout: 5000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// ─── Intent Signal Analyzer ─────────────────────────────────────────────────────

function analyzeIntentSignal(event: AdClickEvent): IntentSignal {
  // Simple intent analysis based on click patterns
  const intentMap: Record<string, { intent: IntentSignal['intent']; confidence: number }> = {
    banner: { intent: 'browse', confidence: 0.6 },
    native: { intent: 'compare', confidence: 0.7 },
    interstitial: { intent: 'purchase', confidence: 0.8 },
    rewarded: { intent: 're-engage', confidence: 0.85 },
  };

  const analysis = intentMap[event.source] || { intent: 'browse', confidence: 0.5 };

  return {
    userId: event.userId,
    deviceId: event.deviceId,
    intent: analysis.intent,
    confidence: analysis.confidence,
    context: {
      adId: event.adId,
      campaignId: event.campaignId,
    },
    recommendations: getRecommendations(analysis.intent),
    timestamp: new Date().toISOString(),
  };
}

function getRecommendations(intent: IntentSignal['intent']): string[] {
  switch (intent) {
    case 'browse':
      return ['show_deals', 'similar_items', 'personalized_suggestions'];
    case 'compare':
      return ['show_reviews', 'price_history', 'side_by_side'];
    case 'purchase':
      return ['limited_time_offer', 'trust_signals', 'checkout_assist'];
    case 're-engage':
      return ['win_back_offer', 'loyalty_bonus', 'feature_new'];
    case 'churn_risk':
      return ['retention_offer', 'feedback_request', 'support_outreach'];
    default:
      return ['personalized_content'];
  }
}

// ─── Routes ─────────────────────────────────────────────────────────────────────

/**
 * Health check
 */
app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'healthy', service: 'REZ-ad-copilot', timestamp: new Date().toISOString() });
});

/**
 * Track ad click and forward to support copilot
 */
app.post('/intent/predict', async (req: Request, res: Response) => {
  const { userId, context } = req.body;

  const intent = {
    userId,
    predicted_intent: 'browsing',
    confidence: 0.75,
    recommendations: ['show_deals', 'similar_items'],
    updatedAt: new Date(),
  };

  res.json({ intent });
});

/**
 * Track ad click event and forward to support copilot
 */
app.post('/track/click', async (req: Request, res: Response) => {
  const event: AdClickEvent = req.body;

  // Validate required fields
  if (!event.adId || !event.platform || !event.source) {
    res.status(400).json({
      success: false,
      error: 'Missing required fields: adId, platform, source',
    });
    return;
  }

  // Set timestamp if not provided
  if (!event.timestamp) {
    event.timestamp = new Date().toISOString();
  }

  try {
    // Analyze intent signal
    const intentSignal = analyzeIntentSignal(event);

    // Forward to support copilot
    try {
      await supportClient.post('/api/analytics/ad-click', {
        event,
        intentSignal,
        source: 'ad_copilot',
        timestamp: new Date().toISOString(),
      });
    } catch (supportError) {
      // Support copilot failure is non-critical - log but don't fail
      console.warn('[AdCopilot] Failed to forward to support copilot:', supportError);
    }

    // Store locally for analytics
    console.log('[AdCopilot] Click tracked:', {
      adId: event.adId,
      intent: intentSignal.intent,
      confidence: intentSignal.confidence,
    });

    res.json({
      success: true,
      tracked: true,
      intentSignal,
    });
  } catch (error) {
    console.error('[AdCopilot] Track click error:', error);
    res.status(500).json({
      success: false,
      tracked: false,
      error: 'Failed to track click event',
    });
  }
});

/**
 * Batch track multiple click events
 */
app.post('/track/batch', async (req: Request, res: Response) => {
  const events: AdClickEvent[] = req.body.events;

  if (!Array.isArray(events) || events.length === 0) {
    res.status(400).json({
      success: false,
      error: 'Events array is required',
    });
    return;
  }

  const results: Array<{ eventId: string; success: boolean; intentSignal?: IntentSignal }> = [];

  for (const event of events) {
    if (!event.timestamp) {
      event.timestamp = new Date().toISOString();
    }

    const intentSignal = analyzeIntentSignal(event);

    try {
      await supportClient.post('/api/analytics/ad-click', {
        event,
        intentSignal,
        source: 'ad_copilot',
        timestamp: new Date().toISOString(),
      });
      results.push({ eventId: event.adId, success: true, intentSignal });
    } catch (error) {
      console.warn('[AdCopilot] Batch item failed:', error);
      results.push({ eventId: event.adId, success: false });
    }
  }

  res.json({
    success: true,
    processed: events.length,
    results,
  });
});

/**
 * Get conversion prediction for user
 */
app.get('/predict/conversion/:userId', async (req: Request, res: Response) => {
  const { userId } = req.params;

  try {
    const response = await supportClient.get(`/api/analytics/conversion/${userId}`);
    res.json(response.data);
  } catch (error) {
    // Fallback to local prediction
    res.json({
      userId,
      conversionProbability: 0.5,
      confidence: 0.3,
      factors: ['historical_behavior', 'intent_signals'],
    });
  }
});

/**
 * Get churn risk for user
 */
app.get('/predict/churn/:userId', async (req: Request, res: Response) => {
  const { userId } = req.params;

  try {
    const response = await supportClient.get(`/api/analytics/churn-risk/${userId}`);
    res.json(response.data);
  } catch (error) {
    // Fallback to local prediction
    res.json({
      userId,
      churnRisk: 'medium',
      confidence: 0.4,
      factors: ['inactivity_days', 'engagement_score'],
    });
  }
});

/**
 * Get personalized recommendations for user
 */
app.get('/recommendations/:userId', async (req: Request, res: Response) => {
  const { userId } = req.params;
  const { limit = 5 } = req.query;

  try {
    const response = await supportClient.get(`/api/analytics/recommendations/${userId}`, {
      params: { limit },
    });
    res.json(response.data);
  } catch (error) {
    // Fallback to default recommendations
    res.json({
      userId,
      recommendations: [
        { type: 'deal', title: 'Limited Time Offer', score: 0.9 },
        { type: 'product', title: 'Popular in Your Area', score: 0.8 },
        { type: 'loyalty', title: 'Earn Bonus Points', score: 0.7 },
      ],
    });
  }
});

// ─── Error Handler ─────────────────────────────────────────────────────────────

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('[AdCopilot] Unhandled error:', err);
  res.status(500).json({
    success: false,
    error: 'Internal server error',
  });
});

// ─── Start Server ───────────────────────────────────────────────────────────────

app.listen(AD_COPILOT_PORT, () => {
  console.log(`REZ Ad Copilot running on port ${AD_COPILOT_PORT}`);
  console.log(`Support Copilot endpoint: ${SUPPORT_COPILOT_URL}`);
});

export default app;
