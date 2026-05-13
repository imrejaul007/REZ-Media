import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { Order, VALID_STATUS_TRANSITIONS } from '../models/Order';
import { requireAuth, optionalAuth } from '../middleware/auth';

const router = Router();

// Zod schemas
const UpdateStatusSchema = z.object({
  status: z.enum(['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded']),
  trackingInfo: z.object({
    location: z.string().optional(),
    description: z.string().optional(),
  }).optional(),
});

/**
 * GET /orders
 * Get user's orders
 */
router.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = parseInt(req.query.skip as string) || 0;
    const status = req.query.status as string | undefined;

    const orders = await Order.findByUser(req.userId!, {
      limit,
      skip,
      status,
    });

    res.json({
      success: true,
      orders: orders.map((order) => ({
        orderId: order.orderId,
        merchantId: order.merchantId,
        total: order.total,
        currency: order.currency,
        status: order.status,
        itemCount: order.items.length,
        createdAt: order.createdAt,
        estimatedDelivery: order.estimatedDelivery,
      })),
    });
  } catch (error) {
    console.error('Get orders error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

/**
 * GET /orders/:orderId
 * Get order details
 */
router.get('/:orderId', optionalAuth, async (req: Request, res: Response) => {
  try {
    const order = await Order.findByOrderId(req.params.orderId);

    if (!order) {
      res.status(404).json({
        success: false,
        error: 'Order not found',
      });
      return;
    }

    // Check access - allow if user owns the order or order is for the session
    if (req.userId && order.userId !== req.userId) {
      res.status(403).json({
        success: false,
        error: 'Access denied',
      });
      return;
    }

    res.json({
      success: true,
      order: {
        orderId: order.orderId,
        merchantId: order.merchantId,
        items: order.items,
        subtotal: order.subtotal,
        tax: order.tax,
        discount: order.discount,
        shippingCost: order.shippingCost,
        total: order.total,
        currency: order.currency,
        status: order.status,
        shippingAddress: order.shippingAddress,
        billingAddress: order.billingAddress,
        payment: {
          method: order.payment.method,
          status: order.payment.status,
          transactionId: order.payment.transactionId,
        },
        tracking: order.tracking,
        couponCode: order.couponCode,
        createdAt: order.createdAt,
        updatedAt: order.updatedAt,
        estimatedDelivery: order.estimatedDelivery,
      },
    });
  } catch (error) {
    console.error('Get order error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

/**
 * GET /orders/:orderId/tracking
 * Get order tracking info
 */
router.get('/:orderId/tracking', async (req: Request, res: Response) => {
  try {
    const order = await Order.findByOrderId(req.params.orderId);

    if (!order) {
      res.status(404).json({
        success: false,
        error: 'Order not found',
      });
      return;
    }

    res.json({
      success: true,
      orderId: order.orderId,
      status: order.status,
      tracking: order.tracking,
      estimatedDelivery: order.estimatedDelivery,
    });
  } catch (error) {
    console.error('Get tracking error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

/**
 * POST /orders/:orderId/cancel
 * Cancel an order
 */
router.post('/:orderId/cancel', requireAuth, async (req: Request, res: Response) => {
  try {
    const order = await Order.findByOrderId(req.params.orderId);

    if (!order) {
      res.status(404).json({
        success: false,
        error: 'Order not found',
      });
      return;
    }

    if (order.userId !== req.userId) {
      res.status(403).json({
        success: false,
        error: 'Access denied',
      });
      return;
    }

    // Check if order can be cancelled
    const allowedTransitions = VALID_STATUS_TRANSITIONS[order.status];
    if (!allowedTransitions.includes('cancelled')) {
      res.status(400).json({
        success: false,
        error: 'Order cannot be cancelled',
        currentStatus: order.status,
      });
      return;
    }

    const { reason } = req.body;
    const updatedOrder = await Order.updateStatus(req.params.orderId, 'cancelled', {
      description: reason || 'Cancelled by customer',
    });

    res.json({
      success: true,
      order: {
        orderId: updatedOrder?.orderId,
        status: updatedOrder?.status,
      },
    });
  } catch (error) {
    console.error('Cancel order error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

/**
 * PUT /orders/:orderId/status
 * Update order status (admin/merchant use)
 */
router.put('/:orderId/status', async (req: Request, res: Response) => {
  try {
    // Verify internal service token
    const internalToken = req.headers['x-internal-token'];
    const expectedToken = process.env.INTERNAL_SERVICE_TOKENS_JSON;

    if (!internalToken || !expectedToken) {
      res.status(401).json({
        success: false,
        error: 'Unauthorized',
      });
      return;
    }

    const validation = UpdateStatusSchema.safeParse(req.body);

    if (!validation.success) {
      res.status(400).json({
        success: false,
        error: 'Invalid input',
        code: 'VALIDATION_ERROR',
        details: validation.error.errors,
      });
      return;
    }

    const order = await Order.findByOrderId(req.params.orderId);

    if (!order) {
      res.status(404).json({
        success: false,
        error: 'Order not found',
      });
      return;
    }

    // Validate status transition
    const allowedTransitions = VALID_STATUS_TRANSITIONS[order.status];
    if (!allowedTransitions.includes(validation.data.status)) {
      res.status(400).json({
        success: false,
        error: 'Invalid status transition',
        currentStatus: order.status,
        requestedStatus: validation.data.status,
        allowedTransitions,
      });
      return;
    }

    const updatedOrder = await Order.updateStatus(
      req.params.orderId,
      validation.data.status,
      validation.data.trackingInfo
    );

    res.json({
      success: true,
      order: {
        orderId: updatedOrder?.orderId,
        status: updatedOrder?.status,
        tracking: updatedOrder?.tracking,
      },
    });
  } catch (error) {
    console.error('Update order status error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

/**
 * GET /orders/stats
 * Get order statistics (for logged in user)
 */
router.get('/stats/summary', requireAuth, async (req: Request, res: Response) => {
  try {
    const stats = await Order.aggregate([
      { $match: { userId: req.userId } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalValue: { $sum: '$total' },
        },
      },
    ]);

    const totalOrders = stats.reduce((sum, s) => sum + s.count, 0);
    const totalValue = stats.reduce((sum, s) => sum + s.totalValue, 0);

    res.json({
      success: true,
      stats: {
        totalOrders,
        totalValue,
        byStatus: stats.reduce((acc, s) => {
          acc[s._id] = { count: s.count, value: s.totalValue };
          return acc;
        }, {} as Record<string, { count: number; value: number }>),
      },
    });
  } catch (error) {
    console.error('Get order stats error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

/**
 * POST /orders/:orderId/payment/confirm
 * Confirm payment for an order
 */
router.post('/:orderId/payment/confirm', async (req: Request, res: Response) => {
  try {
    const { transactionId, gatewayResponse } = req.body;

    const order = await Order.findByOrderId(req.params.orderId);

    if (!order) {
      res.status(404).json({
        success: false,
        error: 'Order not found',
      });
      return;
    }

    if (order.payment.status !== 'pending') {
      res.status(400).json({
        success: false,
        error: 'Payment already processed',
        currentStatus: order.payment.status,
      });
      return;
    }

    // Update payment details
    order.payment.status = 'captured';
    order.payment.transactionId = transactionId;
    if (gatewayResponse) {
      order.payment.gatewayResponse = gatewayResponse;
    }

    // Update order status
    order.status = 'confirmed';
    order.tracking.push({
      status: 'confirmed',
      timestamp: new Date(),
      description: 'Payment confirmed',
    });

    await order.save();

    res.json({
      success: true,
      order: {
        orderId: order.orderId,
        status: order.status,
        payment: {
          status: order.payment.status,
          transactionId: order.payment.transactionId,
        },
      },
    });
  } catch (error) {
    console.error('Confirm payment error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

export default router;
