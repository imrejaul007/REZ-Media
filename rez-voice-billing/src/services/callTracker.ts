/**
 * CallTracker Service - Manages call session tracking
 * Handles creation, updates, and lifecycle of call sessions
 */

import { v4 as uuidv4 } from 'uuid';
import Redis from 'ioredis';
import { CallSession, CallSessionDocument } from '../models/CallSession';
import { CallRecord } from '../models/CallRecord';
import {
  ICallSessionCreate,
  ICallSessionUpdate,
  CallStatus,
  CallType,
  BillingStatus,
  IApiResponse,
} from '../types';
import { getBillingConfig } from '../config';
import { getRedisConfig } from '../config';
import { logger } from '../utils/logger';

export class CallTrackerService {
  private redis: Redis;
  private billingConfig = getBillingConfig();

  constructor() {
    const redisConfig = getRedisConfig();
    this.redis = new Redis(redisConfig.url, {
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
    });
  }

  /**
   * Initialize a new call session
   */
  async initializeSession(params: ICallSessionCreate): Promise<IApiResponse<CallSessionDocument>> {
    try {
      const sessionId = uuidv4();
      const ratePerMinute = this.billingConfig.defaultRatePerMinute;

      // Check for duplicate session using Redis
      const isDuplicate = await CallSession.checkDuplicate(sessionId);
      if (isDuplicate) {
        return {
          success: false,
          error: 'Duplicate session detected',
        };
      }

      const session = new CallSession({
        sessionId,
        callerId: params.callerId,
        calleeId: params.calleeId,
        callerPhone: params.callerPhone,
        calleePhone: params.calleePhone,
        callType: params.callType,
        status: CallStatus.INITIATED,
        ratePerMinute,
        duration: 0,
        billableDuration: 0,
        onHoldDuration: 0,
        actualDuration: 0,
        totalCost: 0,
        billingStatus: BillingStatus.PENDING,
        connectionId: params.connectionId,
        metadata: params.metadata || {},
        startTime: new Date(),
      });

      await session.save();

      // Track active session in Redis for quick lookup
      await this.trackActiveSession(sessionId, params.callerId, params.calleeId);

      logger.info('Call session initialized', {
        sessionId,
        callerId: params.callerId,
        calleeId: params.calleeId,
        callType: params.callType,
      });

      return {
        success: true,
        data: session,
      };
    } catch (error) {
      logger.error('Failed to initialize call session', { error, params });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to initialize session',
      };
    }
  }

  /**
   * Update call session status
   */
  async updateSessionStatus(
    sessionId: string,
    updates: ICallSessionUpdate
  ): Promise<IApiResponse<CallSessionDocument>> {
    try {
      const session = await CallSession.findBySessionId(sessionId);

      if (!session) {
        return {
          success: false,
          error: 'Session not found',
        };
      }

      // Apply updates
      if (updates.status) {
        session.status = updates.status;
      }

      if (updates.endTime) {
        session.endTime = updates.endTime;
      }

      if (updates.duration !== undefined) {
        session.duration = updates.duration;
        session.actualDuration = Math.max(0, updates.duration - session.onHoldDuration);
      }

      if (updates.onHoldDuration !== undefined) {
        session.onHoldDuration = updates.onHoldDuration;
        session.actualDuration = Math.max(0, session.duration - updates.onHoldDuration);
      }

      if (updates.ratePerMinute !== undefined) {
        session.ratePerMinute = updates.ratePerMinute;
      }

      if (updates.billingStatus) {
        session.billingStatus = updates.billingStatus;
      }

      if (updates.metadata) {
        session.metadata = { ...session.metadata, ...updates.metadata };
      }

      // Recalculate billing
      await session.save();

      // Update Redis tracking if session ended
      if (updates.status === CallStatus.ENDED || updates.status === CallStatus.FAILED) {
        await this.removeActiveSession(sessionId);
      }

      logger.info('Call session updated', {
        sessionId,
        status: updates.status,
        duration: session.duration,
        totalCost: session.totalCost,
      });

      return {
        success: true,
        data: session,
      };
    } catch (error) {
      logger.error('Failed to update call session', { error, sessionId, updates });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update session',
      };
    }
  }

  /**
   * Start a call (mark as active)
   */
  async startCall(sessionId: string): Promise<IApiResponse<CallSessionDocument>> {
    return this.updateSessionStatus(sessionId, {
      status: CallStatus.ACTIVE,
    });
  }

  /**
   * End a call and calculate final billing
   */
  async endCall(
    sessionId: string,
    endTime: Date = new Date()
  ): Promise<IApiResponse<CallSessionDocument>> {
    try {
      const session = await CallSession.findBySessionId(sessionId);

      if (!session) {
        return {
          success: false,
          error: 'Session not found',
        };
      }

      const startTime = session.startTime || new Date(Date.now() - 60000);
      const durationSeconds = Math.floor((endTime.getTime() - startTime.getTime()) / 1000);

      const actualDuration = Math.max(0, durationSeconds - session.onHoldDuration);
      const billableDuration = this.calculateBillableDuration(actualDuration);
      const totalCost = this.calculateCost(billableDuration, session.ratePerMinute);

      session.status = CallStatus.ENDED;
      session.endTime = endTime;
      session.duration = durationSeconds;
      session.actualDuration = actualDuration;
      session.billableDuration = billableDuration;
      session.totalCost = totalCost;

      await session.save();

      // Update aggregated record
      const hour = startTime.getHours();
      await CallRecord.updateFromSession(session.callerId, {
        duration: actualDuration,
        billableDuration,
        cost: totalCost,
        callType: session.callType,
        status: session.status,
        hour,
      });

      // Remove from active sessions
      await this.removeActiveSession(sessionId);

      logger.info('Call ended', {
        sessionId,
        duration: actualDuration,
        billableDuration,
        totalCost,
      });

      return {
        success: true,
        data: session,
      };
    } catch (error) {
      logger.error('Failed to end call', { error, sessionId });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to end call',
      };
    }
  }

  /**
   * Mark a call as failed
   */
  async failCall(sessionId: string, reason: string): Promise<IApiResponse<CallSessionDocument>> {
    try {
      const session = await CallSession.findBySessionId(sessionId);

      if (!session) {
        return {
          success: false,
          error: 'Session not found',
        };
      }

      session.status = CallStatus.FAILED;
      session.endTime = new Date();
      session.metadata = { ...session.metadata, failureReason: reason };

      await session.save();
      await this.removeActiveSession(sessionId);

      logger.warn('Call failed', { sessionId, reason });

      return {
        success: true,
        data: session,
      };
    } catch (error) {
      logger.error('Failed to mark call as failed', { error, sessionId });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to mark call as failed',
      };
    }
  }

  /**
   * Put call on hold
   */
  async holdCall(sessionId: string): Promise<IApiResponse<CallSessionDocument>> {
    return this.updateSessionStatus(sessionId, {
      status: CallStatus.ON_HOLD,
      metadata: { heldAt: new Date() },
    });
  }

  /**
   * Resume call from hold
   */
  async resumeCall(sessionId: string): Promise<IApiResponse<CallSessionDocument>> {
    return this.updateSessionStatus(sessionId, {
      status: CallStatus.ACTIVE,
      metadata: { resumedAt: new Date() },
    });
  }

  /**
   * Get session by ID
   */
  async getSession(sessionId: string): Promise<IApiResponse<CallSessionDocument>> {
    try {
      const session = await CallSession.findBySessionId(sessionId);

      if (!session) {
        return {
          success: false,
          error: 'Session not found',
        };
      }

      return {
        success: true,
        data: session,
      };
    } catch (error) {
      logger.error('Failed to get session', { error, sessionId });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get session',
      };
    }
  }

  /**
   * Get active sessions for a user
   */
  async getActiveSessions(userId: string): Promise<IApiResponse<CallSessionDocument[]>> {
    try {
      const sessions = await CallSession.findActiveSessions(userId);

      return {
        success: true,
        data: sessions,
      };
    } catch (error) {
      logger.error('Failed to get active sessions', { error, userId });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get active sessions',
      };
    }
  }

  /**
   * Get user's call history
   */
  async getCallHistory(
    userId: string,
    options: { limit?: number; skip?: number; startDate?: Date; endDate?: Date }
  ): Promise<IApiResponse<{ sessions: CallSessionDocument[]; total: number }>> {
    try {
      const result = await CallSession.getUserHistory(userId, options);

      return {
        success: true,
        data: result,
      };
    } catch (error) {
      logger.error('Failed to get call history', { error, userId });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get call history',
      };
    }
  }

  /**
   * Calculate billable duration with billing interval rounding
   */
  private calculateBillableDuration(actualDuration: number): number {
    const { billingIntervalSeconds, freeCallDurationSeconds } = this.billingConfig;
    const chargeableDuration = Math.max(0, actualDuration - freeCallDurationSeconds);

    if (chargeableDuration <= 0) {
      return 0;
    }

    return Math.ceil(chargeableDuration / billingIntervalSeconds) * billingIntervalSeconds;
  }

  /**
   * Calculate cost for billable duration
   */
  private calculateCost(billableDuration: number, ratePerMinute: number): number {
    const minutes = billableDuration / 60;
    return Math.round(minutes * ratePerMinute * 10000) / 10000; // Round to 4 decimal places
  }

  /**
   * Track active session in Redis
   */
  private async trackActiveSession(sessionId: string, callerId: string, calleeId: string): Promise<void> {
    const key = `voice:active:${sessionId}`;
    const sessionData = JSON.stringify({
      callerId,
      calleeId,
      startedAt: new Date().toISOString(),
    });

    // Set with TTL (max call duration)
    const ttl = this.billingConfig.maxCallDurationSeconds;
    await this.redis.setex(key, ttl, sessionData);

    // Also track by user
    await this.redis.sadd(`voice:user:${callerId}:active`, sessionId);
    await this.redis.sadd(`voice:user:${calleeId}:active`, sessionId);
  }

  /**
   * Remove active session from Redis
   */
  private async removeActiveSession(sessionId: string): Promise<void> {
    const key = `voice:active:${sessionId}`;
    const sessionData = await this.redis.get(key);

    if (sessionData) {
      const { callerId, calleeId } = JSON.parse(sessionData);
      await this.redis.srem(`voice:user:${callerId}:active`, sessionId);
      await this.redis.srem(`voice:user:${calleeId}:active`, sessionId);
    }

    await this.redis.del(key);
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    await this.redis.quit();
  }
}

export const callTrackerService = new CallTrackerService();
export default callTrackerService;
