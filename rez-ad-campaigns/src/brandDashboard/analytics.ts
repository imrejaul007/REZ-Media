/**
 * Analytics Module - Real-time Performance Analytics
 * Sponsored Marketing Platform for ReZ
 */

import {
  Analytics,
  RealTimeMetrics,
  HistoricalData,
  FunnelMetrics,
  AttributionData,
  TrendAnalysis,
  DateRange,
  SponsoredCampaign,
  DashboardFilters,
  DashboardOverview,
  AIRecommendation,
} from './brandDashboard';

// =============================================================================
// Analytics Types
// =============================================================================

export interface FunnelStage {
  id: string;
  name: string;
  count: number;
  value: number;
  dropoffRate: number;
  conversionRate: number;
  avgTimeToConvert?: number;
}

export interface AttributionModel {
  type: 'first_touch' | 'last_touch' | 'linear' | 'time_decay' | 'position_based' | 'data_driven';
  weights: Record<string, number>;
}

export interface TrendDataPoint {
  timestamp: Date;
  value: number;
  predicted?: boolean;
  confidenceInterval?: { upper: number; lower: number };
}

export interface AnomalyDetection {
  metric: string;
  expectedValue: number;
  actualValue: number;
  deviation: number;
  severity: 'info' | 'warning' | 'critical';
  description: string;
  recommendations: string[];
}

export interface CompetitorBenchmark {
  competitorId: string;
  competitorName: string;
  metrics: {
    avgCPC: number;
    avgCTR: number;
    avgROAS: number;
    impressionShare: number;
  };
  comparison: 'above' | 'below' | 'equal';
  difference: number;
}

// =============================================================================
// Analytics Service
// =============================================================================

export class AnalyticsService {
  private merchantId: string;
  private refreshInterval: number = 30000; // 30 seconds
  private realTimeInterval?: ReturnType<typeof setInterval>;
  private cachedAnalytics?: Analytics;
  private lastFetchTime?: Date;

  constructor(merchantId: string) {
    this.merchantId = merchantId;
  }

  // ===========================================================================
  // Real-time Analytics
  // ===========================================================================

  public async getRealTimeMetrics(): Promise<RealTimeMetrics> {
    // Simulate real-time data fetch
    // Replace with actual API call
    const baseMetrics = this.getMockRealTimeMetrics();

    return {
      ...baseMetrics,
      timestamp: new Date(),
    };
  }

  public startRealTimeUpdates(
    callback: (metrics: RealTimeMetrics) => void
  ): void {
    if (this.realTimeInterval) {
      this.stopRealTimeUpdates();
    }

    // Initial fetch
    this.getRealTimeMetrics().then(callback);

    // Set up interval
    this.realTimeInterval = setInterval(async () => {
      const metrics = await this.getRealTimeMetrics();
      callback(metrics);
      this.lastFetchTime = new Date();
    }, this.refreshInterval);
  }

  public stopRealTimeUpdates(): void {
    if (this.realTimeInterval) {
      clearInterval(this.realTimeInterval);
      this.realTimeInterval = undefined;
    }
  }

  public setRefreshInterval(ms: number): void {
    this.refreshInterval = Math.max(5000, Math.min(ms, 300000)); // 5s - 5min
    if (this.realTimeInterval) {
      // Restart with new interval
      const callback = () => {}; // Placeholder - would need to store callback
      this.stopRealTimeUpdates();
    }
  }

  // ===========================================================================
  // Historical Analytics
  // ===========================================================================

  public async getHistoricalData(
    dateRange: DateRange,
    granularity: 'hour' | 'day' | 'week' | 'month' = 'day'
  ): Promise<HistoricalData[]> {
    const data: HistoricalData[] = [];
    const startDate = new Date(dateRange.start);
    const endDate = new Date(dateRange.end);

    let currentDate = new Date(startDate);

    while (currentDate <= endDate) {
      const dayData = this.generateHistoricalDataPoint(currentDate, granularity);
      data.push(dayData);

      // Increment based on granularity
      switch (granularity) {
        case 'hour':
          currentDate.setHours(currentDate.getHours() + 1);
          break;
        case 'day':
          currentDate.setDate(currentDate.getDate() + 1);
          break;
        case 'week':
          currentDate.setDate(currentDate.getDate() + 7);
          break;
        case 'month':
          currentDate.setMonth(currentDate.getMonth() + 1);
          break;
      }
    }

    return data;
  }

