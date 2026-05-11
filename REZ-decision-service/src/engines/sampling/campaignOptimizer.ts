import Redis from 'ioredis';

// ============================================
// TYPES & INTERFACES
// ============================================

export interface CampaignMetrics {
  campaignId: string;
  scans: number;
  redemptions: number;
  purchases: number;
  coinsSpent: number;
  revenue: number;
  roi: number;
}

export interface OptimizationResult {
  recommendedCoins: number;
  recommendedTargeting: string[];
  estimatedConversionRate: number;
  confidence: number;
  reason: string;
}

export interface Alert {
  id: string;
  type: 'BUDGET_WARNING' | 'LOW_CONVERSION' | 'ANOMALY';
  campaignId: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  message: string;
  createdAt: Date;
}

export interface ABTestResult {
  variantA: { coins: number; conversionRate: number };
  variantB: { coins: number; conversionRate: number };
  winner: 'A' | 'B' | 'INSUFFICIENT_DATA';
  confidence: number;
  sampleSize: number;
}

export interface CampaignConfig {
  campaignId: string;
  baseCoins: number;
  targeting: string[];
  startDate: Date;
  endDate: Date;
  budget: number;
  channel: 'APP' | 'EMAIL' | 'PUSH' | 'ALL';
}

interface HistoricalCampaign {
  campaignId: string;
  coins: number;
  targeting: string[];
  conversionRate: number;
  roi: number;
  channel: string;
  date: string;
}

// ============================================
// CAMPAIGN OPTIMIZER
// ============================================

export class CampaignOptimizer {
  private redis: Redis;
  private readonly TTL_DAYS = 30;
  private readonly MIN_SAMPLE_SIZE = 100;
  private readonly CONFIDENCE_THRESHOLD = 0.8;
  private readonly BUDGET_WARNING_PERCENT = 0.8;
  private readonly LOW_CONVERSION_THRESHOLD = 0.02;

  constructor(redis?: Redis) {
    this.redis = redis || new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
  }

  // ============================================
  // PERFORMANCE TRACKING
  // ============================================

  /**
   * Record a scan event for a campaign
   */
  async recordScan(campaignId: string): Promise<void> {
    const key = `campaign:metrics:${campaignId}`;
    await this.redis.hincrby(key, 'scans', 1);
    await this.redis.zadd(`${key}:scans:timeline`, Date.now(), `${Date.now()}`);
    await this.redis.expire(key, 86400 * this.TTL_DAYS);
  }

  /**
   * Record a redemption (conversion) event
   */
  async recordRedemption(campaignId: string, coinsAwarded: number): Promise<void> {
    const key = `campaign:metrics:${campaignId}`;
    await this.redis.hincrby(key, 'redemptions', 1);
    await this.redis.hincrby(key, 'coinsSpent', coinsAwarded);
    await this.redis.zadd(`${key}:redemptions:timeline`, Date.now(), `${Date.now()}`);
    await this.redis.expire(key, 86400 * this.TTL_DAYS);
  }

  /**
   * Record a purchase after redemption
   */
  async recordPurchase(campaignId: string, amount: number): Promise<void> {
    const key = `campaign:metrics:${campaignId}`;
    await this.redis.hincrby(key, 'purchases', 1);
    await this.redis.hincrbyfloat(key, 'revenue', amount);
    await this.redis.zadd(`${key}:purchases:timeline`, Date.now(), `${Date.now()}`);
    await this.redis.expire(key, 86400 * this.TTL_DAYS);
  }

  /**
   * Get current metrics for a campaign
   */
  async getMetrics(campaignId: string): Promise<CampaignMetrics> {
    const key = `campaign:metrics:${campaignId}`;
    const metrics = await this.redis.hgetall(key);

    const scans = parseInt(metrics.scans || '0', 10);
    const redemptions = parseInt(metrics.redemptions || '0', 10);
    const purchases = parseInt(metrics.purchases || '0', 10);
    const coinsSpent = parseFloat(metrics.coinsSpent || '0', 10);
    const revenue = parseFloat(metrics.revenue || '0', 10);

    const roi = coinsSpent > 0 ? (revenue - coinsSpent) / coinsSpent : 0;

    return {
      campaignId,
      scans,
      redemptions,
      purchases,
      coinsSpent,
      revenue,
      roi
    };
  }

