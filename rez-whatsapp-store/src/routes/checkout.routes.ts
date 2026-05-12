import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import winston from 'winston';
import { configManager } from '../config';
import { checkoutHandler } from '../handlers/checkoutHandler';

const logger = winston.createLogger({
  level: configManager.get().logging.level,
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [new winston.transports.Console()],
});

// Middleware for async error handling
const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// Validation schemas
const addressSchema = z.object({
  fullName: z.string().min(2).max(100),
  phoneNumber: z.string().regex(/^\+?[1-9]\d{6,14}$/),
  addressLine1: z.string().min(5).max(200),
  addressLine2: z.string().max(200).optional(),
  city: z.string().min(2).max(100),
  state: z.string().min(2).max(100),
  postalCode: z.string().regex(/^\d{6}$/, 'PIN code must be 6 digits'),
  country: z.string().default('India'),
  instructions: z.string().max(500).optional(),
});

const deliverySchema = z.object({
  type: z.enum(['home_delivery', 'store_pickup', 'instant']),
  address: addressSchema.optional(),
  notes: z.string().max(500).optional(),
});

const paymentSchema = z.object({
  method: z.enum(['upi', 'card', 'wallet', 'cod']),
  upiId: z.string().optional(),
  cardDetails: z.object({
    number: z.string(),
    expiry: z.string(),
    cvv: z.string(),
  }).optional(),
});

const initiateCheckoutSchema = z.object({
  phoneNumber: z.string().regex(/^\+?[1-9]\d{6,14}$/),
  source: z.enum(['whatsapp', 'web', 'app']).optional(),
});