  private generateHistoricalDataPoint(
    date: Date,
    granularity: 'hour' | 'day' | 'week' | 'month'
  ): HistoricalData {
    // Simulate realistic data with some variance
    const baseImpressions = granularity === 'hour' ? 500 : granularity === 'day' ? 12000 : 50000;
    const variance = 0.2; // 20% variance

    const impressions = Math.round(baseImpressions * (1 + (Math.random() - 0.5) * variance));
    const ctr = 0.02 + Math.random() * 0.03; // 2-5% CTR
    const clicks = Math.round(impressions * ctr);
    const conversionRate = 0.03 + Math.random() * 0.02; // 3-5% conversion
    const conversions = Math.round(clicks * conversionRate);
    const cpc = 0.3 + Math.random() * 0.5; // $0.30-$0.80 CPC
    const spend = clicks * cpc;
    const aov = 35 + Math.random() * 20; // $35-$55 AOV
    const revenue = conversions * aov;

    return {
      date: new Date(date),
      impressions,
      clicks,
      conversions,
      spend: Math.round(spend * 100) / 100,
      revenue: Math.round(revenue * 100) / 100,
    };
  }

  // ===========================================================================
  // Funnel Visualization
  // ===========================================================================

  public async getFunnelMetrics(
    campaignIds?: string[],
    dateRange?: DateRange
  ): Promise<FunnelMetrics> {
    // Simulate funnel data
    const impressions = 100000;
    const views = Math.round(impressions * 0.45); // 45% view rate
    const clicks = Math.round(views * 0.15); // 15% click through
    const addToCart = Math.round(clicks * 0.35); // 35% add to cart
    const checkout = Math.round(addToCart * 0.65); // 65% checkout
    const purchase = Math.round(checkout * 0.72); // 72% purchase

    const dropoffRates: Record<string, number> = {
      impression_to_view: ((impressions - views) / impressions) * 100,
      view_to_click: ((views - clicks) / views) * 100,
      click_to_cart: ((clicks - addToCart) / clicks) * 100,
      cart_to_checkout: ((addToCart - checkout) / addToCart) * 100,
      checkout_to_purchase: ((checkout - purchase) / checkout) * 100,
    };

    return {
      impressions,
      views,
      clicks,
      addToCart,
      checkout,
      purchase,
      dropoffRates,
    };
  }

  public getFunnelStages(funnel: FunnelMetrics): FunnelStage[] {
    const stages: FunnelStage[] = [
      {
        id: 'impressions',
        name: 'Impressions',
        count: funnel.impressions,
        value: funnel.impressions,
        dropoffRate: 0,
        conversionRate: funnel.impressions > 0 ? 1 : 0,
      },
      {
        id: 'views',
        name: 'Ad Views',
        count: funnel.views,
        value: funnel.views,
        dropoffRate: funnel.dropoffRates.impression_to_view,
        conversionRate: funnel.impressions > 0 ? funnel.views / funnel.impressions : 0,
      },
      {
        id: 'clicks',
        name: 'Clicks',
        count: funnel.clicks,
        value: funnel.clicks,
        dropoffRate: funnel.dropoffRates.view_to_click,
        conversionRate: funnel.views > 0 ? funnel.clicks / funnel.views : 0,
      },
      {
        id: 'add_to_cart',
        name: 'Add to Cart',
        count: funnel.addToCart,
        value: funnel.addToCart,
        dropoffRate: funnel.dropoffRates.click_to_cart,
        conversionRate: funnel.clicks > 0 ? funnel.addToCart / funnel.clicks : 0,
      },
      {
        id: 'checkout',
        name: 'Checkout',
        count: funnel.checkout,
        value: funnel.checkout,
        dropoffRate: funnel.dropoffRates.cart_to_checkout,
        conversionRate: funnel.addToCart > 0 ? funnel.checkout / funnel.addToCart : 0,
      },
      {
        id: 'purchase',
        name: 'Purchase',
        count: funnel.purchase,
        value: funnel.purchase * 45, // Assuming $45 AOV
        dropoffRate: funnel.dropoffRates.checkout_to_purchase,
        conversionRate: funnel.checkout > 0 ? funnel.purchase / funnel.checkout : 0,
      },
    ];

    return stages;
  }

