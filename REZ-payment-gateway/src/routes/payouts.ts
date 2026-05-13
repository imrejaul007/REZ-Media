/**
 * Payouts Routes - Merchant payouts
 */

import { Router, Request, Response } from 'express';
import Razorpay from 'razorpay';
import { razorpayService } from '../services/razorpay';
import { walletService } from '../services/walletService';
import { TransactionType } from '../models/Transaction';

// Initialize Razorpay for direct API calls
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID || '',
  key_secret: process.env.RAZORPAY_KEY_SECRET || '',
});

export const payoutsRoutes = Router();

// ============================================================================
// Validation
// ============================================================================

interface ValidationError {
  field: string;
  message: string;
}

function validatePayoutRequest(body: any): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!body.merchantId || typeof body.merchantId !== 'string') {
    errors.push({ field: 'merchantId', message: 'Valid merchant ID is required' });
  }

  if (!body.accountNumber || typeof body.accountNumber !== 'string') {
    errors.push({ field: 'accountNumber', message: 'Account number is required' });
  } else if (body.accountNumber.length < 9 || body.accountNumber.length > 18) {
    errors.push({ field: 'accountNumber', message: 'Invalid account number length' });
  }

  if (!body.ifsc || typeof body.ifsc !== 'string') {
    errors.push({ field: 'ifsc', message: 'IFSC code is required' });
  } else if (!/^[A-Z]{4}0[A-Z0-9]{6}$/i.test(body.ifsc)) {
    errors.push({ field: 'ifsc', message: 'Invalid IFSC code format' });
  }

  if (!body.amount || typeof body.amount !== 'number') {
    errors.push({ field: 'amount', message: 'Amount is required and must be a number' });
  } else if (body.amount < 100) {
    errors.push({ field: 'amount', message: 'Minimum payout amount is 100 paise' });
  }

  if (!body.name || typeof body.name !== 'string' || body.name.length < 2) {
    errors.push({ field: 'name', message: 'Beneficiary name is required (min 2 characters)' });
  }

  return errors;
}

// ============================================================================
// POST /api/payouts/request - Request payout to bank
// ============================================================================

payoutsRoutes.post('/request', async (req: Request, res: Response) => {
  try {
    const { merchantId, accountNumber, ifsc, amount, name, idempotencyKey } = req.body;

    // Validate request
    const errors = validatePayoutRequest(req.body);
    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        errors,
      });
    }

    // Create payout
    const payout = await razorpayService.createPayout(
      merchantId,
      accountNumber,
      ifsc,
      amount,
      name,
      idempotencyKey || `payout_${merchantId}_${Date.now()}`
    );

    res.json({
      success: true,
      data: {
        payoutId: payout.payoutId,
        amount: payout.amount,
        status: payout.status,
        createdAt: new Date(payout.createdAt * 1000).toISOString(),
        message: 'Payout initiated successfully',
      },
    });
  } catch (error: any) {
    console.error('Payout error:', error);

    // Handle specific errors
    if (error.message.includes('Insufficient')) {
      return res.status(400).json({
        success: false,
        error: error.message,
      });
    }

    if (error.message.includes('Invalid')) {
      return res.status(400).json({
        success: false,
        error: error.message,
      });
    }

    res.status(500).json({
      success: false,
      error: 'Payout failed. Please try again.',
    });
  }
});

// ============================================================================
// GET /api/payouts/:merchantId - Get payout history
// ============================================================================

payoutsRoutes.get('/:merchantId', async (req: Request, res: Response) => {
  try {
    const { merchantId } = req.params;
    const { page = '1', limit = '20', status } = req.query;

    const result = await walletService.getTransactions(merchantId, {
      page: parseInt(page as string, 10),
      limit: parseInt(limit as string, 10),
      type: TransactionType.PAYOUT,
    });

    res.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    console.error('Get payouts error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get payout history',
    });
  }
});

// ============================================================================
// GET /api/payouts/status/:payoutId - Get payout status
// ============================================================================

payoutsRoutes.get('/status/:payoutId', async (req: Request, res: Response) => {
  try {
    const { payoutId } = req.params;

    // Get payout details from Razorpay
    const payout = await razorpay.payouts.fetch(payoutId);

    res.json({
      success: true,
      data: {
        payoutId: payout.id,
        amount: payout.amount,
        status: payout.status,
        mode: payout.mode,
        purpose: payout.purpose,
        reference_id: payout.reference_id,
        createdAt: new Date(payout.created_at * 1000).toISOString(),
        completedAt: payout.completed_at
          ? new Date(payout.completed_at * 1000).toISOString()
          : null,
        failureReason: payout.failure_reason,
      },
    });
  } catch (error: any) {
    console.error('Get payout status error:', error);

    if (error.statusCode === 400 || error.code === 'BAD_REQUEST_ERROR') {
      return res.status(404).json({
        success: false,
        error: 'Payout not found',
      });
    }

    res.status(500).json({
      success: false,
      error: 'Failed to get payout status',
    });
  }
});

// ============================================================================
// POST /api/payouts/validate - Validate bank account details
// ============================================================================

payoutsRoutes.post('/validate', async (req: Request, res: Response) => {
  try {
    const { accountNumber, ifsc } = req.body;

    if (!accountNumber || !ifsc) {
      return res.status(400).json({
        success: false,
        error: 'Account number and IFSC code are required',
      });
    }

    // Basic validation
    const errors: string[] = [];

    if (accountNumber.length < 9 || accountNumber.length > 18) {
      errors.push('Invalid account number length');
    }

    if (!/^[A-Z]{4}0[A-Z0-9]{6}$/i.test(ifsc)) {
      errors.push('Invalid IFSC code format');
    }

    if (errors.length > 0) {
      return res.json({
        success: true,
        data: {
          valid: false,
          errors,
        },
      });
    }

    // In production, you could call Razorpay's bank account validation API
    // For now, just return basic validation
    res.json({
      success: true,
      data: {
        valid: true,
        message: 'Bank details appear valid',
      },
    });
  } catch (error: any) {
    console.error('Validate error:', error);
    res.status(500).json({
      success: false,
      error: 'Validation failed',
    });
  }
});

// ============================================================================
// Error Handler for payouts
// ============================================================================

payoutsRoutes.use((err: any, req: Request, res: Response, next: any) => {
  console.error('Payouts route error:', err);
  res.status(500).json({
    success: false,
    error: 'Internal server error in payouts',
  });
});
