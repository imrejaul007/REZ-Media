/**
 * REZ Ad AI - Ad Optimization Service
 *
 * Optimizes bid strategies, targeting parameters, and suggests
 * improvements based on performance data and AI analysis.
 */

import {
  OptimizeBidOptions,
  OptimizeBidResponse,
  BidStrategy,
  OptimizeTargetingOptions,
  OptimizeTargetingResponse,
  TargetingAdjustment,
  SuggestImprovementsOptions,
  SuggestImprovementsResponse,
  Improvement,
  PerformanceSnapshot,
  TargetingParams,
  CampaignMetrics,
} from '../types/ad';

// ============================================================================
// Configuration & Thresholds
// ============================================================================

const BID_OPTIMIZATION = {
  MIN_BID_INCREASE: 0.1,
  MAX_BID_INCREASE: 0.5,
  MIN_BID_DECREASE: 0.05,
  MAX_BID_DECREASE: 0.25,
  CTR_IMPROVEMENT_THRESHOLD: 0.1,
  CPC_REDUCTION_THRESHOLD: 0.15,
  CONVERSION_BOOST_THRESHOLD: 0.2,
};

const PERFORMANCE_THRESHOLDS = {
  CTR: { poor: 0.005, average: 0.01, good: 0.02, excellent: 0.03 },
  CVR: { poor: 0.01, average: 0.02, good: 0.04, excellent: 0.06 },
  CPC: { poor: 3.0, average: 2.0, good: 1.0, excellent: 0.5 },
  ROAS: { poor: 1.0, average: 2.0, good: 4.0, excellent: 6.0 },
};

// ============================================================================
// Utility Functions
// ============================================================================

function calculateTrend(values: number[]): 'up' | 'down' | 'stable' {
  if (values.length < 2) return 'stable';

  const recent = values.slice(-Math.ceil(values.length / 2));
  const older = values.slice(0, Math.floor(values.length / 2));

  const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
  const olderAvg = older.reduce((a, b) => a + b, 0) / older.length;

  if (olderAvg === 0) return 'stable';

  const changePercent = (recentAvg - olderAvg) / olderAvg;

  if (changePercent > 0.05) return 'up';
  if (changePercent < -0.05) return 'down';
  return 'stable';
}

function calculateAverage(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function percentile(values: number[], p: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, index)];
}

function getPerformanceRating(value: number, type: 'ctr' | 'cvr' | 'cpc' | 'roas'): 'poor' | 'average' | 'good' | 'excellent' {
  const thresholds = PERFORMANCE_THRESHOLDS[type];

  if (type === 'cpc') {
    // Lower is better for CPC
    if (value <= thresholds.excellent) return 'excellent';
    if (value <= thresholds.good) return 'good';
    if (value <= thresholds.average) return 'average';
    return 'poor';
  }

  // Higher is better for CTR, CVR, ROAS
  if (value >= thresholds.excellent) return 'excellent';
  if (value >= thresholds.good) return 'good';
  if (value >= thresholds.average) return 'average';
  return 'poor';
}

// ============================================================================
// Bid Optimization
// ============================================================================

/**
 * Analyzes campaign performance and suggests optimal bid adjustments
 */
