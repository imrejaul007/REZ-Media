/**
 * SAMPLING DECISION API
 * Endpoints for sampling decisions
 */

import { Router } from 'express';
import { makeSamplingDecision, SamplingContext, CampaignConfig } from '../engines/sampling/samplingDecision';
import { calculateDynamicPrice, getCurrentSurgeLevel, DynamicPricingEngine, PricingContext } from '../engines/sampling/dynamicPricing';
import {
  autoCampaignEngine,
  signalDetectionEngine,
  campaignSuggestionEngine,
  campaignPerformanceTracker,
  CampaignSignal,
  AutoCampaign,
  SignalType,
  SignalConfig
} from '../engines/sampling/autoCampaign';
import {
  allocateCoins,
  getCoinAllocationBreakdown,
  getUserCoinStats,
  SmartCoinAllocator,
  CoinAllocationRequest
} from '../engines/sampling/smartCoinAllocation';
import {
  autoCoinDistributionEngine,
  distributeCoins,
  previewDistribution,
  getTriggerBreakdown,
  DistributionContext,
  DistributionResult
} from '../engines/sampling/autoCoinDistribution';

const router = Router();

// ============================================
// POST /api/sampling/decide
// Main decision endpoint
// ============================================

router.post('/decide', async (req, res) => {
  try {
    const { userId, campaignId, merchantId, location } = req.body;

    if (!userId || !campaignId) {
      return res.status(400).json({
        success: false,
        error: 'userId and campaignId required'
      });
    }

    // Get campaign config (would fetch from DB in real impl)
    const config: CampaignConfig = {
      coinType: 'try',
      minCoins: 10,
      maxCoins: 100,
      targeting: {
        maxPerUser: 5,
        cooldownMinutes: 240
      }
    };

    const context: SamplingContext = {
      userId,
      campaignId,
      merchantId,
      location,
      time: new Date()
    };

    const decision = await makeSamplingDecision(context, config);

    res.json({
      success: true,
      data: decision
    });

  } catch (error) {
    console.error('[SAMPLING] Decision error:', error);
    res.status(500).json({
      success: false,
      error: 'Decision failed'
    });
  }
});

// ============================================
// GET /api/sampling/fatigue/:userId
// Check user fatigue level
// ============================================

router.get('/fatigue/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { ScoringEngine } = await import('../engines/sampling/samplingDecision');
    const scoring = new SamplingEngine();

    const context: SamplingContext = {
      userId,
      campaignId: 'check',
      time: new Date()
    };

    const config: CampaignConfig = {
      coinType: 'try',
      minCoins: 10,
      maxCoins: 100
    };

    const { score, eligible, reason } = await scoring.score(context, config);

    res.json({
      success: true,
      data: {
        userId,
        eligible,
        level: Math.round(100 - score),
        reason,
        canScan: eligible,
        nextScanIn: eligible ? 'Now' : reason
      }
    });

  } catch (error) {
    console.error('[SAMPLING] Fatigue check error:', error);
    res.status(500).json({
      success: false,
      error: 'Fatigue check failed'
    });
  }
});

// ============================================
// POST /api/sampling/record-scan
// Record a scan and update fatigue
// ============================================

router.post('/record-scan', async (req, res) => {
  try {
    const { userId, campaignId, merchantId, coinsAwarded } = req.body;

    if (!userId || !campaignId) {
      return res.status(400).json({
        success: false,
        error: 'userId and campaignId required'
      });
    }

    const Redis = (await import('ioredis')).default;
    const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

    const today = new Date().toISOString().split('T')[0];
    const key = (suffix: string) => `sampling:fatigue:${userId}:${suffix}`;

    // Increment today's scan count
    await redis.incr(key(`scans:${today}`));
    await redis.expire(key(`scans:${today}`), 86400); // 24 hours

    // Set last scan time
    await redis.set(key('lastScan'), Date.now().toString());
    await redis.expire(key('lastScan'), 86400);

    // Record campaign scan
    await redis.lpush(key('campaigns'), campaignId);
    await redis.ltrim(key('campaigns'), 0, 9); // Keep last 10

    // Record coins earned
    if (coinsAwarded) {
      const totalCoins = parseInt(await redis.get(key('totalCoins')) || '0');
      await redis.set(key('totalCoins'), (totalCoins + coinsAwarded).toString());
    }

    res.json({
      success: true,
      data: {
        scansToday: await redis.get(key(`scans:${today}`)),
        nextScanPossible: '4 hours'
      }
    });

  } catch (error) {
    console.error('[SAMPLING] Record scan error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to record scan'
    });
  }
});

