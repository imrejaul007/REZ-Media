/**
 * Razorpay Service - Full Razorpay SDK wrapper
 */

import Razorpay from 'razorpay';

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID || '',
  key_secret: process.env.RAZORPAY_KEY_SECRET || '',
});

export class RazorpayService {

  /**
   * Create order for wallet top-up
   */
  async createOrder(
    amount: number,
    receipt: string,
    notes: Record<string, string> = {}
  ): Promise<{ orderId: string; amount: number; currency: string }> {
    try {
      const order = await razorpay.orders.create({
        amount: Math.round(amount * 100), // Razorpay uses paise
        currency: 'INR',
        receipt,
        notes,
      });

      return {
        orderId: order.id,
        amount: order.amount / 100,
        currency: order.currency,
      };
    } catch (error: any) {
      throw new Error(`Razorpay order creation failed: ${error.message}`);
    }
  }

  /**
   * Verify payment signature
   */
  verifySignature(orderId: string, paymentId: string, signature: string): boolean {
    const crypto = require('crypto-js');
    const expectedSignature = crypto.HmacSHA256(`${orderId}|${paymentId}`, process.env.RAZORPAY_KEY_SECRET || '');
    return expectedSignature.toString() === signature;
  }

  /**
   * Get payment details
   */
  async getPayment(paymentId: string): Promise<any> {
    try {
      return await razorpay.payments.fetch(paymentId);
    } catch (error: any) {
      throw new Error(`Failed to fetch payment: ${error.message}`);
    }
  }

  /**
   * Create payout to bank account
   */
  async createPayout(params: {
    accountNumber: string;
    ifsc: string;
    name: string;
    amount: number;
    purpose?: string;
  }): Promise<{ payoutId: string; status: string }> {
    try {
      const payout = await razorpay.payments.createPayout({
        account_number: params.accountNumber,
        fund_account: {
          account_type: 'bank_account',
          bank_account: {
            name: params.name,
            ifsc: params.ifsc,
            account_number: params.accountNumber,
          },
        },
        amount: Math.round(params.amount * 100),
        currency: 'INR',
        mode: 'IMPS',
        purpose: params.purpose || 'payout',
      });

      return {
        payoutId: payout.id,
        status: payout.status,
      };
    } catch (error: any) {
      throw new Error(`Payout failed: ${error.message}`);
    }
  }

  /**
   * Create refund
   */
  async createRefund(paymentId: string, amount?: number): Promise<{ refundId: string; status: string }> {
    try {
      const refund = await razorpay.payments.refund(paymentId, {
        amount: amount ? Math.round(amount * 100) : undefined,
      });

      return {
        refundId: refund.id,
        status: refund.status,
      };
    } catch (error: any) {
      throw new Error(`Refund failed: ${error.message}`);
    }
  }

  /**
   * Get refund details
   */
  async getRefund(refundId: string): Promise<any> {
    try {
      return await razorpay.refunds.fetch(refundId);
    } catch (error: any) {
      throw new Error(`Failed to fetch refund: ${error.message}`);
    }
  }

  /**
   * Create customer
   */
  async createCustomer(params: {
    name: string;
    email?: string;
    phone: string;
  }): Promise<{ customerId: string }> {
    try {
      const customer = await razorpay.customers.create({
        name: params.name,
        email: params.email,
        contact: params.phone,
      });

      return { customerId: customer.id };
    } catch (error: any) {
      throw new Error(`Customer creation failed: ${error.message}`);
    }
  }

  /**
   * Add card to customer
   */
  async addCard(customerId: string, card: {
    card_number: string;
    name: string;
    expiry_month: string;
    expiry_year: string;
    cvv: string;
  }): Promise<{ token: string }> {
    try {
      const token = await razorpay.customers.createToken(customerId, {
        customer_id: customerId,
        method: 'card',
        card: {
          number: card.card_number,
          cvv: card.cvv,
          expiry_month: card.expiry_month,
          expiry_year: card.expiry_year,
          name: card.name,
        },
      });

      return { token: token.id };
    } catch (error: any) {
      throw new Error(`Card addition failed: ${error.message}`);
    }
  }
}

export const razorpayService = new RazorpayService();
