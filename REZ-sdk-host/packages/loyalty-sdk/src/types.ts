/**
 * REZ Loyalty SDK Type Definitions
 */

// ============================================================================
// Configuration Types
// ============================================================================

export interface LoyaltyConfig {
  /** Base URL for API requests */
  apiBaseUrl: string;
  /** Environment: 'development' | 'staging' | 'production' */
  environment: 'development' | 'staging' | 'production';
  /** Request timeout in milliseconds */
  timeout: number;
  /** Number of retry attempts for failed requests */
  retries: number;
  /** Session ID for tracking */
  sessionId?: string;
  /** Enable debug logging */
  debug?: boolean;
}

// ============================================================================
// User Types
// ============================================================================

export interface User {
  /** Unique user identifier */
  id: string;
  /** User's email address */
  email?: string;
  /** User's display name */
  name?: string;
  /** User's phone number */
  phone?: string;
  /** Custom user metadata */
  metadata?: Record<string, unknown>;
}

// ============================================================================
// Event Types
// ============================================================================

export interface EventData {
  /** Event properties */
  [key: string]: unknown;
}

export interface TrackEventOptions {
  /** Whether to persist this event */
  persist?: boolean;
  /** Event priority */
  priority?: 'low' | 'normal' | 'high';
  /** Custom timestamp */
  timestamp?: number;
}

// ============================================================================
// Points Types
// ============================================================================

