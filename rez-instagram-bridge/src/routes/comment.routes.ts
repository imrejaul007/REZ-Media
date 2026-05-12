import { Router, Request, Response, NextFunction } from 'express';
import { commentService } from '../services/commentService';
import { instagramClient } from '../services/instagramClient';
import { InstagramComment } from '../models/InstagramComment';
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
const replySchema = z.object({
  commentId: z.string().min(1),
  message: z.string().min(1).max(2000),
});

const hideCommentSchema = z.object({
  commentId: z.string().min(1),
  reason: z.string().optional(),
});

// GET: Get comments for a media
router.get('/media/:mediaId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { mediaId } = req.params;
    const { status, limit = 50, offset = 0 } = req.query;

    const filter: any = { mediaId };
    if (status) filter.status = status;

    const comments = await InstagramComment.find(filter)
      .populate('instagramUserId', 'username displayName profilePictureUrl')
      .sort({ createdAt: -1 })
      .skip(Number(offset))
      .limit(Number(limit));

    const total = await InstagramComment.countDocuments(filter);

    res.json({
      success: true,
      data: comments,
      pagination: {
        total,
        limit: Number(limit),
        offset: Number(offset),
      },
    });
  } catch (error: any) {
    logger.error('Failed to get comments', { error: error.message });
    next(error);
  }
});

// GET: Get pending comments
router.get('/pending/:mediaId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { mediaId } = req.params;

    const comments = await commentService.getPendingComments(mediaId);

    res.json({
      success: true,
      data: comments,
    });
  } catch (error: any) {
    logger.error('Failed to get pending comments', { error: error.message });
    next(error);
  }
});

// GET: Get comment by ID
router.get('/:commentId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { commentId } = req.params;

    const comment = await InstagramComment.findOne({ commentId })
      .populate('instagramUserId', 'username displayName profilePictureUrl');

    if (!comment) {
      return res.status(404).json({ error: 'Comment not found' });
    }

    res.json({
      success: true,
      data: comment,
    });
  } catch (error: any) {
    logger.error('Failed to get comment', { error: error.message });
    next(error);
  }
});

// POST: Reply to comment
router.post('/reply', validateRequest(replySchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { commentId, message } = req.body;

    const result = await instagramClient.replyToComment(commentId, message);

    if (result.success) {
      // Update comment record
      await InstagramComment.markAsReplied(commentId, message, 'human');

      res.json({
        success: true,
        replyId: result.replyId,
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error,
      });
    }
  } catch (error: any) {
    logger.error('Failed to reply to comment', { error: error.message });
    next(error);
  }
});

// POST: Hide comment
router.post('/hide', validateRequest(hideCommentSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { commentId, reason } = req.body;

    const result = await commentService.hideComment(commentId);

    if (result.success) {
      logger.info('Comment hidden', { commentId, reason });

      res.json({
        success: true,
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error,
      });
    }
  } catch (error: any) {
    logger.error('Failed to hide comment', { error: error.message });
    next(error);
  }
});

// POST: Escalate comment
router.post('/escalate/:commentId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { commentId } = req.params;
    const { reason, escalateTo } = req.body;

    // Direct update via model
    await InstagramComment.findOneAndUpdate(
      { commentId },
      {
        status: 'escalated',
        escalatedTo: escalateTo || reason || 'human_agent',
        escalatedAt: new Date(),
      }
    );

    res.json({
      success: true,
    });
  } catch (error: any) {
    logger.error('Failed to escalate comment', { error: error.message });
    next(error);
  }
});

// GET: Get analytics
router.get('/analytics', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { mediaId } = req.query;

    const analytics = await commentService.getCommentAnalytics(mediaId as string);

    res.json({
      success: true,
      data: analytics,
    });
  } catch (error: any) {
    logger.error('Failed to get analytics', { error: error.message });
    next(error);
  }
});

// GET: Get comments by intent
router.get('/by-intent/:intent', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { intent } = req.params;
    const { limit = 50, offset = 0 } = req.query;

    const comments = await InstagramComment.find({ intent })
      .populate('instagramUserId', 'username displayName profilePictureUrl')
      .sort({ createdAt: -1 })
      .skip(Number(offset))
      .limit(Number(limit));

    const total = await InstagramComment.countDocuments({ intent });

    res.json({
      success: true,
      data: comments,
      pagination: {
        total,
        limit: Number(limit),
        offset: Number(offset),
      },
    });
  } catch (error: any) {
    logger.error('Failed to get comments by intent', { error: error.message });
    next(error);
  }
});

// GET: Get comments by sentiment
router.get('/by-sentiment/:sentiment', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { sentiment } = req.params;
    const { limit = 50, offset = 0 } = req.query;

    const comments = await InstagramComment.find({ sentiment })
      .populate('instagramUserId', 'username displayName profilePictureUrl')
      .sort({ createdAt: -1 })
      .skip(Number(offset))
      .limit(Number(limit));

    const total = await InstagramComment.countDocuments({ sentiment });

    res.json({
      success: true,
      data: comments,
      pagination: {
        total,
        limit: Number(limit),
        offset: Number(offset),
      },
    });
  } catch (error: any) {
    logger.error('Failed to get comments by sentiment', { error: error.message });
    next(error);
  }
});

export default router;
