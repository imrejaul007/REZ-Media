/**
 * Payouts Routes - Merchant payouts
 */

import { Router } from 'express';
import { razorpayService } from '../services/razorpay';

export const payoutsRoutes = Router();

/**
 * POST /api/payouts/request - Request payout to bank
 */
payoutsRoutes.post('/request', async (req, res) => {
  try {
    const { merchantId, accountNumber, ifsc, amount, name } = req.body;

    if (!merchantId || !accountNumber || !ifsc || !amount || !name) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields'
      });
    }

    const payout = await razorpayService.createPayout(
      merchantId,
      accountNumber,
      ifsc,
      amount,
      name
    );

    res.json({
      success: true,
      data: {
        payoutId: payout.payoutId,
        status: payout.status,
      },
    });
  } catch (error) {
    console.error('Payout error:', error);
    res.status(500).json({
      success: false,
      error: 'Payout failed'
    });
  }
});

/**
 * GET /api/payouts/:merchantId - Get payout history
 */
payoutsRoutes.get('/:merchantId', async (req, res) => {
  const { merchantId } = req.params;

  res.json({
    success: true,
    data: {
      payouts: [
        { id: 'pout_1', amount: 5000, status: 'processed', date: new Date().toISOString() },
      ],
    },
  });
});
