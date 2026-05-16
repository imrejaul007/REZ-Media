/**
 * REZ Anniversary Rewards - Entry Point
 * Merchant anniversary celebration and loyalty rewards
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';

const app = express();
const PORT = parseInt(process.env.PORT || '4035', 10);

app.use(helmet());
app.use(cors());
app.use(express.json());

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'healthy', service: 'rez-anniversary-rewards' });
});

// Get milestone rewards
app.get('/api/anniversary/milestones/:merchantId', async (req, res) => {
  const { merchantId } = req.params;

  res.json({
    success: true,
    data: [
      { years: 1, name: 'First Anniversary', reward: 100, bonus: 1.1, badge: 'year-1' },
      { years: 2, name: 'Second Anniversary', reward: 200, bonus: 1.2, badge: 'year-2' },
      { years: 3, name: 'Third Anniversary', reward: 300, bonus: 1.3, badge: 'year-3' },
      { years: 5, name: 'Fifth Anniversary', reward: 500, bonus: 1.5, badge: 'year-5' },
      { years: 10, name: 'Decade', reward: 1000, bonus: 2.0, badge: 'year-10' },
    ],
  });
});

// Check user anniversary status
app.get('/api/anniversary/user/:userId', async (req, res) => {
  const { userId } = req.params;

  res.json({
    success: true,
    data: {
      userId,
      daysUntilAnniversary: Math.floor(Math.random() * 365),
      totalAnniversaries: Math.floor(Math.random() * 5) + 1,
      pendingRewards: Math.floor(Math.random() * 3),
      nextReward: {
        milestone: 'Third Anniversary',
        daysRemaining: Math.floor(Math.random() * 365),
        reward: { coins: 300, badge: 'year-3' },
      },
    },
  });
});

// Trigger anniversary celebration
app.post('/api/anniversary/celebrate', async (req, res) => {
  const { userId, merchantId, years } = req.body;

  res.json({
    success: true,
    data: {
      celebrationId: `celebration-${Date.now()}`,
      userId,
      merchantId,
      years,
      rewardClaimed: false,
      celebrationSent: true,
      message: `Congratulations on your ${years} year anniversary!`,
      expiresIn: 7 * 24 * 60 * 60 * 1000, // 7 days
    },
  });
});

// Redeem anniversary reward
app.post('/api/anniversary/redeem', async (req, res) => {
  const { userId, rewardId } = req.body;

  res.json({
    success: true,
    data: {
      redemptionId: `redeem-${Date.now()}`,
      userId,
      rewardId,
      status: 'success',
      coinsAwarded: 300,
      badgeAwarded: 'year-3',
      redeemedAt: new Date(),
    },
  });
});

// Merchant anniversary stats
app.get('/api/anniversary/merchant/:merchantId/stats', async (req, res) => {
  const { merchantId } = req.params;

  res.json({
    success: true,
    data: {
      merchantId,
      totalCustomers: 15420,
      anniversaryMilestones: {
        year1: { count: 5000, redemption: 85 },
        year2: { count: 3200, redemption: 78 },
        year3: { count: 1800, redemption: 72 },
        year5: { count: 500, redemption: 65 },
        year10: { count: 50, redemption: 90 },
      },
      totalCoinsDistributed: 1250000,
      avgEngagement: 82.5,
    },
  });
});

app.listen(PORT, () => {
  console.log(`[${new Date().toISOString()}] Anniversary Rewards running on port ${PORT}`);
});

export default app;
