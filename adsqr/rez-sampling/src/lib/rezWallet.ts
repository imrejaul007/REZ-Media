/**
 * REZ Wallet Integration for Ads QR
 * Handles coin operations, balance checks, and wallet connections
 */

const WALLET_SERVICE_URL = process.env.NEXT_PUBLIC_WALLET_SERVICE_URL || 'https://api.rez.money';
const AUTH_SERVICE_URL = process.env.NEXT_PUBLIC_AUTH_SERVICE_URL || 'https://api.rez.money';

// Types
export interface CoinBalance {
  available: number;
  locked: number;
  total: number;
  coinType: string;
}

export interface WalletBalance {
  balances: CoinBalance[];
  totalRezCoins: number;
}

export interface Transaction {
  id: string;
  type: 'credit' | 'debit';
  amount: number;
  coinType: string;
  source: string;
  description: string;
  balanceAfter: number;
  createdAt: string;
}

export interface TransactionSummary {
  totalEarned: number;
  totalSpent: number;
  totalReferrals: number;
  totalCashback: number;
}

export interface CreditResult {
  success: boolean;
  transactionId?: string;
  balance?: number | CoinBalance;
  message?: string;
}

// Storage keys
const WALLET_TOKEN_KEY = 'adsqr_wallet_token';

/**
 * Get authorization headers with current token
 */
async function getAuthHeaders(): Promise<Record<string, string>> {
  // Get fresh token if needed
  const token = localStorage.getItem('adsqr_access_token');

  if (!token) {
    return { 'Content-Type': 'application/json' };
  }

  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  };
}

/**
 * Get wallet balance
 */
export async function getBalance(): Promise<WalletBalance | null> {
  try {
    const headers = await getAuthHeaders();

    const response = await fetch(`${WALLET_SERVICE_URL}/api/wallet/balance`, {
      method: 'GET',
      headers,
    });

    const data = await response.json();

    if (data.success && data.data) {
      return data.data;
    }

    return null;
  } catch (error) {
    console.error('Get balance error:', error);
    return null;
  }
}

/**
 * Get REZ coin balance specifically
 */
export async function getRezCoinBalance(): Promise<number> {
  const balance = await getBalance();
  if (!balance) return 0;

  const rezBalance = balance.balances.find(b => b.coinType === 'rez');
  return rezBalance?.available || 0;
}

/**
 * Get wallet transactions
 */
export async function getTransactions(
  page: number = 1,
  limit: number = 20,
  coinType?: string
): Promise<{ transactions: Transaction[]; total: number; hasMore: boolean }> {
  try {
    const headers = await getAuthHeaders();
    const params = new URLSearchParams({
      page: String(page),
      limit: String(limit),
    });

    if (coinType) {
      params.set('coinType', coinType);
    }

    const response = await fetch(`${WALLET_SERVICE_URL}/api/wallet/transactions?${params}`, {
      method: 'GET',
      headers,
    });

    const data = await response.json();

    if (data.success && data.data) {
      return {
        transactions: data.data.transactions,
        total: data.data.pagination.total,
        hasMore: data.data.pagination.hasMore,
      };
    }

    return { transactions: [], total: 0, hasMore: false };
  } catch (error) {
    console.error('Get transactions error:', error);
    return { transactions: [], total: 0, hasMore: false };
  }
}

/**
 * Get transaction summary
 */
export async function getTransactionSummary(): Promise<TransactionSummary | null> {
  try {
    const headers = await getAuthHeaders();

    const response = await fetch(`${WALLET_SERVICE_URL}/api/wallet/summary`, {
      method: 'GET',
      headers,
    });

    const data = await response.json();

    if (data.success && data.data) {
      return data.data;
    }

    return null;
  } catch (error) {
    console.error('Get summary error:', error);
    return null;
  }
}

/**
 * Debit coins from wallet
 */
export async function debitCoins(
  amount: number,
  coinType: string = 'rez',
  source: string,
  description: string,
  idempotencyKey?: string
): Promise<CreditResult> {
  try {
    const headers = await getAuthHeaders();

    const response = await fetch(`${WALLET_SERVICE_URL}/api/wallet/coin-debit`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        amount,
        coinType,
        source,
        description,
        idempotencyKey: idempotencyKey || `adsqr_${Date.now()}`,
      }),
    });

    const data = await response.json();

    if (data.success) {
      return {
        success: true,
        transactionId: data.data?.transactionId,
        balance: data.data?.balance,
      };
    }

    return { success: false, message: data.message || 'Debit failed' };
  } catch (error) {
    console.error('Debit coins error:', error);
    return { success: false, message: 'Failed to debit coins' };
  }
}

