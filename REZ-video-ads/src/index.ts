/**
 * REZ Video Ads - Entry Point
 * Video ad serving with VAST/VPAID support
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import mongoose from 'mongoose';
import { rateLimit } from 'express-rate-limit';
import { v4 as uuidv4 } from 'uuid';

const app = express();
const PORT = parseInt(process.env.PORT || '4067', 10);
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/video-ads';

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

// Video Ad Schema
const videoAdSchema = new mongoose.Schema({
  adId: { type: String, required: true, unique: true },
  advertiserId: { type: String, required: true },
  name: { type: String, required: true },
  videoUrl: { type: String, required: true },
  duration: { type: Number, required: true }, // seconds
  skipOffset: { type: Number, default: 5 },
  vastXml: String,
  clickUrl: String,
  trackingUrls: {
    start: String,
    firstQuartile: String,
    midpoint: String,
    thirdQuartile: String,
    complete: String,
    skip: String,
    click: String,
  },
  format: { type: String, enum: ['preroll', 'midroll', 'postroll'], required: true },
  status: { type: String, enum: ['active', 'paused', 'completed'], default: 'active' },
  createdAt: { type: Date, default: Date.now },
});

const VideoAd = mongoose.model('VideoAd', videoAdSchema);

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'healthy', service: 'rez-video-ads' });
});

// Create video ad
app.post('/api/ads', async (req, res) => {
  try {
    const adId = `vidad-${uuidv4().slice(0, 8)}`;
    const ad = new VideoAd({ adId, ...req.body });
    await ad.save();
    res.status(201).json({ success: true, data: ad });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(400).json({ success: false, error: message });
  }
});

// Get video ad
app.get('/api/ads/:id', async (req, res) => {
  try {
    const ad = await VideoAd.findOne({ adId: req.params.id });
    if (!ad) {
      res.status(404).json({ success: false, error: 'Ad not found' });
      return;
    }
    res.json({ success: true, data: ad });
  } catch (error) {
    res.status(400).json({ success: false });
  }
});

// Generate VAST XML
app.get('/api/ads/:id/vast', async (req, res) => {
  try {
    const ad = await VideoAd.findOne({ adId: req.params.id });
    if (!ad) {
      res.status(404).json({ success: false, error: 'Ad not found' });
      return;
    }

    const vastXml = `<?xml version="1.0" encoding="UTF-8"?>
<VAST version="4.2" xmlns="http://www.iab.com/vaast">
  <Ad id="${ad.adId}">
    <InLine>
      <AdSystem version="4.2">ReZ Video Ads</AdSystem>
      <AdTitle>${ad.name}</AdTitle>
      <Creatives>
        <Creative>
          <Linear skipoffset="${ad.skipOffset}s">
            <Duration>${ad.duration}</Duration>
            <VideoClicks>
              <ClickThrough><![CDATA[${ad.clickUrl}]]></ClickThrough>
            </VideoClicks>
            <TrackingEvents>
              <Tracking event="start">${ad.trackingUrls?.start || ''}</Tracking>
              <Tracking event="firstQuartile">${ad.trackingUrls?.firstQuartile || ''}</Tracking>
              <Tracking event="midpoint">${ad.trackingUrls?.midpoint || ''}</Tracking>
              <Tracking event="thirdQuartile">${ad.trackingUrls?.thirdQuartile || ''}</Tracking>
              <Tracking event="complete">${ad.trackingUrls?.complete || ''}</Tracking>
              <Tracking event="skip">${ad.trackingUrls?.skip || ''}</Tracking>
            </TrackingEvents>
            <MediaFiles>
              <MediaFile type="video/mp4" delivery="progressive">${ad.videoUrl}</MediaFile>
            </MediaFiles>
          </Linear>
        </Creative>
      </Creatives>
    </InLine>
  </Ad>
</VAST>`;

    res.set('Content-Type', 'application/xml');
    res.send(vastXml);
  } catch (error) {
    res.status(400).json({ success: false });
  }
});

// Track event
app.post('/api/ads/:id/track', async (req, res) => {
  try {
    const { event } = req.body;
    console.log(`[${event}] Ad: ${req.params.id}`);
    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ success: false });
  }
});

// List ads
app.get('/api/ads', async (req, res) => {
  try {
    const { format, status } = req.query;
    const query: Record<string, unknown> = {};
    if (format) query.format = format;
    if (status) query.status = status;

    const ads = await VideoAd.find(query).sort({ createdAt: -1 });
    res.json({ success: true, data: ads });
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
      console.log(`[${new Date().toISOString()}] Video Ads running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Startup error:', error);
    process.exit(1);
  }
}

start();

export default app;
