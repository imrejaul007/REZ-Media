import { Router, Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import { PlacementModel, SiteModel } from '../models/index.js';
import { authenticate, authorizePublisher } from '../middleware/auth.js';
import { createCampaignRateLimiter } from '../middleware/rateLimit.js';
import { CreatePlacementSchema, PlacementType } from '../types/index.js';

const router = Router();
const rateLimiter = createCampaignRateLimiter();

// Validation schemas
const UpdatePlacementSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  floorPrice: z.number().min(0.01).optional(),
  status: z.enum(['active', 'paused', 'inactive']).optional(),
  allowedCategories: z.array(z.string()).optional(),
  blockedCategories: z.array(z.string()).optional(),
});

// List placements
router.get('/',
  authenticate,
  rateLimiter,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const {
        page = '1',
        limit = '20',
        siteId,
        type,
        status,
        sortBy = 'createdAt',
        sortOrder = 'desc',
      } = req.query;

      const pageNum = parseInt(page as string, 10);
      const limitNum = Math.min(parseInt(limit as string, 10), 100);
      const skip = (pageNum - 1) * limitNum;

      // Build query
      const query: any = {};

      // Publishers can only see their own placements
      if (req.user?.role === 'publisher' && req.user.publisherId) {
        query.publisherId = req.user.publisherId;
      }

      if (siteId) {
        query.siteId = siteId;
      }

      if (type) {
        query.type = type;
      }

      if (status) {
        query.status = status;
      }

      // Execute query
      const [placements, total] = await Promise.all([
        PlacementModel.find(query)
          .sort({ [sortBy as string]: sortOrder === 'desc' ? -1 : 1 })
          .skip(skip)
          .limit(limitNum)
          .lean(),
        PlacementModel.countDocuments(query),
      ]);

      res.json({
        data: placements,
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

// Get placement by ID
router.get('/:placementId',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { placementId } = req.params;

      const placement = await PlacementModel.findOne({ placementId }).lean();

      if (!placement) {
        res.status(404).json({
          error: 'Not Found',
          message: 'Placement not found',
        });
        return;
      }

      // Check ownership via site
      if (req.user?.role === 'publisher') {
        const site = await SiteModel.findOne({ siteId: placement.siteId });
        if (site && req.user.publisherId !== site.ownerId) {
          res.status(403).json({
            error: 'Forbidden',
            message: 'Access denied',
          });
          return;
        }
      }

      res.json(placement);
    } catch (error) {
      next(error);
    }
  }
);

// Create placement
router.post('/',
  authenticate,
  authorizePublisher,
  rateLimiter,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const validatedData = CreatePlacementSchema.parse(req.body);

      // Generate placement ID
      const placementId = `plc_${uuidv4().replace(/-/g, '').substring(0, 16)}`;

      // Create placement
      const placement = new PlacementModel({
        placementId,
        siteId: validatedData.siteId,
        name: validatedData.name,
        type: validatedData.type,
        dimensions: validatedData.dimensions,
        position: validatedData.position,
        floorPrice: validatedData.floorPrice,
        floorPriceHistory: [{
          price: validatedData.floorPrice,
          timestamp: new Date(),
        }],
        allowedCategories: validatedData.allowedCategories,
        blockedCategories: validatedData.blockedCategories,
        status: validatedData.status || 'active',
        stats: {
          impressions: 0,
          clicks: 0,
          revenue: 0,
        },
      });

      await placement.save();

      // Update site stats
      await SiteModel.findOneAndUpdate(
        { siteId: validatedData.siteId },
        {
          $inc: { 'stats.totalPlacements': 1, 'stats.activePlacements': 1 },
        }
      );

      res.status(201).json({
        message: 'Placement created successfully',
        placement,
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

// Update placement
router.patch('/:placementId',
  authenticate,
  authorizePublisher,
  rateLimiter,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { placementId } = req.params;
      const validatedData = UpdatePlacementSchema.parse(req.body);

      const placement = await PlacementModel.findOne({ placementId });

      if (!placement) {
        res.status(404).json({
          error: 'Not Found',
          message: 'Placement not found',
        });
        return;
      }

      // Check ownership via site
      const site = await SiteModel.findOne({ siteId: placement.siteId });
      if (site && req.user?.publisherId && site.ownerId !== req.user.publisherId) {
        res.status(403).json({
          error: 'Forbidden',
          message: 'Access denied',
        });
        return;
      }

      // Track floor price change
      if (validatedData.floorPrice && validatedData.floorPrice !== placement.floorPrice) {
        placement.floorPriceHistory.push({
          price: placement.floorPrice,
          timestamp: new Date(),
        });

        // Keep only last 100 price changes
        if (placement.floorPriceHistory.length > 100) {
          placement.floorPriceHistory = placement.floorPriceHistory.slice(-100);
        }
      }

      // Update fields
      if (validatedData.name) placement.name = validatedData.name;
      if (validatedData.floorPrice) placement.floorPrice = validatedData.floorPrice;
      if (validatedData.status) {
        const oldStatus = placement.status;
        placement.status = validatedData.status;

        // Update site active count
        if (oldStatus !== validatedData.status) {
          if (oldStatus === 'active' && validatedData.status !== 'active') {
            await SiteModel.findOneAndUpdate(
              { siteId: placement.siteId },
              { $inc: { 'stats.activePlacements': -1 } }
            );
          } else if (oldStatus !== 'active' && validatedData.status === 'active') {
            await SiteModel.findOneAndUpdate(
              { siteId: placement.siteId },
              { $inc: { 'stats.activePlacements': 1 } }
            );
          }
        }
      }
      if (validatedData.allowedCategories) placement.allowedCategories = validatedData.allowedCategories;
      if (validatedData.blockedCategories) placement.blockedCategories = validatedData.blockedCategories;

      await placement.save();

      res.json({
        message: 'Placement updated successfully',
        placement,
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

// Delete placement
router.delete('/:placementId',
  authenticate,
  authorizePublisher,
  rateLimiter,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { placementId } = req.params;

      const placement = await PlacementModel.findOne({ placementId });

      if (!placement) {
        res.status(404).json({
          error: 'Not Found',
          message: 'Placement not found',
        });
        return;
      }

      // Check ownership via site
      const site = await SiteModel.findOne({ siteId: placement.siteId });
      if (site && req.user?.publisherId && site.ownerId !== req.user.publisherId) {
        res.status(403).json({
          error: 'Forbidden',
          message: 'Access denied',
        });
        return;
      }

      // Update site stats
      if (placement.status === 'active') {
        await SiteModel.findOneAndUpdate(
          { siteId: placement.siteId },
          { $inc: { 'stats.activePlacements': -1 } }
        );
      }
      await SiteModel.findOneAndUpdate(
        { siteId: placement.siteId },
        { $inc: { 'stats.totalPlacements': -1 } }
      );

      // Delete placement
      await PlacementModel.deleteOne({ placementId });

      res.json({
        message: 'Placement deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  }
);

// Pause placement
router.post('/:placementId/pause',
  authenticate,
  authorizePublisher,
  rateLimiter,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { placementId } = req.params;

      const placement = await PlacementModel.findOne({ placementId });

      if (!placement) {
        res.status(404).json({
          error: 'Not Found',
          message: 'Placement not found',
        });
        return;
      }

      if (placement.status === 'active') {
        placement.status = 'paused';
        await placement.save();

        await SiteModel.findOneAndUpdate(
          { siteId: placement.siteId },
          { $inc: { 'stats.activePlacements': -1 } }
        );
      }

      res.json({
        message: 'Placement paused successfully',
        placement,
      });
    } catch (error) {
      next(error);
    }
  }
);

// Resume placement
router.post('/:placementId/resume',
  authenticate,
  authorizePublisher,
  rateLimiter,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { placementId } = req.params;

      const placement = await PlacementModel.findOne({ placementId });

      if (!placement) {
        res.status(404).json({
          error: 'Not Found',
          message: 'Placement not found',
        });
        return;
      }

      if (placement.status === 'paused') {
        placement.status = 'active';
        await placement.save();

        await SiteModel.findOneAndUpdate(
          { siteId: placement.siteId },
          { $inc: { 'stats.activePlacements': 1 } }
        );
      }

      res.json({
        message: 'Placement activated successfully',
        placement,
      });
    } catch (error) {
      next(error);
    }
  }
);

// Get placement statistics
router.get('/:placementId/stats',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { placementId } = req.params;
      const { startDate, endDate } = req.query;

      const placement = await PlacementModel.findOne({ placementId }).lean();

      if (!placement) {
        res.status(404).json({
          error: 'Not Found',
          message: 'Placement not found',
        });
        return;
      }

      res.json({
        placementId,
        stats: placement.stats,
        ctr: placement.stats.impressions > 0
          ? (placement.stats.clicks / placement.stats.impressions) * 100
          : 0,
        effectiveCpm: placement.stats.impressions > 0
          ? (placement.stats.revenue / placement.stats.impressions) * 1000
          : 0,
        floorPrice: placement.floorPrice,
        floorPriceHistory: placement.floorPriceHistory.slice(-10),
      });
    } catch (error) {
      next(error);
    }
  }
);

// Get placements by dimensions (for ad matching)
router.get('/dimensions/:width/:height',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { width, height } = req.params;
      const { status = 'active' } = req.query;

      const placements = await PlacementModel.findByDimensions(
        parseInt(width, 10),
        parseInt(height, 10)
      );

      res.json({
        data: placements.filter(p => status === 'any' || p.status === status),
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
