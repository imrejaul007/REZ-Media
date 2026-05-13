/**
 * Razorpay Service - Payment SDK wrapper
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
  async createWalletOrder(
    merchantId: string,
    amount: number,
    currency: string = 'INR'
  ): Promise<{ orderId: string; amount: number }> {
    const order = await razorpay.orders.create({
      amount: amount * 100, // Razorpay uses paise
      currency,
      receipt: `wallet_${merchantId}_${Date.now()}`,
      notes: {
        merchantId,
        type: 'wallet_topup',
      },
    });

    return {
      orderId: order.id,
      amount: order.amount / 100,
    };
  }

  /**
   * Create order for ad payment
   */
  async createAdPaymentOrder(
    merchantId: string,
    campaignId: string,
    amount: number,
    currency: string = 'INR'
  ): Promise<{ orderId: string; amount: number }> {
    const order = await razorpay.orders.create({
      amount: amount * 100,
      currency,
      receipt: `ad_${merchantId}_${campaignId}_${Date.now()}`,
      notes: {
        merchantId,
        campaignId,
        type: 'ad_payment',
      },
    });

    return {
      orderId: order.id,
      amount: order.amount / 100,
    };
  }

  /**
   * Verify payment signature
   */
  verifySignature(
    orderId: string,
    paymentId: string,
    signature: string
  ): boolean {
    const crypto = require('crypto-js');
    const expectedSignature = crypto.HmacSHA256(`${orderId}|${paymentId}`, process.env.RAZORPAY_KEY_SECRET || '');
    return expectedSignature === signature;
  }

  /**
   * Initiate merchant payout
   */
  async createPayout(
    merchantId: string,
    accountNumber: string,
    ifsc: string,
    amount: number,
    name: string
  ): Promise<{ payoutId: string; status: string }> {
    const payout = await razorpay.payments.createPayout({
      account_number: accountNumber,
      fund_account: {
        account_type: 'bank_account',
        bank_account: {
          name,
          ifsc,
          account_number: accountNumber,
        },
      },
      amount: amount * 100,
      currency: 'INR',
      mode: 'IMPS',
      purpose: 'payout',
      notes: {
        merchantId,
      },
    });

    return {
      payoutId: payout.id,
      status: payout.status,
    };
  }

  /**
   * Refund payment
   */
  async refundPayment(
    paymentId: string,
    amount?: number
  ): Promise<{ refundId: string; status: string }> {
    const refund = await razorpay.payments.refund(paymentId, {
      amount: amount ? amount * 100 : undefined,
    });

    return {
      refundId: refund.id,
      status: refund.status,
    };
  }
}

export const razorpayService = new RazorpayService();
