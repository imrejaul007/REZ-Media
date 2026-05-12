import Redis from 'ioredis';
import mongoose from 'mongoose';
import { Order, IOrder, OrderStatus, PaymentStatus, PaymentMethod, IShippingAddress } from '../models/Order';
import { Cart } from '../models/Cart';
import { cartService } from './cartService';
import { catalogService } from './catalogService';
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

const WALLET_SERVICE_URL = process.env.WALLET_SERVICE_URL || 'http://localhost:4002';
const WALLET_SERVICE_TOKEN = process.env.WALLET_SERVICE_TOKEN || '';
const ORDER_SERVICE_URL = process.env.ORDER_SERVICE_URL || 'http://localhost:4001';

export interface CreateOrderRequest {
  customerId: string;
  customerPhone: string;
  merchantId: string;
  paymentMethod: PaymentMethod;
  shippingAddress: IShippingAddress;
  billingAddress?: IShippingAddress;
  notes?: string;
  source?: 'WHATSAPP' | 'WEB' | 'APP';
  whatsappMessageId?: string;
}

export interface UpdateOrderStatusRequest {
  orderId: string;
  status: OrderStatus;
  reason?: string;
}

export class OrderService {
  /**
   * Create order from cart
   */
  async createOrderFromCart(request: CreateOrderRequest): Promise<IOrder> {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Get cart
      const cart = await Cart.findOne({
        customerId: request.customerId,
        merchantId: request.merchantId,
        isActive: true,
      }).session(session);

      if (!cart || cart.items.length === 0) {
        throw new Error('Cart is empty or not found');
      }

      // Validate stock for all items
      for (const item of cart.items) {
        const stockCheck = await catalogService.checkStock(
          item.productId,
          item.variantId,
          item.quantity,
          request.merchantId
        );

        if (!stockCheck.available) {
          throw new Error(
            `Insufficient stock for ${item.name}. Available: ${stockCheck.currentStock}`
          );
        }
      }

      // Generate order IDs
      const orderId = uuidv4();
      const orderNumber = await Order.generateOrderNumber(request.merchantId);

      // Calculate totals from cart
      const subtotal = cart.subtotal;
      const tax = cart.tax;
      const discount = cart.discount;
      const discountCode = cart.discountCode;
      const deliveryFee = cart.deliveryFee;
      const total = cart.total;

      // Create order items
      const orderItems = cart.items.map((item) => ({
        productId: item.productId,
        variantId: item.variantId,
        name: item.name,
        sku: item.sku,
        image: item.image,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        totalPrice: item.totalPrice,
        variantName: item.variantName,
        metadata: item.metadata,
      }));

      // Initialize payment details based on method
      let paymentDetails: Record<string, unknown> = {};

      if (request.paymentMethod === 'WALLET') {
        // Validate wallet balance
        const walletValidation = await this.validateWalletBalance(
          request.customerId,
          total
        );

        if (!walletValidation.valid) {
          throw new Error(walletValidation.error);
        }

        paymentDetails = {
          transactionId: undefined,
          amount: total,
          currency: 'INR',
          status: 'PENDING',
        };
      } else if (request.paymentMethod === 'RAZORPAY') {
        paymentDetails = {
          orderId: undefined,
          paymentId: undefined,
          amount: total,
          currency: 'INR',
          status: 'PENDING',
        };
      }

      // Create order
      const order = new Order({
        orderId,
        orderNumber,
        customerId: request.customerId,
        customerPhone: request.customerPhone,
        merchantId: request.merchantId,
        items: orderItems,
        subtotal,
        tax,
        discount,
        discountCode,
        deliveryFee,
        total,
        currency: 'INR',
        status: 'PENDING',
        paymentStatus: request.paymentMethod === 'COD' ? 'PENDING' : 'AWAITING_PAYMENT',
        paymentMethod: request.paymentMethod,
        paymentDetails,
        shippingAddress: request.shippingAddress,
        billingAddress: request.billingAddress || request.shippingAddress,
        notes: request.notes,
        source: request.source || 'WHATSAPP',
        whatsappMessageId: request.whatsappMessageId,
        metadata: {
          cartId: cart.cartId,
          discountId: cart.metadata?.discountId,
        },
      });

      await order.save({ session });

      // Reserve stock for all items
      for (const item of cart.items) {
        await catalogService.reserveStock(
          item.productId,
          item.variantId,
          item.quantity,
          request.merchantId
        );
      }

      // Mark cart as checked out
      cart.isActive = false;
      cart.checkedOutAt = new Date();
      await cart.save({ session });

      await session.commitTransaction();

      // Invalidate cart cache
      await redis.del(`cart:${request.merchantId}:${request.customerId}`);

      return order;
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  /**
   * Get order by ID
   */
  async getOrderById(orderId: string, merchantId?: string): Promise<IOrder | null> {
    const query: Record<string, string> = { orderId };
    if (merchantId) {
      query.merchantId = merchantId;
    }

    return Order.findOne(query);
  }

  /**
   * Get order by order number
   */
  async getOrderByNumber(
    orderNumber: string,
    merchantId: string
  ): Promise<IOrder | null> {
    return Order.findOne({ orderNumber, merchantId });
  }

  /**
   * Get orders for customer
   */
  async getOrdersForCustomer(
    customerId: string,
    merchantId: string,
    options: {
      page?: number;
      limit?: number;
      status?: OrderStatus;
    } = {}
  ): Promise<{
    data: IOrder[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }> {
    const { page = 1, limit = 20, status } = options;

    const query: Record<string, unknown> = { customerId, merchantId };
    if (status) {
      query.status = status;
    }

    const skip = (page - 1) * limit;

    const [orders, total] = await Promise.all([
      Order.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit),
      Order.countDocuments(query),
    ]);

    return {
      data: orders,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get orders for merchant
   */
  async getOrdersForMerchant(
    merchantId: string,
    options: {
      page?: number;
      limit?: number;
      status?: OrderStatus;
      customerId?: string;
    } = {}
  ): Promise<{
    data: IOrder[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }> {
    const { page = 1, limit = 20, status, customerId } = options;

    const query: Record<string, unknown> = { merchantId };
    if (status) {
      query.status = status;
    }
    if (customerId) {
      query.customerId = customerId;
    }

    const skip = (page - 1) * limit;

    const [orders, total] = await Promise.all([
      Order.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit),
      Order.countDocuments(query),
    ]);

    return {
      data: orders,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Update order status
   */
  async updateOrderStatus(
    orderId: string,
    merchantId: string,
    newStatus: OrderStatus,
    reason?: string
  ): Promise<IOrder> {
    const order = await Order.findOne({ orderId, merchantId });

    if (!order) {
      throw new Error('Order not found');
    }

    if (!order.canTransitionTo(newStatus)) {
      throw new Error(
        `Cannot transition from ${order.status} to ${newStatus}`
      );
    }

    order.transitionStatus(newStatus);

    if (reason) {
      if (newStatus === 'CANCELLED') {
        order.cancellationReason = reason;
      } else if (newStatus === 'REFUNDED') {
        order.refundReason = reason;
      }
    }

    // If cancelled, release stock
    if (newStatus === 'CANCELLED') {
      for (const item of order.items) {
        await catalogService.releaseStock(
          item.productId,
          item.variantId,
          item.quantity,
          order.merchantId
        );
      }
    }

    await order.save();

    // Notify via WhatsApp if order status changed
    await this.sendOrderStatusNotification(order);

    return order;
  }

  /**
   * Update payment status
   */
  async updatePaymentStatus(
    orderId: string,
    newStatus: PaymentStatus,
    paymentDetails?: Record<string, unknown>
  ): Promise<IOrder> {
    const order = await Order.findOne({ orderId });

    if (!order) {
      throw new Error('Order not found');
    }

    if (!order.canPaymentTransitionTo(newStatus)) {
      throw new Error(
        `Cannot transition payment from ${order.paymentStatus} to ${newStatus}`
      );
    }

    order.paymentStatus = newStatus;

    if (paymentDetails) {
      order.paymentDetails = {
        ...(order.paymentDetails as Record<string, unknown>),
        ...paymentDetails,
      };
    }

    // If payment failed, potentially cancel the order
    if (newStatus === 'FAILED') {
      order.status = 'FAILED';
    }

    await order.save();

    return order;
  }

  /**
   * Process wallet payment
   */
  async processWalletPayment(
    orderId: string,
    customerId: string,
    amount: number
  ): Promise<{ success: boolean; transactionId?: string; error?: string }> {
    try {
      const response = await axios.post(
        `${WALLET_SERVICE_URL}/internal/debit`,
        {
          customerId,
          amount,
          orderId,
          description: `Payment for order ${orderId}`,
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'X-Internal-Token': WALLET_SERVICE_TOKEN,
          },
          timeout: 10000,
        }
      );

      if (response.data?.success) {
        // Update order payment details
        await this.updatePaymentStatus(orderId, 'PAID', {
          transactionId: response.data.transactionId,
          status: 'COMPLETED',
          walletBalanceBefore: response.data.balanceBefore,
          walletBalanceAfter: response.data.balanceAfter,
        });

        // Confirm the order
        await this.updateOrderStatus(orderId, '', 'CONFIRMED');

        return {
          success: true,
          transactionId: response.data.transactionId,
        };
      }

      return {
        success: false,
        error: response.data?.error || 'Payment failed',
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Validate wallet balance
   */
  async validateWalletBalance(
    customerId: string,
    amount: number
  ): Promise<{ valid: boolean; balance?: number; error?: string }> {
    try {
      const response = await axios.get(
        `${WALLET_SERVICE_URL}/internal/balance/${customerId}`,
        {
          headers: {
            'X-Internal-Token': WALLET_SERVICE_TOKEN,
          },
          timeout: 5000,
        }
      );

      const balance = response.data?.balance || 0;

      if (balance >= amount) {
        return { valid: true, balance };
      }

      return {
        valid: false,
        balance,
        error: `Insufficient wallet balance. Available: ${balance}, Required: ${amount}`,
      };
    } catch (error) {
      return {
        valid: false,
        error: 'Unable to verify wallet balance',
      };
    }
  }

  /**
   * Process refund
   */
  async processRefund(
    orderId: string,
    amount?: number,
    reason?: string
  ): Promise<{ success: boolean; refundId?: string; error?: string }> {
    const order = await Order.findOne({ orderId });

    if (!order) {
      return { success: false, error: 'Order not found' };
    }

    if (order.paymentStatus !== 'PAID') {
      return { success: false, error: 'Order is not in a refundable state' };
    }

    const refundAmount = amount || order.total;

    try {
      if (order.paymentMethod === 'WALLET') {
        // Credit to wallet
        const response = await axios.post(
          `${WALLET_SERVICE_URL}/internal/credit`,
          {
            customerId: order.customerId,
            amount: refundAmount,
            orderId,
            description: `Refund for order ${order.orderNumber}`,
          },
          {
            headers: {
              'Content-Type': 'application/json',
              'X-Internal-Token': WALLET_SERVICE_TOKEN,
            },
            timeout: 10000,
          }
        );

        if (response.data?.success) {
          await this.updatePaymentStatus(orderId, 'REFUNDED', {
            refundId: response.data.refundId,
            amount: refundAmount,
          });

          order.refundAmount = refundAmount;
          order.refundReason = reason;
          await order.save();

          return {
            success: true,
            refundId: response.data.refundId,
          };
        }

        return { success: false, error: 'Refund failed' };
      } else if (order.paymentMethod === 'RAZORPAY') {
        // Process via Razorpay refund
        // This will be handled by paymentService
        return { success: false, error: 'Razorpay refund not implemented in order service' };
      }

      return { success: false, error: 'Unsupported payment method for refund' };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Send order status notification via WhatsApp
   */
  private async sendOrderStatusNotification(order: IOrder): Promise<void> {
    // This will integrate with Twilio WhatsApp
    const twilioService = process.env.TWILIO_WHATSAPP_ENABLED === 'true';

    if (!twilioService) {
      return;
    }

    const statusMessages: Record<OrderStatus, string> = {
      PENDING: 'Your order has been received and is being processed.',
      CONFIRMED: 'Your order has been confirmed! We will notify you when it ships.',
      PROCESSING: 'Your order is being prepared for shipment.',
      SHIPPED: 'Great news! Your order has been shipped.',
      OUT_FOR_DELIVERY: 'Your order is out for delivery. Please be ready to receive it.',
      DELIVERED: 'Your order has been delivered. Thank you for shopping with us!',
      CANCELLED: 'Your order has been cancelled. If you have questions, please contact support.',
      REFUNDED: 'Your refund has been processed. Please allow 5-7 business days for the amount to reflect.',
      FAILED: 'There was an issue with your order. Our team will contact you shortly.',
    };

    const message = `Order ${order.orderNumber}: ${statusMessages[order.status]}`;

    // Send via WhatsApp (will be implemented in notification service)
    console.log(`WhatsApp notification for order ${order.orderNumber}: ${message}`);
  }

  /**
   * Get order statistics
   */
  async getOrderStatistics(
    merchantId: string,
    startDate: Date,
    endDate: Date
  ): Promise<{
    totalOrders: number;
    totalRevenue: number;
    averageOrderValue: number;
    ordersByStatus: Record<string, number>;
    topProducts: Array<{ productId: string; name: string; quantity: number }>;
  }> {
    const orders = await Order.find({
      merchantId,
      createdAt: { $gte: startDate, $lte: endDate },
    });

    const totalOrders = orders.length;
    const totalRevenue = orders
      .filter((o) => o.paymentStatus === 'PAID')
      .reduce((sum, o) => sum + o.total, 0);

    const ordersByStatus: Record<string, number> = {};
    for (const order of orders) {
      ordersByStatus[order.status] = (ordersByStatus[order.status] || 0) + 1;
    }

    // Calculate top products
    const productSales: Record<string, { name: string; quantity: number }> = {};
    for (const order of orders) {
      for (const item of order.items) {
        if (!productSales[item.productId]) {
          productSales[item.productId] = { name: item.name, quantity: 0 };
        }
        productSales[item.productId].quantity += item.quantity;
      }
    }

    const topProducts = Object.entries(productSales)
      .map(([productId, data]) => ({ productId, ...data }))
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 10);

    return {
      totalOrders,
      totalRevenue,
      averageOrderValue: totalOrders > 0 ? totalRevenue / totalOrders : 0,
      ordersByStatus,
      topProducts,
    };
  }
}

export const orderService = new OrderService();