  /**
   * Get metrics for multiple campaigns
   */
  async getAllMetrics(): Promise<CampaignMetrics[]> {
    const keys = await this.redis.keys('campaign:metrics:*');
    const campaignIds = [...new Set(keys.map(k => k.replace('campaign:metrics:', '')))];
    return Promise.all(campaignIds.map(id => this.getMetrics(id)));
  }

  // ============================================
  // A/B TESTING
  // ============================================

  /**
   * Assign user to A/B test variant
   */
  assignVariant(userId: string, campaignId: string): 'A' | 'B' {
    const hash = this.simpleHash(`${userId}:${campaignId}:${Date.now()}`);
    return hash % 2 === 0 ? 'A' : 'B';
  }

  /**
   * Record A/B test result
   */
  async recordABTestResult(
    campaignId: string,
    variant: 'A' | 'B',
    coinsAwarded: number
  ): Promise<void> {
    const key = `campaign:abtest:${campaignId}:${variant}`;
    await this.redis.hincrby(key, 'impressions', 1);
    await this.redis.hincrby(key, 'coinsSpent', coinsAwarded);
    await this.redis.expire(key, 86400 * this.TTL_DAYS);
  }

  /**
   * Record conversion for A/B test variant
   */
  async recordABTestConversion(campaignId: string, variant: 'A' | 'B'): Promise<void> {
    const key = `campaign:abtest:${campaignId}:${variant}`;
    await this.redis.hincrby(key, 'conversions', 1);
    await this.redis.expire(key, 86400 * this.TTL_DAYS);
  }

  /**
   * Get A/B test results
   */
  async getABTestResults(campaignId: string): Promise<ABTestResult> {
    const [variantA, variantB] = await Promise.all([
      this.redis.hgetall(`campaign:abtest:${campaignId}:A`),
      this.redis.hgetall(`campaign:abtest:${campaignId}:B`)
    ]);

    const impressionsA = parseInt(variantA.impressions || '0', 10);
    const conversionsA = parseInt(variantA.conversions || '0', 10);
    const coinsA = parseInt(variantA.coinsSpent || '0', 10);

    const impressionsB = parseInt(variantB.impressions || '0', 10);
    const conversionsB = parseInt(variantB.conversions || '0', 10);
    const coinsB = parseInt(variantB.coinsSpent || '0', 10);

    const conversionRateA = impressionsA > 0 ? conversionsA / impressionsA : 0;
    const conversionRateB = impressionsB > 0 ? conversionsB / impressionsB : 0;

    const totalSampleSize = impressionsA + impressionsB;
    const confidence = this.calculateConfidence(totalSampleSize);

    let winner: 'A' | 'B' | 'INSUFFICIENT_DATA';
    if (totalSampleSize < this.MIN_SAMPLE_SIZE) {
      winner = 'INSUFFICIENT_DATA';
    } else if (Math.abs(conversionRateA - conversionRateB) < 0.01) {
      winner = 'INSUFFICIENT_DATA';
    } else {
      winner = conversionRateA > conversionRateB ? 'A' : 'B';
    }

    const avgCoinsA = conversionsA > 0 ? coinsA / conversionsA : 0;
    const avgCoinsB = conversionsB > 0 ? coinsB / conversionsB : 0;

    return {
      variantA: { coins: Math.round(avgCoinsA), conversionRate: conversionRateA },
      variantB: { coins: Math.round(avgCoinsB), conversionRate: conversionRateB },
      winner,
      confidence,
      sampleSize: totalSampleSize
    };
  }

  // ============================================
  // AUTO-OPTIMIZATION
  // ============================================

