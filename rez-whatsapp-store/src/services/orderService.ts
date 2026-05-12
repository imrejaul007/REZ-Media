import axios, { AxiosInstance } from 'axios';
import winston from 'winston';
import { Order, IOrder, OrderStatus, DeliveryType, IDeliveryAddress } from '../models/Order';
import { Checkout } from '../models/Checkout';
import { configManager } from '../config';

const logger = winston.createLogger({
  level: configManager.get().logging.level,
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [new winston.transports.Console()],
});

export interface CreateOrderInput {
  checkoutId: string;
  userId?: string;
  phoneNumber: string;
  paymentId?: string;
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
  source?: 'whatsapp' | 'web' | 'app';
}

export interface OrderResponse<T = IOrder> {
  success: boolean;
  order?: T;
  message?: string;
  error?: string;
}

export interface OrderFilter {
  status?: OrderStatus[];
  paymentStatus?: string[];
  phoneNumber?: string;
  userId?: string;
  fromDate?: Date;
  toDate?: Date;
}

export class OrderService {
  private static instance: OrderService;
  private internalApiClient: AxiosInstance;

  private constructor() {
    this.internalApiClient = axios.create({
      baseURL: configManager.get().services.order,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  static getInstance(): OrderService {
    if (!OrderService.instance) {
      OrderService.instance = new OrderService();
    }
    return OrderService.instance;
  }

  private getInternalHeaders(): Record<string, string> {
    const token = configManager.getInternalToken('order-service');
    return {
      'X-Internal-Token': token || '',
      'X-Service-Name': 'whatsapp-store',
    };
  }

  async createOrder(input: CreateOrderInput): Promise<OrderResponse> {
    try {
      const { checkoutId, userId, phoneNumber, paymentId, razorpayOrderId, razorpayPaymentId, source = 'whatsapp' } = input;

      // Get checkout data
      const checkout = await Checkout.findOne({ checkoutId });
      if (!checkout) {
        return { success: false, error: 'Checkout not found' };
      }

      if (checkout.status !== 'completed') {
        return { success: false, error: 'Checkout is not completed' };
      }

      // Calculate estimated delivery time
      const estimatedDelivery = this.calculateEstimatedDelivery(checkout.deliveryType as DeliveryType);

      // Create order
      const order = new Order({
        cartId: checkout.cartId,
        userId,
        phoneNumber,
        items: checkout.items,
        subtotal: checkout.subtotal,
        discountTotal: checkout.discountTotal,
        deliveryFee: checkout.deliveryFee,
        totalAmount: checkout.totalAmount,
        currency: checkout.currency,
        status: paymentId ? 'confirmed' : 'pending',
        paymentStatus: paymentId ? 'paid' : 'pending',
        deliveryType: checkout.deliveryType as DeliveryType,
        deliveryAddress: checkout.deliveryAddress,
        paymentId,
        razorpayOrderId,
        razorpayPaymentId,
        notes: checkout.notes,
        source,
        estimatedDelivery,
        paymentMethod: checkout.paymentMethod,
      });

      await order.save();

      // Sync with REZ Order Service
      try {
        await this.syncOrderToOrderService(order);
      } catch (syncError) {
        logger.warn('Failed to sync order to order service', { error: syncError, orderId: order.orderId });
      }

      // Update checkout with order ID
      checkout.metadata = {
        ...checkout.metadata,
        orderId: order.orderId,
      };
      await checkout.save();

      logger.info('Order created', { orderId: order.orderId, checkoutId, phoneNumber });

      return {
        success: true,
        order,
        message: `Order ${order.orderId} created successfully`,
      };
    } catch (error) {
      logger.error('Error creating order', { error, input });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create order',
      };
    }
  }

  async getOrder(orderId: string): Promise<IOrder | null> {
    return Order.findByOrderId(orderId);
  }

  async getOrderByPhone(phoneNumber: string, limit: number = 10): Promise<IOrder[]> {
    return Order.findByPhone(phoneNumber, limit);
  }

  async getOrdersByUser(userId: string, limit: number = 10): Promise<IOrder[]> {
    return Order.findByUser(userId, limit);
  }

  async updateOrderStatus(orderId: string, status: OrderStatus, reason?: string): Promise<OrderResponse> {
    try {
      const order = await Order.findByOrderId(orderId);
      if (!order) {
        return { success: false, error: 'Order not found' };
      }

      order.updateStatus(status, reason);
      await order.save();

      // Sync with REZ Order Service
      try {
        await this.syncOrderStatus(orderId, status);
      } catch (syncError) {
        logger.warn('Failed to sync order status', { error: syncError, orderId });
      }

      logger.info('Order status updated', { orderId, status, reason });

      return {
        success: true,
        order,
        message: `Order status updated to ${status}`,
      };
    } catch (error) {
      logger.error('Error updating order status', { error, orderId, status });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update order status',
      };
    }
  }

  async updatePaymentStatus(
    orderId: string,
    paymentStatus: 'paid' | 'failed' | 'refunded' | 'partial_refund',
    paymentId?: string
  ): Promise<OrderResponse> {
    try {
      const order = await Order.findByOrderId(orderId);
      if (!order) {
        return { success: false, error: 'Order not found' };
      }

      order.updatePaymentStatus(paymentStatus, paymentId);
      await order.save();

      logger.info('Order payment status updated', { orderId, paymentStatus, paymentId });

      return {
        success: true,
        order,
        message: `Payment status updated to ${paymentStatus}`,
      };
    } catch (error) {
      logger.error('Error updating payment status', { error, orderId });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update payment status',
      };
    }
  }

