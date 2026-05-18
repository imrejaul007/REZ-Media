/**
 * RABTUL Wallet Integration for Karma Service
 *
 * Uses RABTUL Wallet as the underlying coin storage for Karma.
 * This ensures Karma coins work across the entire ReZ ecosystem.
 */

import axios from 'axios';

const WALLET_URL = process.env.WALLET_SERVICE_URL || 'http://localhost:4004';

// Types
interface Transaction {
  transactionId: string;
  type: 'credit' | 'debit';
  amount: number;
  reason: string;
  timestamp: string;
}

interface KarmaConfig {
  karmaToCoinRatio: number; // 1 Karma = X Coins
  minRedemption: number;
  maxRedemption: number;
}

const config: KarmaConfig = {
  karmaToCoinRatio: 1, // 1 Karma = 1 Coin
  minRedemption: 10,
  maxRedemption: 10000,
};

class RABTULWalletIntegration {
  /**
   * Award Karma coins to a user
   * Stored in RABTUL Wallet
   */
  async awardKarma(userId: string, action: string, baseValue: number): Promise<Transaction> {
    const karmaEarned = baseValue * config.karmaToCoinRatio;

    const transaction = await axios.post(
      `${WALLET_URL}/api/wallet/add`,
      {
        userId,
        amount: karmaEarned,
        reason: `karma_${action}`,
        metadata: {
          action,
          baseValue,
          karmaEarned,
          timestamp: new Date().toISOString(),
        },
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'X-Internal-Token': process.env.INTERNAL_SERVICE_TOKEN || '',
        },
      }
    );

    return transaction.data;
  }

  /**
   * Redeem Karma coins from a user
   */
  async redeemKarma(userId: string, rewardId: string, karmaPoints: number): Promise<Transaction> {
    if (karmaPoints < config.minRedemption) {
      throw new Error(`Minimum redemption is ${config.minRedemption} Karma`);
    }
    if (karmaPoints > config.maxRedemption) {
      throw new Error(`Maximum redemption is ${config.maxRedemption} Karma`);
    }

    const coinsToDeduct = karmaPoints * config.karmaToCoinRatio;

    const transaction = await axios.post(
      `${WALLET_URL}/api/wallet/deduct`,
      {
        userId,
        amount: coinsToDeduct,
        reason: `karma_redeem_${rewardId}`,
        metadata: {
          rewardId,
          karmaPoints,
          coinsDeducted: coinsToDeduct,
          timestamp: new Date().toISOString(),
        },
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'X-Internal-Token': process.env.INTERNAL_SERVICE_TOKEN || '',
        },
      }
    );

    return transaction.data;
  }

  /**
   * Get user's Karma balance
   * Reads from RABTUL Wallet
   */
  async getBalance(userId: string): Promise<{ karma: number; coins: number }> {
    const response = await axios.get(`${WALLET_URL}/api/wallet/balance/${userId}`, {
      headers: {
        'X-Internal-Token': process.env.INTERNAL_SERVICE_TOKEN || '',
      },
    });

    return {
      karma: response.data.coins,
      coins: response.data.coins,
    };
  }

  /**
   * Get user's Karma transaction history
   */
  async getHistory(userId: string, limit = 50): Promise<Transaction[]> {
    const response = await axios.get(`${WALLET_URL}/api/wallet/transactions/${userId}?limit=${limit}`, {
      headers: {
        'X-Internal-Token': process.env.INTERNAL_SERVICE_TOKEN || '',
      },
    });

    return response.data
      .filter((t: Transaction) => t.reason.startsWith('karma_'))
      .map((t: Transaction) => ({
        ...t,
        karmaAmount: t.amount,
      }));
  }

  /**
   * Transfer Karma between users
   */
  async transferKarma(fromUserId: string, toUserId: string, karmaPoints: number): Promise<void> {
    // Deduct from sender
    await axios.post(
      `${WALLET_URL}/api/wallet/deduct`,
      {
        userId: fromUserId,
        amount: karmaPoints * config.karmaToCoinRatio,
        reason: `karma_transfer_to_${toUserId}`,
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'X-Internal-Token': process.env.INTERNAL_SERVICE_TOKEN || '',
        },
      }
    );

    // Add to receiver
    await axios.post(
      `${WALLET_URL}/api/wallet/add`,
      {
        userId: toUserId,
        amount: karmaPoints * config.karmaToCoinRatio,
        reason: `karma_transfer_from_${fromUserId}`,
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'X-Internal-Token': process.env.INTERNAL_SERVICE_TOKEN || '',
        },
      }
    );
  }
}

export const rabtulWallet = new RABTULWalletIntegration();
export default rabtulWallet;
