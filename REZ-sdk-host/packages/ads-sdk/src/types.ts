/**
 * REZ Ads SDK Type Definitions
 */

// ============================================================================
// Configuration Types
// ============================================================================

export interface SDKConfig {
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
  /** User's age */
  age?: number;
  /** User's gender */
  gender?: 'male' | 'female' | 'other' | 'prefer-not-to-say';
  /** User's location */
  location?: {
    country?: string;
    city?: string;
    region?: string;
    coordinates?: {
      latitude: number;
      longitude: number;
    };
  };
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
  /** Custom timestamp (defaults to now) */
  timestamp?: number;
}

// ============================================================================
// Ad Types
// ============================================================================

export type AdSize =
  | '320x50'    // Banner
  | '320x100'   // Large Banner
  | '300x250'   // Medium Rectangle
  | '728x90'    // Leaderboard
  | 'full'      // Full screen interstitial
  | 'native'    // Native ad format
  | string;     // Custom size

export type AdPlacement =
  | 'home'
  | 'search'
  | 'product'
  | 'cart'
  | 'checkout'
  | 'profile'
  | 'settings'
  | 'splash'
  | 'between_levels'
  | 'rewarded_video'
  | 'interstitial'
  | string; // Custom placement

export interface AdTargeting {
  /** Desired ad categories */
  categories?: string[];
  /** Minimum age for content */
  minAge?: number;
  /** Keywords for contextual targeting */
  keywords?: string[];
  /** Preferred ad type */
  adType?: 'banner' | 'interstitial' | 'rewarded' | 'native';
  /** Custom targeting parameters */
  custom?: Record<string, string | string[]>;
}

export interface AdConfig {
  /** Ad placement location */
  placement: AdPlacement;
  /** Ad size */
  size: AdSize;
  /** Targeting options */
  targeting?: AdTargeting;
  /** Callback URL for ad events */
  callbackUrl?: string;
  /** Whether to auto-refresh the ad */
  autoRefresh?: boolean;
  /** Refresh interval in milliseconds */
  refreshInterval?: number;
}

export interface AdResponse {
  /** Unique ad identifier */
  adId: string;
  /** Campaign identifier */
  campaignId: string;
  /** Advertiser identifier */
  advertiserId: string;
  /** Ad creative content */
  creative: AdCreative;
  /** Ad type */
  type: 'banner' | 'interstitial' | 'rewarded' | 'native';
  /** Whether the ad is a video */
  isVideo: boolean;
  /** Video duration in seconds (if video ad) */
  duration?: number;
  /** Impression URL */
  impressionUrl?: string;
  /** Click URL */
  clickUrl?: string;
  /** Whether ad can be skipped */
  skippable?: boolean;
  /** Skip offset in seconds */
  skipOffset?: number;
  /** Rewards for watching (if rewarded ad) */
  reward?: {
    type: string;
    amount: number;
  };
  /** Metadata */
  metadata?: Record<string, unknown>;
}

export interface AdCreative {
  /** Main headline */
  headline?: string;
  /** Ad body text */
  body?: string;
  /** Call to action text */
  ctaText?: string;
  /** Image URL */
  imageUrl?: string;
  /** Video URL (if video ad) */
  videoUrl?: string;
  /** Icon URL */
  iconUrl?: string;
  /** Ad choices icon URL */
  adChoicesIconUrl?: string;
  /** Star rating */
  rating?: number;
  /** Price information */
  price?: string;
  /** Sale price */
  salePrice?: string;
  /** App store information */
  appStore?: {
    appId?: string;
    packageName?: string;
    rating?: number;
    reviews?: number;
  };
}

// ============================================================================
// SDK Instance Type
// ============================================================================

export interface REZAdsSDK {
  init(config?: Partial<SDKConfig>): Promise<void>;
  isInitialized(): boolean;
  getUser(): User | null;
  setUser(user: User): void;
  clearUser(): void;
  trackEvent(eventName: string, data?: EventData, options?: TrackEventOptions): Promise<void>;
  showAd(config: AdConfig): Promise<AdResponse>;
  preloadAd(placement: AdPlacement): Promise<AdResponse | null>;
  requestAd(placement: AdPlacement, adType: 'banner' | 'interstitial' | 'rewarded' | 'native'): Promise<AdResponse>;
  dismissAd(adId: string): Promise<void>;
  reportAdInteraction(adId: string, interactionType: 'click' | 'view' | 'skip' | 'complete'): Promise<void>;
  isAdReady(placement: AdPlacement): Promise<boolean>;
  updateTargetingAttributes(attributes: Record<string, unknown>): Promise<void>;
  getAdPreferences(): Promise<{ optedOut: boolean; categories: string[] }>;
  setAdPreferences(preferences: { optedOut?: boolean; categories?: string[] }): Promise<void>;
}

// ============================================================================
// Global Declaration
// ============================================================================

declare global {
  interface Window {
    REZAdsSDK?: REZAdsSDK;
  }
}
