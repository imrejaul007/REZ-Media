/**
 * Call Routes - REST API for call session management
 */

import { Router, Response } from 'express';
import { z } from 'zod';
import { callTrackerService } from '../services/callTracker';
import { billingService } from '../services/billingService';
import { AuthenticatedRequest, authMiddleware } from '../middleware/auth';
import { CallType, CallStatus } from '../types';
import { logger } from '../utils/logger';

const router = Router();

// Validation schemas
const createSessionSchema = z.object({
  callerId: z.string().min(1),
  calleeId: z.string().min(1),
  callerPhone: z.string().optional(),
  calleePhone: z.string().optional(),
  callType: z.enum([CallType.OUTBOUND, CallType.INBOUND]),
  connectionId: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

const updateSessionSchema = z.object({
  status: z.enum([
    CallStatus.INITIATED,
    CallStatus.CONNECTING,
    CallStatus.ACTIVE,
    CallStatus.ON_HOLD,
    CallStatus.ENDED,
    CallStatus.FAILED,
    CallStatus.MISSED,
  ]).optional(),
  duration: z.number().min(0).optional(),
  onHoldDuration: z.number().min(0).optional(),
  ratePerMinute: z.number().min(0).optional(),
  metadata: z.record(z.unknown()).optional(),
});

// All routes require authentication
router.use(authMiddleware);

/**
 * POST /calls/session - Initialize a new call session
 */
router.post('/session', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const validationResult = createSessionSchema.safeParse(req.body);

    if (!validationResult.success) {
      res.status(400).json({
        success: false,
        error: 'Validation error',
        details: validationResult.error.errors,
      });
      return;
    }

    const result = await callTrackerService.initializeSession(validationResult.data);

    if (!result.success) {
      res.status(400).json({
        success: false,
        error: result.error,
      });
      return;
    }

    res.status(201).json({
      success: true,
      data: result.data?.getSummary(),
      message: 'Call session initialized',
    });
  } catch (error) {
    logger.error('Error creating call session', { error });
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

/**
 * GET /calls/session/:sessionId - Get session by ID
 */
router.get('/session/:sessionId', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { sessionId } = req.params;

    const result = await callTrackerService.getSession(sessionId);

    if (!result.success) {
      res.status(404).json({
        success: false,
        error: result.error,
      });
      return;
    }

    res.json({
      success: true,
      data: result.data?.getSummary(),
    });
  } catch (error) {
    logger.error('Error getting session', { error });
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

/**
 * PUT /calls/session/:sessionId - Update session
 */
router.put('/session/:sessionId', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { sessionId } = req.params;

    const validationResult = updateSessionSchema.safeParse(req.body);

    if (!validationResult.success) {
      res.status(400).json({
        success: false,
        error: 'Validation error',
        details: validationResult.error.errors,
      });
      return;
    }

    const result = await callTrackerService.updateSessionStatus(sessionId, validationResult.data);

    if (!result.success) {
      res.status(400).json({
        success: false,
        error: result.error,
      });
      return;
    }

    res.json({
      success: true,
      data: result.data?.getSummary(),
      message: 'Session updated',
    });
  } catch (error) {
    logger.error('Error updating session', { error });
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

/**
 * POST /calls/session/:sessionId/start - Start a call
 */
router.post('/session/:sessionId/start', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { sessionId } = req.params;

    const result = await callTrackerService.startCall(sessionId);

    if (!result.success) {
      res.status(400).json({
        success: false,
        error: result.error,
      });
      return;
    }

    res.json({
      success: true,
      data: result.data?.getSummary(),
      message: 'Call started',
    });
  } catch (error) {
    logger.error('Error starting call', { error });
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

/**
 * POST /calls/session/:sessionId/end - End a call
 */
router.post('/session/:sessionId/end', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { sessionId } = req.params;
    const endTime = req.body.endTime ? new Date(req.body.endTime) : new Date();

    const result = await callTrackerService.endCall(sessionId, endTime);

    if (!result.success) {
      res.status(400).json({
        success: false,
        error: result.error,
      });
      return;
    }

    res.json({
      success: true,
      data: result.data?.getSummary(),
      message: 'Call ended',
    });
  } catch (error) {
    logger.error('Error ending call', { error });
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

/**
 * POST /calls/session/:sessionId/fail - Mark call as failed
 */
router.post('/session/:sessionId/fail', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { sessionId } = req.params;
    const { reason } = req.body;

    const result = await callTrackerService.failCall(sessionId, reason || 'Unknown failure');

    if (!result.success) {
      res.status(400).json({
        success: false,
        error: result.error,
      });
      return;
    }

    res.json({
      success: true,
      data: result.data?.getSummary(),
      message: 'Call marked as failed',
    });
  } catch (error) {
    logger.error('Error marking call as failed', { error });
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

/**
 * POST /calls/session/:sessionId/hold - Put call on hold
 */
router.post('/session/:sessionId/hold', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { sessionId } = req.params;

    const result = await callTrackerService.holdCall(sessionId);

    if (!result.success) {
      res.status(400).json({
        success: false,
        error: result.error,
      });
      return;
    }

    res.json({
      success: true,
      data: result.data?.getSummary(),
      message: 'Call on hold',
    });
  } catch (error) {
    logger.error('Error holding call', { error });
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

/**
 * POST /calls/session/:sessionId/resume - Resume call from hold
 */
router.post('/session/:sessionId/resume', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { sessionId } = req.params;

    const result = await callTrackerService.resumeCall(sessionId);

    if (!result.success) {
      res.status(400).json({
        success: false,
        error: result.error,
      });
      return;
    }

    res.json({
      success: true,
      data: result.data?.getSummary(),
      message: 'Call resumed',
    });
  } catch (error) {
    logger.error('Error resuming call', { error });
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

/**
 * GET /calls/active - Get active sessions for user
 */
router.get('/active', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.query.userId as string || req.userId;

    if (!userId) {
      res.status(400).json({
        success: false,
        error: 'User ID required',
      });
      return;
    }

    const result = await callTrackerService.getActiveSessions(userId);

    if (!result.success) {
      res.status(500).json({
        success: false,
        error: result.error,
      });
      return;
    }

    res.json({
      success: true,
      data: result.data?.map(s => s.getSummary()),
    });
  } catch (error) {
    logger.error('Error getting active sessions', { error });
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

/**
 * GET /calls/history - Get call history for user
 */
router.get('/history', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.query.userId as string || req.userId;
    const limit = parseInt(req.query.limit as string) || 50;
    const skip = parseInt(req.query.skip as string) || 0;
    const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
    const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;

    if (!userId) {
      res.status(400).json({
        success: false,
        error: 'User ID required',
      });
      return;
    }

    const result = await callTrackerService.getCallHistory(userId, {
      limit,
      skip,
      startDate,
      endDate,
    });

    if (!result.success) {
      res.status(500).json({
        success: false,
        error: result.error,
      });
      return;
    }

    res.json({
      success: true,
      data: {
        sessions: result.data?.sessions.map(s => s.getSummary()),
        total: result.data?.total,
        pagination: {
          page: Math.floor(skip / limit) + 1,
          limit,
          total: result.data?.total || 0,
          totalPages: Math.ceil((result.data?.total || 0) / limit),
        },
      },
    });
  } catch (error) {
    logger.error('Error getting call history', { error });
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

/**
 * POST /calls/session/:sessionId/bill - Process billing for a session
 */
router.post('/session/:sessionId/bill', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { sessionId } = req.params;

    const result = await billingService.processCallBilling(sessionId);

    if (!result.success) {
      res.status(400).json({
        success: false,
        error: result.error,
      });
      return;
    }

    res.json({
      success: true,
      data: result.data?.getSummary(),
      message: result.message || 'Billing processed',
    });
  } catch (error) {
    logger.error('Error processing billing', { error });
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

/**
 * POST /calls/session/:sessionId/refund - Refund a billing transaction
 */
router.post('/session/:sessionId/refund', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { sessionId } = req.params;

    const result = await billingService.refundBilling(sessionId);

    if (!result.success) {
      res.status(400).json({
        success: false,
        error: result.error,
      });
      return;
    }

    res.json({
      success: true,
      data: result.data?.getSummary(),
      message: 'Refund processed',
    });
  } catch (error) {
    logger.error('Error processing refund', { error });
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

export default router;
