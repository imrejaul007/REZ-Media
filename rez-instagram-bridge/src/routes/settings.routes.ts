import { Router, Request, Response, NextFunction } from 'express';
import { instagramConfig } from '../config/instagram';
import { config } from '../config';
import { InstagramUser } from '../models/InstagramUser';
import { validateRequest } from '../middleware/validation';
import { z } from 'zod';
import winston from 'winston';

const router = Router();
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [new winston.transports.Console()],
});

// Validation schemas
const updatePreferencesSchema = z.object({
  receiveAutoReplies: z.boolean().optional(),
  receiveHandoffNotifications: z.boolean().optional(),
  preferredLanguage: z.string().optional(),
  timezone: z.string().optional(),
});

const updateUserTagsSchema = z.object({
  instagramId: z.string().min(1),
  tags: z.array(z.string()),
});

// GET: Get account info
router.get('/account', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const account = await instagramConfig.getBusinessAccount();

    res.json({
      success: true,
      data: account,
    });
  } catch (error: any) {
    logger.error('Failed to get account info', { error: error.message });
    next(error);
  }
});

// GET: Get configuration
router.get('/config', async (_req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      rateLimit: config.rateLimit,
      session: {
        linkExpiry: config.session.linkExpiry,
        maxAttempts: config.session.maxAttempts,
      },
      intent: {
        confidenceThreshold: config.intent.confidenceThreshold,
        defaultIntent: config.intent.defaultIntent,
      },
    },
  });
});

// GET: Get user preferences
router.get('/users/:instagramId/preferences', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { instagramId } = req.params;

    const user = await InstagramUser.findOne({ instagramId });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      success: true,
      data: user.preferences,
    });
  } catch (error: any) {
    logger.error('Failed to get user preferences', { error: error.message });
    next(error);
  }
});

// PUT: Update user preferences
router.put('/users/:instagramId/preferences', validateRequest(updatePreferencesSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { instagramId } = req.params;
    const updates = req.body;

    const user = await InstagramUser.findOneAndUpdate(
      { instagramId },
      {
        $set: {
          'preferences.receiveAutoReplies': updates.receiveAutoReplies,
          'preferences.receiveHandoffNotifications': updates.receiveHandoffNotifications,
          'preferences.preferredLanguage': updates.preferredLanguage,
          'preferences.timezone': updates.timezone,
        },
      },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      success: true,
      data: user.preferences,
    });
  } catch (error: any) {
    logger.error('Failed to update user preferences', { error: error.message });
    next(error);
  }
});

// POST: Update user tags
router.post('/users/tags', validateRequest(updateUserTagsSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { instagramId, tags } = req.body;

    const user = await InstagramUser.findOneAndUpdate(
      { instagramId },
      {
        $set: { tags },
      },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      success: true,
      data: { tags: user.tags },
    });
  } catch (error: any) {
    logger.error('Failed to update user tags', { error: error.message });
    next(error);
  }
});

// POST: Add tag to user
router.post('/users/:instagramId/tags/:tag', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { instagramId, tag } = req.params;

    const user = await InstagramUser.findOneAndUpdate(
      { instagramId },
      {
        $addToSet: { tags: tag },
      },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      success: true,
      data: { tags: user.tags },
    });
  } catch (error: any) {
    logger.error('Failed to add tag', { error: error.message });
    next(error);
  }
});

// DELETE: Remove tag from user
router.delete('/users/:instagramId/tags/:tag', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { instagramId, tag } = req.params;

    const user = await InstagramUser.findOneAndUpdate(
      { instagramId },
      {
        $pull: { tags: tag },
      },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      success: true,
      data: { tags: user.tags },
    });
  } catch (error: any) {
    logger.error('Failed to remove tag', { error: error.message });
    next(error);
  }
});

// PUT: Update user notes
router.put('/users/:instagramId/notes', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { instagramId } = req.params;
    const { notes } = req.body;

    const user = await InstagramUser.findOneAndUpdate(
      { instagramId },
      {
        $set: { notes },
      },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      success: true,
      data: { notes: user.notes },
    });
  } catch (error: any) {
    logger.error('Failed to update notes', { error: error.message });
    next(error);
  }
});

// GET: Get automation settings
router.get('/automation', async (_req: Request, res: Response) => {
  const automationSettings = {
    autoReply: {
      enabled: true,
      responseDelay: 0,
      maxResponsesPerHour: 50,
    },
    commentAutomation: {
      enabled: true,
      replyToQuestions: true,
      escalateNegative: true,
      hideOffensive: true,
    },
    mentionTracking: {
      enabled: true,
      autoEngage: false,
    },
    sessionLinking: {
      enabled: true,
      expiryHours: 24,
      maxAttempts: 3,
    },
  };

  res.json({
    success: true,
    data: automationSettings,
  });
});

// PUT: Update automation settings
router.put('/automation', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const settings = req.body;

    logger.info('Automation settings updated', { settings });

    res.json({
      success: true,
      data: settings,
    });
  } catch (error: any) {
    logger.error('Failed to update automation settings', { error: error.message });
    next(error);
  }
});

// GET: Get link statistics
router.get('/stats/links', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { InstagramSession } = await import('../models/InstagramSession');

    const stats = await InstagramSession.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
        },
      },
    ]);

    const totalSessions = stats.reduce((acc, s) => acc + s.count, 0);
    const completedSessions = stats.find((s) => s._id === 'completed')?.count || 0;

    res.json({
      success: true,
      data: {
        totalSessions,
        completedSessions,
        completionRate: totalSessions > 0 ? (completedSessions / totalSessions) * 100 : 0,
        byStatus: stats,
      },
    });
  } catch (error: any) {
    logger.error('Failed to get link statistics', { error: error.message });
    next(error);
  }
});

// GET: Health check for integrations
router.get('/health/integrations', async (_req: Request, res: Response) => {
  const health = {
    instagram: {
      status: 'healthy',
      connected: !!process.env.INSTAGRAM_ACCESS_TOKEN,
    },
    orchestrator: {
      status: 'unknown',
      url: config.orchestrator.url,
    },
    whatsappBridge: {
      status: 'unknown',
      url: config.whatsappBridge.url,
    },
  };

  res.json({
    success: true,
    data: health,
  });
});

export default router;
