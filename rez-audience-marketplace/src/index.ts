/**
 * REZ Audience Marketplace - Entry Point
 * Buy and sell audience segments
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import { AudienceMarketplaceService } from './services/AudienceMarketplaceService';

const app = express();
const PORT = parseInt(process.env.PORT || '4063', 10);

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: { success: false, error: 'Too many requests, please try again later' },
});
app.use('/api/', limiter);

// Initialize service
const marketplaceService = new AudienceMarketplaceService();

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'healthy', service: 'rez-audience-marketplace' });
});

// List segment for sale
app.post('/api/segments/list', async (req, res) => {
  try {
    const { segment, quantity } = req.body;
    const listing = await marketplaceService.listSegment(segment, quantity);
    res.json({ success: true, data: listing });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(400).json({ success: false, error: message });
  }
});

// Search segments
app.get('/api/segments/search', async (req, res) => {
  try {
    const { source, type, minSize, maxPrice } = req.query;
    const listings = await marketplaceService.searchSegments({
      source: source as any,
      type: type as any,
      minSize: minSize ? parseInt(minSize as string, 10) : undefined,
      maxPrice: maxPrice ? parseFloat(maxPrice as string) : undefined,
    });
    res.json({ success: true, data: listings });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(400).json({ success: false, error: message });
  }
});

// Match segment with advertiser audience
app.post('/api/segments/:id/match', async (req, res) => {
  try {
    const { id } = req.params;
    const { advertiserAudience } = req.body;
    const match = await marketplaceService.matchSegment(id, advertiserAudience);
    res.json({ success: true, data: match });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(400).json({ success: false, error: message });
  }
});

// Purchase segment
app.post('/api/segments/:id/purchase', async (req, res) => {
  try {
    const { id } = req.params;
    const { advertiserId, quantity } = req.body;
    const purchase = await marketplaceService.purchaseSegment(id, advertiserId, quantity);
    res.json({ success: true, data: purchase });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(400).json({ success: false, error: message });
  }
});

// Get segment insights
app.get('/api/segments/:id/insights', async (req, res) => {
  try {
    const { id } = req.params;
    const insights = await marketplaceService.getInsights(id);
    res.json({ success: true, data: insights });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(400).json({ success: false, error: message });
  }
});

// Create lookalike segment
app.post('/api/segments/:id/lookalike', async (req, res) => {
  try {
    const { id } = req.params;
    const { similarity } = req.body;
    const lookalike = await marketplaceService.createLookalike(id, similarity);
    res.json({ success: true, data: lookalike });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(400).json({ success: false, error: message });
  }
});

// Error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Error:', err);
  res.status(500).json({ success: false, error: 'Internal server error' });
});

// Start server
app.listen(PORT, () => {
  console.log(`[${new Date().toISOString()}] Audience Marketplace service running on port ${PORT}`);
});

export default app;
