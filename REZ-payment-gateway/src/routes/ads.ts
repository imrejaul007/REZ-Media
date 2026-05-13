/**
 * Ads Routes - Ad payment processing
 */

import { Router } from 'express';
import { razorpayService } from '../services/razorpay';

export const adsRoutes = Router();

/**
 * POST /api/ads/pay - Initiate ad payment
 */
adsRoutes.post('/pay', async (req, res) => {
  try {
    const { merchantId, campaignId, amount } = req.body;

    if (!merchantId || !campaignId || !amount) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields'
      });
    }

    const order = await razorpayService.createAdPaymentOrder(merchantId, campaignId, amount);

    res.json({
      success: true,
      data: {
        orderId: order.orderId,
        amount: order.amount,
        campaignId,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to create payment order'
    });
  }
});

/**
 * POST /api/ads/verify - Verify ad payment
 */
adsRoutes.post('/verify', async (req, res) => {
  try {
    const { orderId, paymentId, signature, campaignId } = req.body;

    const isValid = razorpayService.verifySignature(orderId, paymentId, signature);
    if (!isValid) {
      return res.status(400).json({
        success: false,
        error: 'Invalid signature'
      });
    }

    // In production:
    // 1. Activate campaign
    // 2. Reserve wallet funds
    // 3. Start ad serving

    res.json({
      success: true,
      data: {
        message: 'Campaign payment verified',
        campaignId,
        status: 'active',
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
 * POST /api/ads/refund - Request refund
 */
adsRoutes.post('/refund', async (req, res) => {
  try {
    const { paymentId, amount } = req.body;

    const refund = await razorpayService.refundPayment(paymentId, amount);

    res.json({
      success: true,
      data: {
        refundId: refund.refundId,
        status: refund.status,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Refund failed'
    });
  }
});
