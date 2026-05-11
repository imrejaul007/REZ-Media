/**
 * Lead Intelligence Service - Routes
 */

import { Router, Request, Response } from 'express';
import { body, param, query } from 'express-validator';
import { validationErrorHandler, asyncHandler } from '../middleware';
import { leadIntelligenceService } from '../services/LeadIntelligenceService';
import { AbandonedCart, CartItem } from '../types';

const router = Router();

// ============================================================================
// Lead Score Routes
// ============================================================================

/**
 * GET /api/v1/leads/:userId/score
 * Get lead score for a specific user
 */
router.get(
  '/leads/:userId/score',
  [
    param('userId').notEmpty().withMessage('User ID is required'),
    validationErrorHandler,
  ],
  asyncHandler(async (req: Request, res: Response) => {
    const { userId } = req.params;

    const leadScore = await leadIntelligenceService.getLeadScore(userId);

    res.json({
      success: true,
      data: leadScore,
    });
  })
);

/**
 * GET /api/v1/leads/hot
 * Get all hot leads
 */
router.get(
  '/leads/hot',
  [
    query('limit').optional().isInt({ min: 1, max: 1000 }).toInt(),
    query('offset').optional().isInt({ min: 0 }).toInt(),
    validationErrorHandler,
  ],
  asyncHandler(async (req: Request, res: Response) => {
    const limit = parseInt(req.query.limit as string) || 100;
    const offset = parseInt(req.query.offset as string) || 0;

    const leads = await leadIntelligenceService.detectHotLeads({ limit, offset });

    res.json({
      success: true,
      data: {
        leads,
        total: leads.length,
        page: Math.floor(offset / limit) + 1,
        pageSize: limit,
      },
    });
  })
);

/**
 * GET /api/v1/leads/warm
 * Get all warm leads
 */
router.get(
  '/leads/warm',
  [
    query('limit').optional().isInt({ min: 1, max: 1000 }).toInt(),
    query('offset').optional().isInt({ min: 0 }).toInt(),
    validationErrorHandler,
  ],
  asyncHandler(async (req: Request, res: Response) => {
    const limit = parseInt(req.query.limit as string) || 100;
    const offset = parseInt(req.query.offset as string) || 0;

    const leads = await leadIntelligenceService.detectWarmLeads({ limit, offset });

    res.json({
      success: true,
      data: {
        leads,
        total: leads.length,
        page: Math.floor(offset / limit) + 1,
        pageSize: limit,
      },
    });
  })
);

/**
 * GET /api/v1/leads/cold
 * Get all cold leads
 */
router.get(
  '/leads/cold',
  [
    query('limit').optional().isInt({ min: 1, max: 1000 }).toInt(),
    query('offset').optional().isInt({ min: 0 }).toInt(),
    validationErrorHandler,
  ],
  asyncHandler(async (req: Request, res: Response) => {
    const limit = parseInt(req.query.limit as string) || 100;
    const offset = parseInt(req.query.offset as string) || 0;

    const leads = await leadIntelligenceService.detectColdLeads({ limit, offset });

    res.json({
      success: true,
      data: {
        leads,
        total: leads.length,
        page: Math.floor(offset / limit) + 1,
        pageSize: limit,
      },
    });
  })
);

// ============================================================================
// Abandoned Cart Routes
// ============================================================================

/**
 * POST /api/v1/carts
 * Track an abandoned cart
 */
router.post(
  '/carts',
  [
    body('userId').notEmpty().withMessage('User ID is required'),
    body('cartId').notEmpty().withMessage('Cart ID is required'),
    body('items').isArray({ min: 1 }).withMessage('Items array is required'),
    body('items.*.productId').notEmpty().withMessage('Product ID is required'),
    body('items.*.price').isFloat({ min: 0 }).withMessage('Price must be a positive number'),
    body('totalValue').isFloat({ min: 0 }).withMessage('Total value must be a positive number'),
    validationErrorHandler,
  ],
  asyncHandler(async (req: Request, res: Response) => {
    const { userId, cartId, items, totalValue } = req.body;

    const abandonedCart = await leadIntelligenceService.trackAbandonedCart(
      userId,
      cartId,
      items,
      totalValue
    );

    res.status(201).json({
      success: true,
      data: abandonedCart,
    });
  })
);

/**
 * GET /api/v1/carts/user/:userId
 * Get abandoned carts for a user
 */
router.get(
  '/carts/user/:userId',
  [
    param('userId').notEmpty().withMessage('User ID is required'),
    validationErrorHandler,
  ],
  asyncHandler(async (req: Request, res: Response) => {
    const { userId } = req.params;

    const carts = await leadIntelligenceService.getAbandonedCarts(userId);

    res.json({
      success: true,
      data: carts,
    });
  })
);

/**
 * POST /api/v1/carts/:cartId/recovered
 * Mark a cart as recovered
 */
