/**
 * Ads Routes - Ad payment processing
 */

import { Router, Request, Response } from 'express';
import { razorpayService } from '../services/razorpay';
import { paymentService } from '../services/paymentService';
import { walletService } from '../services/walletService';

export const adsRoutes = Router();

// ============================================================================
// Validation
// ============================================================================

interface ValidationError {
  field: string;
  message: string;
}

function validatePayRequest(body: any): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!body.merchantId || typeof body.merchantId !== 'string') {
    errors.push({ field: 'merchantId', message: 'Valid merchant ID is required' });
  }

  if (!body.campaignId || typeof body.campaignId !== 'string') {
    errors.push({ field: 'campaignId', message: 'Campaign ID is required' });
  }

  if (!body.amount || typeof body.amount !== 'number') {
    errors.push({ field: 'amount', message: 'Amount is required and must be a number' });
  } else if (body.amount < 100) {
    errors.push({ field: 'amount', message: 'Minimum payment amount is 100 paise' });
  }

  return errors;
}

function validateVerifyRequest(body: any): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!body.orderId || typeof body.orderId !== 'string') {
    errors.push({ field: 'orderId', message: 'Order ID is required' });
  }

  if (!body.paymentId || typeof body.paymentId !== 'string') {
    errors.push({ field: 'paymentId', message: 'Payment ID is required' });
  }

  if (!body.signature || typeof body.signature !== 'string') {
    errors.push({ field: 'signature', message: 'Signature is required' });
  }

  if (!body.campaignId || typeof body.campaignId !== 'string') {
    errors.push({ field: 'campaignId', message: 'Campaign ID is required' });
  }

  return errors;
}

// ============================================================================
// POST /api/ads/pay - Initiate ad payment
// ============================================================================

adsRoutes.post('/pay', async (req: Request, res: Response) => {
  try {
    const { merchantId, campaignId, amount, idempotencyKey } = req.body;

    // Validate request
    const errors = validatePayRequest(req.body);
    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        errors,
      });
    }

    // Check wallet balance first
    const balance = await walletService.getBalance(merchantId);
    if (balance < amount) {
      return res.status(400).json({
        success: false,
        error: `Insufficient wallet balance. Available: ${balance}, Required: ${amount}`,
      });
    }

    // Process payment
    const order = await paymentService.processPayment({
      merchantId,
      amount,
      type: 'ad_payment',
      campaignId,
      idempotencyKey,
    });

    res.json({
      success: true,
      data: {
        orderId: order.orderId,
        amount: order.amount,
        currency: order.currency,
        campaignId,
        status: order.status,
      },
    });
  } catch (error: any) {
    console.error('Ad payment error:', error);

    if (error.message.includes('Insufficient')) {
      return res.status(400).json({
        success: false,
        error: error.message,
      });
    }

    res.status(500).json({
      success: false,
      error: 'Failed to create payment order',
    });
  }
});

// ============================================================================
// POST /api/ads/verify - Verify ad payment
// ============================================================================

adsRoutes.post('/verify', async (req: Request, res: Response) => {
  try {
    const { orderId, paymentId, signature, campaignId, merchantId, idempotencyKey } = req.body;

    // Validate request
    const errors = validateVerifyRequest(req.body);
    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        errors,
      });
    }

    // Verify signature
    const isValid = razorpayService.verifySignature(orderId, paymentId, signature);
    if (!isValid) {
      return res.status(400).json({
        success: false,
        error: 'Invalid signature',
      });
    }

    // Verify and process payment
    const result = await paymentService.verifyPayment({
      orderId,
      paymentId,
      signature,
      merchantId,
      idempotencyKey,
    });

    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: result.message,
      });
    }

    res.json({
      success: true,
      data: {
        message: 'Campaign payment verified',
        transactionId: result.transactionId,
        campaignId,
        status: 'active',
      },
    });
  } catch (error: any) {
    console.error('Ad verify error:', error);
    res.status(500).json({
      success: false,
      error: 'Verification failed',
    });
  }
});

// ============================================================================
// POST /api/ads/refund - Request refund
// ============================================================================

adsRoutes.post('/refund', async (req: Request, res: Response) => {
  try {
    const { paymentId, amount, merchantId, reason } = req.body;

    if (!paymentId) {
      return res.status(400).json({
        success: false,
        error: 'Payment ID is required',
      });
    }

    // Process refund
    const refund = await razorpayService.refundPayment(
      paymentId,
      amount,
      `ads_refund_${paymentId}_${Date.now()}`
    );

    res.json({
      success: true,
      data: {
        refundId: refund.refundId,
        paymentId: refund.paymentId,
        amount: refund.amount,
        status: refund.status,
        message: 'Refund initiated successfully',
      },
    });
  } catch (error: any) {
    console.error('Refund error:', error);

    if (error.message.includes('already been')) {
      return res.status(400).json({
        success: false,
        error: error.message,
      });
    }

    res.status(500).json({
      success: false,
      error: 'Refund failed',
    });
  }
});

// ============================================================================
// GET /api/ads/transactions/:merchantId - Get ad payment transactions
// ============================================================================

adsRoutes.get('/transactions/:merchantId', async (req: Request, res: Response) => {
  try {
    const { merchantId } = req.params;
    const { page = '1', limit = '20' } = req.query;

    const result = await paymentService.getMerchantTransactions(
      merchantId,
      {
        page: parseInt(page as string, 10),
        limit: parseInt(limit as string, 10),
      }
    );

    res.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    console.error('Get transactions error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get transactions',
    });
  }
});

// ============================================================================
// GET /api/ads/transaction/:transactionId - Get single transaction
// ============================================================================

adsRoutes.get('/transaction/:transactionId', async (req: Request, res: Response) => {
  try {
    const { transactionId } = req.params;

    const transaction = await paymentService.getTransaction(transactionId);

    if (!transaction) {
      return res.status(404).json({
        success: false,
        error: 'Transaction not found',
      });
    }

    res.json({
      success: true,
      data: transaction,
    });
  } catch (error: any) {
    console.error('Get transaction error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get transaction',
    });
  }
});
