/**
 * REZ Payments SDK
 * SDK for integrating REZ payment services into 3rd party applications
 */

import type {
  PaymentsConfig,
  User,
  PaymentRequest,
  PaymentResponse,
  PaymentStatus,
  RefundRequest,
  RefundResponse,
  WalletBalance,
  PaymentMethod,
  Transaction,
  EventData,
  TrackEventOptions,
} from './types';

// ============================================================================
// Type Exports
// ============================================================================

export type {
  PaymentsConfig,
  User,
  PaymentRequest,
  PaymentResponse,
  PaymentStatus,
  RefundRequest,
  RefundResponse,
  WalletBalance,
  PaymentMethod,
  Transaction,
  EventData,
  TrackEventOptions,
};

// ============================================================================
// SDK Instance State
// ============================================================================

let sdkInitialized = false;
let sdkConfig: PaymentsConfig | null = null;
let currentUser: User | null = null;

// ============================================================================
// Configuration
// ============================================================================

const DEFAULT_CONFIG: PaymentsConfig = {
  apiBaseUrl: 'https://api.rez-media.com/payments',
  environment: 'production',
  timeout: 60000, // Payments need longer timeout
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
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
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
 * Initialize the REZ Payments SDK
 * Must be called before any other SDK functions
 */
export async function init(config: Partial<PaymentsConfig> = {}): Promise<void> {
  if (sdkInitialized) {
    console.warn('REZ Payments SDK: Already initialized');
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
  console.log('REZ Payments SDK initialized successfully');
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
 * Track a payment-related event
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
    console.error('REZ Payments SDK: Failed to track event', error);
  }
}

// ============================================================================
// Payment Methods
// ============================================================================

/**
 * Get available payment methods
 */
export async function getPaymentMethods(): Promise<PaymentMethod[]> {
  if (!sdkInitialized) {
    throw new Error('SDK not initialized. Call init() first.');
  }

  try {
    const methods = await request<PaymentMethod[]>('/api/payment-methods');
    return methods;
  } catch (error) {
    console.error('REZ Payments SDK: Failed to get payment methods', error);
    throw error;
  }
}

/**
 * Get user's saved payment methods
 */
export async function getSavedPaymentMethods(): Promise<PaymentMethod[]> {
  if (!sdkInitialized) {
    throw new Error('SDK not initialized. Call init() first.');
  }

  if (!currentUser?.id) {
    throw new Error('User not set. Call setUser() first.');
  }

  try {
    const methods = await request<PaymentMethod[]>(
      `/api/users/${currentUser.id}/payment-methods`
    );
    return methods;
  } catch (error) {
    console.error('REZ Payments SDK: Failed to get saved payment methods', error);
    throw error;
  }
}

/**
 * Save a payment method for future use
 */
export async function savePaymentMethod(
  paymentMethodId: string,
  metadata?: Record<string, unknown>
): Promise<{
  success: boolean;
  paymentMethod: PaymentMethod;
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
      paymentMethod: PaymentMethod;
    }>(`/api/users/${currentUser.id}/payment-methods`, {
      method: 'POST',
      body: JSON.stringify({
        paymentMethodId,
        metadata,
      }),
    });

    await trackEvent('payment_method_saved', {
      paymentMethodId,
      type: result.paymentMethod.type,
    });

    return result;
  } catch (error) {
    console.error('REZ Payments SDK: Failed to save payment method', error);
    throw error;
  }
}

/**
 * Remove a saved payment method
 */
export async function removePaymentMethod(paymentMethodId: string): Promise<void> {
  if (!sdkInitialized) {
    throw new Error('SDK not initialized. Call init() first.');
  }

  if (!currentUser?.id) {
    throw new Error('User not set. Call setUser() first.');
  }

  try {
    await request(`/api/users/${currentUser.id}/payment-methods/${paymentMethodId}`, {
      method: 'DELETE',
    });

    await trackEvent('payment_method_removed', { paymentMethodId });
  } catch (error) {
    console.error('REZ Payments SDK: Failed to remove payment method', error);
    throw error;
  }
}

// ============================================================================
// Payments
// ============================================================================

/**
 * Create and initiate a payment
 */
export async function createPayment(request: PaymentRequest): Promise<PaymentResponse> {
  if (!sdkInitialized) {
    throw new Error('SDK not initialized. Call init() first.');
  }

  if (!currentUser?.id) {
    throw new Error('User not set. Call setUser() first.');
  }

  const paymentRequest = {
    ...request,
    userId: currentUser.id,
    currency: request.currency ?? 'INR',
  };

  try {
    const response = await request<PaymentResponse>('/api/payments/create', {
      method: 'POST',
      body: JSON.stringify(paymentRequest),
    });

    await trackEvent('payment_initiated', {
      paymentId: response.paymentId,
      amount: request.amount,
      currency: request.currency,
      method: request.method,
    });

    return response;
  } catch (error) {
    console.error('REZ Payments SDK: Failed to create payment', error);
    throw error;
  }
}