// ============================================
// POST /api/sampling/record-redeem
// Record a redemption (triggers cooldown)
// ============================================

router.post('/record-redeem', async (req, res) => {
  try {
    const { userId, merchantId, coinsUsed } = req.body;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'userId required'
      });
    }

    const Redis = (await import('ioredis')).default;
    const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

    const key = (suffix: string) => `sampling:fatigue:${userId}:${suffix}`;

    // Set last redeem time (triggers 24hr cooldown)
    await redis.set(key('lastRedeem'), Date.now().toString());
    await redis.expire(key('lastRedeem'), 86400 * 7); // 7 days

    res.json({
      success: true,
      data: {
        message: 'Redemption recorded',
        cooldownEnds: '24 hours'
      }
    });

  } catch (error) {
    console.error('[SAMPLING] Record redeem error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to record redemption'
    });
  }
});

// ============================================
// GET /api/sampling/leaderboard
// Top scanners today
// ============================================

router.get('/leaderboard', async (req, res) => {
  try {
    const Redis = (await import('ioredis')).default;
    const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

    const today = new Date().toISOString().split('T')[0];
    const leaders = await redis.zrevrange(`sampling:leaderboard:${today}`, 0, 9, 'WITHSCORES');

    const board = [];
    for (let i = 0; i < leaders.length; i += 2) {
      board.push({
        rank: Math.floor(i / 2) + 1,
        userId: leaders[i],
        scans: parseInt(leaders[i + 1])
      });
    }

    res.json({
      success: true,
      data: { leaderboard: board }
    });

  } catch (error) {
    console.error('[SAMPLING] Leaderboard error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get leaderboard'
    });
  }
});

// ============================================
// DYNAMIC PRICING ROUTES
// ============================================

/**
 * GET /api/sampling/pricing/:merchantId
 * Get current dynamic price for a merchant
 */
router.get('/pricing/:merchantId', async (req, res) => {
  try {
    const { merchantId } = req.params;
    const { lat, lng } = req.query;

    const context: PricingContext = {
      merchantId,
      location: lat && lng ? {
        lat: parseFloat(lat as string),
        lng: parseFloat(lng as string)
      } : undefined,
      time: new Date()
    };

    const price = await calculateDynamicPrice(context);
    const surge = await getCurrentSurgeLevel(merchantId);

    // Record pricing event for analytics
    const engine = new DynamicPricingEngine();
    await engine.recordPricingEvent(merchantId, price);

    res.json({
      success: true,
      data: {
        merchantId,
        price,
        surgeLevel: surge,
        displayLabel: price.surgeLabel === 'surge'
          ? 'SURGE PRICING'
          : price.surgeLabel === 'boosted'
            ? 'Boosted Rewards'
            : 'Standard Rewards'
      }
    });

  } catch (error) {
    console.error('[SAMPLING] Dynamic pricing error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to calculate dynamic price'
    });
  }
});

/**
 * POST /api/sampling/pricing/calculate
 * Calculate price with full context
 */
router.post('/pricing/calculate', async (req, res) => {
  try {
    const { merchantId, location, time, baseCoins } = req.body;

    if (!merchantId) {
      return res.status(400).json({
        success: false,
        error: 'merchantId required'
      });
    }

    const context: PricingContext = {
      merchantId,
      location,
      time: time ? new Date(time) : new Date()
    };

    const price = await calculateDynamicPrice(context, baseCoins);

    res.json({
      success: true,
      data: price
    });

  } catch (error) {
    console.error('[SAMPLING] Price calculation error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to calculate price'
    });
  }
});

