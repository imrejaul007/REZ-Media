/**
 * CreditService - Connects to REZ Media Wallet
 * Handles credit balance management, deductions, and additions
 */

import axios, { AxiosInstance } from 'axios';
import { v4 as uuidv4 } from 'uuid';
import Redis from 'ioredis';
import { getWalletConfig, getRedisConfig } from '../config';
import { IWalletCreditResponse, IWalletBalanceResponse, IApiResponse } from '../types';
import { logger } from '../utils/logger';

export class CreditService {
  private walletClient: AxiosInstance;
  private redis: Redis;
  private baseUrl: string;
  private token: string;

  constructor() {
    const config = getWalletConfig();
    this.baseUrl = config.baseUrl;
    this.token = config.token;
    this.walletClient = axios.create({
      baseURL: this.baseUrl,
      timeout: config.timeout,
      headers: {
        'Content-Type': 'application/json',
        ...(this.token && { 'X-Internal-Token': this.token }),
      },
    });

    const redisConfig = getRedisConfig();
    this.redis = new Redis(redisConfig.url, {
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
    });
  }

  /**
   * Get user's wallet balance
   */
  async getBalance(userId: string): Promise<IApiResponse<IWalletBalanceResponse>> {
    try {
      // Check Redis cache first
      const cacheKey = `voice:balance:${userId}`;
      const cached = await this.redis.get(cacheKey);

      if (cached) {
        logger.debug('Balance cache hit', { userId });
        return {
          success: true,
          data: JSON.parse(cached),
        };
      }

      // Fetch from wallet service
      const response = await this.walletClient.get<{
        success: boolean;
        data?: {
          userId: string;
          balance: number;
          reservedBalance: number;
          currency: string;
        };
        error?: string;
      }>(`/wallet/balance/${userId}`);

      if (!response.data?.success || !response.data?.data) {
        return {
          success: false,
          error: response.data?.error || 'Failed to get balance',
        };
      }

      const balanceData: IWalletBalanceResponse = {
        userId: response.data.data.userId,
        balance: response.data.data.balance,
        reservedBalance: response.data.data.reservedBalance,
        availableBalance: response.data.data.balance - response.data.data.reservedBalance,
        currency: response.data.data.currency || 'INR',
      };

      // Cache for 30 seconds
      await this.redis.setex(cacheKey, 30, JSON.stringify(balanceData));

      return {
        success: true,
        data: balanceData,
      };
    } catch (error) {
      logger.error('Failed to get balance from wallet', { error, userId });

      // Try to fetch directly from MongoDB as fallback
      return this.getBalanceFallback(userId);
    }
  }

  /**
   * Fallback to get balance from local cache
   */
  private async getBalanceFallback(userId: string): Promise<IApiResponse<IWalletBalanceResponse>> {
    try {
      const balanceKey = `voice:user:${userId}:balance`;
      const cached = await this.redis.get(balanceKey);

      if (cached) {
        return {
          success: true,
          data: JSON.parse(cached),
        };
      }

      return {
        success: false,
        error: 'Wallet service unavailable and no cached balance',
      };
    } catch (error) {
      return {
        success: false,
        error: 'Failed to get balance',
      };
    }
  }

