/**
 * MERCHANT COIN ANALYTICS DASHBOARD API
 * Phase 4: Coin performance analytics for merchants
 *
 * Endpoints:
 * - GET /api/merchant/:merchantId/coins/analytics    - Overall coin metrics
 * - GET /api/merchant/:merchantId/coins/customers   - Customer insights & LTV
 * - GET /api/merchant/:merchantId/coins/campaigns  - Campaign performance
 * - GET /api/merchant/:merchantId/coins/trends     - Trend analysis
 * - GET /api/merchant/:merchantId/coins/leaderboard - Top earners/redeemers
 */

import { Router, Request, Response } from 'express';
import Redis from 'ioredis';

const router = Router();

// ============================================
// TYPES & INTERFACES
// ============================================

interface DateRange {
  start: Date;
  end: Date;
}

interface TimeSeriesPoint {
  date: string;
  value: number;
  coins?: number;
  redemptions?: number;
}

interface CoinMetrics {
  totalInCirculation: number;
  totalRedeemed: number;
  totalExpired: number;
  activeCustomers: number;
  redemptionRate: number;
  avgCoinsPerCustomer: number;
}

interface CustomerLTV {
  userId: string;
  totalCoinsEarned: number;
  totalCoinsRedeemed: number;
  lifetimeValue: number;
  lastActivity: string;
  visitCount: number;
}

interface CampaignPerformance {
  campaignId: string;
  campaignName: string;
  coinsDistributed: number;
  redemptions: number;
  revenue: number;
  roi: number;
  status: 'active' | 'paused' | 'completed' | 'draft';
}

interface TrendData {
  period: string;
  coinsEarned: number;
  coinsRedeemed: number;
  newCustomers: number;
  returningCustomers: number;
  retentionRate: number;
  growthRate: number;
}

// ============================================
// HELPERS
// ============================================

/**
 * Parse date range from query params or return defaults
 */
function parseDateRange(req: Request): DateRange {
  const now = new Date();
  const defaultStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000); // 30 days ago

  const start = req.query.start
    ? new Date(req.query.start as string)
    : defaultStart;
  const end = req.query.end
    ? new Date(req.query.end as string)
    : now;

  return { start, end };
}

/**
 * Generate date array between two dates
 */
function getDateArray(start: Date, end: Date): string[] {
  const dates: string[] = [];
  const current = new Date(start);

  while (current <= end) {
    dates.push(current.toISOString().split('T')[0]);
    current.setDate(current.getDate() + 1);
  }

  return dates;
}

/**
 * Get period string for trend grouping
 */
function getPeriodString(date: Date, granularity: 'daily' | 'weekly' | 'monthly'): string {
  if (granularity === 'monthly') {
    return date.toISOString().slice(0, 7); // YYYY-MM
  } else if (granularity === 'weekly') {
    const weekStart = new Date(date);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    return weekStart.toISOString().slice(0, 10);
  }
  return date.toISOString().split('T')[0];
}

/**
 * Create Redis client with error handling
 */
async function getRedisClient(): Promise<Redis> {
  const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
  return redis;
}

/**
 * Calculate percentage with safe division
 */
function safePercentage(numerator: number, denominator: number): number {
  if (denominator === 0) return 0;
  return Math.round((numerator / denominator) * 100 * 100) / 100;
}

/**
 * Calculate growth rate between two periods
 */
function calculateGrowthRate(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 100 * 100) / 100;
}

/**
 * Format currency
 */
