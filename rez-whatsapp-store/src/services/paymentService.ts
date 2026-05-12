import axios, { AxiosInstance } from 'axios';
import winston from 'winston';
import Razorpay from 'razorpay';
import { configManager } from '../config';

const logger = winston.createLogger({
  level: configManager.get().logging.level,
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [new winston.transports.Console()],
});

export interface CreatePaymentInput {
  orderId: string;
  amount: number;
  currency: string;
  receipt?: string;
  notes?: Record<string, string>;
  customerPhone: string;
  customerEmail?: string;
}

export interface PaymentDetails {
  razorpayOrderId: string;
  razorpayPaymentId?: string;
  status: 'created' | 'attempted' | 'paid' | 'failed';
  amount: number;
  currency: string;
  method?: string;
  customerPhone: string;
  createdAt: Date;
}

export interface PaymentResponse {
  success: boolean;
  payment?: PaymentDetails;
  checkoutId?: string;
  error?: string;
}

export interface PaymentVerificationInput {
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
}

export interface PaymentStatusResponse {
  success: boolean;
  status: 'pending' | 'paid' | 'failed' | 'refunded';
  paymentDetails?: PaymentDetails;
  error?: string;
}

export class PaymentService {
  private static instance: PaymentService;
  private razorpay: Razorpay;
  private internalApiClient: AxiosInstance;

  private constructor() {
    const config = configManager.get();

    this.razorpay = new Razorpay({
      key_id: config.razorpay.keyId,
      key_secret: config.razorpay.keySecret,
    });

    this.internalApiClient = axios.create({
      baseURL: config.services.payment,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  static getInstance(): PaymentService {
    if (!PaymentService.instance) {
      PaymentService.instance = new PaymentService();
    }
    return PaymentService.instance;
  }

  private getInternalHeaders(): Record<string, string> {
    const token = configManager.getInternalToken('payment-service');
    return {
      'X-Internal-Token': token || '',
      'X-Service-Name': 'whatsapp-store',
    };
  }

  async createPayment(input: CreatePaymentInput): Promise<PaymentResponse> {
    try {
      const config = configManager.get();

      // Create Razorpay order
      const razorpayOrder = await this.razorpay.orders.create({
        amount: Math.round(input.amount * 100), // Razorpay uses paise
        currency: input.currency,
        receipt: input.receipt || `rcpt_${input.orderId}`,
        notes: {
          orderId: input.orderId,
          customerPhone: input.customerPhone,
          source: 'whatsapp-store',
          ...input.notes,
        },
      });

      logger.info('Payment order created', {
        orderId: input.orderId,
        razorpayOrderId: razorpayOrder.id,
        amount: input.amount,
      });

      const paymentDetails: PaymentDetails = {
        razorpayOrderId: razorpayOrder.id,
        status: 'created',
        amount: input.amount,
        currency: input.currency,
        customerPhone: input.customerPhone,
        createdAt: new Date(),
      };

      // Sync with REZ Payment Service
      try {
        await this.syncPaymentToPaymentService({
          orderId: input.orderId,
          razorpayOrderId: razorpayOrder.id,
          amount: input.amount,
          currency: input.currency,
          customerPhone: input.customerPhone,
        });
      } catch (syncError) {
        logger.warn('Failed to sync payment to payment service', { error: syncError, orderId: input.orderId });
      }

      return {
        success: true,
        payment: paymentDetails,
      };
    } catch (error) {
      logger.error('Error creating payment', { error, input });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create payment',
      };
    }
  }

  async verifyPayment(input: PaymentVerificationInput): Promise<PaymentStatusResponse> {
    try {
      const config = configManager.get();
      const crypto = await import('crypto');

      // Verify signature
      const expectedSignature = crypto
        .createHmac('sha256', config.razorpay.keySecret)
        .update(`${input.razorpayOrderId}|${input.razorpayPaymentId}`)
        .digest('hex');

      const isValid = expectedSignature === input.razorpaySignature;

      if (!isValid) {
        logger.warn('Invalid payment signature', {
          razorpayOrderId: input.razorpayOrderId,
          razorpayPaymentId: input.razorpayPaymentId,
        });
        return {
          success: false,
          status: 'failed',
          error: 'Invalid payment signature',
        };
      }

      // Get payment details from Razorpay
      const payment = await this.razorpay.payments.fetch(input.razorpayPaymentId);

      logger.info('Payment verified and captured', {
        razorpayOrderId: input.razorpayOrderId,
        razorpayPaymentId: input.razorpayPaymentId,
        amount: payment.amount / 100,
      });

      const paymentDetails: PaymentDetails = {
        razorpayOrderId: input.razorpayOrderId,
        razorpayPaymentId: input.razorpayPaymentId,
        status: 'paid',
        amount: payment.amount / 100,
        currency: payment.currency.toUpperCase(),
        method: payment.method,
        customerPhone: payment.phone || '',
        createdAt: new Date(payment.created_at * 1000),
      };

      // Update REZ Payment Service
      try {
        await this.updatePaymentStatus(input.razorpayOrderId, 'captured', {
          razorpayPaymentId: input.razorpayPaymentId,
        });
      } catch (syncError) {
        logger.warn('Failed to update payment service', { error: syncError });
      }

      return {
        success: true,
        status: 'paid',
        paymentDetails,
      };
    } catch (error) {
      logger.error('Error verifying payment', { error, input });
      return {
        success: false,
        status: 'failed',
        error: error instanceof Error ? error.message : 'Failed to verify payment',
      };
    }
  }

  async getPaymentStatus(razorpayOrderId: string): Promise<PaymentStatusResponse> {
    try {
      const payments = await this.razorpay.orders.fetch(razorpayOrderId);

      if (payments.status === 'paid' && payments.amount_paid > 0) {
        const paymentList = await this.razorpay.orders.fetchPayments(razorpayOrderId);
        const capturedPayment = paymentList.items.find((p: { status: string }) => p.status === 'captured');

        return {
          success: true,
          status: 'paid',
          paymentDetails: {
            razorpayOrderId,
            razorpayPaymentId: capturedPayment?.id,
            status: 'paid',
            amount: payments.amount_paid / 100,
            currency: payments.currency.toUpperCase(),
            method: capturedPayment?.method,
            customerPhone: payments.notes?.customerPhone || '',
            createdAt: new Date(payments.created_at * 1000),
          },
        };
      }

      return {
        success: true,
        status: 'pending',
      };
    } catch (error) {
      logger.error('Error getting payment status', { error, razorpayOrderId });
      return {
        success: false,
        status: 'pending',
        error: error instanceof Error ? error.message : 'Failed to get payment status',
      };
    }
  }

  async refundPayment(razorpayPaymentId: string, amount?: number, reason?: string): Promise<{
    success: boolean;
    refundId?: string;
    error?: string;
  }> {
    try {
      const refundData: Record<string, unknown> = {
        payment_id: razorpayPaymentId,
      };

      if (amount) {
        refundData.amount = Math.round(amount * 100);
      }

      if (reason) {
        refundData.notes = { reason };
      }

      const refund = await this.razorpay.refunds.create(refundData);

      logger.info('Refund initiated', {
        razorpayPaymentId,
        refundId: refund.id,
        amount: amount || 'full',
      });

      // Update REZ Payment Service
      try {
        await this.updatePaymentStatus('', 'refunded', {
          razorpayRefundId: refund.id,
          originalPaymentId: razorpayPaymentId,
        });
      } catch (syncError) {
        logger.warn('Failed to update payment service with refund', { error: syncError });
      }

      return {
        success: true,
        refundId: refund.id,
      };
    } catch (error) {
      logger.error('Error processing refund', { error, razorpayPaymentId });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to process refund',
      };
    }
  }

  async generatePaymentLink(checkoutId: string, amount: number, phone: string): Promise<{
    success: boolean;
    paymentLink?: string;
    shortUrl?: string;
    error?: string;
  }> {
    try {
      const config = configManager.get();

      const paymentLink = await this.razorpay.paymentLink.create({
        amount: Math.round(amount * 100),
        currency: config.store.currency,
        description: `Order Payment - ${checkoutId}`,
        customer: {
          phone,
        },
        options: {
          checkout: {
            method: {
              netbanking: true,
              card: true,
              upi: true,
              wallet: true,
              emi: true,
            },
          },
        },
        callback_url: `${config.services.communications}/api/whatsapp/payment/callback`,
        callback_method: 'get',
      });

      logger.info('Payment link generated', {
        checkoutId,
        paymentLinkId: paymentLink.id,
        amount,
      });

      return {
        success: true,
        paymentLink: paymentLink.short_url,
        shortUrl: paymentLink.short_url,
      };
    } catch (error) {
      logger.error('Error generating payment link', { error, checkoutId });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to generate payment link',
      };
    }
  }

