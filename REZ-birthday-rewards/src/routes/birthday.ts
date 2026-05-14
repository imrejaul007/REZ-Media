/**
 * Birthday Routes
 */

import { Router } from 'express';
import { birthdayService } from '../services/birthdayService';

const router = Router();

// Get birthday config
router.get('/config', async (req, res) => {
  const config = await birthdayService.getConfig(req.merchantId);
  res.json({ success: true, data: config });
});

// Update birthday offer
router.put('/config', async (req, res) => {
  const config = await birthdayService.updateConfig(req.merchantId, req.body);
  res.json({ success: true, data: config });
});

// Get birthday analytics
router.get('/analytics/:merchantId', async (req, res) => {
  const analytics = await birthdayService.getAnalytics(req.params.merchantId);
  res.json({ success: true, data: analytics });
});

// Manually trigger birthday check
router.post('/trigger', async (req, res) => {
  await birthdayService.triggerBirthdays();
  res.json({ success: true, message: 'Birthday check triggered' });
});

export { router };
