/**
 * Payment Service - Core Payment Logic
 * Handles payment processing, webhook handling, and idempotency
 */

import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto-js';
import {
  Transaction,
  TransactionType,
  TransactionStatus,
  ITransaction,
} from '../models/Transaction';
import { walletService } from './walletService';
import { razorpayService } from './razorpay';

// ============================================================================
// Idempotency Cache (In production, use Redis)
// ============================================================================

interface IdempotentEntry {
  result: any;
  timestamp: number;
  requestHash: string;
}

const idempotencyStore = new Map<string, IdempotentEntry>();
const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Clean up expired idempotency entries
 */
function cleanupIdempotency(): void {
  const now = Date.now();
  for (const [key, entry] of idempotencyStore.entries()) {
    if (now - entry.timestamp > IDEMPOTENCY_TTL_MS) {
      idempotencyStore.delete(key);
    }
  }
}

// Run cleanup every hour
setInterval(cleanupIdempotency, 60 * 60 * 1000);

/**
 * Get or check idempotent result
 */
async function checkIdempotency<T>(idempotencyKey: string, requestBody: any): Promise<T | null> {
  const entry = idempotencyStore.get(idempotencyKey);

  if (!entry) {
    return null;
  }

  // Verify request body matches
  const currentHash = crypto.SHA256(JSON.stringify(requestBody)).toString();
  if (entry.requestHash !== currentHash) {
    throw new Error('Idempotency key already used with different request body');
  }

  // Check if expired
  if (Date.now() - entry.timestamp > IDEMPOTENCY_TTL_MS) {
    idempotencyStore.delete(idempotencyKey);
    return null;
  }

  return entry.result as T;
}

/**
 * Store idempotent result
 */
function storeIdempotency<T>(idempotencyKey: string, requestBody: any, result: T): void {
  idempotencyStore.set(idempotencyKey, {
    result,
    timestamp: Date.now(),
    requestHash: crypto.SHA256(JSON.stringify(requestBody)).toString(),
  });
}

// ============================================================================
// Webhook Event Deduplication
// ============================================================================

const webhookEventCache = new Map<string, number>();
const WEBHOOK_DEDUP_WINDOW_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Check and mark webhook event as processed
 */
function isWebhookEventProcessed(eventId: string): boolean {
  const timestamp = webhookEventCache.get(eventId);
  if (!timestamp) {
    webhookEventCache.set(eventId, Date.now());
    return false;
  }

  // If within dedup window, return true (already processed)
  if (Date.now() - timestamp < WEBHOOK_DEDUP_WINDOW_MS) {
    return true;
  }

  // If outside window, update timestamp
  webhookEventCache.set(eventId, Date.now());
  return false;
}

// ============================================================================
// Payment Service
// ============================================================================

export class PaymentService {
  /**
   * Process a payment order
   */
  async processPayment(params: {
    merchantId: string;
    amount: number;
    type: 'wallet_topup' | 'ad_payment';
    campaignId?: string;
    idempotencyKey?: string;
    metadata?: Record<string, any>;
  }): Promise<{
    orderId: string;
    amount: number;
    currency: string;
    status: string;
  }> {
    const { merchantId, amount, type, campaignId, idempotencyKey, metadata } = params;

    // Validate inputs
    if (!merchantId) {
      throw new Error('Merchant ID is required');
    }
    if (!amount || amount < 100) {
      throw new Error('Minimum amount is 100 paise');
    }

    // Check idempotency
    const ik = idempotencyKey || `pay_${merchantId}_${Date.now()}_${uuidv4()}`;
    const cachedResult = await checkIdempotency(ik, { merchantId, amount, type });
    if (cachedResult) {
      return cachedResult as any;
    }

    try {
      let orderResult;

      if (type === 'wallet_topup') {
        orderResult = await razorpayService.createWalletOrder(merchantId, amount, 'INR', ik);
      } else if (type === 'ad_payment') {
        if (!campaignId) {
          throw new Error('Campaign ID is required for ad payment');
        }
        orderResult = await razorpayService.createAdPaymentOrder(
          merchantId,
          campaignId,
          amount,
          'INR',
          ik
        );
      } else {
        throw new Error(`Unknown payment type: ${type}`);
      }

      // Store result for idempotency
      storeIdempotency(ik, { merchantId, amount, type }, orderResult);

      return orderResult;
    } catch (error: any) {
      console.error('Process payment error:', error);
      throw error;
    }
  }

