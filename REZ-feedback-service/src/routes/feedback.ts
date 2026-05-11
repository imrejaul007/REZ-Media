import { Router, Request, Response, NextFunction } from 'express';
import { ActionFeedback, FeedbackStats, LearningInsight } from '../types';
import { learningService } from '../services/learning';
import { feedbackProcessor } from '../workers/feedback-processor';
import { z } from 'zod';

const router = Router();

// Validation schema
const FeedbackInputSchema = z.object({
  action_id: z.string().min(1),
  outcome: z.enum(['approved', 'rejected', 'ignored', 'failed', 'edited']),
  latency_ms: z.number().nullable().optional(),
  confidence_score: z.number().min(0).max(1),
  feedback_type: z.enum(['explicit', 'implicit']),
  merchant_id: z.string().min(1),
  event_type: z.string().min(1),
  decision_made: z.string().min(1),
  original_value: z.any().optional(),
  edited_value: z.any().optional(),
  timestamp: z.number().optional()
});

// POST /feedback - Record feedback
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validation = FeedbackInputSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        error: 'Invalid feedback data',
        details: validation.error.errors
      });
    }

    const feedback: ActionFeedback = {
      ...validation.data,
      timestamp: validation.data.timestamp || Date.now()
    };

    // Queue for async processing
    await feedbackProcessor.queueFeedback(feedback);

    res.status(201).json({
      success: true,
      message: 'Feedback recorded',
      feedback_id: `${feedback.action_id}_${feedback.timestamp}`
    });
  } catch (error) {
    next(error);
  }
});

// POST /feedback/batch - Record multiple feedback items
router.post('/batch', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const feedbackItems = z.array(FeedbackInputSchema).safeParse(req.body);
    if (!feedbackItems.success) {
      return res.status(400).json({
        error: 'Invalid feedback data',
        details: feedbackItems.error.errors
      });
    }

    const timestamps = feedbackItems.data.map(item => Date.now());
    const feedbacks: ActionFeedback[] = feedbackItems.data.map((item, idx) => ({
      ...item,
      timestamp: item.timestamp || timestamps[idx]
    }));

    await feedbackProcessor.queueBatchFeedback(feedbacks);

    res.status(201).json({
      success: true,
      message: `${feedbacks.length} feedback items queued`,
      count: feedbacks.length
    });
  } catch (error) {
    next(error);
  }
});

// GET /feedback/stats/:merchantId - Get feedback stats for a merchant
router.get('/stats/:merchantId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { merchantId } = req.params;
    const period = req.query.period as string || '7d';

    const stats = await learningService.getStats(merchantId, period);

    res.json(stats);
  } catch (error) {
    next(error);
  }
});

// GET /feedback/actions/:actionId - Get action feedback history
router.get('/actions/:actionId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { actionId } = req.params;
    const limit = parseInt(req.query.limit as string) || 50;

    const history = await feedbackProcessor.getActionHistory(actionId, limit);

    res.json({
      action_id: actionId,
      history,
      count: history.length
    });
  } catch (error) {
    next(error);
  }
});

// GET /feedback/learning-insights - Get AI-readable learning insights
router.get('/learning-insights', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const merchantId = req.query.merchantId as string | undefined;
    const minSeverity = req.query.minSeverity as string || 'low';

    const insights = await learningService.generateInsights(merchantId, minSeverity);

    res.json({
      insights,
      generated_at: Date.now(),
      count: insights.length
    });
  } catch (error) {
    next(error);
  }
});

// GET /feedback/patterns/:merchantId - Get feedback patterns
router.get('/patterns/:merchantId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { merchantId } = req.params;
    const eventType = req.query.eventType as string | undefined;

    const patterns = await learningService.analyzePatterns(merchantId, eventType);

    res.json({
      merchant_id: merchantId,
      patterns,
      analyzed_at: Date.now()
    });
  } catch (error) {
    next(error);
  }
});

// GET /feedback/drift/:merchantId - Detect drift in agent performance
router.get('/drift/:merchantId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { merchantId } = req.params;
    const threshold = parseFloat(req.query.threshold as string) || 0.1;

    const drift = await learningService.detectDrift(merchantId, threshold);

    res.json({
      merchant_id: merchantId,
      drift_detections: drift,
      analyzed_at: Date.now()
    });
  } catch (error) {
    next(error);
  }
});

// Health check endpoint
router.get('/health', async (_req: Request, res: Response) => {
  res.json({
    service: 'rez-feedback-service',
    status: 'healthy',
    timestamp: Date.now()
  });
});

export default router;
