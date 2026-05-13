/**
 * REZ AdsQR - QR Campaign Backend Service
 * QR code advertising with coin rewards
 */

import express from 'express';
import mongoose from 'mongoose';
import qrcode from 'qrcode';
import axios from 'axios';

const app = express();
app.use(express.json());

// Connections
const WALLET_API = process.env.WALLET_API || 'https://rez-wallet.onrender.com';
const ATTRIBUTION_API = process.env.ATTR_API || 'https://rez-attribution.onrender.com';

// Models
const QRCampaign = mongoose.model('QRCampaign', new mongoose.Schema({
  campaign_id: String,
  merchant_id: String,
  name: String,
  qr_type: { type: String, enum: ['boost', 'reward', 'coin', 'spin'], default: 'reward' },
  coin_reward: Number,
  spin_enabled: Boolean,
  spin_config: {
    segments: Number,
    prizes: [{ label: String, value: Number, probability: Number }]
  },
  target_audience: {
    location: { lat: Number, lng: Number, radius: Number },
    demographics: [String]
  },
  budget: Number,
  spent: { type: Number, default: 0 },
  status: { type: String, enum: ['active', 'paused', 'completed'], default: 'active' },
  scans: { type: Number, default: 0 },
  created_at: { type: Date, default: Date.now }
}));

const QRScan = mongoose.model('QRScan', new mongoose.Schema({
  scan_id: String,
  campaign_id: String,
  user_id: String,
  merchant_id: String,
  qr_url: String,
  coin_awarded: Number,
  spin_played: Boolean,
  spin_result: String,
  location: { lat: Number, lng: Number },
  device_id: String,
  timestamp: { type: Date, default: Date.now }
}));

// POST /api/qr/generate
app.post('/api/qr/generate', async (req, res) => {
  const { merchant_id, name, coin_reward, qr_type, spin_enabled, spin_config, budget, target_audience } = req.body;

  const campaign_id = `QR-${Date.now()}`;

  const campaign = new QRCampaign({
    campaign_id,
    merchant_id,
    name,
    coin_reward,
    qr_type: qr_type || 'reward',
    spin_enabled: spin_enabled || false,
    spin_config,
    budget,
    target_audience
  });

  await campaign.save();

  // Generate QR code URL
  const qr_url = `https://rez.app/qr/${campaign_id}`;

  res.json({ success: true, campaign_id, qr_url });
});

// POST /api/qr/scan
app.post('/api/qr/scan', async (req, res) => {
  const { campaign_id, user_id, merchant_id, location, device_id } = req.body;

  const campaign = await QRCampaign.findOne({ campaign_id });
  if (!campaign || campaign.status !== 'active') {
    return res.status(404).json({ error: 'Campaign not found or inactive' });
  }

  // Check budget
  if (campaign.spent >= campaign.budget) {
    return res.status(400).json({ error: 'Campaign budget exhausted' });
  }

  // Record scan
  const scan = new QRScan({
    scan_id: `SCAN-${Date.now()}`,
    campaign_id,
    user_id,
    merchant_id: campaign.merchant_id,
    coin_awarded: campaign.coin_reward,
    spin_played: false,
    location
  });

  await scan.save();

  // Award coins
  if (campaign.coin_reward > 0) {
    try {
      await axios.post(`${WALLET_API}/api/wallet/earn`, {
        user_id,
        amount: campaign.coin_reward,
        source: 'qr_campaign',
        reason: campaign.name
      });
    } catch (e) {}
  }

  // Update campaign stats
  campaign.scans += 1;
  campaign.spent += campaign.coin_reward;
  await campaign.save();

  // Track attribution
  try {
    await axios.post(`${ATTRIBUTION_API}/api/track/touchpoint`, {
      campaign_id,
      user_id,
      type: 'qr_scan',
      value: campaign.coin_reward
    });
  } catch (e) {}

  res.json({
    success: true,
    scan_id: scan.scan_id,
    coin_awarded: campaign.coin_reward,
    campaign_name: campaign.name
  });
});

// GET /api/campaigns
app.get('/api/campaigns', async (req, res) => {
  const { merchant_id, status } = req.query;
  const query: any = {};
  if (merchant_id) query.merchant_id = merchant_id;
  if (status) query.status = status;

  const campaigns = await QRCampaign.find(query).sort({ created_at: -1 });
  res.json({ campaigns });
});

// GET /api/campaigns/:id
app.get('/api/campaigns/:id', async (req, res) => {
  const campaign = await QRCampaign.findOne({ campaign_id: req.params.id });
  if (!campaign) {
    return res.status(404).json({ error: 'Campaign not found' });
  }
  res.json(campaign);
});

// POST /api/qr/spin
app.post('/api/qr/spin', async (req, res) => {
  const { scan_id } = req.body;

  const scan = await QRScan.findOne({ scan_id });
  if (!scan) {
    return res.status(404).json({ error: 'Scan not found' });
  }

  const campaign = await QRCampaign.findOne({ campaign_id: scan.campaign_id });
  if (!campaign || !campaign.spin_enabled) {
    return res.status(400).json({ error: 'Spin not enabled' });
  }

  // Spin logic
  const segments = campaign.spin_config?.segments || 6;
  const prizes = campaign.spin_config?.prizes || [
    { label: 'Try Again', value: 0 },
    { label: '5 Coins', value: 5 },
    { label: '10 Coins', value: 10 }
  ];

  // Weighted random
  const total = prizes.reduce((sum, p) => sum + p.probability, 0);
  let random = Math.random() * total;
  let result = prizes[0];

  for (const prize of prizes) {
    random -= prize.probability;
    if (random <= 0) {
      result = prize;
      break;
    }
  }

  // Award spin prize
  if (result.value > 0) {
    try {
      await axios.post(`${WALLET_API}/api/wallet/earn`, {
        user_id: scan.user_id,
        amount: result.value,
        source: 'qr_spin',
        reason: `Spin prize: ${result.label}`
      });
    } catch (e) {}
  }

  scan.spin_played = true;
  scan.spin_result = result.label;
  await scan.save();

  res.json({
    success: true,
    spin_result: result.label,
    coin_won: result.value
  });
});

export default app;
