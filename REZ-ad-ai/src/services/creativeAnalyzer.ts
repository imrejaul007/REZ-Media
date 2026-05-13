/**
 * REZ Ad AI - Creative Analysis Service
 *
 * Analyzes ad creative performance, identifies patterns, and suggests
 * improvements using AI-driven insights.
 */

import {
  CreativeAnalysisOptions,
  AnalyzePerformanceResponse,
  SuggestCreativeOptions,
  SuggestCreativeResponse,
  CreativeSuggestion,
  PerformanceSnapshot,
  PerformanceIssue,
  TrendData,
  BenchmarkData,
  CampaignMetrics,
  BannerAssets,
} from '../types/ad';

// ============================================================================
// Configuration
// ============================================================================

const INDUSTRY_BENCHMARKS: Record<string, BenchmarkData> = {
  default: { ctr: 0.01, cvr: 0.02, cpc: 2.0, cpm: 20, roas: 2.0 },
  fashion: { ctr: 0.015, cvr: 0.025, cpc: 1.8, cpm: 27, roas: 2.5 },
  tech: { ctr: 0.012, cvr: 0.02, cpc: 2.5, cpm: 30, roas: 2.2 },
  food: { ctr: 0.02, cvr: 0.03, cpc: 1.2, cpm: 24, roas: 3.0 },
  travel: { ctr: 0.018, cvr: 0.025, cpc: 1.5, cpm: 27, roas: 2.8 },
  health: { ctr: 0.014, cvr: 0.022, cpc: 2.2, cpm: 31, roas: 2.1 },
  finance: { ctr: 0.01, cvr: 0.015, cpc: 3.5, cpm: 35, roas: 1.8 },
  education: { ctr: 0.016, cvr: 0.028, cpc: 1.8, cpm: 29, roas: 2.6 },
  ecommerce: { ctr: 0.022, cvr: 0.035, cpc: 1.0, cpm: 22, roas: 4.0 },
};

const FATIGUE_THRESHOLD = {
  impressions: 50000,
  daysActive: 14,
  ctrDecline: 0.15,
};

const TOP_PERFORMER_THRESHOLD = 0.8; // Top 20% by ROAS

// ============================================================================
// Utility Functions
// ============================================================================

function calculateAverage(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function calculateTrend(values: number[], dates: Date[]): TrendData {
  if (values.length < 2) {
    return { direction: 'stable' as const, percentage: 0 };
  }

  // Sort by date
  const sorted = values.slice().sort((a, b) => {
    const i = values.indexOf(a);
    const j = values.indexOf(b);
    return dates[i].getTime() - dates[j].getTime();
  });

  const firstHalf = sorted.slice(0, Math.ceil(sorted.length / 2));
  const secondHalf = sorted.slice(Math.floor(sorted.length / 2));

  const firstAvg = calculateAverage(firstHalf);
  const secondAvg = calculateAverage(secondHalf);

  if (firstAvg === 0) {
    return { direction: 'stable' as const, percentage: 0 };
  }

  const percentageChange = ((secondAvg - firstAvg) / firstAvg) * 100;

  let direction: 'up' | 'down' | 'stable';
  if (percentageChange > 5) direction = 'up';
  else if (percentageChange < -5) direction = 'down';
  else direction = 'stable';

  return {
    direction,
    percentage: Math.round(percentageChange * 100) / 100,
    prediction: secondAvg * (1 + percentageChange / 100),
  };
}

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, index)];
}

function getIndustryBenchmark(category?: string): BenchmarkData {
  if (!category) return INDUSTRY_BENCHMARKS.default;

  const lowerCategory = category.toLowerCase();
  for (const [industry, benchmark] of Object.entries(INDUSTRY_BENCHMARKS)) {
    if (lowerCategory.includes(industry)) {
      return benchmark;
    }
  }
  return INDUSTRY_BENCHMARKS.default;
}