  /**
   * Deduct credits from user's wallet
   * Uses idempotency key to prevent double-deductions
   */
  async deductCredits(
    userId: string,
    amount: number,
    idempotencyKey: string,
    description: string
  ): Promise<IApiResponse<IWalletCreditResponse>> {
    try {
      // Check idempotency key in Redis
      const dedupKey = `voice:deduct:${idempotencyKey}`;
      const existing = await this.redis.get(dedupKey);

      if (existing) {
        logger.info('Duplicate deduction detected', { idempotencyKey });
        const result = JSON.parse(existing);
        return {
          success: result.success,
          transactionId: result.transactionId,
          balance: result.balance,
          message: 'Already processed (idempotent)',
        };
      }

      // Verify sufficient balance first
      const balanceResult = await this.getBalance(userId);
      if (!balanceResult.success || !balanceResult.data) {
        return {
          success: false,
          message: 'Could not verify balance',
        };
      }

      if (balanceResult.data.availableBalance < amount) {
        return {
          success: false,
          message: `Insufficient balance. Required: ${amount}, Available: ${balanceResult.data.availableBalance}`,
        };
      }

      // Perform deduction via wallet service
      const transactionId = uuidv4();

      const response = await this.walletClient.post<{
        success: boolean;
        data?: {
          transactionId: string;
          newBalance: number;
        };
        error?: string;
      }>('/wallet/deduct', {
        userId,
        amount,
        transactionId,
        description,
        source: 'voice-billing',
        idempotencyKey,
      });

      if (!response.data?.success || !response.data?.data) {
        return {
          success: false,
          message: response.data?.error || 'Failed to deduct credits',
        };
      }

      const result: IWalletCreditResponse = {
        success: true,
        transactionId: response.data.data.transactionId,
        balance: response.data.data.newBalance,
        message: 'Credits deducted successfully',
      };

      // Cache successful result with idempotency key (24 hours)
      await this.redis.setex(dedupKey, 86400, JSON.stringify(result));

      // Invalidate balance cache
      await this.redis.del(`voice:balance:${userId}`);

      logger.info('Credits deducted', {
        userId,
        amount,
        transactionId: result.transactionId,
        newBalance: result.balance,
      });

      return result;
    } catch (error) {
      logger.error('Failed to deduct credits', { error, userId, amount });

      // Check if it's a balance-related error
      if (axios.isAxiosError(error) && error.response?.status === 400) {
        return {
          success: false,
          message: 'Insufficient balance',
        };
      }

      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to deduct credits',
      };
    }
  }

  /**
   * Add credits to user's wallet (for refunds, promotions, etc.)
   */
  async addCredits(
    userId: string,
    amount: number,
    idempotencyKey: string,
    description: string
  ): Promise<IApiResponse<IWalletCreditResponse>> {
    try {
      // Check idempotency key
      const dedupKey = `voice:add:${idempotencyKey}`;
      const existing = await this.redis.get(dedupKey);

      if (existing) {
        logger.info('Duplicate credit detected', { idempotencyKey });
        const result = JSON.parse(existing);
        return {
          success: result.success,
          transactionId: result.transactionId,
          balance: result.balance,
          message: 'Already processed (idempotent)',
        };
      }

      const transactionId = uuidv4();

      const response = await this.walletClient.post<{
        success: boolean;
        data?: {
          transactionId: string;
          newBalance: number;
        };
        error?: string;
      }>('/wallet/credit', {
        userId,
        amount,
        transactionId,
        description,
        source: 'voice-billing-refund',
        idempotencyKey,
      });

      if (!response.data?.success || !response.data?.data) {
        return {
          success: false,
          message: response.data?.error || 'Failed to add credits',
        };
      }

      const result: IWalletCreditResponse = {
        success: true,
        transactionId: response.data.data.transactionId,
        balance: response.data.data.newBalance,
        message: 'Credits added successfully',
      };

      // Cache successful result
      await this.redis.setex(dedupKey, 86400, JSON.stringify(result));

      // Invalidate balance cache
      await this.redis.del(`voice:balance:${userId}`);

      logger.info('Credits added', {
        userId,
        amount,
        transactionId: result.transactionId,
        newBalance: result.balance,
      });

      return result;
    } catch (error) {
      logger.error('Failed to add credits', { error, userId, amount });
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to add credits',
      };
    }
  }

  /**
   * Reserve credits for a call (pre-authorization)
   */
  async reserveCredits(
    userId: string,
    amount: number,
    sessionId: string
  ): Promise<IApiResponse<{ reservationId: string; reservedAmount: number }>> {
    try {
      const reservationId = `reserve:${uuidv4()}`;

      const response = await this.walletClient.post<{
        success: boolean;
        data?: {
          reservationId: string;
          reservedAmount: number;
        };
        error?: string;
      }>('/wallet/reserve', {
        userId,
        amount,
        reservationId,
        sessionId,
        source: 'voice-call',
      });

      if (!response.data?.success || !response.data?.data) {
        return {
          success: false,
          message: response.data?.error || 'Failed to reserve credits',
        };
      }

      // Store reservation in Redis for quick lookup
      await this.redis.setex(`voice:reservation:${sessionId}`, 3600, JSON.stringify({
        reservationId: response.data.data.reservationId,
        amount: response.data.data.reservedAmount,
      }));

      return {
        success: true,
        data: {
          reservationId: response.data.data.reservationId,
          reservedAmount: response.data.data.reservedAmount,
        },
      };
    } catch (error) {
      logger.error('Failed to reserve credits', { error, userId, amount });
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to reserve credits',
      };
    }
  }

  /**
   * Release reserved credits
   */
  async releaseReservation(sessionId: string): Promise<IApiResponse> {
    try {
      const reservation = await this.redis.get(`voice:reservation:${sessionId}`);

      if (!reservation) {
        return {
          success: true,
          message: 'No reservation found',
        };
      }

      const { reservationId } = JSON.parse(reservation);

      await this.walletClient.post('/wallet/release', {
        reservationId,
        sessionId,
      });

      await this.redis.del(`voice:reservation:${sessionId}`);

      return {
        success: true,
        message: 'Reservation released',
      };
    } catch (error) {
      logger.error('Failed to release reservation', { error, sessionId });
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to release reservation',
      };
    }
  }

  /**
   * Transfer credits between users
   */
  async transferCredits(
    fromUserId: string,
    toUserId: string,
    amount: number,
    description: string
  ): Promise<IApiResponse<IWalletCreditResponse>> {
    try {
      const transactionId = uuidv4();

      const response = await this.walletClient.post<{
        success: boolean;
        data?: {
          transactionId: string;
          fromNewBalance: number;
          toNewBalance: number;
        };
        error?: string;
      }>('/wallet/transfer', {
        fromUserId,
        toUserId,
        amount,
        transactionId,
        description,
        source: 'voice-call',
      });

      if (!response.data?.success || !response.data?.data) {
        return {
          success: false,
          message: response.data?.error || 'Failed to transfer credits',
        };
      }

      // Invalidate balance caches
      await this.redis.del(`voice:balance:${fromUserId}`);
      await this.redis.del(`voice:balance:${toUserId}`);

      return {
        success: true,
        transactionId: response.data.data.transactionId,
        balance: response.data.data.fromNewBalance,
        message: 'Transfer successful',
      };
    } catch (error) {
      logger.error('Failed to transfer credits', { error, fromUserId, toUserId, amount });
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to transfer credits',
      };
    }
  }

  /**
   * Get transaction history from wallet
   */
  async getTransactionHistory(
    userId: string,
    limit = 50,
    skip = 0
  ): Promise<IApiResponse<Array<{
    transactionId: string;
    type: string;
    amount: number;
    balance: number;
    description: string;
    createdAt: Date;
  }>>> {
    try {
      const response = await this.walletClient.get<{
        success: boolean;
        data?: Array<{
          transactionId: string;
          type: string;
          amount: number;
          balance: number;
          description: string;
          createdAt: string;
        }>;
        error?: string;
      }>(`/wallet/transactions/${userId}`, {
        params: { limit, skip },
      });

      if (!response.data?.success || !response.data?.data) {
        return {
          success: false,
          error: response.data?.error || 'Failed to get transactions',
        };
      }

      return {
        success: true,
        data: response.data.data.map((t) => ({
          ...t,
          createdAt: new Date(t.createdAt),
        })),
      };
    } catch (error) {
      logger.error('Failed to get transaction history', { error, userId });
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to get transactions',
      };
    }
  }

  /**
   * Check if user can make a call (has sufficient balance)
   */
  async canMakeCall(userId: string, estimatedCost: number): Promise<IApiResponse<{
    canMakeCall: boolean;
    availableBalance: number;
    estimatedCost: number;
    shortfall: number;
  }>> {
    const balanceResult = await this.getBalance(userId);

    if (!balanceResult.success || !balanceResult.data) {
      return {
        success: false,
        message: 'Could not verify balance',
      };
    }

    const availableBalance = balanceResult.data.availableBalance;
    const canMakeCall = availableBalance >= estimatedCost;
    const shortfall = canMakeCall ? 0 : estimatedCost - availableBalance;

    return {
      success: true,
      data: {
        canMakeCall,
        availableBalance,
        estimatedCost,
        shortfall,
      },
    };
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    await this.redis.quit();
  }
}

export const creditService = new CreditService();
export default creditService;