export async function optimizeBid(options: OptimizeBidOptions): Promise<OptimizeBidResponse> {
  try {
    const {
      campaignId,
      currentBid,
      targetCpc,
      targetCpa,
      targetRoas,
      currentMetrics,
    } = options;

    const { impressions, clicks, conversions, spend, revenue, ctr, cvr, cpc, roas } = currentMetrics;

    const factors: string[] = [];
    let recommendedBid = currentBid;
    let confidence = 0.7;

    // Calculate total conversions value if not available
    const totalConversionValue = revenue || (conversions * (spend / Math.max(conversions, 1)));
    const avgOrderValue = conversions > 0 ? totalConversionValue / conversions : 0;

    // Factor 1: CTR Performance
    const ctrTrend = ctr > PERFORMANCE_THRESHOLDS.CTR.good ? 'high' : ctr > PERFORMANCE_THRESHOLDS.CTR.average ? 'medium' : 'low';
    if (ctrTrend === 'high') {
      factors.push('High CTR indicates ad relevance - can support higher bids');
    } else if (ctrTrend === 'low') {
      factors.push('Low CTR suggests ad refresh needed before bid increase');
    }

    // Factor 2: Conversion Rate
    const cvrTrend = cvr > PERFORMANCE_THRESHOLDS.CVR.good ? 'strong' : cvr > PERFORMANCE_THRESHOLDS.CVR.average ? 'moderate' : 'weak';
    if (cvrTrend === 'strong') {
      factors.push('Strong conversion rate supports aggressive bidding');
    }

    // Factor 3: ROAS Performance
    const roasRating = getPerformanceRating(roas || 0, 'roas');
    factors.push(`ROAS rating: ${roasRating}`);

    // Factor 4: Budget utilization
    const impressionsPerDollar = impressions / Math.max(spend, 1);
    if (impressionsPerDollar > 100) {
      factors.push('High impression volume - room for bid optimization');
    } else if (impressionsPerDollar < 10) {
      factors.push('Low impression volume - bid may be too low');
    }

    // Calculate recommended bid based on target goals
    if (targetRoas && avgOrderValue > 0) {
      // Target ROAS strategy
      const targetCpaForRoas = avgOrderValue / targetRoas;
      recommendedBid = Math.min(targetCpaForRoas * cvr, currentBid * 1.5);
      factors.push(`Target ROAS ${targetRoas}x requires CPA of ₹${targetCpaForRoas.toFixed(2)}`);

      // Adjust for current performance
      const currentRoas = roas || 0;
      if (currentRoas > 0) {
        const roasRatio = targetRoas / currentRoas;
        if (roasRatio < 1) {
          // Need to improve ROAS - reduce bid
          recommendedBid *= Math.max(0.6, roasRatio);
          factors.push(`Reducing bid to improve ROAS from ${currentRoas.toFixed(2)}x to ${targetRoas}x`);
        } else {
          // Can increase spend
          recommendedBid *= Math.min(1.3, roasRatio * 0.9);
          factors.push(`Increasing bid - current ROAS ${currentRoas.toFixed(2)}x exceeds target`);
        }
      }
      confidence = 0.75;
    } else if (targetCpa && conversions > 0) {
      // Target CPA strategy
      const currentCpa = spend / conversions;
      const cpaRatio = targetCpa / currentCpa;

      if (cpaRatio < 1) {
        // Need to reduce CPA - lower bid
        recommendedBid *= Math.max(0.5, cpaRatio * 1.1);
        factors.push(`Reducing bid to achieve target CPA of ₹${targetCpa}`);
      } else {
        // Can increase spend
        recommendedBid *= Math.min(1.4, cpaRatio);
        factors.push(`Increasing bid - current CPA below target`);
      }
      confidence = 0.8;
    } else if (targetCpc) {
      // Target CPC strategy
      const cpcRatio = targetCpc / cpc;
      recommendedBid = targetCpc;
      factors.push(`Target CPC: ₹${targetCpc}`);
      confidence = 0.85;
    } else {
      // Auto-optimization based on performance
      let bidMultiplier = 1.0;

      // Adjust based on CTR
      if (ctr > PERFORMANCE_THRESHOLDS.CTR.good) {
        bidMultiplier *= 1 + Math.min(BID_OPTIMIZATION.MAX_BID_INCREASE, (ctr - PERFORMANCE_THRESHOLDS.CTR.good) * 5);
        factors.push(`Increasing bid based on high CTR (${(ctr * 100).toFixed(2)}%)`);
      } else if (ctr < PERFORMANCE_THRESHOLDS.CTR.average) {
        bidMultiplier *= 1 - Math.min(BID_OPTIMIZATION.MAX_BID_DECREASE, (PERFORMANCE_THRESHOLDS.CTR.average - ctr) * 5);
        factors.push(`Decreasing bid based on low CTR (${(ctr * 100).toFixed(2)}%)`);
      }

      // Adjust based on CVR
      if (cvr > PERFORMANCE_THRESHOLDS.CVR.good) {
        bidMultiplier *= 1.15;
        factors.push('High conversion rate supports higher bids');
      } else if (cvr < PERFORMANCE_THRESHOLDS.CVR.average) {
        bidMultiplier *= 0.9;
        factors.push('Low conversion rate - conservative bidding');
      }

      recommendedBid = currentBid * bidMultiplier;
      confidence = 0.65;
    }

    // Apply bid floor and ceiling
    const minBid = currentBid * (1 - BID_OPTIMIZATION.MAX_BID_DECREASE);
    const maxBid = currentBid * (1 + BID_OPTIMIZATION.MAX_BID_INCREASE);
    recommendedBid = Math.max(minBid, Math.min(maxBid, recommendedBid));

    // Round to 2 decimal places
    recommendedBid = Math.round(recommendedBid * 100) / 100;

    // Determine strategy
    const strategy: BidStrategy = {
      type: targetRoas ? 'target_roas' : targetCpa ? 'target_cpa' : targetCpc ? 'manual' : 'auto',
      value: recommendedBid,
      floor: minBid,
      ceiling: maxBid,
    };

    // Estimate impact
    const estimatedImpact = {
      impressions: Math.round(impressions * (recommendedBid / currentBid)),
      clicks: Math.round(clicks * (recommendedBid / currentBid) * Math.max(0.8, ctr * 50)),
      cost: Math.round(spend * (recommendedBid / currentBid) * 100) / 100,
    };

    console.log(`[BidOptimization] Campaign ${campaignId}: Current ₹${currentBid} → Recommended ₹${recommendedBid}`);

    return {
      success: true,
      recommendedBid,
      strategy,
      confidence,
      factors,
      estimatedImpact,
    };
  } catch (error) {
    console.error('optimizeBid error:', error);
    return {
      success: false,
    };
  }
}