/**
 * Confirm a payment (for methods that require confirmation)
 */
export async function confirmPayment(
  paymentId: string,
  confirmationData?: Record<string, unknown>
): Promise<PaymentResponse> {
  if (!sdkInitialized) {
    throw new Error('SDK not initialized. Call init() first.');
  }

  try {
    const response = await request<PaymentResponse>(`/api/payments/${paymentId}/confirm`, {
      method: 'POST',
      body: JSON.stringify(confirmationData ?? {}),
    });

    await trackEvent('payment_confirmed', {
      paymentId,
      status: response.status,
    });

    return response;
  } catch (error) {
    console.error('REZ Payments SDK: Failed to confirm payment', error);
    throw error;
  }
}

/**
 * Get payment status
 */
export async function getPaymentStatus(paymentId: string): Promise<PaymentStatus> {
  if (!sdkInitialized) {
    throw new Error('SDK not initialized. Call init() first.');
  }

  try {
    const status = await request<PaymentStatus>(`/api/payments/${paymentId}/status`);
    return status;
  } catch (error) {
    console.error('REZ Payments SDK: Failed to get payment status', error);
    throw error;
  }
}

/**
 * Cancel a pending payment
 */
export async function cancelPayment(paymentId: string, reason?: string): Promise<void> {
  if (!sdkInitialized) {
    throw new Error('SDK not initialized. Call init() first.');
  }

  try {
    await request(`/api/payments/${paymentId}/cancel`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });

    await trackEvent('payment_cancelled', {
      paymentId,
      reason,
    });
  } catch (error) {
    console.error('REZ Payments SDK: Failed to cancel payment', error);
    throw error;
  }
}

// ============================================================================
// Refunds
// ============================================================================

/**
 * Request a refund
 */
export async function requestRefund(refundRequest: RefundRequest): Promise<RefundResponse> {
  if (!sdkInitialized) {
    throw new Error('SDK not initialized. Call init() first.');
  }

  if (!currentUser?.id) {
    throw new Error('User not set. Call setUser() first.');
  }

  const request = {
    ...refundRequest,
    userId: currentUser.id,
  };

  try {
    const response = await request<RefundResponse>('/api/refunds', {
      method: 'POST',
      body: JSON.stringify(request),
    });

    await trackEvent('refund_requested', {
      refundId: response.refundId,
      paymentId: refundRequest.paymentId,
      amount: refundRequest.amount,
    });

    return response;
  } catch (error) {
    console.error('REZ Payments SDK: Failed to request refund', error);
    throw error;
  }
}

/**
 * Get refund status
 */
export async function getRefundStatus(refundId: string): Promise<RefundResponse> {
  if (!sdkInitialized) {
    throw new Error('SDK not initialized. Call init() first.');
  }

  try {
    const refund = await request<RefundResponse>(`/api/refunds/${refundId}`);
    return refund;
  } catch (error) {
    console.error('REZ Payments SDK: Failed to get refund status', error);
    throw error;
  }
}

// ============================================================================
// Wallet
// ============================================================================

/**
 * Get wallet balance
 */
export async function getWalletBalance(): Promise<WalletBalance> {
  if (!sdkInitialized) {
    throw new Error('SDK not initialized. Call init() first.');
  }

  if (!currentUser?.id) {
    throw new Error('User not set. Call setUser() first.');
  }

  try {
    const balance = await request<WalletBalance>(
      `/api/users/${currentUser.id}/wallet`
    );
    return balance;
  } catch (error) {
    console.error('REZ Payments SDK: Failed to get wallet balance', error);
    throw error;
  }
}

/**
 * Add money to wallet
 */
export async function addToWallet(
  amount: number,
  paymentMethodId: string,
  metadata?: Record<string, unknown>
): Promise<PaymentResponse> {
  if (!sdkInitialized) {
    throw new Error('SDK not initialized. Call init() first.');
  }

  const payment = await createPayment({
    amount,
    method: 'wallet_topup',
    paymentMethodId,
    description: 'Wallet Top Up',
    metadata,
  });

  await trackEvent('wallet_topup_initiated', {
    amount,
    paymentId: payment.paymentId,
  });

  return payment;
}

/**
 * Withdraw from wallet
 */