  // ===========================================================================
  // Attribution Analysis
  // ===========================================================================

  public async getAttributionData(
    model: AttributionModel['type'] = 'data_driven'
  ): Promise<AttributionData[]> {
    const baseAttribution: Omit<AttributionData, 'attributionWeight'>[] = [
      {
        channel: 'search',
        touchpoints: 4500,
        conversions: 320,
        revenue: 14400,
      },
      {
        channel: 'feed',
        touchpoints: 8500,
        conversions: 280,
        revenue: 12600,
      },
      {
        channel: 'qr',
        touchpoints: 1200,
        conversions: 180,
        revenue: 8100,
      },
      {
        channel: 'location',
        touchpoints: 3400,
        conversions: 220,
        revenue: 9900,
      },
      {
        channel: 'email',
        touchpoints: 2100,
        conversions: 150,
        revenue: 6750,
      },
      {
        channel: 'direct',
        touchpoints: 1800,
        conversions: 130,
        revenue: 5850,
      },
    ];

    // Calculate weights based on attribution model
    const weights = this.getAttributionWeights(model);

    return baseAttribution.map((item) => ({
      ...item,
      attributionWeight: weights[item.channel] || 0,
    }));
  }

  private getAttributionWeights(model: AttributionModel['type']): Record<string, number> {
    const models: Record<AttributionModel['type'], Record<string, number>> = {
      first_touch: {
        search: 0.35,
        feed: 0.30,
        qr: 0.10,
        location: 0.15,
        email: 0.05,
        direct: 0.05,
      },
      last_touch: {
        search: 0.25,
        feed: 0.20,
        qr: 0.05,
        location: 0.15,
        email: 0.25,
        direct: 0.10,
      },
      linear: {
        search: 0.167,
        feed: 0.167,
        qr: 0.167,
        location: 0.167,
        email: 0.167,
        direct: 0.167,
      },
      time_decay: {
        search: 0.20,
        feed: 0.22,
        qr: 0.15,
        location: 0.18,
        email: 0.15,
        direct: 0.10,
      },
      position_based: {
        search: 0.30,
        feed: 0.15,
        qr: 0.05,
        location: 0.15,
        email: 0.20,
        direct: 0.15,
      },
      data_driven: {
        search: 0.28,
        feed: 0.25,
        qr: 0.12,
        location: 0.20,
        email: 0.10,
        direct: 0.05,
      },
    };

    return models[model];
  }

  public compareAttributionModels(): Record<AttributionModel['type'], number> {
    return {
      first_touch: 850,
      last_touch: 920,
      linear: 780,
      time_decay: 810,
      position_based: 845,
      data_driven: 1050, // Data-driven typically performs best
    };
  }

  // ===========================================================================
  // Trend Analysis
  // ===========================================================================

  public async getTrendAnalysis(
    metric: 'impressions' | 'clicks' | 'conversions' | 'spend' | 'roas',
    dateRange: DateRange
  ): Promise<TrendAnalysis> {
    const historicalData = await this.getHistoricalData(dateRange, 'day');

    const values = historicalData.map((d) => {
      switch (metric) {
        case 'impressions':
          return d.impressions;
        case 'clicks':
          return d.clicks;
        case 'conversions':
          return d.conversions;
        case 'spend':
          return d.spend;
        case 'roas':
          return d.revenue > 0 && d.spend > 0 ? d.revenue / d.spend : 0;
        default:
          return 0;
      }
    });

    const { direction, magnitude } = this.calculateTrendDirection(values);
    const forecast = this.forecastNextPeriod(values);
    const confidence = this.calculateConfidence(values);

    return {
      direction,
      magnitude,
      forecast,
      confidence,
      seasonality: this.analyzeSeasonality(values, dateRange),
    };
  }

