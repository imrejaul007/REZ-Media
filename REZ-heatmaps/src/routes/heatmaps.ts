import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { heatmapService } from '../services/heatmapService';
import {
  ClickEventSchema,
  ScrollEventSchema,
  MovementEventSchema,
  PageViewSchema,
} from '../types/heatmap';

const router = Router();

// Validation middleware
const validate = (schema: z.ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      schema.parse(req.body);
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          error: 'Validation failed',
          details: error.errors,
        });
        return;
      }
      next(error);
    }
  };
};

// Tracking endpoints

/**
 * POST /api/track/click
 * Record a click event
 */
router.post('/track/click', validate(ClickEventSchema), async (req: Request, res: Response) => {
  try {
    await heatmapService.recordClick(req.body);
    res.status(204).send();
  } catch (error) {
    console.error('Failed to track click:', error);
    res.status(500).json({ error: 'Failed to record click' });
  }
});

/**
 * POST /api/track/scroll
 * Record scroll depth
 */
router.post('/track/scroll', validate(ScrollEventSchema), async (req: Request, res: Response) => {
  try {
    await heatmapService.recordScroll(req.body);
    res.status(204).send();
  } catch (error) {
    console.error('Failed to track scroll:', error);
    res.status(500).json({ error: 'Failed to record scroll' });
  }
});

/**
 * POST /api/track/movement
 * Record mouse movement
 */
router.post('/track/movement', validate(MovementEventSchema), async (req: Request, res: Response) => {
  try {
    await heatmapService.recordMovement(req.body);
    res.status(204).send();
  } catch (error) {
    console.error('Failed to track movement:', error);
    res.status(500).json({ error: 'Failed to record movement' });
  }
});

/**
 * POST /api/track/pageview
 * Record a page view
 */
router.post('/track/pageview', validate(PageViewSchema), async (req: Request, res: Response) => {
  try {
    await heatmapService.recordPageView(req.body);
    res.status(204).send();
  } catch (error) {
    console.error('Failed to track page view:', error);
    res.status(500).json({ error: 'Failed to record page view' });
  }
});

/**
 * POST /api/track/session/end
 * End a tracking session
 */
router.post('/track/session/end', async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.body;
    if (!sessionId) {
      res.status(400).json({ error: 'sessionId is required' });
      return;
    }
    await heatmapService.endSession(sessionId);
    res.status(204).send();
  } catch (error) {
    console.error('Failed to end session:', error);
    res.status(500).json({ error: 'Failed to end session' });
  }
});

// Batch tracking endpoint
const BatchEventSchema = z.object({
  clicks: z.array(ClickEventSchema).optional(),
  scrolls: z.array(ScrollEventSchema).optional(),
  movements: z.array(MovementEventSchema).optional(),
  pageviews: z.array(PageViewSchema).optional(),
});

router.post('/track/batch', validate(BatchEventSchema), async (req: Request, res: Response) => {
  try {
    const { clicks, scrolls, movements, pageviews } = req.body;

    const promises: Promise<void>[] = [];

    if (clicks) {
      clicks.forEach(click => promises.push(heatmapService.recordClick(click)));
    }
    if (scrolls) {
      scrolls.forEach(scroll => promises.push(heatmapService.recordScroll(scroll)));
    }
    if (movements) {
      movements.forEach(movement => promises.push(heatmapService.recordMovement(movement)));
    }
    if (pageviews) {
      pageviews.forEach(pageview => promises.push(heatmapService.recordPageView(pageview)));
    }

    await Promise.all(promises);
    res.status(204).send();
  } catch (error) {
    console.error('Failed to process batch:', error);
    res.status(500).json({ error: 'Failed to process batch' });
  }
});

// Analytics endpoints

/**
 * GET /api/analytics/click-heatmap
 * Get click heatmap data for a page
 */
router.get('/analytics/click-heatmap', async (req: Request, res: Response) => {
  try {
    const { websiteId, pageId, resolution } = req.query;

    if (!websiteId || !pageId) {
      res.status(400).json({ error: 'websiteId and pageId are required' });
      return;
    }

    const heatmap = await heatmapService.getClickHeatmap(
      websiteId as string,
      pageId as string,
      resolution ? parseInt(resolution as string, 10) : 50
    );

    res.json(heatmap);
  } catch (error) {
    console.error('Failed to get click heatmap:', error);
    res.status(500).json({ error: 'Failed to get click heatmap' });
  }
});