function formatCurrency(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

/**
 * Generate unique merchant coin key prefix
 */
function merchantCoinKey(merchantId: string, suffix: string): string {
  return `merchantcoin:${merchantId}:${suffix}`;
}

// ============================================
// 1. COIN ANALYTICS
// GET /api/merchant/:merchantId/coins/analytics
// ============================================

router.get('/:merchantId/coins/analytics', async (req: Request, res: Response) => {
  try {
    const redis = await getRedisClient();
    const { merchantId } = req.params;
    const { start, end } = parseDateRange(req);
    const dates = getDateArray(start, end);
    const granularity = (req.query.granularity as 'daily' | 'weekly' | 'monthly') || 'daily';

    const REDIS_KEYS = {
      coinsInCirculation: (date: string) => merchantCoinKey(merchantId, `circulation:${date}`),
      coinsRedeemed: (date: string) => merchantCoinKey(merchantId, `redeemed:${date}`),
      coinsExpired: (date: string) => merchantCoinKey(merchantId, `expired:${date}`),
      activeCustomers: (date: string) => merchantCoinKey(merchantId, `active_customers:${date}`),
      totalCoinsEver: merchantCoinKey(merchantId, 'total_coins_ever'),
      totalRedeemedEver: merchantCoinKey(merchantId, 'total_redeemed_ever'),
      customerSet: merchantCoinKey(merchantId, 'customer_set'),
      budgetTotal: merchantCoinKey(merchantId, 'budget_total'),
      budgetSpent: merchantCoinKey(merchantId, 'budget_spent')
    };

    // Aggregate daily metrics
    let totalInCirculation = 0;
    let totalRedeemed = 0;
    let totalExpired = 0;
    let totalActiveCustomers = 0;
    const timeSeries: TimeSeriesPoint[] = [];

    const pipeline = redis.pipeline();

    for (const date of dates) {
      pipeline.get(REDIS_KEYS.coinsInCirculation(date));
      pipeline.get(REDIS_KEYS.coinsRedeemed(date));
      pipeline.get(REDIS_KEYS.coinsExpired(date));
      pipeline.get(REDIS_KEYS.activeCustomers(date));
    }

    pipeline.get(REDIS_KEYS.totalCoinsEver);
    pipeline.get(REDIS_KEYS.totalRedeemedEver);
    pipeline.get(REDIS_KEYS.budgetTotal);
    pipeline.get(REDIS_KEYS.budgetSpent);
    pipeline.scard(REDIS_KEYS.customerSet);

    const results = await pipeline.exec();

    // Parse daily data
    for (let i = 0; i < dates.length; i++) {
      const baseIndex = i * 4;
      const inCirc = parseInt(results?.[baseIndex]?.[1] as string || '0');
      const redeemed = parseInt(results?.[baseIndex + 1]?.[1] as string || '0');
      const expired = parseInt(results?.[baseIndex + 2]?.[1] as string || '0');
      const activeCust = parseInt(results?.[baseIndex + 3]?.[1] as string || '0');

      totalInCirculation += inCirc;
      totalRedeemed += redeemed;
      totalExpired += expired;
      totalActiveCustomers += activeCust;

      timeSeries.push({
        date: dates[i],
        value: inCirc,
        coins: inCirc,
        redemptions: redeemed
      });
    }

    // Get totals
    const totalCoinsEver = parseInt(results?.[results.length - 4]?.[1] as string || '0');
    const totalRedeemedEver = parseInt(results?.[results.length - 3]?.[1] as string || '0');
    const budgetTotal = parseInt(results?.[results.length - 2]?.[1] as string || '10000');
    const budgetSpent = parseInt(results?.[results.length - 1]?.[1] as string || '0');
    const uniqueCustomers = parseInt(results?.[results.length]?.[1] as string || '0') ||
                           await redis.scard(REDIS_KEYS.customerSet);

    // Calculate metrics
    const redemptionRate = safePercentage(totalRedeemed, totalCoinsEver || totalInCirculation);
    const avgCoinsPerCustomer = safePercentage(totalInCirculation, uniqueCustomers || 1);
    const avgDailyCirculation = Math.round(totalInCirculation / dates.length);
    const avgDailyRedemptions = Math.round(totalRedeemed / dates.length);
    const avgDailyActive = Math.round(totalActiveCustomers / dates.length);

    // Budget metrics
    const budgetUtilization = safePercentage(budgetSpent, budgetTotal);
    const budgetRemaining = budgetTotal - budgetSpent;

    // Group time series by granularity
    const groupedTimeSeries = groupTimeSeriesByGranularity(timeSeries, granularity);

    // Coin flow breakdown
    const coinFlow = {
      earned: totalInCirculation,
      redeemed: totalRedeemed,
      expired: totalExpired,
      pending: totalInCirculation - totalRedeemed - totalExpired
    };

    // Calculate period-over-period comparison
    const periodDays = dates.length;
    const halfPoint = Math.floor(periodDays / 2);
    const firstHalf = dates.slice(0, halfPoint);
    const secondHalf = dates.slice(halfPoint);

    let firstHalfCirculation = 0;
    let secondHalfCirculation = 0;
    let firstHalfRedemptions = 0;
    let secondHalfRedemptions = 0;

    for (const date of firstHalf) {
      firstHalfCirculation += parseInt(await redis.get(REDIS_KEYS.coinsInCirculation(date)) || '0');
      firstHalfRedemptions += parseInt(await redis.get(REDIS_KEYS.coinsRedeemed(date)) || '0');
    }
    for (const date of secondHalf) {
      secondHalfCirculation += parseInt(await redis.get(REDIS_KEYS.coinsRedeemed(date)) || '0');
      secondHalfRedemptions += parseInt(await redis.get(REDIS_KEYS.coinsRedeemed(date)) || '0');
    }

    const circulationGrowth = calculateGrowthRate(secondHalfCirculation, firstHalfCirculation);
    const redemptionGrowth = calculateGrowthRate(secondHalfRedemptions, firstHalfRedemptions);

    const analytics = {
      merchantId,
      period: { start: start.toISOString(), end: end.toISOString(), granularity },
      summary: {
        totalCoinsInCirculation: totalInCirculation,
        totalRedeemed,
        totalExpired,
        uniqueCustomers,
        redemptionRate: `${redemptionRate}%`,
        avgCoinsPerCustomer: Math.round(avgCoinsPerCustomer),
        coinFlow
      },
      budget: {
        total: budgetTotal,
        spent: budgetSpent,
        remaining: budgetRemaining,
        utilization: `${budgetUtilization}%`
      },
      trends: {
        circulationGrowthRate: `${circulationGrowth > 0 ? '+' : ''}${circulationGrowth}%`,
        redemptionGrowthRate: `${redemptionGrowth > 0 ? '+' : ''}${redemptionGrowth}%`
      },
      averages: {
        dailyCirculation: avgDailyCirculation,
        dailyRedemptions: avgDailyRedemptions,
        dailyActiveCustomers: avgDailyActive
      },
      timeSeries: groupedTimeSeries,
      meta: {
        daysAnalyzed: dates.length,
        generatedAt: new Date().toISOString()
      }
    };

    await redis.quit();

    res.json({
      success: true,
      data: analytics
    });

  } catch (error) {
    console.error('[COIN ANALYTICS] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch coin analytics'
    });
  }
});

