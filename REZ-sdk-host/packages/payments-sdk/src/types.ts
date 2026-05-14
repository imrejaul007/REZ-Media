/**
 * REZ Payments SDK Type Definitions
 */

// ============================================================================
// Configuration Types
// ============================================================================

export interface PaymentsConfig {
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
  /** User's phone number */
  phone?: string;
  /** User's display name */
  name?: string;
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
// Payment Method Types
// ============================================================================

export type PaymentMethodType =
  | 'card'
  | 'bank_account'
  | 'upi'
  | 'wallet'
  | 'netbanking'
  | 'emi'
  | 'cod'
  | 'qr';

export interface PaymentMethod {
  /** Payment method ID */
  id: string;
  /** Payment method type */
  type: PaymentMethodType;
  /** Display name */
  name: string;
  /** Bank name (for bank transfers) */
  bankName?: string;
  /** Card brand (for cards) */
  cardBrand?: 'visa' | 'mastercard' | 'amex' | 'discover' | 'rupay' | string;
  /** Last 4 digits (for cards) */
  last4?: string;
  /** Card expiry (for cards) */
  expiryMonth?: number;
  /** Card expiry year (for cards) */
  expiryYear?: number;
  /** Whether this method is default */
  isDefault?: boolean;
  /** Whether this method is saved */
  isSaved?: boolean;
  /** Icon URL */
  iconUrl?: string;
  /** Maximum amount allowed */
  maxAmount?: number;
  /** Minimum amount allowed */
  minAmount?: number;
  /** Metadata */
  metadata?: Record<string, unknown>;
}

// ============================================================================
// Payment Types
// ============================================================================

export interface PaymentRequest {
  /** Payment amount (in smallest currency unit, e.g., paisa for INR) */
  amount: number;
  /** Currency code */
  currency?: string;
  /** Payment method type */
  method: PaymentMethodType | string;
  /** Saved payment method ID */
  paymentMethodId?: string;
  /** Unique order/transaction ID from your system */
  orderId?: string;
  /** Idempotency key (recommended) */
  idempotencyKey?: string;
  /** Payment description */
  description?: string;
  /** Customer details */
  customer?: {
    name?: string;
    email?: string;
    phone?: string;
  };
  /** Receipt settings */
  receipt?: {
    notes?: string[];
    softCopy?: boolean;
  };
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

export interface PaymentResponse {
  /** Unique payment ID */
  paymentId: string;
  /** Payment status */
  status: 'pending' | 'processing' | 'captured' | 'failed' | 'cancelled' | 'refunded';
  /** Amount paid */
  amount: number;
  /** Currency code */
  currency: string;
  /** Payment method used */
  method: string;
  /** Payment method details */
  methodDetails?: PaymentMethod;
  /** Order ID from request */
  orderId?: string;
  /** Receipt ID (if receipt was requested) */
  receiptId?: string;
  /** Payment description */
  description?: string;
  /** Customer email (if captured) */
  customerEmail?: string;
  /** Created timestamp */
  createdAt: number;
  /** Updated timestamp */
  updatedAt: number;
  /** Captured timestamp */
  capturedAt?: number;
  /** Error message (if failed) */
  errorMessage?: string;
  /** Error code (if failed) */
  errorCode?: string;
  /** Gateway response */
  gatewayResponse?: Record<string, unknown>;
  /** UPI QR code URL (for UPI payments) */
  qrCodeUrl?: string;
  /** Payment URL (for redirect-based payments) */
  paymentUrl?: string;
  /** Metadata */
  metadata?: Record<string, unknown>;
}

export interface PaymentStatus {
  /** Payment ID */
  paymentId: string;
  /** Current status */
  status: PaymentResponse['status'];
  /** Amount */
  amount: number;
  /** Currency */
  currency: string;
  /** Status history */
  history: Array<{
    status: string;
    timestamp: number;
    message?: string;
  }>;
  /** Updated timestamp */
  updatedAt: number;
}

// ============================================================================
// Refund Types
// ============================================================================

export interface RefundRequest {
  /** Original payment ID */
  paymentId: string;
  /** Amount to refund (partial refund supported) */
  amount?: number;
  /** Refund reason */
  reason: 'duplicate' | 'fraudulent' | 'requested_by_customer' | string;
  /** Additional notes */
  notes?: string;
  /** Idempotency key */
  idempotencyKey?: string;
  /** Metadata */
  metadata?: Record<string, unknown>;
}

export interface RefundResponse {
  /** Unique refund ID */
  refundId: string;
  /** Original payment ID */
  paymentId: string;
  /** Refund amount */
  amount: number;
  /** Currency code */
  currency: string;
  /** Refund status */
  status: 'pending' | 'processing' | 'processed' | 'failed';
  /** Refund speed (instant/normal) */
  speed?: 'instant' | 'normal';
  /** Processing timestamp */
  processedAt?: number;
  /** Created timestamp */
  createdAt: number;
  /** Reason */
  reason?: string;
  /** Notes */
  notes?: string;
  /** Status history */
  history?: Array<{
    status: string;
    timestamp: number;
    message?: string;
  }>;
}

// ============================================================================
// Wallet Types
// ============================================================================

export interface WalletBalance {
  /** Available balance */
  balance: number;
  /** Pending balance (in processing) */
  pendingBalance: number;
  /** Currency code */
  currency: string;
  /** Minimum balance required */
  minBalance?: number;
  /** Maximum balance allowed */
  maxBalance?: number;
  /** Last updated timestamp */
  updatedAt: number;
}

// ============================================================================
// Transaction Types
// ============================================================================

export interface Transaction {
  /** Unique transaction ID */
  id: string;
  /** Transaction type */
  type: 'payment' | 'refund' | 'wallet_topup' | 'wallet_withdrawal' | 'subscription';
  /** Transaction status */
  status: 'success' | 'failed' | 'pending' | 'processing';
  /** Transaction amount */
  amount: number;
  /** Currency code */
  currency: string;
  /** Associated payment ID (for payments and refunds) */
  paymentId?: string;
  /** Associated order ID */
  orderId?: string;
  /** Payment method used */
  paymentMethod?: PaymentMethod;
  /** Transaction description */
  description?: string;
  /** User ID */
  userId: string;
  /** Transaction timestamp */
  createdAt: number;
  /** Completion timestamp */
  completedAt?: number;
  /** Failure reason (if failed) */
  failureReason?: string;
  /** Metadata */
  metadata?: Record<string, unknown>;
}

// ============================================================================
// SDK Instance Type
// ============================================================================

export interface REZPaymentsSDK {
  init(config?: Partial<PaymentsConfig>): Promise<void>;
  isInitialized(): boolean;
  getUser(): User | null;
  setUser(user: User): void;
  clearUser(): void;
  trackEvent(eventName: string, data?: EventData, options?: TrackEventOptions): Promise<void>;
  getPaymentMethods(): Promise<PaymentMethod[]>;
  getSavedPaymentMethods(): Promise<PaymentMethod[]>;
  savePaymentMethod(paymentMethodId: string, metadata?: Record<string, unknown>): Promise<{ success: boolean; paymentMethod: PaymentMethod }>;
  removePaymentMethod(paymentMethodId: string): Promise<void>;
  createPayment(request: PaymentRequest): Promise<PaymentResponse>;
  confirmPayment(paymentId: string, confirmationData?: Record<string, unknown>): Promise<PaymentResponse>;
  getPaymentStatus(paymentId: string): Promise<PaymentStatus>;
  cancelPayment(paymentId: string, reason?: string): Promise<void>;
  requestRefund(refundRequest: RefundRequest): Promise<RefundResponse>;
  getRefundStatus(refundId: string): Promise<RefundResponse>;
  getWalletBalance(): Promise<WalletBalance>;
  addToWallet(amount: number, paymentMethodId: string, metadata?: Record<string, unknown>): Promise<PaymentResponse>;
  withdrawFromWallet(amount: number, withdrawalMethod: 'bank_account' | 'upi', accountDetails: Record<string, string>): Promise<{ success: boolean; withdrawalId: string; estimatedArrival?: number }>;
  getTransactionHistory(options?: { limit?: number; offset?: number; type?: 'payment' | 'refund' | 'wallet' | 'all'; status?: 'success' | 'failed' | 'pending' | 'all'; startDate?: number; endDate?: number }): Promise<{ transactions: Transaction[]; total: number; hasMore: boolean }>;
  getTransaction(transactionId: string): Promise<Transaction>;
  createSubscription(subscription: { planId: string; paymentMethodId: string; startDate?: number; metadata?: Record<string, unknown> }): Promise<{ success: boolean; subscriptionId: string; nextBillingDate: number; status: string }>;
  cancelSubscription(subscriptionId: string, reason?: string, immediate?: boolean): Promise<void>;
}

// ============================================================================
// Global Declaration
// ============================================================================

declare global {
  interface Window {
    REZPaymentsSDK?: REZPaymentsSDK;
  }
}
