/**
 * REZ Ad AI - Optimization Routes
 *
 * API routes for ad optimization including bidding, targeting, and improvements.
 */

import { Router, Request, Response, NextFunction } from 'express';
import { optimization } from '../services/optimization';
import { PerformanceSnapshot, CampaignMetrics, TargetingParams } from '../types/ad';

const router = Router();

// ============================================================================
// Validation Helpers
// ============================================================================

interface ValidationError {
  field: string;
  message: string;
}

function validateCampaignMetrics(metrics: any): ValidationError[] {
  const errors: ValidationError[] = [];

  if (typeof metrics.impressions !== 'number' || metrics.impressions < 0) {
    errors.push({ field: 'metrics.impressions', message: 'Must be a non-negative number' });
  }
  if (typeof metrics.clicks !== 'number' || metrics.clicks < 0) {
    errors.push({ field: 'metrics.clicks', message: 'Must be a non-negative number' });
  }
  if (typeof metrics.conversions !== 'number' || metrics.conversions < 0) {
    errors.push({ field: 'metrics.conversions', message: 'Must be a non-negative number' });
  }
  if (typeof metrics.spend !== 'number' || metrics.spend < 0) {
    errors.push({ field: 'metrics.spend', message: 'Must be a non-negative number' });
  }
  if (typeof metrics.revenue !== 'number' || metrics.revenue < 0) {
    errors.push({ field: 'metrics.revenue', message: 'Must be a non-negative number' });
  }

  return errors;
}

function sendValidationError(res: Response, errors: ValidationError[]): void {
  res.status(400).json({
    success: false,
    error: {
      code: 'VALIDATION_ERROR',
      message: 'Invalid request parameters',
      details: errors,
    },
    timestamp: new Date(),
  });
}

// ============================================================================
// Bid Optimization Routes
// ============================================================================

/**
 * POST /api/optimize/bid
 * Optimize bid strategy for campaign
 */
router.post('/bid', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const {
      campaignId,
      adGroupId,
      currentBid,
      targetCpc,
      targetCpa,
      targetRoas,
      metrics,
    } = req.body;

    // Validate required fields
    const errors: ValidationError[] = [];

    if (!campaignId || typeof campaignId !== 'string') {
      errors.push({ field: 'campaignId', message: 'Required and must be a string' });
    }
    if (typeof currentBid !== 'number' || currentBid <= 0) {
      errors.push({ field: 'currentBid', message: 'Required and must be a positive number' });
    }
    if (!metrics || typeof metrics !== 'object') {
      errors.push({ field: 'metrics', message: 'Required and must be an object' });
    }

    if (errors.length > 0) {
      sendValidationError(res, errors);
      return;
    }

    // Validate metrics
    const metricErrors = validateCampaignMetrics(metrics);
    if (metricErrors.length > 0) {
      sendValidationError(res, metricErrors);
      return;
    }

    // Build metrics object
    const currentMetrics: CampaignMetrics = {
      impressions: metrics.impressions,
      clicks: metrics.clicks,
      conversions: metrics.conversions,
      spend: metrics.spend,
      revenue: metrics.revenue || 0,
      ctr: metrics.clicks / Math.max(metrics.impressions, 1),
      cvr: metrics.clicks > 0 ? metrics.conversions / metrics.clicks : 0,
      cpc: metrics.clicks > 0 ? metrics.spend / metrics.clicks : 0,
      cpm: (metrics.spend / Math.max(metrics.impressions, 1)) * 1000,
      roas: metrics.spend > 0 ? (metrics.revenue || 0) / metrics.spend : 0,
    };

    const response = await optimization.optimizeBid({
      campaignId,
      adGroupId,
      currentBid,
      targetCpc,
      targetCpa,
      targetRoas,
      currentMetrics,
    });

    if (!response.success) {
      res.status(500).json({
        success: false,
        error: { code: 'OPTIMIZATION_FAILED', message: 'Failed to optimize bid' },
        timestamp: new Date(),
      });
      return;
    }

    res.json({
      success: true,
      data: {
        recommendedBid: response.recommendedBid,
        strategy: response.strategy,
        confidence: response.confidence,
        factors: response.factors,
        estimatedImpact: response.estimatedImpact,
      },
      timestamp: new Date(),
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/optimize/bid/batch
 * Optimize bids for multiple campaigns
 */
router.post('/bid/batch', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { campaigns } = req.body;

    if (!Array.isArray(campaigns) || campaigns.length === 0) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'campaigns must be a non-empty array' },
        timestamp: new Date(),
      });
      return;
    }

    if (campaigns.length > 20) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Maximum 20 campaigns per request' },
        timestamp: new Date(),
      });
      return;
    }

    const results = await Promise.allSettled(
      campaigns.map(async (campaign: any) => {
        const metrics: CampaignMetrics = {
          impressions: campaign.metrics.impressions,
          clicks: campaign.metrics.clicks,
          conversions: campaign.metrics.conversions,
          spend: campaign.metrics.spend,
          revenue: campaign.metrics.revenue || 0,
          ctr: campaign.metrics.clicks / Math.max(campaign.metrics.impressions, 1),
          cvr: campaign.metrics.clicks > 0 ? campaign.metrics.conversions / campaign.metrics.clicks : 0,
          cpc: campaign.metrics.clicks > 0 ? campaign.metrics.spend / campaign.metrics.clicks : 0,
          cpm: (campaign.metrics.spend / Math.max(campaign.metrics.impressions, 1)) * 1000,
          roas: campaign.metrics.spend > 0 ? (campaign.metrics.revenue || 0) / campaign.metrics.spend : 0,
        };

        const result = await optimization.optimizeBid({
          campaignId: campaign.campaignId,
          currentBid: campaign.currentBid,
          targetCpc: campaign.targetCpc,
          targetCpa: campaign.targetCpa,
          targetRoas: campaign.targetRoas,
          currentMetrics: metrics,
        });

        return {
          campaignId: campaign.campaignId,
          ...result,
        };
      })
    );

    const successful = results
      .filter((r) => r.status === 'fulfilled')
      .map((r) => (r as PromiseFulfilledResult<any>).value);
    const failed = results
      .filter((r) => r.status === 'rejected')
      .map((r) => ({
        error: (r as PromiseRejectedResult).reason?.message || 'Unknown error',
      }));

    res.json({
      success: true,
      data: {
        results: successful,
        summary: {
          total: campaigns.length,
          successful: successful.length,
          failed: failed.length,
        },
      },
      timestamp: new Date(),
    });
  } catch (error) {
    next(error);
  }
});