  /**
   * Get optimization recommendation for a campaign
   */
  async getOptimization(campaignId: string): Promise<OptimizationResult> {
    const metrics = await this.getMetrics(campaignId);
    const historicalData = await this.getHistoricalData();
    const abTestResults = await this.getABTestResults(campaignId);

    // Calculate current conversion rate
    const conversionRate = metrics.scans > 0 ? metrics.redemptions / metrics.scans : 0;
    const purchaseRate = metrics.redemptions > 0 ? metrics.purchases / metrics.redemptions : 0;

    // Learn from historical data
    const { predictedOptimalCoins, predictedTargeting, historicalConfidence } =
      this.learnFromHistory(historicalData, metrics.channel);

    // Determine coin recommendation
    const recommendedCoins = this.calculateRecommendedCoins(
      conversionRate,
      metrics.coinsSpent,
      metrics.redemptions,
      predictedOptimalCoins,
      abTestResults
    );

    // Determine targeting recommendation
    const recommendedTargeting = this.calculateRecommendedTargeting(
      metrics.targeting,
      predictedTargeting,
      conversionRate
    );

    // Calculate estimated conversion rate using weighted average
    const estimatedConversionRate = this.weightedAverageConversionRate(
      conversionRate,
      historicalData.length > 0
        ? historicalData.reduce((sum, h) => sum + h.conversionRate, 0) / historicalData.length
        : 0,
      historicalConfidence
    );

    // Calculate confidence based on sample size and historical data
    const confidence = this.calculateConfidence(metrics.scans + historicalData.length * 10);

    // Generate reason
    const reason = this.generateOptimizationReason(
      conversionRate,
      recommendedCoins,
      recommendedTargeting,
      abTestResults
    );

    return {
      recommendedCoins,
      recommendedTargeting,
      estimatedConversionRate,
      confidence,
      reason
    };
  }

  /**
   * Calculate recommended coin amount based on multiple factors
   */
  private calculateRecommendedCoins(
    currentConversionRate: number,
    currentCoinsSpent: number,
    redemptions: number,
    predictedOptimal: number,
    abTestResults: ABTestResult
  ): number {
    const avgCoinsPerRedemption = redemptions > 0 ? currentCoinsSpent / redemptions : 50;

    // Factor 1: If conversion is very low, increase coins
    if (currentConversionRate < this.LOW_CONVERSION_THRESHOLD) {
      const increaseFactor = 1.2 + (this.LOW_CONVERSION_THRESHOLD - currentConversionRate) * 5;
      return Math.round(Math.min(predictedOptimal * increaseFactor, 200));
    }

    // Factor 2: If conversion is high, optimize spend (decrease coins)
    if (currentConversionRate > 0.1) {
      const optimalSpendFactor = 0.85;
      return Math.round(Math.max(avgCoinsPerRedemption * optimalSpendFactor, 10));
    }

    // Factor 3: Use A/B test winner if available
    if (abTestResults.winner !== 'INSUFFICIENT_DATA' && abTestResults.confidence > 0.7) {
      const winnerCoins = abTestResults.winner === 'A'
        ? abTestResults.variantA.coins
        : abTestResults.variantB.coins;
      if (winnerCoins > 0) {
        return Math.round(winnerCoins * 0.95); // Slight optimization
      }
    }

    // Factor 4: Default to predicted optimal with some variance
    const variance = 0.9 + Math.random() * 0.2;
    return Math.round(Math.max(predictedOptimal * variance, 15));
  }

  /**
   * Calculate recommended targeting based on performance
   */
  private calculateRecommendedTargeting(
    currentTargeting: string[],
    predictedTargeting: string[],
    conversionRate: number
  ): string[] {
    if (currentTargeting.length === 0 && predictedTargeting.length > 0) {
      return predictedTargeting;
    }

    // If current targeting is working well, keep it
    if (conversionRate > 0.05) {
      return currentTargeting;
    }

    // Merge current and predicted, favoring high-performing segments
    const allTargeting = [...new Set([...currentTargeting, ...predictedTargeting])];

    // Score each targeting option
    const scoredTargeting = allTargeting.map(segment => {
      const historicalPerformance = this.getSegmentPerformance(segment);
      const isCurrent = currentTargeting.includes(segment);
      return {
        segment,
        score: historicalPerformance + (isCurrent ? 0.2 : 0)
      };
    });

    // Return top targeting options
    return scoredTargeting
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .map(s => s.segment);
  }

  /**
   * Get segment performance score from historical data
   */
  private getSegmentPerformance(segment: string): number {
    // Default performance scores for known segments
    const defaultScores: Record<string, number> = {
      HIGH_VALUE: 0.85,
      CHURNED: 0.7,
      WINDOW_SHOPPERS: 0.6,
      DEAL_SEEKERS: 0.75,
      FOODIES: 0.8,
      BUDGET_MINDERS: 0.65,
      NEW_USERS: 0.5,
      REORDER_PROBABILITY_HIGH: 0.9,
      RECENTLY_PURCHASED: 0.85
    };
    return defaultScores[segment] || 0.5;
  }