  async processUPIIntent(phoneNumber: string, amount: number, orderId: string): Promise<{
    success: boolean;
    upiLink?: string;
    error?: string;
  }> {
    try {
      const config = configManager.get();
      const upiId = `rezstore@razorpay`;

      // Generate UPI payment link
      const upiLink = `upi://pay?pa=${upiId}&pn=REZ%20Store&tr=${orderId}&am=${amount.toFixed(2)}&cu=INR&tn=Payment%20for%20${orderId}`;

      return {
        success: true,
        upiLink,
      };
    } catch (error) {
      logger.error('Error generating UPI intent', { error, phoneNumber });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to generate UPI link',
      };
    }
  }

  private async syncPaymentToPaymentService(data: {
    orderId: string;
    razorpayOrderId: string;
    amount: number;
    currency: string;
    customerPhone: string;
  }): Promise<void> {
    await this.internalApiClient.post('/api/payments/sync', data, {
      headers: this.getInternalHeaders(),
    });
  }

  private async updatePaymentStatus(
    razorpayOrderId: string,
    status: string,
    additionalData?: Record<string, unknown>
  ): Promise<void> {
    await this.internalApiClient.patch(
      `/api/payments/order/${razorpayOrderId}/status`,
      { status, ...additionalData },
      { headers: this.getInternalHeaders() }
    );
  }

  async checkWalletBalance(userId: string): Promise<{
    success: boolean;
    balance?: number;
    error?: string;
  }> {
    try {
      const response = await this.internalApiClient.get(`/api/wallet/balance/${userId}`, {
        headers: this.getInternalHeaders(),
      });

      return {
        success: true,
        balance: response.data.balance,
      };
    } catch (error) {
      logger.error('Error checking wallet balance', { error, userId });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to check wallet balance',
      };
    }
  }

  async deductFromWallet(userId: string, amount: number, orderId: string): Promise<{
    success: boolean;
    transactionId?: string;
    error?: string;
  }> {
    try {
      const response = await this.internalApiClient.post(
        '/api/wallet/deduct',
        {
          userId,
          amount,
          orderId,
          description: `Order Payment - ${orderId}`,
        },
        { headers: this.getInternalHeaders() }
      );

      return {
        success: true,
        transactionId: response.data.transactionId,
      };
    } catch (error) {
      logger.error('Error deducting from wallet', { error, userId });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to deduct from wallet',
      };
    }
  }
}

export const paymentService = PaymentService.getInstance();
export default paymentService;
