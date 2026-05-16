/**
 * REZ Birthday Rewards - Entry Point
 * Automated birthday rewards and celebration campaigns
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';

const app = express();
const PORT = parseInt(process.env.PORT || '4073', 10);

app.use(helmet());
app.use(cors());
app.use(express.json());

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'healthy', service: 'rez-birthday-rewards' });
});

// Check eligibility
app.get('/api/birthday/eligibility/:userId', async (req, res) => {
  const { userId } = req.params;

  // Mock eligibility check
  const daysUntilBirthday = Math.floor(Math.random() * 365);
  const eligible = daysUntilBirthday <= 7;

  res.json({
    success: true,
    data: {
      eligible,
      userId,
      daysUntilBirthday,
      reward: eligible ? {
        coins: 100,
        discount: 10,
        voucher: 'BIRTHDAY10',
      } : null,
    },
  });
});

// Get birthday campaign
app.get('/api/birthday/campaign', async (req, res) => {
  res.json({
    success: true,
    data: {
      campaignId: 'bday-2026',
      name: 'Birthday Special',
      validDays: 7,
      rewardTypes: ['coins', 'discount', 'voucher', 'freebie'],
      terms: 'Valid 7 days before and after birthday',
    },
  });
});

// Trigger birthday message
app.post('/api/birthday/notify', async (req, res) => {
  const { userId, channel } = req.body;

  res.json({
    success: true,
    data: {
      notificationId: `notif-${Date.now()}`,
      userId,
      channel: channel || 'whatsapp',
      sent: true,
      sentAt: new Date(),
    },
  });
});

// Track birthday reward redemption
app.post('/api/birthday/redeem', async (req, res) => {
  const { userId, rewardType } = req.body;

  res.json({
    success: true,
    data: {
      redemptionId: `redeem-${Date.now()}`,
      userId,
      rewardType,
      redeemedAt: new Date(),
      status: 'success',
    },
  });
});

// Analytics
app.get('/api/birthday/stats', async (_req, res) => {
  res.json({
    success: true,
    data: {
      totalRewards: 15420,
      redeemedRewards: 12850,
      activeCampaigns: 3,
      avgEngagement: 87.5,
      topRewards: [
        { type: 'coins', count: 8500 },
        { type: 'discount', count: 3200 },
        { type: 'voucher', count: 1150 },
      ],
    },
  });
});

app.listen(PORT, () => {
  console.log(`[${new Date().toISOString()}] Birthday Rewards running on port ${PORT}`);
});

export default app;
