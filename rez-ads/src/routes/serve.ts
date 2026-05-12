import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { getAdServer } from '../services/index.js';
import { optionalAuthenticate } from '../middleware/auth.js';
import { createServeRateLimiter } from '../middleware/rateLimit.js';
import { ServeAdRequestSchema } from '../types/index.js';

const router = Router();
const serveRateLimiter = createServeRateLimiter();

// Serve ad to user
router.post('/',
  optionalAuthenticate,
  serveRateLimiter,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const validatedData = ServeAdRequestSchema.parse(req.body);

      // Add user context if authenticated
      if (req.user?.userId) {
        validatedData.userId = req.user.userId;
      }

      const adServer = getAdServer(
        req.app.locals.redis,
        req.app.locals.bidEngine,
        req.app.locals.fraudDetection
      );

      const decision = await adServer.serveAd(validatedData);

      if (!decision) {
        // No ad available - return empty response
        res.status(204).send();
        return;
      }

      // Return ad decision
      res.json({
        adId: decision.adId,
        campaignId: decision.campaignId,
        creative: {
          type: decision.ad.type,
          headline: decision.creative.headline,
          description: decision.creative.description,
          imageUrl: decision.creative.imageUrl,
          videoUrl: decision.creative.videoUrl,
          callToAction: decision.creative.callToAction,
          ctaText: decision.creative.ctaText,
        },
        tracking: {
          impressionUrl: decision.impressionUrl,
          clickUrl: decision.clickUrl,
          viewUrl: decision.viewUrl,
        },
        bid: {
          amount: decision.bid.bidAmount,
          type: decision.bid.bidType,
        },
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

// Serve ad via GET (for simpler integration)
router.get('/',
  optionalAuthenticate,
  serveRateLimiter,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const serveRequest = {
        placementId: req.query.placementId as string,
        userId: req.query.userId as string || req.user?.userId,
        device: req.query.device as any,
        country: req.query.country as string,
        region: req.query.region as string,
        city: req.query.city as string,
        keywords: req.query.keywords
          ? (req.query.keywords as string).split(',')
          : undefined,
        sessionId: req.query.sessionId as string,
        pageUrl: req.query.pageUrl as string,
        userAgent: req.query.userAgent as string,
        ip: req.ip,
        latitude: req.query.latitude ? parseFloat(req.query.latitude as string) : undefined,
        longitude: req.query.longitude ? parseFloat(req.query.longitude as string) : undefined,
      };

      const validatedData = ServeAdRequestSchema.parse(serveRequest);

      const adServer = getAdServer(
        req.app.locals.redis,
        req.app.locals.bidEngine,
        req.app.locals.fraudDetection
      );

      const decision = await adServer.serveAd(validatedData);

      if (!decision) {
        res.status(204).send();
        return;
      }

      res.json({
        adId: decision.adId,
        campaignId: decision.campaignId,
        creative: {
          type: decision.ad.type,
          headline: decision.creative.headline,
          description: decision.creative.description,
          imageUrl: decision.creative.imageUrl,
          videoUrl: decision.creative.videoUrl,
          callToAction: decision.creative.callToAction,
          ctaText: decision.creative.ctaText,
        },
        tracking: {
          impressionUrl: decision.impressionUrl,
          clickUrl: decision.clickUrl,
          viewUrl: decision.viewUrl,
        },
        bid: {
          amount: decision.bid.bidAmount,
          type: decision.bid.bidType,
        },
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

// Get available ads for a placement (for preview)
router.get('/preview/:placementId',
  optionalAuthenticate,
  serveRateLimiter,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { placementId } = req.params;
      const { limit = '10' } = req.query;

      const { PlacementModel, CampaignModel, AdModel } = await import('../models/index.js');

      // Get placement
      const placement = await PlacementModel.findOne({ placementId });
      if (!placement) {
        res.status(404).json({
          error: 'Not Found',
          message: 'Placement not found',
        });
        return;
      }

      // Get eligible campaigns
      const campaigns = await CampaignModel.find({
        status: 'active',
        'budget.spent': { $lt: '$budget.total' },
      }).limit(parseInt(limit as string, 10));

      // Get ads for each campaign
      const availableAds = await Promise.all(
        campaigns.map(async (campaign) => {
          const ads = await AdModel.findActiveByCampaign(campaign.campaignId as string);
          return ads.map(ad => ({
            adId: ad.adId,
            campaignId: campaign.campaignId,
            campaignName: campaign.name,
            type: ad.type,
            headline: ad.creative.headline,
            description: ad.creative.description,
            imageUrl: ad.creative.imageUrl,
            bidAmount: campaign.bidStrategy.amount,
            bidType: campaign.bidStrategy.type,
          }));
        })
      );

      // Flatten and sort by bid
      const flatAds = availableAds
        .flat()
        .sort((a, b) => b.bidAmount - a.bidAmount);

      res.json({
        placementId,
        placementType: placement.type,
        dimensions: placement.dimensions,
        floorPrice: placement.floorPrice,
        availableAds: flatAds,
      });
    } catch (error) {
      next(error);
    }
  }
);

// Get serve statistics
router.get('/stats',
  optionalAuthenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { placementId } = req.query;
      const adServer = getAdServer(
        req.app.locals.redis,
        req.app.locals.bidEngine,
        req.app.locals.fraudDetection
      );

      const stats = await adServer.getServeStats(placementId as string);

      res.json(stats);
    } catch (error) {
      next(error);
    }
  }
);

// Health check for ad serving
router.get('/health',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const adServer = getAdServer(
        req.app.locals.redis,
        req.app.locals.bidEngine,
        req.app.locals.fraudDetection
      );

      const health = await adServer.healthCheck();

      res.status(health.healthy ? 200 : 503).json({
        status: health.healthy ? 'healthy' : 'unhealthy',
        latency: health.latency,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      res.status(503).json({
        status: 'unhealthy',
        error: 'Service unavailable',
        timestamp: new Date().toISOString(),
      });
    }
  }
);

export default router;