  private calculateTrendDirection(values: number[]): { direction: TrendAnalysis['direction']; magnitude: number } {
    if (values.length < 2) {
      return { direction: 'stable', magnitude: 0 };
    }

    // Simple linear regression
    const n = values.length;
    const xSum = (n * (n - 1)) / 2;
    const ySum = values.reduce((a, b) => a + b, 0);
    const xySum = values.reduce((sum, y, x) => sum + x * y, 0);
    const xxSum = (n * (n - 1) * (2 * n - 1)) / 6;

    const slope = (n * xySum - xSum * ySum) / (n * xxSum - xSum * xSum);
    const avgValue = ySum / n;

    // Normalize slope to percentage
    const magnitude = avgValue !== 0 ? (slope / avgValue) * 100 : 0;

    let direction: TrendAnalysis['direction'] = 'stable';
    if (magnitude > 2) direction = 'up';
    else if (magnitude < -2) direction = 'down';

    return { direction, magnitude: Math.round(magnitude * 100) / 100 };
  }

  private forecastNextPeriod(values: number[]): number {
    if (values.length < 3) {
      return values[values.length - 1] || 0;
    }

    // Weighted moving average with recent bias
    const weights = [0.1, 0.2, 0.3, 0.4]; // Most recent has highest weight
    const recentValues = values.slice(-4);

    while (recentValues.length < 4) {
      recentValues.unshift(recentValues[0]);
    }

    let forecast = 0;
    for (let i = 0; i < recentValues.length; i++) {
      forecast += recentValues[i] * weights[i];
    }

    return Math.round(forecast * 100) / 100;
  }

  private calculateConfidence(values: number[]): number {
    if (values.length < 5) return 0.5;

    // Calculate R-squared for confidence
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const ssTotal = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0);

    if (ssTotal === 0) return 0.5;

    // Simplified confidence based on data consistency
    const variance = ssTotal / values.length;
    const cv = Math.sqrt(variance) / mean; // Coefficient of variation