// ============================================================================
// Targeting Optimization
// ============================================================================

/**
 * Analyzes targeting performance and suggests optimizations
 */
export async function optimizeTargeting(options: OptimizeTargetingOptions): Promise<OptimizeTargetingResponse> {
  try {
    const { campaignId, currentTargeting, performanceData } = options;

    const adjustments: TargetingAdjustment[] = [];
    const segments: OptimizeTargetingResponse['segments'] = [];

    // Aggregate performance by segment
    const segmentPerformance = new Map<string, { roas: number; conversions: number; spend: number }>();

    for (const snapshot of performanceData) {
      const adId = snapshot.adId;
      const existing = segmentPerformance.get(adId) || { roas: 0, conversions: 0, spend: 0 };
      existing.roas += snapshot.roas || 0;
      existing.conversions += snapshot.conversions;
      existing.spend += snapshot.spend;
      segmentPerformance.set(adId, existing);
    }

    // Analyze each segment
    for (const [segment, perf] of segmentPerformance) {
      const avgRoas = perf.spend > 0 ? perf.roas / performanceData.filter(s => s.adId === segment).length : 0;

      let recommendation: 'expand' | 'narrow' | 'maintain' = 'maintain';

      if (avgRoas > PERFORMANCE_THRESHOLDS.ROAS.good) {
        recommendation = 'expand';
        adjustments.push({
          type: 'expand',
          dimension: 'interests',
          value: [segment],
          reason: `High ROAS (${avgRoas.toFixed(2)}x) indicates strong segment fit`,
          expectedImpact: 0.15,
        });
      } else if (avgRoas < PERFORMANCE_THRESHOLDS.ROAS.average) {
        recommendation = 'narrow';
        adjustments.push({
          type: 'narrow',
          dimension: 'interests',
          value: [segment],
          reason: `Below average ROAS - consider removing or reducing spend`,
          expectedImpact: -0.1,
        });
      }

      segments.push({
        segment,
        performance: avgRoas,
        recommendation,
      });
    }

    // Analyze demographics
    if (currentTargeting.demographics) {
      const demo = currentTargeting.demographics;

      if (demo.ageRange && demo.ageRange[1] - demo.ageRange[0] > 30) {
        adjustments.push({
          type: 'narrow',
          dimension: 'demographics',
          value: ['age_range'],
          reason: 'Broad age targeting may reduce efficiency',
          expectedImpact: 0.08,
        });
      }

      if (!demo.gender || demo.gender.length > 2) {
        adjustments.push({
          type: 'modify',
          dimension: 'demographics',
          value: ['test_gender_split'],
          reason: 'Consider A/B testing gender targeting',
          expectedImpact: 0.05,
        });
      }
    }

    // Analyze geo targeting
    if (currentTargeting.geoTargeting) {
      const geo = currentTargeting.geoTargeting;

      if (!geo.countries || geo.countries.length > 10) {
        adjustments.push({
          type: 'narrow',
          dimension: 'geoTargeting',
          value: geo.countries || ['all'],
          reason: 'Too many geographic targets may reduce efficiency',
          expectedImpact: 0.1,
        });
      }
    }

    // Analyze devices
    if (currentTargeting.devices && currentTargeting.devices.length === 3) {
      adjustments.push({
        type: 'modify',
        dimension: 'devices',
        value: ['mobile', 'desktop'],
        reason: 'Tablets often have lower conversion rates - consider testing exclusion',
        expectedImpact: 0.03,
      });
    }

    // Estimate reach and CPM impact
    const estimatedReach = adjustments.length > 0 ? 0.9 : 1.0;
    const estimatedCpm = adjustments.length > 0 ? 1.05 : 1.0;

    console.log(`[TargetingOptimization] Campaign ${campaignId}: ${adjustments.length} recommendations`);

    return {
      success: true,
      recommendations: adjustments.length > 0 ? adjustments : undefined,
      segments,
      estimatedReach,
      estimatedCpm,
    };
  } catch (error) {
    console.error('optimizeTargeting error:', error);
    return {
      success: false,
    };
  }
}

