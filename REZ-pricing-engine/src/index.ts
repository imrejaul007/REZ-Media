/**
 * REZ Pricing Engine - Main Entry Point
 */

import express, { Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { pricingBrain, type BudgetAllocation } from './services/pricingBrain';
import { pricingEngine } from './services/pricingEngine';
import { metricsMiddleware, getMetrics, getMetricsContentType } from './middleware/metrics';
import { requestLogger, errorHandler, notFoundHandler } from './middleware/logger';

const app = express();

// Security middleware
app.use(helmet());
app.use(cors());

// Body parsing
app.use(express.json());

// Request logging (must be early to log all requests)
app.use(requestLogger());

// Metrics collection
app.use(metricsMiddleware);

// Health check
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', service: 'REZ-pricing-engine' });
});

// Prometheus metrics endpoint
app.get('/metrics', async (req: Request, res: Response) => {
  try {
    const metrics = await getMetrics();
    res.set('Content-Type', getMetricsContentType());
    res.send(metrics);
  } catch (error) {
    res.status(500).send('Error collecting metrics');
  }
});

// ============================================================================
// PRICING ENDPOINTS
// ============================================================================

/**
 * POST /api/price - Calculate dynamic price
 */
app.post('/api/price', async (req: Request, res: Response) => {
  try {
    const result = await pricingBrain.calculatePrice(req.body);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

/**
 * POST /api/price/legacy - Legacy pricing engine
 */
app.post('/api/price/legacy', async (req: Request, res: Response) => {
  try {
    const result = await pricingEngine.calculatePrice(req.body);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

/**
 * POST /api/price/liquidation - Calculate liquidation price for unsold inventory
 */
app.post('/api/price/liquidation', async (req: Request, res: Response) => {
  try {
    const { originalPrice, hoursUntilSlot, percentSold } = req.body;
    const price = await pricingBrain.calculateLiquidationPrice(originalPrice, hoursUntilSlot, percentSold);
    const discount = ((originalPrice - price) / originalPrice * 100).toFixed(1);
    res.json({
      success: true,
      data: {
        originalPrice,
        liquidationPrice: Math.round(price * 100) / 100,
        discountPercent: discount,
        reason: discount > 30 ? 'Last-minute unsold inventory' : 'Below target sell-through',
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

/**
 * POST /api/price/allocate - Smart budget allocation
 */
app.post('/api/price/allocate', async (req: Request, res: Response) => {
  try {
    const { totalBudget, goal, location } = req.body;
    const allocations = await pricingBrain.allocateBudget(totalBudget, goal, location);
    res.json({ success: true, data: { allocations } });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

/**
 * POST /api/price/validate - Validate minimum spend
 */
app.post('/api/price/validate', async (req: Request, res: Response) => {
  try {
    const { adType, budget } = req.body;
    const validation = pricingBrain.validateMinimumSpend(adType, budget);
    res.json({ success: true, data: validation });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

/**
 * GET /api/price/caps - Get price caps
 */
app.get('/api/price/caps', (req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      maxSurgeCaps: {
        banner: '5x',
        feed: '4x',
        search: '6x',
        store: '5x',
        push: '4x',
        whatsapp: '3x',
        email: '2x',
        dooh: '8x',
        offline: '4x',
        qr: '5x',
      },
      minimumSpend: {
        banner: '₹500',
        feed: '₹500',
        search: '₹500',
        store: '₹500',
        push: '₹300',
        whatsapp: '₹1,000',
        email: '₹300',
        dooh: '₹3,000',
        offline: '₹5,000',
        qr: '₹500',
      },
    },
  });
});

// ============================================================================
// UNIFIED CAMPAIGN ENDPOINTS
// ============================================================================

/**
 * POST /api/campaigns/unified - Create unified campaign with wallet reservation
 */
app.post('/api/campaigns/unified', async (req: Request, res: Response) => {
  try {
    const { merchantId, types, channels, budget, duration, location, targeting, name } = req.body;

    // Validate budget against minimums
    const validation = pricingBrain.validateMinimumSpend(types[0] as any, budget);
    if (!validation.valid) {
      return res.status(400).json({ success: false, error: validation.message });
    }

    // Calculate pricing for each channel
    const channelPricing = [];
    let totalEstimate = 0;

    for (const type of types) {
      const pricing = await pricingBrain.calculatePrice({
        adType: type,
        placement: type,
        location: { city: location, tier: 'tier1' },
        targetAudience: { segment: targeting },
        goalType: 'conversions',
        budget,
        campaignMode: 'auction',
      });

      totalEstimate += pricing.finalPrice * duration;

      channelPricing.push({
        type,
        estimatedPrice: pricing.finalPrice,
        unit: pricing.unit,
        reach: pricing.estimatedResults.reach,
      });
    }

    // Create reservation (would call wallet service)
    const reservationId = `res_${Date.now()}`;

    res.json({
      success: true,
      data: {
        campaignId: `camp_${Date.now()}`,
        reservationId,
        totalEstimate: Math.round(totalEstimate),
        walletRequired: Math.round(totalEstimate * 1.2), // 20% buffer
        channelPricing,
        message: 'Funds reserved from merchant wallet',
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

/**
 * GET /api/campaigns/:id/status - Get campaign status with wallet usage
 */
app.get('/api/campaigns/:id/status', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Mock data - would query actual campaign
    res.json({
      success: true,
      data: {
        id,
        status: 'active',
        subCampaigns: [
          { type: 'in-app', status: 'active', spent: 2500 },
          { type: 'dooh', status: 'active', spent: 8000 },
        ],
        walletUsage: {
          reserved: 15000,
          spent: 10500,
          remaining: 4500,
        },
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

/**
 * POST /api/campaigns/:id/pause - Pause campaign
 */
app.post('/api/campaigns/:id/pause', async (req: Request, res: Response) => {
  res.json({ success: true, data: { id: req.params.id, status: 'paused' } });
});

/**
 * POST /api/campaigns/:id/resume - Resume campaign
 */
app.post('/api/campaigns/:id/resume', async (req: Request, res: Response) => {
  res.json({ success: true, data: { id: req.params.id, status: 'active' } });
});

/**
 * POST /api/campaigns/:id/cancel - Cancel campaign and release reservation
 */
app.post('/api/campaigns/:id/cancel', async (req: Request, res: Response) => {
  try {
    // Would release wallet reservation
    res.json({
      success: true,
      data: {
        id: req.params.id,
        status: 'cancelled',
        refundedAmount: 4500, // Unused portion
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

// ============================================================================
// EXAMPLE REQUEST/RESPONSE
// ============================================================================

/**
 * Example request:
 * POST /api/price
 * {
 *   "adType": "dooh",
 *   "placement": "mall_led_screen",
 *   "location": { "city": "Mumbai", "tier": "tier1" },
 *   "targetAudience": { "segment": "young_professionals", "income": "high" },
 *   "scheduledTime": { "start": "2026-05-15T20:00:00Z", "end": "2026-05-15T22:00:00Z" },
 *   "budget": 50000,
 *   "goalType": "footfall",
 *   "vendorMinimumPrice": 800,
 *   "campaignMode": "auction",
 *   "performanceTier": "premium"
 * }
 */

// Error handlers (must be after all routes)
app.use(notFoundHandler);
app.use(errorHandler);

const PORT = process.env.PORT || 4008;
app.listen(PORT, () => {
  console.log(`REZ Pricing Engine running on port ${PORT}`);
  console.log(`Metrics available at http://localhost:${PORT}/metrics`);
});
