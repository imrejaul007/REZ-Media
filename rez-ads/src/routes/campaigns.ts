import { Router, Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import { CampaignModel, AdModel } from '../models/index.js';
import { authenticate, authorizeAdvertiser } from '../middleware/auth.js';
import { createCampaignRateLimiter } from '../middleware/rateLimit.js';
import { CreateCampaignSchema, CampaignStatus, BidStrategy } from '../types/index.js';

const router = Router();
const rateLimiter = createCampaignRateLimiter();

// Validation schemas
const UpdateCampaignSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  status: z.nativeEnum(CampaignStatus).optional(),
  budget: z.object({
    daily: z.number().min(0).optional(),
    total: z.number().min(0),
    currency: z.string().optional(),
  }).optional(),
  bidStrategy: z.object({
    type: z.nativeEnum(BidStrategy),
    amount: z.number().min(0.01),
    maxBid: z.number().min(0.01).optional(),
  }).optional(),
  targeting: z.any().optional(),
});

// List campaigns
router.get('/',
  authenticate,
  rateLimiter,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const {
        page = '1',
        limit = '20',
        status,
        objective,
        sortBy = 'createdAt',
        sortOrder = 'desc',
      } = req.query;

      const pageNum = parseInt(page as string, 10);
      const limitNum = Math.min(parseInt(limit as string, 10), 100);
      const skip = (pageNum - 1) * limitNum;

      // Build query
      const query: any = {};

      // Advertisers can only see their own campaigns
      if (req.user?.role === 'advertiser' && req.user.advertiserId) {
        query.advertiserId = req.user.advertiserId;
      }

      if (status) {
        query.status = status;
      }

      if (objective) {
        query.objective = objective;
      }

      // Execute query
      const [campaigns, total] = await Promise.all([
        CampaignModel.find(query)
          .sort({ [sortBy as string]: sortOrder === 'desc' ? -1 : 1 })
          .skip(skip)
          .limit(limitNum)
          .lean(),
        CampaignModel.countDocuments(query),
      ]);

      res.json({
        data: campaigns,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum),
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// Get campaign by ID
router.get('/:campaignId',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { campaignId } = req.params;

      const campaign = await CampaignModel.findOne({ campaignId }).lean();

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

      // Get ads for this campaign
      const ads = await AdModel.find({ campaignId }).lean();

      res.json({
        ...campaign,
        ads,
      });
    } catch (error) {
      next(error);
    }
  }
);

