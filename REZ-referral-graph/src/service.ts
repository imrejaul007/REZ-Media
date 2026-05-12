/**
 * REZ Referral Graph - AI-Powered Referral Network
 * Reward users for quality referrals, not random referrals
 */

import express from 'express';
import mongoose from 'mongoose';
import axios from 'axios';

const app = express();
app.use(express.json());

// Connections
const WALLET_API = process.env.WALLET_API || 'https://rez-wallet.onrender.com';
const INTELLIGENCE_API = process.env.INTELLIGENCE_API || 'https://rez-intelligence.onrender.com';

// Referral Configuration
const REFERRAL_CONFIG = {
  user: {
    base_reward: 100,
    lifetime_commission: 0.02,
    quality_bonus: 500,
    min_ltv_score: 0.7
  },
  merchant: {
    base_reward: 500,
    commission: 0.05,
    min_referrals: 3
  },
  creator: {
    base_reward: 1000,
    commission: 0.03,
    min_followers: 1000
  },
  community: {
    reward_per_member: 50,
    min_members: 10,
    group_bonus: 500
  }
};

// Models
const Referral = mongoose.model('Referral', new mongoose.Schema({
  referral_id: String,
  referrer_id: String,
  referee_id: String,
  referral_type: String, // user, merchant, creator, community
  referral_code: String,
  quality_score: Number,
  ltv_prediction: Number,
  network_depth: Number, // 1st, 2nd, 3rd degree
  reward_earned: Number,
  reward_paid: { type: Boolean, default: false },
  status: String, // pending, activated, converted
  activated_at: Date,
  created_at: { type: Date, default: Date.now }
}));

const ReferralCode = mongoose.model('ReferralCode', new mongoose.Schema({
  code: String,
  user_id: String,
  referral_type: String,
  uses: { type: Number, default: 0 },
  max_uses: Number,
  active: { type: Boolean, default: true },
  created_at: { type: Date, default: Date.now }
}));

const Reward = mongoose.model('Reward', new mongoose.Schema({
  reward_id: String,
  user_id: String,
  referral_id: String,
  amount: Number,
  type: String, // cashback, tier_upgrade, commission
  source: String, // direct, network_bonus, lifetime
  paid: { type: Boolean, default: false },
  created_at: { type: Date, default: Date.now },
  paid_at: Date
}));

// Generate referral code
function generateCode(type: string): string {
  const prefix = type.substring(0, 3).toUpperCase();
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `${prefix}${random}`;
}

// POST /api/referral/create-code
app.post('/api/referral/create-code', async (req, res) => {
  const { user_id, referral_type = 'user', max_uses = 10 } = req.body;

  const code = generateCode(referral_type);

  const referralCode = new ReferralCode({
    code,
    user_id,
    referral_type,
    max_uses
  });

  await referralCode.save();

  res.json({ success: true, code, referral_link: `https://rez.app/join/${code}` });
});

// POST /api/referral/invite
app.post('/api/referral/invite', async (req, res) => {
  const { referrer_id, referee_id, referral_type = 'user', referral_code } = req.body;

  // Check code validity
  const code = await ReferralCode.findOne({ code: referral_code, active: true });
  if (!code) {
    return res.status(400).json({ error: 'Invalid referral code' });
  }

  // Check if already referred
  const existing = await Referral.findOne({ referee_id });
  if (existing) {
    return res.status(400).json({ error: 'Already referred' });
  }

  // Create referral
  const referral = new Referral({
    referral_id: `REF-${Date.now()}`,
    referrer_id: code.user_id,
    referee_id,
    referral_type,
    referral_code,
    network_depth: 1,
    status: 'pending',
    quality_score: 0.5
  });

  await referral.save();

  // Increment code uses
  code.uses += 1;
  if (code.uses >= code.max_uses) {
    code.active = false;
  }
  await code.save();

  res.json({ success: true, referral_id: referral.referral_id });
});