/**
 * POST /api/sampling/pricing/record-scan
 * Record scan and return adjusted price
 */
router.post('/pricing/record-scan', async (req, res) => {
  try {
    const { userId, merchantId, location, baseCoins } = req.body;

    if (!userId || !merchantId) {
      return res.status(400).json({
        success: false,
        error: 'userId and merchantId required'
      });
    }

    // Record user presence for demand tracking
    const pricingEngine = new DynamicPricingEngine();

    if (location) {
      await pricingEngine.recordUserPresence(userId, location);
    }

    // Calculate dynamic price
    const context: PricingContext = {
      merchantId,
      location,
      time: new Date()
    };

    const price = await calculateDynamicPrice(context, baseCoins);

    // Also record in fatigue system
    const Redis = (await import('ioredis')).default;
    const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

    const today = new Date().toISOString().split('T')[0];
    const fatigueKey = (suffix: string) => `sampling:fatigue:${userId}:${suffix}`;

    await redis.incr(fatigueKey(`scans:${today}`));
    await redis.expire(fatigueKey(`scans:${today}`), 86400);
    await redis.set(fatigueKey('lastScan'), Date.now().toString());
    await redis.expire(fatigueKey('lastScan'), 86400);

    res.json({
      success: true,
      data: {
        userId,
        merchantId,
        coinsAwarded: price.finalCoins,
        baseCoins: price.baseCoins,
        surgeLabel: price.surgeLabel,
        multipliers: price.multipliers,
        expiresAt: price.expiresAt,
        scansToday: await redis.get(fatigueKey(`scans:${today}`))
      }
    });

  } catch (error) {
    console.error('[SAMPLING] Record scan with pricing error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to record scan'
    });
  }
});

/**
 * GET /api/sampling/pricing/surge/:merchantId
 * Get surge level summary
 */
router.get('/pricing/surge/:merchantId', async (req, res) => {
  try {
    const { merchantId } = req.params;
    const surge = await getCurrentSurgeLevel(merchantId);

    res.json({
      success: true,
      data: {
        merchantId,
        ...surge,
        message: surge.level === 'surge'
          ? 'High demand! Rewards are boosted.'
          : surge.level === 'boosted'
            ? 'Good time to scan - boosted rewards available!'
            : 'Standard rewards active.'
      }
    });

  } catch (error) {
    console.error('[SAMPLING] Surge level error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get surge level'
    });
  }
});

/**
 * GET /api/sampling/pricing/history/:merchantId
 * Get pricing history for analytics
 */
router.get('/pricing/history/:merchantId', async (req, res) => {
  try {
    const { merchantId } = req.params;
    const hours = parseInt(req.query.hours as string) || 24;

    const engine = new DynamicPricingEngine();
    const history = await engine.getPricingHistory(merchantId, hours);

    res.json({
      success: true,
      data: {
        merchantId,
        hours,
        entries: history
      }
    });

  } catch (error) {
    console.error('[SAMPLING] Pricing history error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get pricing history'
    });
  }
});

// ============================================
// AUTO-CAMPAIGN ENGINE ROUTES
// ============================================

/**
 * POST /api/sampling/auto-campaign/detect
 * Detect all signal types for given context
 */
router.post('/auto-campaign/detect', async (req, res) => {
  try {
    const { merchantId, userId, location, time, config } = req.body;

    const context = {
      merchantId,
      userId,
      location: location ? { lat: location.lat, lng: location.lng } : undefined,
      time: time ? new Date(time) : new Date(),
      config: config as SignalConfig | undefined
    };

    const signals = await signalDetectionEngine.detectSignals(context);

    res.json({
      success: true,
      data: {
        signalCount: signals.length,
        signals,
        summary: {
          inventory_excess: signals.filter(s => s.type === 'inventory_excess').length,
          dormant_users: signals.filter(s => s.type === 'dormant_users').length,
          nearby_location: signals.filter(s => s.type === 'nearby_location').length,
          time_based: signals.filter(s => s.type === 'time_based').length,
          event: signals.filter(s => s.type === 'event').length
        }
      }
    });

  } catch (error) {
    console.error('[SAMPLING] Signal detection error:', error);
    res.status(500).json({
      success: false,
      error: 'Signal detection failed'
    });
  }
});

