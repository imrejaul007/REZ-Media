/**
 * Wallet Routes - Top-up via Razorpay
 */

import { Router, Request, Response } from 'express';
import { razorpayService } from '../services/razorpay';
import { walletService } from '../services/walletService';
import { paymentService } from '../services/paymentService';
import { TransactionType, TransactionStatus } from '../models/Transaction';

export const walletRoutes = Router();

// ============================================================================
// Validation Schemas (using Zod-like validation)
// ============================================================================

interface ValidationError {
  field: string;
  message: string;
}

function validateTopupRequest(body: any): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!body.merchantId || typeof body.merchantId !== 'string') {
    errors.push({ field: 'merchantId', message: 'Valid merchant ID is required' });
  }

  if (!body.amount || typeof body.amount !== 'number') {
    errors.push({ field: 'amount', message: 'Amount is required and must be a number' });
  } else if (body.amount < 100) {
    errors.push({ field: 'amount', message: 'Minimum top-up amount is 100 paise (INR 1)' });
  } else if (body.amount > 100000000) {
    errors.push({ field: 'amount', message: 'Maximum top-up amount is INR 10,00,000' });
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

  return errors;
}

// ============================================================================
// POST /api/wallet/topup - Initiate wallet top-up
// ============================================================================

walletRoutes.post('/topup', async (req: Request, res: Response) => {
  try {
    const { merchantId, amount, idempotencyKey } = req.body;

    // Validate request
    const errors = validateTopupRequest(req.body);
    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        errors,
      });
    }

    // Create Razorpay order
    const order = await razorpayService.createWalletOrder(
      merchantId,
      amount,
      'INR',
      idempotencyKey || `wallet_topup_${merchantId}_${Date.now()}`
    );

    res.json({
      success: true,
      data: {
        orderId: order.orderId,
        amount: order.amount,
        currency: order.currency,
        receipt: order.receipt,
        status: order.status,
      },
    });
  } catch (error: any) {
    console.error('Wallet top-up error:', error);

    // Handle specific errors
    if (error.message.includes('Invalid')) {
      return res.status(400).json({
        success: false,
        error: error.message,
      });
    }

    res.status(500).json({
      success: false,
      error: 'Failed to create order. Please try again.',
    });
  }
});

// ============================================================================
// POST /api/wallet/verify - Verify payment and credit wallet
// ============================================================================

walletRoutes.post('/verify', async (req: Request, res: Response) => {
  try {
    const { orderId, paymentId, signature, merchantId, idempotencyKey } = req.body;

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

    // Get updated wallet balance
    const balance = await walletService.getBalance(merchantId || '');

    res.json({
      success: true,
      data: {
        message: 'Payment verified and wallet credited',
        transactionId: result.transactionId,
        merchantId,
        orderId,
        paymentId,
        newBalance: balance,
      },
    });
  } catch (error: any) {
    console.error('Wallet verify error:', error);
    res.status(500).json({
      success: false,
      error: 'Verification failed. Please try again.',
    });
  }
});

// ============================================================================
// GET /api/wallet/balance/:merchantId - Get wallet balance
// ============================================================================

walletRoutes.get('/balance/:merchantId', async (req: Request, res: Response) => {
  try {
    const { merchantId } = req.params;

    if (!merchantId) {
      return res.status(400).json({
        success: false,
        error: 'Merchant ID is required',
      });
    }

    const wallet = await walletService.getWalletDetails(merchantId);

    res.json({
      success: true,
      data: wallet,
    });
  } catch (error: any) {
    console.error('Get balance error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get balance',
    });
  }
});

// ============================================================================
// GET /api/wallet/transactions/:merchantId - Get transaction history
// ============================================================================

walletRoutes.get('/transactions/:merchantId', async (req: Request, res: Response) => {
  try {
    const { merchantId } = req.params;
    const { page = '1', limit = '20', type, status } = req.query;

    if (!merchantId) {
      return res.status(400).json({
        success: false,
        error: 'Merchant ID is required',
      });
    }

    const result = await walletService.getTransactions(merchantId, {
      page: parseInt(page as string, 10),
      limit: parseInt(limit as string, 10),
      type: type as TransactionType,
      status: status as TransactionStatus,
    });

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
// GET /api/wallet/summary/:merchantId - Get wallet summary
// ============================================================================

walletRoutes.get('/summary/:merchantId', async (req: Request, res: Response) => {
  try {
    const { merchantId } = req.params;

    if (!merchantId) {
      return res.status(400).json({
        success: false,
        error: 'Merchant ID is required',
      });
    }

    const summary = await walletService.getSummary(merchantId);

    res.json({
      success: true,
      data: summary,
    });
  } catch (error: any) {
    console.error('Get summary error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get summary',
    });
  }
});

// ============================================================================
// POST /api/wallet/credit - Manual credit (internal use)
// ============================================================================

walletRoutes.post('/credit', async (req: Request, res: Response) => {
  try {
    const { merchantId, amount, reference, description } = req.body;

    if (!merchantId || !amount || !reference) {
      return res.status(400).json({
        success: false,
        error: 'merchantId, amount, and reference are required',
      });
    }

    if (amount <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Amount must be positive',
      });
    }

    const result = await walletService.creditWallet(merchantId, amount, reference, description);

    res.json({
      success: true,
      data: {
        transactionId: result.transactionId,
        newBalance: result.balance,
      },
    });
  } catch (error: any) {
    console.error('Credit error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to credit wallet',
    });
  }
});

// ============================================================================
// POST /api/wallet/reserve - Reserve balance for pending operation
// ============================================================================

walletRoutes.post('/reserve', async (req: Request, res: Response) => {
  try {
    const { merchantId, amount, reference } = req.body;

    if (!merchantId || !amount || !reference) {
      return res.status(400).json({
        success: false,
        error: 'merchantId, amount, and reference are required',
      });
    }

    if (amount <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Amount must be positive',
      });
    }

    const result = await walletService.reserveBalance(merchantId, amount, reference);

    res.json({
      success: true,
      data: {
        reservationId: result.reservationId,
        availableBalance: result.availableBalance,
      },
    });
  } catch (error: any) {
    console.error('Reserve error:', error);

    if (error.message.includes('Insufficient')) {
      return res.status(400).json({
        success: false,
        error: error.message,
      });
    }

    res.status(500).json({
      success: false,
      error: 'Failed to reserve balance',
    });
  }
});