export interface PointsTransaction {
  /** Transaction ID */
  id: string;
  /** User ID */
  userId: string;
  /** Transaction type */
  type: 'earned' | 'redeemed' | 'expired' | 'bonus' | 'adjustment';
  /** Points amount (negative for redemption) */
  points: number;
  /** Points balance after transaction */
  balanceAfter: number;
  /** Action that triggered the transaction */
  action?: string;
  /** Description of the transaction */
  description: string;
  /** Reference entity ID (e.g., order ID) */
  referenceId?: string;
  /** Reference entity type */
  referenceType?: string;
  /** Tier name at time of transaction */
  tierName?: string;
  /** Transaction timestamp */
  timestamp: number;
  /** Transaction expiry date */
  expiresAt?: number;
  /** Whether points are pending */
  pending?: boolean;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

export interface EarnOptions {
  /** Points to earn (calculated if not provided) */
  points?: number;
  /** Point multiplier */
  multiplier?: number;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
  /** Reference entity ID */
  referenceId?: string;
  /** Reference entity type */
  referenceType?: string;
}

export interface RedeemOptions {
  /** Quantity to redeem */
  quantity?: number;
  /** Expected points cost (validated server-side) */
  pointsCost?: number;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

// ============================================================================
// Tier Types
// ============================================================================

export interface Tier {
  /** Tier ID */
  id: string;
  /** Tier name */
  name: string;
  /** Tier level (1 = lowest) */
  level: number;
  /** Minimum points for this tier */
  minPoints: number;
  /** Maximum points for this tier (null for highest tier) */
  maxPoints?: number;
  /** Benefits included in this tier */
  benefits: string[];
  /** Benefits with points values */
  benefitsWithPoints?: Record<string, number>;
  /** Tier color for UI */
  color?: string;
  /** Tier icon URL */
  iconUrl?: string;
}

// ============================================================================
// Loyalty Profile Types
// ============================================================================

export interface LoyaltyProfile {
  /** User ID */
  userId: string;
  /** Current points balance */
  points: number;
  /** Pending points (not yet credited) */
  pendingPoints: number;
  /** Lifetime points earned */
  lifetimePoints: number;
  /** Points expiring soon */
  expiringPoints?: {
    amount: number;
    expiresAt: number;
  };
  /** Current tier */
  tier: Tier;
  /** Join date */
  memberSince: number;
  /** Total redemptions */
  totalRedemptions: number;
  /** Total rewards earned */
  totalRewardsEarned: number;
  /** Referral code */
  referralCode?: string;
  /** Referral count */
  referralCount?: number;
  /** Last activity timestamp */
  lastActivity?: number;
  /** Achievement badges */
  badges?: string[];
}

// ============================================================================
// Reward Types
// ============================================================================

export interface Reward {
  /** Reward ID */
  id: string;
  /** Reward name */
  name: string;
  /** Reward description */
  description: string;
  /** Points cost */
  pointsCost: number;
  /** Original price (if discounted) */
  originalPrice?: number;
  /** Reward category */
  category: string;
  /** Reward type */
  type: 'product' | 'voucher' | 'discount' | 'experience' | 'gift-card';
  /** Reward image URL */
  imageUrl?: string;
  /** Reward thumbnail URL */
  thumbnailUrl?: string;
  /** Stock status */
  stockStatus: 'in_stock' | 'low_stock' | 'out_of_stock';
  /** Available quantity */
  stockQuantity?: number;
  /** Minimum tier required */
  minTierLevel?: number;
  /** Redemption limit per user */
  maxRedemptionsPerUser?: number;
  /** User's redemption count */
  userRedemptionCount?: number;
  /** Validity period */
  validFrom?: number;
  /** Expiry date */
  expiresAt?: number;
  /** Terms and conditions */
  terms?: string;
  /** How to redeem */
  redemptionMethod: 'code' | 'coupon' | 'link' | 'in_app' | 'instant';
  /** Partner information */
  partner?: {
    id: string;
    name: string;
    logoUrl?: string;
  };
  /** Metadata */
  metadata?: Record<string, unknown>;
}

// ============================================================================
// Offer Types
// ============================================================================

export interface Offer {
  /** Offer ID */
  id: string;
  /** Offer title */
  title: string;
  /** Offer description */
  description: string;
  /** Offer type */
  type: 'discount' | 'bonus_points' | 'free_item' | 'cashback' | 'bogo';
  /** Offer category */
  category: string;
  /** Whether offer is featured */
  featured: boolean;
  /** Offer image URL */
  imageUrl?: string;
  /** Minimum points required */
  minPoints?: number;
  /** Points multiplier (for bonus points offers) */
  multiplier?: number;
  /** Discount percentage */
  discountPercent?: number;
  /** Maximum discount amount */
  maxDiscount?: number;
  /** Offer validity */
  validFrom: number;
  /** Expiry date */
  expiresAt: number;
  /** Terms and conditions */
  terms?: string;
  /** Claim count */
  claimCount?: number;
  /** Maximum claims */
  maxClaims?: number;
  /** User's claim status */
  userClaimed?: boolean;
  /** Claim code (if claimed) */
  claimCode?: string;
  /** Partner information */
  partner?: {
    id: string;
    name: string;
    logoUrl?: string;
  };
  /** Metadata */
  metadata?: Record<string, unknown>;
}

// ============================================================================
// SDK Instance Type
// ============================================================================

export interface REZLoyaltySDK {
  init(config?: Partial<LoyaltyConfig>): Promise<void>;
  isInitialized(): boolean;
  getUser(): User | null;
  setUser(user: User): void;
  clearUser(): void;
  trackEvent(eventName: string, data?: EventData, options?: TrackEventOptions): Promise<void>;
  getLoyaltyProfile(): Promise<LoyaltyProfile>;
  getPointsBalance(): Promise<{ points: number; pendingPoints: number; lifetimePoints: number; currency: string }>;
  earnPoints(action: string, options?: EarnOptions): Promise<PointsTransaction>;
  redeemPoints(rewardId: string, options?: RedeemOptions): Promise<{ success: boolean; transaction: PointsTransaction; reward: Reward }>;
  getPointsHistory(options?: { limit?: number; offset?: number; type?: 'earned' | 'redeemed' | 'expired' | 'all' }): Promise<{ transactions: PointsTransaction[]; total: number; hasMore: boolean }>;
  getRewards(options?: { category?: string; pointsMin?: number; pointsMax?: number; limit?: number }): Promise<Reward[]>;
  getRewardDetails(rewardId: string): Promise<Reward>;
  canRedeem(rewardId: string): Promise<{ canRedeem: boolean; reason?: string; pointsNeeded?: number }>;
  getOffers(options?: { category?: string; featured?: boolean; limit?: number }): Promise<Offer[]>;
  claimOffer(offerId: string): Promise<{ success: boolean; claimCode?: string; expiresAt?: number }>;
  getTierInfo(): Promise<{ currentTier: Tier; nextTier?: Tier; progress: number; pointsToNextTier: number }>;
  getTierBenefits(): Promise<Tier[]>;
  getReferralCode(): Promise<{ code: string; shareUrl: string; rewards: { referrerPoints: number; refereePoints: number } }>;
  applyReferralCode(code: string): Promise<{ success: boolean; bonusAwarded: number }>;
}

// ============================================================================
// Global Declaration
// ============================================================================

declare global {
  interface Window {
    REZLoyaltySDK?: REZLoyaltySDK;
  }
}