/**
 * POST /api/sampling/auto-campaign/generate
 * Generate campaign suggestions from signals
 */
router.post('/auto-campaign/generate', async (req, res) => {
  try {
    const { merchantId, userId, location, time, config } = req.body;

    // First detect signals
    const context = {
      merchantId,
      userId,
      location: location ? { lat: location.lat, lng: location.lng } : undefined,
      time: time ? new Date(time) : new Date(),
      config: config as SignalConfig | undefined
    };

    const signals = await signalDetectionEngine.detectSignals(context);

    if (signals.length === 0) {
      return res.json({
        success: true,
        data: {
          message: 'No signals detected',
          signals: [],
          campaigns: []
        }
      });
    }

    // Generate campaign suggestions
    const campaigns = await campaignSuggestionEngine.suggestCampaigns(signals, config);

    res.json({
      success: true,
      data: {
        signalCount: signals.length,
        signals,
        campaignCount: campaigns.length,
        campaigns
      }
    });

  } catch (error) {
    console.error('[SAMPLING] Campaign generation error:', error);
    res.status(500).json({
      success: false,
      error: 'Campaign generation failed'
    });
  }
});

/**
 * POST /api/sampling/auto-campaign/process
 * Full auto-campaign processing: detect signals, generate campaigns, auto-launch
 */
router.post('/auto-campaign/process', async (req, res) => {
  try {
    const { merchantId, userId, location, time, config } = req.body;

    const context = {
      merchantId,
      userId,
      location: location ? { lat: location.lat, lng: location.lng } : undefined,
      time: time ? new Date(time) : new Date(),
      config: config as SignalConfig | undefined
    };

    const result = await autoCampaignEngine.processSignals(context);

    res.json({
      success: true,
      data: {
        signalsDetected: result.signals.length,
        signals: result.signals,
        campaignsSuggested: result.campaigns.length,
        campaigns: result.campaigns,
        autoLaunched: result.launched.length,
        launched: result.launched,
        errors: result.errors
      }
    });

  } catch (error) {
    console.error('[SAMPLING] Auto-campaign process error:', error);
    res.status(500).json({
      success: false,
      error: 'Auto-campaign processing failed'
    });
  }
});

/**
 * GET /api/sampling/auto-campaign/campaigns/:merchantId
 * Get active campaigns for a merchant
 */
router.get('/auto-campaign/campaigns/:merchantId', async (req, res) => {
  try {
    const { merchantId } = req.params;

    const campaigns = await autoCampaignEngine.getMerchantCampaigns(merchantId);

    res.json({
      success: true,
      data: {
        merchantId,
        campaignCount: campaigns.length,
        campaigns
      }
    });

  } catch (error) {
    console.error('[SAMPLING] Get campaigns error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get campaigns'
    });
  }
});

/**
 * PATCH /api/sampling/auto-campaign/campaigns/:campaignId/status
 * Update campaign status
 */
router.patch('/auto-campaign/campaigns/:campaignId/status', async (req, res) => {
  try {
    const { campaignId } = req.params;
    const { status } = req.body;

    if (!['suggested', 'approved', 'active', 'paused', 'completed'].includes(status)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid status. Must be: suggested, approved, active, paused, or completed'
      });
    }

    const success = await autoCampaignEngine.updateCampaignStatus(campaignId, status);

    if (!success) {
      return res.status(404).json({
        success: false,
        error: 'Campaign not found'
      });
    }

    res.json({
      success: true,
      data: {
        campaignId,
        status,
        message: 'Campaign status updated'
      }
    });

  } catch (error) {
    console.error('[SAMPLING] Update campaign status error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update campaign status'
    });
  }
});

