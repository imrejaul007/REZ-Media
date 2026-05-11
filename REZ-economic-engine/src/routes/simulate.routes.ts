import { Router, Request, Response } from 'express';
import { getUserCashback, getUserTier } from '../services/featureControl';
import { calculateKarmaEarned, getRewardBonus } from '../services/karmaService';

export const simulateRouter = Router();

/**
 * POST /api/simulate/commission
 * Simulate commission for merchant
 */
simulateRouter.post('/commission', async (req: Request, res: Response) => {
  try {
    const { amount, merchantTier = 'growth' } = req.body;

    if (!amount) {
      return res.status(400).json({
        success: false,
        error: 'Amount required'
      });
    }

    // Simulate commission
    const merchantTiers: Record<string, { commissionRate: number }> = {
      free: { commissionRate: 15 },
      growth: { commissionRate: 12 },
      pro: { commissionRate: 10 },
      enterprise: { commissionRate: 8 }
    };

    const tier = merchantTiers[merchantTier] || merchantTiers.growth;
    const platformFee = (amount * tier.commissionRate) / 100;
    const merchantReceives = amount - platformFee;
    const userCashback = platformFee * 0.5;
    const userSocial = platformFee * 0.5;

    res.json({
      success: true,
      data: {
        simulationId: `sim_${Date.now()}`,
        input: { amount, merchantTier },
        output: {
          platformFee,
          merchantReceives,
          userCashback,
          userSocial,
          totalEarnings: userCashback + userSocial
        },
        riskLevel: 'low'
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) });
  }
});

/**
 * POST /api/simulate/cashback
 * Simulate cashback for user
 */
simulateRouter.post('/cashback', async (req: Request, res: Response) => {
  try {
    const { amount, userTier = 'starter' } = req.body;

    if (!amount) {
      return res.status(400).json({
        success: false,
        error: 'Amount required'
      });
    }

    const tier = getUserTier(userTier === 'starter' ? 0 : userTier === 'active' ? 5000 : userTier === 'gold' ? 25000 : 100000);
    const cashback = getUserCashback(tier.minSpend, amount);

    res.json({
      success: true,
      data: {
        simulationId: `sim_${Date.now()}`,
        input: { amount, userTier },
        output: {
          cashbackAmount: cashback.cashbackAmount,
          socialAmount: cashback.socialAmount,
          coinType: cashback.coinType,
          tier: cashback.tier
        },
        riskLevel: 'low'
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) });
  }
});

/**
 * POST /api/simulate/karma
 * Simulate karma impact
 */
simRouter.post('/karma', async (req: Request, res: Response) => {
  try {
    const { baseKarma = 10, userTier = 'L1' } = req.body;

    const earned = calculateKarmaEarned(baseKarma, userTier);
    const bonus = getRewardBonus(userTier);
    const conversion = bonus * baseKarma;

    res.json({
      success: true,
      data: {
        simulationId: `sim_${Date.now()}`,
        input: { baseKarma, userTier },
        output: {
          karmaEarned: earned,
          rewardMultiplier: bonus,
          conversionRate: bonus,
          projectedCoins: earned * bonus
        },
        riskLevel: 'low'
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) });
  }
});

/**
 * POST /api/simulate/impact
 * Full economic impact simulation
 */
simulateRouter.post('/impact', async (req: Response, res: Response) => {
  try {
    const {
      transactionAmount = 500,
      userTier = 'starter',
      merchantTier = 'growth'
    } = req.body;

    // Calculate all impacts
    const merchantTierData = { commissionRate: merchantTiers[merchantTier]?.commissionRate || 12 };
    const platformFee = (transactionAmount * merchantTierData.commissionRate) / 100;
    const merchantReceives = transactionAmount - platformFee;

    const userTierData = { minSpend: 0 };
    const userCashback = getUserCashback(userTierData.minSpend, transactionAmount);

    // Karma impact
    const karmaImpact = calculateKarmaEarned(10, userTier as any);

    res.json({
      success: true,
      data: {
        simulationId: `sim_${Date.now()}`,
        inputs: { transactionAmount, userTier, merchantTier },
        outputs: {
          platform: { platformFee },
          merchant: { receives: merchantReceives },
          user: {
            cashback: userCashback.cashbackAmount,
            social: userCashback.socialAmount
          },
          karma: { earned: karmaImpact },
          coins: {
            total: userCashback.cashbackAmount + userCashback.socialAmount + karmaImpact
          }
        },
        riskLevel: 'low'
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) });
  }
});
