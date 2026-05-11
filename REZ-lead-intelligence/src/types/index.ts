/**
 * Lead Intelligence Service - Type Definitions
 * Detects hot/warm/cold leads based on user behavior signals
 */

// ============================================================================
// Core Types
// ============================================================================

export type LeadTemperature = 'hot' | 'warm' | 'cold';
export type RecommendedChannel = 'whatsapp' | 'push' | 'sms' | 'email';
export type UrgencyLevel = 'high' | 'medium' | 'low';

/**
 * Main Lead Score interface - comprehensive view of a user's lead status
 */
export interface LeadScore {
  userId: string;
  temperature: LeadTemperature;
  score: number; // 0-100
  signals: LeadSignals;
  recommendedChannel: RecommendedChannel;
  recommendedAction: string;
  calculatedAt: Date;
  expiresAt: Date;
}

/**
 * Individual signals that contribute to lead scoring
 */
export interface LeadSignals {
  recentSearches: number;
  abandonedCarts: number;
  viewedProducts: number;
  lastActiveHours: number;
  intentStrength: number;
  purchaseProbability: number;
}

/**
 * Abandoned Search - user searched but didn't click any results
 */
export interface AbandonedSearch {
  _id?: string;
  userId: string;
  query: string;
  resultsShown: string[];
  notClicked: string[];
  timestamp: Date;
  intentDetected: string;
  urgencyLevel: UrgencyLevel;
  cartValue?: number; // Estimated value of items searched for
  reEngaged: boolean;
  reEngagementAttempts: number;
}

/**
 * Abandoned Cart - user added items but didn't checkout
 */
export interface AbandonedCart {
  _id?: string;
  userId: string;
  cartId: string;
  items: CartItem[];
  totalValue: number;
  abandonedAt: Date;
  lastReminderSent?: Date;
  reminderCount: number;
  recovered: boolean;
  recoveredAt?: Date;
  expiresAt: Date;
}

export interface CartItem {
  productId: string;
  price: number;
  quantity: number;
  name?: string;
  category?: string;
}

// ============================================================================
// User Activity Types
// ============================================================================

export interface UserActivity {
  userId: string;
  searches: SearchActivity[];
  views: ViewActivity[];
  cartActions: CartActivity[];
  orders: OrderActivity[];
  lastActive: Date;
  sessionCount: number;
}

export interface SearchActivity {
  query: string;
  timestamp: Date;
  resultsCount: number;
  clickedResults: string[];
  intentDetected?: string;
}

export interface ViewActivity {
  productId: string;
  productName?: string;
  category?: string;
  timestamp: Date;
  durationSeconds?: number;
  addedToCart: boolean;
}

export interface CartActivity {
  action: 'add' | 'remove' | 'update';
  productId: string;
  quantity?: number;
  timestamp: Date;
}

export interface OrderActivity {
  orderId: string;
  total: number;
  itemCount: number;
  timestamp: Date;
  status: string;
}

// ============================================================================
// Engagement Types
// ============================================================================

export interface EngagementAction {
  userId: string;
  channel: RecommendedChannel;
  actionType: EngagementActionType;
  message: string;
  sentAt: Date;
  delivered: boolean;
  opened?: boolean;
  clicked?: boolean;
  converted?: boolean;
}

export type EngagementActionType =
  | 'cart_recovery'
  | 'search_followup'
  | 'browse_reminder'
  | 'loyalty_offer'
  | 'abandoned_item'
  | 'price_drop'
  | 'back_in_stock';

export interface ReEngagementResult {
  userId: string;
  success: boolean;
  channel: RecommendedChannel;
  action: string;
  message: string;
  sentAt: Date;
}

// ============================================================================
// Channel Selection Types
// ============================================================================

export interface ChannelPreference {
  userId: string;
  whatsapp: boolean;
  push: boolean;
  sms: boolean;
  email: boolean;
  lastWhatsapp?: Date;
  lastPush?: Date;
  lastSms?: Date;
  lastEmail?: Date;
}

export interface ChannelScore {
  channel: RecommendedChannel;
  score: number;
  factors: ChannelFactor[];
}

export interface ChannelFactor {
  name: string;
  weight: number;
  value: number;
}

// ============================================================================
// ML/Prediction Types
// ============================================================================

export interface PurchasePrediction {
  userId: string;
  probability: number; // 0-1
  predictedValue: number;
  predictedTimeframe: string;
  confidence: number;
  factors: PredictionFactor[];
}

export interface PredictionFactor {
  name: string;
  contribution: number;
  direction: 'positive' | 'negative';
}

// ============================================================================
// ReZ Mind Integration Types
// ============================================================================

export interface LeadSignalEvent {
  eventType: 'lead_score_updated' | 'abandoned_cart' | 'abandoned_search' | 're_engagement_sent';
  userId: string;
  timestamp: Date;
  data: Record<string, unknown>;
  correlationId?: string;
}

// ============================================================================
// API Response Types
// ============================================================================

export interface LeadScoreResponse {
  success: boolean;
  data?: LeadScore;
  error?: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

export interface LeadListResponse {
  success: boolean;
  data?: {
    leads: LeadScore[];
    total: number;
    page: number;
    pageSize: number;
  };
  error?: {
    code: string;
    message: string;
  };
}

export interface ReEngagementResponse {
  success: boolean;
  data?: ReEngagementResult;
  error?: {
    code: string;
    message: string;
  };
}

// ============================================================================
// Configuration Types
// ============================================================================

export interface ScoringWeights {
  recentSearches: number;
  abandonedCarts: number;
  viewedProducts: number;
  lastActiveHours: number;
  intentStrength: number;
  purchaseProbability: number;
}

export interface Thresholds {
  hot: number; // >= this score is hot
  warm: number; // >= this score is warm, < hot
  cold: number; // < warm
}

export interface ReEngagementConfig {
  maxAttempts: number;
  minIntervalHours: number;
  cartExpiryHours: number;
  searchExpiryHours: number;
}
