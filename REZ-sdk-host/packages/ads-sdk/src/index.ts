/**
 * REZ Ads SDK
 * SDK for integrating REZ advertising services into 3rd party applications
 */

import type {
  AdConfig,
  AdPlacement,
  AdSize,
  AdResponse,
  User,
  EventData,
  SDKConfig,
  TrackEventOptions,
} from './types';

// ============================================================================
// Type Exports
// ============================================================================

export type {
  AdConfig,
  AdPlacement,
  AdSize,
  AdResponse,
  User,
  EventData,
  SDKConfig,
  TrackEventOptions,
};

// ============================================================================
// SDK Instance State
// ============================================================================

let sdkInitialized = false;
let sdkConfig: SDKConfig | null = null;
let currentUser: User | null = null;

// ============================================================================
// Configuration
// ============================================================================

const DEFAULT_CONFIG: SDKConfig = {
  apiBaseUrl: 'https://api.rez-media.com',
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
 * Initialize the REZ Ads SDK
 * Must be called before any other SDK functions
 */
export async function init(config: Partial<SDKConfig> = {}): Promise<void> {
  if (sdkInitialized) {
    console.warn('REZ Ads SDK: Already initialized');
    return;
  }

  sdkConfig = {
    ...DEFAULT_CONFIG,
    ...config,
  };

  // Validate configuration
  if (!sdkConfig.apiBaseUrl) {
    throw new Error('apiBaseUrl is required');
  }

  sdkInitialized = true;
  console.log('REZ Ads SDK initialized successfully');
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
    console.error('REZ Ads SDK: Failed to track event', error);
    throw error;
  }
}

// ============================================================================
// Ad Functions
// ============================================================================

/**
 * Ad placement types
 */
export type AdPlacementType =
  | 'banner'
  | 'interstitial'
  | 'rewarded'
  | 'native'
  | 'splash';

/**
 * Show an ad to the user
 */
export async function showAd(config: AdConfig): Promise<AdResponse> {
  if (!sdkInitialized) {
    throw new Error('SDK not initialized. Call init() first.');
  }

  const adRequest = {
    placement: config.placement,
    size: config.size,
    userId: currentUser?.id,
    targeting: config.targeting,
    callbackUrl: config.callbackUrl,
  };

  try {
    const response = await request<AdResponse>('/api/ads/show', {
      method: 'POST',
      body: JSON.stringify(adRequest),
    });

    // Track ad impression
    await trackEvent('ad_impression', {
      adId: response.adId,
      placement: config.placement,
      campaignId: response.campaignId,
    });

    return response;
  } catch (error) {
    console.error('REZ Ads SDK: Failed to show ad', error);
    throw error;
  }
}

/**
 * Load an ad without showing it
 */
export async function preloadAd(placement: AdPlacement): Promise<AdResponse | null> {
  if (!sdkInitialized) {
    throw new Error('SDK not initialized. Call init() first.');
  }

  try {
    const response = await request<AdResponse | null>('/api/ads/preload', {
      method: 'POST',
      body: JSON.stringify({
        placement,
        userId: currentUser?.id,
      }),
    });

    return response;
  } catch (error) {
    console.error('REZ Ads SDK: Failed to preload ad', error);
    return null;
  }
}

/**
 * Report an ad interaction
 */
export async function reportAdInteraction(
  adId: string,
  interactionType: 'click' | 'view' | 'skip' | 'complete'
): Promise<void> {
  if (!sdkInitialized) {
    throw new Error('SDK not initialized. Call init() first.');
  }

  await trackEvent(`ad_${interactionType}`, {
    adId,
    interactionType,
  });

  try {
    await request('/api/ads/interaction', {
      method: 'POST',
      body: JSON.stringify({
        adId,
        interactionType,
        userId: currentUser?.id,
        timestamp: Date.now(),
      }),
    });
  } catch (error) {
    console.error('REZ Ads SDK: Failed to report interaction', error);
  }
}

