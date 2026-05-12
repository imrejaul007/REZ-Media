import Redis from 'ioredis';
import axios from 'axios';
import crypto from 'crypto';
import { Order, PaymentStatus } from '../models/Order';
import { orderService } from './orderService';
import { WALLET_SERVICE_URL, WALLET_SERVICE_TOKEN } from './orderService';

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

// Razorpay types
interface RazorpayOrder {
  id: string;
  entity: string;
  amount: number;
  amount_paid: number;
  amount_due: number;
  currency: string;
  receipt: string;
  status: string;
  created_at: number;
}

interface RazorpayPayment {
  id: string;
  entity: string;
  order_id: string;
  amount: number;
  currency: string;
  status: string;
  method: string;
  card_id?: string;
  bank?: string;
  wallet?: string;
  vpa?: string;
  created_at: number;
}

interface RazorpayRefund {
  id: string;
  entity: string;
  payment_id: string;
  amount: number;
  currency: string;
  status: string;
  created_at: number;
}

// Initialize Razorpay
const Razorpay = require('razorpay');

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID || '',
  key_secret: process.env.RAZORPAY_KEY_SECRET || '',
});

const REPLAY_WINDOW = 24 * 60 * 60; // 24 hours in seconds

export interface InitiatePaymentRequest {
  orderId: string;
  customerId: string;
  customerPhone: string;
  amount: number;
  currency?: string;
  receipt?: string;
  notes?: Record<string, string>;
}

export interface PaymentVerificationRequest {
  orderId: string;
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
}

export interface CreateRefundRequest {
  orderId: string;
  amount?: number;
  speed?: 'normal' | 'optimum';
  notes?: Record<string, string>;
}

