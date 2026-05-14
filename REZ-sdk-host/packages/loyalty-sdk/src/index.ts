/**
 * REZ Loyalty SDK
 * SDK for integrating REZ loyalty and rewards services into 3rd party applications
 */

import type {
  LoyaltyConfig,
  User,
  LoyaltyProfile,
  PointsTransaction,
  Reward,
  Offer,
  Tier,
  EventData,
  TrackEventOptions,
  RedeemOptions,
  EarnOptions,
} from './types';

// ============================================================================
// Type Exports
// ============================================================================

export type {
  LoyaltyConfig,
  User,
  LoyaltyProfile,
  PointsTransaction,
  Reward,
  Offer,
  Tier,
  EventData,
  TrackEventOptions,
  RedeemOptions,
  EarnOptions,
};

// ============================================================================
// SDK Instance State
// ============================================================================

let sdkInitialized = false;
let sdkConfig: LoyaltyConfig | null = null;
let currentUser: User | null = null;

// ============================================================================
// Configuration
// ============================================================================

const DEFAULT_CONFIG: LoyaltyConfig = {
  apiBaseUrl: 'https://api.rez-media.com/loyalty',
  environment: 'production',
  timeout: 30000,
  retries: 3,
};

// ============================================================================
// Internal Utilities
// ============================================================================

async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  if (!sdkConfig) {
    throw new Error('SDK not initialized. Call init() first.');
  }

  const url = `${sdkConfig.apiBaseUrl}${endpoint}`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), sdkConfig.timeout);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        'X-Rez-SDK-Version': '1.0.0',
        ...options.headers,
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return response.json();
  } finally {
    clearTimeout(timeoutId);
  }
}

// ============================================================================
// Core SDK Functions
// ============================================================================

/**
 * Initialize the REZ Loyalty SDK
 * Must be called before any other SDK functions
 */
export async function init(config: Partial<LoyaltyConfig> = {}): Promise<void> {
  if (sdkInitialized) {
    console.warn('REZ Loyalty SDK: Already initialized');
    return;
  }

  sdkConfig = {
    ...DEFAULT_CONFIG,
    ...config,
  };

  if (!sdkConfig.apiBaseUrl) {
    throw new Error('apiBaseUrl is required');
  }

  sdkInitialized = true;
  console.log('REZ Loyalty SDK initialized successfully');
}

/**
 * Check if SDK is initialized
 */
export function isInitialized(): boolean {
  return sdkInitialized;
}

/**
 * Get current user data
 */
export function getUser(): User | null {
  return currentUser;
}

/**
 * Set current user (call after user login/authentication)
 */
export function setUser(user: User): void {
  currentUser = user;
}

/**
 * Clear user data (call on logout)
 */
export function clearUser(): void {
  currentUser = null;
}

// ============================================================================
// Event Tracking
// ============================================================================

/**
 * Track a custom event
 */
export async function trackEvent(
  eventName: string,
  data?: EventData,
  options?: TrackEventOptions
): Promise<void> {
  if (!sdkInitialized) {
    throw new Error('SDK not initialized. Call init() first.');
  }

  const eventPayload = {
    event: eventName,
    timestamp: Date.now(),
    userId: currentUser?.id,
    sessionId: sdkConfig?.sessionId,
    data: data ?? {},
    options,
  };

  try {
    await request('/api/events/track', {
      method: 'POST',
      body: JSON.stringify(eventPayload),
    });
  } catch (error) {
    console.error('REZ Loyalty SDK: Failed to track event', error);
    throw error;
  }
}

// ============================================================================
// Loyalty Profile
// ============================================================================

/**
 * Get user's loyalty profile
 */
export async function getLoyaltyProfile(): Promise<LoyaltyProfile> {
  if (!sdkInitialized) {
    throw new Error('SDK not initialized. Call init() first.');
  }

  if (!currentUser?.id) {
    throw new Error('User not set. Call setUser() first.');
  }

  try {
    const profile = await request<LoyaltyProfile>(
      `/api/loyalty/profile/${currentUser.id}`
    );

    // Track profile view
    await trackEvent('loyalty_profile_viewed');

    return profile;
  } catch (error) {
    console.error('REZ Loyalty SDK: Failed to get profile', error);
    throw error;
  }
}