  /**
   * Verify and complete payment
   */
  async verifyPayment(params: {
    orderId: string;
    paymentId: string;
    signature: string;
    merchantId?: string;
    amount?: number;
    idempotencyKey?: string;
  }): Promise<{
    success: boolean;
    transactionId?: string;
    message: string;
  }> {
    const { orderId, paymentId, signature, merchantId, amount, idempotencyKey } = params;

    // Check idempotency
    const ik = idempotencyKey || `verify_${orderId}_${paymentId}`;
    const cachedResult = await checkIdempotency(ik, { orderId, paymentId });
    if (cachedResult) {
      return cachedResult as any;
    }

    try {
      // Verify signature
      const verificationResult = await razorpayService.verifyPayment({
        orderId,
        paymentId,
        signature,
        merchantId,
        amount,
      });

      if (!verificationResult.valid) {
        const result = {
          success: false,
          message: verificationResult.error || 'Verification failed',
        };
        storeIdempotency(ik, { orderId, paymentId }, result);
        return result;
      }

      // Get transaction from database
      const transaction = await Transaction.findOne({ razorpayOrderId: orderId });

      if (!transaction) {
        // Create transaction if not exists (should exist from order creation)
        const newTransaction = new Transaction({
          transactionId: `txn_${uuidv4().replace(/-/g, '').slice(0, 16)}`,
          merchantId: merchantId || 'unknown',
          type: TransactionType.WALLET_TOPUP,
          amount: amount || verificationResult.amount || 0,
          currency: 'INR',
          status: TransactionStatus.COMPLETED,
          razorpayOrderId: orderId,
          razorpayPaymentId: paymentId,
          completedAt: new Date(),
        });
        await newTransaction.save();

        const result = {
          success: true,
          transactionId: newTransaction.transactionId,
          message: 'Payment verified and transaction created',
        };
        storeIdempotency(ik, { orderId, paymentId }, result);
        return result;
      }

      // Mark existing transaction as completed
      if (transaction.status !== TransactionStatus.COMPLETED) {
        transaction.status = TransactionStatus.COMPLETED;
        transaction.razorpayPaymentId = paymentId;
        transaction.completedAt = new Date();
        await transaction.save();

        // Credit wallet for wallet top-ups
        if (transaction.type === TransactionType.WALLET_TOPUP) {
          await walletService.creditWallet(
            transaction.merchantId,
            transaction.amount,
            `payment_${paymentId}`,
            'Wallet top-up via payment'
          );
        }
      }

      const result = {
        success: true,
        transactionId: transaction.transactionId,
        message: 'Payment verified successfully',
      };
      storeIdempotency(ik, { orderId, paymentId }, result);
      return result;
    } catch (error: any) {
      console.error('Verify payment error:', error);
      throw error;
    }
  }

