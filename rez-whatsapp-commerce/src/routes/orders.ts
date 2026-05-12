import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { orderService, CreateOrderRequest } from '../services/orderService';
import { cartService } from '../services/cartService';
import { paymentService } from '../services/paymentService';
import { authenticateCustomer, authenticateInternalService } from '../middleware/auth';

const router = Router();

// Validation schemas
const shippingAddressSchema = z.object({
  name: z.string().min(1),
  phone: z.string().min(10),
  addressLine1: z.string().min(1),
  addressLine2: z.string().optional(),
  city: z.string().min(1),
  state: z.string().min(1),
  postalCode: z.string().min(1),
  country: z.string().default('India'),
});

const createOrderSchema = z.object({
  paymentMethod: z.enum(['RAZORPAY', 'WALLET', 'COD', 'UPI']),
  shippingAddress: shippingAddressSchema,
  billingAddress: shippingAddressSchema.optional(),
  notes: z.string().max(500).optional(),
});

const updateOrderStatusSchema = z.object({
  status: z.enum(['CONFIRMED', 'PROCESSING', 'SHIPPED', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED']),
  reason: z.string().max(500).optional(),
});

const queryOrdersSchema = z.object({
  page: z.string().optional().transform(Number).pipe(z.number().positive().optional()),
  limit: z.string().optional().transform(Number).pipe(z.number().positive().max(100).optional()),
  status: z.enum(['PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED', 'REFUNDED', 'FAILED']).optional(),
  customerId: z.string().optional(),
});

/**
 * POST /api/orders
 * Create order from cart
 */
router.post(
  '/',
  authenticateCustomer,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const bodyResult = createOrderSchema.safeParse(req.body);

      if (!bodyResult.success) {
        res.status(400).json({
          success: false,
          error: 'Invalid request body',
          details: bodyResult.error.issues,
        });
        return;
      }

      // Validate cart before creating order
      const validation = await cartService.validateForCheckout(
        req.customerId!,
        req.merchantId!
      );

      if (!validation.valid) {
        res.status(400).json({
          success: false,
          error: 'Cart validation failed',
          errors: validation.errors,
        });
        return;
      }

      // Create order
      const orderRequest: CreateOrderRequest = {
        customerId: req.customerId!,
        customerPhone: req.customerPhone!,
        merchantId: req.merchantId!,
        paymentMethod: bodyResult.data.paymentMethod,
        shippingAddress: bodyResult.data.shippingAddress,
        billingAddress: bodyResult.data.billingAddress,
        notes: bodyResult.data.notes,
        source: 'WHATSAPP',
        whatsappMessageId: req.headers['x-whatsapp-message-id'] as string,
      };

      const order = await orderService.createOrderFromCart(orderRequest);

      // If payment method is RAZORPAY, initiate payment
      let paymentData: Record<string, unknown> = {};

      if (bodyResult.data.paymentMethod === 'RAZORPAY') {
        const paymentResult = await paymentService.initiateRazorpayPayment({
          orderId: order.orderId,
          customerId: req.customerId!,
          customerPhone: req.customerPhone!,
          amount: order.total,
          receipt: order.orderNumber,
        });

        if (!paymentResult.success) {
          // Order is created but payment initiation failed
          paymentData = {
            paymentRequired: true,
            paymentError: paymentResult.error,
          };
        } else {
          paymentData = {
            paymentRequired: true,
            razorpayOrderId: paymentResult.razorpayOrderId,
            amount: paymentResult.amount,
            currency: paymentResult.currency,
          };
        }
      }

      res.status(201).json({
        success: true,
        message: 'Order created successfully',
        data: {
          orderId: order.orderId,
          orderNumber: order.orderNumber,
          status: order.status,
          paymentStatus: order.paymentStatus,
          total: order.total,
          currency: order.currency,
          ...paymentData,
        },
      });
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('not found') || error.message.includes('empty')) {
          res.status(400).json({
            success: false,
            error: error.message,
          });
          return;
        }
        if (error.message.includes('Insufficient stock')) {
          res.status(400).json({
            success: false,
            error: error.message,
          });
          return;
        }
      }
      next(error);
    }
  }
);