/**
 * Get user's current points balance
 */
export async function getPointsBalance(): Promise<{
  points: number;
  pendingPoints: number;
  lifetimePoints: number;
  currency: string;
}> {
  if (!sdkInitialized) {
    throw new Error('SDK not initialized. Call init() first.');
  }

  if (!currentUser?.id) {
    throw new Error('User not set. Call setUser() first.');
  }

  try {
    const balance = await request<{
      points: number;
      pendingPoints: number;
      lifetimePoints: number;
      currency: string;
    }>(`/api/loyalty/points/${currentUser.id}`);

    return balance;
  } catch (error) {
    console.error('REZ Loyalty SDK: Failed to get points balance', error);
    throw error;
  }
}

// ============================================================================
// Points Operations
// ============================================================================

/**
 * Earn points for an action
 */
export async function earnPoints(
  action: string,
  options: EarnOptions = {}
): Promise<PointsTransaction> {
  if (!sdkInitialized) {
    throw new Error('SDK not initialized. Call init() first.');
  }

  if (!currentUser?.id) {
    throw new Error('User not set. Call setUser() first.');
  }

  const transaction = {
    userId: currentUser.id,
    action,
    points: options.points ?? 0,
    multiplier: options.multiplier ?? 1,
    metadata: options.metadata ?? {},
    referenceId: options.referenceId,
    referenceType: options.referenceType,
  };

  try {
    const result = await request<PointsTransaction>('/api/loyalty/earn', {
      method: 'POST',
      body: JSON.stringify(transaction),
    });

    // Track points earned
    await trackEvent('points_earned', {
      action,
      points: result.points,
      totalPoints: result.balanceAfter,
      tier: result.tierName,
    });

    return result;
  } catch (error) {
    console.error('REZ Loyalty SDK: Failed to earn points', error);
    throw error;
  }
}

/**
 * Redeem points for a reward
 */
export async function redeemPoints(
  rewardId: string,
  options: RedeemOptions = {}
): Promise<{
  success: boolean;
  transaction: PointsTransaction;
  reward: Reward;
}> {
  if (!sdkInitialized) {
    throw new Error('SDK not initialized. Call init() first.');
  }

  if (!currentUser?.id) {
    throw new Error('User not set. Call setUser() first.');
  }

  const redemption = {
    userId: currentUser.id,
    rewardId,
    quantity: options.quantity ?? 1,
    pointsCost: options.pointsCost,
    metadata: options.metadata ?? {},
  };

  try {
    const result = await request<{
      success: boolean;
      transaction: PointsTransaction;
      reward: Reward;
    }>('/api/loyalty/redeem', {
      method: 'POST',
      body: JSON.stringify(redemption),
    });

    // Track redemption
    await trackEvent('points_redeemed', {
      rewardId,
      rewardName: result.reward.name,
      points: result.transaction.points,
      remainingPoints: result.transaction.balanceAfter,
    });

    return result;
  } catch (error) {
    console.error('REZ Loyalty SDK: Failed to redeem points', error);
    throw error;
  }
}

/**
 * Get points transaction history
 */
export async function getPointsHistory(
  options: {
    limit?: number;
    offset?: number;
    type?: 'earned' | 'redeemed' | 'expired' | 'all';
  } = {}
): Promise<{
  transactions: PointsTransaction[];
  total: number;
  hasMore: boolean;
}> {
  if (!sdkInitialized) {
    throw new Error('SDK not initialized. Call init() first.');
  }

  if (!currentUser?.id) {
    throw new Error('User not set. Call setUser() first.');
  }

  const params = new URLSearchParams({
    limit: String(options.limit ?? 20),
    offset: String(options.offset ?? 0),
    type: options.type ?? 'all',
  });

  try {
    const history = await request<{
      transactions: PointsTransaction[];
      total: number;
      hasMore: boolean;
    }>(`/api/loyalty/history/${currentUser.id}?${params}`);

    return history;
  } catch (error) {
    console.error('REZ Loyalty SDK: Failed to get history', error);
    throw error;
  }
}

