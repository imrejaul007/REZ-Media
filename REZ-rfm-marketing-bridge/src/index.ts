/**
 * REZ RFM Marketing Bridge
 * Connects RFM service to marketing campaigns
 */

import express from 'express';
import axios from 'axios';

const app = express();
const PORT = parseInt(process.env.PORT || '4090', 10);

// Service URLs
const RFM_SERVICE_URL = process.env.RFM_SERVICE_URL || 'http://localhost:4055';
const MARKETING_SERVICE_URL = process.env.MARKETING_SERVICE_URL || 'http://localhost:4026';

app.use(express.json());

// Health
app.get('/health', (_req, res) => {
  res.json({ status: 'healthy', service: 'REZ-rfm-marketing-bridge' });
});

/**
 * Get segment-specific campaigns
 */
app.get('/api/campaigns/segment/:segment', async (req, res) => {
  try {
    const { segment } = req.params;
    // Get segment-specific offers
    const offers = {
      champions: ['VIP early access', 'Premium rewards'],
      loyal: ['Exclusive loyalty points', 'Double coins'],
      potential: ['Welcome bonus', 'First purchase discount'],
      at_risk: ['We miss you', 'Special comeback offer'],
      lost: ['Win-back campaign', 'Reactivation bonus'],
    };
    res.json({ success: true, data: offers[segment as keyof typeof offers] || [] });
  } catch (error) {
    res.status(500).json({ success: false });
  }
});

/**
 * Get user RFM for targeting
 */
app.get('/api/rfm/:userId', async (req, res) => {
  try {
    const response = await axios.get(`${RFM_SERVICE_URL}/api/rfm/${req.params.userId}`, {
      timeout: 3000,
    });
    res.json(response.data);
  } catch (error) {
    res.status(500).json({ success: false, error: 'RFM service unavailable' });
  }
});

app.listen(PORT, () => {
  console.log(`[${new Date().toISOString()}] RFM Marketing Bridge running on port ${PORT}`);
});
