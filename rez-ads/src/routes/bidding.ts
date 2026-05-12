import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { BidEngine } from '../services/bidEngine.js';
import { getBidEngine } from '../services/index.js';
import { authenticate } from '../middleware/auth.js';
import { createCampaignRateLimiter } from '../middleware/rateLimit.js';
import { BidStrategy } from '../types/index.js';

const router = Router();
const rateLimiter = createCampaignRateLimiter();

// Validation schemas
const SetBidSchema = z.object({
  campaignId: z.string().min(1),
  bidType: z.nativeEnum(BidStrategy),
  amount: z.number().min(0.01),
  maxBid: z.number().min(0.01).optional(),
});

const EstimateBidSchema = z.object({
  placementId: z.string().min(1),
  targeting: z.object({
    country: z.string().optional(),
    region: z.string().optional(),
    city: z.string().optional(),
    device: z.string().optional(),
    keywords: z.array(z.string()).optional(),
  }).optional(),
});

// Set bid strategy for a campaign
router.post('/set',
  authenticate,
  rateLimiter,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const validatedData = SetBidSchema.parse(req.body);
      const { CampaignModel } = await import('../models/index.js');

      const campaign = await CampaignModel.findOne({ campaignId: validatedData.campaignId });

      if (!campaign) {
        res.status(404).json({
          error: 'Not Found',
          message: 'Campaign not found',
        });
        return;
      }

      // Check ownership
      if (
        req.user?.role === 'advertiser' &&
        req.user.advertiserId !== campaign.advertiserId
      ) {
        res.status(403).json({
          error: 'Forbidden',
          message: 'Access denied',
        });
        return;
      }

      // Update bid strategy
      campaign.bidStrategy = {
        type: validatedData.bidType,
        amount: validatedData.amount,
        maxBid: validatedData.maxBid,
      };

      await campaign.save();

      res.json({
        message: 'Bid strategy updated successfully',
        bidStrategy: campaign.bidStrategy,
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

// Get bid estimates for a placement
router.post('/estimate',
  authenticate,
  rateLimiter,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const validatedData = EstimateBidSchema.parse(req.body);
      const bidEngine = getBidEngine(req.app.locals.redis);

      // Get placement info
      const { PlacementModel } = await import('../models/index.js');
      const placement = await PlacementModel.findOne({ placementId: validatedData.placementId });

      if (!placement) {
        res.status(404).json({
          error: 'Not Found',
          message: 'Placement not found',
        });
        return;
      }

      // Get active campaigns for this placement
      const { CampaignModel, AdModel } = await import('../models/index.js');
      const campaigns = await CampaignModel.find({ status: 'active' }).limit(50);

      // Calculate estimates for each campaign
      const estimates = await Promise.all(
        campaigns.map(async (campaign) => {
          const ads = await AdModel.findActiveByCampaign(campaign.campaignId as string);
          if (ads.length === 0) return null;

          const estimatedCPC = await bidEngine.estimateCPC(campaign.campaignId);

          return {
            campaignId: campaign.campaignId,
            campaignName: campaign.name,
            bidType: campaign.bidStrategy.type,
            currentBid: campaign.bidStrategy.amount,
            estimatedCPC,
            estimatedCPM: campaign.bidStrategy.type === BidStrategy.CPM
              ? campaign.bidStrategy.amount
              : estimatedCPC * 1000,
            adCount: ads.length,
          };
        })
      );

      // Filter and sort by estimated CPM (highest first)
      const validEstimates = estimates
        .filter(Boolean)
        .sort((a, b) => (b?.estimatedCPM || 0) - (a?.estimatedCPM || 0));

      res.json({
        placementId: validatedData.placementId,
        floorPrice: placement.floorPrice,
        competitors: validEstimates.slice(0, 10),
        marketAverage: validEstimates.length > 0
          ? validEstimates.reduce((sum, e) => sum + (e?.estimatedCPM || 0), 0) / validEstimates.length
          : placement.floorPrice,
      });
    } catch (error) {
      next(error);
    }
  }
);

// Get bid statistics for a campaign
router.get('/stats/:campaignId',
  authenticate,
  rateLimiter,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { campaignId } = req.params;
      const bidEngine = getBidEngine(req.app.locals.redis);

      const stats = await bidEngine.getBidStats(campaignId);

      res.json({
        campaignId,
        ...stats,
      });
    } catch (error) {
      next(error);
    }
  }
);