// Create campaign
router.post('/',
  authenticate,
  authorizeAdvertiser,
  rateLimiter,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const validatedData = CreateCampaignSchema.parse(req.body);

      // Generate campaign ID
      const campaignId = `cmp_${uuidv4().replace(/-/g, '').substring(0, 16)}`;

      // Create campaign
      const campaign = new CampaignModel({
        campaignId,
        advertiserId: req.user?.advertiserId || validatedData.advertiserId,
        name: validatedData.name,
        objective: validatedData.objective,
        status: validatedData.status || CampaignStatus.DRAFT,
        budget: {
          daily: validatedData.budget.daily || 0,
          total: validatedData.budget.total,
          spent: 0,
          currency: validatedData.budget.currency || 'USD',
        },
        bidStrategy: {
          type: validatedData.bidStrategy.type,
          amount: validatedData.bidStrategy.amount,
          maxBid: validatedData.bidStrategy.maxBid,
        },
        targeting: validatedData.targeting,
        adIds: validatedData.adIds || [],
        statistics: {
          impressions: 0,
          clicks: 0,
          conversions: 0,
          spend: 0,
          ctr: 0,
          cpc: 0,
          cpm: 0,
        },
      });

      await campaign.save();

      res.status(201).json({
        message: 'Campaign created successfully',
        campaign,
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

// Update campaign
router.patch('/:campaignId',
  authenticate,
  authorizeAdvertiser,
  rateLimiter,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { campaignId } = req.params;
      const validatedData = UpdateCampaignSchema.parse(req.body);

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

      // Validate status transition
      if (validatedData.status && validatedData.status !== campaign.status) {
        if (!campaign.canTransitionTo(validatedData.status)) {
          res.status(400).json({
            error: 'Invalid Transition',
            message: `Cannot transition from ${campaign.status} to ${validatedData.status}`,
          });
          return;
        }
      }

      // Update fields
      if (validatedData.name) campaign.name = validatedData.name;
      if (validatedData.status) campaign.status = validatedData.status;
      if (validatedData.budget) {
        campaign.budget = {
          ...campaign.budget,
          ...validatedData.budget,
        };
      }
      if (validatedData.bidStrategy) {
        campaign.bidStrategy = {
          ...campaign.bidStrategy,
          ...validatedData.bidStrategy,
        };
      }
      if (validatedData.targeting) {
        campaign.targeting = {
          ...campaign.targeting,
          ...validatedData.targeting,
        };
      }

      await campaign.save();

      res.json({
        message: 'Campaign updated successfully',
        campaign,
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

// Delete campaign
router.delete('/:campaignId',
  authenticate,
  authorizeAdvertiser,
  rateLimiter,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { campaignId } = req.params;

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

      // Can only delete draft or completed campaigns
      if (
        campaign.status !== CampaignStatus.DRAFT &&
        campaign.status !== CampaignStatus.COMPLETED
      ) {
        res.status(400).json({
          error: 'Invalid Operation',
          message: 'Can only delete draft or completed campaigns',
        });
        return;
      }

      // Delete associated ads
      await AdModel.deleteMany({ campaignId });

      // Delete campaign
      await CampaignModel.deleteOne({ campaignId });

      res.json({
        message: 'Campaign deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  }
);

// Pause campaign
router.post('/:campaignId/pause',
  authenticate,
  authorizeAdvertiser,
  rateLimiter,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { campaignId } = req.params;

      const campaign = await CampaignModel.findOne({ campaignId });

      if (!campaign) {
        res.status(404).json({
          error: 'Not Found',
          message: 'Campaign not found',
        });
        return;
      }

      if (!campaign.canTransitionTo(CampaignStatus.PAUSED)) {
        res.status(400).json({
          error: 'Invalid Transition',
          message: `Cannot pause campaign in ${campaign.status} status`,
        });
        return;
      }

      campaign.status = CampaignStatus.PAUSED;
      await campaign.save();

      res.json({
        message: 'Campaign paused successfully',
        campaign,
      });
    } catch (error) {
      next(error);
    }
  }
);

// Resume campaign
router.post('/:campaignId/resume',
  authenticate,
  authorizeAdvertiser,
  rateLimiter,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { campaignId } = req.params;

      const campaign = await CampaignModel.findOne({ campaignId });

      if (!campaign) {
        res.status(404).json({
          error: 'Not Found',
          message: 'Campaign not found',
        });
        return;
      }

      if (!campaign.canTransitionTo(CampaignStatus.ACTIVE)) {
        res.status(400).json({
          error: 'Invalid Transition',
          message: `Cannot resume campaign in ${campaign.status} status`,
        });
        return;
      }

      // Check if campaign has ads
      const adCount = await AdModel.countDocuments({ campaignId });
      if (adCount === 0) {
        res.status(400).json({
          error: 'No Ads',
          message: 'Cannot activate campaign without ads',
        });
        return;
      }

      campaign.status = CampaignStatus.ACTIVE;
      await campaign.save();

      res.json({
        message: 'Campaign activated successfully',
        campaign,
      });
    } catch (error) {
      next(error);
    }
  }
);

// Get campaign statistics
router.get('/:campaignId/stats',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { campaignId } = req.params;
      const { startDate, endDate } = req.query;

      const campaign = await CampaignModel.findOne({ campaignId }).lean();

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

      // Get daily stats from CampaignDailyStats model
      // For now, return aggregate statistics
      res.json({
        campaignId,
        current: campaign.statistics,
        budget: {
          total: campaign.budget.total,
          spent: campaign.budget.spent,
          remaining: campaign.budget.total - campaign.budget.spent,
          daily: campaign.budget.daily,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
