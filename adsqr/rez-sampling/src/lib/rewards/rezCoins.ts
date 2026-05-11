/**
 * REZ Coins Reward System
 * Handles coin credits for scans, visits, and purchases
 */

import { creditCoinsToUser, getBalance, syncScanReward } from '../rezWallet';
import { createClient } from '../supabase';

// Types
export interface ScanRewardConfig {
  baseCoins: number;
  bonusMultiplier: number;
  dailyLimit: number;
  campaignMultipliers: Record<string, number>;
}

export interface CreditResult {
  success: boolean;
  amount?: number;
  transactionId?: string;
  balance?: number;
  message?: string;
}

export interface RewardEligibility {
  eligible: boolean;
  reason?: string;
  remainingDaily?: number;
}

// Default configuration
const DEFAULT_CONFIG: ScanRewardConfig = {
  baseCoins: 10,
  bonusMultiplier: 1.5,
  dailyLimit: 50,
  campaignMultipliers: {},
};

// Cache for daily rewards
const dailyRewardsCache = new Map<string, { date: string; count: number }>();

/**
 * Credit coins after QR scan
 */
export async function creditScanReward(
  userId: string,
  campaignId: string,
  qrId: string,
  scanEventId: string,
  config: ScanRewardConfig = DEFAULT_CONFIG
): Promise<CreditResult> {
  try {
    // Check eligibility first
    const eligibility = await checkScanEligibility(userId, config);
    if (!eligibility.eligible) {
      return { success: false, message: eligibility.reason };
    }

    // Calculate reward amount
    const multiplier = config.campaignMultipliers[campaignId] || 1;
    const amount = Math.floor(config.baseCoins * multiplier);

    // Update daily count
    updateDailyCount(userId);

    // Credit the coins
    const result = await creditCoinsToUser(
      userId,
      amount,
      'rez',
      'qr_scan',
      `Reward for scanning QR code`,
      { idempotencyKey: `scan_${scanEventId}` }
    );

    if (result.success) {
      // Record in local DB as backup
      await recordLocalTransaction(userId, campaignId, qrId, scanEventId, amount, 'scan');
    }

    return {
      success: result.success,
      amount,
      transactionId: result.transactionId,
      balance: typeof result.balance === 'number' ? result.balance : undefined,
      message: result.success ? `Credited ${amount} REZ coins!` : result.message,
    };
  } catch (error) {
    console.error('Credit scan reward error:', error);
    return { success: false, message: 'Failed to credit reward' };
  }
}

/**
 * Credit coins after store visit
 */
export async function creditVisitReward(
  userId: string,
  storeId: string,
  merchantId: string,
  visitId: string,
  baseCoins: number = 5
): Promise<CreditResult> {
  try {
    const result = await creditCoinsToUser(
      userId,
      baseCoins,
      'rez',
      'store_visit',
      `Reward for visiting store`,
      { merchantId, idempotencyKey: `visit_${visitId}` }
    );

    if (result.success) {
      await recordLocalTransaction(userId, undefined, undefined, visitId, baseCoins, 'visit', storeId, merchantId);
    }

    return {
      success: result.success,
      amount: baseCoins,
      transactionId: result.transactionId,
      message: result.success ? `Credited ${baseCoins} REZ coins for your visit!` : result.message,
    };
  } catch (error) {
    console.error('Credit visit reward error:', error);
    return { success: false, message: 'Failed to credit visit reward' };
  }
}

/**
 * Credit coins after purchase
 */
export async function creditPurchaseReward(
  userId: string,
  orderId: string,
  merchantId: string,
  purchaseAmount: number,
  rewardPercentage: number = 5
): Promise<CreditResult> {
  try {
    const coinsEarned = Math.floor(purchaseAmount * (rewardPercentage / 100));

    if (coinsEarned <= 0) {
      return { success: false, message: 'Purchase amount too low for reward' };
    }

    const result = await creditCoinsToUser(
      userId,
      coinsEarned,
      'rez',
      'purchase',
      `Cashback reward for purchase`,
      { merchantId, idempotencyKey: `purchase_${orderId}` }
    );

    if (result.success) {
      await recordLocalTransaction(userId, undefined, undefined, orderId, coinsEarned, 'purchase', undefined, merchantId);
    }

    return {
      success: result.success,
      amount: coinsEarned,
      transactionId: result.transactionId,
      message: result.success ? `Earned ${coinsEarned} REZ coins from your purchase!` : result.message,
    };
  } catch (error) {
    console.error('Credit purchase reward error:', error);
    return { success: false, message: 'Failed to credit purchase reward' };
  }
}

/**
 * Check if user is eligible for scan reward
 */
export async function checkScanEligibility(
  userId: string,
  config: ScanRewardConfig = DEFAULT_CONFIG
): Promise<RewardEligibility> {
  const today = new Date().toISOString().split('T')[0];
  const cached = dailyRewardsCache.get(userId);

  if (cached && cached.date === today) {
    if (cached.count >= config.dailyLimit) {
      return {
        eligible: false,
        reason: `Daily limit reached (${config.dailyLimit} scans per day)`,
        remainingDaily: 0,
      };
    }
    return {
      eligible: true,
      remainingDaily: config.dailyLimit - cached.count,
    };
  }

  // Check local DB for actual count
  try {
    const supabase = createClient();
    const startOfDay = `${today}T00:00:00`;
    const endOfDay = `${today}T23:59:59`;

    const { count } = await supabase
      .from('coin_transactions')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('reason', 'scan')
      .gte('created_at', startOfDay)
      .lte('created_at', endOfDay);

    const dailyCount = count || 0;

    if (dailyCount >= config.dailyLimit) {
      return {
        eligible: false,
        reason: `Daily limit reached (${config.dailyLimit} scans per day)`,
        remainingDaily: 0,
      };
    }

    return {
      eligible: true,
      remainingDaily: config.dailyLimit - dailyCount,
    };
  } catch (error) {
    console.error('Check eligibility error:', error);
    return { eligible: true };
  }
}

