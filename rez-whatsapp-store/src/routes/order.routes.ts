import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import winston from 'winston';
import { configManager } from '../config';
import { orderService } from '../services/orderService';

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

export function createOrderRoutes(): Router {
  const router = Router();

  /**
   * GET /api/orders
   * Get orders for a phone number or user
   */
  router.get(
    '/',
    asyncHandler(async (req: Request, res: Response) => {
      const phoneNumber = req.query.phoneNumber as string | undefined;
      const userId = (req.headers['x-user-id'] as string | undefined) || req.query.userId as string | undefined;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const status = req.query.status as string | undefined;

      let orders;
      let total = 0;

      if (phoneNumber) {
        orders = await orderService.getOrderByPhone(phoneNumber, limit);
        total = orders.length;
      } else if (userId) {
        orders = await orderService.getOrdersByUser(userId, limit);
        total = orders.length;
      } else {
        // Get all orders with pagination and filters
        const filter: { status?: string[]; fromDate?: Date; toDate?: Date } = {};
        if (status) {
          filter.status = status.split(',') as string[];
        }
        const result = await orderService.getOrders(filter, page, limit);
        orders = result.orders;
        total = result.total;
      }

      res.json({
        success: true,
        orders,
        total,
        page,
        limit,
      });
    })
  );

  /**
   * GET /api/orders/:orderId
   * Get order by ID
   */
  router.get(
    '/:orderId',
    asyncHandler(async (req: Request, res: Response) => {
      const { orderId } = req.params;

      const order = await orderService.getOrder(orderId);

      if (!order) {
        return res.status(404).json({
          success: false,
          error: 'Order not found',
        });
      }

      res.json({
        success: true,
        order,
      });
    })
  );

  /**
   * GET /api/orders/:orderId/summary
   * Get order summary
   */
  router.get(
    '/:orderId/summary',
    asyncHandler(async (req: Request, res: Response) => {
      const { orderId } = req.params;

      const summary = await orderService.getOrderSummary(orderId);

      if (!summary) {
        return res.status(404).json({
          success: false,
          error: 'Order not found',
        });
      }

      res.json({
        success: true,
        summary,
      });
    })
  );

  /**
   * PATCH /api/orders/:orderId/status
   * Update order status (internal use)
   */
  router.patch(
    '/:orderId/status',
    asyncHandler(async (req: Request, res: Response) => {
      const { orderId } = req.params;

      const result = z.object({
        status: z.enum([
          'pending',
          'confirmed',
          'processing',
          'shipped',
          'out_for_delivery',
          'delivered',
          'cancelled',
          'refunded',
          'failed',
        ]),
        reason: z.string().optional(),
      }).safeParse(req.body);

      if (!result.success) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: result.error.errors,
        });
      }

      const { status, reason } = result.data;

      const updateResult = await orderService.updateOrderStatus(orderId, status, reason);

      if (!updateResult.success) {
        return res.status(400).json(updateResult);
      }

      logger.info('Order status updated via API', {
        orderId,
        status,
        reason,
      });

      // Send notification
      await orderService.notifyOrderUpdate(orderId);

      res.json(updateResult);
    })
  );

  /**
   * PATCH /api/orders/:orderId/payment
   * Update payment status
   */
  router.patch(
    '/:orderId/payment',
    asyncHandler(async (req: Request, res: Response) => {
      const { orderId } = req.params;

      const result = z.object({
        paymentStatus: z.enum(['paid', 'failed', 'refunded', 'partial_refund']),
        paymentId: z.string().optional(),
      }).safeParse(req.body);

      if (!result.success) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: result.error.errors,
        });
      }

      const { paymentStatus, paymentId } = result.data;

      const updateResult = await orderService.updatePaymentStatus(
        orderId,
        paymentStatus,
        paymentId
      );

      if (!updateResult.success) {
        return res.status(400).json(updateResult);
      }

      logger.info('Payment status updated via API', {
        orderId,
        paymentStatus,
        paymentId,
      });

      res.json(updateResult);
    })
  );

  /**
   * POST /api/orders/:orderId/cancel
   * Cancel an order
   */
  router.post(
    '/:orderId/cancel',
    asyncHandler(async (req: Request, res: Response) => {
      const { orderId } = req.params;

      const result = z.object({
        reason: z.string().min(5).max(500),
      }).safeParse(req.body);

      if (!result.success) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: result.error.errors,
        });
      }

      const cancelResult = await orderService.cancelOrder(orderId, result.data.reason);

      if (!cancelResult.success) {
        return res.status(400).json(cancelResult);
      }

      logger.info('Order cancelled via API', {
        orderId,
        reason: result.data.reason,
      });

      // Send notification
      await orderService.notifyOrderUpdate(orderId);

      res.json(cancelResult);
    })
  );

  /**
   * GET /api/orders/stats
   * Get order statistics
   */
  router.get(
    '/stats/summary',
    asyncHandler(async (req: Request, res: Response) => {
      const phoneNumber = req.query.phoneNumber as string | undefined;
      const userId = (req.headers['x-user-id'] as string | undefined) || req.query.userId as string | undefined;

      const stats = await orderService.getOrderStats(phoneNumber || userId);

      res.json({
        success: true,
        stats,
      });
    })
  );

  /**
   * GET /api/orders/recent
   * Get recent orders
   */
  router.get(
    '/stats/recent',
    asyncHandler(async (req: Request, res: Response) => {
      const limit = parseInt(req.query.limit as string) || 5;

      const orders = await orderService.getRecentOrders(limit);

      res.json({
        success: true,
        orders,
      });
    })
  );

  /**
   * GET /api/orders/pending
   * Get pending orders (internal use)
   */
  router.get(
    '/stats/pending',
    asyncHandler(async (req: Request, res: Response) => {
      const orders = await orderService.getPendingOrders();

      res.json({
        success: true,
        orders,
        total: orders.length,
      });
    })
  );

  /**
   * POST /api/orders/:orderId/notify
   * Send order status notification
   */
  router.post(
    '/:orderId/notify',
    asyncHandler(async (req: Request, res: Response) => {
      const { orderId } = req.params;

      const success = await orderService.notifyOrderUpdate(orderId);

      if (!success) {
        return res.status(400).json({
          success: false,
          error: 'Failed to send notification',
        });
      }

      logger.info('Order notification sent via API', { orderId });

      res.json({
        success: true,
        message: 'Notification sent',
      });
    })
  );

  return router;
}

export default createOrderRoutes;
