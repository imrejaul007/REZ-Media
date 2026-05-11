/**
 * Offline Ads Routes
 */

import { Router, Request, Response } from 'express';
import { offlineAdsService } from '../services/offlineAdsService';
import { verifyConsumer } from '../middleware/auth';

const router = Router();

// ===================== ADS =====================

/**
 * POST /api/offline-ads
 * Create offline ad campaign
 */
router.post('/', verifyConsumer, async (req: Request, res: Response) => {
  try {
    const ad = await offlineAdsService.createAd({
      ...req.body,
      merchantId: (req as any).user?.id || req.body.merchantId,
    });
    res.status(201).json({ success: true, data: ad });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/offline-ads
 * Get merchant's ads
 */
router.get('/', verifyConsumer, async (req: Request, res: Response) => {
  try {
    const merchantId = (req as any).user?.id;
    const { status } = req.query;
    const ads = await offlineAdsService.getMerchantAds(merchantId, status as string);
    res.json({ success: true, data: ads });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/offline-ads/:id
 * Get ad details
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const ad = await offlineAdsService.getAd(req.params.id);
    if (!ad) {
      return res.status(404).json({ success: false, error: 'Ad not found' });
    }
    res.json({ success: true, data: ad });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PUT /api/offline-ads/:id
 * Update ad
 */
router.put('/:id', verifyConsumer, async (req: Request, res: Response) => {
  try {
    const ad = await offlineAdsService.updateAd(req.params.id, req.body);
    res.json({ success: true, data: ad });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/offline-ads/:id/activate
 * Activate ad
 */
router.post('/:id/activate', verifyConsumer, async (req: Request, res: Response) => {
  try {
    const ad = await offlineAdsService.activateAd(req.params.id);
    res.json({ success: true, data: ad });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/offline-ads/:id/complete
 * Complete ad
 */
router.post('/:id/complete', verifyConsumer, async (req: Request, res: Response) => {
  try {
    const ad = await offlineAdsService.completeAd(req.params.id);
    res.json({ success: true, data: ad });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ===================== QR TRACKING =====================

/**
 * POST /api/offline-ads/:id/track
 * Track QR scan
 */
router.post('/:id/track', async (req: Request, res: Response) => {
  try {
    const { userId, location, deviceInfo } = req.body;
    const tracking = await offlineAdsService.trackQRScan({
      adId: req.params.id,
      scannedBy: userId,
      location,
      deviceInfo,
    });
    res.json({ success: true, data: tracking });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/offline-ads/:id/analytics
 * Get ad analytics
 */
router.get('/:id/analytics', async (req: Request, res: Response) => {
  try {
    const analytics = await offlineAdsService.getAdAnalytics(req.params.id);
    res.json({ success: true, data: analytics });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ===================== INVENTORY =====================

/**
 * GET /api/offline-ads/inventory
 * Browse available ad inventory
 */
router.get('/inventory/all', async (req: Request, res: Response) => {
  try {
    const { city, adType, minPrice, maxPrice, page, limit } = req.query;
    const result = await offlineAdsService.browseInventory({
      city: city as string,
      adType: adType as string,
      minPrice: minPrice ? parseInt(minPrice as string) : undefined,
      maxPrice: maxPrice ? parseInt(maxPrice as string) : undefined,
      page: page ? parseInt(page as string) : undefined,
      limit: limit ? parseInt(limit as string) : undefined,
    });
    res.json({ success: true, ...result });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
