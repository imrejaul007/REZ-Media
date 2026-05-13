import { v4 as uuidv4 } from 'uuid';
import { CampaignMetrics, Alert, LiveMetricsSnapshot } from '../types/index.js';

class LiveMetricsService {
  private metrics: Map<string, CampaignMetrics> = new Map();
  private metricsHistory: Map<string, CampaignMetrics[]> = new Map();
  private readonly MAX_HISTORY_POINTS = 100;

  constructor() {
    this.initializeMockData();
  }

  private initializeMockData(): void {
    const mockCampaigns: CampaignMetrics[] = [
      {
        campaignId: 'camp-001',
        impressions: 125000,
        clicks: 3750,
        conversions: 187,
        spend: 2500,
        budget: 10000,
        ctr: 3.0,
        cpc: 0.67,
        conversionRate: 4.99,
        roi: 2.4,
        lastUpdated: new Date(),
      },
      {
        campaignId: 'camp-002',
        impressions: 89000,
        clicks: 2670,
        conversions: 134,
        spend: 1850,
        budget: 5000,
        ctr: 3.0,
        cpc: 0.69,
        conversionRate: 5.02,
        roi: 2.8,
        lastUpdated: new Date(),
      },
      {
        campaignId: 'camp-003',
        impressions: 210000,
        clicks: 6300,
        conversions: 315,
        spend: 4200,
        budget: 15000,
        ctr: 3.0,
        cpc: 0.67,
        conversionRate: 5.0,
        roi: 3.1,
        lastUpdated: new Date(),
      },
    ];

    for (const metric of mockCampaigns) {
      this.metrics.set(metric.campaignId, metric);
      this.metricsHistory.set(metric.campaignId, [metric]);
    }
  }

  public getMetrics(campaignId?: string): CampaignMetrics | CampaignMetrics[] | null {
    if (campaignId) {
      return this.metrics.get(campaignId) || null;
    }
    return Array.from(this.metrics.values());
  }

  public updateMetrics(campaignId: string, updates: Partial<CampaignMetrics>): CampaignMetrics | null {
    const existing = this.metrics.get(campaignId);
    if (!existing) {
      return null;
    }

    const updated: CampaignMetrics = {
      ...existing,
      ...updates,
      lastUpdated: new Date(),
    };

    // Recalculate derived metrics
    updated.ctr = this.calculateCTR(updated.impressions, updated.clicks);
    updated.cpc = this.calculateCPC(updated.clicks, updated.spend);
    updated.conversionRate = this.calculateConversionRate(updated.clicks, updated.conversions);
    updated.roi = this.calculateROI(updated.spend, updated.conversions);

    this.metrics.set(campaignId, updated);

    // Update history
    this.addToHistory(campaignId, updated);

    return updated;
  }

  public incrementImpressions(campaignId: string, count: number = 1): CampaignMetrics | null {
    const existing = this.metrics.get(campaignId);
    if (!existing) {
      return null;
    }

    return this.updateMetrics(campaignId, {
      impressions: existing.impressions + count,
    });
  }

  public incrementClicks(campaignId: string, count: number = 1): CampaignMetrics | null {
    const existing = this.metrics.get(campaignId);
    if (!existing) {
      return null;
    }

    return this.updateMetrics(campaignId, {
      clicks: existing.clicks + count,
    });
  }

  public incrementConversions(campaignId: string, count: number = 1): CampaignMetrics | null {
    const existing = this.metrics.get(campaignId);
    if (!existing) {
      return null;
    }

    return this.updateMetrics(campaignId, {
      conversions: existing.conversions + count,
    });
  }

  public addSpend(campaignId: string, amount: number): CampaignMetrics | null {
    const existing = this.metrics.get(campaignId);
    if (!existing) {
      return null;
    }

    return this.updateMetrics(campaignId, {
      spend: existing.spend + amount,
    });
  }

  public getSnapshot(): LiveMetricsSnapshot {
    const campaigns = Array.from(this.metrics.values());
    const totalImpressions = campaigns.reduce((sum, c) => sum + c.impressions, 0);
    const totalClicks = campaigns.reduce((sum, c) => sum + c.clicks, 0);
    const totalConversions = campaigns.reduce((sum, c) => sum + c.conversions, 0);
    const totalSpend = campaigns.reduce((sum, c) => sum + c.spend, 0);

    return {
      timestamp: new Date(),
      totalImpressions,
      totalClicks,
      totalConversions,
      totalSpend,
      activeCampaigns: campaigns.length,
      campaigns,
    };
  }