// ============================================================================
// Rewards
// ============================================================================

/**
 * Get available rewards
 */
export async function getRewards(options: {
  category?: string;
  pointsMin?: number;
  pointsMax?: number;
  limit?: number;
} = {}): Promise<Reward[]> {
  if (!sdkInitialized) {
    throw new Error('SDK not initialized. Call init() first.');
  }

  const params = new URLSearchParams();
  if (options.category) params.set('category', options.category);
  if (options.pointsMin) params.set('pointsMin', String(options.pointsMin));
  if (options.pointsMax) params.set('pointsMax', String(options.pointsMax));
  if (options.limit) params.set('limit', String(options.limit));

  try {
    const rewards = await request<Reward[]>(`/api/loyalty/rewards?${params}`);
    return rewards;
  } catch (error) {
    console.error('REZ Loyalty SDK: Failed to get rewards', error);
    throw error;
  }
}

/**
 * Get reward details
 */
export async function getRewardDetails(rewardId: string): Promise<Reward> {
  if (!sdkInitialized) {
    throw new Error('SDK not initialized. Call init() first.');
  }

  try {
    const reward = await request<Reward>(`/api/loyalty/rewards/${rewardId}`);

    // Track reward viewed
    await trackEvent('reward_viewed', {
      rewardId,
      rewardName: reward.name,
      pointsCost: reward.pointsCost,
    });

    return reward;
  } catch (error) {
    console.error('REZ Loyalty SDK: Failed to get reward details', error);
    throw error;
  }
}

/**
 * Check if user can redeem a reward
 */
export async function canRedeem(
  rewardId: string
): Promise<{
  canRedeem: boolean;
  reason?: string;
  pointsNeeded?: number;
}> {
  if (!sdkInitialized) {
    throw new Error('SDK not initialized. Call init() first.');
  }

  if (!currentUser?.id) {
    throw new Error('User not set. Call setUser() first.');
  }

  try {
    const result = await request<{
      canRedeem: boolean;
      reason?: string;
      pointsNeeded?: number;
    }>(`/api/loyalty/rewards/${rewardId}/can-redeem?userId=${currentUser.id}`);

    return result;
  } catch (error) {
    console.error('REZ Loyalty SDK: Failed to check redeem eligibility', error);
    throw error;
  }
}

// ============================================================================
// Offers
// ============================================================================

/**
 * Get available offers for the user
 */
export async function getOffers(options: {
  category?: string;
  featured?: boolean;
  limit?: number;
} = {}): Promise<Offer[]> {
  if (!sdkInitialized) {
    throw new Error('SDK not initialized. Call init() first.');
  }

  if (!currentUser?.id) {
    throw new Error('User not set. Call setUser() first.');
  }

  const params = new URLSearchParams({ userId: currentUser.id });
  if (options.category) params.set('category', options.category);
  if (options.featured !== undefined) params.set('featured', String(options.featured));
  if (options.limit) params.set('limit', String(options.limit));

  try {
    const offers = await request<Offer[]>(`/api/loyalty/offers?${params}`);
    return offers;
  } catch (error) {
    console.error('REZ Loyalty SDK: Failed to get offers', error);
    throw error;
  }
}

/**
 * Claim an offer
 */
export async function claimOffer(offerId: string): Promise<{
  success: boolean;
  claimCode?: string;
  expiresAt?: number;
}> {
  if (!sdkInitialized) {
    throw new Error('SDK not initialized. Call init() first.');
  }

  if (!currentUser?.id) {
    throw new Error('User not set. Call setUser() first.');
  }

  try {
    const result = await request<{
      success: boolean;
      claimCode?: string;
      expiresAt?: number;
    }>('/api/loyalty/offers/claim', {
      method: 'POST',
      body: JSON.stringify({
        offerId,
        userId: currentUser.id,
      }),
    });

    // Track offer claimed
    await trackEvent('offer_claimed', {
      offerId,
      userId: currentUser.id,
    });

    return result;
  } catch (error) {
    console.error('REZ Loyalty SDK: Failed to claim offer', error);
    throw error;
  }
}