router.post(
  '/carts/:cartId/recovered',
  [
    param('cartId').notEmpty().withMessage('Cart ID is required'),
    validationErrorHandler,
  ],
  asyncHandler(async (req: Request, res: Response) => {
    const { cartId } = req.params;

    await leadIntelligenceService.markCartRecovered(cartId);

    res.json({
      success: true,
      message: 'Cart marked as recovered',
    });
  })
);

// ============================================================================
// Abandoned Search Routes
// ============================================================================

/**
 * POST /api/v1/searches
 * Track an abandoned search
 */
router.post(
  '/searches',
  [
    body('userId').notEmpty().withMessage('User ID is required'),
    body('query').notEmpty().withMessage('Search query is required'),
    body('resultsShown').isArray().withMessage('Results shown must be an array'),
    body('notClicked').isArray().withMessage('Not clicked must be an array'),
    validationErrorHandler,
  ],
  asyncHandler(async (req: Request, res: Response) => {
    const { userId, query, resultsShown, notClicked, intentDetected, urgencyLevel } = req.body;

    const abandonedSearch = await leadIntelligenceService.trackAbandonedSearch(
      userId,
      query,
      resultsShown,
      notClicked,
      intentDetected || '',
      urgencyLevel || 'low'
    );

    res.status(201).json({
      success: true,
      data: abandonedSearch,
    });
  })
);

/**
 * GET /api/v1/searches/user/:userId
 * Get abandoned searches for a user
 */
router.get(
  '/searches/user/:userId',
  [
    param('userId').notEmpty().withMessage('User ID is required'),
    validationErrorHandler,
  ],
  asyncHandler(async (req: Request, res: Response) => {
    const { userId } = req.params;

    const searches = await leadIntelligenceService.getAbandonedSearches(userId);

    res.json({
      success: true,
      data: searches,
    });
  })
);

// ============================================================================
// Channel Routes
// ============================================================================

/**
 * GET /api/v1/channels/:userId/recommend
 * Get recommended channel for a user
 */
router.get(
  '/channels/:userId/recommend',
  [
    param('userId').notEmpty().withMessage('User ID is required'),
    validationErrorHandler,
  ],
  asyncHandler(async (req: Request, res: Response) => {
    const { userId } = req.params;

    const channel = await leadIntelligenceService.getRecommendedChannel(userId);

    res.json({
      success: true,
      data: { channel },
    });
  })
);

/**
 * GET /api/v1/channels/:userId/scores
 * Get channel scores for a user
 */
router.get(
  '/channels/:userId/scores',
  [
    param('userId').notEmpty().withMessage('User ID is required'),
    validationErrorHandler,
  ],
  asyncHandler(async (req: Request, res: Response) => {
    const { userId } = req.params;

    const scores = await leadIntelligenceService.getChannelScores(userId);

    res.json({
      success: true,
      data: scores,
    });
  })
);

// ============================================================================
// Re-Engagement Routes
// ============================================================================

/**
 * POST /api/v1/re-engage/:userId
 * Trigger re-engagement for a user
 */
router.post(
  '/re-engage/:userId',
  [
    param('userId').notEmpty().withMessage('User ID is required'),
    validationErrorHandler,
  ],
  asyncHandler(async (req: Request, res: Response) => {
    const { userId } = req.params;

    const result = await leadIntelligenceService.triggerReEngagement(userId);

    res.json({
      success: true,
      data: result,
    });
  })
);

/**
 * POST /api/v1/re-engage/batch/hot
 * Process all hot leads for re-engagement
 */
router.post(
  '/re-engage/batch/hot',
  asyncHandler(async (req: Request, res: Response) => {
    const result = await leadIntelligenceService.processHotLeadsBatch();

    res.json({
      success: true,
      data: result,
    });
  })
);

/**
 * POST /api/v1/re-engage/batch/carts
 * Process abandoned carts for recovery
 */
router.post(
  '/re-engage/batch/carts',
  asyncHandler(async (req: Request, res: Response) => {
    const result = await leadIntelligenceService.processAbandonedCartsBatch();

    res.json({
      success: true,
      data: result,
    });
  })
);

// ============================================================================
// Activity Tracking Routes
// ============================================================================

/**
 * POST /api/v1/activity
 * Track user activity
 */
router.post(
  '/activity',
  [
    body('userId').notEmpty().withMessage('User ID is required'),
    body('activityType').isIn(['search', 'view', 'cart']).withMessage('Invalid activity type'),
    validationErrorHandler,
  ],
  asyncHandler(async (req: Request, res: Response) => {
    const { userId, activityType, ...data } = req.body;

    await leadIntelligenceService.trackUserActivity(userId, activityType, data);

    res.status(201).json({
      success: true,
      message: 'Activity tracked',
    });
  })
);

export default router;
