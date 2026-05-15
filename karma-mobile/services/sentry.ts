/**
 * Sentry Configuration for Karma Mobile
 * Error tracking and performance monitoring
 */
import * as Sentry from '@sentry/react-native';
import Constants from 'expo-constants';

// Initialize Sentry with environment-based configuration
export function initializeSentry() {
  // Get DSN from Expo Constants (configured in app.json or eas.json)
  const dsn = Constants.expoConfig?.extra?.sentryDsn as string | undefined;

  if (!dsn) {
    console.warn('[Sentry] DSN not configured - skipping initialization');
    return;
  }

  Sentry.init({
    dsn: dsn,
    // Set tracesSampleRate to 1.0 to capture 100% of transactions
    // In production, you may want to lower this (e.g., 0.1)
    tracesSampleRate: __DEV__ ? 1.0 : 0.1,
    // Enable auto session tracking
    autoSessionTracking: true,
    // Enable native crash handling
    enableNative: true,
    // Disable native crash reporting in debug
    enableNativeCrashHandling: !__DEV__,
    // Debug mode logging
    debug: __DEV__,
    // Environment tag
    environment: __DEV__ ? 'development' : 'production',
    // Ignore common noise
    ignoreErrors: [
      // Network errors that are already handled
      'Network request failed',
      'Network Error',
      'timeout',
      'ECONNREFUSED',
      'ETIMEDOUT',
      // React Navigation expected abort
      'AbortError',
      // User cancelled
      'User cancelled',
    ],
    // Denylist URLs that should not be sent to Sentry
    denyUrls: [
      // Chrome extensions
      /extensions\//i,
      // Localhost in dev
      /localhost/,
    ],
  });

  console.log('[Sentry] Initialized successfully');
}

// Export Sentry for manual error capturing
export { Sentry };

// Helper to capture user information
export function setSentryUser(userId: string, userData?: Record<string, unknown>) {
  Sentry.setUser({
    id: userId,
    ...userData,
  });
}

// Helper to add custom context
export function setSentryContext(key: string, context: Record<string, unknown>) {
  Sentry.setContext(key, context);
}

// Helper to capture custom events
export function trackSentryEvent(eventName: string, data?: Record<string, unknown>) {
  Sentry.captureEvent({
    type: 'transaction',
    transaction: eventName,
    contexts: data ? { [eventName]: data } : undefined,
  });
}
