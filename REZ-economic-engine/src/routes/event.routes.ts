/**
 * Event Routes
 *
 * Event ingestion API
 */

import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { ReZEvent, ReZEventType } from '../types';
import { BusinessRule } from '../models/BusinessRule';
import { evaluateRules } from '../engines/ruleEngine';
import { runFraudChecks } from '../engines/fraudEngine';
import { cacheService } from '../services/cacheService';

const router = Router();

/**
 * POST /api/events
 * Ingest an event
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const {
      eventType,
      source,
      sourceId,
      userId,
      merchantId,
      storeId,
      transactionId,
      data,
      metadata
    } = req.body;

    if (!eventType || !source) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: eventType, source'
      });
    }

    // Create event
    const event: ReZEvent = {
      eventId: uuidv4(),
      eventType,
      source,
      sourceId,
      userId,
      merchantId,
      storeId,
      transactionId,
      data: data || {},
      metadata: {
        timestamp: new Date(),
        correlationId: metadata?.correlationId,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
      },
      status: 'pending'
    };

    // Build context for rule evaluation
    const context = {
      user: userId ? { id: userId } : undefined,
      merchant: merchantId ? { id: merchantId } : undefined,
      store: storeId ? { id: storeId } : undefined,
      transaction: transactionId ? { id: transactionId } : undefined,
      event: { type: eventType, ...data },
      location: data?.location,
      device: {
        ip: req.ip,
        userAgent: req.headers['user-agent']
      },
      timestamp: new Date()
    };

    // Run fraud checks
    const fraudResult = runFraudChecks({
      ...context,
      event,
      scanHistory: userId ? await cacheService.getScanHistory(userId) : []
    });

    // If fraud detected, block
    if (fraudResult.isFraud && fraudResult.action === 'block') {
      event.status = 'failed';
      event.error = `Fraud detected: ${fraudResult.reasons.join(', ')}`;

      return res.status(403).json({
        success: false,
        error: 'Action blocked due to fraud detection',
        fraudResult
      });
    }

    // Find applicable rules
    const rules = await BusinessRule.find({
      category: getCategoryFromEventType(eventType),
      isActive: true,
      effectiveFrom: { $lte: new Date() },
      $or: [
        { effectiveTo: null },
        { effectiveTo: { $gt: new Date() } }
      ]
    }).sort({ priority: -1 });

    // Evaluate rules
    const results = await evaluateRules(rules, context);

    // Process actions
    const actionsTriggered: any[] = [];
    for (const result of results) {
      for (const action of result.actions) {
        actionsTriggered.push({
          actionType: action.actionType,
          params: action.params,
          ruleId: result.ruleId
        });
      }
    }

    // Mark event as processed
    event.status = 'processed';
    event.processedAt = new Date();

    // Update scan history if applicable
    if (userId && (eventType === 'qr.scanned' || eventType === 'transaction.completed')) {
      await cacheService.addScanHistory(userId, {
        timestamp: new Date(),
        location: data?.location,
        ip: req.ip
      });
    }

    res.status(201).json({
      success: true,
      data: {
        event,
        fraudResult,
        rulesEvaluated: rules.length,
        rulesMatched: results.length,
        actionsTriggered
      }
    });
  } catch (error) {
    console.error('Error ingesting event:', error);
    res.status(500).json({ success: false, error: 'Failed to ingest event' });
  }
});

/**
 * GET /api/events/:id
 * Get event by ID
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    // In a real implementation, you'd fetch from database
    // For now, return mock
    res.json({
      success: false,
      error: 'Event lookup not implemented - would query database'
    });
  } catch (error) {
    console.error('Error getting event:', error);
    res.status(500).json({ success: false, error: 'Failed to get event' });
  }
});

/**
 * GET /api/events/stats
 * Get event statistics
 */
router.get('/stats', async (req: Request, res: Response) => {
  try {
    const { startDate, endDate, eventType, source } = req.query;

    // In a real implementation, you'd aggregate from database
    // For now, return mock
    res.json({
      success: true,
      data: {
        totalEvents: 0,
        processedEvents: 0,
        failedEvents: 0,
        byType: {},
        bySource: {},
        timeSeries: []
      }
    });
  } catch (error) {
    console.error('Error getting event stats:', error);
    res.status(500).json({ success: false, error: 'Failed to get event stats' });
  }
});

/**
 * POST /api/events/replay
 * Replay an event
 */
router.post('/replay', async (req: Request, res: Response) => {
  try {
    const { eventId } = req.body;

    if (!eventId) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: eventId'
      });
    }

    // In a real implementation, you'd fetch the original event and replay
    res.json({
      success: false,
      error: 'Event replay not implemented - would fetch and replay from database'
    });
  } catch (error) {
    console.error('Error replaying event:', error);
    res.status(500).json({ success: false, error: 'Failed to replay event' });
  }
});

/**
 * Get category from event type
 */
function getCategoryFromEventType(eventType: string): string {
  const mapping: Record<string, string> = {
    'qr.scanned': 'qr_verify',
    'qr.verified': 'qr_verify',
    'qr.fraud_detected': 'qr_verify',
    'transaction.completed': 'transaction',
    'transaction.refunded': 'transaction',
    'transaction.failed': 'transaction',
    'reward.earned': 'reward',
    'reward.redeemed': 'reward',
    'reward.expired': 'reward',
    'karma.earned': 'karma',
    'karma.converted': 'karma',
    'cashback.applied': 'cashback',
    'commission.calculated': 'commission'
  };

  return mapping[eventType] || 'general';
}

export default router;
