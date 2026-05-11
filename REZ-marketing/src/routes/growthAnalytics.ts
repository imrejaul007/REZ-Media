import { Router, Request, Response } from 'express';
import mongoose from 'mongoose';
import { z } from 'zod';
import { growthAnalytics } from '../services/growthAnalytics';
import { GrowthEventType, SourceService } from '../models/GrowthEvent';

const router = Router();

// ─── Validation Schemas ────────────────────────────────────────────────────────

const trackEventSchema = z.object({
  eventType: z.enum([
    'campaign_created',
    'ad_impression',
    'ad_click',
    'notification_sent',
    'notification_opened',
    'voucher_issued',
    'conversion',
  ]),
  sourceService: z.enum(['marketing', 'ads', 'notification', 'analytics']),
  userId: z.string().optional(),
  merchantId: z.string().min(1, 'merchantId is required'),
  metadata: z.record(z.unknown()).optional(),
  value: z.number().optional(),
  timestamp: z.string().datetime().optional(),
  sessionId: z.string().optional(),
});

const dateRangeSchema = z.object({
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  days: z.coerce.number().min(1).max(365).optional().default(30),
  groupBy: z.enum(['day', 'week', 'month']).optional(),
  adSpend: z.coerce.number().min(0).optional(),
});

const campaignIdSchema = z.object({
  id: z.string().min(1, 'Campaign ID is required'),
});

const merchantIdSchema = z.object({
  id: z.string().min(1, 'Merchant ID is required'),
});

// ─── Routes ────────────────────────────────────────────────────────────────────

/**
 * POST /api/analytics/track
 * Track any growth event from marketing, ads, or notification services.
 */
router.post('/track', async (req: Request, res: Response) => {
  const parseResult = trackEventSchema.safeParse(req.body);

  if (!parseResult.success) {
    res.status(400).json({
      error: 'Validation failed',
      details: parseResult.error.issues,
    });
    return;
  }

  const input = parseResult.data;

  // Validate merchantId is a valid ObjectId
  if (!mongoose.isValidObjectId(input.merchantId)) {
    res.status(400).json({ error: 'Invalid merchantId format' });
    return;
  }

  // Validate userId if provided
  if (input.userId && !mongoose.isValidObjectId(input.userId)) {
    res.status(400).json({ error: 'Invalid userId format' });
    return;
  }

  const event = await growthAnalytics.trackEvent({
    eventType: input.eventType as GrowthEventType,
    sourceService: input.sourceService as SourceService,
    userId: input.userId,
    merchantId: input.merchantId,
    metadata: input.metadata as Record<string, unknown>,
    value: input.value,
    timestamp: input.timestamp ? new Date(input.timestamp) : undefined,
    sessionId: input.sessionId,
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'],
  });

  res.status(201).json({
    success: true,
    eventId: event._id,
    eventType: event.eventType,
    timestamp: event.timestamp,
  });
});

/**
 * POST /api/analytics/track/batch
 * Track multiple growth events in a single request.
 */
