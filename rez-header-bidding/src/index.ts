/**
 * REZ Header Bidding - Entry Point
 * Prebid.js integration and SSP waterfall
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import { HeaderBiddingService } from './services/HeaderBiddingService';

const app = express();
const PORT = parseInt(process.env.PORT || '4065', 10);

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { success: false, error: 'Too many requests, please try again later' },
});
app.use('/api/', limiter);

// Initialize service
const headerBiddingService = new HeaderBiddingService();

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'healthy', service: 'rez-header-bidding' });
});

// Run auction
app.post('/api/auction', async (req, res) => {
  try {
    const result = await headerBiddingService.runAuction(req.body);
    res.json({ success: true, data: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(400).json({ success: false, error: message });
  }
});

// Get Prebid config
app.get('/api/prebid/config', (_req, res) => {
  try {
    const config = headerBiddingService.generatePrebidConfig();
    res.json({ success: true, data: config });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(400).json({ success: false, error: message });
  }
});

// Generate targeting
app.post('/api/targeting', async (req, res) => {
  try {
    const { bids } = req.body;
    const targeting = headerBiddingService.generateTargeting(bids);
    res.json({ success: true, data: targeting });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(400).json({ success: false, error: message });
  }
});

// Register bidder
app.post('/api/bidders', (req, res) => {
  try {
    headerBiddingService.registerBidder(req.body);
    res.json({ success: true, message: 'Bidder registered' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(400).json({ success: false, error: message });
  }
});

// List bidders
app.get('/api/bidders', (_req, res) => {
  // Return bidder list from service
  res.json({ success: true, data: [] });
});

// Error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Error:', err);
  res.status(500).json({ success: false, error: 'Internal server error' });
});

// Start server
app.listen(PORT, () => {
  console.log(`[${new Date().toISOString()}] Header Bidding service running on port ${PORT}`);
});

export default app;