// POST /api/referral/activate
app.post('/api/referral/activate', async (req, res) => {
  const { referral_id } = req.body;

  const referral = await Referral.findOne({ referral_id });
  if (!referral) {
    return res.status(404).json({ error: 'Referral not found' });
  }

  if (referral.status === 'activated') {
    return res.status(400).json({ error: 'Already activated' });
  }

  // Update referral
  referral.status = 'activated';
  referral.activated_at = new Date();
  await referral.save();

  // Get referrer rewards config
  const config = REFERRAL_CONFIG[referral.referral_type as keyof typeof REFERRAL_CONFIG] || REFERRAL_CONFIG.user;

  // Calculate reward
  const reward = config.base_reward;

  // Give referrer their reward
  try {
    await axios.post(`${WALLET_API}/api/earn`, {
      user_id: referral.referrer_id,
      amount: reward,
      source: 'referral_signup',
      reason: `Referral bonus for ${referral.referral_type}`
    });
  } catch (e) {}

  // Create reward record
  const rewardRecord = new Reward({
    reward_id: `RWD-${Date.now()}`,
    user_id: referral.referrer_id,
    referral_id,
    amount: reward,
    type: 'cashback',
    source: 'direct'
  });

  await rewardRecord.save();

  referral.reward_earned = reward;
  await referral.save();

  // Track to intelligence
  try {
    await axios.post(`${INTELLIGENCE_API}/api/intent/track`, {
      user_id: referral.referrer_id,
      intent_type: 'referral_activated',
      entities: { referral_type: referral.referral_type }
    });
  } catch (e) {}

  res.json({ success: true, reward_earned: reward });
});

// POST /api/referral/quality-score
app.post('/api/referral/quality-score', async (req, res) => {
  const { referee_id, behavior_data } = req.body;

  // Simple LTV prediction based on behavior
  let score = 0.5;

  if (behavior_data) {
    if (behavior_data.has_card) score += 0.1;
    if (behavior_data.has_wallet_funds) score += 0.1;
    if (behavior_data.completed_kyc) score += 0.1;
    if (behavior_data.orders_count > 5) score += 0.1;
    if (behavior_data.avg_order_value > 500) score += 0.1;
  }

  // Cap at 1.0
  score = Math.min(score, 1.0);

  res.json({ quality_score: score, ltv_prediction: score * 10000 });
});

// GET /api/referral/stats/:userId
app.get('/api/referral/stats/:userId', async (req, res) => {
  const userId = req.params.userId;

  const [referrals, rewards] = await Promise.all([
    Referral.find({ referrer_id: userId }),
    Reward.find({ user_id: userId })
  ]);

  const totalEarnings = rewards.reduce((sum, r) => sum + r.amount, 0);
  const pendingRewards = rewards.filter(r => !r.paid).reduce((sum, r) => sum + r.amount, 0);

  const network = {
    direct_referrals: referrals.filter(r => r.network_depth === 1).length,
    second_degree: referrals.filter(r => r.network_depth === 2).length,
    third_degree: referrals.filter(r => r.network_depth === 3).length
  };

  const qualityBreakdown = {
    high_quality: referrals.filter(r => r.quality_score >= 0.7).length,
    medium_quality: referrals.filter(r => r.quality_score >= 0.4 && r.quality_score < 0.7).length,
    low_quality: referrals.filter(r => r.quality_score < 0.4).length
  };

  res.json({
    total_referrals: referrals.length,
    activated: referrals.filter(r => r.status === 'activated').length,
    network,
    quality_breakdown: qualityBreakdown,
    total_earnings: totalEarnings,
    pending_rewards: pendingRewards,
    paid_out: totalEarnings - pendingRewards
  });
});

// GET /api/referral/earnings/:userId
app.get('/api/referral/earnings/:userId', async (req, res) => {
  const { limit = 20 } = req.query;

  const rewards = await Reward.find({ user_id: req.params.userId })
    .sort({ created_at: -1 })
    .limit(Number(limit));

  const total = await Reward.aggregate([
    { $match: { user_id: req.params.userId } },
    { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } }
  ]);

  res.json({
    rewards,
    total_earnings: total[0]?.total || 0,
    total_rewards: total[0]?.count || 0
  });
});

// GET /api/referral/network/:userId
app.get('/api/referral/network/:userId', async (req, res) => {
  const userId = req.params.userId;

  // Get all referrals
  const referrals = await Referral.find({ referrer_id: userId, status: 'activated' });

  // Build network graph
  const nodes = [{
    id: userId,
    type: 'referrer',
    referrals: referrals.length,
    quality_score: 0.9 // referrer is always high quality
  }];

  const edges = [];

  for (const ref of referrals) {
    nodes.push({
      id: ref.referee_id,
      type: ref.referral_type,
      referrals: 0,
      quality_score: ref.quality_score
    });

    edges.push({
      from: userId,
      to: ref.referee_id,
      depth: ref.network_depth
    });
  }

  res.json({ nodes, edges });
});

// GET /api/referral/leaderboard
app.get('/api/referral/leaderboard', async (req, res) => {
  const { limit = 10 } = req.query;

  const leaders = await Referral.aggregate([
    { $match: { status: 'activated' } },
    { $group: {
      _id: '$referrer_id',
      referrals: { $sum: 1 },
      earnings: { $sum: '$reward_earned' }
    }},
    { $sort: { referrals: -1 } },
    { $limit: Number(limit) }
  ]);

  res.json({ leaderboard: leaders });
});

export default app;
