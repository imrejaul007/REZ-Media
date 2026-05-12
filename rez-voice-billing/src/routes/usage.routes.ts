/**
 * Usage Routes - REST API for credit balance and usage management
 */

import { Router, Response } from 'express';
import { creditService } from '../services/creditService';
import { AuthenticatedRequest, authMiddleware } from '../middleware/auth';
import { logger } from '../utils/logger';

const router = Router();

// All routes require authentication
router.use(authMiddleware);

/**
 * GET /usage/balance - Get user's credit balance
 */
router.get('/balance', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.query.userId as string || req.userId;

    if (!userId) {
      res.status(400).json({
        success: false,
        error: 'User ID required',
      });
      return;
    }

    const result = await creditService.getBalance(userId);

    if (!result.success) {
      res.status(400).json({
        success: false,
        error: result.error,
      });
      return;
    }

    res.json({
      success: true,
      data: result.data,
    });
  } catch (error) {
    logger.error('Error getting balance', { error });
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

/**
 * GET /usage/balance/:userId - Get specific user's balance (for admin/internal use)
 */
router.get('/balance/:userId', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;

    const result = await creditService.getBalance(userId);

    if (!result.success) {
      res.status(400).json({
        success: false,
        error: result.error,
      });
      return;
    }

    res.json({
      success: true,
      data: result.data,
    });
  } catch (error) {
    logger.error('Error getting balance', { error });
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

/**
 * GET /usage/can-make-call - Check if user can make a call
 */
router.get('/can-make-call', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.query.userId as string || req.userId;
    const estimatedCost = parseFloat(req.query.estimatedCost as string) || 0;

    if (!userId) {
      res.status(400).json({
        success: false,
        error: 'User ID required',
      });
      return;
    }

    const result = await creditService.canMakeCall(userId, estimatedCost);

    if (!result.success) {
      res.status(400).json({
        success: false,
        error: result.error,
      });
      return;
    }

    res.json({
      success: true,
      data: result.data,
    });
  } catch (error) {
    logger.error('Error checking call capability', { error });
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

/**
 * POST /usage/reserve - Reserve credits for a call
 */
router.post('/reserve', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { userId, amount, sessionId } = req.body;

    if (!userId || !amount || !sessionId) {
      res.status(400).json({
        success: false,
        error: 'userId, amount, and sessionId are required',
      });
      return;
    }

    const result = await creditService.reserveCredits(userId, amount, sessionId);

    if (!result.success) {
      res.status(400).json({
        success: false,
        error: result.error,
      });
      return;
    }

    res.json({
      success: true,
      data: result.data,
      message: 'Credits reserved',
    });
  } catch (error) {
    logger.error('Error reserving credits', { error });
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

/**
 * POST /usage/release - Release reserved credits
 */
router.post('/release', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { sessionId } = req.body;

    if (!sessionId) {
      res.status(400).json({
        success: false,
        error: 'sessionId is required',
      });
      return;
    }

    const result = await creditService.releaseReservation(sessionId);

    res.json({
      success: result.success,
      message: result.message || (result.success ? 'Released' : 'Failed'),
    });
  } catch (error) {
    logger.error('Error releasing reservation', { error });
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

/**
 * GET /usage/transactions - Get user's transaction history
 */
router.get('/transactions', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.query.userId as string || req.userId;
    const limit = parseInt(req.query.limit as string) || 50;
    const skip = parseInt(req.query.skip as string) || 0;

    if (!userId) {
      res.status(400).json({
        success: false,
        error: 'User ID required',
      });
      return;
    }

    const result = await creditService.getTransactionHistory(userId, limit, skip);

    if (!result.success) {
      res.status(400).json({
        success: false,
        error: result.error,
      });
      return;
    }

    res.json({
      success: true,
      data: result.data,
    });
  } catch (error) {
    logger.error('Error getting transactions', { error });
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

/**
 * POST /usage/transfer - Transfer credits between users
 */
router.post('/transfer', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { fromUserId, toUserId, amount, description } = req.body;

    if (!fromUserId || !toUserId || !amount) {
      res.status(400).json({
        success: false,
        error: 'fromUserId, toUserId, and amount are required',
      });
      return;
    }

    if (fromUserId === toUserId) {
      res.status(400).json({
        success: false,
        error: 'Cannot transfer to same user',
      });
      return;
    }

    const result = await creditService.transferCredits(
      fromUserId,
      toUserId,
      amount,
      description || 'Voice call transfer'
    );

    if (!result.success) {
      res.status(400).json({
        success: false,
        error: result.error,
      });
      return;
    }

    res.json({
      success: true,
      data: {
        transactionId: result.transactionId,
        newBalance: result.balance,
      },
      message: 'Transfer successful',
    });
  } catch (error) {
    logger.error('Error transferring credits', { error });
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

/**
 * POST /usage/add - Add credits to a user's wallet (admin/internal use)
 */
router.post('/add', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { userId, amount, idempotencyKey, description } = req.body;

    if (!userId || !amount) {
      res.status(400).json({
        success: false,
        error: 'userId and amount are required',
      });
      return;
    }

    const result = await creditService.addCredits(
      userId,
      amount,
      idempotencyKey || `admin-add-${Date.now()}`,
      description || 'Admin credit addition'
    );

    if (!result.success) {
      res.status(400).json({
        success: false,
        error: result.error,
      });
      return;
    }

    res.json({
      success: true,
      data: {
        transactionId: result.transactionId,
        newBalance: result.balance,
      },
      message: 'Credits added',
    });
  } catch (error) {
    logger.error('Error adding credits', { error });
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

/**
 * POST /usage/deduct - Deduct credits from a user's wallet (admin/internal use)
 */
router.post('/deduct', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { userId, amount, idempotencyKey, description } = req.body;

    if (!userId || !amount) {
      res.status(400).json({
        success: false,
        error: 'userId and amount are required',
      });
      return;
    }

    const result = await creditService.deductCredits(
      userId,
      amount,
      idempotencyKey || `admin-deduct-${Date.now()}`,
      description || 'Admin credit deduction'
    );

    if (!result.success) {
      res.status(400).json({
        success: false,
        error: result.error,
      });
      return;
    }

    res.json({
      success: true,
      data: {
        transactionId: result.transactionId,
        newBalance: result.balance,
      },
      message: 'Credits deducted',
    });
  } catch (error) {
    logger.error('Error deducting credits', { error });
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

export default router;
