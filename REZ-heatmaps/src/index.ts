/**
 * REZ Heatmaps - Entry Point
 * User behavior heatmaps and analytics
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';

const app = express();
const PORT = parseInt(process.env.PORT || '4074', 10);

app.use(helmet());
app.use(cors());
app.use(express.json());

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'healthy', service: 'rez-heatmaps' });
});

// Get heatmap data
app.get('/api/heatmaps/:websiteId', async (req, res) => {
  const { websiteId } = req.params;

  res.json({
    success: true,
    data: {
      websiteId,
      clicks: generateMockData('click', 50),
      scrolls: generateMockData('scroll', 30),
      movements: generateMockData('movement', 20),
      timestamps: { start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), end: new Date() },
    },
  });
});

// Get click heatmap
app.get('/api/heatmaps/:websiteId/clicks', async (req, res) => {
  const { websiteId } = req.params;
  const { start, end } = req.query;

  res.json({
    success: true,
    data: {
      websiteId,
      type: 'click',
      hotspots: [
        { x: 50, y: 30, intensity: 0.95, count: 1520 },
        { x: 70, y: 45, intensity: 0.85, count: 1250 },
        { x: 30, y: 60, intensity: 0.75, count: 980 },
        { x: 85, y: 20, intensity: 0.65, count: 720 },
        { x: 15, y: 80, intensity: 0.55, count: 450 },
      ],
    },
  });
});

// Get scroll heatmap
app.get('/api/heatmaps/:websiteId/scrolls', async (req, res) => {
  const { websiteId } = req.params;

  res.json({
    success: true,
    data: {
      websiteId,
      type: 'scroll',
      engagement: {
        topOfPage: 100,
        middleOfPage: 65,
        bottomOfPage: 35,
        avgTimeOnPage: 125, // seconds
        scrollDepth: 72, // percent
      },
    },
  });
});

// Get movement tracking
app.get('/api/heatmaps/:websiteId/movements', async (req, res) => {
  const { websiteId } = req.params;

  res.json({
    success: true,
    data: {
      websiteId,
      type: 'movement',
      cursorHeatmap: [
        { x: 50, y: 35, time: 2500 },
        { x: 65, y: 40, time: 1800 },
        { x: 40, y: 55, time: 1200 },
      ],
      avgHesitationTime: 3.2, // seconds
    },
  });
});

// Get session recordings
app.get('/api/heatmaps/:websiteId/sessions', async (req, res) => {
  const { websiteId } = req.params;
  const { limit = 10 } = req.query;

  res.json({
    success: true,
    data: {
      websiteId,
      sessions: Array.from({ length: parseInt(limit as string) }, (_, i) => ({
        sessionId: `session-${i}`,
        userId: `user-${Math.floor(Math.random() * 1000)}`,
        duration: Math.floor(Math.random() * 300) + 60,
        pages: Math.floor(Math.random() * 5) + 1,
        clicks: Math.floor(Math.random() * 20) + 5,
        scrollDepth: Math.floor(Math.random() * 100),
        converted: Math.random() > 0.7,
      })),
    },
  });
});

// Track event
app.post('/api/track', async (req, res) => {
  const { websiteId, event, data } = req.body;

  res.json({
    success: true,
    data: { tracked: true, eventId: `event-${Date.now()}` },
  });
});

// Analytics summary
app.get('/api/heatmaps/:websiteId/analytics', async (req, res) => {
  const { websiteId } = req.params;

  res.json({
    success: true,
    data: {
      websiteId,
      summary: {
        totalVisitors: 15420,
        avgSessionDuration: 185,
        avgScrollDepth: 68,
        clickRate: 12.5,
        bounceRate: 42.3,
        topPages: [
          { path: '/home', visitors: 8500 },
          { path: '/products', visitors: 6200 },
          { path: '/checkout', visitors: 2800 },
        ],
      },
    },
  });
});

// Helper function
function generateMockData(type: string, count: number) {
  return Array.from({ length: count }, (_, i) => ({
    x: Math.random() * 100,
    y: Math.random() * 100,
    time: Math.floor(Math.random() * 10000),
    timestamp: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000),
  }));
}

app.listen(PORT, () => {
  console.log(`[${new Date().toISOString()}] Heatmaps running on port ${PORT}`);
});

export default app;
