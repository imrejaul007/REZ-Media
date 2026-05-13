import { Router, Request, Response } from 'express';
import { z } from 'zod';
import * as checkoutService from '../services/checkoutService';
import * as paymentRouter from '../services/paymentRouter';
import { optionalAuth, requireAuth } from '../middleware/auth';
import { checkoutFraudCheck, highValueOrderCheck } from '../middleware/fraudCheck';

const router = Router();

// Zod schemas for validation
const CheckoutSchema = z.object({
  merchantId: z.string().min(1),
  shippingAddressId: z.string().optional(),
  shippingAddress: z.object({
    recipientName: z.string().min(1),
    phone: z.string().min(1),
    addressLine1: z.string().min(1),
    addressLine2: z.string().optional(),
    city: z.string().min(1),
    state: z.string().min(1),
    postalCode: z.string().min(1),
    country: z.string().optional(),
    landmark: z.string().optional(),
    deliveryInstructions: z.string().optional(),
  }).optional(),
  billingAddress: z.object({
    recipientName: z.string().min(1),
    phone: z.string().min(1),
    addressLine1: z.string().min(1),
    addressLine2: z.string().optional(),
    city: z.string().min(1),
    state: z.string().min(1),
    postalCode: z.string().min(1),
    country: z.string().optional(),
  }).optional(),
  paymentMethod: z.enum(['UPI', 'CARD', 'NETBANKING', 'WALLET', 'COD']).optional(),
  couponCode: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

const ReorderSchema = z.object({
  orderId: z.string().min(1),
});

/**
 * GET /checkout/summary
 * Get checkout summary
 */
router.get('/summary', optionalAuth, async (req: Request, res: Response) => {
  try {
    const result = await checkoutService.getCheckoutSummary(
      req.userId,
      req.sessionId
    );

    if (!result.success) {
      res.status(400).json({
        success: false,
        error: result.error,
      });
      return;
    }

    res.json({
      success: true,
      summary: result.summary,
    });
  } catch (error) {
    console.error('Get checkout summary error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

/**
 * GET /checkout/payment-methods
 * Get available payment methods
 */
router.get('/payment-methods', optionalAuth, async (req: Request, res: Response) => {
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
 * POST /checkout/payment/route
 * Get recommended payment routing
 */
router.post('/payment/route', optionalAuth, async (req: Request, res: Response) => {
  try {
    const { amount, preferredMethod } = req.body;

    const routing = await paymentRouter.routePayment({
      amount: amount || 0,
      userId: req.userId,
      sessionId: req.sessionId,
      preferredMethod,
      isGuest: req.isGuest,
    });

    res.json({
      success: true,
      routing,
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
 * POST /checkout
 * Process checkout
 */
router.post(
  '/',
  optionalAuth,
  checkoutFraudCheck,
  highValueOrderCheck,
  async (req: Request, res: Response) => {
    try {
      // Validate input
      const validation = CheckoutSchema.safeParse(req.body);

      if (!validation.success) {
        res.status(400).json({
          success: false,
          error: 'Invalid input',
          code: 'VALIDATION_ERROR',
          details: validation.error.errors,
        });
        return;
      }

      const input = validation.data;

      // Check if high-value order needs verification
      if (req.body._requiresVerification && req.isGuest) {
        res.status(403).json({
          success: false,
          error: 'Additional verification required for this order',
          code: 'VERIFICATION_REQUIRED',
          reason: req.body._verificationReason,
        });
        return;
      }

      // Check fraud result
      const fraudResult = req.body._fraudCheckResult;
      if (fraudResult && fraudResult.recommendation === 'review') {
        // Log for review but continue
        console.log('Order flagged for review:', {
          userId: req.userId,
          sessionId: req.sessionId,
          riskScore: fraudResult.riskScore,
          flags: fraudResult.flags,
        });
      }

      const result = await checkoutService.processCheckout({
        userId: req.userId,
        sessionId: req.sessionId!,
        merchantId: input.merchantId,
        shippingAddressId: input.shippingAddressId,
        shippingAddress: input.shippingAddress,
        billingAddress: input.billingAddress,
        paymentMethod: input.paymentMethod,
        couponCode: input.couponCode,
        metadata: input.metadata,
      });

      if (!result.success) {
        res.status(400).json({
          success: false,
          error: result.error,
          code: result.code,
        });
        return;
      }

      // If redirect needed (payment gateway)
      if (result.redirectUrl) {
        res.json({
          success: true,
          redirectUrl: result.redirectUrl,
          order: {
            orderId: result.order?.orderId,
            status: result.order?.status,
          },
        });
        return;
      }

      // Order created successfully
      res.status(201).json({
        success: true,
        order: {
          orderId: result.order?.orderId,
          status: result.order?.status,
          total: result.order?.total,
          estimatedDelivery: result.order?.estimatedDelivery,
        },
        payment: {
          method: result.paymentDetails?.method,
          status: result.paymentDetails?.status,
        },
      });
    } catch (error) {
      console.error('Checkout error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        code: 'INTERNAL_ERROR',
      });
    }
  }
);

/**
 * POST /checkout/reorder
 * One-tap reorder from previous order
 */
router.post('/reorder', requireAuth, async (req: Request, res: Response) => {
  try {
    const validation = ReorderSchema.safeParse(req.body);

    if (!validation.success) {
      res.status(400).json({
        success: false,
        error: 'Invalid input',
        code: 'VALIDATION_ERROR',
        details: validation.error.errors,
      });
      return;
    }

    const result = await checkoutService.reorder(
      req.userId!,
      validation.data.orderId,
      req.sessionId!
    );

    if (!result.success) {
      res.status(400).json({
        success: false,
        error: result.error,
        code: result.code,
      });
      return;
    }

    res.json({
      success: true,
      message: 'Items added to cart for reorder',
      checkoutUrl: `/checkout?sessionId=${req.sessionId}`,
      paymentMethod: result.paymentDetails?.method,
    });
  } catch (error) {
    console.error('Reorder error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
    });
  }
});

/**
 * POST /checkout/shipping/calculate
 * Calculate shipping cost
 */
router.post('/shipping/calculate', optionalAuth, async (req: Request, res: Response) => {
  try {
    const { address } = req.body;

    if (!address) {
      res.status(400).json({
        success: false,
        error: 'Address is required',
        code: 'ADDRESS_REQUIRED',
      });
      return;
    }

    // Import cart service dynamically to avoid circular dependency
    const { getCart } = await import('../services/cartService');
    const { cart } = await getCart(req.userId, req.sessionId);

    if (!cart || cart.items.length === 0) {
      res.status(400).json({
        success: false,
        error: 'Cart is empty',
        code: 'EMPTY_CART',
      });
      return;
    }

    const shipping = await checkoutService.calculateShipping(address, cart);

    res.json({
      success: true,
      shipping,
    });
  } catch (error) {
    console.error('Calculate shipping error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
    });
  }
});

/**
 * POST /checkout/validate
 * Validate checkout prerequisites
 */
router.post('/validate', optionalAuth, async (req: Request, res: Response) => {
  try {
    const { merchantId, shippingAddressId, shippingAddress } = req.body;

    const result = await checkoutService.validateCheckout({
      userId: req.userId,
      sessionId: req.sessionId!,
      merchantId,
      shippingAddressId,
      shippingAddress,
    });

    res.json({
      success: result.valid,
      errors: result.errors,
    });
  } catch (error) {
    console.error('Validate checkout error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
    });
  }
});

export default router;