function identifyIssues(
  metrics: PerformanceSnapshot,
  benchmarks: BenchmarkData,
  historical: PerformanceSnapshot[]
): PerformanceIssue[] {
  const issues: PerformanceIssue[] = [];

  // Low CTR
  if (metrics.ctr < benchmarks.ctr * 0.7) {
    issues.push({
      type: 'low_ctr',
      severity: metrics.ctr < benchmarks.ctr * 0.5 ? 'critical' : 'warning',
      message: `CTR (${(metrics.ctr * 100).toFixed(2)}%) is below benchmark (${(benchmarks.ctr * 100).toFixed(2)}%)`,
      suggestedAction: 'Test new headlines, refresh images, or adjust targeting',
    });
  }

  // High CPC
  if (metrics.cpc > benchmarks.cpc * 1.3) {
    issues.push({
      type: 'high_cpc',
      severity: metrics.cpc > benchmarks.cpc * 1.5 ? 'critical' : 'warning',
      message: `CPC (₹${metrics.cpc.toFixed(2)}) exceeds benchmark (₹${benchmarks.cpc.toFixed(2)})`,
      suggestedAction: 'Improve Quality Score, adjust bids, or refine targeting',
    });
  }

  // Low Conversion
  if (metrics.cvr < benchmarks.cvr * 0.7) {
    issues.push({
      type: 'low_conversion',
      severity: metrics.cvr < benchmarks.cvr * 0.5 ? 'critical' : 'warning',
      message: `Conversion rate (${(metrics.cvr * 100).toFixed(2)}%) below benchmark`,
      suggestedAction: 'Optimize landing page, test different offers, or adjust audience',
    });
  }

  // Low ROAS
  if (metrics.roas !== undefined && metrics.roas < benchmarks.roas * 0.8) {
    issues.push({
      type: 'low_roas',
      severity: metrics.roas < benchmarks.roas * 0.5 ? 'critical' : 'warning',
      message: `ROAS (${metrics.roas.toFixed(2)}x) below target benchmark`,
      suggestedAction: 'Review campaign strategy, optimize for conversions, or adjust budget allocation',
    });
  }

  // Ad Fatigue
  if (historical.length >= 3) {
    const recent = historical.slice(-3);
    const ctrTrend = recent.map(p => p.ctr);
    const firstCTR = ctrTrend[0];
    const latestCTR = ctrTrend[ctrTrend.length - 1];

    if (metrics.impressions > FATIGUE_THRESHOLD.impressions && firstCTR > 0) {
      const decline = (firstCTR - latestCTR) / firstCTR;
      if (decline > FATIGUE_THRESHOLD.ctrDecline) {
        issues.push({
          type: 'fatigue',
          severity: decline > 0.3 ? 'critical' : 'warning',
          message: `Ad fatigue detected: CTR declined ${(decline * 100).toFixed(1)}% from ${(firstCTR * 100).toFixed(2)}% to ${(latestCTR * 100).toFixed(2)}%`,
          suggestedAction: 'Rotate fresh creative variants or pause underperforming ads',
        });
      }
    }
  }

  // Budget Exhaustion Warning
  if (metrics.spend > 0 && metrics.impressions < 1000) {
    issues.push({
      type: 'budget_exhaustion',
      severity: 'info',
      message: 'Low impression volume - budget may not be delivering efficiently',
      suggestedAction: 'Check bid competitiveness and targeting reach',
    });
  }

  return issues;
}

function identifyStrengths(metrics: PerformanceSnapshot, benchmarks: BenchmarkData): string[] {
  const strengths: string[] = [];

  if (metrics.ctr > benchmarks.ctr * 1.2) {
    strengths.push(`Strong CTR at ${(metrics.ctr * 100).toFixed(2)}%, exceeding benchmark by ${(((metrics.ctr - benchmarks.ctr) / benchmarks.ctr) * 100).toFixed(0)}%`);
  }

  if (metrics.cpc < benchmarks.cpc * 0.8) {
    strengths.push(`Efficient CPC of ₹${metrics.cpc.toFixed(2)}, ${(((benchmarks.cpc - metrics.cpc) / benchmarks.cpc) * 100).toFixed(0)}% below benchmark`);
  }

  if (metrics.cvr > benchmarks.cvr * 1.2) {
    strengths.push(`Excellent conversion rate at ${(metrics.cvr * 100).toFixed(2)}%, well above benchmark`);
  }

  if (metrics.roas !== undefined && metrics.roas > benchmarks.roas * 1.3) {
    strengths.push(`Outstanding ROAS of ${metrics.roas.toFixed(2)}x, significantly exceeding benchmark`);
  }

  if (metrics.impressions > 100000 && metrics.ctr > benchmarks.ctr) {
    strengths.push('High volume combined with above-average engagement');
  }

  return strengths;
}