/**
 * GET /api/sampling/auto-campaign/signals/history
 * Get signal history
 */
router.get('/auto-campaign/signals/history', async (req, res) => {
  try {
    const { type, startTime, endTime } = req.query;

    if (!type || !startTime || !endTime) {
      return res.status(400).json({
        success: false,
        error: 'type, startTime, and endTime are required'
      });
    }

    const signals = await autoCampaignEngine.getSignalHistory(
      type as SignalType,
      new Date(startTime as string),
      new Date(endTime as string)
    );

    res.json({
      success: true,
      data: {
        signalType: type,
        startTime,
        endTime,
        signalCount: signals.length,
        signals
      }
    });

  } catch (error) {
    console.error('[SAMPLING] Signal history error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get signal history'
    });
  }
});

/**
 * GET /api/sampling/auto-campaign/performance/:campaignId
 * Get campaign performance metrics
 */
router.get('/auto-campaign/performance/:campaignId', async (req, res) => {
  try {
    const { campaignId } = req.params;

    const performance = await campaignPerformanceTracker.getPerformance(campaignId);

    if (!performance) {
      return res.status(404).json({
        success: false,
        error: 'Campaign not found or no performance data'
      });
    }

    res.json({
      success: true,
      data: performance
    });

  } catch (error) {
    console.error('[SAMPLING] Get performance error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get campaign performance'
    });
  }
});

/**
 * POST /api/sampling/auto-campaign/performance/:campaignId/record
 * Record campaign impression or conversion
 */
router.post('/auto-campaign/performance/:campaignId/record', async (req, res) => {
  try {
    const { campaignId } = req.params;
    const { type, userId, coinsUsed, revenue } = req.body;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'userId is required'
      });
    }

    if (type === 'conversion') {
      await campaignPerformanceTracker.recordConversion(campaignId, userId, coinsUsed || 0, revenue || 0);
      res.json({
        success: true,
        data: { message: 'Conversion recorded', campaignId, userId }
      });
    } else {
      await campaignPerformanceTracker.recordImpression(campaignId, userId);
      res.json({
        success: true,
        data: { message: 'Impression recorded', campaignId, userId }
      });
    }

  } catch (error) {
    console.error('[SAMPLING] Record performance error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to record performance'
    });
  }
});

/**
 * GET /api/sampling/auto-campaign/performance/top
 * Get top performing campaigns
 */
router.get('/auto-campaign/performance/top', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 10;

    const topCampaigns = await campaignPerformanceTracker.getTopPerformingCampaigns(limit);

    res.json({
      success: true,
      data: {
        limit,
        count: topCampaigns.length,
        campaigns: topCampaigns
      }
    });

  } catch (error) {
    console.error('[SAMPLING] Get top campaigns error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get top campaigns'
    });
  }
});

/**
 * GET /api/sampling/auto-campaign/config
 * Get current signal configuration
 */
router.get('/auto-campaign/config', async (req, res) => {
  res.json({
    success: true,
    data: {
      signalTypes: [
        { type: 'inventory_excess', description: 'Merchant has excess inventory', weight: 0.25 },
        { type: 'dormant_users', description: 'Users not active recently', weight: 0.20 },
        { type: 'nearby_location', description: 'User near merchant location', weight: 0.25 },
        { type: 'time_based', description: 'Meal times, weekends', weight: 0.15 },
        { type: 'event', description: 'Festivals, seasonal events', weight: 0.15 }
      ],
      defaults: {
        inventoryThreshold: 0.8,
        dormancyDays: 30,
        locationRadiusMeters: 500,
        minSignalStrength: 40,
        autoLaunchThreshold: 75
      },
      coinRecommendations: {
        inventory_excess: { min: 15, max: 50, base: 25 },
        dormant_users: { min: 20, max: 75, base: 40 },
        nearby_location: { min: 10, max: 30, base: 15 },
        time_based: { min: 15, max: 40, base: 20 },
        event: { min: 25, max: 100, base: 50 }
      },
      budgetRecommendations: {
        inventory_excess: { min: 500, max: 5000, base: 1500 },
        dormant_users: { min: 1000, max: 8000, base: 3000 },
        nearby_location: { min: 200, max: 2000, base: 500 },
        time_based: { min: 300, max: 3000, base: 800 },
        event: { min: 2000, max: 20000, base: 8000 }
      }
    }
  });
});