// ============================================
// 2. CUSTOMER INSIGHTS
// GET /api/merchant/:merchantId/coins/customers
// ============================================

router.get('/:merchantId/coins/customers', async (req: Request, res: Response) => {
  try {
    const redis = await getRedisClient();
    const { merchantId } = req.params;
    const { start, end } = parseDateRange(req);
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);

    const REDIS_KEYS = {
      customerSet: merchantCoinKey(merchantId, 'customer_set'),
      customerCoinsEarned: (userId: string) => merchantCoinKey(merchantId, `customer:${userId}:coins_earned`),
      customerCoinsRedeemed: (userId: string) => merchantCoinKey(merchantId, `customer:${userId}:coins_redeemed`),
      customerLastActivity: (userId: string) => merchantCoinKey(merchantId, `customer:${userId}:last_activity`),
      customerVisitCount: (userId: string) => merchantCoinKey(merchantId, `customer:${userId}:visit_count`),
      customerFirstVisit: (userId: string) => merchantCoinKey(merchantId, `customer:${userId}:first_visit`),
      customerLTV: (userId: string) => merchantCoinKey(merchantId, `customer:${userId}:ltv`),
      customerTier: (userId: string) => merchantCoinKey(merchantId, `customer:${userId}:tier`)
    };

    // Get all customer IDs
    const customerIds = await redis.smembers(REDIS_KEYS.customerSet);

    if (customerIds.length === 0) {
      return res.json({
        success: true,
        data: {
          merchantId,
          period: { start: start.toISOString(), end: end.toISOString() },
          totalCustomers: 0,
          topEarners: [],
          topRedeemers: [],
          highestLTV: [],
          tierDistribution: {},
          summary: {
            totalCoinsEarned: 0,
            totalCoinsRedeemed: 0,
            avgCoinsPerCustomer: 0,
            avgLTV: 0
          }
        }
      });
    }

    // Fetch customer data
    const customerData: CustomerLTV[] = [];
    let totalCoinsEarned = 0;
    let totalCoinsRedeemed = 0;
    let totalLTV = 0;
    const tierDistribution: Record<string, number> = { bronze: 0, silver: 0, gold: 0, platinum: 0 };

    for (const userId of customerIds) {
      const [coinsEarned, coinsRedeemed, lastActivity, visitCount, ltv, tier] = await Promise.all([
        redis.get(REDIS_KEYS.customerCoinsEarned(userId)),
        redis.get(REDIS_KEYS.customerCoinsRedeemed(userId)),
        redis.get(REDIS_KEYS.customerLastActivity(userId)),
        redis.get(REDIS_KEYS.customerVisitCount(userId)),
        redis.get(REDIS_KEYS.customerLTV(userId)),
        redis.get(REDIS_KEYS.customerTier(userId))
      ]);

      const earned = parseInt(coinsEarned || '0');
      const redeemed = parseInt(coinsRedeemed || '0');
      const customerLTV = parseFloat(ltv || '0');
      const visits = parseInt(visitCount || '0');
      const customerTier = tier || 'bronze';

      totalCoinsEarned += earned;
      totalCoinsRedeemed += redeemed;
      totalLTV += customerLTV;

      // Count tier distribution
      if (tierDistribution[customerTier] !== undefined) {
        tierDistribution[customerTier]++;
      }

      customerData.push({
        userId,
        totalCoinsEarned: earned,
        totalCoinsRedeemed: redeemed,
        lifetimeValue: customerLTV,
        lastActivity: lastActivity || 'never',
        visitCount: visits
      });
    }

    // Sort and get top performers
    const topEarners = [...customerData]
      .sort((a, b) => b.totalCoinsEarned - a.totalCoinsEarned)
      .slice(0, limit)
      .map((c, i) => ({
        rank: i + 1,
        ...c
      }));

    const topRedeemers = [...customerData]
      .sort((a, b) => b.totalCoinsRedeemed - a.totalCoinsRedeemed)
      .slice(0, limit)
      .map((c, i) => ({
        rank: i + 1,
        ...c
      }));

    const highestLTV = [...customerData]
      .sort((a, b) => b.lifetimeValue - a.lifetimeValue)
      .slice(0, limit)
      .map((c, i) => ({
        rank: i + 1,
        ...c
      }));

    // Calculate retention metrics
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    let returningCustomers = 0;
    let newCustomers = 0;

    for (const customer of customerData) {
      if (customer.lastActivity !== 'never') {
        if (new Date(customer.lastActivity) >= new Date(thirtyDaysAgo)) {
          returningCustomers++;
        }
      }
      if (customer.visitCount === 1) {
        newCustomers++;
      }
    }

    const retentionRate = safePercentage(returningCustomers, customerIds.length);
    const avgLTV = safePercentage(totalLTV, customerIds.length);
    const avgCoinsPerCustomer = safePercentage(totalCoinsEarned, customerIds.length);
    const avgRedemptionRate = safePercentage(totalCoinsRedeemed, totalCoinsEarned);

    // Calculate customer value segments
    const valueSegments = {
      highValue: customerData.filter(c => c.lifetimeValue >= 100).length,
      mediumValue: customerData.filter(c => c.lifetimeValue >= 20 && c.lifetimeValue < 100).length,
      lowValue: customerData.filter(c => c.lifetimeValue < 20).length,
      atRisk: customerData.filter(c => {
        const lastActive = c.lastActivity !== 'never'
          ? (Date.now() - new Date(c.lastActivity).getTime()) / (1000 * 60 * 60 * 24)
          : Infinity;
        return lastActive > 30;
      }).length
    };

    const insights = {
      merchantId,
      period: { start: start.toISOString(), end: end.toISOString() },
      totalCustomers: customerIds.length,
      topEarners,
      topRedeemers,
      highestLTV,
      tierDistribution,
      valueSegments,
      summary: {
        totalCoinsEarned,
        totalCoinsRedeemed,
        totalLTV,
        avgCoinsPerCustomer: Math.round(avgCoinsPerCustomer),
        avgLTV: Math.round(avgLTV * 100) / 100,
        avgRedemptionRate: `${avgRedemptionRate}%`,
        returningCustomers,
        newCustomers,
        retentionRate: `${retentionRate}%`,
        atRiskCustomers: valueSegments.atRisk
      },
      meta: {
        limit,
        generatedAt: new Date().toISOString()
      }
    };

    await redis.quit();

    res.json({
      success: true,
      data: insights
    });

  } catch (error) {
    console.error('[CUSTOMER INSIGHTS] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch customer insights'
    });
  }
});