  // ============================================
  // LEARNING
  // ============================================

  /**
   * Store campaign data for learning
   */
  async storeCampaignData(config: CampaignConfig): Promise<void> {
    const metrics = await this.getMetrics(config.campaignId);
    const conversionRate = metrics.scans > 0 ? metrics.redemptions / metrics.scans : 0;

    const historicalEntry: HistoricalCampaign = {
      campaignId: config.campaignId,
      coins: config.baseCoins,
      targeting: config.targeting,
      conversionRate,
      roi: metrics.roi,
      channel: config.channel,
      date: new Date().toISOString().split('T')[0]
    };

    await this.redis.lpush('campaign:history', JSON.stringify(historicalEntry));
    await this.redis.ltrim('campaign:history', 0, 999); // Keep last 1000 campaigns
  }

  /**
   * Get historical campaign data
   */
  async getHistoricalData(limit = 100): Promise<HistoricalCampaign[]> {
    const entries = await this.redis.lrange('campaign:history', 0, limit - 1);
    return entries.map(e => JSON.parse(e));
  }

  /**
   * Learn from historical campaigns using weighted averages
   */
  private learnFromHistory(
    historicalData: HistoricalCampaign[],
    channel?: string
  ): { predictedOptimalCoins: number; predictedTargeting: string[]; historicalConfidence: number } {
    if (historicalData.length === 0) {
      return {
        predictedOptimalCoins: 50,
        predictedTargeting: ['HIGH_VALUE', 'DEAL_SEEKERS'],
        historicalConfidence: 0
      };
    }

    // Filter by channel if provided
    const relevantData = channel
      ? historicalData.filter(h => h.channel === channel)
      : historicalData;

    // Calculate weighted average for coins (more recent = higher weight)
    let totalWeightedCoins = 0;
    let totalWeight = 0;

    for (let i = 0; i < relevantData.length; i++) {
      const weight = 1 / (i + 1); // More recent = higher weight
      totalWeightedCoins += relevantData[i].coins * weight;
      totalWeight += weight;
    }

    const predictedOptimalCoins = Math.round(totalWeightedCoins / totalWeight);

    // Find best targeting combinations
    const targetingPerformance = new Map<string, { conversionRate: number; roi: number; count: number }>();

    for (const campaign of relevantData) {
      for (const segment of campaign.targeting) {
        const existing = targetingPerformance.get(segment) || { conversionRate: 0, roi: 0, count: 0 };
        targetingPerformance.set(segment, {
          conversionRate: existing.conversionRate + campaign.conversionRate,
          roi: existing.roi + campaign.roi,
          count: existing.count + 1
        });
      }
    }

    // Calculate average performance per segment
    const segmentScores = Array.from(targetingPerformance.entries()).map(([segment, data]) => ({
      segment,
      score: (data.conversionRate / data.count) * 0.6 + (data.roi / data.count) * 0.4
    }));

    const predictedTargeting = segmentScores
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .map(s => s.segment);

    // Calculate confidence based on data quantity and consistency
    const historicalConfidence = Math.min(relevantData.length / 50, 1);

    return {
      predictedOptimalCoins,
      predictedTargeting,
      historicalConfidence
    };
  }

  /**
   * Predict optimal coin amount for a new campaign
   */
  async predictOptimalCoins(targeting: string[], channel: string): Promise<{ coins: number; confidence: number }> {
    const historicalData = await this.getHistoricalData();
    const relevant = historicalData.filter(h =>
      h.targeting.some(t => targeting.includes(t)) && h.channel === channel
    );

    if (relevant.length < 5) {
      // Fall back to segment-based prediction
      const avgSegmentScore = targeting.reduce(
        (sum, t) => sum + this.getSegmentPerformance(t),
        0
      ) / targeting.length;

      return {
        coins: Math.round(30 + avgSegmentScore * 40), // 30-70 range based on segment quality
        confidence: 0.3
      };
    }

    const { predictedOptimalCoins, historicalConfidence } = this.learnFromHistory(relevant);
    return {
      coins: predictedOptimalCoins,
      confidence: historicalConfidence
    };
  }

  // ============================================
  // ALERTS
  // ============================================