// ============================================
// SMART COIN ALLOCATION ROUTES - Phase 3
// ============================================

/**
 * POST /api/sampling/coins/allocate
 * Main coin allocation endpoint with full breakdown
 */
router.post('/coins/allocate', async (req, res) => {
  try {
    const { userId, campaignId, merchantId, baseCoins, location } = req.body;

    if (!userId || !campaignId || !merchantId) {
      return res.status(400).json({
        success: false,
        error: 'userId, campaignId, and merchantId are required'
      });
    }

    const request: CoinAllocationRequest = {
      userId,
      campaignId,
      merchantId,
      baseCoins: baseCoins || 20,
      location: location ? { lat: location.lat, lng: location.lng } : undefined
    };

    const result = await allocateCoins(request);

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error('[SAMPLING] Coin allocation error:', error);
    res.status(500).json({
      success: false,
      error: 'Coin allocation failed'
    });
  }
});

/**
 * POST /api/sampling/coins/breakdown
 * Get allocation breakdown without reserving budget
 */
router.post('/coins/breakdown', async (req, res) => {
  try {
    const { userId, campaignId, merchantId, baseCoins, location } = req.body;

    if (!userId || !campaignId || !merchantId) {
      return res.status(400).json({
        success: false,
        error: 'userId, campaignId, and merchantId are required'
      });
    }

    const request: CoinAllocationRequest = {
      userId,
      campaignId,
      merchantId,
      baseCoins: baseCoins || 20,
      location: location ? { lat: location.lat, lng: location.lng } : undefined
    };

    const breakdown = await getCoinAllocationBreakdown(request);

    res.json({
      success: true,
      data: breakdown
    });

  } catch (error) {
    console.error('[SAMPLING] Breakdown calculation error:', error);
    res.status(500).json({
      success: false,
      error: 'Breakdown calculation failed'
    });
  }
});

/**
 * GET /api/sampling/coins/user/:userId/stats
 * Get user coin statistics
 */
router.get('/coins/user/:userId/stats', async (req, res) => {
  try {
    const { userId } = req.params;

    const stats = await getUserCoinStats(userId);

    res.json({
      success: true,
      data: stats
    });

  } catch (error) {
    console.error('[SAMPLING] User stats error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get user stats'
    });
  }
});

/**
 * GET /api/sampling/coins/budget/:campaignId/status
 * Get campaign budget status
 */
router.get('/coins/budget/:campaignId/status', async (req, res) => {
  try {
    const { campaignId } = req.params;

    const allocator = new SmartCoinAllocator();
    const status = await allocator.getBudgetStatus(campaignId);

    res.json({
      success: true,
      data: status
    });

  } catch (error) {
    console.error('[SAMPLING] Budget status error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get budget status'
    });
  }
});

/**
 * POST /api/sampling/coins/budget/:campaignId/pause
 * Pause campaign when budget exhausted
 */
router.post('/coins/budget/:campaignId/pause', async (req, res) => {
  try {
    const { campaignId } = req.params;
    const { reason } = req.body;

    const allocator = new SmartCoinAllocator();
    await allocator.pauseCampaign(campaignId, reason || 'Budget exhausted');

    res.json({
      success: true,
      data: {
        campaignId,
        status: 'paused',
        message: 'Campaign paused successfully'
      }
    });

  } catch (error) {
    console.error('[SAMPLING] Pause campaign error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to pause campaign'
    });
  }
});

/**
 * POST /api/sampling/coins/validate
 * Validate allocation request before committing
 */