// ============================================================================
// Targeting Optimization Routes
// ============================================================================

/**
 * POST /api/optimize/targeting
 * Optimize targeting parameters
 */
router.post('/targeting', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { campaignId, currentTargeting, performanceData } = req.body;

    // Validate required fields
    const errors: ValidationError[] = [];

    if (!campaignId || typeof campaignId !== 'string') {
      errors.push({ field: 'campaignId', message: 'Required and must be a string' });
    }
    if (!currentTargeting || typeof currentTargeting !== 'object') {
      errors.push({ field: 'currentTargeting', message: 'Required and must be an object' });
    }
    if (!Array.isArray(performanceData) || performanceData.length === 0) {
      errors.push({ field: 'performanceData', message: 'Required and must be a non-empty array' });
    }

    if (errors.length > 0) {
      sendValidationError(res, errors);
      return;
    }

    // Validate performance data
    const snapshots: PerformanceSnapshot[] = performanceData.map((p: any, index: number) => {
      const snapshotErrors: ValidationError[] = [];

      if (!p.adId) snapshotErrors.push({ field: `performanceData[${index}].adId`, message: 'Required' });
      if (typeof p.impressions !== 'number') snapshotErrors.push({ field: `performanceData[${index}].impressions`, message: 'Must be a number' });

      if (snapshotErrors.length > 0) {
        errors.push(...snapshotErrors);
      }

      return {
        adId: p.adId || 'unknown',
        campaignId: campaignId,
        date: p.date ? new Date(p.date) : new Date(),
        impressions: p.impressions || 0,
        clicks: p.clicks || 0,
        conversions: p.conversions || 0,
        spend: p.spend || 0,
        revenue: p.revenue || 0,
        ctr: p.ctr || 0,
        cvr: p.cvr || 0,
        cpc: p.cpc || 0,
        cpm: p.cpm || 0,
        roas: p.roas,
      };
    });

    if (errors.length > 0) {
      sendValidationError(res, errors);
      return;
    }

    const response = await optimization.optimizeTargeting({
      campaignId,
      currentTargeting: currentTargeting as TargetingParams,
      performanceData: snapshots,
    });

    if (!response.success) {
      res.status(500).json({
        success: false,
        error: { code: 'OPTIMIZATION_FAILED', message: 'Failed to optimize targeting' },
        timestamp: new Date(),
      });
      return;
    }

    res.json({
      success: true,
      data: {
        recommendations: response.recommendations,
        segments: response.segments,
        estimatedReach: response.estimatedReach,
        estimatedCpm: response.estimatedCpm,
      },
      timestamp: new Date(),
    });
  } catch (error) {
    next(error);
  }
});

// ============================================================================
// Improvement Suggestions Routes
// ============================================================================

/**
 * POST /api/optimize/improve
 * Get actionable improvement suggestions
 */