  /**
   * Handle webhook - payment captured
   */
  async handlePaymentCaptured(payload: any): Promise<void> {
    const payment = payload?.payment?.entity;
    if (!payment) {
      console.error('Invalid payload for payment.captured event');
      return;
    }

    const { id: paymentId, order_id: orderId, amount } = payment;

    // Deduplicate webhook events
    if (isWebhookEventProcessed(`payment_captured_${paymentId}`)) {
      console.log(`Duplicate payment.captured event for payment: ${paymentId}`);
      return;
    }

    try {
      // Find transaction
      let transaction = await Transaction.findOne({ razorpayOrderId: orderId });

      if (!transaction) {
        // Create transaction if not found
        transaction = new Transaction({
          transactionId: `txn_${uuidv4().replace(/-/g, '').slice(0, 16)}`,
          merchantId: payment.notes?.merchantId || 'unknown',
          type: payment.notes?.type === 'ad_payment'
            ? TransactionType.AD_PAYMENT
            : TransactionType.WALLET_TOPUP,
          amount,
          currency: payment.currency || 'INR',
          status: TransactionStatus.COMPLETED,
          razorpayOrderId: orderId,
          razorpayPaymentId: paymentId,
          metadata: {
            webhookSource: true,
            capturedAt: new Date(),
          },
          completedAt: new Date(),
        });
        await transaction.save();
      } else if (transaction.status !== TransactionStatus.COMPLETED) {
        transaction.status = TransactionStatus.COMPLETED;
        transaction.razorpayPaymentId = paymentId;
        transaction.completedAt = new Date();
        await transaction.save();
      }

      // Credit wallet if this is a wallet top-up
      if (transaction.type === TransactionType.WALLET_TOPUP) {
        await walletService.creditWallet(
          transaction.merchantId,
          amount,
          `webhook_${paymentId}`,
          'Wallet top-up'
        );
      }

      console.log(`Payment captured successfully: ${paymentId}, Amount: ${amount}`);
    } catch (error: any) {
      console.error('Error handling payment.captured:', error);
      throw error; // Re-throw to trigger webhook retry
    }
  }

  /**
   * Handle webhook - payment failed
   */
  async handlePaymentFailed(payload: any): Promise<void> {
    const payment = payload?.payment?.entity;
    if (!payment) {
      console.error('Invalid payload for payment.failed event');
      return;
    }

    const { id: paymentId, order_id: orderId, error_code, error_description } = payment;

    // Deduplicate
    if (isWebhookEventProcessed(`payment_failed_${paymentId}`)) {
      console.log(`Duplicate payment.failed event for payment: ${paymentId}`);
      return;
    }

    try {
      const transaction = await Transaction.findOne({ razorpayOrderId: orderId });

      if (transaction && transaction.status !== TransactionStatus.FAILED) {
        transaction.status = TransactionStatus.FAILED;
        transaction.error = {
          code: error_code || 'PAYMENT_FAILED',
          message: error_description || 'Payment failed',
        };
        transaction.failedAt = new Date();
        await transaction.save();

        console.log(`Payment failed: ${paymentId}, Error: ${error_description}`);
      }
    } catch (error: any) {
      console.error('Error handling payment.failed:', error);
      throw error;
    }
  }

  /**
   * Handle webhook - order paid
   */
  async handleOrderPaid(payload: any): Promise<void> {
    const order = payload?.order?.entity;
    if (!order) {
      console.error('Invalid payload for order.paid event');
      return;
    }

    const { id: orderId, status } = order;

    if (isWebhookEventProcessed(`order_paid_${orderId}`)) {
      return;
    }

    console.log(`Order paid: ${orderId}, Status: ${status}`);
    // Order paid typically follows payment.captured, so additional handling may not be needed
  }

  /**
   * Handle webhook - payout processed
   */
  async handlePayoutProcessed(payload: any): Promise<void> {
    const payout = payload?.payout?.entity;
    if (!payout) {
      console.error('Invalid payload for payout.processed event');
      return;
    }

    const { id: payoutId, status, amount, failure_reason } = payout;

    if (isWebhookEventProcessed(`payout_processed_${payoutId}`)) {
      return;
    }

    try {
      const transaction = await Transaction.findOne({ razorpayPayoutId: payoutId });

      if (transaction) {
        if (status === 'processed') {
          transaction.status = TransactionStatus.COMPLETED;
        } else if (status === 'failed') {
          transaction.status = TransactionStatus.FAILED;
          transaction.error = {
            code: 'PAYOUT_FAILED',
            message: failure_reason || 'Payout failed',
          };
          transaction.failedAt = new Date();

          // Reverse the wallet debit if payout failed
          await walletService.creditWallet(
            transaction.merchantId,
            transaction.amount,
            `payout_reversal_${payoutId}`,
            'Payout failure reversal'
          );
        }
        await transaction.save();

        console.log(`Payout ${status}: ${payoutId}, Amount: ${amount}`);
      }
    } catch (error: any) {
      console.error('Error handling payout.processed:', error);
      throw error;
    }
  }

