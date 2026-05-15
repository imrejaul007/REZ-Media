/**
 * REZ Ad Exchange - Entry Point
 * Programmatic ad exchange platform
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import mongoose from 'mongoose';
import { rateLimit } from 'express-rate-limit';
import { v4 as uuidv4 } from 'uuid';
import {
  publisherService,
  advertiserService,
  auctionService,
  dealService,
} from './services';

const app = express();
const PORT = parseInt(process.env.PORT || '4060', 10);
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/ad-exchange';

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  message: { success: false, error: 'Too many requests' },
});
app.use('/api/', limiter);

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'healthy', service: 'rez-ad-exchange' });
});

// ============ Publisher Routes ============

// Register publisher
app.post('/api/publishers', async (req, res) => {
  try {
    const publisher = await publisherService.registerPublisher(req.body);
    res.status(201).json({ success: true, data: publisher });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(400).json({ success: false, error: message });
  }
});

// Get publisher by domain
app.get('/api/publishers/lookup', async (req, res) => {
  try {
    const domain = req.query.domain as string;
    const publisher = await publisherService.getByDomain(domain);
    if (!publisher) {
      res.status(404).json({ success: false, error: 'Publisher not found' });
      return;
    }
    res.json({ success: true, data: publisher });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(400).json({ success: false, error: message });
  }
});

// Add inventory
app.post('/api/publishers/:id/inventory', async (req, res) => {
  try {
    await publisherService.addInventory(req.params.id, req.body);
    res.json({ success: true, message: 'Inventory added' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(400).json({ success: false, error: message });
  }
});

// ============ Advertiser Routes ============

// Register advertiser
app.post('/api/advertisers', async (req, res) => {
  try {
    const advertiser = await advertiserService.registerAdvertiser(req.body);
    res.status(201).json({ success: true, data: advertiser });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(400).json({ success: false, error: message });
  }
});

// Add budget
app.post('/api/advertisers/:id/budgets', async (req, res) => {
  try {
    await advertiserService.addBudget(req.params.id, req.body);
    res.json({ success: true, message: 'Budget added' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(400).json({ success: false, error: message });
  }
});

// ============ Bid Request Routes ============

// OpenRTB-style bid endpoint
app.post('/api/bid', async (req, res) => {
  try {
    const bidRequest = {
      requestId: uuidv4(),
      timestamp: new Date(),
      publisher: req.body.publisher,
      inventory: req.body.inventory,
      user: req.body.user,
      viewability: req.body.viewability || { measurable: true, visible: true },
      floorPrice: req.body.floorPrice || 0.5,
    };

    const response = await auctionService.processBidRequest(bidRequest);
    res.json(response);
  } catch (error) {
    console.error('Bid error:', error);
    res.status(500).json({ error: 'Bid processing failed' });
  }
});

// Record impression
app.post('/api/events/impression', async (req, res) => {
  try {
    const { campaignId } = req.body;
    await auctionService.recordImpression(campaignId);
    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ success: false });
  }
});

// Record click
app.post('/api/events/click', async (req, res) => {
  try {
    const { campaignId } = req.body;
    await auctionService.recordClick(campaignId);
    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ success: false });
  }
});

// ============ Deal Routes ============

// Create deal
app.post('/api/deals', async (req, res) => {
  try {
    const deal = await dealService.createDeal(req.body);
    res.status(201).json({ success: true, data: deal });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(400).json({ success: false, error: message });
  }
});

// Get publisher deals
app.get('/api/publishers/:id/deals', async (req, res) => {
  try {
    const deals = await dealService.getPublisherDeals(req.params.id);
    res.json({ success: true, data: deals });
  } catch (error) {
    res.status(400).json({ success: false });
  }
});

// Get advertiser deals
app.get('/api/advertisers/:id/deals', async (req, res) => {
  try {
    const deals = await dealService.getAdvertiserDeals(req.params.id);
    res.json({ success: true, data: deals });
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
      console.log(`[${new Date().toISOString()}] Ad Exchange running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Startup error:', error);
    process.exit(1);
  }
}

start();

export default app;