/**
 * Get conversion rate (coins to rupees)
 */
export async function getConversionRate(): Promise<{ rate: number; exampleConversion: { coins: number; rupees: number } } | null> {
  try {
    const headers = await getAuthHeaders();

    const response = await fetch(`${WALLET_SERVICE_URL}/api/wallet/conversion-rate`, {
      method: 'GET',
      headers,
    });

    const data = await response.json();

    if (data.success && data.data) {
      return {
        rate: data.data.coinToRupeeRate,
        exampleConversion: data.data.exampleConversion,
      };
    }

    return null;
  } catch (error) {
    console.error('Get conversion rate error:', error);
    return null;
  }
}

/**
 * Credit coins to user wallet (internal/admin only - called by backend)
 */
export async function creditCoinsToUser(
  userId: string,
  amount: number,
  coinType: string,
  source: string,
  description: string,
  options?: {
    merchantId?: string;
    idempotencyKey?: string;
  }
): Promise<CreditResult> {
  try {
    const internalToken = process.env.INTERNAL_SERVICE_TOKEN;
    if (!internalToken) {
      return { success: false, message: 'Internal token not configured' };
    }

    const response = await fetch(`${WALLET_SERVICE_URL}/internal/credit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-internal-token': internalToken,
        'x-internal-service': 'adsqr-service',
      },
      body: JSON.stringify({
        targetUserId: userId,
        amount,
        coinType,
        source,
        description,
        merchantId: options?.merchantId,
        idempotencyKey: options?.idempotencyKey || `adsqr_${source}_${Date.now()}`,
      }),
    });

    const data = await response.json();

    if (data.success) {
      return {
        success: true,
        transactionId: data.data?.transactionId,
        balance: data.data?.balance,
      };
    }

    return { success: false, message: data.message || 'Credit failed' };
  } catch (error) {
    console.error('Credit coins error:', error);
    return { success: false, message: 'Failed to credit coins' };
  }
}

/**
 * Claim welcome bonus coins
 */
export async function claimWelcomeCoins(): Promise<CreditResult> {
  try {
    const headers = await getAuthHeaders();

    const response = await fetch(`${WALLET_SERVICE_URL}/api/wallet/welcome-coins`, {
      method: 'POST',
      headers,
    });

    const data = await response.json();

    if (data.success) {
      return {
        success: true,
        transactionId: data.data?.transactionId,
        balance: data.data?.balance,
      };
    }

    return { success: false, message: data.message || 'Failed to claim welcome coins' };
  } catch (error) {
    console.error('Claim welcome coins error:', error);
    return { success: false, message: 'Failed to claim welcome coins' };
  }
}

/**
 * Connect wallet (link external wallet)
 */
export async function connectWallet(walletAddress: string, walletType: 'metamask' | 'phantom' | 'trust'): Promise<{ success: boolean; message: string }> {
  try {
    const token = localStorage.getItem('adsqr_access_token');
    if (!token) {
      return { success: false, message: 'Not authenticated' };
    }

    const response = await fetch(`${WALLET_SERVICE_URL}/api/wallet/connect`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ walletAddress, walletType }),
    });

    const data = await response.json();
    return { success: data.success, message: data.message || 'Wallet connected' };
  } catch (error) {
    console.error('Connect wallet error:', error);
    return { success: false, message: 'Failed to connect wallet' };
  }
}

/**
 * Sync QR scan reward to wallet
 */
export async function syncScanReward(
  userId: string,
  campaignId: string,
  qrId: string,
  scanEventId: string,
  amount: number
): Promise<CreditResult> {
  return creditCoinsToUser(
    userId,
    amount,
    'rez',
    'qr_scan',
    `Reward for scanning QR code`,
    {
      idempotencyKey: `scan_${scanEventId}`,
    }
  );
}

// Utility functions
export function formatCoins(amount: number): string {
  if (amount >= 1000000) {
    return `${(amount / 1000000).toFixed(1)}M`;
  }
  if (amount >= 1000) {
    return `${(amount / 1000).toFixed(1)}K`;
  }
  return amount.toString();
}

export function coinsToRupees(coins: number, rate: number = 1): number {
  return coins * rate;
}

export function rupeesToCoins(rupees: number, rate: number = 1): number {
  return Math.floor(rupees / rate);
}

// ============================================
// Enhanced Wallet Features for Ads QR
// ============================================

// Daily reward limits
const DAILY_SCAN_LIMIT = 10;
const DAILY_VISIT_LIMIT = 5;
const DAILY_PURCHASE_LIMIT = 3;

export interface DailyRewardSummary {
  date: string;
  scanRewards: number;
  visitRewards: number;
  purchaseRewards: number;
  totalRewards: number;
}

export interface RewardEligibility {
  eligible: boolean;
  reason?: string;
  remainingScans: number;
  remainingVisits: number;
  remainingPurchases: number;
}

/**
 * Check if user is eligible for a reward (respects daily limits)
 */
export async function checkRewardEligibility(
  userId: string,
  rewardType: 'scan' | 'visit' | 'purchase',
  campaignId?: string
): Promise<RewardEligibility> {
  try {
    const headers = await getAuthHeaders();

    // Get today's date range
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const response = await fetch(`${WALLET_SERVICE_URL}/api/wallet/reward-eligibility`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        userId,
        rewardType,
        campaignId,
        dateFrom: today.toISOString(),
        dateTo: tomorrow.toISOString(),
      }),
    });

    const data = await response.json();

    if (data.success && data.data) {
      return data.data;
    }

    // Fallback to local check
    return checkLocalEligibility(rewardType);
  } catch (error) {
    console.error('Check reward eligibility error:', error);
    // Default to eligible on error
    return {
      eligible: true,
      remainingScans: DAILY_SCAN_LIMIT,
      remainingVisits: DAILY_VISIT_LIMIT,
      remainingPurchases: DAILY_PURCHASE_LIMIT,
    };
  }
}

/**
 * Local fallback for eligibility check
 */
function checkLocalEligibility(
  rewardType: 'scan' | 'visit' | 'purchase'
): RewardEligibility {
  const limits = {
    scan: DAILY_SCAN_LIMIT,
    visit: DAILY_VISIT_LIMIT,
    purchase: DAILY_PURCHASE_LIMIT,
  };

  return {
    eligible: true,
    remainingScans: limits.scan,
    remainingVisits: limits.visit,
    remainingPurchases: limits.purchase,
  };
}

/**
 * Get daily reward summary for user
 */
export async function getDailyRewardSummary(userId: string): Promise<DailyRewardSummary | null> {
  try {
    const headers = await getAuthHeaders();

    const today = new Date().toISOString().split('T')[0];

    const response = await fetch(`${WALLET_SERVICE_URL}/api/wallet/daily-summary`, {
      method: 'GET',
      headers: {
        ...headers,
        'x-user-id': userId,
        'x-date': today,
      },
    });

    const data = await response.json();

    if (data.success && data.data) {
      return data.data;
    }

    return null;
  } catch (error) {
    console.error('Get daily summary error:', error);
    return null;
  }
}

/**
 * Credit brand-specific coins to user
 */
export async function creditBrandCoins(
  userId: string,
  brandId: string,
  brandCoinType: string,
  amount: number,
  reason: string,
  options?: {
    idempotencyKey?: string;
    metadata?: Record<string, unknown>;
  }
): Promise<CreditResult> {
  try {
    const internalToken = process.env.INTERNAL_SERVICE_TOKEN;
    if (!internalToken) {
      return { success: false, message: 'Internal token not configured' };
    }

    const response = await fetch(`${WALLET_SERVICE_URL}/internal/brand-credit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-internal-token': internalToken,
        'x-internal-service': 'adsqr-service',
      },
      body: JSON.stringify({
        targetUserId: userId,
        brandId,
        coinType: brandCoinType,
        amount,
        reason,
        source: 'adsqr_campaign',
        idempotencyKey: options?.idempotencyKey || `adsqr_brand_${brandId}_${Date.now()}`,
        metadata: {
          ...options?.metadata,
          service: 'adsqr',
        },
      }),
    });

    const data = await response.json();

    if (data.success) {
      return {
        success: true,
        transactionId: data.data?.transactionId,
        balance: data.data?.balance,
      };
    }

    return { success: false, message: data.message || 'Brand coin credit failed' };
  } catch (error) {
    console.error('Credit brand coins error:', error);
    return { success: false, message: 'Failed to credit brand coins' };
  }
}