router.post('/coins/validate', async (req, res) => {
  try {
    const { userId, campaignId, merchantId, baseCoins } = req.body;

    if (!userId || !campaignId || !merchantId) {
      return res.status(400).json({
        success: false,
        error: 'userId, campaignId, and merchantId are required'
      });
    }

    const request: CoinAllocationRequest = {
      userId,
      campaignId,
      merchantId,
      baseCoins: baseCoins || 20
    };

    const allocator = new SmartCoinAllocator();
    const validation = await allocator.validate(request);

    res.json({
      success: true,
      data: validation
    });

  } catch (error) {
    console.error('[SAMPLING] Validation error:', error);
    res.status(500).json({
      success: false,
      error: 'Validation failed'
    });
  }
});

// ============================================
// AUTO COIN DISTRIBUTION ROUTES - Phase 4
// ============================================

/**
 * POST /api/sampling/auto-distribute
 * Main auto coin distribution endpoint
 */
router.post('/auto-distribute', async (req, res) => {
  try {
    const { userId, merchantId, campaignId, location, time } = req.body;

    if (!userId || !merchantId) {
      return res.status(400).json({
        success: false,
        error: 'userId and merchantId are required'
      });
    }

    const context: DistributionContext = {
      userId,
      merchantId,
      campaignId,
      location: location ? { lat: location.lat, lng: location.lng } : undefined,
      time: time ? new Date(time) : new Date()
    };

    const result = await autoCoinDistributionEngine.distribute(context);

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error('[SAMPLING] Auto distribute error:', error);
    res.status(500).json({
      success: false,
      error: 'Distribution failed'
    });
  }
});

/**
 * POST /api/sampling/auto-distribute/preview
 * Preview distribution without recording
 */
router.post('/auto-distribute/preview', async (req, res) => {
  try {
    const { userId, merchantId, campaignId, location, time } = req.body;

    if (!userId || !merchantId) {
      return res.status(400).json({
        success: false,
        error: 'userId and merchantId are required'
      });
    }

    const context: DistributionContext = {
      userId,
      merchantId,
      campaignId,
      location: location ? { lat: location.lat, lng: location.lng } : undefined,
      time: time ? new Date(time) : new Date()
    };

    const result = await autoCoinDistributionEngine.preview(context);

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error('[SAMPLING] Preview error:', error);
    res.status(500).json({
      success: false,
      error: 'Preview failed'
    });
  }
});

/**
 * POST /api/sampling/auto-distribute/quick
 * Quick distribution with minimal context
 */
router.post('/auto-distribute/quick', async (req, res) => {
  try {
    const { userId, merchantId, campaignId } = req.body;

    if (!userId || !merchantId) {
      return res.status(400).json({
        success: false,
        error: 'userId and merchantId are required'
      });
    }

    const result = await distributeCoins(userId, merchantId, campaignId);

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error('[SAMPLING] Quick distribute error:', error);
    res.status(500).json({
      success: false,
      error: 'Quick distribution failed'
    });
  }
});

/**
 * POST /api/sampling/auto-distribute/triggers
 * Get trigger breakdown
 */
router.post('/auto-distribute/triggers', async (req, res) => {
  try {
    const { userId, merchantId } = req.body;

    if (!userId || !merchantId) {
      return res.status(400).json({
        success: false,
        error: 'userId and merchantId are required'
      });
    }

    const breakdown = await getTriggerBreakdown(userId, merchantId);

    res.json({
      success: true,
      data: breakdown
    });

  } catch (error) {
    console.error('[SAMPLING] Trigger breakdown error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get trigger breakdown'
    });
  }
});

/**
 * GET /api/sampling/auto-distribute/history/:userId
 * Get user distribution history
 */
router.get('/auto-distribute/history/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const limit = parseInt(req.query.limit as string) || 20;

    const history = await autoCoinDistributionEngine.getUserDistributionHistory(userId, limit);

    res.json({
      success: true,
      data: {
        userId,
        count: history.length,
        events: history
      }
    });

  } catch (error) {
    console.error('[SAMPLING] Distribution history error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get distribution history'
    });
  }
});

/**
 * GET /api/sampling/auto-distribute/analytics/triggers
 * Get trigger analytics for a date
 */