  async cancelOrder(orderId: string, reason: string): Promise<OrderResponse> {
    try {
      const order = await Order.findByOrderId(orderId);
      if (!order) {
        return { success: false, error: 'Order not found' };
      }

      if (['delivered', 'cancelled', 'refunded'].includes(order.status)) {
        return { success: false, error: 'Order cannot be cancelled in current status' };
      }

      order.updateStatus('cancelled', reason);
      await order.save();

      // Sync with REZ Order Service
      try {
        await this.syncOrderStatus(orderId, 'cancelled', { reason });
      } catch (syncError) {
        logger.warn('Failed to sync order cancellation', { error: syncError, orderId });
      }

      logger.info('Order cancelled', { orderId, reason });

      return {
        success: true,
        order,
        message: 'Order cancelled successfully',
      };
    } catch (error) {
      logger.error('Error cancelling order', { error, orderId });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to cancel order',
      };
    }
  }

  async getOrders(filter: OrderFilter, page: number = 1, limit: number = 20): Promise<{
    orders: IOrder[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    const query: Record<string, unknown> = {};

    if (filter.status && filter.status.length > 0) {
      query.status = { $in: filter.status };
    }

    if (filter.paymentStatus && filter.paymentStatus.length > 0) {
      query.paymentStatus = { $in: filter.paymentStatus };
    }

    if (filter.phoneNumber) {
      query.phoneNumber = filter.phoneNumber;
    }

    if (filter.userId) {
      query.userId = filter.userId;
    }

    if (filter.fromDate || filter.toDate) {
      query.createdAt = {};
      if (filter.fromDate) {
        (query.createdAt as Record<string, Date>).$gte = filter.fromDate;
      }
      if (filter.toDate) {
        (query.createdAt as Record<string, Date>).$lte = filter.toDate;
      }
    }

    const skip = (page - 1) * limit;
    const [orders, total] = await Promise.all([
      Order.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit),
      Order.countDocuments(query),
    ]);

    return {
      orders,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getOrderSummary(orderId: string): Promise<Record<string, unknown> | null> {
    const order = await Order.findByOrderId(orderId);
    return order?.toSummary() || null;
  }

  async getOrderStats(phoneNumber?: string): Promise<{
    totalOrders: number;
    totalSpent: number;
    pendingOrders: number;
    completedOrders: number;
  }> {
    const query = phoneNumber ? { phoneNumber } : {};

    const result = await Order.aggregate([
      { $match: query },
      {
        $group: {
          _id: null,
          totalOrders: { $sum: 1 },
          totalSpent: { $sum: '$totalAmount' },
          pendingOrders: {
            $sum: {
              $cond: [{ $in: ['$status', ['pending', 'confirmed', 'processing', 'shipped', 'out_for_delivery']] }, 1, 0],
            },
          },
          completedOrders: {
            $sum: { $cond: [{ $eq: ['$status', 'delivered'] }, 1, 0] },
          },
        },
      },
    ]);

    if (result.length === 0) {
      return {
        totalOrders: 0,
        totalSpent: 0,
        pendingOrders: 0,
        completedOrders: 0,
      };
    }

    return {
      totalOrders: result[0].totalOrders,
      totalSpent: result[0].totalSpent,
      pendingOrders: result[0].pendingOrders,
      completedOrders: result[0].completedOrders,
    };
  }

  async getRecentOrders(limit: number = 5): Promise<IOrder[]> {
    return Order.find()
      .sort({ createdAt: -1 })
      .limit(limit);
  }

  async getPendingOrders(): Promise<IOrder[]> {
    return Order.findPendingOrders();
  }

  private calculateEstimatedDelivery(deliveryType: DeliveryType): Date {
    const estimatedDelivery = new Date();
    switch (deliveryType) {
      case 'instant':
        estimatedDelivery.setHours(estimatedDelivery.getHours() + 2);
        break;
      case 'store_pickup':
        estimatedDelivery.setDate(estimatedDelivery.getDate() + 1);
        break;
      case 'home_delivery':
      default:
        estimatedDelivery.setDate(estimatedDelivery.getDate() + 3);
        break;
    }
    return estimatedDelivery;
  }

  private async syncOrderToOrderService(order: IOrder): Promise<void> {
    await this.internalApiClient.post(
      '/api/orders/sync',
      {
        orderId: order.orderId,
        cartId: order.cartId,
        userId: order.userId,
        phoneNumber: order.phoneNumber,
        items: order.items,
        totalAmount: order.totalAmount,
        currency: order.currency,
        status: order.status,
        deliveryType: order.deliveryType,
        deliveryAddress: order.deliveryAddress,
        source: order.source,
        createdAt: order.createdAt,
      },
      { headers: this.getInternalHeaders() }
    );
  }

  private async syncOrderStatus(orderId: string, status: string, additionalData?: Record<string, unknown>): Promise<void> {
    await this.internalApiClient.patch(
      `/api/orders/${orderId}/status`,
      { status, ...additionalData },
      { headers: this.getInternalHeaders() }
    );
  }

  async notifyOrderUpdate(orderId: string): Promise<boolean> {
    try {
      const order = await Order.findByOrderId(orderId);
      if (!order) return false;

      await this.internalApiClient.post(
        '/api/orders/notify',
        {
          orderId,
          phoneNumber: order.phoneNumber,
          status: order.status,
          message: this.getStatusUpdateMessage(order.status, order.orderId),
        },
        { headers: this.getInternalHeaders() }
      );

      return true;
    } catch (error) {
      logger.error('Error sending order notification', { error, orderId });
      return false;
    }
  }

  private getStatusUpdateMessage(status: OrderStatus, orderId: string): string {
    const messages: Record<OrderStatus, string> = {
      pending: `Your order ${orderId} is being prepared.`,
      confirmed: `Great news! Your order ${orderId} has been confirmed.`,
      processing: `Your order ${orderId} is being processed.`,
      shipped: `Your order ${orderId} has been shipped!`,
      out_for_delivery: `Your order ${orderId} is out for delivery.`,
      delivered: `Your order ${orderId} has been delivered. Enjoy!`,
      cancelled: `Your order ${orderId} has been cancelled.`,
      refunded: `Your refund for order ${orderId} has been processed.`,
      failed: `Payment for order ${orderId} failed. Please try again.`,
    };
    return messages[status] || `Update for order ${orderId}`;
  }
}

export const orderService = OrderService.getInstance();
export default orderService;