router.post('/improve', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { campaignId, performanceData, budget } = req.body;

    // Validate required fields
    const errors: ValidationError[] = [];

    if (!campaignId || typeof campaignId !== 'string') {
      errors.push({ field: 'campaignId', message: 'Required and must be a string' });
    }
    if (!Array.isArray(performanceData) || performanceData.length === 0) {
      errors.push({ field: 'performanceData', message: 'Required and must be a non-empty array' });
    }

    if (errors.length > 0) {
      sendValidationError(res, errors);
      return;
    }

    // Transform performance data
    const snapshots: PerformanceSnapshot[] = performanceData.map((p: any) => ({
      adId: p.adId || 'unknown',
      adSetId: p.adSetId,
      campaignId: p.campaignId || campaignId,
      date: p.date ? new Date(p.date) : new Date(),
      impressions: p.impressions || 0,
      clicks: p.clicks || 0,
      conversions: p.conversions || 0,
      spend: p.spend || 0,
      revenue: p.revenue || 0,
      ctr: p.ctr || (p.clicks / Math.max(p.impressions, 1)),
      cvr: p.cvr || (p.conversions / Math.max(p.clicks, 1)),
      cpc: p.cpc || (p.spend / Math.max(p.clicks, 1)),
      cpm: p.cpm || ((p.spend / Math.max(p.impressions, 1)) * 1000),
      roas: p.roas || (p.spend > 0 ? (p.revenue || 0) / p.spend : undefined),
    }));

    const response = await optimization.suggestImprovements({
      campaignId,
      performanceData: snapshots,
      budget,
    });

    if (!response.success) {
      res.status(500).json({
        success: false,
        error: { code: 'SUGGESTIONS_FAILED', message: 'Failed to generate suggestions' },
        timestamp: new Date(),
      });
      return;
    }

    res.json({
      success: true,
      data: {
        improvements: response.improvements,
        priorityOrder: response.priorityOrder,
        estimatedUplift: response.estimatedUplift,
      },
      timestamp: new Date(),
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/optimize/improve/:campaignId
 * Get cached improvement suggestions for a campaign
 */
router.get('/improve/:campaignId', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { campaignId } = req.params;

    // In production, this would fetch from cache/database
    // For now, return a placeholder response
    res.json({
      success: true,
      data: {
        campaignId,
        message: 'No cached suggestions. POST to /api/optimize/improve to generate.',
        improvements: [],
      },
      timestamp: new Date(),
    });
  } catch (error) {
    next(error);
  }
});

// ============================================================================
// Full Campaign Audit
// ============================================================================

/**
 * POST /api/optimize/audit
 * Complete campaign audit with all optimization recommendations
 */
router.post('/audit', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { campaignId, currentBid, currentTargeting, metrics, budget } = req.body;

    // Validate required fields
    const errors: ValidationError[] = [];

    if (!campaignId) {
      errors.push({ field: 'campaignId', message: 'Required' });
    }

    if (errors.length > 0) {
      sendValidationError(res, errors);
      return;
    }

    // Run all optimizations in parallel
    const [bidResult, targetingResult, improvementResult] = await Promise.allSettled([
      metrics && currentBid
        ? optimization.optimizeBid({
            campaignId,
            currentBid,
            currentMetrics: {
              impressions: metrics.impressions || 0,
              clicks: metrics.clicks || 0,
              conversions: metrics.conversions || 0,
              spend: metrics.spend || 0,
              revenue: metrics.revenue || 0,
              ctr: metrics.ctr || (metrics.clicks / Math.max(metrics.impressions, 1)),
              cvr: metrics.cvr || (metrics.conversions / Math.max(metrics.clicks, 1)),
              cpc: metrics.cpc || (metrics.spend / Math.max(metrics.clicks, 1)),
              cpm: metrics.cpm || ((metrics.spend / Math.max(metrics.impressions, 1)) * 1000),
              roas: metrics.roas || (metrics.spend > 0 ? (metrics.revenue || 0) / metrics.spend : 0),
            },
          })
        : Promise.resolve({ success: false }),
      currentTargeting
        ? optimization.optimizeTargeting({
            campaignId,
            currentTargeting,
            performanceData: [],
          })
        : Promise.resolve({ success: false }),
      metrics
        ? optimization.suggestImprovements({
            campaignId,
            performanceData: [
              {
                adId: campaignId,
                campaignId,
                date: new Date(),
                impressions: metrics.impressions || 0,
                clicks: metrics.clicks || 0,
                conversions: metrics.conversions || 0,
                spend: metrics.spend || 0,
                revenue: metrics.revenue || 0,
                ctr: metrics.ctr || 0,
                cvr: metrics.cvr || 0,
                cpc: metrics.cpc || 0,
                cpm: metrics.cpm || 0,
                roas: metrics.roas,
              },
            ],
            budget,
          })
        : Promise.resolve({ success: false }),
    ]);

    const audit = {
      campaignId,
      auditTimestamp: new Date(),
      bidOptimization: bidResult.status === 'fulfilled' && bidResult.value.success ? bidResult.value : null,
      targetingOptimization: targetingResult.status === 'fulfilled' && targetingResult.value.success ? targetingResult.value : null,
      improvements: improvementResult.status === 'fulfilled' && improvementResult.value.success ? improvementResult.value.improvements : [],
      priorityOrder: improvementResult.status === 'fulfilled' && improvementResult.value.success ? improvementResult.value.priorityOrder : [],
      estimatedUplift: improvementResult.status === 'fulfilled' && improvementResult.value.success ? improvementResult.value.estimatedUplift : null,
    };

    res.json({
      success: true,
      data: audit,
      timestamp: new Date(),
    });
  } catch (error) {
    next(error);
  }
});

// ============================================================================
// Export Router
// ============================================================================

export default router;
