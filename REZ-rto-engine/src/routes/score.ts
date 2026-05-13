import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { riskScoringService } from '../services/riskScoring';
import { logger } from '../config/logger';

const router = Router();

// Validation schema for score request
const ScoreRequestSchema = z.object({
  orderId: z.string().min(1, 'Order ID is required'),
  userId: z.string().min(1, 'User ID is required'),
  orderValue: z.number().positive('Order value must be positive'),
  codAmount: z.number().min(0, 'COD amount must be non-negative'),
  itemCount: z.number().int().positive('Item count must be a positive integer'),
  itemCategories: z.array(z.string()).optional().default([]),
  shippingAddress: z.object({
    fullAddress: z.string().optional(),
    street: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    pincode: z.string().regex(/^\d{6}$/, 'Pincode must be 6 digits'),
    country: z.string().optional().default('India'),
    landmark: z.string().optional(),
    latitude: z.number().optional(),
    longitude: z.number().optional(),
  }),
  billingAddress: z
    .object({
      fullAddress: z.string().optional(),
      street: z.string().optional(),
      city: z.string().optional(),
      state: z.string().optional(),
      pincode: z.string().regex(/^\d{6}$/, 'Pincode must be 6 digits'),
      country: z.string().optional(),
      landmark: z.string().optional(),
      latitude: z.number().optional(),
      longitude: z.number().optional(),
    })
    .optional(),
  fingerprintData: z
    .object({
      screenResolution: z.string().optional(),
      timezone: z.string().optional(),
      language: z.string().optional(),
      platform: z.string().optional(),
      canvasHash: z.string().optional(),
      webglHash: z.string().optional(),
      audioHash: z.string().optional(),
    })
    .optional()
    .default({}),
  orderHistory: z
    .object({
      totalOrders: z.number().optional().default(0),
      completedOrders: z.number().optional().default(0),
      returnedOrders: z.number().optional().default(0),
      codOrders: z.number().optional().default(0),
      avgOrderValue: z.number().optional().default(0),
      codReturnRate: z.number().optional().default(0),
    })
    .optional(),
});

/**
 * POST /api/v1/score
 * Get risk score for an order
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    // Validate request body
    const validationResult = ScoreRequestSchema.safeParse(req.body);

    if (!validationResult.success) {
      logger.warn('Invalid score request', {
        errors: validationResult.error.errors,
        ip: req.ip,
      });

      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: validationResult.error.errors,
      });
    }

    const requestData = validationResult.data;

    // Extract IP and User-Agent
    const userIp =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      req.ip ||
      '127.0.0.1';

    const userAgent = req.headers['user-agent'] || 'Unknown';

    // Build score request
    const scoreRequest = {
      orderId: requestData.orderId,
      userId: requestData.userId,
      orderValue: requestData.orderValue,
      codAmount: requestData.codAmount,
      itemCount: requestData.itemCount,
      itemCategories: requestData.itemCategories,
      shippingAddress: requestData.shippingAddress,
      billingAddress: requestData.billingAddress,
      fingerprintData: requestData.fingerprintData,
      userIp,
      userAgent,
      orderHistory: requestData.orderHistory,
    };

    // Analyze risk
    const riskResult = await riskScoringService.analyzeOrder(scoreRequest);

    logger.info('Risk score generated', {
      orderId: requestData.orderId,
      riskScore: riskResult.riskScore,
      riskTier: riskResult.riskTier,
    });

    return res.status(200).json({
      success: true,
      data: riskResult,
    });
  } catch (error) {
    logger.error('Error generating risk score', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      orderId: req.body.orderId,
    });

    return res.status(500).json({
      success: false,
      error: 'Failed to generate risk score',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/v1/score/:orderId
 * Get existing risk score for an order
 */
router.get('/:orderId', async (req: Request, res: Response) => {
  try {
    const { orderId } = req.params;

    const { OrderRisk } = await import('../models/OrderRisk');
    const orderRisk = await OrderRisk.findOne({ orderId });

    if (!orderRisk) {
      return res.status(404).json({
        success: false,
        error: 'Order risk analysis not found',
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        orderId: orderRisk.orderId,
        userId: orderRisk.userId,
        riskScore: orderRisk.riskScore,
        riskTier: orderRisk.riskTier,
        deviceScore: orderRisk.deviceScore,
        addressScore: orderRisk.addressScore,
        behaviorScore: orderRisk.behaviorScore,
        orderScore: orderRisk.orderScore,
        fraudSignals: orderRisk.fraudSignals,
        analyzedAt: orderRisk.analyzedAt,
        decisionExpiresAt: orderRisk.decisionExpiresAt,
      },
    });
  } catch (error) {
    logger.error('Error fetching risk score', {
      error: error instanceof Error ? error.message : 'Unknown error',
      orderId: req.params.orderId,
    });

    return res.status(500).json({
      success: false,
      error: 'Failed to fetch risk score',
    });
  }
});

export default router;