// ============================================
// 3. CAMPAIGN ANALYTICS
// GET /api/merchant/:merchantId/coins/campaigns
// ============================================

router.get('/:merchantId/coins/campaigns', async (req: Request, res: Response) => {
  try {
    const redis = await getRedisClient();
    const { merchantId } = req.params;
    const { start, end } = parseDateRange(req);

    const REDIS_KEYS = {
      campaignList: merchantCoinKey(merchantId, 'campaigns'),
      campaignCoins: (campaignId: string) => merchantCoinKey(merchantId, `campaign:${campaignId}:coins`),
      campaignRedemptions: (campaignId: string) => merchantCoinKey(merchantId, `campaign:${campaignId}:redemptions`),
      campaignRevenue: (campaignId: string) => merchantCoinKey(merchantId, `campaign:${campaignId}:revenue`),
      campaignBudget: (campaignId: string) => merchantCoinKey(merchantId, `campaign:${campaignId}:budget`),
      campaignBudgetSpent: (campaignId: string) => merchantCoinKey(merchantId, `campaign:${campaignId}:budget_spent`),
      campaignStatus: (campaignId: string) => merchantCoinKey(merchantId, `campaign:${campaignId}:status`),
      campaignStartDate: (campaignId: string) => merchantCoinKey(merchantId, `campaign:${campaignId}:start_date`),
      campaignEndDate: (campaignId: string) => merchantCoinKey(merchantId, `campaign:${campaignId}:end_date`),
      campaignName: (campaignId: string) => merchantCoinKey(merchantId, `campaign:${campaignId}:name`)
    };

    // Get all campaign IDs
    const campaignIds = await redis.smembers(REDIS_KEYS.campaignList);

    const campaigns: CampaignPerformance[] = [];
    let totalCoinsDistributed = 0;
    let totalRedemptions = 0;
    let totalRevenue = 0;

    for (const campaignId of campaignIds) {
      const [
        coins,
        redemptions,
        revenue,
        budget,
        budgetSpent,
        status,
        startDate,
        endDate,
        name
      ] = await Promise.all([
        redis.get(REDIS_KEYS.campaignCoins(campaignId)),
        redis.get(REDIS_KEYS.campaignRedemptions(campaignId)),
        redis.get(REDIS_KEYS.campaignRevenue(campaignId)),
        redis.get(REDIS_KEYS.campaignBudget(campaignId)),
        redis.get(REDIS_KEYS.campaignBudgetSpent(campaignId)),
        redis.get(REDIS_KEYS.campaignStatus(campaignId)),
        redis.get(REDIS_KEYS.campaignStartDate(campaignId)),
        redis.get(REDIS_KEYS.campaignEndDate(campaignId)),
        redis.get(REDIS_KEYS.campaignName(campaignId))
      ]);

      const coinsDistributed = parseInt(coins || '0');
      const campaignRedemptions = parseInt(redemptions || '0');
      const campaignRevenue = parseFloat(revenue || '0');
      const campaignBudget = parseInt(budget || '0');
      const spent = parseInt(budgetSpent || '0');

      // Calculate ROI (assuming coin cost is 10% of revenue equivalent)
      const coinCost = coinsDistributed * 0.01; // $0.01 per coin
      const roi = coinCost > 0 ? safePercentage(campaignRevenue - coinCost, coinCost) : 0;

      totalCoinsDistributed += coinsDistributed;
      totalRedemptions += campaignRedemptions;
      totalRevenue += campaignRevenue;

      campaigns.push({
        campaignId,
        campaignName: name || `Campaign ${campaignId.slice(0, 8)}`,
        coinsDistributed,
        redemptions: campaignRedemptions,
        revenue: campaignRevenue,
        roi,
        status: (status as CampaignPerformance['status']) || 'active'
      });
    }

    // Sort by ROI (highest first)
    const topPerforming = [...campaigns]
      .sort((a, b) => b.roi - a.roi)
      .slice(0, 5);

    const lowestPerforming = [...campaigns]
      .sort((a, b) => a.roi - b.roi)
      .slice(0, 5);

    // Calculate overall metrics
    const avgROI = safePercentage(campaigns.reduce((sum, c) => sum + c.roi, 0), campaigns.length);
    const avgRedemptionRate = safePercentage(totalRedemptions, totalCoinsDistributed);
    const avgRevenuePerCampaign = safePercentage(totalRevenue, campaigns.length);
    const conversionRate = safePercentage(totalRedemptions, totalCoinsDistributed);

    // Campaign status breakdown
    const statusBreakdown = campaigns.reduce((acc, c) => {
      acc[c.status] = (acc[c.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Budget utilization
    const totalBudgetAllocated = campaigns.reduce((sum, c) => {
      return sum + parseInt(campaignId => redis.get(REDIS_KEYS.campaignBudget(c.campaignId)) as unknown as string || '0');
    }, 0);

    const analytics = {
      merchantId,
      period: { start: start.toISOString(), end: end.toISOString() },
      campaigns: campaigns.sort((a, b) => b.coinsDistributed - a.coinsDistributed),
      topPerforming,
      lowestPerforming,
      statusBreakdown,
      summary: {
        totalCampaigns: campaigns.length,
        activeCampaigns: statusBreakdown['active'] || 0,
        totalCoinsDistributed,
        totalRedemptions,
        totalRevenue: formatCurrency(totalRevenue),
        avgROI: `${avgROI}%`,
        avgRedemptionRate: `${avgRedemptionRate}%`,
        avgRevenuePerCampaign: formatCurrency(avgRevenuePerCampaign),
        conversionRate: `${conversionRate}%`
      },
      recommendations: generateCampaignRecommendations(campaigns, avgRedemptionRate),
      meta: {
        generatedAt: new Date().toISOString()
      }
    };

    await redis.quit();

    res.json({
      success: true,
      data: analytics
    });

  } catch (error) {
    console.error('[CAMPAIGN ANALYTICS] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch campaign analytics'
    });
  }
});

// ============================================
// 4. TREND ANALYSIS
// GET /api/merchant/:merchantId/coins/trends
// ============================================

router.get('/:merchantId/coins/trends', async (req: Request, res: Response) => {
  try {
    const redis = await getRedisClient();
    const { merchantId } = req.params;
    const { start, end } = parseDateRange(req);
    const dates = getDateArray(start, end);
    const granularity = (req.query.granularity as 'daily' | 'weekly' | 'monthly') || 'daily';

    const REDIS_KEYS = {
      coinsEarned: (date: string) => merchantCoinKey(merchantId, `earned:${date}`),
      coinsRedeemed: (date: string) => merchantCoinKey(merchantId, `redeemed:${date}`),
      newCustomers: (date: string) => merchantCoinKey(merchantId, `new_customers:${date}`),
      returningCustomers: (date: string) => merchantCoinKey(merchantId, `returning_customers:${date}`),
      revenue: (date: string) => merchantCoinKey(merchantId, `revenue:${date}`)
    };

    // Aggregate daily data
    const dailyData: TrendData[] = [];

    for (const date of dates) {
      const [coinsEarned, coinsRedeemed, newCust, returningCust, revenue] = await Promise.all([
        redis.get(REDIS_KEYS.coinsEarned(date)),
        redis.get(REDIS_KEYS.coinsRedeemed(date)),
        redis.get(REDIS_KEYS.newCustomers(date)),
        redis.get(REDIS_KEYS.returningCustomers(date)),
        redis.get(REDIS_KEYS.revenue(date))
      ]);

      const earned = parseInt(coinsEarned || '0');
      const redeemed = parseInt(coinsRedeemed || '0');
      const newCustomers = parseInt(newCust || '0');
      const returning = parseInt(returningCust || '0');
      const retentionRate = safePercentage(returning, newCustomers + returning);

      dailyData.push({
        period: date,
        coinsEarned: earned,
        coinsRedeemed: redeemed,
        newCustomers,
        returningCustomers: returning,
        retentionRate,
        growthRate: 0 // Will calculate after
      });
    }

    // Group by granularity
    const groupedData = groupTrendsByGranularity(dailyData, granularity);

    // Calculate growth rates
    for (let i = 1; i < groupedData.length; i++) {
      const current = groupedData[i];
      const previous = groupedData[i - 1];
      current.growthRate = calculateGrowthRate(
        current.coinsEarned,
        previous.coinsEarned
      );
    }

    // Calculate moving averages
    const movingAverageWindow = 7;
    const coinsMA = calculateMovingAverage(
      dailyData.map(d => d.coinsEarned),
      movingAverageWindow
    );
    const redemptionMA = calculateMovingAverage(
      dailyData.map(d => d.coinsRedeemed),
      movingAverageWindow
    );

    // Calculate overall statistics
    const totalCoinsEarned = dailyData.reduce((sum, d) => sum + d.coinsEarned, 0);
    const totalCoinsRedeemed = dailyData.reduce((sum, d) => sum + d.coinsRedeemed, 0);
    const totalNewCustomers = dailyData.reduce((sum, d) => sum + d.newCustomers, 0);
    const totalReturning = dailyData.reduce((sum, d) => sum + d.returningCustomers, 0);

    // Compare first and second half
    const midPoint = Math.floor(dailyData.length / 2);
    const firstHalf = dailyData.slice(0, midPoint);
    const secondHalf = dailyData.slice(midPoint);

    const firstHalfEarned = firstHalf.reduce((sum, d) => sum + d.coinsEarned, 0);
    const secondHalfEarned = secondHalf.reduce((sum, d) => sum + d.coinsEarned, 0);
    const overallGrowthRate = calculateGrowthRate(secondHalfEarned, firstHalfEarned);

    // Peak and low periods
    const peakDay = dailyData.reduce(
      (max, d) => d.coinsEarned > (max?.coinsEarned || 0) ? d : max,
      dailyData[0]
    );
    const lowDay = dailyData.reduce(
      (min, d) => d.coinsEarned < (min?.coinsEarned || Infinity) ? d : min,
      dailyData[0]
    );

    // Day of week analysis
    const dayOfWeekAnalysis = analyzeDayOfWeek(dailyData);

    // Trend direction
    const trendDirection = overallGrowthRate > 5 ? 'UP' :
                          overallGrowthRate < -5 ? 'DOWN' : 'STABLE';

    const trends = {
      merchantId,
      period: { start: start.toISOString(), end: end.toISOString(), granularity },
      daily: dailyData,
      grouped: groupedData,
      movingAverages: {
        coinsEarned: coinsMA,
        coinsRedeemed: redemptionMA,
        window: movingAverageWindow
      },
      summary: {
        totalCoinsEarned,
        totalCoinsRedeemed,
        totalNewCustomers,
        totalReturningCustomers: totalReturning,
        overallGrowthRate: `${overallGrowthRate > 0 ? '+' : ''}${overallGrowthRate}%`,
        trendDirection,
        avgDailyEarned: Math.round(totalCoinsEarned / dates.length),
        avgDailyRedeemed: Math.round(totalCoinsRedeemed / dates.length),
        avgDailyNewCustomers: Math.round(totalNewCustomers / dates.length),
        avgRetentionRate: `${safePercentage(totalReturning, totalNewCustomers + totalReturning)}%`
      },
      peakAndLow: {
        peakDay: peakDay?.period,
        peakCoins: peakDay?.coinsEarned || 0,
        lowDay: lowDay?.period,
        lowCoins: lowDay?.coinsEarned || 0
      },
      dayOfWeekAnalysis,
      meta: {
        daysAnalyzed: dates.length,
        generatedAt: new Date().toISOString()
      }
    };

    await redis.quit();

    res.json({
      success: true,
      data: trends
    });

  } catch (error) {
    console.error('[TREND ANALYSIS] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch trend analysis'
    });
  }
});

// ============================================
// 5. LEADERBOARD
// GET /api/merchant/:merchantId/coins/leaderboard
// ============================================

router.get('/:merchantId/coins/leaderboard', async (req: Request, res: Response) => {
  try {
    const redis = await getRedisClient();
    const { merchantId } = req.params;
    const type = (req.query.type as 'earners' | 'redeemers' | 'ltv') || 'earners';
    const limit = Math.min(parseInt(req.query.limit as string) || 10, 100);
    const period = (req.query.period as 'today' | 'week' | 'month' | 'all') || 'all';

    const REDIS_KEYS = {
      leaderboardEarners: () => {
        const suffix = period === 'all' ? '' : `:${period}`;
        return merchantCoinKey(merchantId, `leaderboard:earners${suffix}`);
      },
      leaderboardRedeemers: () => {
        const suffix = period === 'all' ? '' : `:${period}`;
        return merchantCoinKey(merchantId, `leaderboard:redeemers${suffix}`);
      },
      leaderboardLTV: merchantCoinKey(merchantId, 'leaderboard:ltv'),
      customerCoinsEarned: (userId: string) => merchantCoinKey(merchantId, `customer:${userId}:coins_earned`),
      customerCoinsRedeemed: (userId: string) => merchantCoinKey(merchantId, `customer:${userId}:coins_redeemed`),
      customerLTV: (userId: string) => merchantCoinKey(merchantId, `customer:${userId}:ltv`),
      customerVisitCount: (userId: string) => merchantCoinKey(merchantId, `customer:${userId}:visit_count`),
      customerLastActivity: (userId: string) => merchantCoinKey(merchantId, `customer:${userId}:last_activity`),
      customerTier: (userId: string) => merchantCoinKey(merchantId, `customer:${userId}:tier`)
    };

    // Get leaderboard data based on type
    let leaderboardKey: string;
    switch (type) {
      case 'redeemers':
        leaderboardKey = REDIS_KEYS.leaderboardRedeemers();
        break;
      case 'ltv':
        leaderboardKey = REDIS_KEYS.leaderboardLTV;
        break;
      default:
        leaderboardKey = REDIS_KEYS.leaderboardEarners();
    }

    // Get top users from sorted set
    const rawLeaderboard = await redis.zrevrange(leaderboardKey, 0, limit - 1, 'WITHSCORES');

    const entries: {
      rank: number;
      userId: string;
      value: number;
      coinsEarned?: number;
      coinsRedeemed?: number;
      ltv?: number;
      visits?: number;
      tier?: string;
      lastActivity?: string;
    }[] = [];

    for (let i = 0; i < rawLeaderboard.length; i += 2) {
      const userId = rawLeaderboard[i];
      const score = parseFloat(rawLeaderboard[i + 1] || '0');

      // Fetch additional user details
      const [coinsEarned, coinsRedeemed, ltv, visits, tier, lastActivity] = await Promise.all([
        redis.get(REDIS_KEYS.customerCoinsEarned(userId)),
        redis.get(REDIS_KEYS.customerCoinsRedeemed(userId)),
        redis.get(REDIS_KEYS.customerLTV(userId)),
        redis.get(REDIS_KEYS.customerVisitCount(userId)),
        redis.get(REDIS_KEYS.customerTier(userId)),
        redis.get(REDIS_KEYS.customerLastActivity(userId))
      ]);

      entries.push({
        rank: Math.floor(i / 2) + 1,
        userId,
        value: Math.round(score),
        coinsEarned: parseInt(coinsEarned || '0'),
        coinsRedeemed: parseInt(coinsRedeemed || '0'),
        ltv: Math.round(parseFloat(ltv || '0') * 100) / 100,
        visits: parseInt(visits || '0'),
        tier: tier || 'bronze',
        lastActivity: lastActivity || 'never'
      });
    }

    // Get user's own position if specified
    const userId = req.query.userId as string;
    let userPosition = null;
    if (userId) {
      const rank = await redis.zrevrank(leaderboardKey, userId);
      const score = await redis.zscore(leaderboardKey, userId);
      if (rank !== null) {
        const [coinsEarned, coinsRedeemed, ltv] = await Promise.all([
          redis.get(REDIS_KEYS.customerCoinsEarned(userId)),
          redis.get(REDIS_KEYS.customerCoinsRedeemed(userId)),
          redis.get(REDIS_KEYS.customerLTV(userId))
        ]);

        userPosition = {
          rank: rank + 1,
          userId,
          value: Math.round(parseFloat(score || '0')),
          coinsEarned: parseInt(coinsEarned || '0'),
          coinsRedeemed: parseInt(coinsRedeemed || '0'),
          ltv: Math.round(parseFloat(ltv || '0') * 100) / 100,
          percentile: Math.round((1 - (rank + 1) / (entries.length + 1)) * 100)
        };
      }
    }

    // Calculate tier distribution in leaderboard
    const tierBreakdown = entries.reduce((acc, e) => {
      const tier = e.tier || 'bronze';
      acc[tier] = (acc[tier] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Get trend data (last 7 days)
    const trendData: { date: string; topValue: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];

      const dateLeaderboardKey = merchantCoinKey(merchantId, `leaderboard:earners:${dateStr}`);
      const topEntry = await redis.zrevrange(dateLeaderboardKey, 0, 0, 'WITHSCORES');

      trendData.push({
        date: dateStr,
        topValue: topEntry.length > 1 ? parseFloat(topEntry[1]) : 0
      });
    }

    // Calculate aggregate stats
    const totalValue = entries.reduce((sum, e) => sum + e.value, 0);
    const avgValue = entries.length > 0 ? Math.round(totalValue / entries.length) : 0;
    const totalParticipants = await redis.zcard(leaderboardKey);

    const leaderboard = {
      merchantId,
      type,
      period,
      periodLabel: period === 'today' ? 'Today' :
                   period === 'week' ? 'This Week' :
                   period === 'month' ? 'This Month' : 'All Time',
      entries,
      userPosition,
      tierBreakdown,
      trendData,
      summary: {
        totalParticipants,
        topValue: entries[0]?.value || 0,
        avgValue,
        totalEntries: entries.length
      },
      meta: {
        limit,
        generatedAt: new Date().toISOString()
      }
    };

    await redis.quit();

    res.json({
      success: true,
      data: leaderboard
    });

  } catch (error) {
    console.error('[LEADERBOARD] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch leaderboard'
    });
  }
});

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Group time series data by granularity
 */
function groupTimeSeriesByGranularity(
  data: TimeSeriesPoint[],
  granularity: 'daily' | 'weekly' | 'monthly'
): TimeSeriesPoint[] {
  if (granularity === 'daily') {
    return data;
  }

  const grouped = new Map<string, { coins: number; redemptions: number; count: number }>();

  for (const point of data) {
    const periodKey = getPeriodString(new Date(point.date), granularity);
    const existing = grouped.get(periodKey) || { coins: 0, redemptions: 0, count: 0 };

    grouped.set(periodKey, {
      coins: existing.coins + (point.coins || point.value),
      redemptions: existing.redemptions + (point.redemptions || 0),
      count: existing.count + 1
    });
  }

  return Array.from(grouped.entries()).map(([date, values]) => ({
    date,
    value: values.coins,
    coins: values.coins,
    redemptions: values.redemptions
  }));
}

/**
 * Group trend data by granularity
 */
function groupTrendsByGranularity(
  data: TrendData[],
  granularity: 'daily' | 'weekly' | 'monthly'
): TrendData[] {
  if (granularity === 'daily') {
    return data;
  }

  const grouped = new Map<string, TrendData>();

  for (const point of data) {
    const periodKey = getPeriodString(new Date(point.period), granularity);
    const existing = grouped.get(periodKey);

    if (existing) {
      existing.coinsEarned += point.coinsEarned;
      existing.coinsRedeemed += point.coinsRedeemed;
      existing.newCustomers += point.newCustomers;
      existing.returningCustomers += point.returningCustomers;
    } else {
      grouped.set(periodKey, { ...point, period: periodKey });
    }
  }

  // Recalculate retention rate
  for (const point of grouped.values()) {
    point.retentionRate = safePercentage(
      point.returningCustomers,
      point.newCustomers + point.returningCustomers
    );
  }

  return Array.from(grouped.values());
}

/**
 * Calculate moving average
 */
function calculateMovingAverage(data: number[], window: number): number[] {
  const result: number[] = [];

  for (let i = 0; i < data.length; i++) {
    const start = Math.max(0, i - window + 1);
    const slice = data.slice(start, i + 1);
    const avg = slice.reduce((sum, val) => sum + val, 0) / slice.length;
    result.push(Math.round(avg));
  }

  return result;
}

/**
 * Analyze day of week patterns
 */
function analyzeDayOfWeek(data: TrendData[]): Record<string, {
  avgCoinsEarned: number;
  avgCoinsRedeemed: number;
  dayNumber: number;
}> {
  const dayStats: Record<string, { earned: number[]; redeemed: number[] }> = {
    '0': { earned: [], redeemed: [] },
    '1': { earned: [], redeemed: [] },
    '2': { earned: [], redeemed: [] },
    '3': { earned: [], redeemed: [] },
    '4': { earned: [], redeemed: [] },
    '5': { earned: [], redeemed: [] },
    '6': { earned: [], redeemed: [] }
  };

  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  for (const point of data) {
    const dayOfWeek = new Date(point.period).getDay().toString();
    dayStats[dayOfWeek].earned.push(point.coinsEarned);
    dayStats[dayOfWeek].redeemed.push(point.coinsRedeemed);
  }

  const analysis: Record<string, { avgCoinsEarned: number; avgCoinsRedeemed: number; dayNumber: number }> = {};

  for (const [day, stats] of Object.entries(dayStats)) {
    const avgEarned = stats.earned.length > 0
      ? Math.round(stats.earned.reduce((a, b) => a + b, 0) / stats.earned.length)
      : 0;
    const avgRedeemed = stats.redeemed.length > 0
      ? Math.round(stats.redeemed.reduce((a, b) => a + b, 0) / stats.redeemed.length)
      : 0;

    analysis[dayNames[parseInt(day)]] = {
      avgCoinsEarned: avgEarned,
      avgCoinsRedeemed: avgRedeemed,
      dayNumber: parseInt(day)
    };
  }

  return analysis;
}

/**
 * Generate campaign recommendations based on performance
 */
function generateCampaignRecommendations(
  campaigns: CampaignPerformance[],
  avgRedemptionRate: number
): string[] {
  const recommendations: string[] = [];

  // Check for low ROI campaigns
  const lowROICampaigns = campaigns.filter(c => c.roi < 50);
  if (lowROICampaigns.length > 0) {
    recommendations.push(`${lowROICampaigns.length} campaign(s) have ROI below 50% - review coin allocation`);
  }

  // Check for campaigns with high coins but low redemptions
  const highCoinsLowRedeem = campaigns.filter(c =>
    c.coinsDistributed > 0 && safePercentage(c.redemptions, c.coinsDistributed) < avgRedemptionRate / 2
  );
  if (highCoinsLowRedeem.length > 0) {
    recommendations.push(`${highCoinsLowRedeem.length} campaign(s) showing poor redemption - consider adjusting offer value`);
  }

  // Check for campaigns at budget limit
  const nearBudget = campaigns.filter(c => {
    const budget = 1000; // Would fetch from Redis in real impl
    const spent = c.coinsDistributed * 0.01;
    return spent / budget > 0.9;
  });
  if (nearBudget.length > 0) {
    recommendations.push(`${nearBudget.length} campaign(s) approaching budget limit - consider increasing budget`);
  }

  // General recommendations
  if (avgRedemptionRate < 30) {
    recommendations.push('Overall redemption rate is below target - review customer engagement strategy');
  }

  if (campaigns.length < 3) {
    recommendations.push('Consider launching more campaigns to increase customer engagement');
  }

  return recommendations;
}

export default router;