router.post('/track/batch', async (req: Request, res: Response) => {
  const events = req.body.events;

  if (!Array.isArray(events)) {
    res.status(400).json({ error: 'events must be an array' });
    return;
  }

  if (events.length > 100) {
    res.status(400).json({ error: 'Maximum 100 events per batch' });
    return;
  }

  const results: Array<{ index: number; success: boolean; eventId?: string; error?: string }> = [];

  for (let i = 0; i < events.length; i++) {
    const parseResult = trackEventSchema.safeParse(events[i]);

    if (!parseResult.success) {
      results.push({
        index: i,
        success: false,
        error: parseResult.error.issues[0]?.message || 'Validation failed',
      });
      continue;
    }

    const input = parseResult.data;

    try {
      if (!mongoose.isValidObjectId(input.merchantId)) {
        results.push({ index: i, success: false, error: 'Invalid merchantId' });
        continue;
      }

      const event = await growthAnalytics.trackEvent({
        eventType: input.eventType as GrowthEventType,
        sourceService: input.sourceService as SourceService,
        userId: input.userId,
        merchantId: input.merchantId,
        metadata: input.metadata as Record<string, unknown>,
        value: input.value,
        timestamp: input.timestamp ? new Date(input.timestamp) : undefined,
        sessionId: input.sessionId,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });

      results.push({ index: i, success: true, eventId: event._id?.toString() });
    } catch (err) {
      results.push({
        index: i,
        success: false,
        error: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  }

  const successCount = results.filter((r) => r.success).length;

  res.status(successCount === results.length ? 201 : 207).json({
    total: events.length,
    successCount,
    failedCount: events.length - successCount,
    results,
  });
});

/**
 * GET /api/analytics/campaign/:id
 * Full campaign analytics combining all growth events.
 */
router.get('/campaign/:id', async (req: Request, res: Response) => {
  const parseResult = merchantIdSchema.extend({
    id: z.string(),
  }).safeParse({ ...req.params, ...req.query });

  if (!parseResult.success) {
    res.status(400).json({ error: 'Invalid parameters' });
    return;
  }

  const { id } = parseResult.data;
  const merchantId = req.query.merchantId as string;

  if (!merchantId) {
    res.status(400).json({ error: 'merchantId query parameter is required' });
    return;
  }

  if (!mongoose.isValidObjectId(merchantId)) {
    res.status(400).json({ error: 'Invalid merchantId format' });
    return;
  }

  const metrics = await growthAnalytics.getCampaignMetrics({
    campaignId: id,
    merchantId,
  });

  if (!metrics) {
    res.status(404).json({ error: 'No events found for this campaign' });
    return;
  }

  res.json(metrics);
});

/**
 * GET /api/analytics/merchant/:id
 * Merchant growth dashboard with all metrics.
 */
router.get('/merchant/:id', async (req: Request, res: Response) => {
  const merchantId = req.params.id;

  if (!mongoose.isValidObjectId(merchantId)) {
    res.status(400).json({ error: 'Invalid merchantId format' });
    return;
  }

  const parseResult = dateRangeSchema.safeParse(req.query);

  if (!parseResult.success) {
    res.status(400).json({
      error: 'Invalid query parameters',
      details: parseResult.error.issues,
    });
    return;
  }

  const { startDate, endDate, days } = parseResult.data;

  // Default to last N days if not specified
  const end = endDate ? new Date(endDate) : new Date();
  const start = startDate
    ? new Date(startDate)
    : new Date(Date.now() - (days || 30) * 24 * 60 * 60 * 1000);

  const dashboard = await growthAnalytics.getMerchantDashboard(merchantId, start, end);

  res.json(dashboard);
});

/**
 * GET /api/analytics/funnel
 * Conversion funnel from impression to conversion.
 */
router.get('/funnel', async (req: Request, res: Response) => {
  const parseResult = dateRangeSchema.extend({
    merchantId: z.string().min(1, 'merchantId is required'),
  }).safeParse(req.query);

  if (!parseResult.success) {
    res.status(400).json({
      error: 'Invalid query parameters',
      details: parseResult.error.issues,
    });
    return;
  }

  const { merchantId, startDate, endDate, days, groupBy } = parseResult.data;

  if (!mongoose.isValidObjectId(merchantId)) {
    res.status(400).json({ error: 'Invalid merchantId format' });
    return;
  }

  const end = endDate ? new Date(endDate) : new Date();
  const start = startDate
    ? new Date(startDate)
    : new Date(Date.now() - (days || 30) * 24 * 60 * 60 * 1000);

  const funnel = await growthAnalytics.getConversionFunnel({
    merchantId,
    startDate: start,
    endDate: end,
    groupBy: groupBy || 'day',
  });

  res.json(funnel);
});

/**
 * GET /api/analytics/roas
 * Return on Ad Spend calculation.
 */
router.get('/roas', async (req: Request, res: Response) => {
  const parseResult = dateRangeSchema.extend({
    merchantId: z.string().min(1, 'merchantId is required'),
    adSpend: z.coerce.number().min(0, 'adSpend must be non-negative'),
  }).safeParse(req.query);

  if (!parseResult.success) {
    res.status(400).json({
      error: 'Invalid query parameters',
      details: parseResult.error.issues,
    });
    return;
  }

  const { merchantId, startDate, endDate, days, adSpend } = parseResult.data;

  if (!mongoose.isValidObjectId(merchantId)) {
    res.status(400).json({ error: 'Invalid merchantId format' });
    return;
  }

  const end = endDate ? new Date(endDate) : new Date();
  const start = startDate
    ? new Date(startDate)
    : new Date(Date.now() - (days || 30) * 24 * 60 * 60 * 1000);

  const roas = await growthAnalytics.getROAS({
    merchantId,
    startDate: start,
    endDate: end,
    adSpend: adSpend || 0,
  });

  res.json(roas);
});

/**
 * GET /api/analytics/events
 * Query raw events with filters (admin/debug use).
 */
router.get('/events', async (req: Request, res: Response) => {
  const merchantId = req.query.merchantId as string;

  if (!merchantId || !mongoose.isValidObjectId(merchantId)) {
    res.status(400).json({ error: 'Valid merchantId is required' });
    return;
  }

  const eventTypes = req.query.eventTypes
    ? (req.query.eventTypes as string).split(',')
    : undefined;

  const startDate = req.query.startDate
    ? new Date(req.query.startDate as string)
    : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const endDate = req.query.endDate
    ? new Date(req.query.endDate as string)
    : new Date();

  const limit = Math.min(parseInt(req.query.limit as string) || 100, 1000);
  const skip = parseInt(req.query.skip as string) || 0;

  const query: Record<string, unknown> = {
    merchantId: new mongoose.Types.ObjectId(merchantId),
    timestamp: { $gte: startDate, $lte: endDate },
  };

  if (eventTypes) {
    query.eventType = { $in: eventTypes };
  }

  const [events, total] = await Promise.all([
    mongoose.connection
      .collection('growth_events')
      .find(query)
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(limit)
      .toArray(),
    mongoose.connection.collection('growth_events').countDocuments(query),
  ]);

  res.json({
    events,
    pagination: {
      total,
      limit,
      skip,
      hasMore: skip + events.length < total,
    },
  });
});

export default router;