  /**
   * Handle webhook - payout failed
   */
  async handlePayoutFailed(payload: any): Promise<void> {
    const payout = payload?.payout?.entity;
    if (!payout) {
      console.error('Invalid payload for payout.failed event');
      return;
    }

    const { id: payoutId, failure_reason } = payout;

    if (isWebhookEventProcessed(`payout_failed_${payoutId}`)) {
      return;
    }

    try {
      const transaction = await Transaction.findOne({ razorpayPayoutId: payoutId });

      if (transaction) {
        transaction.status = TransactionStatus.FAILED;
        transaction.error = {
          code: 'PAYOUT_FAILED',
          message: failure_reason || 'Payout failed',
        };
        transaction.failedAt = new Date();
        await transaction.save();

        // Reverse the wallet debit
        await walletService.creditWallet(
          transaction.merchantId,
          transaction.amount,
          `payout_reversal_${payoutId}`,
          'Payout failure reversal'
        );

        console.log(`Payout failed: ${payoutId}, Reason: ${failure_reason}`);
      }
    } catch (error: any) {
      console.error('Error handling payout.failed:', error);
      throw error;
    }
  }

  /**
   * Handle webhook - refund created
   */
  async handleRefundCreated(payload: any): Promise<void> {
    const refund = payload?.refund?.entity;
    if (!refund) {
      console.error('Invalid payload for refund.created event');
      return;
    }

    const { id: refundId, payment_id: paymentId, amount, status } = refund;

    if (isWebhookEventProcessed(`refund_created_${refundId}`)) {
      return;
    }

    try {
      const transaction = await Transaction.findOne({ razorpayPaymentId: paymentId });

      if (transaction) {
        await transaction.addRefund({
          refundId,
          amount,
          status,
          createdAt: new Date(),
        });

        // Credit wallet
        await walletService.creditWallet(
          transaction.merchantId,
          amount,
          `refund_${refundId}`,
          'Payment refund'
        );

        console.log(`Refund created: ${refundId}, Amount: ${amount}`);
      }
    } catch (error: any) {
      console.error('Error handling refund.created:', error);
      throw error;
    }
  }

  /**
   * Handle webhook - refund processed
   */
  async handleRefundProcessed(payload: any): Promise<void> {
    const refund = payload?.refund?.entity;
    if (!refund) {
      console.error('Invalid payload for refund.processed event');
      return;
    }

    const { id: refundId, status } = refund;

    if (isWebhookEventProcessed(`refund_processed_${refundId}`)) {
      return;
    }

    console.log(`Refund processed: ${refundId}, Status: ${status}`);
    // Refund processing is already handled in refund.created
  }

  /**
   * Get transaction by ID
   */
  async getTransaction(transactionId: string): Promise<ITransaction | null> {
    return Transaction.findOne({ transactionId });
  }

  /**
   * Get transactions for a merchant
   */
  async getMerchantTransactions(
    merchantId: string,
    options: {
      page?: number;
      limit?: number;
      type?: TransactionType;
      status?: TransactionStatus;
    } = {}
  ): Promise<{
    transactions: ITransaction[];
    total: number;
    page: number;
    limit: number;
    hasMore: boolean;
  }> {
    return Transaction.findByMerchant(merchantId, options);
  }
}

export const paymentService = new PaymentService();
export default paymentService;
