/**
 * Wallet Routes - Top-up via Razorpay
 */

import { Router } from 'express';
import { razorpayService } from '../services/razorpay';

export const walletRoutes = Router();

/**
 * POST /api/wallet/topup - Initiate wallet top-up
 */
walletRoutes.post('/topup', async (req, res) => {
  try {
    const { merchantId, amount } = req.body;

    if (!merchantId || !amount || amount < 100) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request. Minimum top-up is ₹100'
      });
    }

    const order = await razorpayService.createWalletOrder(merchantId, amount);

    res.json({
      success: true,
      data: {
        orderId: order.orderId,
        amount: order.amount,
        currency: 'INR',
      },
    });
  } catch (error) {
    console.error('Wallet top-up error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create order'
    });
  }
});

/**
 * POST /api/wallet/verify - Verify payment and credit wallet
 */
walletRoutes.post('/verify', async (req, res) => {
  try {
    const { orderId, paymentId, signature, merchantId } = req.body;

    // Verify signature
    const isValid = razorpayService.verifySignature(orderId, paymentId, signature);
    if (!isValid) {
      return res.status(400).json({
        success: false,
        error: 'Invalid signature'
      });
    }

    // In production, would:
    // 1. Call wallet service to credit amount
    // 2. Store transaction in database
    // 3. Send confirmation email

    res.json({
      success: true,
      data: {
        message: 'Payment verified and wallet credited',
        merchantId,
        orderId,
        paymentId,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Verification failed'
    });
  }
});

/**
 * GET /api/wallet/transactions/:merchantId - Get transaction history
 */
walletRoutes.get('/transactions/:merchantId', async (req, res) => {
  const { merchantId } = req.params;

  // Mock transactions
  res.json({
    success: true,
    data: {
      transactions: [
        { id: 'txn_1', amount: 10000, type: 'credit', date: new Date().toISOString(), status: 'completed' },
        { id: 'txn_2', amount: 5000, type: 'debit', date: new Date().toISOString(), status: 'completed' },
      ],
    },
  });
});