// ============================================================================
// Performance Analysis
// ============================================================================

/**
 * Analyzes creative performance with trend analysis and benchmarking
 */
export async function analyzePerformance(options: CreativeAnalysisOptions): Promise<AnalyzePerformanceResponse> {
  try {
    const { adId, campaignId, dateRange, includeBenchmarks = true } = options;

    // In production, this would fetch from database
    // For now, generate sample data structure
    const snapshots: PerformanceSnapshot[] = [];

    // Generate sample historical data
    const daysBack = dateRange
      ? Math.ceil((dateRange.end.getTime() - dateRange.start.getTime()) / (1000 * 60 * 60 * 24))
      : 14;

    let baseImpressions = 10000;
    let baseCTR = 0.015;
    let baseCVR = 0.025;
    let baseCPC = 1.5;

    for (let i = 0; i < daysBack; i++) {
      const date = new Date();
      date.setDate(date.getDate() - (daysBack - i));

      // Add some variance
      const variance = () => 0.9 + Math.random() * 0.2;

      const impressions = Math.round(baseImpressions * variance());
      const clicks = Math.round(impressions * baseCTR * variance());
      const conversions = Math.round(clicks * baseCVR * variance());
      const spend = clicks * baseCPC * variance();
      const revenue = conversions * 50 * variance(); // Assume ₹50 avg order value
      const ctr = clicks / impressions;
      const cvr = conversions / clicks;
      const cpc = spend / clicks;
      const cpm = (spend / impressions) * 1000;
      const roas = spend > 0 ? revenue / spend : 0;

      snapshots.push({
        adId: adId || 'sample_ad',
        campaignId: campaignId || 'sample_campaign',
        date,
        impressions,
        clicks,
        conversions,
        spend,
        revenue,
        ctr,
        cvr,
        cpc,
        cpm,
        roas,
      });
    }

    // Calculate overall metrics
    const totalImpressions = snapshots.reduce((sum, p) => sum + p.impressions, 0);
    const totalClicks = snapshots.reduce((sum, p) => sum + p.clicks, 0);
    const totalConversions = snapshots.reduce((sum, p) => sum + p.conversions, 0);
    const totalSpend = snapshots.reduce((sum, p) => sum + p.spend, 0);
    const totalRevenue = snapshots.reduce((sum, p) => sum + (p.revenue || 0), 0);

    const overall: PerformanceSnapshot = {
      adId: adId || 'all',
      campaignId: campaignId || 'all',
      date: new Date(),
      impressions: totalImpressions,
      clicks: totalClicks,
      conversions: totalConversions,
      spend: totalSpend,
      revenue: totalRevenue,
      ctr: totalImpressions > 0 ? totalClicks / totalImpressions : 0,
      cvr: totalClicks > 0 ? totalConversions / totalClicks : 0,
      cpc: totalClicks > 0 ? totalSpend / totalClicks : 0,
      cpm: totalImpressions > 0 ? (totalSpend / totalImpressions) * 1000 : 0,
      roas: totalSpend > 0 ? totalRevenue / totalSpend : 0,
    };

    // Calculate trends
    const dates = snapshots.map(p => p.date);
    const trends = {
      impressions: calculateTrend(snapshots.map(p => p.impressions), dates),
      clicks: calculateTrend(snapshots.map(p => p.clicks), dates),
      conversions: calculateTrend(snapshots.map(p => p.conversions), dates),
      ctr: calculateTrend(snapshots.map(p => p.ctr), dates),
      roas: calculateTrend(snapshots.map(p => p.roas || 0), dates),
    };

    // Get benchmarks
    const benchmarks = includeBenchmarks
      ? {
          industry: getIndustryBenchmark(campaignId || undefined),
          topPerformers: {
            ctr: percentile(snapshots.map(p => p.ctr), TOP_PERFORMER_THRESHOLD * 100),
            cvr: percentile(snapshots.map(p => p.cvr), TOP_PERFORMER_THRESHOLD * 100),
            cpc: percentile(snapshots.map(p => p.cpc), (1 - TOP_PERFORMER_THRESHOLD) * 100),
            cpm: percentile(snapshots.map(p => p.cpm), (1 - TOP_PERFORMER_THRESHOLD) * 100),
            roas: percentile(snapshots.map(p => p.roas || 0), TOP_PERFORMER_THRESHOLD * 100),
          },
        }
      : undefined;

    // Identify issues and strengths
    const issues = identifyIssues(overall, benchmarks?.industry || INDUSTRY_BENCHMARKS.default, snapshots);
    const strengths = identifyStrengths(overall, benchmarks?.industry || INDUSTRY_BENCHMARKS.default);

    // Generate insights
    const insights: string[] = [];

    if (trends.ctr.direction === 'down') {
      insights.push('CTR is declining over time - consider refreshing creative elements');
    } else if (trends.ctr.direction === 'up') {
      insights.push('Positive CTR momentum - current creative strategy is working');
    }

    if (trends.conversions.direction === 'up' && trends.roas.direction === 'up') {
      insights.push('Strong performance trajectory with improving conversions and ROAS');
    }

    if (issues.some(i => i.type === 'fatigue')) {
      insights.push('Ad fatigue detected - schedule creative rotation');
    }

    if (overall.cpc > benchmarks?.industry.cpc) {
      insights.push(`CPC above industry average - review bid strategy or ad quality`);
    }

    // Generate recommendations
    const recommendations: string[] = [];

    for (const issue of issues) {
      if (issue.suggestedAction) {
        recommendations.push(issue.suggestedAction);
      }
    }

    if (recommendations.length === 0) {
      recommendations.push('Performance is within normal parameters - continue monitoring');
      recommendations.push('Consider testing new creative variants to identify improvement opportunities');
    }

    console.log(`[CreativeAnalysis] Analyzed ${snapshots.length} data points for ${campaignId || 'campaign'}`);

    return {
      success: true,
      analysis: {
        overall,
        trends,
        benchmarks,
        issues,
        strengths,
      },
      insights,
      recommendations,
    };
  } catch (error) {
    console.error('analyzePerformance error:', error);
    return {
      success: false,
    };
  }
}

