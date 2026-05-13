/**
 * Razorpay Type Definitions
 */

// ============================================================================
// Order Types
// ============================================================================

export interface CreateOrderParams {
  amount: number;
  currency?: string;
  receipt?: string;
  notes?: Record<string, string>;
  idempotencyKey?: string;
}

export interface CreateOrderResponse {
  id: string;
  entity: string;
  amount: number;
  amount_paid: number;
  amount_due: number;
  currency: string;
  receipt: string;
  status: OrderStatus;
  attempts: number;
  created_at: number;
}

// ============================================================================
// Payment Types
// ============================================================================

export interface VerifyPaymentParams {
  orderId: string;
  paymentId: string;
  signature: string;
  merchantId?: string;
  amount?: number;
}

export interface VerifyPaymentResponse {
  valid: boolean;
  error?: string;
  paymentId?: string;
  orderId?: string;
  amount?: number;
  status?: string;
}

export interface PaymentDetails {
  id: string;
  entity: string;
  amount: number;
  currency: string;
  status: PaymentStatus;
  order_id: string;
  invoice_id: string | null;
  international: boolean;
  method: string;
  amount_refunded: number;
  refund_status: string | null;
  captured: boolean;
  description: string;
  card_id: string;
  bank: string | null;
  wallet: string | null;
  vpa: string | null;
  email: string;
  contact: string;
  notes: Record<string, string>;
  created_at: number;
}

// ============================================================================
// Wallet Order Result
// ============================================================================

export interface WalletOrderResult {
  orderId: string;
  amount: number;
  currency: string;
  receipt: string;
  status: string;
}

// ============================================================================
// Ad Payment Order Result
// ============================================================================

export interface AdPaymentOrderResult {
  orderId: string;
  amount: number;
  currency: string;
  receipt: string;
  campaignId: string;
  status: string;
}

// ============================================================================
// Payout Types
// ============================================================================

export interface CreatePayoutParams {
  accountNumber: string;
  ifsc: string;
  amount: number;
  name: string;
  merchantId: string;
  notes?: Record<string, string>;
  idempotencyKey?: string;
}

export interface PayoutResult {
  payoutId: string;
  amount: number;
  status: string;
  createdAt: number;
}

export interface PayoutDetails {
  id: string;
  entity: string;
  amount: number;
  currency: string;
  status: PayoutStatus;
  purpose: string;
  mode: string;
  reference_id: string;
  remark: string | null;
  created_at: number;
  completed_at: number | null;
  failure_reason: string | null;
}

// ============================================================================
// Refund Types
// ============================================================================

export interface CreateRefundParams {
  paymentId: string;
  amount?: number;
  notes?: Record<string, string>;
  idempotencyKey?: string;
}

export interface CreatePayoutResponse {
  id: string;
  entity: string;
  amount: number;
  currency: string;
  status: string;
  mode: string;
  purpose: string;
  reference_id: string;
  created_at: number;
}

export interface CreateRefundResponse {
  id: string;
  entity: string;
  amount: number;
  currency: string;
  payment_id: string;
  status: string;
  speed_processed: string;
  created_at: number;
}

export interface RefundResult {
  refundId: string;
  paymentId: string;
  amount: number;
  status: RefundStatus;
  speedProcessed: string;
}

export interface RefundDetails {
  id: string;
  entity: string;
  amount: number;
  currency: string;
  payment_id: string;
  status: RefundStatus;
  speed_processed: string;
  created_at: number;
  acquire_batch_id: string | null;
  acquire_id: string | null;
}

// ============================================================================
// Webhook Types
// ============================================================================

export interface WebhookVerificationResult {
  valid: boolean;
  error?: string;
}

export interface WebhookPayload {
  event: string;
  payload: {
    payment?: {
      entity: PaymentDetails;
    };
    order?: {
      entity: CreateOrderResponse;
    };
    payout?: {
      entity: PayoutDetails;
    };
    refund?: {
      entity: RefundDetails;
    };
  };
  created_at: number;
}

// ============================================================================
// Enums
// ============================================================================

export type OrderStatus =
  | 'created'
  | 'attempted'
  | 'paid';

export type PaymentStatus =
  | 'created'
  | 'authorized'
  | 'captured'
  | 'refunded'
  | 'failed';

export type PayoutStatus =
  | 'pending'
  | 'processed'
  | 'failed'
  | 'reversed';

export type RefundStatus =
  | 'pending'
  | 'processed'
  | 'failed';

// ============================================================================
// Wallet Types
// ============================================================================

export interface WalletBalance {
  merchantId: string;
  balance: number;
  currency: string;
  updatedAt: Date;
}

export interface WalletTransaction {
  id: string;
  merchantId: string;
  type: 'credit' | 'debit';
  amount: number;
  balanceAfter: number;
  reference: string;
  description?: string;
  createdAt: Date;
}

// ============================================================================
// API Response Types
// ============================================================================

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}