    return Math.max(0.1, Math.min(0.99, 1 - cv));
  }

  private analyzeSeasonality(
    values: number[],
    dateRange: DateRange
  ): TrendAnalysis['seasonality'] | undefined {
    if (values.length < 14) return undefined;

    const dayOfWeek: Record<number, number[]> = {};
    const hourOfDay: Record<number, number[]> = {};

    // Initialize arrays
    for (let i = 0; i < 7; i++) dayOfWeek[i] = [];
    for (let i = 0; i < 24; i++) hourOfDay[i] = [];

    // This is a simplified version - in production, would correlate with actual timestamps
    values.forEach((value, index) => {
      const day = index % 7;
      dayOfWeek[day]?.push(value);

      // Simulate hour patterns (would be based on actual hourly data)
      const hour = (index * 4) % 24;
      hourOfDay[hour]?.push(value);
    });

    const avgDayOfWeek: Record<number, number> = {};
    for (const day in dayOfWeek) {
      const arr = dayOfWeek[day];
      avgDayOfWeek[day] = arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
    }

    const avgHourOfDay: Record<number, number> = {};
    for (const hour in hourOfDay) {
      const arr = hourOfDay[hour];
      avgHourOfDay[hour] = arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
    }

    return {
      dayOfWeek: avgDayOfWeek,
      hourOfDay: avgHourOfDay,
      monthlyTrend: values.slice(-12), // Last 12 data points as monthly trend
    };
  }

  // ===========================================================================
  // Anomaly Detection
  // ===========================================================================

  public async detectAnomalies(
    dateRange: DateRange
  ): Promise<AnomalyDetection[]> {
    const anomalies: AnomalyDetection[] = [];
    const data = await this.getHistoricalData(dateRange, 'day');

    if (data.length < 7) return anomalies;

    // Calculate baseline metrics
    const metrics = ['impressions', 'clicks', 'conversions', 'spend'] as const;

    for (const metric of metrics) {
      const values = data.map((d) => d[metric]);
      const mean = values.reduce((a, b) => a + b, 0) / values.length;
      const stdDev = Math.sqrt(
        values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length
      );

      // Check most recent value
      const recentValue = values[values.length - 1];
      const deviation = Math.abs(recentValue - mean) / (stdDev || 1);

      if (deviation > 2) {
        anomalies.push({
          metric,
          expectedValue: mean,
          actualValue: recentValue,
          deviation,
          severity: deviation > 3 ? 'critical' : 'warning',
          description: this.getAnomalyDescription(metric, recentValue, mean),
          recommendations: this.getAnomalyRecommendations(metric, recentValue > mean),
        });
      }
    }

    return anomalies;
  }

  private getAnomalyDescription(
    metric: string,
    actual: number,
    expected: number
  ): string {
    const direction = actual > expected ? 'higher' : 'lower';
    const percentDiff = Math.abs((actual - expected) / expected * 100).toFixed(1);
    return `${metric} is ${percentDiff}% ${direction} than expected (${expected.toFixed(0)} vs ${actual.toFixed(0)})`;
  }

  private getAnomalyRecommendations(
    metric: string,
    aboveExpected: boolean
  ): string[] {
    const recommendations: Record<string, string[]> = {
      impressions: [
        aboveExpected ? 'Consider increasing budget to capitalize on high visibility' : 'Review targeting to improve reach',
        'Check if competitors have increased their activity',
        'Verify campaign is properly serving ads',
      ],
      clicks: [
        aboveExpected ? 'CTR is performing well - monitor conversion rate' : 'Review creative assets and ad copy',
        'Test different CTAs to improve click-through rate',
      ],
      conversions: [
        aboveExpected ? 'Great performance - consider scaling the campaign' : 'Review landing page experience',
        'Check for cart abandonment issues',
        'Verify offer/creative alignment with audience',
      ],
      spend: [
        aboveExpected ? 'Review bidding strategy to optimize cost efficiency' : 'Consider increasing budget if ROAS is positive',
        'Monitor for budget pacing issues',
      ],
    };

    return recommendations[metric] || ['Monitor the metric closely'];
  }

  // ===========================================================================
  // Competitor Benchmarking
  // ===========================================================================

  public async getCompetitorBenchmarks(): Promise<CompetitorBenchmark[]> {
    return [
      {
        competitorId: 'comp_1',
        competitorName: 'Competitor A',
        metrics: {
          avgCPC: 0.65,
          avgCTR: 0.035,
          avgROAS: 3.2,
          impressionShare: 0.25,
        },
        comparison: 'below',
        difference: 0.15,
      },
      {
        competitorId: 'comp_2',
        competitorName: 'Competitor B',
        metrics: {
          avgCPC: 0.45,
          avgCTR: 0.028,
          avgROAS: 4.1,
          impressionShare: 0.18,
        },
        comparison: 'above',
        difference: 0.22,
      },
      {
        competitorId: 'comp_3',
        competitorName: 'Competitor C',
        metrics: {
          avgCPC: 0.55,
          avgCTR: 0.032,
          avgROAS: 3.5,
          impressionShare: 0.15,
        },
        comparison: 'equal',
        difference: 0.05,
      },
    ];
  }

  // ===========================================================================
  // AI Recommendations
  // ===========================================================================

  public async generateRecommendations(
    campaigns: SponsoredCampaign[]
  ): Promise<AIRecommendation[]> {
    const recommendations: AIRecommendation[] = [];

    for (const campaign of campaigns) {
      // Budget optimization
      if (campaign.budget.remaining > campaign.budget.total * 0.5 && campaign.status === 'active') {
        recommendations.push({
          id: `rec_budget_${campaign.id}`,
          type: 'budget_increase',
          title: `Increase budget for ${campaign.name}`,
          description: 'Campaign is pacing well and has significant budget remaining. Increase to capture more demand.',
          potential: campaign.budget.spent * 0.3,
          action: `Increase budget by $${Math.round(campaign.budget.total * 0.25)} to $${Math.round(campaign.budget.total * 1.25)}`,
          confidence: 0.85,
          category: 'budget',
          priority: 'high',
          estimatedImpact: {
            impressionsChange: 0.25,
            clicksChange: 0.22,
            conversionsChange: 0.20,
            revenueChange: campaign.budget.spent * 0.18,
            costChange: campaign.budget.total * 0.25,
          },
          createdAt: new Date(),
        });
      }

      // CTR optimization
      if (campaign.performance.ctr < 0.015 && campaign.performance.impressions > 10000) {
        recommendations.push({
          id: `rec_ctr_${campaign.id}`,
          type: 'creative_refresh',
          title: `Improve CTR for ${campaign.name}`,
          description: 'Low click-through rate suggests creative or targeting may need refresh.',
          potential: campaign.performance.clicks * 0.4,
          action: 'Test 2-3 new ad variations with different hooks and visuals',
          confidence: 0.78,
          category: 'creative',
          priority: 'medium',
          estimatedImpact: {
            impressionsChange: 0,
            clicksChange: 0.40,
            conversionsChange: 0.15,
            revenueChange: campaign.budget.spent * 0.12,
            costChange: 0,
          },
          createdAt: new Date(),
        });
      }

      // ROAS optimization
      if (campaign.performance.roas > 4 && campaign.budget.spent > 500) {
        recommendations.push({
          id: `rec_scale_${campaign.id}`,
          type: 'budget_increase',
          title: `Scale high-performing campaign ${campaign.name}`,
          description: 'ROAS exceeds target by more than 30%. Consider scaling to increase revenue.',
          potential: campaign.performance.conversions * 0.5 * 45,
          action: `Double budget to $${campaign.budget.total * 2} and monitor ROAS`,
          confidence: 0.92,
          category: 'budget',
          priority: 'high',
          estimatedImpact: {
            impressionsChange: 1.0,
            clicksChange: 0.95,
            conversionsChange: 0.85,
            revenueChange: campaign.performance.conversions * 0.5 * 45,
            costChange: campaign.budget.total,
          },
          createdAt: new Date(),
        });
      }

      // Targeting expansion
      if (campaign.targeting.categories.length <= 2) {
        recommendations.push({
          id: `rec_target_${campaign.id}`,
          type: 'targeting_expand',
          title: `Expand targeting for ${campaign.name}`,
          description: 'Narrow targeting may limit reach and increase costs.',
          potential: campaign.performance.impressions * 0.5,
          action: 'Add 3-5 related categories to expand audience',
          confidence: 0.72,
          category: 'targeting',
          priority: 'low',
          estimatedImpact: {
            impressionsChange: 0.50,
            clicksChange: 0.30,
            conversionsChange: 0.25,
            revenueChange: campaign.budget.spent * 0.15,
            costChange: campaign.budget.spent * 0.1,
          },
          createdAt: new Date(),
        });
      }
    }

    // Sort by priority and confidence
    return recommendations.sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      }
      return b.confidence - a.confidence;
    });
  }

  // ===========================================================================
  // Dashboard Overview
  // ===========================================================================

  public async getDashboardOverview(
    dateRange: DateRange,
    filters?: DashboardFilters
  ): Promise<DashboardOverview> {
    const historicalData = await this.getHistoricalData(dateRange);

    const totalImpressions = historicalData.reduce((sum, d) => sum + d.impressions, 0);
    const totalClicks = historicalData.reduce((sum, d) => sum + d.clicks, 0);
    const totalConversions = historicalData.reduce((sum, d) => sum + d.conversions, 0);
    const totalSpend = historicalData.reduce((sum, d) => sum + d.spend, 0);
    const totalRevenue = historicalData.reduce((sum, d) => sum + d.revenue, 0);

    return {
      totalSpend: Math.round(totalSpend * 100) / 100,
      totalImpressions,
      totalClicks,
      totalConversions,
      roi: totalSpend > 0 ? Math.round((totalRevenue - totalSpend) / totalSpend * 100) / 100 : 0,
      avgCPC: totalClicks > 0 ? Math.round(totalSpend / totalClicks * 100) / 100 : 0,
      avgCTR: totalImpressions > 0 ? Math.round(totalClicks / totalImpressions * 10000) / 100 : 0,
      period: dateRange,
    };
  }

  // ===========================================================================
  // Complete Analytics
  // ===========================================================================

  public async getCompleteAnalytics(
    dateRange: DateRange,
    filters?: DashboardFilters
  ): Promise<Analytics> {
    const [realTime, historical, funnel, attribution, trends] = await Promise.all([
      this.getRealTimeMetrics(),
      this.getHistoricalData(dateRange),
      this.getFunnelMetrics(),
      this.getAttributionData(),
      this.getTrendAnalysis('roas', dateRange),
    ]);

    return {
      realTime,
      historical,
      funnel,
      attribution,
      trends,
    };
  }

  // ===========================================================================
  // Export Functions
  // ===========================================================================

  public async exportData(
    format: 'csv' | 'json' | 'xlsx',
    dateRange: DateRange
  ): Promise<string> {
    const data = await this.getHistoricalData(dateRange);

    switch (format) {
      case 'json':
        return JSON.stringify(data, null, 2);

      case 'csv':
        const headers = Object.keys(data[0] || {}).join(',');
        const rows = data.map((row) =>
          Object.values(row)
            .map((v) => (typeof v === 'object' && v instanceof Date ? v.toISOString() : v))
            .join(',')
        );
        return [headers, ...rows].join('\n');

      default:
        return JSON.stringify(data);
    }
  }

  // ===========================================================================
  // Mock Data Generators
  // ===========================================================================

  private getMockRealTimeMetrics(): RealTimeMetrics {
    return {
      impressions: Math.round(1000 + Math.random() * 500),
      clicks: Math.round(20 + Math.random() * 15),
      conversions: Math.round(1 + Math.random() * 3),
      spend: Math.round((10 + Math.random() * 5) * 100) / 100,
    };
  }
}

