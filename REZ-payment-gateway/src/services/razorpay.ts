/**
 * Razorpay Service - Full SDK Wrapper
 * Handles order creation, payment verification, payouts, and refunds
 */

import Razorpay from 'razorpay';
import crypto from 'crypto-js';
import { v4 as uuidv4 } from 'uuid';
import {
  CreateOrderParams,
  CreateOrderResponse,
  VerifyPaymentParams,
  VerifyPaymentResponse,
  CreatePayoutParams,
  CreatePayoutResponse,
  CreateRefundParams,
  CreateRefundResponse,
  WebhookVerificationResult,
  WalletOrderResult,
  AdPaymentOrderResult,
  PayoutResult,
  RefundResult,
} from '../types/razorpay';
import { Transaction, TransactionType, TransactionStatus } from '../models/Transaction';
import { walletService } from './walletService';
import { paymentService } from './paymentService';

// Initialize Razorpay instance
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID || '',
  key_secret: process.env.RAZORPAY_KEY_SECRET || '',
});

// Cache for idempotency keys (in production, use Redis)
const idempotencyCache = new Map<string, { result: any; timestamp: number }>();
const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Clean up expired idempotency entries
 */
function cleanupIdempotencyCache(): void {
  const now = Date.now();
  for (const [key, value] of idempotencyCache.entries()) {
    if (now - value.timestamp > IDEMPOTENCY_TTL_MS) {
      idempotencyCache.delete(key);
    }
  }
}

// Run cleanup every hour
setInterval(cleanupIdempotencyCache, 60 * 60 * 1000);

/**
 * Check idempotency key and return cached result if exists
 */
function getIdempotentResult<T>(idempotencyKey: string): T | null {
  const cached = idempotencyCache.get(idempotencyKey);
  if (cached && Date.now() - cached.timestamp < IDEMPOTENCY_TTL_MS) {
    return cached.result as T;
  }
  return null;
}

/**
 * Store result for idempotency key
 */
function setIdempotentResult<T>(idempotencyKey: string, result: T): void {
  idempotencyCache.set(idempotencyKey, {
    result,
    timestamp: Date.now(),
  });
}

export class RazorpayService {
  /**
   * Create a Razorpay order for wallet top-up
   */
  async createWalletOrder(
    merchantId: string,
    amount: number,
    currency: string = 'INR',
    idempotencyKey?: string
  ): Promise<WalletOrderResult> {
    const ik = idempotencyKey || `wallet_${merchantId}_${Date.now()}_${uuidv4()}`;

    // Check idempotency
    const cached = getIdempotentResult<WalletOrderResult>(ik);
    if (cached) {
      return cached;
    }

    try {
      // Validate inputs
      if (!merchantId || typeof merchantId !== 'string') {
        throw new Error('Invalid merchantId');
      }
      if (!amount || amount < 100) {
        throw new Error('Minimum amount is 100 paise (INR 1)');
      }
      if (amount > 100000000) {
        // 10 lakh INR max
        throw new Error('Maximum amount is INR 10,00,000');
      }

      // Amount must be in paise (Razorpay requirement)
      const amountInPaise = Math.round(amount);

      const orderParams = {
        amount: amountInPaise,
        currency,
        receipt: `wallet_rcpt_${merchantId}_${Date.now()}`,
        notes: {
          merchantId,
          type: 'wallet_topup',
          source: 'REZ-Payment-Gateway',
        },
        idempotencyKey: ik,
      };

      const order = await razorpay.orders.create(orderParams);

      // Store order in database
      const transaction = new Transaction({
        transactionId: order.id,
        merchantId,
        type: TransactionType.WALLET_TOPUP,
        amount: amountInPaise,
        status: TransactionStatus.PENDING,
        razorpayOrderId: order.id,
        metadata: {
          receipt: order.receipt,
          offerId: order.offer_id,
        },
      });
      await transaction.save();

      const result: WalletOrderResult = {
        orderId: order.id,
        amount: order.amount,
        currency: order.currency,
        receipt: order.receipt,
        status: order.status,
      };

      setIdempotentResult(ik, result);
      return result;
    } catch (error: any) {
      console.error('Razorpay createWalletOrder error:', {
        merchantId,
        amount,
        error: error.message,
        code: error.code,
      });

      // Handle specific Razorpay errors
      if (error.code === 'BAD_REQUEST_ERROR') {
        throw new Error(`Invalid order parameters: ${error.description}`);
      }
      if (error.code === 'GATEWAY_ERROR') {
        throw new Error('Payment gateway temporarily unavailable. Please try again.');
      }
      throw error;
    }
  }