/**
 * GET /api/analytics/scroll-heatmap
 * Get scroll depth heatmap data
 */
router.get('/analytics/scroll-heatmap', async (req: Request, res: Response) => {
  try {
    const { websiteId, pageId } = req.query;

    if (!websiteId || !pageId) {
      res.status(400).json({ error: 'websiteId and pageId are required' });
      return;
    }

    const heatmap = await heatmapService.getScrollHeatmap(
      websiteId as string,
      pageId as string
    );

    res.json(heatmap);
  } catch (error) {
    console.error('Failed to get scroll heatmap:', error);
    res.status(500).json({ error: 'Failed to get scroll heatmap' });
  }
});

/**
 * GET /api/analytics/movement-heatmap
 * Get movement tracking heatmap data
 */
router.get('/analytics/movement-heatmap', async (req: Request, res: Response) => {
  try {
    const { websiteId, pageId } = req.query;

    if (!websiteId || !pageId) {
      res.status(400).json({ error: 'websiteId and pageId are required' });
      return;
    }

    const heatmap = await heatmapService.getMovementHeatmap(
      websiteId as string,
      pageId as string
    );

    res.json(heatmap);
  } catch (error) {
    console.error('Failed to get movement heatmap:', error);
    res.status(500).json({ error: 'Failed to get movement heatmap' });
  }
});

/**
 * GET /api/analytics/pages
 * Get page analytics
 */
router.get('/analytics/pages', async (req: Request, res: Response) => {
  try {
    const { websiteId, pageId } = req.query;

    if (!websiteId) {
      res.status(400).json({ error: 'websiteId is required' });
      return;
    }

    const analytics = await heatmapService.getPageAnalytics(
      websiteId as string,
      pageId as string | undefined
    );

    res.json(analytics);
  } catch (error) {
    console.error('Failed to get page analytics:', error);
    res.status(500).json({ error: 'Failed to get page analytics' });
  }
});

/**
 * GET /api/analytics/dashboard
 * Get dashboard data for a website
 */
router.get('/analytics/dashboard', async (req: Request, res: Response) => {
  try {
    const { websiteId } = req.query;

    if (!websiteId) {
      res.status(400).json({ error: 'websiteId is required' });
      return;
    }

    const dashboard = await heatmapService.getDashboard(websiteId as string);

    res.json(dashboard);
  } catch (error) {
    console.error('Failed to get dashboard:', error);
    res.status(500).json({ error: 'Failed to get dashboard' });
  }
});

// Configuration endpoints

/**
 * POST /api/config/website
 * Configure a website for tracking
 */
router.post('/config/website', async (req: Request, res: Response) => {
  try {
    const { websiteId, name, domain, sampleRate } = req.body;

    if (!websiteId || !name || !domain) {
      res.status(400).json({ error: 'websiteId, name, and domain are required' });
      return;
    }

    await heatmapService.configureWebsite({ websiteId, name, domain, sampleRate });
    res.status(201).json({ success: true, websiteId });
  } catch (error) {
    console.error('Failed to configure website:', error);
    res.status(500).json({ error: 'Failed to configure website' });
  }
});

/**
 * GET /api/config/website/:websiteId
 * Get website configuration
 */
router.get('/config/website/:websiteId', async (req: Request, res: Response) => {
  try {
    const config = await heatmapService.getWebsiteConfig(req.params.websiteId);

    if (!config) {
      res.status(404).json({ error: 'Website not found' });
      return;
    }

    res.json(config);
  } catch (error) {
    console.error('Failed to get website config:', error);
    res.status(500).json({ error: 'Failed to get website config' });
  }
});

// Utility endpoints

/**
 * GET /api/session/new
 * Generate a new session ID
 */
router.get('/session/new', (req: Request, res: Response) => {
  const sessionId = heatmapService.generateSessionId();
  res.json({ sessionId });
});

/**
 * GET /api/page/new
 * Generate a new page ID
 */
router.get('/page/new', (req: Request, res: Response) => {
  const pageId = heatmapService.generatePageId();
  res.json({ pageId });
});

export default router;
