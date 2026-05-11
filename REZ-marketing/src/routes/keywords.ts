import { Router, Request, Response } from 'express';
import mongoose from 'mongoose';
import { KeywordBid } from '../models/KeywordBid';
import { verifyMerchant } from '../middleware/auth';
import { track } from '../services/intentCaptureService';

const router = Router();

/**
 * GET /keywords/auction?term=coffee&limit=3
 * Returns top N merchants bidding on a keyword (for consumer app search results).
 * Sorted by bid amount desc — highest bidder gets top placement.
 * This route is PUBLIC (no auth) — it's for ad serving to consumers.
 */
router.get('/auction', async (req: Request, res: Response) => {
  const { term, limit: limitQ = '3' } = req.query as Record<string, string>;
  if (!term) return res.status(400).json({ error: 'term required' });

  const limit = Math.min(20, Math.max(1, parseInt(limitQ) || 3));
  const now = new Date();

  // MKT-11 FIX: Anchor and escape user input to prevent ReDoS.
  // Apply 100-char length limit to prevent catastrophic backtracking on MongoDB regex engine.
  const rawTerm = term.toLowerCase().trim();
  if (rawTerm.length > 100) {
    return res.status(400).json({ error: 'Search term must be 100 characters or fewer' });
  }
  const escapedTerm = rawTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  const bids = await KeywordBid.find({
    isActive: true,
    $and: [
      { $or: [{ startDate: { $lte: now } }, { startDate: { $exists: false } }] },
      { $or: [{ endDate: { $gte: now } }, { endDate: { $exists: false } }] },
    ],
    $or: [
      { keyword: escapedTerm },
      { keyword: new RegExp(`^${escapedTerm}$`, 'i'), matchType: 'broad' },
    ],
  })
    .sort({ bidAmount: -1 })
    .limit(limit)
    .select('merchantId headline description imageUrl ctaUrl ctaText bidAmount')
    .lean();

  res.json({ ads: bids });
});

// BAK-MKT-004 FIX: Apply merchant auth to all remaining keyword routes.
// The /auction route above is public (no auth) — it's for ad serving to consumers.
router.use(verifyMerchant);

// GET /keywords
router.get('/', async (req: Request, res: Response) => {
  const bids = await KeywordBid.find({ merchantId: req.merchantId }).sort({ createdAt: -1 }).lean();
  res.json({ bids });
});

// POST /keywords — create keyword bid (Search Ad)
router.post('/', async (req: Request, res: Response) => {
  const { keyword, bidAmount, dailyBudget, headline, description,
    matchType, bidType, imageUrl, ctaUrl, ctaText, startDate, endDate } = req.body;

  if (!keyword || !bidAmount || !dailyBudget || !headline) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  // BAK-MKT-004 FIX: Use req.merchantId from JWT, not body.merchantId
  const bid = await KeywordBid.create({
    merchantId: req.merchantId, keyword: keyword.toLowerCase().trim(),
    bidAmount, dailyBudget, headline, description,
    matchType: matchType || 'broad',
    bidType: bidType || 'cpc',
    imageUrl, ctaUrl, ctaText,
    startDate, endDate,
    isActive: true,
  });

  // RTMN Commerce Memory: track keyword bid creation as merchant marketing intent
  track({ userId: req.merchantId, event: 'keyword_bid_created', intentKey: `marketing_keyword_${bid._id}`, properties: { keywordBidId: String(bid._id), keyword, bidAmount, dailyBudget } }).catch(() => {});

  res.status(201).json(bid);
});

// PATCH /keywords/:id — ownership verified via req.merchantId
router.patch('/:id', async (req: Request, res: Response) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: 'Invalid id' });

  const bid = await KeywordBid.findOne({ _id: req.params.id, merchantId: req.merchantId });
  if (!bid) return res.status(404).json({ error: 'Not found or not owned by merchant' });

  // BAK-MKT-002/004 FIX: Explicit field assignments instead of dynamic key loop.
  if (req.body.bidAmount !== undefined) bid.bidAmount = req.body.bidAmount;
  if (req.body.dailyBudget !== undefined) bid.dailyBudget = req.body.dailyBudget;
  if (req.body.headline !== undefined) bid.headline = req.body.headline;
  if (req.body.description !== undefined) bid.description = req.body.description;
  if (req.body.isActive !== undefined) bid.isActive = req.body.isActive;
  if (req.body.imageUrl !== undefined) bid.imageUrl = req.body.imageUrl;
  if (req.body.ctaUrl !== undefined) bid.ctaUrl = req.body.ctaUrl;
  if (req.body.ctaText !== undefined) bid.ctaText = req.body.ctaText;
  if (req.body.endDate !== undefined) bid.endDate = req.body.endDate;
  await bid.save();

  // RTMN Commerce Memory: track keyword bid update as merchant marketing intent
  track({ userId: req.merchantId, event: 'keyword_bid_updated', intentKey: `marketing_keyword_${bid._id}`, properties: { keywordBidId: String(bid._id), changedFields: Object.keys(req.body) } }).catch(() => {});

  res.json(bid);
});

// DELETE /keywords/:id — ownership verified via req.merchantId
router.delete('/:id', async (req: Request, res: Response) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: 'Invalid id' });
  const deleted = await KeywordBid.findOneAndDelete({ _id: req.params.id, merchantId: req.merchantId });
  if (!deleted) return res.status(404).json({ error: 'Not found or not owned by merchant' });
  res.json({ deleted: true });
});

export default router;
