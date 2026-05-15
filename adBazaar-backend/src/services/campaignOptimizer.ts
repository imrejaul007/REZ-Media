/**
 * AdBazaar - Campaign Optimizer
 * AI-powered campaign optimization
 */

import { calculateCampaignPayment, PAYMENT_SPLIT } from './paymentService';

interface CampaignMetrics {
  impressions: number;
  clicks: number;
  conversions: number;
  spend: number;
}

interface OptimizationResult {
  recommendations: string[];
  estimatedImprovement: number;
  suggestedBidAdjustment: number;
  audienceExpansion: string[];
}

export class CampaignOptimizer {
  /**
   * Analyze campaign performance and suggest optimizations
   */
  analyze(campaignId: string, metrics: CampaignMetrics): OptimizationResult {
    const recommendations: string[] = [];
    let estimatedImprovement = 0;

    // Calculate actual CPM
    const actualCPM = metrics.impressions > 0
      ? (metrics.spend / metrics.impressions) * 1000
      : 0;

    // CTR analysis
    const ctr = metrics.impressions > 0
      ? (metrics.clicks / metrics.impressions) * 100
      : 0;

    // CVR analysis
    const cvr = metrics.clicks > 0
      ? (metrics.conversions / metrics.clicks) * 100
      : 0;

    // Recommendations
    if (ctr < 1) {
      recommendations.push('Improve creative - CTR is below 1%');
      estimatedImprovement += 10;
    }

    if (cvr < 2) {
      recommendations.push('Optimize landing page - CVR below 2%');
      estimatedImprovement += 15;
    }

    if (actualCPM > 15) {
      recommendations.push('Consider expanding to Tier 2 cities for lower CPM');
      estimatedImprovement += 20;
    }

    if (metrics.conversions < 10 && metrics.impressions > 50000) {
      recommendations.push('Review targeting - high impressions but low conversions');
      estimatedImprovement += 25;
    }

    // Budget optimization
    const suggestedBidAdjustment = this.calculateBidAdjustment(metrics);

    // Audience expansion
    const audienceExpansion = this.suggestAudienceExpansion(campaignId);

    return {
      recommendations,
      estimatedImprovement,
      suggestedBidAdjustment,
      audienceExpansion,
    };
  }

  /**
   * Calculate suggested bid adjustment
   */
  private calculateBidAdjustment(metrics: CampaignMetrics): number {
    const targetCPA = 50; // Target cost per acquisition
    const actualCPA = metrics.conversions > 0
      ? metrics.spend / metrics.conversions
      : targetCPA * 2;

    if (actualCPA > targetCPA * 1.5) {
      return -0.1; // Reduce bid by 10%
    }
    if (actualCPA < targetCPA * 0.7) {
      return 0.1; // Increase bid by 10%
    }
    return 0;
  }

  /**
   * Suggest audience expansion
   */
  private suggestAudienceExpansion(campaignId: string): string[] {
    return [
      'Lookalike audience based on converters',
      'Expand to similar interest categories',
      'Test Tier 2 cities with similar demographics',
    ];
  }

  /**
   * Budget allocation optimizer
   */
  optimizeBudget(
    totalBudget: number,
    campaigns: Array<{ id: string; roas: number }>
  ): Array<{ id: string; budget: number }> {
    const totalROAS = campaigns.reduce((sum, c) => sum + c.roas, 0);

    return campaigns.map(campaign => ({
      id: campaign.id,
      budget: Math.round((campaign.roas / totalROAS) * totalBudget),
    }));
  }
}

export const campaignOptimizer = new CampaignOptimizer();
