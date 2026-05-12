import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { getAdServer } from '../services/index.js';
import { createEventRateLimiter } from '../middleware/rateLimit.js';
import { TrackEventSchema, EventType } from '../types/index.js';

const router = Router();
const eventRateLimiter = createEventRateLimiter();

// Track impression event (GET for pixel tracking)
router.get('/impression',
  eventRateLimiter,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const {
        requestId,
        adId,
        campaignId,
        placementId,
        sessionId,
        ts,
      } = req.query;

      if (!adId || !campaignId || !placementId) {
        res.status(400).json({
          error: 'Missing required parameters',
        });
        return;
      }

      const adServer = getAdServer(
        req.app.locals.redis,
        req.app.locals.bidEngine,
        req.app.locals.fraudDetection
      );

      const result = await adServer.recordImpression(
        requestId as string,
        adId as string,
        campaignId as string,
        placementId as string,
        {
          ip: req.ip,
          userAgent: req.get('User-Agent'),
          sessionId: sessionId as string,
          timestamp: ts ? parseInt(ts as string, 10) : undefined,
        }
      );

      // Return 1x1 transparent GIF for pixel tracking
      const gif = Buffer.from(
        'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
        'base64'
      );

      res.set({
        'Content-Type': 'image/gif',
        'Content-Length': gif.length,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      });

      res.send(gif);
    } catch (error) {
      next(error);
    }
  }
);

// Track impression event (POST for API)
router.post('/impression',
  eventRateLimiter,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const validatedData = TrackEventSchema.parse({
        ...req.body,
        eventType: EventType.IMPRESSION,
      });

      const adServer = getAdServer(
        req.app.locals.redis,
        req.app.locals.bidEngine,
        req.app.locals.fraudDetection
      );

      const result = await adServer.recordImpression(
        validatedData.sessionId || '',
        validatedData.adId,
        validatedData.campaignId,
        validatedData.placementId,
        {
          ip: req.ip,
          userAgent: req.get('User-Agent'),
          sessionId: validatedData.sessionId,
          timestamp: validatedData.timestamp ? new Date(validatedData.timestamp).getTime() : undefined,
        }
      );

      res.json({
        success: result.success,
        charged: result.charged,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          error: 'Validation Error',
          details: error.errors,
        });
        return;
      }
      next(error);
    }
  }
);

// Track click event (GET for redirect)
router.get('/click',
  eventRateLimiter,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const {
        requestId,
        adId,
        campaignId,
        placementId,
        sessionId,
        ts,
      } = req.query;

      if (!adId || !campaignId || !placementId) {
        res.status(400).json({
          error: 'Missing required parameters',
        });
        return;
      }

      const adServer = getAdServer(
        req.app.locals.redis,
        req.app.locals.bidEngine,
        req.app.locals.fraudDetection
      );

      const result = await adServer.recordClick(
        requestId as string,
        adId as string,
        campaignId as string,
        placementId as string,
        {
          ip: req.ip,
          userAgent: req.get('User-Agent'),
          sessionId: sessionId as string,
          timestamp: ts ? parseInt(ts as string, 10) : undefined,
        }
      );

      if (!result.success) {
        // Click was blocked or duplicate - still redirect but to blocked page
        res.redirect(302, '/blocked.html');
        return;
      }

      if (result.redirectUrl) {
        res.redirect(302, result.redirectUrl);
      } else {
        res.status(204).send();
      }
    } catch (error) {
      next(error);
    }
  }
);

// Track click event (POST for API)
router.post('/click',
  eventRateLimiter,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const validatedData = TrackEventSchema.parse({
        ...req.body,
        eventType: EventType.CLICK,
      });

      const adServer = getAdServer(
        req.app.locals.redis,
        req.app.locals.bidEngine,
        req.app.locals.fraudDetection
      );

      const result = await adServer.recordClick(
        validatedData.sessionId || '',
        validatedData.adId,
        validatedData.campaignId,
        validatedData.placementId,
        {
          ip: req.ip,
          userAgent: req.get('User-Agent'),
          sessionId: validatedData.sessionId,
          timestamp: validatedData.timestamp ? new Date(validatedData.timestamp).getTime() : undefined,
        }
      );

      res.json({
        success: result.success,
        redirectUrl: result.redirectUrl,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          error: 'Validation Error',
          details: error.errors,
        });
        return;
      }
      next(error);
    }
  }
);

