/**
 * AUCTION ENGINE ROUTES
 *
 * Handles competition between merchants
 */

import { Router } from 'express';
import { auctionEngine, runAuction, submitBid, MerchantBid, AuctionRequest } from '../engines/sampling/auctionEngine';

const router = Router();

// ============================================
// AUCTION ROUTES
// ============================================

/**
 * POST /api/auction/run
 *
 * Run auction for a user
 * Called by: Supreme Controller
 */
router.post('/run', async (req, res) => {
  try {
    const { userId, intent, location, context } = req.body;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'userId is required'
      });
    }

    const request: AuctionRequest = {
      userId,
      intent,
      location,
      context: context || {}
    };

    const result = await runAuction(request);

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error('[Auction] Run error:', error);
    res.status(500).json({
      success: false,
      error: 'Auction failed'
    });
  }
});

// ============================================
// BID ROUTES
// ============================================

/**
 * POST /api/auction/bid
 *
 * Submit a bid for a user
 * Called by: Campaign service
 */
router.post('/bid', async (req, res) => {
  try {
    const bid: MerchantBid = req.body;

    if (!bid.merchantId || !bid.userId) {
      return res.status(400).json({
        success: false,
        error: 'merchantId and userId are required'
      });
    }

    // Set defaults
    bid.qualityScore = bid.qualityScore || 50;
    bid.intentMatch = bid.intentMatch || 50;
    bid.historicalCTR = bid.historicalCTR || 5;
    bid.conversionRate = bid.conversionRate || 10;
    bid.startTime = bid.startTime || new Date();
    bid.endTime = bid.endTime || new Date(Date.now() + 7 * 86400000);

    const result = await submitBid(bid);

    res.json({
      success: result.accepted,
      data: result
    });

  } catch (error) {
    console.error('[Auction] Bid error:', error);
    res.status(500).json({
      success: false,
      error: 'Bid failed'
    });
  }
});

// ============================================
// BID MANAGEMENT
// ============================================

/**
 * GET /api/auction/bid/:userId/:merchantId
 *
 * Get bid status
 */
router.get('/bid/:userId/:merchantId', async (req, res) => {
  try {
    const { userId, merchantId } = req.params;

    const key = `rde:auction:bid:${userId}:${merchantId}`;
    const { default: redis } = await import('ioredis');
    const redisClient = new redis(process.env.REDIS_URL || 'redis://localhost:6379');
    const data = await redisClient.hgetall(key);

    if (!data || Object.keys(data).length === 0) {
      return res.json({
        success: true,
        data: null
      });
    }

    const rank = await auctionEngine.getUserAuctionStatus(userId);

    res.json({
      success: true,
      data: {
        merchantId,
        userId,
        status: data.status,
        baseBid: parseFloat(data.baseBid),
        rank: rank.wonAuctions > 0 ? 1 : 0
      }
    });

  } catch (error) {
    console.error('[Auction] Get bid error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get bid'
    });
  }
});

/**
 * PATCH /api/auction/bid/:userId/:merchantId/pause
 *
 * Pause a bid
 */
router.patch('/bid/:userId/:merchantId/pause', async (req, res) => {
  try {
    const { userId, merchantId } = req.params;

    await auctionEngine.pauseBid(userId, merchantId);

    res.json({
      success: true
    });

  } catch (error) {
    console.error('[Auction] Pause error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to pause bid'
    });
  }
});

/**
 * PATCH /api/auction/bid/:userId/:merchantId/resume
 *
 * Resume a bid
 */
router.patch('/bid/:userId/:merchantId/resume', async (req, res) => {
  try {
    const { userId, merchantId } = req.params;

    await auctionEngine.resumeBid(userId, merchantId);

    res.json({
      success: true
    });

  } catch (error) {
    console.error('[Auction] Resume error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to resume bid'
    });
  }
});

/**
 * DELETE /api/auction/bid/:userId/:merchantId
 *
 * Delete a bid
 */
