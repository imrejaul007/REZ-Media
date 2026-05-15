/**
 * REZ Programmatic Bidding - Entry Point
 * Real-time bidding engine for programmatic advertising
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import mongoose from 'mongoose';
import { rateLimit } from 'express-rate-limit';
import { v4 as uuidv4 } from 'uuid';

const app = express();
const PORT = parseInt(process.env.PORT || '4077', 10);
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/programmatic-bidding';

app.use(helmet());
app.use(cors());
app.use(express.json());

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10000,
  message: { error: 'Too many requests' },
});
app.use('/api/', limiter);

// Bid Request Schema
const bidRequestSchema = new mongoose.Schema({
  requestId: { type: String, required: true, unique: true },
  timestamp: { type: Date, default: Date.now },
  impression: {
    impId: String,
    width: Number,
    height: Number,
    floorPrice: Number,
  },
  site: {
    siteId: String,
    name: String,
    domain: String,
  },
  device: {
    deviceId: String,
    type: String,
    os: String,
  },
  user: {
    userId: String,
    geo: { country: String, city: String },
  },
});

const BidRequest = mongoose.model('BidRequest', bidRequestSchema);

// Campaign Schema
const campaignSchema = new mongoose.Schema({
  campaignId: { type: String, required: true, unique: true },
  advertiserId: { type: String, required: true },
  name: String,
  status: { type: String, enum: ['active', 'paused', 'completed'], default: 'active' },
  bidding: {
    strategy: { type: String, enum: ['cpm', 'cpc', 'cpa'], default: 'cpm' },
    maxBid: Number,
    targetCpa: Number,
  },
  targeting: {
    sites: [String],
    geos: [String],
    devices: [String],
  },
  budget: { daily: Number, total: Number, spent: Number },
  metrics: {
    bids: { type: Number, default: 0 },
    wins: { type: Number, default: 0 },
    spend: { type: Number, default: 0 },
  },
});

const Campaign = mongoose.model('Campaign', campaignSchema);

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'healthy', service: 'rez-programmatic-bidding' });
});

// Submit bid request
app.post('/api/bid-request', async (req, res) => {
  try {
    const requestId = uuidv4();
    const bidRequest = new BidRequest({
      requestId,
      ...req.body,
    });
    await bidRequest.save();

    // Find eligible campaigns
    const campaigns = await Campaign.find({
      status: 'active',
      'targeting.sites': bidRequest.site?.siteId,
    });

    // Calculate bids
    const bids = campaigns.map((campaign) => ({
      campaignId: campaign.campaignId,
      bidPrice: Math.min(
        campaign.bidding.maxBid,
        req.body.impression?.floorPrice * 1.2 || 1.0
      ),
    }));

    // Determine winner (highest bid)
    const winner = bids.sort((a, b) => b.bidPrice - a.bidPrice)[0];

    if (winner) {
      await Campaign.findOneAndUpdate(
        { campaignId: winner.campaignId },
        {
          $inc: {
            'metrics.bids': 1,
            'metrics.wins': 1,
            'metrics.spend': winner.bidPrice,
          },
        }
      );
    }

    res.json({
      requestId,
      bids,
      winner: winner || null,
    });
  } catch (error) {
    console.error('Bid error:', error);
    res.status(500).json({ error: 'Bid processing failed' });
  }
});

// Get campaigns
app.get('/api/campaigns', async (req, res) => {
  try {
    const campaigns = await Campaign.find().sort({ createdAt: -1 });
    res.json({ success: true, data: campaigns });
  } catch (error) {
    res.status(500).json({ success: false });
  }
});

// Create campaign
app.post('/api/campaigns', async (req, res) => {
  try {
    const campaignId = `camp-${uuidv4().slice(0, 8)}`;
    const campaign = new Campaign({ campaignId, ...req.body });
    await campaign.save();
    res.status(201).json({ success: true, data: campaign });
  } catch (error) {
    res.status(400).json({ success: false });
  }
});

// Update campaign
app.patch('/api/campaigns/:id', async (req, res) => {
  try {
    const campaign = await Campaign.findOneAndUpdate(
      { campaignId: req.params.id },
      req.body,
      { new: true }
    );
    res.json({ success: true, data: campaign });
  } catch (error) {
    res.status(400).json({ success: false });
  }
});

// Error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Error:', err);
  res.status(500).json({ success: false, error: 'Internal server error' });
});

async function start(): Promise<void> {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log(`[${new Date().toISOString()}] Connected to MongoDB`);
    app.listen(PORT, () => {
      console.log(`[${new Date().toISOString()}] Programmatic Bidding running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Startup error:', error);
    process.exit(1);
  }
}

start();

export default app;
