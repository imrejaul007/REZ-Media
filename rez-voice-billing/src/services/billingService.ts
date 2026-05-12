/**
 * BillingService - Processes call billing and deducts credits from wallet
 * Coordinates between call sessions and wallet service
 */

import { CallSession, CallSessionDocument } from '../models/CallSession';
import { BillingTransaction, BillingTransactionDocument } from '../models/BillingTransaction';
import { BillingStatus, IApiResponse, ICallSession } from '../types';
import { creditService } from './creditService';
import { logger } from '../utils/logger';

export class BillingService {
  /**
   * Process billing for a completed call session
   * Deducts credits from user's wallet
   */
  async processCallBilling(sessionId: string): Promise<IApiResponse<BillingTransactionDocument>> {
    try {
      // Get the session
      const session = await CallSession.findBySessionId(sessionId);

      if (!session) {
        return {
          success: false,
          error: 'Session not found',
        };
      }

      // Check if already billed
      if (session.billingStatus === BillingStatus.PROCESSED) {
        return {
          success: false,
          error: 'Session already billed',
        };
      }

      // Check if session is eligible for billing
      if (session.status !== 'ended') {
        return {
          success: false,
          error: 'Session not ended, cannot bill',
        };
      }

      // Check if there's anything to bill
      if (session.totalCost <= 0) {
        // No charge, just mark as processed
        session.billingStatus = BillingStatus.PROCESSED;
        await session.save();

        return {
          success: true,
          data: await BillingTransaction.createForSession({
            sessionId: session.sessionId,
            callerId: session.callerId,
            totalCost: 0,
          }),
          message: 'Free call - no billing required',
        };
      }

      // Deduct from wallet
      const deductionResult = await creditService.deductCredits(
        session.callerId,
        session.totalCost,
        session.sessionId,
        `Voice call billing - Session ${session.sessionId}`
      );

      if (!deductionResult.success) {
        // Mark transaction as failed
        const transaction = await BillingTransaction.createForSession({
          sessionId: session.sessionId,
          callerId: session.callerId,
          totalCost: session.totalCost,
        });

        transaction.status = BillingStatus.FAILED;
        transaction.failureReason = deductionResult.message || 'Insufficient balance';
        await transaction.save();

        session.billingStatus = BillingStatus.FAILED;
        session.metadata = { ...session.metadata, billingError: deductionResult.message };
        await session.save();

        return {
          success: false,
          error: deductionResult.message || 'Insufficient balance',
        };
      }

      // Mark session as billed
      session.billingStatus = BillingStatus.PROCESSED;
      session.metadata = {
        ...session.metadata,
        billingTransactionId: deductionResult.transactionId,
      };
      await session.save();

      // Mark transaction as processed
      const transaction = await BillingTransaction.markProcessed(deductionResult.transactionId!);

      logger.info('Call billing processed', {
        sessionId,
        amount: session.totalCost,
        transactionId: deductionResult.transactionId,
        newBalance: deductionResult.balance,
      });

      return {
        success: true,
        data: transaction!,
        message: 'Billing processed successfully',
      };
    } catch (error) {
      logger.error('Failed to process billing', { error, sessionId });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to process billing',
      };
    }
  }

  /**
   * Process billing for multiple sessions (batch processing)
   */
  async processBatchBilling(sessionIds: string[]): Promise<{
    processed: number;
    failed: number;
    errors: Array<{ sessionId: string; error: string }>;
  }> {
    const results = {
      processed: 0,
      failed: 0,
      errors: [] as Array<{ sessionId: string; error: string }>,
    };

    for (const sessionId of sessionIds) {
      const result = await this.processCallBilling(sessionId);
      if (result.success) {
        results.processed++;
      } else {
        results.failed++;
        results.errors.push({
          sessionId,
          error: result.error || 'Unknown error',
        });
      }
    }

    return results;
  }

  /**
   * Get pending billing sessions
   */
  async getPendingBilling(limit = 100): Promise<IApiResponse<CallSessionDocument[]>> {
    try {
      const sessions = await CallSession.getPendingBilling(limit);
      return {
        success: true,
        data: sessions,
      };
    } catch (error) {
      logger.error('Failed to get pending billing', { error });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get pending billing',
      };
    }
  }

  /**
   * Process all pending billing
   */
  async processAllPendingBilling(): Promise<{
    processed: number;
    failed: number;
    totalCost: number;
    errors: Array<{ sessionId: string; error: string }>;
  }> {
    const pendingResult = await this.getPendingBilling(1000);

    if (!pendingResult.success || !pendingResult.data) {
      return {
        processed: 0,
        failed: 0,
        totalCost: 0,
        errors: [],
      };
    }

    const sessions = pendingResult.data;
    const sessionIds = sessions.map((s) => s.sessionId);

    const batchResult = await this.processBatchBilling(sessionIds);

    const totalCost = sessions
      .filter((s) => batchResult.errors.every((e) => e.sessionId !== s.sessionId))
      .reduce((sum, s) => sum + s.totalCost, 0);

    return {
      processed: batchResult.processed,
      failed: batchResult.failed,
      totalCost,
      errors: batchResult.errors,
    };
  }

  /**
   * Refund a billing transaction
   */
  async refundBilling(sessionId: string): Promise<IApiResponse<BillingTransactionDocument>> {
    try {
      const session = await CallSession.findBySessionId(sessionId);

      if (!session) {
        return {
          success: false,
          error: 'Session not found',
        };
      }

      if (session.billingStatus !== BillingStatus.PROCESSED) {
        return {
          success: false,
          error: 'Session not billed, cannot refund',
        };
      }

      if (session.totalCost <= 0) {
        return {
          success: false,
          error: 'No cost to refund',
        };
      }

      // Credit back to wallet
      const creditResult = await creditService.addCredits(
        session.callerId,
        session.totalCost,
        session.sessionId,
        `Voice call refund - Session ${session.sessionId}`
      );

      if (!creditResult.success) {
        return {
          success: false,
          error: creditResult.message || 'Failed to process refund',
        };
      }

      // Update session billing status
      session.billingStatus = BillingStatus.REFUNDED;
      session.metadata = {
        ...session.metadata,
        refundTransactionId: creditResult.transactionId,
        refundedAt: new Date(),
      };
      await session.save();

      // Get updated transaction
      const transactions = await BillingTransaction.getBySession(sessionId);
      const processedTransaction = transactions.find((t) => t.status === BillingStatus.PROCESSED);

      if (processedTransaction) {
        processedTransaction.status = BillingStatus.REFUNDED;
        await processedTransaction.save();
      }

      logger.info('Call billing refunded', {
        sessionId,
        amount: session.totalCost,
        refundTransactionId: creditResult.transactionId,
      });

      return {
        success: true,
        data: processedTransaction!,
        message: 'Refund processed successfully',
      };
    } catch (error) {
      logger.error('Failed to refund billing', { error, sessionId });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to refund billing',
      };
    }
  }

  /**
   * Get user's billing history
   */
  async getBillingHistory(
    userId: string,
    options: { limit?: number; skip?: number; status?: BillingStatus }
  ): Promise<IApiResponse<{ transactions: BillingTransactionDocument[]; total: number }>> {
    try {
      const result = await BillingTransaction.getUserHistory(userId, options);
      return {
        success: true,
        data: result,
      };
    } catch (error) {
      logger.error('Failed to get billing history', { error, userId });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get billing history',
      };
    }
  }

  /**
   * Get billing summary for a user
   */
  async getBillingSummary(userId: string, days = 30): Promise<
    IApiResponse<{
      totalBilled: number;
      totalRefunded: number;
      netBilled: number;
      callCount: number;
      averageCost: number;
    }>
  > {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const sessions = await CallSession.find({
        callerId: userId,
        createdAt: { $gte: startDate },
        billingStatus: { $in: [BillingStatus.PROCESSED, BillingStatus.REFUNDED] },
      }).exec();

      const totalBilled = sessions
        .filter((s) => s.billingStatus === BillingStatus.PROCESSED)
        .reduce((sum, s) => sum + s.totalCost, 0);

      const totalRefunded = sessions
        .filter((s) => s.billingStatus === BillingStatus.REFUNDED)
        .reduce((sum, s) => sum + s.totalCost, 0);

      const callCount = sessions.filter((s) => s.billingStatus === BillingStatus.PROCESSED).length;

      return {
        success: true,
        data: {
          totalBilled: Math.round(totalBilled * 10000) / 10000,
          totalRefunded: Math.round(totalRefunded * 10000) / 10000,
          netBilled: Math.round((totalBilled - totalRefunded) * 10000) / 10000,
          callCount,
          averageCost: callCount > 0 ? Math.round((totalBilled / callCount) * 10000) / 10000 : 0,
        },
      };
    } catch (error) {
      logger.error('Failed to get billing summary', { error, userId });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get billing summary',
      };
    }
  }
}

export const billingService = new BillingService();
export default billingService;
