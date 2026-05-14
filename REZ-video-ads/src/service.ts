/**
 * REZ Video Ads Service
 * Video advertising with rewarded playback
 */

import express from 'express';
import mongoose from 'mongoose';
import axios from 'axios';

const app = express();
app.use(express.json());

// Connections
const WALLET_API = process.env.WALLET_API || 'https://rez-wallet.onrender.com';
const ATTRIBUTION_API = process.env.ATTR_API || 'https://rez-attribution.onrender.com';

// Models
const VideoAd = mongoose.model('VideoAd', new mongoose.Schema({
  ad_id: String,
  merchant_id: String,
  campaign_id: String,
  title: String,
  description: String,
  video_url: String,
  thumbnail_url: String,
  duration: Number, // seconds
  skip_after: Number, // seconds before skip allowed
  reward_amount: Number, // coins for watching
  target_audience: {
    location: { lat: Number, lng: Number, radius: Number },
    demographics: [String],
    interests: [String]
  },
  budget: Number,
  spent: { type: Number, default: 0 },
  views: { type: Number, default: 0 },
  completions: { type: Number, default: 0 },
  clicks: { type: Number, default: 0 },
  status: { type: String, enum: ['active', 'paused', 'completed'], default: 'active' },
  cpm: Number, // cost per 1000 views
  cpc: Number, // cost per click
  created_at: { type: Date, default: Date.now }
}));

const VideoView = mongoose.model('VideoView', new mongoose.Schema({
  view_id: String,
  ad_id: String,
  user_id: String,
  merchant_id: String,
  watched_seconds: Number,
  completed: Boolean,
  skipped: Boolean,
  clicked: Boolean,
  coin_awarded: Number,
  location: { lat: Number, lng: Number },
  device_id: String,
  timestamp: { type: Date, default: Date.now }
}));

// POST /api/video-ads - Create video ad
app.post('/api/video-ads', async (req, res) => {
  const { merchant_id, campaign_id, title, description, video_url, thumbnail_url, duration, skip_after, reward_amount, target_audience, budget, cpm, cpc } = req.body;

  const ad = new VideoAd({
    ad_id: `VAD-${Date.now()}`,
    merchant_id,
    campaign_id,
    title,
    description,
    video_url,
    thumbnail_url,
    duration: duration || 30,
    skip_after: skip_after || 5,
    reward_amount: reward_amount || 2,
    target_audience,
    budget,
    cpm: cpm || 25,
    cpc: cpc || 5
  });

  await ad.save();

  res.json({ success: true, ad_id: ad.ad_id });
});

// GET /api/video-ads - Get available ads for user
app.get('/api/video-ads', async (req, res) => {
  const { user_id, location, interests } = req.query;

  // Get active ads matching criteria
  const query: any = { status: 'active', budget: { $gt: mongoose.Types.Decimal128('$spent') } };

  const ads = await VideoAd.find(query)
    .sort({ cpm: -1 })
    .limit(10);

  res.json({ ads });
});

// POST /api/video-ads/:id/view - Record view start
app.post('/api/video-ads/:id/view', async (req, res) => {
  const { user_id, location, device_id } = req.body;

  const ad = await VideoAd.findOne({ ad_id: req.params.id });
  if (!ad || ad.status !== 'active') {
    return res.status(404).json({ error: 'Ad not found or inactive' });
  }

  // Calculate coin reward (full watch = full reward, partial = partial)
  const baseReward = ad.reward_amount;

  const view = new VideoView({
    view_id: `VIEW-${Date.now()}`,
    ad_id: ad.ad_id,
    user_id,
    merchant_id: ad.merchant_id,
    watched_seconds: 0,
    completed: false,
    skipped: false,
    clicked: false,
    coin_awarded: 0,
    location
  });

  await view.save();

  res.json({
    success: true,
    view_id: view.view_id,
    video_url: ad.video_url,
    thumbnail_url: ad.thumbnail_url,
    duration: ad.duration,
    skip_after: ad.skip_after,
    reward_amount: baseReward,
    title: ad.title
  });
});

// POST /api/video-ads/:id/progress - Update view progress
app.post('/api/video-ads/:id/progress', async (req, res) => {
  const { view_id, watched_seconds, completed, skipped, clicked } = req.body;

  const view = await VideoView.findOne({ view_id });
  if (!view) {
    return res.status(404).json({ error: 'View not found' });
  }

  view.watched_seconds = watched_seconds;
  view.completed = completed;
  view.skipped = skipped;
  view.clicked = clicked;

  // Award coins on completion or click
  const ad = await VideoAd.findOne({ ad_id: req.params.id });
  if (ad) {
    let coinReward = 0;

    if (completed) {
      // Full reward for completing video
      coinReward = ad.reward_amount;
      ad.completions += 1;
    } else if (clicked) {
      // Partial reward for clicking
      coinReward = Math.floor(ad.reward_amount / 2);
      ad.clicks += 1;
    }

    if (coinReward > 0) {
      // Award coins
      try {
        await axios.post(`${WALLET_API}/api/wallet/earn`, {
          user_id: view.user_id,
          amount: coinReward,
          source: 'video_ad',
          reason: ad.title
        });
      } catch (e) {}

      view.coin_awarded = coinReward;
    }

    // Update ad stats
    ad.views += 1;
    ad.spent += (ad.cpm / 1000);
    await ad.save();

    // Track attribution
    try {
      await axios.post(`${ATTRIBUTION_API}/api/track/touchpoint`, {
        campaign_id: ad.campaign_id,
        user_id: view.user_id,
        type: 'video_ad',
        value: ad.cpm / 1000
      });
    } catch (e) {}
  }

  await view.save();

  res.json({
    success: true,
    coin_awarded: view.coin_awarded,
    completed: view.completed
  });
});

// GET /api/video-ads/:id/stats - Get ad performance
app.get('/api/video-ads/:id/stats', async (req, res) => {
  const ad = await VideoAd.findOne({ ad_id: req.params.id });
  if (!ad) {
    return res.status(404).json({ error: 'Ad not found' });
  }

  const stats = {
    views: ad.views,
    completions: ad.completions,
    clicks: ad.clicks,
    completion_rate: ad.views > 0 ? (ad.completions / ad.views * 100).toFixed(2) + '%' : '0%',
    ctr: ad.views > 0 ? (ad.clicks / ad.views * 100).toFixed(2) + '%' : '0%',
    budget: ad.budget,
    spent: ad.spent,
    remaining: ad.budget - ad.spent
  };

  res.json({ stats });
});

export default app;
