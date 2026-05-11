/**
 * Subscriptions Routes
 */

import { Router, Request, Response } from 'express';
import { verifyConsumer } from '../middleware/auth';

const router = Router();

// Mock subscription data
const subscriptions: any[] = [];

/**
 * GET /api/subscriptions/plans
 * Get available subscription plans
 */
router.get('/plans', async (req: Request, res: Response) => {
  const plans = [
    {
      id: 'basic_monthly',
      name: 'Basic',
      price: 999,
      duration: 30,
      features: [
        'Unlimited push notifications',
        'Basic analytics',
        'Email support',
      ],
    },
    {
      id: 'pro_monthly',
      name: 'Pro',
      price: 2499,
      duration: 30,
      features: [
        'All Basic features',
        'SMS + WhatsApp channels',
        'Advanced analytics',
        'Priority support',
      ],
    },
    {
      id: 'enterprise_monthly',
      name: 'Enterprise',
      price: 9999,
      duration: 30,
      features: [
        'All Pro features',
        'Unlimited campaigns',
        'Custom integrations',
        'Dedicated account manager',
      ],
    },
  ];

  res.json({ success: true, data: plans });
});

/**
 * POST /api/subscriptions
 * Create subscription
 */
router.post('/', verifyConsumer, async (req: Request, res: Response) => {
  try {
    const merchantId = (req as any).user?.id;
    const { planId, paymentMethod } = req.body;

    const subscription = {
      id: `sub_${Date.now()}`,
      merchantId,
      planId,
      status: 'active',
      startDate: new Date(),
      endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      autoRenew: true,
      paymentMethod,
      createdAt: new Date(),
    };

    subscriptions.push(subscription);
    res.status(201).json({ success: true, data: subscription });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/subscriptions/current
 * Get current subscription
 */
router.get('/current', verifyConsumer, async (req: Request, res: Response) => {
  try {
    const merchantId = (req as any).user?.id;
    const sub = subscriptions.find(s => s.merchantId === merchantId);

    if (!sub) {
      return res.json({ success: true, data: null });
    }

    res.json({ success: true, data: sub });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/subscriptions/cancel
 * Cancel subscription
 */
router.post('/cancel', verifyConsumer, async (req: Request, res: Response) => {
  try {
    const merchantId = (req as any).user?.id;
    const sub = subscriptions.find(s => s.merchantId === merchantId);

    if (sub) {
      sub.status = 'cancelled';
      sub.cancelledAt = new Date();
    }

    res.json({ success: true, data: sub });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/subscriptions/renew
 * Renew subscription
 */
router.post('/renew', verifyConsumer, async (req: Request, res: Response) => {
  try {
    const merchantId = (req as any).user?.id;
    const sub = subscriptions.find(s => s.merchantId === merchantId);

    if (sub) {
      sub.endDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      sub.status = 'active';
      sub.renewedAt = new Date();
    }

    res.json({ success: true, data: sub });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/subscriptions/usage
 * Get usage stats
 */
router.get('/usage', verifyConsumer, async (req: Request, res: Response) => {
  try {
    const merchantId = (req as any).user?.id;

    const usage = {
      campaignsThisMonth: 15,
      campaignsLimit: -1, // unlimited
      notificationsSent: 45000,
      notificationsLimit: -1,
      teamMembers: 3,
      teamLimit: 10,
    };

    res.json({ success: true, data: usage });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