  /**
   * Check for alerts on a campaign
   */
  async checkAlerts(campaignId: string, config: CampaignConfig): Promise<Alert[]> {
    const alerts: Alert[] = [];
    const metrics = await this.getMetrics(campaignId);

    // Budget warning (80% used)
    const budgetUsedPercent = config.budget > 0 ? metrics.coinsSpent / config.budget : 0;
    if (budgetUsedPercent >= this.BUDGET_WARNING_PERCENT && budgetUsedPercent < 1) {
      alerts.push({
        id: `alert:${campaignId}:${Date.now()}`,
        type: 'BUDGET_WARNING',
        campaignId,
        severity: budgetUsedPercent >= 0.95 ? 'CRITICAL' : 'WARNING',
        message: `Budget ${Math.round(budgetUsedPercent * 100)}% used (${metrics.coinsSpent}/${config.budget} coins)`,
        createdAt: new Date()
      });
    }

    // Low conversion alert
    const conversionRate = metrics.scans > 0 ? metrics.redemptions / metrics.scans : 0;
    if (metrics.scans > 50 && conversionRate < this.LOW_CONVERSION_THRESHOLD) {
      alerts.push({
        id: `alert:${campaignId}:${Date.now()}`,
        type: 'LOW_CONVERSION',
        campaignId,
        severity: conversionRate < 0.01 ? 'CRITICAL' : 'WARNING',
        message: `Low conversion rate: ${(conversionRate * 100).toFixed(2)}% (threshold: ${this.LOW_CONVERSION_THRESHOLD * 100}%)`,
        createdAt: new Date()
      });
    }

    // Anomaly detection
    const anomalyAlert = await this.detectAnomalies(campaignId, metrics);
    if (anomalyAlert) {
      alerts.push(anomalyAlert);
    }

    // Store alerts in Redis
    if (alerts.length > 0) {
      await Promise.all(alerts.map(alert =>
        this.redis.lpush(`campaign:alerts:${campaignId}`, JSON.stringify(alert))
      ));
    }

    return alerts;
  }

  /**
   * Detect anomalies in campaign performance
   */
  private async detectAnomalyForChannel(campaignId: string): Promise<Alert | null> {
    const historicalData = await this.getHistoricalData();
    if (historicalData.length < 10) return null;

    const metrics = await this.getMetrics(campaignId);
    const conversionRate = metrics.scans > 0 ? metrics.redemptions / metrics.scans : 0;

    // Calculate historical average and standard deviation
    const conversionRates = historicalData.map(h => h.conversionRate);
    const mean = conversionRates.reduce((a, b) => a + b, 0) / conversionRates.length;
    const variance = conversionRates.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / conversionRates.length;
    const stdDev = Math.sqrt(variance);

    // Check for significant deviation
    const zScore = Math.abs((conversionRate - mean) / (stdDev || 1));

    if (zScore > 2) { // More than 2 standard deviations
      return {
        id: `alert:${campaignId}:${Date.now()}`,
        type: 'ANOMALY',
        campaignId,
        severity: zScore > 3 ? 'CRITICAL' : 'WARNING',
        message: `Anomaly detected: conversion rate ${conversionRate.toFixed(4)} differs significantly from historical average ${mean.toFixed(4)}`,
        createdAt: new Date()
      };
    }

    return null;
  }

  async detectAnomalies(campaignId: string, metrics: CampaignMetrics): Promise<Alert | null> {
    // Check conversion rate anomaly
    const conversionAnomaly = await this.detectConversionRateAnomaly(campaignId, metrics);
    if (conversionAnomaly) return conversionAnomaly;

    // Check ROI anomaly
    const roiAnomaly = this.detectROIAnomaly(metrics);
    if (roiAnomaly) return roiAnomaly;

    // Check for unusual activity patterns
    const activityAnomaly = await this.detectActivityAnomaly(campaignId, metrics);
    if (activityAnomaly) return activityAnomaly;

    return null;
  }

