import { Router, Request, Response } from 'express';
import { z } from 'zod';
import * as paymentRouter from '../services/paymentRouter';
import { requireAuth, optionalAuth } from '../middleware/auth';

const router = Router();

// Zod schemas
const PaymentRouteSchema = z.object({
  amount: z.number().positive(),
  preferredMethod: z.enum(['UPI', 'CARD', 'NETBANKING', 'WALLET', 'COD']).optional(),
});

const CODCheckSchema = z.object({
  amount: z.number().positive(),
  location: z.object({
    city: z.string(),
    state: z.string(),
  }).optional(),
});

/**
 * POST /payment/route
 * Get smart payment routing
 */
router.post('/route', optionalAuth, async (req: Request, res: Response) => {
  try {
    const validation = PaymentRouteSchema.safeParse(req.body);

    if (!validation.success) {
      res.status(400).json({
        success: false,
        error: 'Invalid input',
        code: 'VALIDATION_ERROR',
        details: validation.error.errors,
      });
      return;
    }

    const routing = await paymentRouter.routePayment({
      amount: validation.data.amount,
      userId: req.userId,
      sessionId: req.sessionId,
      preferredMethod: validation.data.preferredMethod,
      isGuest: req.isGuest,
    });

    res.json({
      success: true,
      ...routing,
    });
  } catch (error) {
    console.error('Payment routing error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to route payment',
    });
  }
});

/**
 * GET /payment/methods
 * Get available payment methods
 */
router.get('/methods', optionalAuth, async (req: Request, res: Response) => {
  try {
    const amount = parseFloat(req.query.amount as string) || 0;

    const methods = await paymentRouter.getAvailablePaymentMethods(
      amount,
      req.userId,
      req.isGuest
    );

    res.json({
      success: true,
      methods,
    });
  } catch (error) {
    console.error('Get payment methods error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

/**
 * GET /payment/methods/:method/eligibility
 * Check eligibility for a specific payment method
 */
router.get('/methods/:method/eligibility', optionalAuth, async (req: Request, res: Response) => {
  try {
    const method = req.params.method.toUpperCase();
    const amount = parseFloat(req.query.amount as string) || 0;

    if (!['UPI', 'CARD', 'NETBANKING', 'WALLET', 'COD'].includes(method)) {
      res.status(400).json({
        success: false,
        error: 'Invalid payment method',
      });
      return;
    }

    if (method === 'COD') {
      const result = await paymentRouter.checkCODEligibility(
        amount,
        req.userId,
        req.body.location
      );

      res.json({
        success: true,
        eligible: result.eligible,
        reason: result.reason,
        maxAmount: result.maxAmount,
      });
      return;
    }

    // Other methods are generally available if they pass basic checks
    res.json({
      success: true,
      eligible: true,
    });
  } catch (error) {
    console.error('Check eligibility error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

/**
 * POST /payment/cod/check
 * Check COD eligibility
 */
router.post('/cod/check', optionalAuth, async (req: Request, res: Response) => {
  try {
    const validation = CODCheckSchema.safeParse(req.body);

    if (!validation.success) {
      res.status(400).json({
        success: false,
        error: 'Invalid input',
        code: 'VALIDATION_ERROR',
        details: validation.error.errors,
      });
      return;
    }

    const result = await paymentRouter.checkCODEligibility(
      validation.data.amount,
      req.userId,
      validation.data.location
    );

    res.json({
      success: true,
      eligible: result.eligible,
      reason: result.reason,
      maxAmount: result.maxAmount,
    });
  } catch (error) {
    console.error('COD eligibility check error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

/**
 * POST /payment/preferred
 * Set preferred payment method
 */
router.post('/preferred', requireAuth, async (req: Request, res: Response) => {
  try {
    const { method } = req.body;

    if (!['UPI', 'CARD', 'NETBANKING', 'WALLET', 'COD'].includes(method)) {
      res.status(400).json({
        success: false,
        error: 'Invalid payment method',
      });
      return;
    }

    await paymentRouter.setPreferredPaymentMethod(req.userId!, method);

    res.json({
      success: true,
      message: 'Preferred payment method updated',
      method,
    });
  } catch (error) {
    console.error('Set preferred method error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

/**
 * GET /payment/preferred
 * Get preferred payment method
 */
router.get('/preferred', requireAuth, async (req: Request, res: Response) => {
  try {
    const method = await paymentRouter.getPreferredPaymentMethod(req.userId!);

    res.json({
      success: true,
      method: method || null,
    });
  } catch (error) {
    console.error('Get preferred method error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

/**
 * POST /payment/validate
 * Validate payment completion
 */
router.post('/validate', async (req: Request, res: Response) => {
  try {
    const { transactionId, expectedAmount } = req.body;

    if (!transactionId || !expectedAmount) {
      res.status(400).json({
        success: false,
        error: 'transactionId and expectedAmount are required',
      });
      return;
    }

    const result = await paymentRouter.validatePaymentCompletion(
      transactionId,
      expectedAmount
    );

    if (!result.valid) {
      res.status(400).json({
        success: false,
        error: result.error,
      });
      return;
    }

    res.json({
      success: true,
      valid: true,
      status: result.status,
    });
  } catch (error) {
    console.error('Validate payment error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

/**
 * POST /payment/refund
 * Process refund
 */
router.post('/refund', requireAuth, async (req: Request, res: Response) => {
  try {
    const { transactionId, amount, reason } = req.body;

    if (!transactionId || !amount) {
      res.status(400).json({
        success: false,
        error: 'transactionId and amount are required',
      });
      return;
    }

    const result = await paymentRouter.processRefund(transactionId, amount, reason);

    if (!result.success) {
      res.status(400).json({
        success: false,
        error: result.error,
      });
      return;
    }

    res.json({
      success: true,
      refundId: result.refundId,
    });
  } catch (error) {
    console.error('Process refund error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

export default router;
