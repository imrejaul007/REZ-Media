/**
 * Webhooks Routes - Razorpay webhook handler
 */

import { Router } from 'express';

export const webhooksRoutes = Router();

/**
 * POST /api/webhooks/razorpay - Handle Razorpay webhooks
 */
webhooksRoutes.post('/razorpay', async (req, res) => {
  try {
    const signature = req.headers['x-razorpay-signature'] as string;
    const body = JSON.stringify(req.body);

    // Verify webhook signature
    const crypto = require('crypto-js');
    const expectedSignature = crypto.HmacSHA256(body, process.env.RAZORPAY_WEBHOOK_SECRET || '');

    if (signature !== expectedSignature.toString()) {
      return res.status(400).json({ error: 'Invalid signature' });
    }

    const event = req.body.event;
    const payload = req.body.payload;

    switch (event) {
      case 'payment.captured':
        await handlePaymentCaptured(payload);
        break;
      case 'payment.failed':
        await handlePaymentFailed(payload);
        break;
      case 'payout.processed':
        await handlePayoutProcessed(payload);
        break;
      case 'refund.created':
        await handleRefundCreated(payload);
        break;
    }

    res.json({ received: true });
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

async function handlePaymentCaptured(payload: any) {
  const payment = payload.payment.entity;
  console.log('Payment captured:', payment.id);
  // Credit wallet or activate campaign
}

async function handlePaymentFailed(payload: any) {
  const payment = payload.payment.entity;
  console.log('Payment failed:', payment.id);
  // Handle failed payment
}

async function handlePayoutProcessed(payload: any) {
  const payout = payload.payout.entity;
  console.log('Payout processed:', payout.id);
  // Update payout status
}

async function handleRefundCreated(payload: any) {
  const refund = payload.refund.entity;
  console.log('Refund created:', refund.id);
  // Process refund
}
