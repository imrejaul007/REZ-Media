/**
 * Query Routes
 *
 * Routes for other services to query REE
 */

import { Router, Request, Response } from 'express';
import { BusinessRule } from '../models/BusinessRule';
import { evaluateRules } from '../engines/ruleEngine';
import { runFraudChecks } from '../engines/fraudEngine';
import { calculateCashback } from '../services/cashbackService';
import { CoinType } from '../types';

const router = Router();

/**
 * POST /api/query/evaluate
 * Evaluate all applicable rules for an event
 */
router.post('/evaluate', async (req: Request, res: Response) => {
  try {
    const { category, context } = req.body;

    if (!category || !context) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: category, context'
      });
    }

    // Find applicable rules
    const rules = await BusinessRule.find({
      category,
      isActive: true,
      effectiveFrom: { $lte: new Date() },
      $or: [
        { effectiveTo: null },
        { effectiveTo: { $gt: new Date() } }
      ]
    }).sort({ priority: -1 });

    // Evaluate rules
    const results = await evaluateRules(rules, context);

    res.json({
      success: true,
      data: {
        rulesEvaluated: rules.length,
        rulesMatched: results.length,
        results
      }
    });
  } catch (error) {
    console.error('Error evaluating rules:', error);
    res.status(500).json({ success: false, error: 'Failed to evaluate rules' });
  }
});

/**
 * POST /api/query/commission
 * Calculate commission for a transaction
 */
router.post('/commission', async (req: Request, res: Response) => {
  try {
    const { amount, merchantId, category } = req.body;

    if (!amount) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: amount'
      });
    }

    // Find applicable commission rules
    const rules = await BusinessRule.find({
      ruleType: 'commission',
      isActive: true
    }).sort({ priority: -1 });

    // Evaluate rules
    const results = await evaluateRules(rules, {
      transaction: { amount },
      merchant: { id: merchantId, category },
      amount
    });

    // Calculate commission
    let commission = 0;
    let platformShare = 0;
    let merchantShare = 100;

    for (const result of results) {
      for (const action of result.actions) {
        if (action.params.commissionRate) {
          commission = amount * action.params.commissionRate;
        }
        if (action.params.platformShare) {
          platformShare = action.params.platformShare;
        }
        if (action.params.merchantShare) {
          merchantShare = action.params.merchantShare;
        }
      }
    }

    res.json({
      success: true,
      data: {
        amount,
        commission,
        platformShare,
        merchantShare,
        rulesApplied: results.length
      }
    });
  } catch (error) {
    console.error('Error calculating commission:', error);
    res.status(500).json({ success: false, error: 'Failed to calculate commission' });
  }
});

/**
 * POST /api/query/cashback
 * Calculate cashback for a transaction
 */
router.post('/cashback', async (req: Request, res: Response) => {
  try {
    const { amount, lifetimeSpend = 0 } = req.body;

    if (!amount) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: amount'
      });
    }

    // Use featureControl service for cashback calculation
    const { getUserCashback } = await import('../services/featureControl');
    const { getUserTier } = await import('../services/featureControl');
    const tier = getUserTier(lifetimeSpend);

    const cashback = getUserCashback(lifetimeSpend, amount);

    res.json({
      success: true,
      data: {
        ...cashback,
        tier: tier.name
      }
    });
  } catch (error) {
    console.error('Error calculating cashback:', error);
    res.status(500).json({ success: false, error: 'Failed to calculate cashback' });
  }
});

/**
 * POST /api/query/karma
 * Calculate karma for an action
 */
router.post('/karma', async (req: Request, res: Response) => {
  try {
    const { userId, baseKarma = 5, userTier = 'L1' } = req.body;

    // Import services
    const karmaService = await import('../services/karmaService');
    const { getConversionRate, getRewardMultiplier } = await import('../config/karmaConfig');

    // Calculate karma
    const multiplier = getRewardMultiplier(userTier as 'L1' | 'L2' | 'L3' | 'L4');
    const karmaEarned = Math.round(baseKarma * multiplier);
    const conversionRate = getConversionRate(userTier as 'L1' | 'L2' | 'L3' | 'L4');
    const rewardMultiplier = multiplier;

    res.json({
      success: true,
      data: {
        userId: userId || 'anonymous',
        baseKarma,
        karmaEarned,
        tier: userTier,
        conversionRate,
        rewardMultiplier
      }
    });
  } catch (error) {
    console.error('Error calculating karma:', error);
    res.status(500).json({ success: false, error: String(error) });
  }
});

/**
 * POST /api/query/fraud
 * Check for fraud
 */
router.post('/fraud', async (req: Request, res: Response) => {
  try {
    const { context } = req.body;

    if (!context) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: context'
      });
    }

    const fraudResult = runFraudChecks(context);

    res.json({
      success: true,
      data: fraudResult
    });
  } catch (error) {
    console.error('Error checking fraud:', error);
    res.status(500).json({ success: false, error: 'Failed to check fraud' });
  }
});

/**
 * GET /api/rules/:category
 * Get active rules for a category
 */
router.get('/rules/:category', async (req: Request, res: Response) => {
  try {
    const { category } = req.params;
    const { subCategory } = req.query;

    const filter: Record<string, any> = {
      category,
      isActive: true,
      effectiveFrom: { $lte: new Date() },
      $or: [
        { effectiveTo: null },
        { effectiveTo: { $gt: new Date() } }
      ]
    };

    if (subCategory) {
      filter.subCategory = subCategory;
    }

    const rules = await BusinessRule.find(filter)
      .select('-__v')
      .sort({ priority: -1 });

    res.json({
      success: true,
      data: {
        category,
        rulesCount: rules.length,
        rules
      }
    });
  } catch (error) {
    console.error('Error getting rules:', error);
    res.status(500).json({ success: false, error: 'Failed to get rules' });
  }
});

export default router;
