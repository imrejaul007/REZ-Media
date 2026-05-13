/**
 * Webhooks Routes - Razorpay webhook handler with full implementation
 */

import { Router, Request, Response } from 'express';
import crypto from 'crypto-js';
import { razorpayService } from '../services/razorpay';
import { paymentService } from '../services/paymentService';

export const webhooksRoutes = Router();

// ============================================================================
// Webhook Secret (should be in env, loaded once)
// ============================================================================

let webhookSecret: string | undefined;

/**
 * Get webhook secret (cached)
 */
function getWebhookSecret(): string {
  if (!webhookSecret) {
    webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
    if (!webhookSecret) {
      throw new Error('RAZORPAY_WEBHOOK_SECRET not configured');
    }
  }
  return webhookSecret;
}

// ============================================================================
// Raw Body Middleware
// ============================================================================

// Note: Express should be configured with raw body parser for webhooks
// Add this before json parser in index.ts:
// app.use('/api/webhooks', express.raw({ type: 'application/json' }));

// ============================================================================
// Webhook Handlers
// ============================================================================

/**
 * POST /api/webhooks/razorpay - Handle Razorpay webhooks
 */
webhooksRoutes.post('/razorpay', async (req: Request, res: Response) => {
  try {
    // Get signature from headers
    const signature = req.headers['x-razorpay-signature'] as string;
    if (!signature) {
      console.error('Missing x-razorpay-signature header');
      return res.status(400).json({ error: 'Missing signature' });
    }

    // Get raw body (must be configured with express.raw middleware)
    const rawBody = req.body;
    const bodyString = typeof rawBody === 'string'
      ? rawBody
      : JSON.stringify(rawBody);

    if (!bodyString) {
      console.error('Empty webhook body');
      return res.status(400).json({ error: 'Empty body' });
    }

    // Verify webhook signature
    const secret = getWebhookSecret();
    const expectedSignature = crypto.HmacSHA256(bodyString, secret);
    const isValid = signature === expectedSignature.toString();

    if (!isValid) {
      console.error('Invalid webhook signature:', {
        received: signature.slice(0, 20) + '...',
        expected: expectedSignature.toString().slice(0, 20) + '...',
      });
      return res.status(400).json({ error: 'Invalid signature' });
    }

    // Parse body
    let payload: any;
    try {
      payload = typeof rawBody === 'string' ? JSON.parse(rawBody) : rawBody;
    } catch (parseError) {
      console.error('Failed to parse webhook body:', parseError);
      return res.status(400).json({ error: 'Invalid JSON body' });
    }

    const event = payload.event;
    const webhookEventId = payload.payload?.payment?.entity?.id ||
                          payload.payload?.object?.id ||
                          `${event}_${Date.now()}`;

    if (!event) {
      console.error('Missing event type in webhook');
      return res.status(400).json({ error: 'Missing event type' });
    }

    console.log(`Received webhook event: ${event}`, {
      webhookEventId,
      timestamp: new Date().toISOString(),
    });

    // Process event asynchronously but respond immediately
    // to prevent Razorpay timeout
    res.json({ received: true });

    // Process webhook in background
    processWebhookAsync(event, payload, webhookEventId).catch((error) => {
      console.error(`Background webhook processing failed for ${event}:`, error);
    });
  } catch (error: any) {
    console.error('Webhook handler error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

/**
 * Process webhook asynchronously
 */
async function processWebhookAsync(event: string, payload: any, webhookEventId: string): Promise<void> {
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

      case 'payout.reversed':
        await paymentService.handlePayoutFailed(payload);
        break;

      case 'refund.created':
        await paymentService.handleRefundCreated(payload);
        break;

      case 'refund.processed':
        await paymentService.handleRefundProcessed(payload);
        break;

      case 'refund.failed':
        console.log('Refund failed event received:', {
          refundId: payload.payload?.refund?.entity?.id,
          reason: payload.payload?.refund?.entity?.error_reason,
        });
        break;

      default:
        console.log(`Unhandled webhook event: ${event}`);
    }

    console.log(`Webhook event processed successfully: ${event}`, {
      webhookEventId,
      processedAt: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error(`Error processing webhook ${event}:`, {
      error: error.message,
      webhookEventId,
      stack: error.stack,
    });
    throw error; // Re-throw for retry handling
  }
}

// ============================================================================
// Webhook Status Endpoint (for debugging)
// ============================================================================

/**
 * GET /api/webhooks/status - Check webhook handler status
 */
webhooksRoutes.get('/status', (req: Request, res: Response) => {
  res.json({
    status: 'active',
    service: 'REZ-Payment-Gateway',
    webhookEndpoint: '/api/webhooks/razorpay',
    supportedEvents: [
      'payment.captured',
      'payment.failed',
      'order.paid',
      'payout.processed',
      'payout.failed',
      'payout.reversed',
      'refund.created',
      'refund.processed',
      'refund.failed',
    ],
  });
});
