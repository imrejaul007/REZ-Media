/**
 * REZ Owner Service - Unified Dashboard API Routes
 */

import { Router, Request, Response } from 'express';
import { inventoryAggregator, UnifiedEarnings, OwnerInventory } from '../services/inventoryAggregator';
import { authenticateRequest, requireServiceToken } from '../middleware/auth';

const router = Router();

// ===========================================
// INVENTORY ENDPOINTS
// ===========================================

/**
 * GET /api/owner/:ownerId/inventory
 * Get unified inventory from all sources
 */
router.get('/:ownerId/inventory', authenticateRequest, async (req: Request, res: Response) => {
  try {
    const { ownerId } = req.params;

    if (!ownerId) {
      return res.status(400).json({ error: 'Owner ID required' });
    }

    const inventory: OwnerInventory = await inventoryAggregator.getOwnerInventory(ownerId);

    res.json({
      success: true,
      data: inventory
    });
  } catch (error) {
    console.error('Error fetching inventory:', error);
    res.status(500).json({ error: 'Failed to fetch inventory' });
  }
});

/**
 * GET /api/owner/:ownerId/inventory/summary
 * Get inventory summary (counts by type)
 */
router.get('/:ownerId/inventory/summary', authenticateRequest, async (req: Request, res: Response) => {
  try {
    const { ownerId } = req.params;
    const inventory = await inventoryAggregator.getOwnerInventory(ownerId);

    const summary = {
      listings: {
        adBazaar: inventory.sources.adBazaar.length,
        dooh: inventory.sources.dooh.length,
        qrCampaigns: inventory.sources.qrCampaigns.length,
        inAppAds: inventory.sources.inAppAds.length,
        total: inventory.sources.adBazaar.length +
               inventory.sources.dooh.length +
               inventory.sources.qrCampaigns.length +
               inventory.sources.inAppAds.length
      },
      active: {
        adBazaar: inventory.sources.adBazaar.filter(i => i.status === 'active').length,
        dooh: inventory.sources.dooh.filter(i => i.status === 'online').length,
        qrCampaigns: inventory.sources.qrCampaigns.filter(i => i.status === 'active').length,
        inAppAds: inventory.sources.inAppAds.filter(i => i.status === 'active').length
      },
      totalRevenue: inventory.totalRevenue,
      totalImpressions: inventory.totalImpressions,
      totalScans: inventory.totalScans
    };

    res.json({ success: true, data: summary });
  } catch (error) {
    console.error('Error fetching summary:', error);
    res.status(500).json({ error: 'Failed to fetch summary' });
  }
});

// ===========================================
// EARNINGS ENDPOINTS
// ===========================================

/**
 * GET /api/owner/:ownerId/earnings
 * Get unified earnings from all sources
 */
router.get('/:ownerId/earnings', authenticateRequest, async (req: Request, res: Response) => {
  try {
    const { ownerId } = req.params;

    const earnings: UnifiedEarnings = await inventoryAggregator.getUnifiedEarnings(ownerId);

    res.json({
      success: true,
      data: earnings
    });
  } catch (error) {
    console.error('Error fetching earnings:', error);
    res.status(500).json({ error: 'Failed to fetch earnings' });
  }
});

/**
 * GET /api/owner/:ownerId/earnings/timeline
 * Get earnings timeline
 */
router.get('/:ownerId/earnings/timeline', authenticateRequest, async (req: Request, res: Response) => {
  try {
    const { ownerId } = req.params;
    const { period = '30d' } = req.query;

    const analytics = await inventoryAggregator.getUnifiedAnalytics(
      ownerId,
      period as '7d' | '30d' | '90d'
    );

    const timeline = analytics.timeline.map(point => ({
      date: point.date,
      revenue: point.revenue || 0,
      breakdown: {
        adBazaar: point.adBazaar?.revenue || 0,
        dooh: point.dooh?.revenue || 0,
        qrCampaigns: point.qrCampaigns?.revenue || 0,
        inAppAds: point.inAppAds?.revenue || 0
      }
    }));

    res.json({ success: true, data: timeline });
  } catch (error) {
    console.error('Error fetching earnings timeline:', error);
    res.status(500).json({ error: 'Failed to fetch earnings timeline' });
  }
});

