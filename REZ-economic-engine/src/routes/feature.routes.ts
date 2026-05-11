/**
 * Feature Routes
 *
 * Feature flag and entitlement endpoints
 */

import { Router, Request, Response } from 'express';
import {
  getUserFeatures,
  getMerchantFeatures,
  getUserTier,
  userHasFeature,
  merchantHasFeature,
  getAllUserTiers,
  getAllMerchantTiers,
  getMerchantCommission,
  getUserCashback,
} from '../services/featureControl';

const router = Router();

/**
 * POST /api/features/user
 * Check user feature flags
 */
router.post('/user', async (req: Request, res: Response) => {
  try {
    const { userId, lifetimeSpend, features } = req.body;

    if (lifetimeSpend === undefined) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: lifetimeSpend',
      });
    }

    // Get all features or specific ones
    if (features && Array.isArray(features)) {
      // Return only requested features
      const allFeatures = getUserFeatures(getUserTier(lifetimeSpend).name);
      const result: Record<string, any> = {
        currentTier: getUserTier(lifetimeSpend).name,
      };

      for (const feature of features) {
        result[feature] = allFeatures[feature as keyof typeof allFeatures];
      }

      return res.json({ success: true, data: result });
    }

    // Return all features
    const userFeatures = getUserFeatures(getUserTier(lifetimeSpend).name);

    res.json({
      success: true,
      data: userFeatures,
    });
  } catch (error) {
    console.error('Error getting user features:', error);
    res.status(500).json({ success: false, error: 'Failed to get user features' });
  }
});

/**
 * POST /api/features/merchant
 * Check merchant feature flags
 */
router.post('/merchant', async (req: Request, res: Response) => {
  try {
    const { merchantId, tier, features } = req.body;

    if (!tier) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: tier',
      });
    }

    // Get all features or specific ones
    if (features && Array.isArray(features)) {
      const allFeatures = getMerchantFeatures(tier);
      const result: Record<string, any> = {
        currentTier: tier,
      };

      for (const feature of features) {
        result[feature] = allFeatures[feature as keyof typeof allFeatures];
      }

      return res.json({ success: true, data: result });
    }

    const merchantFeatures = getMerchantFeatures(tier);

    res.json({
      success: true,
      data: merchantFeatures,
    });
  } catch (error) {
    console.error('Error getting merchant features:', error);
    res.status(500).json({ success: false, error: 'Failed to get merchant features' });
  }
});

/**
 * POST /api/features/cashback
 * Calculate user cashback
 */
router.post('/cashback', async (req: Request, res: Response) => {
  try {
    const { userId, lifetimeSpend, amount } = req.body;

    if (lifetimeSpend === undefined || !amount) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: lifetimeSpend, amount',
      });
    }

    const cashback = getUserCashback(lifetimeSpend, amount);

    res.json({
      success: true,
      data: {
        ...cashback,
        tier: getUserTier(lifetimeSpend).name,
      },
    });
  } catch (error) {
    console.error('Error calculating cashback:', error);
    res.status(500).json({ success: false, error: 'Failed to calculate cashback' });
  }
});

/**
 * POST /api/features/commission
 * Calculate merchant commission
 */
router.post('/commission', async (req: Request, res: Response) => {
  try {
    const { merchantId, tier, amount } = req.body;

    if (!tier || !amount) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: tier, amount',
      });
    }

    const commission = getMerchantCommission(tier, amount);

    res.json({
      success: true,
      data: {
        ...commission,
        merchantTier: tier,
        commissionRate: getMerchantFeatures(tier).commissionRate,
      },
    });
  } catch (error) {
    console.error('Error calculating commission:', error);
    res.status(500).json({ success: false, error: 'Failed to calculate commission' });
  }
});

/**
 * GET /api/features/tiers/user
 * Get all user tiers
 */
router.get('/tiers/user', async (req: Request, res: Response) => {
  try {
    const tiers = getAllUserTiers();
    res.json({ success: true, data: tiers });
  } catch (error) {
    console.error('Error getting user tiers:', error);
    res.status(500).json({ success: false, error: 'Failed to get user tiers' });
  }
});

/**
 * GET /api/features/tiers/merchant
 * Get all merchant tiers
 */
router.get('/tiers/merchant', async (req: Request, res: Response) => {
  try {
    const tiers = getAllMerchantTiers();
    res.json({ success: true, data: tiers });
  } catch (error) {
    console.error('Error getting merchant tiers:', error);
    res.status(500).json({ success: false, error: 'Failed to get merchant tiers' });
  }
});

/**
 * GET /api/features/tier/user/:spend
 * Get user tier for spend
 */
router.get('/tier/user/:spend', async (req: Request, res: Response) => {
  try {
    const spend = parseFloat(req.params.spend);
    const tier = getUserTier(spend);
    res.json({ success: true, data: tier });
  } catch (error) {
    console.error('Error getting user tier:', error);
    res.status(500).json({ success: false, error: 'Failed to get user tier' });
  }
});

export default router;