router.delete('/bid/:userId/:merchantId', async (req, res) => {
  try {
    const { userId, merchantId } = req.params;

    await auctionEngine.deleteBid(userId, merchantId);

    res.json({
      success: true
    });

  } catch (error) {
    console.error('[Auction] Delete error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete bid'
    });
  }
});

// ============================================
// USER AUCTION STATUS
// ============================================

/**
 * GET /api/auction/status/:userId
 *
 * Get user's auction history
 */
router.get('/status/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    const status = await auctionEngine.getUserAuctionStatus(userId);

    res.json({
      success: true,
      data: status
    });

  } catch (error) {
    console.error('[Auction] Status error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get status'
    });
  }
});

// ============================================
// CAMPAIGN BIDS
// ============================================

/**
 * GET /api/auction/campaign/:campaignId/bids
 *
 * Get all bids for a campaign
 */
router.get('/campaign/:campaignId/bids', async (req, res) => {
  try {
    const { campaignId } = req.params;

    // Get all users bidding for this campaign
    const { default: redis } = await import('ioredis');
    const redisClient = new redis(process.env.REDIS_URL || 'redis://localhost:6379');

    const userIds = await redisClient.smembers(`rde:auction:campaign:${campaignId}:users`);

    const bids = [];

    for (const userId of userIds.slice(0, 100)) { // Limit to 100
      const data = await redisClient.hgetall(`rde:auction:bid:${userId}:${campaignId}`);
      if (data && Object.keys(data).length > 0) {
        bids.push({
          userId,
          status: data.status,
          baseBid: parseFloat(data.baseBid),
          qualityScore: parseFloat(data.qualityScore)
        });
      }
    }

    res.json({
      success: true,
      data: {
        campaignId,
        bidCount: bids.length,
        bids
      }
    });

  } catch (error) {
    console.error('[Auction] Campaign bids error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get campaign bids'
    });
  }
});

// ============================================
// SIMULATE AUCTION
// ============================================

/**
 * POST /api/auction/simulate
 *
 * Simulate auction without running it
 * For testing and preview
 */
router.post('/simulate', async (req, res) => {
  try {
    const { userId, merchants } = req.body;

    if (!userId || !merchants || !Array.isArray(merchants)) {
      return res.status(400).json({
        success: false,
        error: 'userId and merchants array are required'
      });
    }

    // Create bids from merchant list
    const bids: MerchantBid[] = merchants.map((m: any, index: number) => ({
      merchantId: m.merchantId,
      campaignId: m.campaignId || `sim_${index}`,
      userId,
      baseBid: m.baseBid || 50,
      qualityScore: m.qualityScore || 50,
      intentMatch: m.intentMatch || 50,
      historicalCTR: m.historicalCTR || 5,
      conversionRate: m.conversionRate || 10,
      discount: m.discount || 0,
      coinReward: m.coinReward || 0,
      startTime: new Date(),
      endTime: new Date(Date.now() + 7 * 86400000),
      status: 'active'
    }));

    // Score bids manually
    const scored = bids.map(bid => {
      const components = {
        bidScore: Math.min(100, (bid.baseBid / 100) * 100) * 0.25,
        qualityScore: bid.qualityScore * 0.25,
        intentMatch: bid.intentMatch * 0.20,
        historicalCTR: bid.historicalCTR * 0.15,
        conversionRate: bid.conversionRate * 0.15
      };

      const finalScore = Object.values(components).reduce((a, b) => a + b, 0);

      return {
        merchantId: bid.merchantId,
        components,
        finalScore,
        rank: 0
      };
    });

    // Sort and assign ranks
    scored.sort((a, b) => b.finalScore - a.finalScore);
    scored.forEach((s, i) => s.rank = i + 1);

    res.json({
      success: true,
      data: {
        userId,
        results: scored,
        winner: scored[0] || null
      }
    });

  } catch (error) {
    console.error('[Auction] Simulate error:', error);
    res.status(500).json({
      success: false,
      error: 'Simulation failed'
    });
  }
});

export default router;