// ===========================================
// ANALYTICS ENDPOINTS
// ===========================================

/**
 * GET /api/owner/:ownerId/analytics
 * Get unified analytics from all sources
 */
router.get('/:ownerId/analytics', authenticateRequest, async (req: Request, res: Response) => {
  try {
    const { ownerId } = req.params;
    const { range = '30d' } = req.query;

    const analytics = await inventoryAggregator.getUnifiedAnalytics(
      ownerId,
      range as '7d' | '30d' | '90d'
    );

    res.json({
      success: true,
      data: analytics
    });
  } catch (error) {
    console.error('Error fetching analytics:', error);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

/**
 * GET /api/owner/:ownerId/analytics/performance
 * Get performance metrics by source
 */
router.get('/:ownerId/analytics/performance', authenticateRequest, async (req: Request, res: Response) => {
  try {
    const { ownerId } = req.params;
    const inventory = await inventoryAggregator.getOwnerInventory(ownerId);

    const performance = {
      adBazaar: {
        listings: inventory.sources.adBazaar.length,
        avgImpressionsPerListing: inventory.sources.adBazaar.length > 0
          ? inventory.sources.adBazaar.reduce((s, i) => s + i.impressions, 0) / inventory.sources.adBazaar.length
          : 0,
        avgEarningsPerListing: inventory.sources.adBazaar.length > 0
          ? inventory.sources.adBazaar.reduce((s, i) => s + i.earnings, 0) / inventory.sources.adBazaar.length
          : 0,
        conversionRate: calculateConversionRate(inventory.sources.adBazaar)
      },
      dooh: {
        screens: inventory.sources.dooh.length,
        avgImpressionsPerScreen: inventory.sources.dooh.length > 0
          ? inventory.sources.dooh.reduce((s, i) => s + i.impressions, 0) / inventory.sources.dooh.length
          : 0,
        avgCPM: inventory.sources.dooh.length > 0
          ? inventory.sources.dooh.reduce((s, i) => s + i.cpm, 0) / inventory.sources.dooh.length
          : 0,
        uptime: calculateUptime(inventory.sources.dooh)
      },
      qrCampaigns: {
        campaigns: inventory.sources.qrCampaigns.length,
        avgScansPerCampaign: inventory.sources.qrCampaigns.length > 0
          ? inventory.sources.qrCampaigns.reduce((s, i) => s + i.scans, 0) / inventory.sources.qrCampaigns.length
          : 0,
        avgConversionRate: inventory.sources.qrCampaigns.length > 0
          ? inventory.sources.qrCampaigns.reduce((s, i) => s + (i.scans > 0 ? i.conversions / i.scans : 0), 0) / inventory.sources.qrCampaigns.length
          : 0,
        avgRewardPerScan: inventory.sources.qrCampaigns.length > 0
          ? inventory.sources.qrCampaigns.reduce((s, i) => s + i.coinReward, 0) / inventory.sources.qrCampaigns.length
          : 0
      },
      inAppAds: {
        adUnits: inventory.sources.inAppAds.length,
        avgImpressionsPerUnit: inventory.sources.inAppAds.length > 0
          ? inventory.sources.inAppAds.reduce((s, i) => s + i.impressions, 0) / inventory.sources.inAppAds.length
          : 0,
        avgCPM: inventory.sources.inAppAds.length > 0
          ? inventory.sources.inAppAds.reduce((s, i) => s + i.cpm, 0) / inventory.sources.inAppAds.length
          : 0,
        avgCTR: inventory.sources.inAppAds.length > 0
          ? inventory.sources.inAppAds.reduce((s, i) => s + (i.impressions > 0 ? i.clicks / i.impressions : 0), 0) / inventory.sources.inAppAds.length
          : 0
      }
    };

    res.json({ success: true, data: performance });
  } catch (error) {
    console.error('Error fetching performance:', error);
    res.status(500).json({ error: 'Failed to fetch performance' });
  }
});

// ===========================================
// SOURCE-SPECIFIC ENDPOINTS
// ===========================================

/**
 * GET /api/owner/:ownerId/adbazaar
 * Get AdBazaar listings only
 */
router.get('/:ownerId/adbazaar', authenticateRequest, async (req: Request, res: Response) => {
  try {
    const { ownerId } = req.params;
    const inventory = await inventoryAggregator.getOwnerInventory(ownerId);

    res.json({
      success: true,
      data: inventory.sources.adBazaar
    });
  } catch (error) {
    console.error('Error fetching adBazaar inventory:', error);
    res.status(500).json({ error: 'Failed to fetch AdBazaar inventory' });
  }
});

/**
 * GET /api/owner/:ownerId/dooh
 * Get DOOH screens only
 */
router.get('/:ownerId/dooh', authenticateRequest, async (req: Request, res: Response) => {
  try {
    const { ownerId } = req.params;
    const inventory = await inventoryAggregator.getOwnerInventory(ownerId);

    res.json({
      success: true,
      data: inventory.sources.dooh
    });
  } catch (error) {
    console.error('Error fetching DOOH inventory:', error);
    res.status(500).json({ error: 'Failed to fetch DOOH inventory' });
  }
});

/**
 * GET /api/owner/:ownerId/qr-campaigns
 * Get QR campaigns only
 */
router.get('/:ownerId/qr-campaigns', authenticateRequest, async (req: Request, res: Response) => {
  try {
    const { ownerId } = req.params;
    const inventory = await inventoryAggregator.getOwnerInventory(ownerId);

    res.json({
      success: true,
      data: inventory.sources.qrCampaigns
    });
  } catch (error) {
    console.error('Error fetching QR campaigns:', error);
    res.status(500).json({ error: 'Failed to fetch QR campaigns' });
  }
});

/**
 * GET /api/owner/:ownerId/inapp-ads
 * Get In-App ads only
 */
router.get('/:ownerId/inapp-ads', authenticateRequest, async (req: Request, res: Response) => {
  try {
    const { ownerId } = req.params;
    const inventory = await inventoryAggregator.getOwnerInventory(ownerId);

    res.json({
      success: true,
      data: inventory.sources.inAppAds
    });
  } catch (error) {
    console.error('Error fetching in-app ads:', error);
    res.status(500).json({ error: 'Failed to fetch In-App ads' });
  }
});

// ===========================================
// CROSS-PROMOTION ENDPOINTS
// ===========================================

/**
 * POST /api/owner/:ownerId/cross-promote
 * Promote content from one source to another
 */
router.post('/:ownerId/cross-promote', authenticateRequest, async (req: Request, res: Response) => {
  try {
    const { ownerId } = req.params;
    const { sourceType, sourceId, targetType } = req.body;

    if (!sourceType || !sourceId || !targetType) {
      return res.status(400).json({ error: 'sourceType, sourceId, and targetType required' });
    }

    // Cross-promotion logic
    const promotion = await createCrossPromotion(ownerId, sourceType, sourceId, targetType);

    res.json({
      success: true,
      data: promotion
    });
  } catch (error) {
    console.error('Error creating cross-promotion:', error);
    res.status(500).json({ error: 'Failed to create cross-promotion' });
  }
});

// ===========================================
// HELPER FUNCTIONS
// ===========================================

function calculateConversionRate(items: any[]): number {
  const withBookings = items.filter(i => i.bookings > 0).length;
  return items.length > 0 ? (withBookings / items.length) * 100 : 0;
}

function calculateUptime(doohItems: any[]): number {
  const online = doohItems.filter(i => i.status === 'online').length;
  return doohItems.length > 0 ? (online / doohItems.length) * 100 : 0;
}

async function createCrossPromotion(
  ownerId: string,
  sourceType: string,
  sourceId: string,
  targetType: string
): Promise<any> {
  // Implementation for cross-promotion
  return {
    id: `xp_${Date.now()}`,
    ownerId,
    sourceType,
    sourceId,
    targetType,
    status: 'pending',
    createdAt: new Date()
  };
}

export default router;
