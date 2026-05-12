/**
 * REZ Pricing Engine - Main Entry Point
 */

import express, { Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { pricingBrain, type BudgetAllocation } from './services/pricingBrain';
import { pricingEngine } from './services/pricingEngine';

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());

// Health check
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', service: 'REZ-pricing-engine' });
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

const PORT = process.env.PORT || 4008;
app.listen(PORT, () => {
  console.log(`REZ Pricing Engine running on port ${PORT}`);
});
