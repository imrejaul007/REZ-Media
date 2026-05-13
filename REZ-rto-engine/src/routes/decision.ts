import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { codDecisionService } from '../services/codDecision';
import { riskScoringService } from '../services/riskScoring';
import { OrderRisk } from '../models/OrderRisk';
import { logger } from '../config/logger';

const router = Router();

const DecisionRequestSchema = z.object({
  orderId: z.string().min(1, 'Order ID is required'),
  userId: z.string().min(1, 'User ID is required'),
  orderValue: z.number().positive('Order value is required'),
  codAmount: z.number().min(0, 'COD amount must be non-negative'),
});

const OverrideSchema = z.object({
  decision: z.enum(['APPROVED', 'BLOCKED', 'PARTIAL_ADVANCE', 'REVIEW']),
  reason: z.string().min(10, 'Override reason must be at least 10 characters'),
});

/**
 * POST /api/v1/decision
 * Get COD decision for an order
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    // Validate request
    const validationResult = DecisionRequestSchema.safeParse(req.body);

    if (!validationResult.success) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: validationResult.error.errors,
      });
    }

    const { orderId, userId, orderValue, codAmount } = validationResult.data;

    // Check for existing risk analysis
    let riskAnalysis = await riskScoringService.analyzeOrder({
      orderId,
      userId,
      orderValue,
      codAmount,
      itemCount: 1,
      itemCategories: [],
      shippingAddress: {
        pincode: '000000',
      },
      fingerprintData: {},
      userIp: req.ip || '127.0.0.1',
      userAgent: req.headers['user-agent'] || 'Unknown',
    });

    // Make decision
    const decision = await codDecisionService.makeDecision(
      {
        orderId,
        userId,
        orderValue,
        codAmount,
      },
      riskAnalysis
    );

    logger.info('COD decision generated', {
      orderId,
      userId,
      decision: decision.decision,
      riskScore: decision.riskScore,
    });

    return res.status(200).json({
      success: true,
      data: decision,
    });
  } catch (error) {
    logger.error('Error generating COD decision', {
      error: error instanceof Error ? error.message : 'Unknown error',
      orderId: req.body.orderId,
    });

    return res.status(500).json({
      success: false,
      error: 'Failed to generate COD decision',
    });
  }
});

/**
 * GET /api/v1/decision/:orderId
 * Get existing decision for an order
 */
router.get('/:orderId', async (req: Request, res: Response) => {
  try {
    const { orderId } = req.params;

    const decision = await codDecisionService.getDecision(orderId);

    if (!decision) {
      return res.status(404).json({
        success: false,
        error: 'Decision not found or expired',
      });
    }

    return res.status(200).json({
      success: true,
      data: decision,
    });
  } catch (error) {
    logger.error('Error fetching decision', {
      error: error instanceof Error ? error.message : 'Unknown error',
      orderId: req.params.orderId,
    });

    return res.status(500).json({
      success: false,
      error: 'Failed to fetch decision',
    });
  }
});

/**
 * POST /api/v1/decision/:orderId/override
 * Override COD decision (admin only)
 */
router.post('/:orderId/override', async (req: Request, res: Response) => {
  try {
    const { orderId } = req.params;

    // Validate request
    const validationResult = OverrideSchema.safeParse(req.body);

    if (!validationResult.success) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: validationResult.error.errors,
      });
    }

    const { decision, reason } = validationResult.data;

    const overrideResult = await codDecisionService.overrideDecision(
      orderId,
      decision,
      reason
    );

    if (!overrideResult) {
      return res.status(404).json({
        success: false,
        error: 'Order not found',
      });
    }

    logger.info('COD decision overridden', {
      orderId,
      newDecision: decision,
      reason,
    });

    return res.status(200).json({
      success: true,
      data: overrideResult,
    });
  } catch (error) {
    logger.error('Error overriding decision', {
      error: error instanceof Error ? error.message : 'Unknown error',
      orderId: req.params.orderId,
    });

    return res.status(500).json({
      success: false,
      error: 'Failed to override decision',
    });
  }
});

/**
 * GET /api/v1/decision/:orderId/expires
 * Check if decision has expired
 */
router.get('/:orderId/expires', async (req: Request, res: Response) => {
  try {
    const { orderId } = req.params;

    const orderRisk = await OrderRisk.findOne({ orderId });

    if (!orderRisk) {
      return res.status(404).json({
        success: false,
        error: 'Order not found',
      });
    }

    const now = new Date();
    const expiresAt = orderRisk.decisionExpiresAt;
    const isExpired = now > expiresAt;
    const remainingMs = expiresAt.getTime() - now.getTime();

    return res.status(200).json({
      success: true,
      data: {
        orderId,
        expiresAt,
        isExpired,
        remainingSeconds: Math.max(0, Math.floor(remainingMs / 1000)),
      },
    });
  } catch (error) {
    logger.error('Error checking decision expiry', {
      error: error instanceof Error ? error.message : 'Unknown error',
      orderId: req.params.orderId,
    });

    return res.status(500).json({
      success: false,
      error: 'Failed to check decision expiry',
    });
  }
});

export default router;