// ============================================================================
// Improvement Suggestions
// ============================================================================

/**
 * Generates actionable improvement suggestions based on performance analysis
 */
export async function suggestImprovements(options: SuggestImprovementsOptions): Promise<SuggestImprovementsResponse> {
  try {
    const { campaignId, performanceData, budget } = options;

    const improvements: Improvement[] = [];
    const priorityOrder: string[] = [];

    if (performanceData.length === 0) {
      return {
        success: true,
        improvements: [{
          id: 'insufficient_data',
          category: 'creative',
          title: 'Insufficient Performance Data',
          description: 'Need more data to generate specific recommendations',
          expectedImpact: 'low',
          effort: 'low',
        }],
        priorityOrder: ['insufficient_data'],
      };
    }

    // Calculate aggregated metrics
    const totalSpend = performanceData.reduce((sum, p) => sum + p.spend, 0);
    const totalConversions = performanceData.reduce((sum, p) => sum + p.conversions, 0);
    const totalClicks = performanceData.reduce((sum, p) => sum + p.clicks, 0);
    const avgCTR = totalSpend > 0 ? totalClicks / (totalClicks * 10) : 0;
    const avgCVR = totalClicks > 0 ? totalConversions / totalClicks : 0;
    const avgRoas = totalSpend > 0 ? (performanceData.reduce((sum, p) => sum + (p.revenue || 0), 0) / totalSpend) : 0;

    // Analyze CTR issues
    const ctrTrend = calculateTrend(performanceData.map(p => p.ctr));
    if (avgCTR < PERFORMANCE_THRESHOLDS.CTR.average || ctrTrend === 'down') {
      improvements.push({
        id: 'improve_ctr',
        category: 'creative',
        title: 'Improve Click-Through Rate',
        description: 'Current CTR is below target. Consider refreshing ad creative with stronger headlines and visuals.',
        expectedImpact: 'high',
        effort: 'medium',
        implementation: 'Use AI-generated headlines with power words and emotional triggers. Test multiple image variants.',
      });
      priorityOrder.push('improve_ctr');
    }

    // Analyze conversion rate
    if (avgCVR < PERFORMANCE_THRESHOLDS.CVR.average) {
      improvements.push({
        id: 'improve_cvr',
        category: 'creative',
        title: 'Optimize Landing Page',
        description: 'Low conversion rate suggests landing page or offer optimization opportunities.',
        expectedImpact: 'high',
        effort: 'high',
        implementation: 'A/B test landing page variants, simplify conversion form, add social proof elements.',
      });
      priorityOrder.push('improve_cvr');
    }

    // Analyze ROAS
    const roasTrend = calculateTrend(performanceData.map(p => p.roas || 0));
    if (avgRoas < PERFORMANCE_THRESHOLDS.ROAS.average || roasTrend === 'down') {
      improvements.push({
        id: 'improve_roas',
        category: 'bidding',
        title: 'Optimize for Better ROAS',
        description: 'Return on ad spend below target. Review targeting and bidding strategy.',
        expectedImpact: 'high',
        effort: 'medium',
        implementation: 'Switch to target ROAS bidding, refine audience targeting, improve offer value.',
      });
      priorityOrder.push('improve_roas');
    }

    // Budget recommendations
    if (budget && totalSpend > 0) {
      const budgetUtilization = totalSpend / budget;
      if (budgetUtilization > 0.9) {
        improvements.push({
          id: 'increase_budget',
          category: 'budget',
          title: 'Consider Budget Increase',
          description: 'Budget nearly exhausted with positive metrics - scaling could accelerate growth.',
          expectedImpact: 'medium',
          effort: 'low',
          implementation: 'Increase daily budget by 20-30% and monitor performance for 3-5 days.',
        });
        priorityOrder.push('increase_budget');
      } else if (budgetUtilization < 0.5) {
        improvements.push({
          id: 'optimize_delivery',
          category: 'budget',
          title: 'Improve Budget Utilization',
          description: 'Low budget utilization may indicate delivery issues or targeting too narrow.',
          expectedImpact: 'medium',
          effort: 'medium',
          implementation: 'Review audience size, check bid competitiveness, expand targeting incrementally.',
        });
        priorityOrder.push('optimize_delivery');
      }
    }

    // Ad fatigue detection
    const impressionCounts = new Map<string, number>();
    for (const snapshot of performanceData) {
      impressionCounts.set(snapshot.adId, (impressionCounts.get(snapshot.adId) || 0) + snapshot.impressions);
    }

    for (const [adId, impressions] of impressionCounts) {
      if (impressions > 50000 && ctrTrend === 'down') {
        improvements.push({
          id: `fatigue_${adId}`,
          category: 'creative',
          title: 'Ad Fatigue Detected',
          description: `Ad ${adId} showing fatigue symptoms with declining CTR. Consider refreshing creative.`,
          expectedImpact: 'medium',
          effort: 'medium',
          implementation: 'Pause and replace with fresh creative variants. Test new images and copy.',
        });
        priorityOrder.push(`fatigue_${adId}`);
        break; // Only report one fatigue issue
      }
    }

    // Bidding optimization
    const cpcValues = performanceData.map(p => p.cpc).filter(c => c > 0);
    const avgCPC = calculateAverage(cpcValues);
    if (avgCPC > PERFORMANCE_THRESHOLDS.CPC.poor) {
      improvements.push({
        id: 'reduce_cpc',
        category: 'bidding',
        title: 'Reduce Cost Per Click',
        description: 'CPC higher than industry average. Consider improving Quality Score or adjusting bids.',
        expectedImpact: 'medium',
        effort: 'medium',
        implementation: 'Improve ad relevance and landing page experience. Test match type variations.',
      });
      priorityOrder.push('reduce_cpc');
    }

    // Targeting refinements
    improvements.push({
      id: 'refine_audience',
      category: 'targeting',
      title: 'Refine Audience Targeting',
      description: 'Use intent data to create lookalike audiences and exclude underperforming segments.',
      expectedImpact: 'medium',
      effort: 'low',
      implementation: 'Create lookalike audiences from top 10% converters. Add negative keywords.',
    });
    priorityOrder.push('refine_audience');

    // Placement optimization
    improvements.push({
      id: 'optimize_placements',
      category: 'placement',
      title: 'Review Ad Placements',
      description: 'Not all placements perform equally. Exclude low-performing placements.',
      expectedImpact: 'medium',
      effort: 'low',
      implementation: 'Review placement report and exclude bottom 20% performing placements.',
    });
    priorityOrder.push('optimize_placements');

    // Calculate estimated uplift
    let estimatedUplift = 0;
    for (const imp of improvements) {
      if (imp.expectedImpact === 'high') estimatedUplift += 0.2;
      else if (imp.expectedImpact === 'medium') estimatedUplift += 0.1;
    }

    console.log(`[Improvements] Campaign ${campaignId}: ${improvements.length} suggestions, ~${(estimatedUplift * 100).toFixed(0)}% potential uplift`);

    return {
      success: true,
      improvements,
      priorityOrder,
      estimatedUplift: Math.round(estimatedUplift * 100) / 100,
    };
  } catch (error) {
    console.error('suggestImprovements error:', error);
    return {
      success: false,
    };
  }
}

// ============================================================================
// Export all functions
// ============================================================================

export const optimization = {
  optimizeBid,
  optimizeTargeting,
  suggestImprovements,
};

export default optimization;