  private async detectConversionRateAnomaly(campaignId: string, metrics: CampaignMetrics): Promise<Alert | null> {
    const historicalData = await this.getHistoricalData();
    if (historicalData.length < 10) return null;

    const currentConversionRate = metrics.scans > 0 ? metrics.redemptions / metrics.scans : 0;
    const historicalRates = historicalData.map(h => h.conversionRate);

    const mean = historicalRates.reduce((a, b) => a + b, 0) / historicalRates.length;
    const variance = historicalRates.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / historicalRates.length;
    const stdDev = Math.sqrt(variance);

    if (stdDev === 0) return null;

    const zScore = Math.abs((currentConversionRate - mean) / stdDev);

    if (zScore > 2) {
      return {
        id: `alert:${campaignId}:${Date.now()}`,
        type: 'ANOMALY',
        campaignId,
        severity: zScore > 3 ? 'CRITICAL' : 'WARNING',
        message: `Conversion rate anomaly: ${(currentConversionRate * 100).toFixed(2)}% (historical avg: ${(mean * 100).toFixed(2)}%, z-score: ${zScore.toFixed(2)})`,
        createdAt: new Date()
      };
    }

    return null;
  }

  private detectROIAnomaly(metrics: CampaignMetrics): Alert | null {
    // Check for unrealistic ROI
    if (metrics.roi > 10) {
      return {
        id: `alert:${metrics.campaignId}:${Date.now()}`,
        type: 'ANOMALY',
        campaignId: metrics.campaignId,
        severity: 'CRITICAL',
        message: `Unrealistic ROI detected: ${metrics.roi.toFixed(2)}x - possible tracking error`,
        createdAt: new Date()
      };
    }

    // Check for negative ROI with high spend
    if (metrics.coinsSpent > 1000 && metrics.roi < -0.5) {
      return {
        id: `alert:${metrics.campaignId}:${Date.now()}`,
        type: 'ANOMALY',
        campaignId: metrics.campaignId,
        severity: 'CRITICAL',
        message: `Significant loss detected: ROI ${(metrics.roi * 100).toFixed(1)}% with ${metrics.coinsSpent} coins spent`,
        createdAt: new Date()
      };
    }

    return null;
  }

  private async detectActivityAnomaly(campaignId: string, metrics: CampaignMetrics): Promise<Alert | null> {
    // Check for unusually high scan rate that doesn't convert
    if (metrics.scans > 100 && metrics.redemptions === 0) {
      return {
        id: `alert:${campaignId}:${Date.now()}`,
        type: 'ANOMALY',
        campaignId,
        severity: 'WARNING',
        message: `High scans (${metrics.scans}) with zero conversions - possible offer display issue`,
        createdAt: new Date()
      };
    }

    // Check for unusual redemption to purchase ratio
    if (metrics.redemptions > 0) {
      const redemptionToPurchaseRatio = metrics.purchases / metrics.redemptions;
      if (redemptionToPurchaseRatio > 0.95) {
        return {
          id: `alert:${campaignId}:${Date.now()}`,
          type: 'ANOMALY',
          campaignId,
          severity: 'INFO',
          message: `Unusually high redemption-to-purchase ratio: ${(redemptionToPurchaseRatio * 100).toFixed(1)}%`,
          createdAt: new Date()
        };
      }
    }

    return null;
  }

  /**
   * Get alerts for a campaign
   */
  async getAlerts(campaignId: string, limit = 10): Promise<Alert[]> {
    const alerts = await this.redis.lrange(`campaign:alerts:${campaignId}`, 0, limit - 1);
    return alerts.map(a => JSON.parse(a));
  }

  /**
   * Clear alerts for a campaign
   */
  async clearAlerts(campaignId: string): Promise<void> {
    await this.redis.del(`campaign:alerts:${campaignId}`);
  }

  // ============================================
  // BUDGET OPTIMIZATION
  // ============================================