/**
 * Get brand coin balance for user
 */
export async function getBrandCoinBalance(
  userId: string,
  brandId: string
): Promise<CoinBalance | null> {
  try {
    const headers = await getAuthHeaders();

    const response = await fetch(
      `${WALLET_SERVICE_URL}/api/wallet/brand-balance?userId=${userId}&brandId=${brandId}`,
      {
        method: 'GET',
        headers,
      }
    );

    const data = await response.json();

    if (data.success && data.data) {
      return data.data;
    }

    return null;
  } catch (error) {
    console.error('Get brand coin balance error:', error);
    return null;
  }
}

/**
 * Transfer coins between users (for referrals)
 */
export async function transferCoins(
  fromUserId: string,
  toUserId: string,
  amount: number,
  coinType: string = 'rez',
  reason: string
): Promise<CreditResult> {
  try {
    const internalToken = process.env.INTERNAL_SERVICE_TOKEN;
    if (!internalToken) {
      return { success: false, message: 'Internal token not configured' };
    }

    const response = await fetch(`${WALLET_SERVICE_URL}/internal/transfer`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-internal-token': internalToken,
        'x-internal-service': 'adsqr-service',
      },
      body: JSON.stringify({
        fromUserId,
        toUserId,
        amount,
        coinType,
        reason,
        idempotencyKey: `adsqr_transfer_${fromUserId}_${toUserId}_${Date.now()}`,
      }),
    });

    const data = await response.json();

    if (data.success) {
      return {
        success: true,
        transactionId: data.data?.transactionId,
      };
    }

    return { success: false, message: data.message || 'Transfer failed' };
  } catch (error) {
    console.error('Transfer coins error:', error);
    return { success: false, message: 'Failed to transfer coins' };
  }
}