export async function withdrawFromWallet(
  amount: number,
  withdrawalMethod: 'bank_account' | 'upi',
  accountDetails: Record<string, string>
): Promise<{
  success: boolean;
  withdrawalId: string;
  estimatedArrival?: number;
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
      withdrawalId: string;
      estimatedArrival?: number;
    }>(`/api/users/${currentUser.id}/wallet/withdraw`, {
      method: 'POST',
      body: JSON.stringify({
        amount,
        method: withdrawalMethod,
        accountDetails,
      }),
    });

    await trackEvent('wallet_withdrawal_initiated', {
      amount,
      withdrawalId: result.withdrawalId,
    });

    return result;
  } catch (error) {
    console.error('REZ Payments SDK: Failed to withdraw from wallet', error);
    throw error;
  }
}

// ============================================================================
// Transactions
// ============================================================================

/**
 * Get transaction history
 */
export async function getTransactionHistory(options: {
  limit?: number;
  offset?: number;
  type?: 'payment' | 'refund' | 'wallet' | 'all';
  status?: 'success' | 'failed' | 'pending' | 'all';
  startDate?: number;
  endDate?: number;
} = {}): Promise<{
  transactions: Transaction[];
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
    userId: currentUser.id,
    limit: String(options.limit ?? 20),
    offset: String(options.offset ?? 0),
  });

  if (options.type) params.set('type', options.type);
  if (options.status) params.set('status', options.status);
  if (options.startDate) params.set('startDate', String(options.startDate));
  if (options.endDate) params.set('endDate', String(options.endDate));

  try {
    const history = await request<{
      transactions: Transaction[];
      total: number;
      hasMore: boolean;
    }>(`/api/transactions?${params}`);

    return history;
  } catch (error) {
    console.error('REZ Payments SDK: Failed to get transaction history', error);
    throw error;
  }
}

/**
 * Get transaction details
 */
export async function getTransaction(transactionId: string): Promise<Transaction> {
  if (!sdkInitialized) {
    throw new Error('SDK not initialized. Call init() first.');
  }

  try {
    const transaction = await request<Transaction>(`/api/transactions/${transactionId}`);
    return transaction;
  } catch (error) {
    console.error('REZ Payments SDK: Failed to get transaction', error);
    throw error;
  }
}

// ============================================================================
// Recurring Payments
// ============================================================================

/**
 * Create a subscription/recurring payment
 */
export async function createSubscription(
  subscription: {
    planId: string;
    paymentMethodId: string;
    startDate?: number;
    metadata?: Record<string, unknown>;
  }
): Promise<{
  success: boolean;
  subscriptionId: string;
  nextBillingDate: number;
  status: string;
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
      subscriptionId: string;
      nextBillingDate: number;
      status: string;
    }>(`/api/users/${currentUser.id}/subscriptions`, {
      method: 'POST',
      body: JSON.stringify({
        ...subscription,
        userId: currentUser.id,
      }),
    });

    await trackEvent('subscription_created', {
      subscriptionId: result.subscriptionId,
      planId: subscription.planId,
    });

    return result;
  } catch (error) {
    console.error('REZ Payments SDK: Failed to create subscription', error);
    throw error;
  }
}

/**
 * Cancel a subscription
 */
export async function cancelSubscription(
  subscriptionId: string,
  reason?: string,
  immediate?: boolean
): Promise<void> {
  if (!sdkInitialized) {
    throw new Error('SDK not initialized. Call init() first.');
  }

  try {
    await request(`/api/subscriptions/${subscriptionId}/cancel`, {
      method: 'POST',
      body: JSON.stringify({ reason, immediate }),
    });

    await trackEvent('subscription_cancelled', {
      subscriptionId,
      reason,
      immediate,
    });
  } catch (error) {
    console.error('REZ Payments SDK: Failed to cancel subscription', error);
    throw error;
  }
}

// ============================================================================
// SDK Version Info
// ============================================================================

export const SDK_VERSION = '1.0.0';
export const SDK_NAME = '@rez-app/payments-sdk';

// ============================================================================
// Default export
// ============================================================================

const paymentsSDK = {
  init,
  isInitialized,
  getUser,
  setUser,
  clearUser,
  trackEvent,
  getPaymentMethods,
  getSavedPaymentMethods,
  savePaymentMethod,
  removePaymentMethod,
  createPayment,
  confirmPayment,
  getPaymentStatus,
  cancelPayment,
  requestRefund,
  getRefundStatus,
  getWalletBalance,
  addToWallet,
  withdrawFromWallet,
  getTransactionHistory,
  getTransaction,
  createSubscription,
  cancelSubscription,
  SDK_VERSION,
  SDK_NAME,
};

export default paymentsSDK;