  /**
   * Optimize budget allocation across channels
   */
  async optimizeBudgetAllocation(
    campaigns: { campaignId: string; channel: string; spend: number }[]
  ): Promise<{ channel: string; currentPercent: number; recommendedPercent: number; reason: string }[]> {
    const metrics = await Promise.all(campaigns.map(c => this.getMetrics(c.campaignId)));
    const totalSpend = campaigns.reduce((sum, c) => sum + c.spend, 0);

    // Group by channel
    const channelMetrics = new Map<string, { metrics: CampaignMetrics[]; spend: number }>();

    for (let i = 0; i < campaigns.length; i++) {
      const { channel, spend } = campaigns[i];
      const existing = channelMetrics.get(channel) || { metrics: [], spend: 0 };
      existing.metrics.push(metrics[i]);
      existing.spend += spend;
      channelMetrics.set(channel, existing);
    }

    // Calculate performance per channel
    const channelPerformance: {
      channel: string;
      avgROI: number;
      avgConversionRate: number;
      totalSpend: number;
      recommendedPercent: number;
      reason: string;
    }[] = [];

    for (const [channel, data] of channelMetrics.entries()) {
      const avgROI = data.metrics.reduce((sum, m) => sum + m.roi, 0) / data.metrics.length;
      const avgConversionRate = data.metrics.reduce(
        (sum, m) => sum + (m.scans > 0 ? m.redemptions / m.scans : 0),
        0
      ) / data.metrics.length;

      // Calculate recommended budget shift based on ROI
      let recommendedPercent: number;
      let reason: string;

      if (avgROI > 2) {
        recommendedPercent = Math.min(100, (data.spend / totalSpend) * 100 * 1.3);
        reason = 'High ROI - increase budget allocation';
      } else if (avgROI > 0.5) {
        recommendedPercent = (data.spend / totalSpend) * 100;
        reason = 'Solid performance - maintain current allocation';
      } else if (avgROI > 0) {
        recommendedPercent = Math.max(5, (data.spend / totalSpend) * 100 * 0.7);
        reason = 'Low ROI - consider reducing budget';
      } else {
        recommendedPercent = Math.max(0, (data.spend / totalSpend) * 100 * 0.5);
        reason = 'Negative ROI - reduce allocation significantly';
      }

      channelPerformance.push({
        channel,
        avgROI,
        avgConversionRate,
        totalSpend: data.spend,
        recommendedPercent,
        reason
      });
    }

    // Normalize recommendations to sum to 100%
    const totalRecommended = channelPerformance.reduce((sum, c) => sum + c.recommendedPercent, 0);
    return channelPerformance.map(c => ({
      channel: c.channel,
      currentPercent: totalSpend > 0 ? (c.totalSpend / totalSpend) * 100 : 0,
      recommendedPercent: (c.recommendedPercent / totalRecommended) * 100,
      reason: c.reason
    }));
  }

  // ============================================
  // UTILITY METHODS
  // ============================================

  /**
   * Simple hash function for deterministic A/B assignment
   */
  private simpleHash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
    }
    return Math.abs(hash);
  }

  /**
   * Calculate confidence based on sample size
   */
  private calculateConfidence(sampleSize: number): number {
    if (sampleSize < 30) return 0.1;
    if (sampleSize < 100) return 0.3;
    if (sampleSize < 500) return 0.5;
    if (sampleSize < 1000) return 0.7;
    return Math.min(0.95, 0.7 + Math.log10(sampleSize / 1000) * 0.2);
  }

  /**
   * Weighted average for conversion rate
   */
  private weightedAverageConversionRate(
    current: number,
    historical: number,
    historicalWeight: number
  ): number {
    const totalWeight = 1 + historicalWeight;
    return (current + historical * historicalWeight) / totalWeight;
  }

  /**
   * Generate optimization reason string
   */
  private generateOptimizationReason(
    conversionRate: number,
    recommendedCoins: number,
    recommendedTargeting: string[],
    abTestResults: ABTestResult
  ): string {
    const reasons: string[] = [];

    if (conversionRate < this.LOW_CONVERSION_THRESHOLD) {
      reasons.push(`Conversion rate ${(conversionRate * 100).toFixed(2)}% is below target`);
      reasons.push(`Increasing coins to ${recommendedCoins} to improve engagement`);
    } else if (conversionRate > 0.1) {
      reasons.push('Conversion rate is strong, optimizing spend');
      reasons.push(`Reducing coins to ${recommendedCoins} while maintaining performance`);
    } else {
      reasons.push(`Current conversion rate ${(conversionRate * 100).toFixed(2)}% is acceptable`);
    }

    if (recommendedTargeting.length > 0) {
      reasons.push(`Recommended targeting: ${recommendedTargeting.join(', ')}`);
    }

    if (abTestResults.winner !== 'INSUFFICIENT_DATA') {
      reasons.push(`A/B test winner: Variant ${abTestResults.winner}`);
    }

    return reasons.join('. ');
  }

  /**
   * Get channel from campaign metrics
   */
  private get channel(): string {
    return 'ALL'; // Default channel
  }
}

// ============================================
// EXPORTS
// ============================================

export const campaignOptimizer = new CampaignOptimizer();
export default campaignOptimizer;