export function createCheckoutRoutes(): Router {
  const router = Router();

  /**
   * POST /api/checkout
   * Initiate a new checkout
   */
  router.post(
    '/',
    asyncHandler(async (req: Request, res: Response) => {
      const result = initiateCheckoutSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: result.error.errors,
        });
      }

      const { phoneNumber, source } = result.data;
      const userId = req.headers['x-user-id'] as string | undefined;

      const checkoutResult = await checkoutHandler.initiateCheckout({
        phoneNumber,
        userId,
        source: source || 'whatsapp',
      });

      if (!checkoutResult.success) {
        return res.status(400).json(checkoutResult);
      }

      logger.info('Checkout initiated via API', {
        checkoutId: checkoutResult.checkoutId,
        phoneNumber,
      });

      res.status(201).json(checkoutResult);
    })
  );

  /**
   * GET /api/checkout/:checkoutId
   * Get checkout details
   */
  router.get(
    '/:checkoutId',
    asyncHandler(async (req: Request, res: Response) => {
      const { checkoutId } = req.params;

      const result = await checkoutHandler.getCheckout(checkoutId);

      if (!result.success) {
        return res.status(404).json(result);
      }

      res.json(result);
    })
  );

  /**
   * PATCH /api/checkout/:checkoutId/address
   * Set delivery address
   */
  router.patch(
    '/:checkoutId/address',
    asyncHandler(async (req: Request, res: Response) => {
      const { checkoutId } = req.params;

      const result = addressSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: result.error.errors,
        });
      }

      const addressResult = await checkoutHandler.setAddress(checkoutId, result.data);

      if (!addressResult.success) {
        return res.status(400).json(addressResult);
      }

      logger.info('Address set via API', { checkoutId });

      res.json(addressResult);
    })
  );

  /**
   * PATCH /api/checkout/:checkoutId/delivery
   * Select delivery option
   */
  router.patch(
    '/:checkoutId/delivery',
    asyncHandler(async (req: Request, res: Response) => {
      const { checkoutId } = req.params;

      const result = deliverySchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: result.error.errors,
        });
      }

      const deliveryResult = await checkoutHandler.selectDelivery(checkoutId, {
        type: result.data.type,
        address: result.data.address,
        notes: result.data.notes,
      });

      if (!deliveryResult.success) {
        return res.status(400).json(deliveryResult);
      }

      logger.info('Delivery selected via API', {
        checkoutId,
        type: result.data.type,
      });

      res.json(deliveryResult);
    })
  );

  /**
   * POST /api/checkout/:checkoutId/payment
   * Initiate payment
   */
  router.post(
    '/:checkoutId/payment',
    asyncHandler(async (req: Request, res: Response) => {
      const { checkoutId } = req.params;

      const result = paymentSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: result.error.errors,
        });
      }

      const paymentResult = await checkoutHandler.processPayment(checkoutId, result.data);

      if (!paymentResult.success) {
        return res.status(400).json(paymentResult);
      }

      logger.info('Payment initiated via API', {
        checkoutId,
        method: result.data.method,
      });

      res.json(paymentResult);
    })
  );

  /**
   * POST /api/checkout/:checkoutId/complete
   * Verify payment and complete checkout
   */
  router.post(
    '/:checkoutId/complete',
    asyncHandler(async (req: Request, res: Response) => {
      const { checkoutId } = req.params;

      const result = z.object({
        razorpayOrderId: z.string(),
        razorpayPaymentId: z.string(),
        razorpaySignature: z.string(),
      }).safeParse(req.body);

      if (!result.success) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: result.error.errors,
        });
      }

      const completeResult = await checkoutHandler.verifyAndCompleteOrder(checkoutId, result.data);

      if (!completeResult.success) {
        return res.status(400).json(completeResult);
      }

      logger.info('Checkout completed via API', {
        checkoutId,
        orderId: completeResult.orderId,
      });

      res.json(completeResult);
    })
  );

  /**
   * POST /api/checkout/:checkoutId/coupon
   * Apply coupon code
   */
  router.post(
    '/:checkoutId/coupon',
    asyncHandler(async (req: Request, res: Response) => {
      const { checkoutId } = req.params;

      const result = z.object({
        couponCode: z.string().min(3).max(20),
      }).safeParse(req.body);

      if (!result.success) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: result.error.errors,
        });
      }

      const couponResult = await checkoutHandler.applyCoupon(checkoutId, result.data.couponCode);

      if (!couponResult.success) {
        return res.status(400).json(couponResult);
      }

      logger.info('Coupon applied via API', {
        checkoutId,
        code: result.data.couponCode,
      });

      res.json(couponResult);
    })
  );

  /**
   * DELETE /api/checkout/:checkoutId/coupon
   * Remove applied coupon
   */
  router.delete(
    '/:checkoutId/coupon',
    asyncHandler(async (req: Request, res: Response) => {
      const { checkoutId } = req.params;

      const result = await checkoutHandler.removeCoupon(checkoutId);

      if (!result.success) {
        return res.status(400).json(result);
      }

      logger.info('Coupon removed via API', { checkoutId });

      res.json(result);
    })
  );

  /**
   * POST /api/checkout/:checkoutId/cancel
   * Cancel checkout
   */
  router.post(
    '/:checkoutId/cancel',
    asyncHandler(async (req: Request, res: Response) => {
      const { checkoutId } = req.params;

      const result = await checkoutHandler.cancelCheckout(checkoutId);

      if (!result.success) {
        return res.status(400).json(result);
      }

      logger.info('Checkout cancelled via API', { checkoutId });

      res.json(result);
    })
  );

  /**
   * GET /api/checkout/:checkoutId/summary
   * Get formatted checkout summary
   */
  router.get(
    '/:checkoutId/summary',
    asyncHandler(async (req: Request, res: Response) => {
      const { checkoutId } = req.params;

      const checkout = await checkoutHandler.getCheckout(checkoutId);

      if (!checkout.success || !checkout.checkout) {
        return res.status(404).json(checkout);
      }

      res.json({
        success: true,
        summary: checkout.checkout,
      });
    })
  );

  return router;
}

export default createCheckoutRoutes;