// ============================================================================
// Tier Information
// ============================================================================

/**
 * Get tier information
 */
export async function getTierInfo(): Promise<{
  currentTier: Tier;
  nextTier?: Tier;
  progress: number;
  pointsToNextTier: number;
}> {
  if (!sdkInitialized) {
    throw new Error('SDK not initialized. Call init() first.');
  }

  if (!currentUser?.id) {
    throw new Error('User not set. Call setUser() first.');
  }

  try {
    const tierInfo = await request<{
      currentTier: Tier;
      nextTier?: Tier;
      progress: number;
      pointsToNextTier: number;
    }>(`/api/loyalty/tier/${currentUser.id}`);

    return tierInfo;
  } catch (error) {
    console.error('REZ Loyalty SDK: Failed to get tier info', error);
    throw error;
  }
}

/**
 * Get all tier benefits
 */
export async function getTierBenefits(): Promise<Tier[]> {
  if (!sdkInitialized) {
    throw new Error('SDK not initialized. Call init() first.');
  }

  try {
    const tiers = await request<Tier[]>('/api/loyalty/tiers');
    return tiers;
  } catch (error) {
    console.error('REZ Loyalty SDK: Failed to get tier benefits', error);
    throw error;
  }
}

// ============================================================================
// Referral
// ============================================================================

/**
 * Get user's referral code
 */
export async function getReferralCode(): Promise<{
  code: string;
  shareUrl: string;
  rewards: {
    referrerPoints: number;
    refereePoints: number;
  };
}> {
  if (!sdkInitialized) {
    throw new Error('SDK not initialized. Call init() first.');
  }

  if (!currentUser?.id) {
    throw new Error('User not set. Call setUser() first.');
  }

  try {
    const referral = await request<{
      code: string;
      shareUrl: string;
      rewards: {
        referrerPoints: number;
        refereePoints: number;
      };
    }>(`/api/loyalty/referral/${currentUser.id}`);

    return referral;
  } catch (error) {
    console.error('REZ Loyalty SDK: Failed to get referral code', error);
    throw error;
  }
}

/**
 * Apply a referral code
 */
export async function applyReferralCode(code: string): Promise<{
  success: boolean;
  bonusAwarded: number;
}> {
  if (!sdkInitialized) {
    throw new Error('SDK not initialized. Call init() first.');
  }

  if (!currentUser?.id) {
    throw new Error('User not set. Call setUser() first.');
  }

  try {
    const result = await request<{
      success: boolean;
      bonusAwarded: number;
    }>('/api/loyalty/referral/apply', {
      method: 'POST',
      body: JSON.stringify({
        code,
        userId: currentUser.id,
      }),
    });

    // Track referral applied
    await trackEvent('referral_applied', {
      code,
      bonusAwarded: result.bonusAwarded,
    });

    return result;
  } catch (error) {
    console.error('REZ Loyalty SDK: Failed to apply referral code', error);
    throw error;
  }
}

// ============================================================================
// SDK Version Info
// ============================================================================

export const SDK_VERSION = '1.0.0';
export const SDK_NAME = '@rez-app/loyalty-sdk';

// ============================================================================
// Default export
// ============================================================================

const loyaltySDK = {
  init,
  isInitialized,
  getUser,
  setUser,
  clearUser,
  trackEvent,
  getLoyaltyProfile,
  getPointsBalance,
  earnPoints,
  redeemPoints,
  getPointsHistory,
  getRewards,
  getRewardDetails,
  canRedeem,
  getOffers,
  claimOffer,
  getTierInfo,
  getTierBenefits,
  getReferralCode,
  applyReferralCode,
  SDK_VERSION,
  SDK_NAME,
};

export default loyaltySDK;
