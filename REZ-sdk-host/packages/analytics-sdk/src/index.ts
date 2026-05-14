/**
 * REZ Analytics SDK
 * SDK for integrating REZ analytics and tracking services into 3rd party applications
 */

import type {
  AnalyticsConfig,
  User,
  EventData,
  TrackEventOptions,
  ScreenView,
  UserProperties,
  ConversionData,
  FunnelStep,
  CohortConfig,
  ABTestConfig,
} from './types';

// ============================================================================
// Type Exports
// ============================================================================

export type {
  AnalyticsConfig,
  User,
  EventData,
  TrackEventOptions,
  ScreenView,
  UserProperties,
  ConversionData,
  FunnelStep,
  CohortConfig,
  ABTestConfig,
};

// ============================================================================
// SDK Instance State
// ============================================================================

let sdkInitialized = false;
let sdkConfig: AnalyticsConfig | null = null;
let currentUser: User | null = null;
let eventQueue: Array<{ event: string; data?: EventData; timestamp: number }> = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;
const SESSION_TIMEOUT = 1800000; // 30 minutes

// ============================================================================
// Configuration
// ============================================================================

const DEFAULT_CONFIG: AnalyticsConfig = {
  apiBaseUrl: 'https://api.rez-media.com/analytics',
  environment: 'production',
  timeout: 30000,
  batchSize: 20,
  flushInterval: 5000,
  retries: 3,
  sessionTimeout: SESSION_TIMEOUT,
  trackSession: true,
  trackPageViews: true,
  autoPageView: true,
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

/**
 * Flush event queue to server
 */
async function flushQueue(): Promise<void> {
  if (eventQueue.length === 0) return;

  const events = [...eventQueue];
  eventQueue = [];

  try {
    await request('/api/events/batch', {
      method: 'POST',
      body: JSON.stringify({
        events,
        userId: currentUser?.id,
        sessionId: sdkConfig?.sessionId,
      }),
    });
  } catch (error) {
    // Re-add events to queue on failure
    eventQueue = [...events, ...eventQueue];
    console.error('REZ Analytics SDK: Failed to flush events', error);
  }
}

/**
 * Start flush timer
 */
function startFlushTimer(): void {
  if (flushTimer) clearInterval(flushTimer);
  flushTimer = setInterval(flushQueue, sdkConfig?.flushInterval ?? 5000);
}

/**
 * Generate session ID
 */
function generateSessionId(): string {
  return `sess_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}

// ============================================================================
// Core SDK Functions
// ============================================================================

/**
 * Initialize the REZ Analytics SDK
 * Must be called before any other SDK functions
 */
export async function init(config: Partial<AnalyticsConfig> = {}): Promise<void> {
  if (sdkInitialized) {
    console.warn('REZ Analytics SDK: Already initialized');
    return;
  }

  sdkConfig = {
    ...DEFAULT_CONFIG,
    ...config,
  };

  if (!sdkConfig.apiBaseUrl) {
    throw new Error('apiBaseUrl is required');
  }

  // Generate session ID
  if (!sdkConfig.sessionId) {
    sdkConfig.sessionId = generateSessionId();
  }

  // Setup session timeout
  if (sdkConfig.trackSession) {
    const sessionTimer = setTimeout(() => {
      if (sdkConfig) {
        sdkConfig.sessionId = generateSessionId();
        trackEvent('session_start', { previousSessionId: sdkConfig.sessionId });
      }
    }, sdkConfig.sessionTimeout);
  }

  // Start flush timer
  startFlushTimer();

  // Setup page view tracking
  if (sdkConfig.trackPageViews && typeof window !== 'undefined') {
    if (sdkConfig.autoPageView) {
      window.addEventListener('popstate', () => {
        trackEvent('page_view', { url: window.location.pathname });
      });
    }
  }

  sdkInitialized = true;
  console.log('REZ Analytics SDK initialized successfully');
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
  if (currentUser?.id !== user.id) {
    // New user or changed user
    trackEvent('user_identity_change', {
      previousUserId: currentUser?.id,
      newUserId: user.id,
    });
  }
  currentUser = user;
}

/**
 * Clear user data (call on logout)
 */
export function clearUser(): void {
  trackEvent('user_logout', { previousUserId: currentUser?.id });
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
    timestamp: options?.timestamp ?? Date.now(),
    userId: currentUser?.id,
    sessionId: sdkConfig?.sessionId,
    data: data ?? {},
    options,
  };

  // Add to queue
  eventQueue.push(eventPayload);

  // Flush if batch size reached
  if (eventQueue.length >= (sdkConfig?.batchSize ?? 20)) {
    await flushQueue();
  }

  // Also immediately send for high priority events
  if (options?.priority === 'high') {
    await flushQueue();
  }
}

// ============================================================================
// Screen/Session Tracking
// ============================================================================

/**
 * Track a screen view
 */
export async function trackScreenView(screen: ScreenView): Promise<void> {
  if (!sdkInitialized) {
    throw new Error('SDK not initialized. Call init() first.');
  }

  await trackEvent('screen_view', {
    screenName: screen.name,
    screenClass: screen.className,
    screenId: screen.id,
    previousScreen: screen.previousScreen,
    transitionType: screen.transitionType,
  });
}

/**
 * Start a new session
 */
export async function startSession(): Promise<string> {
  if (!sdkInitialized) {
    throw new Error('SDK not initialized. Call init() first.');
  }

  const newSessionId = generateSessionId();
  if (sdkConfig) {
    sdkConfig.sessionId = newSessionId;
  }

  await trackEvent('session_start', {
    sessionId: newSessionId,
    userId: currentUser?.id,
  });

  return newSessionId;
}

/**
 * End current session
 */
export async function endSession(): Promise<void> {
  if (!sdkInitialized) {
    throw new Error('SDK not initialized. Call init() first.');
  }

  await flushQueue();
  await trackEvent('session_end', {
    sessionId: sdkConfig?.sessionId,
    duration: Date.now() - (sdkConfig?.sessionStartTime ?? Date.now()),
  });
}

// ============================================================================
// User Properties
// ============================================================================

/**
 * Set user properties
 */
export async function setUserProperties(properties: UserProperties): Promise<void> {
  if (!sdkInitialized) {
    throw new Error('SDK not initialized. Call init() first.');
  }

  if (!currentUser?.id) {
    throw new Error('User not set. Call setUser() first.');
  }

  try {
    await request('/api/users/properties', {
      method: 'POST',
      body: JSON.stringify({
        userId: currentUser.id,
        properties,
      }),
    });

    await trackEvent('user_properties_updated', properties);
  } catch (error) {
    console.error('REZ Analytics SDK: Failed to set user properties', error);
    throw error;
  }
}

/**
 * Set single user property
 */
export async function setUserProperty(key: string, value: unknown): Promise<void> {
  await setUserProperties({ [key]: value });
}

/**
 * Increment a numeric user property
 */
export async function incrementUserProperty(key: string, value: number = 1): Promise<void> {
  if (!sdkInitialized) {
    throw new Error('SDK not initialized. Call init() first.');
  }

  if (!currentUser?.id) {
    throw new Error('User not set. Call setUser() first.');
  }

  try {
    await request('/api/users/properties/increment', {
      method: 'POST',
      body: JSON.stringify({
        userId: currentUser.id,
        key,
        value,
      }),
    });
  } catch (error) {
    console.error('REZ Analytics SDK: Failed to increment property', error);
    throw error;
  }
}

// ============================================================================
// Conversion Tracking
// ============================================================================

/**
 * Track conversion
 */
export async function trackConversion(conversion: ConversionData): Promise<void> {
  if (!sdkInitialized) {
    throw new Error('SDK not initialized. Call init() first.');
  }

  await trackEvent('conversion', {
    conversionId: conversion.id,
    conversionName: conversion.name,
    conversionValue: conversion.value,
    currency: conversion.currency,
    campaignId: conversion.campaignId,
    channel: conversion.channel,
    attribution: conversion.attribution,
  });
}

/**
 * Track purchase
 */
export async function trackPurchase(purchase: {
  transactionId: string;
  revenue: number;
  tax?: number;
  shipping?: number;
  currency?: string;
  items: Array<{
    itemId: string;
    name: string;
    category?: string;
    price: number;
    quantity: number;
  }>;
}): Promise<void> {
  if (!sdkInitialized) {
    throw new Error('SDK not initialized. Call init() first.');
  }

  const totalRevenue = purchase.revenue + (purchase.tax ?? 0) + (purchase.shipping ?? 0);

  await trackEvent('purchase', {
    transactionId: purchase.transactionId,
    revenue: totalRevenue,
    tax: purchase.tax,
    shipping: purchase.shipping,
    currency: purchase.currency ?? 'INR',
    itemCount: purchase.items.length,
    items: purchase.items,
  });
}

/**
 * Track refund
 */
export async function trackRefund(refund: {
  transactionId: string;
  refundId: string;
  amount: number;
  reason?: string;
}): Promise<void> {
  await trackEvent('refund', {
    transactionId: refund.transactionId,
    refundId: refund.refundId,
    amount: refund.amount,
    reason: refund.reason,
  });
}

// ============================================================================
// Funnel Analysis
// ============================================================================

/**
 * Track funnel step completion
 */
export async function trackFunnelStep(funnelName: string, step: FunnelStep): Promise<void> {
  if (!sdkInitialized) {
    throw new Error('SDK not initialized. Call init() first.');
  }

  await trackEvent('funnel_step', {
    funnelName,
    stepName: step.name,
    stepIndex: step.index,
    stepValue: step.value,
    timeSpent: step.timeSpent,
    completed: step.completed,
  });
}

// ============================================================================
// A/B Testing
// ============================================================================

/**
 * Get A/B test variant for user
 */
export async function getABTestVariant(testConfig: ABTestConfig): Promise<string> {
  if (!sdkInitialized) {
    throw new Error('SDK not initialized. Call init() first.');
  }

  if (!currentUser?.id) {
    throw new Error('User not set. Call setUser() first.');
  }

  try {
    const result = await request<{ variant: string }>('/api/abtest/variant', {
      method: 'POST',
      body: JSON.stringify({
        testId: testConfig.testId,
        testName: testConfig.testName,
        userId: currentUser.id,
        variants: testConfig.variants,
        distribution: testConfig.distribution,
      }),
    });

    await trackEvent('abtest_exposure', {
      testId: testConfig.testId,
      testName: testConfig.testName,
      variant: result.variant,
    });

    return result.variant;
  } catch (error) {
    console.error('REZ Analytics SDK: Failed to get A/B test variant', error);
    // Return control variant on error
    return testConfig.variants[0];
  }
}

/**
 * Track A/B test conversion
 */
export async function trackABTestConversion(
  testId: string,
  variant: string,
  value?: number
): Promise<void> {
  await trackEvent('abtest_conversion', {
    testId,
    variant,
    value,
  });
}

// ============================================================================
// Cohort Analysis
// ============================================================================

/**
 * Add user to cohort
 */
export async function addToCohort(cohortConfig: CohortConfig): Promise<void> {
  if (!sdkInitialized) {
    throw new Error('SDK not initialized. Call init() first.');
  }

  if (!currentUser?.id) {
    throw new Error('User not set. Call setUser() first.');
  }

  try {
    await request('/api/cohorts/add', {
      method: 'POST',
      body: JSON.stringify({
        userId: currentUser.id,
        cohortId: cohortConfig.cohortId,
        cohortName: cohortConfig.cohortName,
        metadata: cohortConfig.metadata,
      }),
    });

    await trackEvent('cohort_joined', {
      cohortId: cohortConfig.cohortId,
      cohortName: cohortConfig.cohortName,
    });
  } catch (error) {
    console.error('REZ Analytics SDK: Failed to add to cohort', error);
    throw error;
  }
}

// ============================================================================
// Debug & Utility
// ============================================================================

/**
 * Enable debug mode
 */
export function setDebugMode(enabled: boolean): void {
  if (sdkConfig) {
    sdkConfig.debug = enabled;
  }
}

/**
 * Get queued event count
 */
export function getQueuedEventCount(): number {
  return eventQueue.length;
}

/**
 * Force flush all queued events
 */
export async function flush(): Promise<void> {
  await flushQueue();
}

/**
 * Reset SDK state
 */
export function reset(): void {
  if (flushTimer) {
    clearInterval(flushTimer);
    flushTimer = null;
  }
  eventQueue = [];
  currentUser = null;
  sdkInitialized = false;
  sdkConfig = null;
}

// ============================================================================
// SDK Version Info
// ============================================================================

export const SDK_VERSION = '1.0.0';
export const SDK_NAME = '@rez-app/analytics-sdk';

// ============================================================================
// Default export
// ============================================================================

const analyticsSDK = {
  init,
  isInitialized,
  getUser,
  setUser,
  clearUser,
  trackEvent,
  trackScreenView,
  startSession,
  endSession,
  setUserProperties,
  setUserProperty,
  incrementUserProperty,
  trackConversion,
  trackPurchase,
  trackRefund,
  trackFunnelStep,
  getABTestVariant,
  trackABTestConversion,
  addToCohort,
  setDebugMode,
  getQueuedEventCount,
  flush,
  reset,
  SDK_VERSION,
  SDK_NAME,
};

export default analyticsSDK;