/**
 * Check if an ad is ready for the given placement
 */
export async function isAdReady(placement: AdPlacement): Promise<boolean> {
  if (!sdkInitialized) {
    return false;
  }

  try {
    const response = await request<{ ready: boolean }>('/api/ads/ready', {
      method: 'POST',
      body: JSON.stringify({
        placement,
        userId: currentUser?.id,
      }),
    });

    return response.ready;
  } catch {
    return false;
  }
}

/**
 * Request a specific ad type
 */
export async function requestAd(
  placement: AdPlacement,
  adType: 'banner' | 'interstitial' | 'rewarded' | 'native'
): Promise<AdResponse> {
  if (!sdkInitialized) {
    throw new Error('SDK not initialized. Call init() first.');
  }

  const response = await showAd({
    placement,
    size: adType === 'banner' ? '320x50' : adType === 'interstitial' ? 'full' : 'native',
    targeting: {
      adType,
    },
  });

  return response;
}

/**
 * Dismiss/hide the current ad
 */
export async function dismissAd(adId: string): Promise<void> {
  if (!sdkInitialized) {
    throw new Error('SDK not initialized. Call init() first.');
  }

  await trackEvent('ad_dismiss', { adId });

  try {
    await request('/api/ads/dismiss', {
      method: 'POST',
      body: JSON.stringify({
        adId,
        userId: currentUser?.id,
      }),
    });
  } catch (error) {
    console.error('REZ Ads SDK: Failed to dismiss ad', error);
  }
}

// ============================================================================
// Targeting & Preferences
// ============================================================================

/**
 * Update user targeting attributes
 */
export async function updateTargetingAttributes(
  attributes: Record<string, unknown>
): Promise<void> {
  if (!sdkInitialized) {
    throw new Error('SDK not initialized. Call init() first.');
  }

  try {
    await request('/api/ads/targeting', {
      method: 'PUT',
      body: JSON.stringify({
        userId: currentUser?.id,
        attributes,
      }),
    });
  } catch (error) {
    console.error('REZ Ads SDK: Failed to update targeting', error);
    throw error;
  }
}

/**
 * Get user's ad preferences
 */
export async function getAdPreferences(): Promise<{
  optedOut: boolean;
  categories: string[];
}> {
  if (!sdkInitialized) {
    throw new Error('SDK not initialized. Call init() first.');
  }

  try {
    const response = await request<{ optedOut: boolean; categories: string[] }>(
      `/api/ads/preferences?userId=${currentUser?.id}`
    );
    return response;
  } catch (error) {
    console.error('REZ Ads SDK: Failed to get preferences', error);
    throw error;
  }
}

/**
 * Set user's ad preferences
 */
export async function setAdPreferences(preferences: {
  optedOut?: boolean;
  categories?: string[];
}): Promise<void> {
  if (!sdkInitialized) {
    throw new Error('SDK not initialized. Call init() first.');
  }

  try {
    await request('/api/ads/preferences', {
      method: 'POST',
      body: JSON.stringify({
        userId: currentUser?.id,
        ...preferences,
      }),
    });
  } catch (error) {
    console.error('REZ Ads SDK: Failed to set preferences', error);
    throw error;
  }
}

// ============================================================================
// SDK Version Info
// ============================================================================

export const SDK_VERSION = '1.0.0';
export const SDK_NAME = '@rez-app/ads-sdk';

// ============================================================================
// Default export
// ============================================================================

const adsSDK = {
  init,
  isInitialized,
  getUser,
  setUser,
  clearUser,
  trackEvent,
  showAd,
  preloadAd,
  requestAd,
  dismissAd,
  reportAdInteraction,
  isAdReady,
  updateTargetingAttributes,
  getAdPreferences,
  setAdPreferences,
  SDK_VERSION,
  SDK_NAME,
};

export default adsSDK;
