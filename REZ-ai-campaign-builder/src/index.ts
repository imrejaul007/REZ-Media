/**
 * REZ AI Campaign Builder - Main Entry Point
 * AI-powered campaign generation from natural language
 */

import express, { Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { aiGenerator } from './services/aiGenerator';

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());

// Health check
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', service: 'REZ-ai-campaign-builder' });
});

/**
 * POST /api/generate
 * Generate campaign from natural language goal
 */
app.post('/api/generate', async (req: Request, res: Response) => {
  try {
    const { goal, merchantType, location, budget, preferChannels } = req.body;

    if (!goal) {
      return res.status(400).json({ success: false, error: 'Goal is required' });
    }

    const campaign = await aiGenerator.generateCampaign(goal, {
      merchantType,
      location,
      budget,
      preferChannels,
    });

    res.json({ success: true, data: campaign });
  } catch (error) {
    console.error('Campaign generation error:', error);
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

/**
 * POST /api/generate-creative
 * Generate ad creative copy
 */
app.post('/api/generate-creative', async (req: Request, res: Response) => {
  try {
    const { goal, merchantType, product } = req.body;

    if (!goal || !merchantType) {
      return res.status(400).json({ success: false, error: 'Goal and merchantType required' });
    }

    const creative = await aiGenerator.generateCampaign(goal, {
      merchantType,
    });

    res.json({
      success: true,
      data: {
        headline: creative.creative.headline,
        body: creative.creative.body,
        cta: creative.creative.cta,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

/**
 * GET /api/recommendations
 * Get channel recommendations
 */
app.get('/api/recommendations', async (req: Request, res: Response) => {
  try {
    const { goal, budget } = req.query;

    if (!goal) {
      return res.status(400).json({ success: false, error: 'Goal is required' });
    }

    const campaign = await aiGenerator.generateCampaign(goal as string, {
      budget: budget ? parseInt(budget as string) : undefined,
    });

    res.json({
      success: true,
      data: {
        channels: campaign.channels,
        budget: campaign.budget,
        estimated: campaign.estimated,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

/**
 * POST /api/optimize
 * Optimize existing campaign
 */
app.post('/api/optimize', async (req: Request, res: Response) => {
  try {
    const { campaignId, currentMetrics } = req.body;

    // AI would analyze metrics and suggest optimizations
    const optimizations = [
      'Increase budget during peak hours',
      'Add WhatsApp channel for better engagement',
      'Target office areas for lunch traffic',
      'Use urgency messaging for better CTR',
    ];

    res.json({
      success: true,
      data: {
        campaignId,
        suggestions: optimizations,
        potentialLift: '15-25% improvement expected',
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

/**
 * GET /api/templates
 * Get campaign templates by type
 */
app.get('/api/templates', async (req: Request, res: Response) => {
  const templates = {
    restaurant: [
      { name: 'Lunch Rush', goal: 'Get more lunch customers' },
      { name: 'Dinner Special', goal: 'Boost dinner orders' },
      { name: 'Weekend Brunch', goal: 'Drive weekend traffic' },
    ],
    hotel: [
      { name: 'Staycation Deal', goal: 'Promote staycations' },
      { name: 'Weekend Getaway', goal: 'Drive weekend bookings' },
    ],
    retail: [
      { name: 'Flash Sale', goal: 'Drive footfall with discounts' },
      { name: 'New Arrivals', goal: 'Announce new products' },
    ],
    fitness: [
      { name: 'New Year Fitness', goal: 'Get gym signups' },
      { name: 'Summer Shape', goal: 'Promote summer membership' },
    ],
  };

  const type = req.query.type as string;
  res.json({
    success: true,
    data: type ? templates[type] || [] : templates,
  });
});

const PORT = process.env.PORT || 4009;
app.listen(PORT, () => {
  console.log(`REZ AI Campaign Builder running on port ${PORT}`);
});