router.get('/auto-distribute/analytics/triggers', async (req, res) => {
  try {
    const date = req.query.date as string | undefined;

    const analytics = await autoCoinDistributionEngine.getTriggerAnalytics(date);

    res.json({
      success: true,
      data: {
        date: date || new Date().toISOString().split('T')[0],
        analytics
      }
    });

  } catch (error) {
    console.error('[SAMPLING] Trigger analytics error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get trigger analytics'
    });
  }
});

/**
 * POST /api/sampling/auto-distribute/rules
 * Create a new distribution rule
 */
router.post('/auto-distribute/rules', async (req, res) => {
  try {
    const ruleData = req.body;

    if (!ruleData.type || !ruleData.condition || ruleData.coinBoost === undefined) {
      return res.status(400).json({
        success: false,
        error: 'type, condition, and coinBoost are required'
      });
    }

    const { DistributionRuleEngine } = await import('../engines/sampling/autoCoinDistribution');
    const ruleEngine = new DistributionRuleEngine();
    const rule = await ruleEngine.createRule({
      ...ruleData,
      priority: ruleData.priority || 1,
      active: ruleData.active !== false
    });

    res.json({
      success: true,
      data: rule
    });

  } catch (error) {
    console.error('[SAMPLING] Create rule error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create rule'
    });
  }
});

/**
 * GET /api/sampling/auto-distribute/rules
 * Get all active distribution rules
 */
router.get('/auto-distribute/rules', async (req, res) => {
  try {
    const type = req.query.type as 'inventory' | 'segment' | 'time' | 'campaign' | undefined;

    const { DistributionRuleEngine } = await import('../engines/sampling/autoCoinDistribution');
    const ruleEngine = new DistributionRuleEngine();
    const rules = await ruleEngine.getActiveRules(type);

    res.json({
      success: true,
      data: {
        count: rules.length,
        rules
      }
    });

  } catch (error) {
    console.error('[SAMPLING] Get rules error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get rules'
    });
  }
});

/**
 * PATCH /api/sampling/auto-distribute/rules/:ruleId
 * Update a distribution rule
 */
router.patch('/auto-distribute/rules/:ruleId', async (req, res) => {
  try {
    const { ruleId } = req.params;
    const updates = req.body;

    const { DistributionRuleEngine } = await import('../engines/sampling/autoCoinDistribution');
    const ruleEngine = new DistributionRuleEngine();
    const rule = await ruleEngine.updateRule(ruleId, updates);

    if (!rule) {
      return res.status(404).json({
        success: false,
        error: 'Rule not found'
      });
    }

    res.json({
      success: true,
      data: rule
    });

  } catch (error) {
    console.error('[SAMPLING] Update rule error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update rule'
    });
  }
});

/**
 * DELETE /api/sampling/auto-distribute/rules/:ruleId
 * Delete a distribution rule
 */
router.delete('/auto-distribute/rules/:ruleId', async (req, res) => {
  try {
    const { ruleId } = req.params;

    const { DistributionRuleEngine } = await import('../engines/sampling/autoCoinDistribution');
    const ruleEngine = new DistributionRuleEngine();
    const success = await ruleEngine.deleteRule(ruleId);

    if (!success) {
      return res.status(404).json({
        success: false,
        error: 'Rule not found'
      });
    }

    res.json({
      success: true,
      data: {
        message: 'Rule deleted successfully',
        ruleId
      }
    });

  } catch (error) {
    console.error('[SAMPLING] Delete rule error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete rule'
    });
  }
});

/**
 * POST /api/sampling/auto-distribute/rules/init
 * Initialize default distribution rules
 */
router.post('/auto-distribute/rules/init', async (req, res) => {
  try {
    await autoCoinDistributionEngine.createDefaultRules();

    res.json({
      success: true,
      data: {
        message: 'Default rules created successfully'
      }
    });

  } catch (error) {
    console.error('[SAMPLING] Init rules error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to initialize rules'
    });
  }
});

export default router;