/**
 * Sync QR scan reward with eligibility check
 */
export async function syncScanRewardWithCheck(
  userId: string,
  campaignId: string,
  qrId: string,
  scanEventId: string,
  amount: number
): Promise<CreditResult & { reason?: string }> {
  // Check eligibility first
  const eligibility = await checkRewardEligibility(userId, 'scan', campaignId);

  if (!eligibility.eligible) {
    return {
      success: false,
      message: eligibility.reason || 'Daily scan reward limit reached',
    };
  }

  const result = await syncScanReward(userId, campaignId, qrId, scanEventId, amount);
  return {
    ...result,
    reason: result.success ? 'Reward credited' : 'Could not credit reward',
  };
}

/**
 * Batch credit multiple users (for campaign rewards)
 */
export async function batchCreditRewards(
  credits: Array<{
    userId: string;
    campaignId: string;
    amount: number;
    coinType?: string;
    reason: string;
  }>
): Promise<{ success: boolean; results: Array<{ userId: string; success: boolean; transactionId?: string; error?: string }> }> {
  try {
    const internalToken = process.env.INTERNAL_SERVICE_TOKEN;
    if (!internalToken) {
      return {
        success: false,
        results: credits.map(c => ({ userId: c.userId, success: false, error: 'Internal token not configured' })),
      };
    }

    const response = await fetch(`${WALLET_SERVICE_URL}/internal/batch-credit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-internal-token': internalToken,
        'x-internal-service': 'adsqr-service',
      },
      body: JSON.stringify({
        credits: credits.map(c => ({
          targetUserId: c.userId,
          amount: c.amount,
          coinType: c.coinType || 'rez',
          source: 'adsqr_campaign',
          reason: c.reason,
          campaignId: c.campaignId,
          idempotencyKey: `adsqr_batch_${c.campaignId}_${c.userId}_${Date.now()}`,
        })),
      }),
    });

    const data = await response.json();

    if (data.success && data.results) {
      return {
        success: true,
        results: data.results,
      };
    }

    return {
      success: false,
      results: credits.map(c => ({ userId: c.userId, success: false, error: 'Batch credit failed' })),
    };
  } catch (error) {
    console.error('Batch credit error:', error);
    return {
      success: false,
      results: credits.map(c => ({ userId: c.userId, success: false, error: 'Network error' })),
    };
  }
}

/**
 * Get wallet connection status
 */
export async function getWalletConnectionStatus(): Promise<{
  connected: boolean;
  walletType?: string;
  walletAddress?: string;
}> {
  try {
    const token = localStorage.getItem('adsqr_access_token');
    if (!token) {
      return { connected: false };
    }

    const response = await fetch(`${WALLET_SERVICE_URL}/api/wallet/status`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    const data = await response.json();

    if (data.success && data.data) {
      return data.data;
    }

    return { connected: false };
  } catch (error) {
    console.error('Get wallet status error:', error);
    return { connected: false };
  }
}