// ============================================================================
// Creative Suggestions
// ============================================================================

/**
 * Generates creative improvement suggestions based on performance and objectives
 */
export async function suggestCreative(options: SuggestCreativeOptions): Promise<SuggestCreativeResponse> {
  try {
    const { campaignId, objective, targetAudience, competitorAds = [], topPerformingElements = [] } = options;

    const suggestions: CreativeSuggestion[] = [];
    const colorPalette: string[] = [];
    const messagingThemes: string[] = [];
    const visualStyles: string[] = [];

    // Objective-based recommendations
    switch (objective) {
      case 'awareness':
        suggestions.push({
          type: 'headline',
          suggestion: 'Use benefit-driven headlines focusing on transformation or emotion',
          rationale: 'Awareness campaigns need to capture attention and create interest quickly',
          examples: [
            'Transform Your [Pain Point] Today',
            'The Secret to [Desired Outcome]',
            'Why Successful People Choose [Brand]',
          ],
        });
        suggestions.push({
          type: 'image',
          suggestion: 'Use aspirational imagery that evokes emotion',
          rationale: 'Emotional connection drives brand recall for awareness',
          examples: ['Lifestyle shots', 'Before/after visuals', 'Celebration moments'],
        });
        visualStyles.push('lifestyle', 'aspirational', 'emotional');
        messagingThemes.push('innovation', 'transformation', 'status');
        colorPalette.push('#4F46E5', '#EC4899', '#10B981'); // Modern, vibrant
        break;

      case 'consideration':
        suggestions.push({
          type: 'headline',
          suggestion: 'Highlight unique value propositions and social proof',
          rationale: 'Consideration-stage users need more information to decide',
          examples: [
            '[Number]+ Happy Customers Can\'t Be Wrong',
            'Why [Brand] Outperforms [Competitor]',
            'See Why Experts Choose [Brand]',
          ],
        });
        suggestions.push({
          type: 'copy',
          suggestion: 'Include specific benefits, features, and credibility markers',
          rationale: 'Detailed information helps evaluation at consideration stage',
          examples: ['Feature callouts', 'Testimonial snippets', 'Guarantee statements'],
        });
        visualStyles.push('product-focused', 'comparison', 'social-proof');
        messagingThemes.push('quality', 'trust', 'value');
        colorPalette.push('#3B82F6', '#6366F1', '#8B5CF6'); // Trust, reliability
        break;

      case 'conversion':
        suggestions.push({
          type: 'cta',
          suggestion: 'Use clear, action-oriented CTAs with urgency elements',
          rationale: 'Conversion campaigns need immediate action triggers',
          examples: [
            'Shop Now - Limited Stock',
            'Get Your Free Trial',
            'Claim Your Discount Today',
          ],
        });
        suggestions.push({
          type: 'copy',
          suggestion: 'Focus on offer specifics, scarcity, and risk reversal',
          rationale: 'Reduce friction and overcome objections at conversion stage',
          examples: [
            '[X]% Off Ends [Date]',
            '30-Day Money-Back Guarantee',
            'Free Shipping on Orders Over ₹[Amount]',
          ],
        });
        visualStyles.push('offer-focused', 'urgency', 'clear-cta');
        messagingThemes.push('urgency', 'value', 'security');
        colorPalette.push('#EF4444', '#F59E0B', '#10B981'); // Action, urgency
        break;
    }

    // Audience-based recommendations
    if (targetAudience) {
      if (targetAudience.ageRange) {
        const [minAge, maxAge] = targetAudience.ageRange;
        if (maxAge - minAge <= 15) {
          suggestions.push({
            type: 'image',
            suggestion: `Target audience is ${minAge}-${maxAge} - use relatable visuals and language`,
            rationale: 'Specific age targeting requires matching cultural references',
          });
        }
      }

      if (targetAudience.interests && targetAudience.interests.length > 0) {
        suggestions.push({
          type: 'copy',
          suggestion: `Incorporate interests: ${targetAudience.interests.slice(0, 3).join(', ')}`,
          rationale: 'Interest-aligned messaging increases relevance and engagement',
        });
        messagingThemes.push(...targetAudience.interests.slice(0, 3));
      }
    }

    // Top performing elements integration
    if (topPerformingElements.length > 0) {
      suggestions.push({
        type: 'copy',
        suggestion: `Build on top elements: ${topPerformingElements.join(', ')}`,
        rationale: 'Leverage proven high-performing creative elements',
      });
    }

    // Competitor analysis
    if (competitorAds.length > 0) {
      suggestions.push({
        type: 'headline',
        suggestion: 'Differentiate from competitors with unique positioning',
        rationale: 'Standing out in competitive landscape requires clear differentiation',
      });
      messagingThemes.push('differentiation', 'unique-selling-point');
    }

    // Always include these foundational suggestions
    suggestions.push({
      type: 'image',
      suggestion: 'Ensure brand consistency while testing freshness',
      rationale: 'Brand recognition supports all campaign objectives',
    });

    suggestions.push({
      type: 'video',
      suggestion: 'Consider short-form video (6-15 seconds) for mobile-first audiences',
      rationale: 'Video consistently outperforms static across platforms',
    });

    console.log(`[CreativeSuggestions] Generated ${suggestions.length} suggestions for ${campaignId}`);

    return {
      success: true,
      suggestions,
      colorPalette: [...new Set(colorPalette)],
      messagingThemes: [...new Set(messagingThemes)],
      visualStyles: [...new Set(visualStyles)],
    };
  } catch (error) {
    console.error('suggestCreative error:', error);
    return {
      success: false,
    };
  }
}

// ============================================================================
// Export all functions
// ============================================================================

export const creativeAnalyzer = {
  analyzePerformance,
  suggestCreative,
};

export default creativeAnalyzer;