/**
 * Update daily reward count in cache
 */
function updateDailyCount(userId: string): void {
  const today = new Date().toISOString().split('T')[0];
  const cached = dailyRewardsCache.get(userId);

  if (cached && cached.date === today) {
    cached.count++;
  } else {
    dailyRewardsCache.set(userId, { date: today, count: 1 });
  }
}

/**
 * Record transaction in local Supabase DB
 */
async function recordLocalTransaction(
  userId: string,
  campaignId: string | undefined,
  qrId: string | undefined,
  eventId: string,
  amount: number,
  reason: string,
  storeId?: string,
  merchantId?: string
): Promise<void> {
  try {
    const supabase = createClient();
    await supabase.from('coin_transactions').insert({
      user_id: userId,
      campaign_id: campaignId,
      qr_id: qrId,
      amount,
      coin_type: 'rez',
      reason,
      store_id: storeId,
      merchant_id: merchantId,
      transaction_id: eventId,
      created_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Record local transaction error:', error);
  }
}

/**
 * Get reward statistics for a user
 */
export async function getRewardStats(userId: string): Promise<{
  totalCoins: number;
  totalEarned: number;
  totalSpent: number;
  totalScans: number;
  totalVisits: number;
  totalPurchases: number;
} | null> {
  try {
    const supabase = createClient();

    // Get totals
    const { data: totals } = await supabase
      .from('coin_transactions')
      .select('amount, reason')
      .eq('user_id', userId);

    if (!totals) return null;

    let totalEarned = 0;
    let totalSpent = 0;
    let totalScans = 0;
    let totalVisits = 0;
    let totalPurchases = 0;

    for (const tx of totals) {
      if (tx.reason === 'scan' || tx.reason === 'visit' || tx.reason === 'purchase' || tx.reason === 'referral') {
        totalEarned += tx.amount;
        if (tx.reason === 'scan') totalScans++;
        if (tx.reason === 'visit') totalVisits++;
        if (tx.reason === 'purchase') totalPurchases++;
      } else if (tx.reason === 'redemption' || tx.reason === 'purchase_spend') {
        totalSpent += tx.amount;
      }
    }

    // Get current wallet balance
    const balance = await getBalance();
    const totalCoins = balance?.totalRezCoins || 0;

    return {
      totalCoins,
      totalEarned,
      totalSpent,
      totalScans,
      totalVisits,
      totalPurchases,
    };
  } catch (error) {
    console.error('Get reward stats error:', error);
    return null;
  }
}

/**
 * Calculate potential reward preview
 */
export function calculateRewardPreview(
  config: ScanRewardConfig,
  campaignId?: string
): { baseReward: number; bonusReward?: number; multiplier?: number } {
  const baseReward = config.baseCoins;

  if (campaignId && config.campaignMultipliers[campaignId]) {
    const multiplier = config.campaignMultipliers[campaignId];
    return {
      baseReward,
      bonusReward: Math.floor(baseReward * (multiplier - 1)),
      multiplier,
    };
  }

  return { baseReward };
}

/**
 * Get bonus coins for first-time actions
 */
export async function creditFirstTimeBonus(
  userId: string,
  actionType: 'first_scan' | 'first_visit' | 'first_purchase',
  bonusAmount: number = 50
): Promise<CreditResult> {
  const supabase = createClient();
  const bonusKey = `${actionType}_${userId}`;

  // Check if bonus already claimed (using localStorage in client)
  if (typeof window !== 'undefined') {
    const claimed = localStorage.getItem(`bonus_claimed_${bonusKey}`);
    if (claimed) {
      return { success: false, message: 'Bonus already claimed' };
    }
  }

  // Check in DB
  try {
    const { data: existing } = await supabase
      .from('coin_transactions')
      .select('id')
      .eq('user_id', userId)
      .eq('reason', actionType)
      .single();

    if (existing) {
      if (typeof window !== 'undefined') {
        localStorage.setItem(`bonus_claimed_${bonusKey}`, 'true');
      }
      return { success: false, message: 'Bonus already claimed' };
    }

    // Credit bonus
    const result = await creditCoinsToUser(
      userId,
      bonusAmount,
      'rez',
      actionType,
      `First-time bonus reward!`,
      { idempotencyKey: `first_${actionType}_${userId}` }
    );

    if (result.success) {
      // Record in local DB
      await recordLocalTransaction(userId, undefined, undefined, `first_${actionType}`, bonusAmount, actionType);
      if (typeof window !== 'undefined') {
        localStorage.setItem(`bonus_claimed_${bonusKey}`, 'true');
      }
    }

    return {
      success: result.success,
      amount: bonusAmount,
      transactionId: result.transactionId,
      message: result.success ? `Congratulations! You earned ${bonusAmount} bonus REZ coins!` : result.message,
    };
  } catch (error) {
    console.error('Credit first time bonus error:', error);
    return { success: false, message: 'Failed to credit bonus' };
  }
}
