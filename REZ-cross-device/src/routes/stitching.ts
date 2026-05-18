/**
 * Cross-Device Routes
 */

import { Router, Request, Response } from 'express';
import { crossDeviceStitching } from '../services/deviceStitching.js';

const router = Router();

/**
 * POST /api/fingerprint
 * Generate and register device fingerprint
 */
router.post('/api/fingerprint', (req, res) => {
  const { sessionId, merchantId, ipAddress, userAgent, ...fingerprintData } = req.body;

  if (!sessionId || !merchantId) {
    return res.status(400).json({ success: false, error: 'sessionId and merchantId required' });
  }

  const fingerprint = crossDeviceStitching.generateFingerprint({
    userAgent: fingerprintData.userAgent || userAgent || '',
    language: fingerprintData.language || 'en',
    platform: fingerprintData.platform || 'unknown',
    screenWidth: fingerprintData.screenWidth || 0,
    screenHeight: fingerprintData.screenHeight || 0,
    colorDepth: fingerprintData.colorDepth || 24,
    timezone: fingerprintData.timezone || 'UTC',
    canvas: fingerprintData.canvas,
    webgl: fingerprintData.webgl,
  });

  const device = crossDeviceStitching.registerDevice({
    sessionId,
    merchantId,
    fingerprint,
    ipAddress: ipAddress || req.ip,
    userAgent: userAgent || req.headers['user-agent'],
  });

  res.json({ success: true, data: { deviceId: device.deviceId, fingerprint } });
});

/**
 * POST /api/link
 * Link two devices
 */
router.post('/api/link', (req, res) => {
  const { sourceDeviceId, targetDeviceId, type, confidence } = req.body;

  if (!sourceDeviceId || !targetDeviceId) {
    return res.status(400).json({ success: false, error: 'Device IDs required' });
  }

  const link = crossDeviceStitching.linkDevices({
    sourceDeviceId,
    targetDeviceId,
    type: type || 'explicit',
    confidence: confidence || 1.0,
  });

  res.json({ success: true, data: link });
});

/**
 * GET /api/resolve/:deviceId
 * Resolve device to master user
 */
router.get('/api/resolve/:deviceId', (req, res) => {
  const result = crossDeviceStitching.resolveToMaster(req.params.deviceId);
  res.json({ success: true, data: result });
});

/**
 * GET /api/matches/:deviceId
 * Find probable matches
 */
router.get('/api/matches/:deviceId', (req, res) => {
  const threshold = parseFloat(req.query.threshold as string) || 0.7;
  const matches = crossDeviceStitching.findProbableMatches(req.params.deviceId, threshold);
  res.json({ success: true, data: matches });
});

/**
 * POST /api/event
 * Track journey event
 */
router.post('/api/event', (req, res) => {
  const { deviceId, sessionId, userId, eventType, url, metadata } = req.body;

  if (!sessionId || !eventType) {
    return res.status(400).json({ success: false, error: 'sessionId and eventType required' });
  }

  const event = crossDeviceStitching.trackEvent({
    deviceId,
    sessionId,
    userId,
    eventType,
    timestamp: new Date(),
    url,
    metadata,
  });

  res.json({ success: true, data: event });
});

/**
 * GET /api/journey/:userId
 * Get user journey
 */
router.get('/api/journey/:userId', (req, res) => {
  const journey = crossDeviceStitching.getUserJourney(req.params.userId);
  res.json({ success: true, data: journey });
});

export default router;
