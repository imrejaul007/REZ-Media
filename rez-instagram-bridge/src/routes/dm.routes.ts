import { Router, Request, Response, NextFunction } from 'express';
import { dmService } from '../services/dmService';
import { sessionLinker } from '../services/sessionLinker';
import { routingService } from '../services/routingService';
import { InstagramConversation } from '../models/InstagramConversation';
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
const sendMessageSchema = z.object({
  recipientId: z.string().min(1),
  message: z.string().min(1).max(2000),
  conversationId: z.string().optional(),
});

const createLinkSessionSchema = z.object({
  instagramUserId: z.string().min(1),
  username: z.string().min(1),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  source: z.string().optional(),
});

const verifyLinkSchema = z.object({
  verificationCode: z.string().length(6),
});

// GET: List conversations
router.get('/conversations', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { status, limit = 50, offset = 0 } = req.query;

    const filter: any = {};
    if (status) filter.status = status;

    const conversations = await InstagramConversation.find(filter)
      .populate('instagramUserId', 'username displayName profilePictureUrl')
      .sort({ lastMessageAt: -1 })
      .skip(Number(offset))
      .limit(Number(limit));

    const total = await InstagramConversation.countDocuments(filter);

    res.json({
      success: true,
      data: conversations,
      pagination: {
        total,
        limit: Number(limit),
        offset: Number(offset),
      },
    });
  } catch (error: any) {
    logger.error('Failed to list conversations', { error: error.message });
    next(error);
  }
});

// GET: Get conversation by thread ID
router.get('/conversations/:threadId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { threadId } = req.params;

    const conversation = await InstagramConversation.findByThreadId(threadId)
      .populate('instagramUserId', 'username displayName profilePictureUrl followersCount');

    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    res.json({
      success: true,
      data: conversation,
    });
  } catch (error: any) {
    logger.error('Failed to get conversation', { error: error.message });
    next(error);
  }
});

// GET: Get conversation history
router.get('/conversations/:threadId/messages', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { threadId } = req.params;
    const { limit = 50 } = req.query;

    const messages = await dmService.getConversationHistory(threadId, Number(limit));

    res.json({
      success: true,
      data: messages,
    });
  } catch (error: any) {
    logger.error('Failed to get conversation history', { error: error.message });
    next(error);
  }
});

// POST: Send message
router.post('/send', validateRequest(sendMessageSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { recipientId, message, conversationId } = req.body;

    const result = await dmService.sendMessageToUser(recipientId, message, { conversationId });

    if (result.success) {
      res.json({
        success: true,
        messageId: result.messageId,
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error,
      });
    }
  } catch (error: any) {
    logger.error('Failed to send message', { error: error.message });
    next(error);
  }
});

// POST: Send quick reply
router.post('/quick-reply', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { recipientId, message, quickReplies } = req.body;

    if (!quickReplies || !Array.isArray(quickReplies)) {
      return res.status(400).json({ error: 'Quick replies array required' });
    }

    const result = await dmService.sendQuickReply(recipientId, message, quickReplies);

    res.json({
      success: result.success,
      messageId: result.messageId,
      error: result.error,
    });
  } catch (error: any) {
    logger.error('Failed to send quick reply', { error: error.message });
    next(error);
  }
});

// POST: Create link session
router.post('/link-session', validateRequest(createLinkSessionSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { instagramUserId, username, email, phone, source } = req.body;

    const result = await sessionLinker.createLinkSession({
      instagramUserId,
      username,
      email,
      phone,
      source,
    });

    res.json({
      success: result.success,
      sessionId: result.sessionId,
      verificationCode: result.verificationCode,
      expiresAt: result.expiresAt,
      error: result.error,
    });
  } catch (error: any) {
    logger.error('Failed to create link session', { error: error.message });
    next(error);
  }
});

// POST: Verify link
router.post('/verify-link', validateRequest(verifyLinkSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { verificationCode } = req.body;

    const result = await sessionLinker.verifyLink({ verificationCode });

    res.json({
      success: result.success,
      rezUserId: result.rezUserId,
      instagramUserId: result.instagramUserId,
      error: result.error,
    });
  } catch (error: any) {
    logger.error('Failed to verify link', { error: error.message });
    next(error);
  }
});

// GET: Session status
router.get('/link-session/:sessionId/status', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { sessionId } = req.params;

    const status = await sessionLinker.getSessionStatus(sessionId);

    if (!status) {
      return res.status(404).json({ error: 'Session not found' });
    }

    res.json({
      success: true,
      ...status,
    });
  } catch (error: any) {
    logger.error('Failed to get session status', { error: error.message });
    next(error);
  }
});

// POST: Resend verification code
router.post('/link-session/:sessionId/resend', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { sessionId } = req.params;

    const result = await sessionLinker.resendVerificationCode(sessionId);

    res.json({
      success: result.success,
      verificationCode: result.verificationCode,
      error: result.error,
    });
  } catch (error: any) {
    logger.error('Failed to resend verification code', { error: error.message });
    next(error);
  }
});

// POST: Mark conversation as read
router.post('/conversations/:threadId/read', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { threadId } = req.params;

    await dmService.markConversationAsRead(threadId);

    res.json({ success: true });
  } catch (error: any) {
    logger.error('Failed to mark conversation as read', { error: error.message });
    next(error);
  }
});

// POST: Transfer to WhatsApp
router.post('/transfer/whatsapp/:instagramUserId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { instagramUserId } = req.params;
    const { instagramUsername, conversationHistory } = req.body;

    const result = await routingService.transferToWhatsApp(
      instagramUserId,
      instagramUsername,
      conversationHistory
    );

    res.json({
      success: result.success,
      whatsappThreadId: result.whatsappThreadId,
      error: result.error,
    });
  } catch (error: any) {
    logger.error('Failed to transfer to WhatsApp', { error: error.message });
    next(error);
  }
});

// GET: User by Instagram ID
router.get('/users/:instagramId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { instagramId } = req.params;

    const user = await InstagramUser.findOne({ instagramId });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      success: true,
      data: user,
    });
  } catch (error: any) {
    logger.error('Failed to get user', { error: error.message });
    next(error);
  }
});

export default router;
