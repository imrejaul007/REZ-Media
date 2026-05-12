import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { paymentService } from '../services/paymentService';
import { verifyRazorpayWebhook, verifyToken, authenticateCustomer, authenticateInternalService } from '../middleware/auth';

const router = Router();

// Validation schemas
const initiatePaymentSchema = z.object({
  orderId: z.string().min(1),
});

const verifyPaymentSchema = z.object({
  orderId: z.string().min(1),
  razorpayOrderId: z.string().min(1),
  razorpayPaymentId: z.string().min(1),
  razorpaySignature: z.string().min(1),
});

const createRefundSchema = z.object({
  amount: z.number().positive().optional(),
  speed: z.enum(['normal', 'optimum']).optional(),
  notes: z.record(z.string()).optional(),
});

const getPaymentMethodsSchema = z.object({
  amount: z.number().positive(),
});

/**
 * POST /api/payments/initiate
 * Initiate payment for an order
 */
router.post(
  '/initiate',
  authenticateCustomer,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const bodyResult = initiatePaymentSchema.safeParse(req.body);

      if (!bodyResult.success) {
        res.status(400).json({
          success: false,
          error: 'Invalid request body',
          details: bodyResult.error.issues,
        });
        return;
      }

      const result = await paymentService.initiateRazorpayPayment({
        orderId: bodyResult.data.orderId,
        customerId: req.customerId!,
        customerPhone: req.customerPhone!,
        amount: parseFloat(req.body.amount) || 0,
        notes: req.body.notes,
      });

      if (!result.success) {
        res.status(400).json({
          success: false,
          error: result.error,
        });
        return;
      }

      res.json({
        success: true,
        data: {
          razorpayOrderId: result.razorpayOrderId,
          amount: result.amount,
          currency: result.currency,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/payments/verify
 * Verify payment signature
 */
router.post(
  '/verify',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const bodyResult = verifyPaymentSchema.safeParse(req.body);

      if (!bodyResult.success) {
        res.status(400).json({
          success: false,
          error: 'Invalid request body',
          details: bodyResult.error.issues,
        });
        return;
      }

      const result = await paymentService.verifyPayment(bodyResult.data);

      if (!result.success) {
        res.status(400).json({
          success: false,
          error: result.error,
        });
        return;
      }

      res.json({
        success: true,
        message: 'Payment verified successfully',
        data: {
          orderId: result.order?.orderId,
          orderNumber: result.order?.orderNumber,
          status: result.order?.status,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/payments/verify-webhook
 * Verify payment from client after webhook
 */
router.post(
  '/verify-webhook',
  authenticateCustomer,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const bodyResult = verifyPaymentSchema.safeParse(req.body);

      if (!bodyResult.success) {
        res.status(400).json({
          success: false,
          error: 'Invalid request body',
          details: bodyResult.error.issues,
        });
        return;
      }

      const result = await paymentService.verifyPayment(bodyResult.data);

      if (!result.success) {
        res.status(400).json({
          success: false,
          error: result.error,
        });
        return;
      }

      res.json({
        success: true,
        message: 'Payment verified and order confirmed',
        data: {
          orderId: result.order?.orderId,
          orderNumber: result.order?.orderNumber,
          status: result.order?.status,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/payments/status/:orderId
 * Get payment status for an order
 */
router.get(
  '/status/:orderId',
  authenticateCustomer,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await paymentService.getPaymentStatus(req.params.orderId);

      if (result.error && result.error.includes('not found')) {
        res.status(404).json({
          success: false,
          error: result.error,
        });
        return;
      }

      res.json({
        success: true,
        data: {
          orderId: req.params.orderId,
          status: result.status,
          razorpayOrderId: result.razorpayOrderId,
          razorpayPaymentId: result.razorpayPaymentId,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/payments/refund
 * Create refund for an order (internal service only)
 */
router.post(
  '/refund',
  authenticateInternalService,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const bodyResult = createRefundSchema.safeParse(req.body);

      if (!bodyResult.success) {
        res.status(400).json({
          success: false,
          error: 'Invalid request body',
          details: bodyResult.error.issues,
        });
        return;
      }

      const orderId = req.body.orderId;

      if (!orderId) {
        res.status(400).json({
          success: false,
          error: 'orderId is required',
        });
        return;
      }

      const result = await paymentService.createRefund({
        orderId,
        amount: bodyResult.data.amount,
        speed: bodyResult.data.speed,
        notes: bodyResult.data.notes,
      });

      if (!result.success) {
        res.status(400).json({
          success: false,
          error: result.error,
        });
        return;
      }

      res.json({
        success: true,
        message: 'Refund initiated',
        data: {
          refundId: result.refundId,
          amount: result.amount,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/payments/refund/:refundId
 * Get refund status
 */
router.get(
  '/refund/:refundId',
  authenticateInternalService,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await paymentService.getRefundStatus(req.params.refundId);

      res.json({
        success: true,
        data: {
          refundId: req.params.refundId,
          status: result.status,
          amount: result.amount,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/payments/methods
 * Get available payment methods for customer
 */
router.get(
  '/methods',
  authenticateCustomer,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const queryResult = getPaymentMethodsSchema.safeParse(req.query);

      if (!queryResult.success) {
        res.status(400).json({
          success: false,
          error: 'Invalid query parameters',
          details: queryResult.error.issues,
        });
        return;
      }

      const result = await paymentService.getAvailablePaymentMethods(
        req.customerId!,
        queryResult.data.amount
      );

      res.json({
        success: true,
        data: result.methods,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/payments/wallet/balance
 * Get wallet balance for customer
 */
router.get(
  '/wallet/balance',
  authenticateCustomer,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await paymentService.getWalletBalance(req.customerId!);

      if (!result.success) {
        res.status(400).json({
          success: false,
          error: result.error,
        });
        return;
      }

      res.json({
        success: true,
        data: {
          balance: result.balance,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/payments/wallet/pay
 * Process wallet payment for order
 */
router.post(
  '/wallet/pay',
  authenticateCustomer,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const orderId = req.body.orderId;

      if (!orderId) {
        res.status(400).json({
          success: false,
          error: 'orderId is required',
        });
        return;
      }

      const result = await paymentService.processWalletPayment(orderId, req.customerId!);

      if (!result.success) {
        res.status(400).json({
          success: false,
          error: result.error,
        });
        return;
      }

      res.json({
        success: true,
        message: 'Payment successful',
        data: {
          transactionId: result.transactionId,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/payments/razorpay/webhook
 * Handle Razorpay webhook
 */
router.post(
  '/razorpay/webhook',
  verifyRazorpayWebhook,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await paymentService.handleWebhook(req.body);

      if (!result.success) {
        res.status(400).json({
          success: false,
          error: result.error,
        });
        return;
      }

      res.json({
        success: true,
        message: 'Webhook processed',
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