  /**
   * Create a Razorpay order for ad payment
   */
  async createAdPaymentOrder(
    merchantId: string,
    campaignId: string,
    amount: number,
    currency: string = 'INR',
    idempotencyKey?: string
  ): Promise<AdPaymentOrderResult> {
    const ik = idempotencyKey || `ads_${merchantId}_${campaignId}_${Date.now()}_${uuidv4()}`;

    // Check idempotency
    const cached = getIdempotentResult<AdPaymentOrderResult>(ik);
    if (cached) {
      return cached;
    }

    try {
      // Validate inputs
      if (!merchantId || typeof merchantId !== 'string') {
        throw new Error('Invalid merchantId');
      }
      if (!campaignId || typeof campaignId !== 'string') {
        throw new Error('Invalid campaignId');
      }
      if (!amount || amount < 100) {
        throw new Error('Minimum amount is 100 paise');
      }

      const amountInPaise = Math.round(amount);

      const orderParams = {
        amount: amountInPaise,
        currency,
        receipt: `ads_rcpt_${campaignId}_${Date.now()}`,
        notes: {
          merchantId,
          campaignId,
          type: 'ad_payment',
          source: 'REZ-Payment-Gateway',
        },
        idempotencyKey: ik,
      };

      const order = await razorpay.orders.create(orderParams);

      // Store order in database
      const transaction = new Transaction({
        transactionId: order.id,
        merchantId,
        type: TransactionType.AD_PAYMENT,
        amount: amountInPaise,
        status: TransactionStatus.PENDING,
        razorpayOrderId: order.id,
        metadata: {
          campaignId,
          receipt: order.receipt,
        },
      });
      await transaction.save();

      const result: AdPaymentOrderResult = {
        orderId: order.id,
        amount: order.amount,
        currency: order.currency,
        receipt: order.receipt,
        campaignId,
        status: order.status,
      };

      setIdempotentResult(ik, result);
      return result;
    } catch (error: any) {
      console.error('Razorpay createAdPaymentOrder error:', {
        merchantId,
        campaignId,
        amount,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Verify payment signature from client-side
   */
  async verifyPayment(params: VerifyPaymentParams): Promise<VerifyPaymentResponse> {
    const { orderId, paymentId, signature, merchantId, amount } = params;

    try {
      // Validate inputs
      if (!orderId || !paymentId || !signature) {
        throw new Error('Missing required signature parameters');
      }

      // Generate expected signature
      const payload = `${orderId}|${paymentId}`;
      const expectedSignature = crypto.HmacSHA256(payload, process.env.RAZORPAY_KEY_SECRET || '');
      const isValid = signature === expectedSignature.toString();

      if (!isValid) {
        // Log failed verification attempt
        console.warn('Payment signature verification failed:', {
          orderId,
          paymentId,
          merchantId,
        });

        return {
          valid: false,
          error: 'Invalid payment signature',
        };
      }

      // Fetch payment from Razorpay to verify amount
      const payment = await razorpay.payments.fetch(paymentId);

      if (payment.status !== 'captured') {
        return {
          valid: false,
          error: `Payment not captured. Status: ${payment.status}`,
        };
      }

      if (amount && payment.amount !== amount) {
        console.warn('Payment amount mismatch:', {
          expected: amount,
          actual: payment.amount,
          paymentId,
        });
        return {
          valid: false,
          error: 'Payment amount mismatch',
        };
      }

      // Update transaction status
      await Transaction.findOneAndUpdate(
        { razorpayOrderId: orderId },
        {
          status: TransactionStatus.COMPLETED,
          razorpayPaymentId: paymentId,
          completedAt: new Date(),
        }
      );

      return {
        valid: true,
        paymentId: payment.id,
        orderId: payment.order_id,
        amount: payment.amount,
        status: payment.status,
      };
    } catch (error: any) {
      console.error('Payment verification error:', error);
      throw error;
    }
  }

  /**
   * Verify signature for order payment (utility method used by routes)
   */
  verifySignature(orderId: string, paymentId: string, signature: string): boolean {
    if (!orderId || !paymentId || !signature) {
      return false;
    }

    const payload = `${orderId}|${paymentId}`;
    const expectedSignature = crypto.HmacSHA256(payload, process.env.RAZORPAY_KEY_SECRET || '');
    return signature === expectedSignature.toString();
  }

  /**
   * Create a payout to merchant's bank account
   */
  async createPayout(
    merchantId: string,
    accountNumber: string,
    ifsc: string,
    amount: number,
    name: string,
    idempotencyKey?: string
  ): Promise<PayoutResult> {
    const ik = idempotencyKey || `payout_${merchantId}_${Date.now()}_${uuidv4()}`;

    // Check idempotency
    const cached = getIdempotentResult<PayoutResult>(ik);
    if (cached) {
      return cached;
    }

    try {
      // Validate inputs
      if (!merchantId || typeof merchantId !== 'string') {
        throw new Error('Invalid merchantId');
      }
      if (!accountNumber || accountNumber.length < 9 || accountNumber.length > 18) {
        throw new Error('Invalid account number');
      }
      if (!ifsc || !/^[A-Z]{4}0[A-Z0-9]{6}$/i.test(ifsc)) {
        throw new Error('Invalid IFSC code');
      }
      if (!amount || amount < 100) {
        throw new Error('Minimum payout amount is 100 paise');
      }
      if (!name || name.length < 2) {
        throw new Error('Invalid beneficiary name');
      }

      // Check wallet balance before payout
      const balance = await walletService.getBalance(merchantId);
      if (balance < amount) {
        throw new Error(`Insufficient wallet balance. Available: ${balance}, Requested: ${amount}`);
      }

      const amountInPaise = Math.round(amount);

      // Create fund account (in production, store and reuse)
      const fundAccountParams = {
        account_type: 'bank_account',
        bank_account: {
          name: name,
          ifsc: ifsc.toUpperCase(),
          account_number: accountNumber,
        },
        contact: {
          name: name,
          type: 'vendor',
        },
      };

      const fundAccount = await razorpay.fundAccounts.create(fundAccountParams);

      // Create payout
      const payoutParams = {
        account_number: process.env.RAZORPAY_FUND_ACCOUNT_ID || '',
        to_fund_account_id: fundAccount.id,
        amount: amountInPaise,
        currency: 'INR',
        mode: 'UPI',
        purpose: 'payout',
        notes: {
          merchantId,
          source: 'REZ-Payment-Gateway',
        },
        idempotencyKey: ik,
      };

      const payout = await razorpay.payouts.create(payoutParams);

      // Store payout transaction
      const transaction = new Transaction({
        transactionId: payout.id,
        merchantId,
        type: TransactionType.PAYOUT,
        amount: amountInPaise,
        status: TransactionStatus.PROCESSING,
        razorpayPayoutId: payout.id,
        metadata: {
          fundAccountId: fundAccount.id,
          ifsc,
          accountNumber: accountNumber.slice(-4), // Store last 4 digits only
          name,
        },
      });
      await transaction.save();

      // Debit wallet
      await walletService.debitWallet(merchantId, amountInPaise, `payout_${payout.id}`);

      const result: PayoutResult = {
        payoutId: payout.id,
        amount: payout.amount,
        status: payout.status,
        createdAt: payout.created_at,
      };

      setIdempotencyResult(ik, result);
      return result;
    } catch (error: any) {
      console.error('Payout creation error:', error);

      // Handle specific errors
      if (error.code === 'BAD_REQUEST_ERROR') {
        if (error.description?.includes('balance')) {
          throw new Error('Insufficient account balance for payout');
        }
        throw new Error(`Payout failed: ${error.description}`);
      }

      throw error;
    }
  }

  /**
   * Refund a payment
   */
  async refundPayment(
    paymentId: string,
    amount?: number,
    idempotencyKey?: string
  ): Promise<RefundResult> {
    const ik = idempotencyKey || `refund_${paymentId}_${Date.now()}_${uuidv4()}`;

    // Check idempotency
    const cached = getIdempotentResult<RefundResult>(ik);
    if (cached) {
      return cached;
    }

    try {
      // Validate inputs
      if (!paymentId || typeof paymentId !== 'string') {
        throw new Error('Invalid payment ID');
      }

      // Fetch original payment
      const payment = await razorpay.payments.fetch(paymentId);

      if (payment.status !== 'captured') {
        throw new Error(`Cannot refund payment with status: ${payment.status}`);
      }

      // If amount not specified, refund full amount
      const refundAmount = amount
        ? Math.min(amount, payment.amount)
        : payment.amount;

      if (refundAmount < 100) {
        throw new Error('Minimum refund amount is 100 paise');
      }

      const refundParams: any = {
        amount: refundAmount,
        notes: {
          reason: 'Customer initiated refund',
          source: 'REZ-Payment-Gateway',
        },
        idempotencyKey: ik,
      };

      const refund = await razorpay.refunds.create(refundParams);

      // Update transaction record
      const transaction = await Transaction.findOneAndUpdate(
        { razorpayPaymentId: paymentId },
        {
          $push: {
            refunds: {
              refundId: refund.id,
              amount: refund.amount,
              status: refund.status,
              createdAt: new Date(),
            },
          },
        }
      );

      // Credit wallet for refund amount
      if (transaction) {
        await walletService.creditWallet(
          transaction.merchantId,
          refundAmount,
          `refund_${refund.id}`,
          'Payment refund'
        );
      }

      const result: RefundResult = {
        refundId: refund.id,
        paymentId: refund.payment_id,
        amount: refund.amount,
        status: refund.status,
        speedProcessed: refund.speed_processed,
      };

      setIdempotentResult(ik, result);
      return result;
    } catch (error: any) {
      console.error('Refund error:', error);

      if (error.code === 'BAD_REQUEST_ERROR') {
        if (error.description?.includes('already been')) {
          throw new Error('Refund already processed for this payment');
        }
        throw new Error(`Refund failed: ${error.description}`);
      }

      throw error;
    }
  }

  /**
   * Fetch payment details
   */
  async getPayment(paymentId: string): Promise<any> {
    try {
      if (!paymentId) {
        throw new Error('Payment ID is required');
      }
      return await razorpay.payments.fetch(paymentId);
    } catch (error: any) {
      console.error('Fetch payment error:', error);
      throw error;
    }
  }

  /**
   * Fetch order details
   */
  async getOrder(orderId: string): Promise<any> {
    try {
      if (!orderId) {
        throw new Error('Order ID is required');
      }
      return await razorpay.orders.fetch(orderId);
    } catch (error: any) {
      console.error('Fetch order error:', error);
      throw error;
    }
  }

  /**
   * Verify webhook signature
   */
  verifyWebhookSignature(payload: string, signature: string): WebhookVerificationResult {
    try {
      if (!payload || !signature) {
        return {
          valid: false,
          error: 'Missing payload or signature',
        };
      }

      const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
      if (!webhookSecret) {
        console.error('RAZORPAY_WEBHOOK_SECRET not configured');
        return {
          valid: false,
          error: 'Webhook secret not configured',
        };
      }

      const expectedSignature = crypto.HmacSHA256(payload, webhookSecret);
      const isValid = signature === expectedSignature.toString();

      return {
        valid: isValid,
        error: isValid ? undefined : 'Invalid webhook signature',
      };
    } catch (error: any) {
      console.error('Webhook verification error:', error);
      return {
        valid: false,
        error: error.message,
      };
    }
  }

  /**
   * Handle webhook event
   */
  async handleWebhookEvent(event: string, payload: any): Promise<void> {
    console.log(`Processing webhook event: ${event}`);

    try {
      switch (event) {
        case 'payment.captured':
          await paymentService.handlePaymentCaptured(payload);
          break;

        case 'payment.failed':
          await paymentService.handlePaymentFailed(payload);
          break;

        case 'order.paid':
          await paymentService.handleOrderPaid(payload);
          break;

        case 'payout.processed':
          await paymentService.handlePayoutProcessed(payload);
          break;

        case 'payout.failed':
          await paymentService.handlePayoutFailed(payload);
          break;

        case 'refund.created':
          await paymentService.handleRefundCreated(payload);
          break;

        case 'refund.processed':
          await paymentService.handleRefundProcessed(payload);
          break;

        default:
          console.log(`Unhandled webhook event: ${event}`);
      }
    } catch (error: any) {
      console.error(`Error processing webhook ${event}:`, error);
      throw error;
    }
  }

  /**
   * Get transaction status
   */
  async getTransactionStatus(orderId: string): Promise<{
    orderId: string;
    status: string;
    payments: any[];
  }> {
    try {
      const order = await razorpay.orders.fetch(orderId);
      const payments = order.amount_paid > 0
        ? await razorpay.orders.fetchPayments(orderId)
        : { items: [] };

      return {
        orderId: order.id,
        status: order.status,
        payments: payments.items || [],
      };
    } catch (error: any) {
      console.error('Get transaction status error:', error);
      throw error;
    }
  }
}

export const razorpayService = new RazorpayService();
export default razorpayService;