// =============================================================================
// Visualization Helpers
// =============================================================================

export interface ChartDataPoint {
  label: string;
  value: number;
  color?: string;
}

export class AnalyticsVisualization {
  public static formatFunnelData(funnel: FunnelMetrics): ChartDataPoint[] {
    return [
      { label: 'Impressions', value: funnel.impressions, color: '#6366f1' },
      { label: 'Views', value: funnel.views, color: '#8b5cf6' },
      { label: 'Clicks', value: funnel.clicks, color: '#a855f7' },
      { label: 'Add to Cart', value: funnel.addToCart, color: '#d946ef' },
      { label: 'Checkout', value: funnel.checkout, color: '#ec4899' },
      { label: 'Purchase', value: funnel.purchase, color: '#f43f5e' },
    ];
  }

  public static formatTrendData(
    historicalData: HistoricalData[],
    metric: keyof HistoricalData
  ): ChartDataPoint[] {
    return historicalData.map((d, index) => ({
      label: new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      value: typeof d[metric] === 'number' ? d[metric] as number : 0,
    }));
  }

  public static formatAttributionData(attribution: AttributionData[]): ChartDataPoint[] {
    const colors = ['#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#ec4899', '#f43f5e'];
    return attribution.map((item, index) => ({
      label: item.channel.charAt(0).toUpperCase() + item.channel.slice(1),
      value: Math.round(item.conversions * item.attributionWeight),
      color: colors[index % colors.length],
    }));
  }