/**
 * GET /api/orders
 * Get orders for current customer
 */
router.get(
  '/',
  authenticateCustomer,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const queryResult = queryOrdersSchema.safeParse(req.query);

      if (!queryResult.success) {
        res.status(400).json({
          success: false,
          error: 'Invalid query parameters',
          details: queryResult.error.issues,
        });
        return;
      }

      const result = await orderService.getOrdersForCustomer(
        req.customerId!,
        req.merchantId!,
        {
          page: queryResult.data.page,
          limit: queryResult.data.limit,
          status: queryResult.data.status,
        }
      );

      res.json({
        success: true,
        data: result.data.map((order) => ({
          orderId: order.orderId,
          orderNumber: order.orderNumber,
          status: order.status,
          paymentStatus: order.paymentStatus,
          total: order.total,
          itemCount: order.items.length,
          createdAt: order.createdAt,
        })),
        pagination: result.pagination,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/orders/:orderId
 * Get order by ID
 */
router.get(
  '/:orderId',
  authenticateCustomer,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const order = await orderService.getOrderById(
        req.params.orderId,
        req.merchantId
      );

      if (!order) {
        res.status(404).json({
          success: false,
          error: 'Order not found',
        });
        return;
      }

      // Check if order belongs to customer (unless internal service)
      if (!req.isInternalService && order.customerId !== req.customerId) {
        res.status(403).json({
          success: false,
          error: 'Access denied',
        });
        return;
      }

      res.json({
        success: true,
        data: order,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/orders/number/:orderNumber
 * Get order by order number
 */
router.get(
  '/number/:orderNumber',
  authenticateCustomer,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const order = await orderService.getOrderByNumber(
        req.params.orderNumber,
        req.merchantId!
      );

      if (!order) {
        res.status(404).json({
          success: false,
          error: 'Order not found',
        });
        return;
      }

      res.json({
        success: true,
        data: order,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PUT /api/orders/:orderId/status
 * Update order status (internal service only)
 */
router.put(
  '/:orderId/status',
  authenticateInternalService,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const bodyResult = updateOrderStatusSchema.safeParse(req.body);

      if (!bodyResult.success) {
        res.status(400).json({
          success: false,
          error: 'Invalid request body',
          details: bodyResult.error.issues,
        });
        return;
      }

      const order = await orderService.updateOrderStatus(
        req.params.orderId,
        req.merchantId || 'default',
        bodyResult.data.status,
        bodyResult.data.reason
      );

      res.json({
        success: true,
        message: 'Order status updated',
        data: {
          orderId: order.orderId,
          orderNumber: order.orderNumber,
          status: order.status,
        },
      });
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('not found')) {
          res.status(404).json({
            success: false,
            error: error.message,
          });
          return;
        }
        if (error.message.includes('Cannot transition')) {
          res.status(400).json({
            success: false,
            error: error.message,
          });
          return;
        }
      }
      next(error);
    }
  }
);

/**
 * GET /api/orders/merchant/orders
 * Get orders for merchant (internal service only)
 */
router.get(
  '/merchant/orders',
  authenticateInternalService,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const queryResult = queryOrdersSchema.safeParse(req.query);

      if (!queryResult.success) {
        res.status(400).json({
          success: false,
          error: 'Invalid query parameters',
          details: queryResult.error.issues,
        });
        return;
      }

      const result = await orderService.getOrdersForMerchant(
        req.merchantId || 'default',
        {
          page: queryResult.data.page,
          limit: queryResult.data.limit,
          status: queryResult.data.status,
          customerId: queryResult.data.customerId,
        }
      );

      res.json({
        success: true,
        data: result.data,
        pagination: result.pagination,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/orders/merchant/stats
 * Get order statistics (internal service only)
 */
router.get(
  '/merchant/stats',
  authenticateInternalService,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const startDate = req.query.startDate
        ? new Date(req.query.startDate as string)
        : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days ago
      const endDate = req.query.endDate
        ? new Date(req.query.endDate as string)
        : new Date();

      const stats = await orderService.getOrderStatistics(
        req.merchantId || 'default',
        startDate,
        endDate
      );

      res.json({
        success: true,
        data: stats,
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