// Get current bid position for a campaign
router.get('/position/:campaignId',
  authenticate,
  rateLimiter,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { campaignId } = req.params;
      const { placementId } = req.query;
      const bidEngine = getBidEngine(req.app.locals.redis);

      const stats = await bidEngine.getBidStats(campaignId);

      // Calculate position based on win rate and bid amount
      const position = stats.winRate > 50 ? 1 : stats.winRate > 20 ? 2 : stats.winRate > 10 ? 3 : 4;

      res.json({
        campaignId,
        placementId: placementId || 'all',
        position,
        winRate: stats.winRate,
        averageBid: stats.averageBid,
        totalAuctions: stats.totalAuctions,
      });
    } catch (error) {
      next(error);
    }
  }
);

// Adjust bid based on performance
router.post('/optimize/:campaignId',
  authenticate,
  rateLimiter,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { campaignId } = req.params;
      const { targetCPC, targetCPM, targetCTR } = req.body;

      const { CampaignModel } = await import('../models/index.js');
      const campaign = await CampaignModel.findOne({ campaignId });

      if (!campaign) {
        res.status(404).json({
          error: 'Not Found',
          message: 'Campaign not found',
        });
        return;
      }

      // Check ownership
      if (
        req.user?.role === 'advertiser' &&
        req.user.advertiserId !== campaign.advertiserId
      ) {
        res.status(403).json({
          error: 'Forbidden',
          message: 'Access denied',
        });
        return;
      }

      // Calculate optimal bid based on target
      let optimalBid = campaign.bidStrategy.amount;

      if (campaign.statistics.impressions > 100) {
        if (targetCPC && campaign.bidStrategy.type === BidStrategy.CPC) {
          // Adjust bid towards target CPC
          const currentCPC = campaign.statistics.cpc || campaign.bidStrategy.amount;
          optimalBid = currentCPC * 0.9 + targetCPC * 0.1;
        } else if (targetCPM && campaign.bidStrategy.type === BidStrategy.CPM) {
          // Adjust bid towards target CPM
          const currentCPM = campaign.statistics.cpm || campaign.bidStrategy.amount;
          optimalBid = currentCPM * 0.9 + targetCPM * 0.1;
        } else if (targetCTR) {
          // Estimate CPC from target CTR
          const targetCPCEst = (campaign.bidStrategy.amount / (targetCTR / 100)) / 1000;
          optimalBid = targetCPCEst;
        }
      }

      // Apply boundaries
      const minBid = parseFloat(process.env.MIN_BID_CPM || '0.01');
      const maxBid = parseFloat(process.env.MAX_BID_CPM || '10.00');
      optimalBid = Math.max(minBid, Math.min(maxBid, optimalBid));

      res.json({
        campaignId,
        currentBid: campaign.bidStrategy.amount,
        suggestedBid: Math.round(optimalBid * 100) / 100,
        reason: 'Based on target and current performance',
      });
    } catch (error) {
      next(error);
    }
  }
);

// Preview auction for a placement
router.post('/preview',
  authenticate,
  rateLimiter,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const {
        placementId,
        targeting = {},
        count = 5,
      } = req.body;

      const bidEngine = getBidEngine(req.app.locals.redis);

      // Get placement
      const { PlacementModel } = await import('../models/index.js');
      const placement = await PlacementModel.findOne({ placementId });

      if (!placement) {
        res.status(404).json({
          error: 'Not Found',
          message: 'Placement not found',
        });
        return;
      }

      // Get top bidders
      const { CampaignModel, AdModel } = await import('../models/index.js');
      const campaigns = await CampaignModel.find({ status: 'active' })
        .sort({ 'budget.spent': -1 })
        .limit(count);

      const topBidders = await Promise.all(
        campaigns.map(async (campaign) => {
          const ads = await AdModel.findActiveByCampaign(campaign.campaignId as string);
          const estimatedCPC = await bidEngine.estimateCPC(campaign.campaignId);

          return {
            campaignId: campaign.campaignId,
            campaignName: campaign.name,
            advertiserId: campaign.advertiserId,
            bidAmount: campaign.bidStrategy.amount,
            bidType: campaign.bidStrategy.type,
            estimatedCPC,
            estimatedPosition: campaigns.indexOf(campaign) + 1,
            adCount: ads.length,
            budget: {
              total: campaign.budget.total,
              spent: campaign.budget.spent,
              remaining: campaign.budget.total - campaign.budget.spent,
            },
          };
        })
      );

      res.json({
        placement: {
          placementId: placement.placementId,
          name: placement.name,
          type: placement.type,
          dimensions: placement.dimensions,
          floorPrice: placement.floorPrice,
        },
        marketData: {
          totalActiveBidders: topBidders.length,
          floorPrice: placement.floorPrice,
          averageBid: topBidders.length > 0
            ? topBidders.reduce((sum, b) => sum + b.bidAmount, 0) / topBidders.length
            : 0,
        },
        topBidders,
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
