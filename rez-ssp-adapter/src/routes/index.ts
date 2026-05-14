import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { bidService } from '../services/bidService.js';
import { connectionService } from '../services/connectionService.js';
import { BidRequestSchema, SSPProviderSchema, ConnectionConfigSchema } from '../types/index.js';

const router = Router();

// Validation schemas
const CreateConnectionSchema = z.object({
  provider: SSPProviderSchema,
  enabled: z.boolean().default(true),
  apiKey: z.string().min(1),
  apiSecret: z.string().optional(),
  publisherId: z.string().optional(),
  advertiserId: z.string().optional(),
  endpoint: z.string().url().optional(),
  config: z.record(z.unknown()).optional(),
});

const BidSchema = z.object({
  provider: SSPProviderSchema,
  impression: z.object({
    id: z.string(),
    floor: z.number().positive(),
    currency: z.string().default('INR'),
    inventory: z.object({
      screenId: z.string(),
      location: z.string(),
      screenType: z.string(),
    }),
  }),
});

const AnalyticsQuerySchema = z.object({
  provider: SSPProviderSchema.optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});

// ============================================
// CONNECTION MANAGEMENT
// ============================================

/**
 * GET /api/connections
 * List all SSP connections
 */
router.get('/connections', async (_req: Request, res: Response) => {
  try {
    const connections = await connectionService.getConnections();
    res.json({ success: true, data: connections });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch connections' });
  }
});

/**
 * POST /api/connections
 * Connect to an SSP
 */
router.post('/connections', async (req: Request, res: Response) => {
  try {
    const parsed = CreateConnectionSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, error: parsed.error.errors });
      return;
    }

    await connectionService.connect(parsed.data);
    res.json({ success: true, message: `Connected to ${parsed.data.provider}` });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to connect' });
  }
});

/**
 * DELETE /api/connections/:provider
 * Disconnect from an SSP
 */
router.delete('/connections/:provider', async (req: Request, res: Response) => {
  try {
    const provider = req.params.provider as 'google_adx' | 'pubmatic' | 'index_exchange';
    await connectionService.disconnect(provider);
    res.json({ success: true, message: `Disconnected from ${provider}` });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to disconnect' });
  }
});

/**
 * POST /api/connections/:provider/test
 * Test SSP connection
 */
router.post('/connections/:provider/test', async (req: Request, res: Response) => {
  try {
    const provider = req.params.provider as 'google_adx' | 'pubmatic' | 'index_exchange';
    const result = await connectionService.testConnection(provider);
    res.json({ success: result.success, ...result });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Test failed' });
  }
});

// ============================================
// BIDDING
// ============================================

/**
 * POST /api/bid
 * Submit a bid request to SSP
 */
router.post('/bid', async (req: Request, res: Response) => {
  try {
    const parsed = BidSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, error: parsed.error.errors });
      return;
    }

    const bidRequest = {
      requestId: uuidv4(),
      provider: parsed.data.provider,
      timestamp: new Date(),
      impression: parsed.data.impression,
    };

    const response = await bidService.submitBid(bidRequest);
    res.json({ success: true, data: response });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Bid failed' });
  }
});

/**
 * POST /api/bid/batch
 * Submit multiple bid requests
 */
router.post('/bid/batch', async (req: Request, res: Response) => {
  try {
    const { requests } = req.body as { requests: unknown[] };
    if (!Array.isArray(requests)) {
      res.status(400).json({ success: false, error: 'requests must be an array' });
      return;
    }

    const bidRequests = requests.map((r: unknown) => {
      const parsed = BidSchema.safeParse(r);
      return {
        requestId: uuidv4(),
        provider: parsed.data?.provider,
        timestamp: new Date(),
        impression: parsed.data?.impression,
      };
    });

    const responses = await bidService.submitMultiBids(bidRequests);
    res.json({ success: true, data: responses });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Batch bid failed' });
  }
});

/**
 * POST /api/bid/:requestId/win
 * Log a bid win
 */
router.post('/bid/:requestId/win', async (req: Request, res: Response) => {
  try {
    const { requestId } = req.params;
    const { revenue } = req.body;

    await bidService.logWin(requestId, revenue);
    res.json({ success: true, message: 'Win logged' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to log win' });
  }
});

// ============================================
// ANALYTICS
// ============================================

/**
 * GET /api/analytics
 * Get bid analytics
 */
router.get('/analytics', async (req: Request, res: Response) => {
  try {
    const { provider, startDate, endDate } = req.query;

    const analytics = await bidService.getAnalytics(
      provider as 'google_adx' | 'pubmatic' | 'index_exchange' | undefined,
      startDate ? new Date(startDate as string) : undefined,
      endDate ? new Date(endDate as string) : undefined
    );

    res.json({ success: true, data: analytics });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch analytics' });
  }
});

export default router;
