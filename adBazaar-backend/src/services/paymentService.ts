/**
 * AdBazaar - Payment Service
 * Integrates with RABTUL payment service for:
 * - Campaign payments (advertisers pay)
 * - Owner payouts (monthly payments)
 * - Platform commission
 */

import axios from 'axios';

// Configuration
const PAYMENT_SERVICE_URL = process.env.PAYMENT_SERVICE_URL || 'http://localhost:4001';
const INTERNAL_TOKEN = process.env.INTERNAL_SERVICE_TOKEN || 'dev-token';

// Payment split configuration
export const PAYMENT_SPLIT = {
  OWNER_PERCENT: 70,
  PLATFORM_PERCENT: 30,
  GST_PERCENT: 18,
  MIN_PAYOUT: 1000, // ₹1000 minimum payout
  PAYOUT_SCHEDULE: 'monthly', // Monthly payouts on 15th
};

// ============================================================================
// TYPES
// ============================================================================

export interface CampaignPayment {
  paymentId: string;
  campaignId: string;
  advertiserId: string;
  amount: number;
  currency: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
  createdAt: Date;
  completedAt?: Date;
}

export interface OwnerPayout {
  payoutId: string;
  ownerId: string;
  amount: number;
  currency: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  transactionId?: string;
  period: {
    start: Date;
    end: Date;
  };
  breakdown: {
    grossRevenue: number;
    platformFee: number;
    gst: number;
    netPayable: number;
  };
  scheduledDate: Date;
  createdAt: Date;
  completedAt?: Date;
}

export interface Invoice {
  invoiceId: string;
  type: 'advertiser' | 'owner';
  recipientId: string;
  period: {
    start: Date;
    end: Date;
  };
  items: {
    description: string;
    quantity: number;
    unitPrice: number;
    amount: number;
  }[];
  subtotal: number;
  tax: number;
  total: number;
  status: 'draft' | 'sent' | 'paid' | 'overdue';
  dueDate: Date;
  paidAt?: Date;
}

// ============================================================================
// PAYMENT CLIENT
// ============================================================================

class PaymentClient {
  private baseURL: string;
  private token: string;

  constructor() {
    this.baseURL = PAYMENT_SERVICE_URL;
    this.token = INTERNAL_TOKEN;
  }

  private async request<T>(endpoint: string, data?: unknown, method = 'POST'): Promise<T> {
    const url = `${this.baseURL}${endpoint}`;

    const response = await axios({
      method,
      url,
      data,
      headers: {
        'Content-Type': 'application/json',
        'X-Internal-Token': this.token,
      },
      timeout: 10000,
    });

    return response.data;
  }

  // ============================================================================
  // ADVERTISER PAYMENTS
  // ============================================================================

  /**
   * Create payment order for campaign
   */
  async createCampaignPayment(data: {
    advertiserId: string;
    campaignId: string;
    amount: number;
    currency?: string;
  }): Promise<{
    orderId: string;
    amount: number;
    currency: string;
    status: string;
  }> {
    return this.request('/api/payments/initiate', {
      type: 'campaign_payment',
      userId: data.advertiserId,
      amount: data.amount,
      currency: data.currency || 'INR',
      metadata: {
        campaignId: data.campaignId,
        service: 'adbazaar',
      },
    });
  }

  /**
   * Get payment status
   */
  async getPaymentStatus(paymentId: string): Promise<{
    status: string;
    amount: number;
    razorpayPaymentId?: string;
  }> {
    return this.request(`/api/payments/${paymentId}`);
  }

  /**
   * Verify payment webhook
   */
  async verifyWebhook(payload: unknown, signature: string): Promise<boolean> {
    try {
      await this.request('/api/webhooks/razorpay/verify', {
        payload,
        signature,
      });
      return true;
    } catch {
      return false;
    }
  }

  // ============================================================================
  // OWNER PAYOUTS
  // ============================================================================

  /**
   * Create payout for screen owner
   */
  async createPayout(data: {
    ownerId: string;
    amount: number;
    bankDetails: {
      accountNumber: string;
      accountName: string;
      bankName: string;
      ifscCode: string;
    };
  }): Promise<{
    payoutId: string;
    status: string;
    estimatedDate: Date;
  }> {
    return this.request('/api/payouts/initiate', {
      type: 'owner_payout',
      userId: data.ownerId,
      amount: data.amount,
      bankDetails: data.bankDetails,
      metadata: {
        service: 'adbazaar',
      },
    });
  }

  /**
   * Get payout status
   */
  async getPayoutStatus(payoutId: string): Promise<{
    status: string;
    transactionId?: string;
    completedAt?: Date;
  }> {
    return this.request(`/api/payouts/${payoutId}`);
  }
}

// ============================================================================
// PAYMENT CALCULATIONS
// ============================================================================

/**
 * Calculate payment breakdown for a campaign
 */
export function calculateCampaignPayment(params: {
  impressions: number;
  cpm: number;
  platformFeePercent?: number;
  gstPercent?: number;
}): {
  grossAmount: number;
  platformFee: number;
  gst: number;
  total: number;
} {
  const grossAmount = (params.impressions * params.cpm) / 1000;
  const platformFeePercent = params.platformFeePercent ?? PAYMENT_SPLIT.PLATFORM_PERCENT;
  const gstPercent = params.gstPercent ?? PAYMENT_SPLIT.GST_PERCENT;

  const platformFee = grossAmount * (platformFeePercent / 100);
  const gst = platformFee * (gstPercent / 100);
  const total = grossAmount + gst;

  return {
    grossAmount: Math.round(grossAmount * 100) / 100,
    platformFee: Math.round(platformFee * 100) / 100,
    gst: Math.round(gst * 100) / 100,
    total: Math.round(total * 100) / 100,
  };
}

/**
 * Calculate owner payout
 */
export function calculateOwnerPayout(params: {
  grossRevenue: number;
  ownerPercent?: number;
}): {
  ownerAmount: number;
  platformAmount: number;
  payoutAmount: number;
} {
  const ownerPercent = params.ownerPercent ?? PAYMENT_SPLIT.OWNER_PERCENT;
  const ownerAmount = params.grossRevenue * (ownerPercent / 100);
  const platformAmount = params.grossRevenue - ownerAmount;

  return {
    ownerAmount: Math.round(ownerAmount * 100) / 100,
    platformAmount: Math.round(platformAmount * 100) / 100,
    payoutAmount: Math.round(ownerAmount * 100) / 100, // Before GST deduction
  };
}

/**
 * Calculate installments for large campaigns
 */
export function calculateInstallments(params: {
  totalAmount: number;
  installments: number;
}): {
  installments: { amount: number; dueDate: Date }[];
} {
  const installmentAmount = Math.round((params.totalAmount / params.installments) * 100) / 100;
  const now = new Date();

  const schedule = [];
  for (let i = 0; i < params.installments; i++) {
    const dueDate = new Date(now);
    dueDate.setDate(dueDate.getDate() + (i + 1) * 30); // Monthly installments
    schedule.push({
      amount: installmentAmount,
      dueDate,
    });
  }

  return { installments: schedule };
}

// ============================================================================
// EXPORT
// ============================================================================

export const paymentClient = new PaymentClient();

export default paymentClient;
