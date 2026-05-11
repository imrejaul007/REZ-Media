/**
 * REAL-TIME TRIGGER ROUTES
 *
 * Webhook endpoints for external services to fire triggers
 */

import { Router } from 'express';
import { triggerEngine, processTrigger, TriggerContext, TriggerRule, TriggerEvent } from '../engines/sampling/realtimeTriggers';

const router = Router();

// ============================================
// WEBHOOK ENDPOINTS
// Called by external services (search, location, cart, etc.)
// ============================================

/**
 * POST /api/triggers/fire
 *
 * Main trigger webhook - called by ANY service on user action
 *
 * Latency requirement: < 100ms
 */
router.post('/fire', async (req, res) => {
  try {
    const start = Date.now();

    const { userId, event, data, timestamp } = req.body;

    if (!userId || !event) {
      return res.status(400).json({
        success: false,
        error: 'userId and event are required'
      });
    }

    const triggerContext: TriggerContext = {
      userId,
      event,
      data: data || {},
      timestamp: timestamp ? new Date(timestamp) : new Date()
    };

    const results = await processTrigger(triggerContext);

    const latency = Date.now() - start;

    res.json({
      success: true,
      data: {
        event,
        userId,
        triggered: results.length,
        actions: results,
        latencyMs: latency
      }
    });

  } catch (error) {
    console.error('[Triggers] Fire error:', error);
    res.status(500).json({
      success: false,
      error: 'Trigger processing failed'
    });
  }
});

// ============================================
// SPECIFIC EVENT WEBHOOKS
// Convenience endpoints for common events
// ============================================

/**
 * POST /api/triggers/search
 *
 * Called by: search service
 * Triggered when: user searches for something
 */
router.post('/search', async (req, res) => {
  try {
    const { userId, query, location, intent } = req.body;

    const triggerContext: TriggerContext = {
      userId,
      event: 'search',
      data: {
        query,
        intent: intent || extractIntent(query),
        location
      },
      timestamp: new Date()
    };

    const start = Date.now();
    const results = await processTrigger(triggerContext);
    const latency = Date.now() - start;

    res.json({
      success: true,
      data: {
        event: 'search',
        query,
        triggered: results.length,
        actions: results,
        latencyMs: latency
      }
    });

  } catch (error) {
    console.error('[Triggers] Search error:', error);
    res.status(500).json({
      success: false,
      error: 'Search trigger failed'
    });
  }
});

/**
 * POST /api/triggers/scan
 *
 * Called by: adsqr
 * Triggered when: user scans QR code
 */
router.post('/scan', async (req, res) => {
  try {
    const { userId, campaignId, merchantId, location, category } = req.body;

    const triggerContext: TriggerContext = {
      userId,
      event: 'scan',
      data: {
        campaignId,
        merchantId,
        location,
        category
      },
      timestamp: new Date()
    };

    const start = Date.now();
    const results = await processTrigger(triggerContext);
    const latency = Date.now() - start;

    res.json({
      success: true,
      data: {
        event: 'scan',
        campaignId,
        triggered: results.length,
        actions: results,
        latencyMs: latency
      }
    });

  } catch (error) {
    console.error('[Triggers] Scan error:', error);
    res.status(500).json({
      success: false,
      error: 'Scan trigger failed'
    });
  }
});

/**
 * POST /api/triggers/location
 *
 * Called by: location service
 * Triggered when: user enters/exits a location
 */
router.post('/location', async (req, res) => {
  try {
    const { userId, location, type, zoneId } = req.body;

    const triggerContext: TriggerContext = {
      userId,
      event: type === 'enter' ? 'location_entry' : 'location_exit',
      data: {
        location,
        zoneId
      },
      timestamp: new Date()
    };

    const start = Date.now();
    const results = await processTrigger(triggerContext);
    const latency = Date.now() - start;

    res.json({
      success: true,
      data: {
        event: triggerContext.event,
        triggered: results.length,
        actions: results,
        latencyMs: latency
      }
    });

  } catch (error) {
    console.error('[Triggers] Location error:', error);
    res.status(500).json({
      success: false,
      error: 'Location trigger failed'
    });
  }
});

/**
 * POST /api/triggers/cart
 *
 * Called by: cart service
 * Triggered when: user adds to cart or abandons
 */