  public static calculateGrowthRate(current: number, previous: number): number {
    if (previous === 0) return current > 0 ? 100 : 0;
    return Math.round(((current - previous) / previous) * 10000) / 100;
  }
}

// =============================================================================
// Report Generation
// =============================================================================

export interface PerformanceReport {
  title: string;
  generatedAt: Date;
  period: DateRange;
  overview: DashboardOverview;
  topPerformingCampaigns: Array<{
    campaign: SponsoredCampaign;
    metrics: {
      roas: number;
      conversions: number;
      spend: number;
    };
  }>;
  recommendations: AIRecommendation[];
  insights: string[];
}

export class ReportGenerator {
  public async generatePerformanceReport(
    analyticsService: AnalyticsService,
    campaigns: SponsoredCampaign[],
    dateRange: DateRange
  ): Promise<PerformanceReport> {
    const overview = await analyticsService.getDashboardOverview(dateRange);
    const recommendations = await analyticsService.generateRecommendations(campaigns);

    // Sort campaigns by ROAS
    const sortedCampaigns = [...campaigns].sort(
      (a, b) => b.performance.roas - a.performance.roas
    );
    const topPerforming = sortedCampaigns.slice(0, 5).map((campaign) => ({
      campaign,
      metrics: {
        roas: campaign.performance.roas,
        conversions: campaign.performance.conversions,
        spend: campaign.budget.spent,
      },
    }));

    // Generate insights
    const insights: string[] = [];
    if (overview.roi > 2) {
      insights.push(`Your campaigns are delivering ${overview.roi.toFixed(1)}x ROI, exceeding the 2x target.`);
    }
    if (overview.avgCTR > 0.03) {
      insights.push('Click-through rates are above industry average (3%+).');
    }
    if (overview.totalConversions > 100) {
      insights.push(`You've generated ${overview.totalConversions} conversions this period.`);
    }

    return {
      title: 'Campaign Performance Report',
      generatedAt: new Date(),
      period: dateRange,
      overview,
      topPerformingCampaigns: topPerforming,
      recommendations: recommendations.slice(0, 5),
      insights,
    };
  }
}