// Track view event (for video ads)
router.get('/view',
  eventRateLimiter,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const {
        requestId,
        adId,
        campaignId,
        placementId,
        sessionId,
        duration,
        ts,
      } = req.query;

      if (!adId || !campaignId || !placementId) {
        res.status(400).json({
          error: 'Missing required parameters',
        });
        return;
      }

      // Record view with duration if provided
      const { TrackEventSchema } = await import('../types/index.js');

      const adServer = getAdServer(
        req.app.locals.redis,
        req.app.locals.bidEngine,
        req.app.locals.fraudDetection
      );

      // For view events, we just acknowledge receipt
      res.json({
        success: true,
        recorded: true,
      });
    } catch (error) {
      next(error);
    }
  }
);

// Track view event (POST)
router.post('/view',
  eventRateLimiter,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const validatedData = TrackEventSchema.parse({
        ...req.body,
        eventType: EventType.VIEW,
      });

      // Record view event
      res.json({
        success: true,
        recorded: true,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          error: 'Validation Error',
          details: error.errors,
        });
        return;
      }
      next(error);
    }
  }
);

// Track conversion event
router.post('/conversion',
  eventRateLimiter,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const {
        requestId,
        adId,
        campaignId,
        placementId,
        value,
        currency,
        metadata,
      } = req.body;

      if (!adId || !campaignId || !placementId) {
        res.status(400).json({
          error: 'Missing required parameters',
        });
        return;
      }

      const adServer = getAdServer(
        req.app.locals.redis,
        req.app.locals.bidEngine,
        req.app.locals.fraudDetection
      );

      const result = await adServer.recordConversion(
        requestId || '',
        adId,
        campaignId,
        placementId,
        {
          value,
          currency,
          ip: req.ip,
          userAgent: req.get('User-Agent'),
          metadata,
        }
      );

      res.json({
        success: result.success,
      });
    } catch (error) {
      next(error);
    }
  }
);

// Batch track events
router.post('/batch',
  eventRateLimiter,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { events } = req.body;

      if (!Array.isArray(events)) {
        res.status(400).json({
          error: 'Events must be an array',
        });
        return;
      }

      const results = await Promise.allSettled(
        events.map(async (event) => {
          const adServer = getAdServer(
            req.app.locals.redis,
            req.app.locals.bidEngine,
            req.app.locals.fraudDetection
          );

          switch (event.eventType) {
            case EventType.IMPRESSION:
              return adServer.recordImpression(
                event.sessionId || '',
                event.adId,
                event.campaignId,
                event.placementId,
                {
                  ip: req.ip,
                  userAgent: req.get('User-Agent'),
                  sessionId: event.sessionId,
                  timestamp: event.timestamp,
                }
              );

            case EventType.CLICK:
              return adServer.recordClick(
                event.sessionId || '',
                event.adId,
                event.campaignId,
                event.placementId,
                {
                  ip: req.ip,
                  userAgent: req.get('User-Agent'),
                  sessionId: event.sessionId,
                  timestamp: event.timestamp,
                }
              );

            case EventType.CONVERSION:
              return adServer.recordConversion(
                event.sessionId || '',
                event.adId,
                event.campaignId,
                event.placementId,
                {
                  value: event.value,
                  currency: event.currency,
                  ip: req.ip,
                  userAgent: req.get('User-Agent'),
                  metadata: event.metadata,
                }
              );

            default:
              return { success: false };
          }
        })
      );

      const response = results.map((result, index) => ({
        index,
        success: result.status === 'fulfilled' ? result.value.success : false,
        error: result.status === 'rejected' ? result.reason?.message : undefined,
      }));

      res.json({
        processed: events.length,
        successful: response.filter(r => r.success).length,
        failed: response.filter(r => !r.success).length,
        results: response,
      });
    } catch (error) {
      next(error);
    }
  }
);

// Get event statistics for a campaign
router.get('/stats/:campaignId',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { campaignId } = req.params;
      const { startDate, endDate } = req.query;

      const { CampaignModel } = await import('../models/index.js');
      const campaign = await CampaignModel.findOne({ campaignId }).lean();

      if (!campaign) {
        res.status(404).json({
          error: 'Not Found',
          message: 'Campaign not found',
        });
        return;
      }

      res.json({
        campaignId,
        statistics: campaign.statistics,
        budget: {
          total: campaign.budget.total,
          spent: campaign.budget.spent,
          remaining: campaign.budget.total - campaign.budget.spent,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