router.post('/cart', async (req, res) => {
  try {
    const { userId, cartId, items, totalValue, action } = req.body;

    const triggerContext: TriggerContext = {
      userId,
      event: action === 'abandon' ? 'cart_abandon' : 'cart_add',
      data: {
        cartId,
        items,
        cartValue: totalValue
      },
      timestamp: new Date()
    };

    const start = Date.now();
    const results = await processTrigger(triggerContext);
    const latency = Date.now() - start;

    res.json({
      success: true,
      data: {
        event: triggerContext.event,
        triggered: results.length,
        actions: results,
        latencyMs: latency
      }
    });

  } catch (error) {
    console.error('[Triggers] Cart error:', error);
    res.status(500).json({
      success: false,
      error: 'Cart trigger failed'
    });
  }
});

/**
 * POST /api/triggers/purchase
 *
 * Called by: order service
 * Triggered when: user completes purchase
 */
router.post('/purchase', async (req, res) => {
  try {
    const { userId, orderId, merchantId, amount, items } = req.body;

    const triggerContext: TriggerContext = {
      userId,
      event: 'purchase',
      data: {
        orderId,
        merchantId,
        amount,
        items
      },
      timestamp: new Date()
    };

    const start = Date.now();
    const results = await processTrigger(triggerContext);
    const latency = Date.now() - start;

    res.json({
      success: true,
      data: {
        event: 'purchase',
        orderId,
        triggered: results.length,
        actions: results,
        latencyMs: latency
      }
    });

  } catch (error) {
    console.error('[Triggers] Purchase error:', error);
    res.status(500).json({
      success: false,
      error: 'Purchase trigger failed'
    });
  }
});

/**
 * POST /api/triggers/view
 *
 * Called by: catalog service
 * Triggered when: user views product multiple times
 */
router.post('/view', async (req, res) => {
  try {
    const { userId, productId, merchantId, category, viewCount } = req.body;

    const triggerContext: TriggerContext = {
      userId,
      event: 'view',
      data: {
        productId,
        merchantId,
        category,
        viewCount: viewCount || 1
      },
      timestamp: new Date()
    };

    const start = Date.now();
    const results = await processTrigger(triggerContext);
    const latency = Date.now() - start;

    res.json({
      success: true,
      data: {
        event: 'view',
        productId,
        triggered: results.length,
        actions: results,
        latencyMs: latency
      }
    });

  } catch (error) {
    console.error('[Triggers] View error:', error);
    res.status(500).json({
      success: false,
      error: 'View trigger failed'
    });
  }
});

// ============================================
// RULE MANAGEMENT
// ============================================

/**
 * GET /api/triggers/rules
 *
 * Get all trigger rules
 */
router.get('/rules', async (req, res) => {
  try {
    const rules = await triggerEngine.getAllRules();

    res.json({
      success: true,
      data: {
        count: rules.length,
        rules
      }
    });

  } catch (error) {
    console.error('[Triggers] Rules error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get rules'
    });
  }
});

/**
 * POST /api/triggers/rules
 *
 * Create new trigger rule
 */
router.post('/rules', async (req, res) => {
  try {
    const rule: TriggerRule = req.body;

    if (!rule.id || !rule.event || !rule.action) {
      return res.status(400).json({
        success: false,
        error: 'rule.id, event, and action are required'
      });
    }

    await triggerEngine.saveRule(rule);

    res.json({
      success: true,
      data: { rule }
    });

  } catch (error) {
    console.error('[Triggers] Create rule error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create rule'
    });
  }
});

/**
 * PATCH /api/triggers/rules/:id/toggle
 *
 * Enable/disable trigger rule
 */
router.patch('/rules/:id/toggle', async (req, res) => {
  try {
    const { id } = req.params;
    const { active } = req.body;

    await triggerEngine.toggleRule(id, active);

    res.json({
      success: true,
      data: { id, active }
    });

  } catch (error) {
    console.error('[Triggers] Toggle error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to toggle rule'
    });
  }
});

// ============================================
// UTILITIES
// ============================================

/**
 * Extract intent from search query
 */
function extractIntent(query: string): string {
  const foodKeywords = ['biryani', 'pizza', 'burger', 'dosa', 'idli', 'paratha', 'bhel', 'chaat', 'rice', 'curry'];
  const fashionKeywords = ['shirt', 'jeans', 'dress', 'shoes', 'saree'];
  const beautyKeywords = ['makeup', 'skincare', 'serum', 'cream', 'lipstick'];

  const lowerQuery = query.toLowerCase();

  if (foodKeywords.some(k => lowerQuery.includes(k))) return 'food';
  if (fashionKeywords.some(k => lowerQuery.includes(k))) return 'fashion';
  if (beautyKeywords.some(k => lowerQuery.includes(k))) return 'beauty';

  return 'general';
}

export default router;