  public getHistory(campaignId: string): CampaignMetrics[] {
    return this.metricsHistory.get(campaignId) || [];
  }

  public getAlerts(): Alert[] {
    const alerts: Alert[] = [];

    for (const [campaignId, metrics] of this.metrics) {
      // Budget warning (80% or more spent)
      const budgetPercentage = (metrics.spend / metrics.budget) * 100;
      if (budgetPercentage >= 80 && budgetPercentage < 100) {
        alerts.push({
          id: uuidv4(),
          type: 'budget_warning',
          severity: budgetPercentage >= 95 ? 'critical' : budgetPercentage >= 90 ? 'high' : 'medium',
          campaignId,
          message: `Campaign ${campaignId} has used ${budgetPercentage.toFixed(1)}% of its budget`,
          triggeredAt: new Date(),
          acknowledged: false,
        });
      }

      // Budget exhausted
      if (metrics.spend >= metrics.budget) {
        alerts.push({
          id: uuidv4(),
          type: 'budget_warning',
          severity: 'critical',
          campaignId,
          message: `Campaign ${campaignId} has exhausted its budget`,
          triggeredAt: new Date(),
          acknowledged: false,
        });
      }

      // Low CTR warning
      if (metrics.ctr < 1.5 && metrics.impressions > 1000) {
        alerts.push({
          id: uuidv4(),
          type: 'performance_drop',
          severity: 'medium',
          campaignId,
          message: `Campaign ${campaignId} has a low CTR of ${metrics.ctr.toFixed(2)}%`,
          triggeredAt: new Date(),
          acknowledged: false,
        });
      }

      // Low ROI warning
      if (metrics.roi < 1.5 && metrics.conversions > 10) {
        alerts.push({
          id: uuidv4(),
          type: 'anomaly_detected',
          severity: 'high',
          campaignId,
          message: `Campaign ${campaignId} has a low ROI of ${metrics.roi.toFixed(2)}`,
          triggeredAt: new Date(),
          acknowledged: false,
        });
      }
    }

    return alerts;
  }

  private addToHistory(campaignId: string, metrics: CampaignMetrics): void {
    const history = this.metricsHistory.get(campaignId) || [];
    history.push({ ...metrics });

    if (history.length > this.MAX_HISTORY_POINTS) {
      history.shift();
    }

    this.metricsHistory.set(campaignId, history);
  }

  private calculateCTR(impressions: number, clicks: number): number {
    if (impressions === 0) return 0;
    return (clicks / impressions) * 100;
  }

  private calculateCPC(clicks: number, spend: number): number {
    if (clicks === 0) return 0;
    return spend / clicks;
  }

  private calculateConversionRate(clicks: number, conversions: number): number {
    if (clicks === 0) return 0;
    return (conversions / clicks) * 100;
  }

  private calculateROI(spend: number, conversions: number, avgValue: number = 100): number {
    if (spend === 0) return 0;
    const revenue = conversions * avgValue;
    return revenue / spend;
  }

  // Simulate real-time updates for demo purposes
  public simulateUpdates(): void {
    for (const [campaignId, metrics] of this.metrics) {
      const random = Math.random();

      if (random > 0.3) {
        // New impressions
        const newImpressions = Math.floor(Math.random() * 100) + 10;
        this.incrementImpressions(campaignId, newImpressions);
      }

      if (random > 0.6) {
        // New clicks (roughly 3% of impressions)
        const newClicks = Math.floor(Math.random() * 5) + 1;
        this.incrementClicks(campaignId, newClicks);
      }

      if (random > 0.85) {
        // New conversions (roughly 5% of clicks)
        const newConversions = Math.floor(Math.random() * 2);
        this.incrementConversions(campaignId, newConversions);
      }

      // Continuous spend
      const newSpend = Math.random() * 0.5;
      this.addSpend(campaignId, newSpend);
    }
  }
}

export const liveMetricsService = new LiveMetricsService();
