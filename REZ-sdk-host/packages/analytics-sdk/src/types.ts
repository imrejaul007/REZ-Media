/**
 * REZ Analytics SDK Type Definitions
 */

// ============================================================================
// Configuration Types
// ============================================================================

export interface AnalyticsConfig {
  /** Base URL for API requests */
  apiBaseUrl: string;
  /** Environment: 'development' | 'staging' | 'production' */
  environment: 'development' | 'staging' | 'production';
  /** Request timeout in milliseconds */
  timeout: number;
  /** Number of events to batch before sending */
  batchSize: number;
  /** Interval to flush event queue (ms) */
  flushInterval: number;
  /** Number of retry attempts for failed requests */
  retries: number;
  /** Session timeout (ms) */
  sessionTimeout: number;
  /** Track user sessions */
  trackSession: boolean;
  /** Track page/screen views */
  trackPageViews: boolean;
  /** Auto-track page views on route change */
  autoPageView: boolean;
  /** Session ID */
  sessionId?: string;
  /** Session start time */
  sessionStartTime?: number;
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
  /** User type */
  userType?: 'free' | 'premium' | 'enterprise';
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
// Screen Tracking Types
// ============================================================================

export interface ScreenView {
  /** Screen name */
  name: string;
  /** Screen class/component name */
  className?: string;
  /** Screen ID */
  id?: string;
  /** Previous screen name */
  previousScreen?: string;
  /** Transition type */
  transitionType?: 'push' | 'pop' | 'replace' | 'reset';
}

// ============================================================================
// User Properties Types
// ============================================================================

export interface UserProperties {
  /** User's display name */
  name?: string;
  /** User's email */
  email?: string;
  /** User's phone */
  phone?: string;
  /** User's age */
  age?: number;
  /** User's gender */
  gender?: string;
  /** User's location */
  location?: string;
  /** User's country */
  country?: string;
  /** User's city */
  city?: string;
  /** User's language */
  language?: string;
  /** User's timezone */
  timezone?: string;
  /** User type/subscription level */
  userType?: string;
  /** Account creation date */
  createdAt?: string;
  /** Last seen timestamp */
  lastSeen?: number;
  /** Custom properties */
  [key: string]: unknown;
}

// ============================================================================
// Conversion Types
// ============================================================================

export interface ConversionData {
  /** Conversion ID */
  id: string;
  /** Conversion name */
  name: string;
  /** Conversion value (revenue) */
  value: number;
  /** Currency code */
  currency?: string;
  /** Campaign ID */
  campaignId?: string;
  /** Channel (organic, paid, referral, etc.) */
  channel?: string;
  /** Attribution data */
  attribution?: {
    source?: string;
    medium?: string;
    campaign?: string;
    term?: string;
    content?: string;
  };
}

// ============================================================================
// Funnel Types
// ============================================================================

export interface FunnelStep {
  /** Step name */
  name: string;
  /** Step index (0-based) */
  index: number;
  /** Step value (e.g., order value) */
  value?: number;
  /** Time spent on this step (ms) */
  timeSpent?: number;
  /** Whether step was completed */
  completed?: boolean;
}

// ============================================================================
// A/B Testing Types
// ============================================================================

export interface ABTestConfig {
  /** Test ID */
  testId: string;
  /** Test name */
  testName: string;
  /** Available variants */
  variants: string[];
  /** Distribution weights (must sum to 1) */
  distribution?: number[];
}

// ============================================================================
// Cohort Types
// ============================================================================

export interface CohortConfig {
  /** Cohort ID */
  cohortId: string;
  /** Cohort name */
  cohortName: string;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

// ============================================================================
// Analytics Result Types
// ============================================================================

export interface AnalyticsReport {
  /** Report ID */
  id: string;
  /** Report name */
  name: string;
  /** Report type */
  type: 'realtime' | 'daily' | 'weekly' | 'monthly';
  /** Report data */
  data: Record<string, unknown>;
  /** Generated timestamp */
  generatedAt: number;
}

export interface MetricsData {
  /** Metric name */
  metric: string;
  /** Metric value */
  value: number;
  /** Previous period value */
  previousValue?: number;
  /** Change percentage */
  change?: number;
  /** Change direction */
  changeDirection?: 'up' | 'down' | 'stable';
}

// ============================================================================
// SDK Instance Type
// ============================================================================

export interface REZAnalyticsSDK {
  init(config?: Partial<AnalyticsConfig>): Promise<void>;
  isInitialized(): boolean;
  getUser(): User | null;
  setUser(user: User): void;
  clearUser(): void;
  trackEvent(eventName: string, data?: EventData, options?: TrackEventOptions): Promise<void>;
  trackScreenView(screen: ScreenView): Promise<void>;
  startSession(): Promise<string>;
  endSession(): Promise<void>;
  setUserProperties(properties: UserProperties): Promise<void>;
  setUserProperty(key: string, value: unknown): Promise<void>;
  incrementUserProperty(key: string, value?: number): Promise<void>;
  trackConversion(conversion: ConversionData): Promise<void>;
  trackPurchase(purchase: {
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
  }): Promise<void>;
  trackRefund(refund: {
    transactionId: string;
    refundId: string;
    amount: number;
    reason?: string;
  }): Promise<void>;
  trackFunnelStep(funnelName: string, step: FunnelStep): Promise<void>;
  getABTestVariant(testConfig: ABTestConfig): Promise<string>;
  trackABTestConversion(testId: string, variant: string, value?: number): Promise<void>;
  addToCohort(cohortConfig: CohortConfig): Promise<void>;
  setDebugMode(enabled: boolean): void;
  getQueuedEventCount(): number;
  flush(): Promise<void>;
  reset(): void;
}

// ============================================================================
// Global Declaration
// ============================================================================

declare global {
  interface Window {
    REZAnalyticsSDK?: REZAnalyticsSDK;
  }
}
