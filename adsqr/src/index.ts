/**
 * adsqr - QR Code Ad Campaigns
 * QR-based advertising with coin rewards
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import mongoose from 'mongoose';
import QRCode from 'qrcode';
import { rateLimit } from 'express-rate-limit';
import { v4 as uuidv4 } from 'uuid';

const app = express();
const PORT = parseInt(process.env.PORT || '4068', 10);
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/adsqr';

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  message: { error: 'Too many requests' },
});
app.use('/api/', limiter);

// Campaign Schema
const campaignSchema = new mongoose.Schema({
  campaignId: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  advertiserId: { type: String, required: true },
  redirectUrl: { type: String, required: true },
  rewardCoins: { type: Number, default: 10 },
  dailyLimit: { type: Number, default: 1000 },
  totalLimit: { type: Number },
  scans: { type: Number, default: 0 },
  status: { type: String, enum: ['active', 'paused', 'completed'], default: 'active' },
  createdAt: { type: Date, default: Date.now },
});

const Campaign = mongoose.model('Campaign', campaignSchema);

// QR Scan Schema
const scanSchema = new mongoose.Schema({
  scanId: { type: String, required: true, unique: true },
  campaignId: { type: String, required: true },
  userId: String,
  deviceId: String,
  ip: String,
  location: {
    country: String,
    city: String,
  },
  rewarded: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
});

const Scan = mongoose.model('Scan', scanSchema);

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'healthy', service: 'adsqr' });
});

// Create campaign
app.post('/api/campaigns', async (req, res) => {
  try {
    const campaignId = `qr-${uuidv4().slice(0, 8)}`;
    const campaign = new Campaign({ campaignId, ...req.body });
    await campaign.save();
    res.status(201).json({ success: true, data: campaign });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(400).json({ success: false, error: message });
  }
});

// Get campaign
app.get('/api/campaigns/:id', async (req, res) => {
  try {
    const campaign = await Campaign.findOne({ campaignId: req.params.id });
    if (!campaign) {
      res.status(404).json({ success: false, error: 'Campaign not found' });
      return;
    }
    res.json({ success: true, data: campaign });
  } catch (error) {
    res.status(400).json({ success: false });
  }
});

// Generate QR code
app.get('/api/campaigns/:id/qr', async (req, res) => {
  try {
    const campaign = await Campaign.findOne({ campaignId: req.params.id });
    if (!campaign) {
      res.status(404).json({ success: false, error: 'Campaign not found' });
      return;
    }

    const baseUrl = process.env.QR_BASE_URL || 'https://qr.rezapp.com';
    const scanUrl = `${baseUrl}/scan/${campaign.campaignId}`;

    const qrDataUrl = await QRCode.toDataURL(scanUrl, {
      width: 300,
      margin: 2,
      color: { dark: '#000000', light: '#ffffff' },
    });

    res.json({
      success: true,
      data: {
        campaignId: campaign.campaignId,
        scanUrl,
        qrDataUrl,
      },
    });
  } catch (error) {
    res.status(400).json({ success: false });
  }
});

// Scan QR code
app.post('/api/scan', async (req, res) => {
  try {
    const { campaignId, userId, deviceId } = req.body;

    const campaign = await Campaign.findOne({ campaignId });
    if (!campaign) {
      res.status(404).json({ success: false, error: 'Campaign not found' });
      return;
    }

    if (campaign.status !== 'active') {
      res.status(400).json({ success: false, error: 'Campaign not active' });
      return;
    }

    if (campaign.totalLimit && campaign.scans >= campaign.totalLimit) {
      res.status(400).json({ success: false, error: 'Campaign limit reached' });
      return;
    }

    // Check for duplicate scan
    const existingScan = await Scan.findOne({ campaignId, userId, deviceId });
    if (existingScan) {
      res.json({
        success: true,
        data: { rewarded: false, reason: 'Already scanned' },
      });
      return;
    }

    // Record scan
    const scanId = `scan-${uuidv4().slice(0, 8)}`;
    const scan = new Scan({
      scanId,
      campaignId,
      userId,
      deviceId,
      rewarded: true,
    });
    await scan.save();

    // Update campaign scans
    await Campaign.findOneAndUpdate(
      { campaignId },
      { $inc: { scans: 1 } }
    );

    res.json({
      success: true,
      data: {
        rewarded: true,
        coins: campaign.rewardCoins,
        redirectUrl: campaign.redirectUrl,
      },
    });
  } catch (error) {
    res.status(400).json({ success: false });
  }
});

// List campaigns
app.get('/api/campaigns', async (req, res) => {
  try {
    const { status } = req.query;
    const query: Record<string, unknown> = {};
    if (status) query.status = status;

    const campaigns = await Campaign.find(query).sort({ createdAt: -1 });
    res.json({ success: true, data: campaigns });
  } catch (error) {
    res.status(400).json({ success: false });
  }
});

// Error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Error:', err);
  res.status(500).json({ success: false, error: 'Internal server error' });
});

// Start server
async function start(): Promise<void> {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log(`[${new Date().toISOString()}] Connected to MongoDB`);

    app.listen(PORT, () => {
      console.log(`[${new Date().toISOString()}] adsqr running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Startup error:', error);
    process.exit(1);
  }
}

start();

export default app;
