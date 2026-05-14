/**
 * REZ Programmatic Bidding Service
 * Real-time bidding for ad inventory
 */

import express from 'express';
import mongoose from 'mongoose';
import axios from 'axios';

const app = express();
app.use(express.json());

// Connections
const WALLET_API = process.env.WALLET_API || 'https://rez-wallet.onrender.com';
const AD_SERVICE = process.env.AD_API || 'https://rez-ads.onrender.com';

// Models
const BidRequest = mongoose.model('BidRequest', new mongoose.Schema({
  request_id: String,
  impression_id: String,
  inventory_type: String, // banner, video, qr, native
  placement: String,
  user_id: String,
  device: {
    os: String,
    browser: String,
    device_type: String
  },
  location: { lat: Number, lng: Number },
  demographics: {
    age_range: String,
    gender: String,
    interests: [String]
  },
  floor_price: Number, // minimum acceptable price
  timestamp: { type: Date, default: Date.now }
}));

const BidResponse = mongoose.model('BidResponse', new mongoose.Schema({
  response_id: String,
  request_id: String,
  advertiser_id: String,
  campaign_id: String,
  bid_amount: Number,
  creative_url: String,
  creative_id: String,
  won: Boolean,
  timestamp: { type: Date, default: Date.now }
}));

const Advertiser = mongoose.model('Advertiser', new mongoose.Schema({
  advertiser_id: String,
  name: String,
  budget: Number,
  spent: { type: Number, default: 0 },
  bidding_strategy: String, // fixed, dynamic, target_roas, target_cpa
  max_cpc: Number,
  target_roas: Number,
  status: { type: String, enum: ['active', 'paused'], default: 'active' }
}));

const BidLog = mongoose.model('BidLog', new mongoose.Schema({
  request_id: String,
  bids_received: Number,
  winning_bid: Number,
  winner_id: String,
  timestamp: { type: Date, default: Date.now }
}));

// POST /api/bid-request - Receive bid request from inventory
app.post('/api/bid-request', async (req, res) => {
  const { impression_id, inventory_type, placement, user_id, device, location, floor_price } = req.body;

  const request_id = `BR-${Date.now()}`;

  const bidRequest = new BidRequest({
    request_id,
    impression_id,
    inventory_type,
    placement,
    user_id,
    device,
    location,
    floor_price,
    timestamp: new Date()
  });

  await bidRequest.save();

  // Get active advertisers
  const advertisers = await Advertiser.find({ status: 'active' });

  // Calculate bids from each advertiser
  const bids: any[] = [];

  for (const advertiser of advertisers) {
    const bid = calculateBid(advertiser, bidRequest);
    if (bid > 0) {
      bids.push({
        advertiser_id: advertiser.advertiser_id,
        bid_amount: bid,
        campaign_id: advertiser._id
      });
    }
  }

  // Sort by bid amount (highest first)
  bids.sort((a, b) => b.bid_amount - a.bid_amount);

  // Record bid responses
  const winner = bids[0];

  if (winner) {
    const response = new BidResponse({
      response_id: `BID-${Date.now()}`,
      request_id,
      advertiser_id: winner.advertiser_id,
      campaign_id: winner.campaign_id,
      bid_amount: winner.bid_amount,
      won: true
    });
    await response.save();

    // Update advertiser spend
    await Advertiser.findByIdAndUpdate(winner.campaign_id, {
      $inc: { spent: winner.bid_amount }
    });
  }

  // Log bid request
  const log = new BidLog({
    request_id,
    bids_received: bids.length,
    winning_bid: winner?.bid_amount || 0,
    winner_id: winner?.advertiser_id
  });
  await log.save();

  res.json({
    request_id,
    winner: winner || null,
    all_bids: bids
  });
});

// Calculate bid based on strategy
function calculateBid(advertiser: any, request: any): number {
  const baseBid = advertiser.max_cpc || 5;

  switch (advertiser.bidding_strategy) {
    case 'fixed':
      return baseBid;

    case 'dynamic':
      // Increase bid for matching demographics
      let multiplier = 1.0;
      if (request.demographics?.interests) {
        multiplier += 0.2;
      }
      return Math.min(baseBid * multiplier, advertiser.budget - advertiser.spent);

    case 'target_roas':
      // Adjust based on ROAS target
      const roasMultiplier = 1 + (advertiser.target_roas / 100 - 1) * 0.5;
      return Math.min(baseBid * roasMultiplier, advertiser.budget - advertiser.spent);

    case 'target_cpa':
      // Lower bid for cold users
      const cpaMultiplier = request.user_id ? 1.2 : 0.8;
      return Math.min(baseBid * cpaMultiplier, advertiser.budget - advertiser.spent);

    default:
      return baseBid;
  }
}

// GET /api/bid-stats - Get bidding statistics
app.get('/api/bid-stats', async (req, res) => {
  const { advertiser_id } = req.query;

  const query: any = {};
  if (advertiser_id) query.advertiser_id = advertiser_id;

  const logs = await BidLog.find().sort({ timestamp: -1 }).limit(100);

  const stats = {
    total_requests: logs.length,
    avg_bids_per_request: logs.reduce((sum, l) => sum + l.bids_received, 0) / logs.length || 0,
    avg_win_rate: logs.filter(l => l.winning_bid > 0).length / logs.length || 0,
    avg_winning_bid: logs.reduce((sum, l) => sum + l.winning_bid, 0) / logs.filter(l => l.winning_bid > 0).length || 0
  };

  res.json({ stats });
});

// POST /api/advertisers - Create advertiser
app.post('/api/advertisers', async (req, res) => {
  const { name, budget, bidding_strategy, max_cpc, target_roas } = req.body;

  const advertiser = new Advertiser({
    advertiser_id: `ADV-${Date.now()}`,
    name,
    budget,
    bidding_strategy: bidding_strategy || 'fixed',
    max_cpc: max_cpc || 5,
    target_roas: target_roas || 100
  });

  await advertiser.save();

  res.json({ success: true, advertiser_id: advertiser.advertiser_id });
});

// GET /api/advertisers - List advertisers
app.get('/api/advertisers', async (req, res) => {
  const advertisers = await Advertiser.find();
  res.json({ advertisers });
});

export default app;
