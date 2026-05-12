import { Router, Request, Response, NextFunction } from 'express';
import { reportGenerator } from '../services/ReportGenerator';
import { touchpointTracker } from '../services/TouchpointTracker';
import { conversionTracker } from '../services/ConversionTracker';
import { attributionEngine, AttributionConfig } from '../services/AttributionEngine';
import { AttributionModel } from '../models/AttributionReport';
import logger from '../utils/logger';

const router = Router();

/**
 * GET /api/reports/attribution
 * Get attribution report with configurable parameters
 */
router.get('/attribution', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const {
      merchantId,
      campaignId,
      startDate,
      endDate,
      model,
      lookbackDays
    } = req.query;

    // Validate model if provided
    if (model && !Object.values(AttributionModel).includes(model as AttributionModel)) {
      res.status(400).json({
        success: false,
        error: `Invalid attribution model. Must be one of: ${Object.values(AttributionModel).join(', ')}`
      });
      return;
    }

    const filters = {
      merchantId: merchantId as string,
      campaignId: campaignId as string,
      startDate: startDate ? new Date(startDate as string) : undefined,
      endDate: endDate ? new Date(endDate as string) : undefined,
      attributionModel: model as AttributionModel,
      lookbackDays: lookbackDays ? parseInt(lookbackDays as string) : 30
    };

    const report = await reportGenerator.generateAttributionReport(filters);

    res.json({
      success: true,
      data: report
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/reports/funnel
 * Get conversion funnel report
 */
router.get('/funnel', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const {
      merchantId,
      campaignId,
      startDate,
      endDate
    } = req.query;

    const report = await reportGenerator.generateFunnelReport({
      merchantId: merchantId as string,
      campaignId: campaignId as string,
      startDate: startDate ? new Date(startDate as string) : undefined,
      endDate: endDate ? new Date(endDate as string) : undefined
    });

    res.json({
      success: true,
      data: report
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/campaigns/:id/attribution
 * Get attribution report for a specific campaign
 */
router.post('/campaigns/:id/attribution', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id: campaignId } = req.params;
    const {
      startDate,
      endDate,
      attributionModel
    } = req.body;

    const report = await reportGenerator.generateCampaignAttribution(campaignId, {
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      attributionModel: attributionModel || AttributionModel.LINEAR
    });

    res.json({
      success: true,
      data: report
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/campaigns/:id/attribution
 * Get attribution report for a specific campaign (GET version)
 */
router.get('/campaigns/:id/attribution', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id: campaignId } = req.params;
    const {
      startDate,
      endDate,
      model
    } = req.query;

    const report = await reportGenerator.generateCampaignAttribution(campaignId, {
      startDate: startDate ? new Date(startDate as string) : undefined,
      endDate: endDate ? new Date(endDate as string) : undefined,
      attributionModel: (model as AttributionModel) || AttributionModel.LINEAR
    });

    res.json({
      success: true,
      data: report
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/reports/compare
 * Compare attribution across different models
 */
router.post('/compare', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const {
      userId,
      conversionId,
      lookbackDays
    } = req.body;

    if (!userId || !conversionId) {
      res.status(400).json({
        success: false,
        error: 'userId and conversionId are required'
      });
      return;
    }

    // Get the conversion
    const conversion = await conversionTracker.getConversion(conversionId);
    if (!conversion) {
      res.status(404).json({
        success: false,
        error: 'Conversion not found'
      });
      return;
    }

    // Get touchpoints for this user
    const touchpoints = await touchpointTracker.getUserTouchpointsForAttribution(
      userId,
      conversion.conversionTimestamp,
      lookbackDays || 30
    );

    if (touchpoints.length === 0) {
      res.status(404).json({
        success: false,
        error: 'No touchpoints found for this user within the attribution window'
      });
      return;
    }

    const comparison = await attributionEngine.compareAttributionModels(
      touchpoints as any,
      conversion as any
    );

    res.json({
      success: true,
      data: {
        conversionId: conversion.id,
        totalValue: conversion.value,
        touchpointsCount: touchpoints.length,
        models: Object.keys(comparison).map(model => ({
          model,
          contributions: comparison[model as AttributionModel].contributions.map(c => ({
            touchpointId: c.touchpointId,
            channel: c.attributedChannel,
            contribution: c.contribution,
            contributionPercentage: c.contributionPercentage
          })),
          totalContribution: comparison[model as AttributionModel].totalContribution
        }))
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/reports/historical
 * Get historical attribution reports
 */
router.get('/historical', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const {
      reportType,
      entityId,
      limit
    } = req.query;

    const reports = await reportGenerator.getHistoricalReports({
      reportType: reportType as any,
      entityId: entityId as string,
      limit: limit ? parseInt(limit as string) : 10
    });

    res.json({
      success: true,
      data: {
        reports,
        count: reports.length
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/reports/:id
 * Get a specific report by ID
 */
router.get('/report/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const report = await reportGenerator.getReport(id);

    if (!report) {
      res.status(404).json({
        success: false,
        error: 'Report not found'
      });
      return;
    }

    res.json({
      success: true,
      data: report
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/reports/dashboard/:merchantId
 * Get real-time dashboard metrics for a merchant
 */
router.get('/dashboard/:merchantId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { merchantId } = req.params;

    const metrics = await reportGenerator.getDashboardMetrics(merchantId);

    res.json({
      success: true,
      data: metrics
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/reports/channel-performance
 * Get channel performance metrics
 */
router.get('/channel-performance', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const {
      merchantId,
      campaignId,
      startDate,
      endDate
    } = req.query;

    const end = endDate ? new Date(endDate as string) : new Date();
    const start = startDate
      ? new Date(startDate as string)
      : new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [touchpoints, conversions] = await Promise.all([
      touchpointTracker.getTouchpoints({
        merchantId: merchantId as string,
        campaignId: campaignId as string,
        startDate: start,
        endDate: end,
        limit: 10000
      }),
      conversionTracker.getConversions({
        merchantId: merchantId as string,
        startDate: start,
        endDate: end,
        limit: 10000
      })
    ]);

    // Calculate channel performance
    const channelStats = new Map<string, {
      touchpoints: number;
      conversions: number;
      value: number;
      uniqueUsers: number;
    }>();

    // Initialize all channels
    const channels = ['display', 'social', 'search', 'video', 'audio', 'ooh', 'print', 'direct', 'email', 'referral'];
    for (const channel of channels) {
      channelStats.set(channel, {
        touchpoints: 0,
        conversions: 0,
        value: 0,
        uniqueUsers: 0
      });
    }

    // Count touchpoints by channel
    for (const tp of touchpoints.touchpoints) {
      const stats = channelStats.get(tp.channel) || { touchpoints: 0, conversions: 0, value: 0, uniqueUsers: 0 };
      stats.touchpoints++;
      channelStats.set(tp.channel, stats);
    }

    // Count conversions (simplified - attributed to last touchpoint's channel)
    for (const conv of conversions.conversions) {
      if (conv.attributionData?.attributedChannel) {
        const stats = channelStats.get(conv.attributionData.attributedChannel) || {
          touchpoints: 0, conversions: 0, value: 0, uniqueUsers: 0
        };
        stats.conversions++;
        stats.value += conv.value || 0;
        channelStats.set(conv.attributionData.attributedChannel, stats);
      }
    }

    const performance = Array.from(channelStats.entries())
      .map(([channel, stats]) => ({
        channel,
        ...stats,
        conversionRate: stats.touchpoints > 0
          ? (stats.conversions / stats.touchpoints) * 100
          : 0
      }))
      .filter(s => s.touchpoints > 0)
      .sort((a, b) => b.value - a.value);

    res.json({
      success: true,
      data: {
        channelPerformance: performance,
        dateRange: { start, end },
        totals: {
          touchpoints: touchpoints.total,
          conversions: conversions.total
        }
      }
    });
  } catch (error) {
    next(error);
  }
});

export default router;
