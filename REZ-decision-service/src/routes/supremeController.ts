/**
 * SUPREME CONTROLLER ROUTES
 *
 * These endpoints are the GATEWAY - all channels MUST call these
 */

import { Router } from 'express';
import { supremeController, requestDecision, processEvent, DecisionRequest, RealTimeEvent } from '../engines/sampling/supremeController';

const router = Router();

// ============================================
// SUPREME DECISION ENDPOINT (MUST BE CALLED BY ALL CHANNELS)
// ============================================

/**
 * POST /api/rde/decide
 *
 * ALL channels must call this BEFORE taking action
 *
 * Examples:
 * - rez-marketing calls before sending WhatsApp
 * - adsqr calls before crediting coins
 * - adBazaar calls before showing ad
 * - rez-dooh calls before serving screen
 */
router.post('/decide', async (req, res) => {
  try {
    const { userId, action, channel, context } = req.body;

    if (!userId || !action || !channel) {
      return res.status(400).json({
        success: false,
        error: 'userId, action, and channel are required'
      });
    }

    const request: DecisionRequest = {
      userId,
      action,
      channel,
      context: context || {}
    };

    const decision = await requestDecision(request);

    res.json({
      success: true,
      data: decision
    });

  } catch (error) {
    console.error('[RDE Supreme] Decision error:', error);
    res.status(500).json({
      success: false,
      error: 'Decision failed'
    });
  }
});

// ============================================
// REAL-TIME EVENT PROCESSING
// ============================================

/**
 * POST /api/rde/event
 *
 * Webhook for real-time events
 * Called by: search service, location service, cart service
 *
 * Latency requirement: < 100ms
 */
router.post('/event', async (req, res) => {
  try {
    const { userId, event, data, timestamp } = req.body;

    if (!userId || !event) {
      return res.status(400).json({
        success: false,
        error: 'userId and event are required'
      });
    }

    const realtimeEvent: RealTimeEvent = {
      userId,
      event,
      data: data || {},
      timestamp: timestamp ? new Date(timestamp) : new Date()
    };

    // Process immediately (< 100ms target)
    const start = Date.now();
    const decision = await processEvent(realtimeEvent);
    const latency = Date.now() - start;

    res.json({
      success: true,
      data: {
        decision,
        latencyMs: latency
      }
    });

  } catch (error) {
    console.error('[RDE Supreme] Event error:', error);
    res.status(500).json({
      success: false,
      error: 'Event processing failed'
    });
  }
});

// ============================================
// RECORD EXECUTION RESULT
// ============================================

/**
 * POST /api/rde/result
 *
 * Called by channels after executing action
 * Records: sent, clicked, converted, failed
 */
router.post('/result', async (req, res) => {
  try {
    const { decisionId, result } = req.body;

    if (!decisionId || !result) {
      return res.status(400).json({
        success: false,
        error: 'decisionId and result are required'
      });
    }

    await supremeController.recordExecution(decisionId, result);

    res.json({
      success: true
    });

  } catch (error) {
    console.error('[RDE Supreme] Result error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to record result'
    });
  }
});

// ============================================
// MERCHANT RANKING
// ============================================

/**
 * GET /api/rde/ranking/:userId
 *
 * Get ranked merchants for a user
 * Used by: UCE, targeting
 */
router.get('/ranking/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    const ranking = await supremeController.getMerchantRanking(userId);

    res.json({
      success: true,
      data: {
        userId,
        merchants: ranking,
        count: ranking.length
      }
    });

  } catch (error) {
    console.error('[RDE Supreme] Ranking error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get ranking'
    });
  }
});

// ============================================
// QUICK CHECK
// ============================================

/**
 * GET /api/rde/check/:userId/:channel
 *
 * Quick check if user can receive message on channel
 * Used by: channels before even requesting decision
 */
router.get('/check/:userId/:channel', async (req, res) => {
  try {
    const { userId, channel } = req.params;

    const allowed = await supremeController.quickCheck(userId, channel as any);

    res.json({
      success: true,
      data: {
        userId,
        channel,
        allowed,
        message: allowed ? 'Can send' : 'User fatigued or opted out'
      }
    });

  } catch (error) {
    console.error('[RDE Supreme] Check error:', error);
    res.status(500).json({
      success: false,
      error: 'Check failed'
    });
  }
});

// ============================================
// HEALTH CHECK
// ============================================

router.get('/health', async (req, res) => {
  res.json({
    status: 'ok',
    service: 'rde-supreme-controller',
    version: '1.0',
    uptime: process.uptime()
  });
});

export default router;