export class PaymentService {
  /**
   * Initiate Razorpay payment
   */
  async initiateRazorpayPayment(
    request: InitiatePaymentRequest
  ): Promise<{
    success: boolean;
    razorpayOrderId?: string;
    amount?: number;
    currency?: string;
    error?: string;
  }> {
    try {
      const order = await Order.findOne({ orderId: request.orderId });

      if (!order) {
        return { success: false, error: 'Order not found' };
      }

      if (order.paymentStatus === 'PAID') {
        return { success: false, error: 'Order already paid' };
      }

      // Create idempotency key
      const idempotencyKey = `razorpay:${request.orderId}`;

      // Check if we already have a pending razorpay order
      const existingRazorpayOrderId = (order.paymentDetails as Record<string, unknown>)?.orderId;

      if (existingRazorpayOrderId) {
        return {
          success: true,
          razorpayOrderId: existingRazorpayOrderId as string,
          amount: request.amount,
          currency: request.currency || 'INR',
        };
      }

      // Create Razorpay order
      const razorpayOrder = await razorpay.orders.create({
        amount: Math.round(request.amount * 100), // Razorpay uses paisa
        currency: request.currency || 'INR',
        receipt: request.receipt || request.orderId,
        notes: {
          orderId: request.orderId,
          customerId: request.customerId,
          customerPhone: request.customerPhone,
          ...request.notes,
        },
      });

      // Update order with Razorpay order ID
      order.paymentDetails = {
        ...(order.paymentDetails as Record<string, unknown>),
        orderId: razorpayOrder.id,
        amount: request.amount,
        currency: request.currency || 'INR',
        status: 'pending',
      };

      await order.save();

      // Store in Redis for quick lookup
      await redis.setex(
        `razorpay:order:${razorpayOrder.id}`,
        86400, // 24 hours
        request.orderId
      );

      return {
        success: true,
        razorpayOrderId: razorpayOrder.id,
        amount: request.amount,
        currency: request.currency || 'INR',
      };
    } catch (error) {
      console.error('Failed to initiate Razorpay payment:', error);
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Verify Razorpay payment signature
   */
  async verifyPayment(
    request: PaymentVerificationRequest
  ): Promise<{ success: boolean; order?: typeof Order.prototype; error?: string }> {
    try {
      const { orderId, razorpayOrderId, razorpayPaymentId, razorpaySignature } =
        request;

      // Check for replay attack
      const replayKey = `payment:${razorpayPaymentId}`;
      const isReplayed = await redis.get(replayKey);

      if (isReplayed) {
        return { success: false, error: 'Payment already processed (replay attack detected)' };
      }

      // Verify signature
      const payload = `${razorpayOrderId}|${razorpayPaymentId}`;
      const expectedSignature = crypto
        .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET || '')
        .update(payload)
        .digest('hex');

      if (razorpaySignature !== expectedSignature) {
        return { success: false, error: 'Invalid payment signature' };
      }

      // Fetch payment details from Razorpay to verify amount
      const payment = await razorpay.payments.fetch(razorpayPaymentId);

      if (payment.status !== 'captured') {
        return { success: false, error: `Payment not captured. Status: ${payment.status}` };
      }

      // Mark as processed to prevent replay
      await redis.setex(replayKey, REPLAY_WINDOW, orderId);

      // Update order payment status
      await orderService.updatePaymentStatus(orderId, 'PAID', {
        paymentId: razorpayPaymentId,
        orderId: razorpayOrderId,
        status: 'captured',
        method: payment.method,
        cardId: payment.card_id,
        bank: payment.bank,
        wallet: payment.wallet,
        vpa: payment.vpa,
      });

      // Confirm the order
      const order = await orderService.updateOrderStatus(orderId, '', 'CONFIRMED');

      return { success: true, order };
    } catch (error) {
      console.error('Failed to verify payment:', error);
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Get payment status
   */
  async getPaymentStatus(orderId: string): Promise<{
    status: PaymentStatus;
    razorpayOrderId?: string;
    razorpayPaymentId?: string;
    error?: string;
  }> {
    try {
      const order = await Order.findOne({ orderId });

      if (!order) {
        return { status: 'PENDING', error: 'Order not found' };
      }

      const paymentDetails = order.paymentDetails as Record<string, unknown>;

      return {
        status: order.paymentStatus,
        razorpayOrderId: paymentDetails?.orderId as string | undefined,
        razorpayPaymentId: paymentDetails?.paymentId as string | undefined,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      return { status: 'PENDING', error: errorMessage };
    }
  }

  /**
   * Create refund
   */
  async createRefund(request: CreateRefundRequest): Promise<{
    success: boolean;
    refundId?: string;
    amount?: number;
    error?: string;
  }> {
    try {
      const order = await Order.findOne({ orderId: request.orderId });

      if (!order) {
        return { success: false, error: 'Order not found' };
      }

      if (order.paymentStatus !== 'PAID') {
        return { success: false, error: 'Order is not in a refundable state' };
      }

      const paymentDetails = order.paymentDetails as Record<string, unknown>;
      const razorpayPaymentId = paymentDetails?.paymentId as string;

      if (!razorpayPaymentId) {
        return { success: false, error: 'No Razorpay payment found for this order' };
      }

      const refundAmount = request.amount || order.total;

      // Check for existing refund
      const existingRefundId = paymentDetails?.refundId;
      if (existingRefundId) {
        return {
          success: true,
          refundId: existingRefundId,
          amount: order.refundAmount || 0,
        };
      }

      // Create refund via Razorpay
      const refund = await razorpay.payments.refund(razorpayPaymentId, {
        amount: Math.round(refundAmount * 100), // Convert to paisa
        speed: request.speed || 'optimum',
        notes: request.notes,
      });

      // Update order
      order.paymentStatus = refund.amount === order.total ? 'REFUNDED' : 'PARTIALLY_REFUNDED';
      order.refundAmount = refund.amount / 100; // Convert back to rupees
      order.refundReason = request.notes?.reason;
      order.paymentDetails = {
        ...paymentDetails,
        refundId: refund.id,
      };

      await order.save();

      return {
        success: true,
        refundId: refund.id,
        amount: refund.amount / 100,
      };
    } catch (error) {
      console.error('Failed to create refund:', error);
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Get refund status
   */
  async getRefundStatus(refundId: string): Promise<{
    status: string;
    amount?: number;
    error?: string;
  }> {
    try {
      const refund = await razorpay.refunds.fetch(refundId);

      return {
        status: refund.status,
        amount: refund.amount / 100,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      return { status: 'unknown', error: errorMessage };
    }
  }

  /**
   * Process webhook from Razorpay
   */
  async handleWebhook(payload: {
    event: string;
    payload: {
      order?: { entity: RazorpayOrder };
      payment?: { entity: RazorpayPayment };
      refund?: { entity: RazorpayRefund };
    };
  }): Promise<{ success: boolean; error?: string }> {
    const { event, payload } = payload;

    try {
      switch (event) {
        case 'order.paid': {
          const razorpayOrder = payload.order?.entity;
          if (!razorpayOrder) {
            return { success: false, error: 'Missing order data' };
          }

          // Find order by Razorpay order ID
          const orderId = await redis.get(`razorpay:order:${razorpayOrder.id}`);

          if (orderId) {
            // Verify payment and update order
            await orderService.updatePaymentStatus(orderId, 'PAID', {
              paymentId: razorpayOrder.id,
              orderId: razorpayOrder.id,
              status: 'captured',
            });

            await orderService.updateOrderStatus(orderId, '', 'CONFIRMED');
          }
          break;
        }

        case 'payment.captured': {
          const payment = payload.payment?.entity;
          if (!payment) {
            return { success: false, error: 'Missing payment data' };
          }

          // Find order by Razorpay order ID
          const orderId = await redis.get(`razorpay:order:${payment.order_id}`);

          if (orderId) {
            await orderService.updatePaymentStatus(orderId, 'PAID', {
              paymentId: payment.id,
              orderId: payment.order_id,
              status: 'captured',
              method: payment.method,
            });

            await orderService.updateOrderStatus(orderId, '', 'CONFIRMED');
          }
          break;
        }

        case 'payment.failed': {
          const payment = payload.payment?.entity;
          if (!payment) {
            return { success: false, error: 'Missing payment data' };
          }

          // Find order by Razorpay order ID
          const orderId = await redis.get(`razorpay:order:${payment.order_id}`);

          if (orderId) {
            await orderService.updatePaymentStatus(orderId, 'FAILED', {
              paymentId: payment.id,
              orderId: payment.order_id,
              status: 'failed',
              error: payment.error_code,
            });
          }
          break;
        }

        case 'refund.created': {
          const refund = payload.refund?.entity;
          if (!refund) {
            return { success: false, error: 'Missing refund data' };
          }

          // Find order by Razorpay payment ID
          const order = await Order.findOne({
            'paymentDetails.paymentId': refund.payment_id,
          });

          if (order) {
            order.paymentStatus = 'REFUNDED';
            order.refundAmount = refund.amount / 100;
            order.paymentDetails = {
              ...(order.paymentDetails as Record<string, unknown>),
              refundId: refund.id,
            };
            await order.save();
          }
          break;
        }

        default:
          console.log(`Unhandled webhook event: ${event}`);
      }

      return { success: true };
    } catch (error) {
      console.error('Failed to handle webhook:', error);
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Get wallet balance
   */
  async getWalletBalance(customerId: string): Promise<{
    success: boolean;
    balance?: number;
    error?: string;
  }> {
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

      return {
        success: true,
        balance: response.data?.balance || 0,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Process wallet payment
   */
  async processWalletPayment(orderId: string, customerId: string): Promise<{
    success: boolean;
    transactionId?: string;
    error?: string;
  }> {
    const order = await Order.findOne({ orderId });

    if (!order) {
      return { success: false, error: 'Order not found' };
    }

    return orderService.processWalletPayment(orderId, customerId, order.total);
  }

  /**
   * Get payment methods available for customer
   */
  async getAvailablePaymentMethods(
    customerId: string,
    amount: number
  ): Promise<{
    methods: Array<{
      type: string;
      available: boolean;
      message?: string;
    }>;
  }> {
    const methods = [];

    // Check UPI/Card payment (always available via Razorpay)
    methods.push({
      type: 'RAZORPAY',
      available: true,
    });

    // Check wallet balance
    const walletBalance = await this.getWalletBalance(customerId);

    if (walletBalance.success) {
      methods.push({
        type: 'WALLET',
        available: walletBalance.balance! >= amount,
        message: walletBalance.balance! >= amount
          ? undefined
          : `Insufficient balance. Available: Rs. ${walletBalance.balance}`,
      });
    } else {
      methods.push({
        type: 'WALLET',
        available: false,
        message: 'Wallet service unavailable',
      });
    }

    // COD (check if merchant allows)
    // This would depend on merchant configuration
    methods.push({
      type: 'COD',
      available: true,
    });

    return { methods };
  }
}

export const paymentService = new PaymentService();
