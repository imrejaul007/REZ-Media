/**
 * RABTUL Payment Service - Replaces local Razorpay SDK
 *
 * Uses centralized RABTUL Payment Service for all payment operations.
 * This prevents duplicate Razorpay instances across services.
 *
 * @see RABTUL-Technologies/RAP.md
 */

const PAYMENT_SERVICE_URL = process.env.PAYMENT_SERVICE_URL || 'https://rez-payment-service.onrender.com';
const INTERNAL_SERVICE_TOKEN = process.env.INTERNAL_SERVICE_TOKEN || '';

interface PaymentHeaders {
  'Content-Type': string;
  'X-Internal-Token': string;
  'X-Internal-Service': string;
}

const headers: PaymentHeaders = {
  'Content-Type': 'application/json',
  'X-Internal-Token': INTERNAL_SERVICE_TOKEN,
  'X-Internal-Service': 'rez-payment-gateway',
};

async function rabtulRequest<T>(endpoint: string, body?: unknown): Promise<T> {
  const response = await fetch(`${PAYMENT_SERVICE_URL}${endpoint}`, {
    method: body ? 'POST' : 'GET',
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`RABTUL Payment Error: ${response.status} - ${error}`);
  }

  return response.json();
}

export class RazorpayService {

  /**
   * Create order for wallet top-up via RABTUL
   */
  async createOrder(
    amount: number,
    receipt: string,
    notes: Record<string, string> = {}
  ): Promise<{ orderId: string; amount: number; currency: string }> {
    try {
      const result = await rabtulRequest<any>('/api/payments/initiate', {
        amount: Math.round(amount * 100), // RABTUL expects paise
        currency: 'INR',
        receipt,
        notes,
      });

      return {
        orderId: result.orderId || result.id,
        amount: (result.amount || amount * 100) / 100,
        currency: result.currency || 'INR',
      };
    } catch (error: any) {
      throw new Error(`RABTUL Payment order creation failed: ${error.message}`);
    }
  }

  /**
   * Verify payment signature via RABTUL
   */
  async verifySignature(orderId: string, paymentId: string, signature: string): Promise<boolean> {
    try {
      const result = await rabtulRequest<{ success: boolean }>('/api/payments/verify', {
        razorpay_order_id: orderId,
        razorpay_payment_id: paymentId,
        razorpay_signature: signature,
      });

      return result.success === true;
    } catch (error: any) {
      throw new Error(`RABTUL Payment verification failed: ${error.message}`);
    }
  }

  /**
   * Get payment details via RABTUL
   */
  async getPayment(paymentId: string): Promise<any> {
    try {
      return await rabtulRequest(`/api/payments/${paymentId}`);
    } catch (error: any) {
      throw new Error(`RABTUL Payment fetch failed: ${error.message}`);
    }
  }

  /**
   * Create payout to bank account via RABTUL
   */
  async createPayout(params: {
    accountNumber: string;
    ifsc: string;
    name: string;
    amount: number;
    purpose?: string;
  }): Promise<{ payoutId: string; status: string }> {
    try {
      const result = await rabtulRequest<any>('/api/payments/payout', params);

      return {
        payoutId: result.payoutId || result.id,
        status: result.status || 'pending',
      };
    } catch (error: any) {
      throw new Error(`RABTUL Payout creation failed: ${error.message}`);
    }
  }

  /**
   * Refund payment via RABTUL
   */
  async refundPayment(paymentId: string, amount?: number): Promise<{ refundId: string; status: string }> {
    try {
      const result = await rabtulRequest<any>('/api/payments/refund', {
        payment_id: paymentId,
        amount: amount ? Math.round(amount * 100) : undefined,
      });

      return {
        refundId: result.refundId || result.id,
        status: result.status || 'processed',
      };
    } catch (error: any) {
      throw new Error(`RABTUL Refund failed: ${error.message}`);
    }
  }

  /**
   * Get order details via RABTUL
   */
  async getOrder(orderId: string): Promise<any> {
    try {
      return await rabtulRequest(`/api/payments/status/${orderId}`);
    } catch (error: any) {
      throw new Error(`RABTUL Order fetch failed: ${error.message}`);
    }
  }
}

// Export singleton instance
export const razorpayService = new RazorpayService();
