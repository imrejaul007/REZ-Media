/**
 * COD Intelligence Integration for Shopify Connector
 * Integrates with REZ-cod-intelligence service
 */

import { logger } from '../config';

const COD_SERVICE_URL = process.env.COD_INTELLIGENCE_URL || 'http://localhost:4040';
const INTERNAL_TOKEN = process.env.INTERNAL_SERVICE_TOKEN || '';

interface OrderRiskInput {
  orderId: string;
  customerId?: string;
  customerPhone: string;
  customerEmail?: string;
  amount: number;
  items?: any[];
  pincode?: string;
  merchantId?: string;
}

interface OrderRiskResult {
  success: boolean;
  data?: {
    orderId: string;
    totalScore: number;
    riskLevel: 'low' | 'medium' | 'high' | 'very_high';
    decision: 'approve' | 'review' | 'reject' | 'prepay';
    breakdown: {
      customerScore: number;
      pincodeScore: number;
      orderScore: number;
      fraudScore: number;
    };
    recommendations: {
      action: string;
      reason: string;
      confidence: number;
    }[];
  };
  error?: string;
}

interface OrderLogInput {
  orderId: string;
  customerId: string;
  customerPhone: string;
  customerAddress: {
    pincode?: string;
    city?: string;
    state?: string;
  };
  amount: number;
  items?: any[];
  merchantId: string;
  courier?: string;
  paymentMethod: string;
}

class CODIntelligenceService {
  /**
   * Score an order for COD risk
   */
  async scoreOrder(input: OrderRiskInput): Promise<OrderRiskResult> {
    try {
      const response = await fetch(`${COD_SERVICE_URL}/api/score`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Internal-Token': INTERNAL_TOKEN,
        },
        body: JSON.stringify(input),
      });

      if (!response.ok) {
        const error = await response.text();
        logger.warn(`[COD] Score failed: ${error}`);
        return { success: false, error };
      }

      const result = await response.json();
      return {
        success: true,
        data: result.data,
      };
    } catch (error: any) {
      logger.warn(`[COD] Score error: ${error.message}`);
      // Don't fail the order - COD service might be down
      return { success: false, error: error.message };
    }
  }

  /**
   * Log an order for historical data
   */
  async logOrder(input: OrderLogInput): Promise<boolean> {
    try {
      const response = await fetch(`${COD_SERVICE_URL}/api/orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Internal-Token': INTERNAL_TOKEN,
        },
        body: JSON.stringify({
          orderId: input.orderId,
          customerId: input.customerId,
          customerPhone: input.customerPhone,
          customerAddress: input.customerAddress,
          amount: input.amount,
          items: input.items,
          merchantId: input.merchantId,
          courier: input.courier,
          paymentMethod: input.paymentMethod,
        }),
      });

      return response.ok;
    } catch (error: any) {
      logger.warn(`[COD] Log order error: ${error.message}`);
      return false;
    }
  }

  /**
   * Update order outcome (for training data)
   */
  async updateOrderOutcome(orderId: string, outcome: string): Promise<boolean> {
    try {
      const response = await fetch(`${COD_SERVICE_URL}/api/orders/${orderId}/outcome`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-Internal-Token': INTERNAL_TOKEN,
        },
        body: JSON.stringify({ outcome }),
      });

      return response.ok;
    } catch (error: any) {
      logger.warn(`[COD] Update outcome error: ${error.message}`);
      return false;
    }
  }

  /**
   * Get merchant analytics
   */
  async getMerchantAnalytics(merchantId: string, period = '30days'): Promise<any> {
    try {
      const response = await fetch(
        `${COD_SERVICE_URL}/api/analytics?type=merchant&merchantId=${merchantId}&period=${period}`,
        {
          headers: {
            'X-Internal-Token': INTERNAL_TOKEN,
          },
        }
      );

      if (!response.ok) {
        return null;
      }

      const result = await response.json();
      return result.data;
    } catch (error: any) {
      logger.warn(`[COD] Analytics error: ${error.message}`);
      return null;
    }
  }

  /**
   * Process Shopify order for COD intelligence
   * Call this on order creation
   */
  async processShopifyOrder(order: any, merchantId: string): Promise<OrderRiskResult | null> {
    // Extract phone from Shopify order
    const customerPhone = order.customer?.phone ||
      order.billing_address?.phone ||
      order.shipping_address?.phone;

    if (!customerPhone) {
      logger.debug(`[COD] No phone for order ${order.id}`);
      return null;
    }

    // Extract pincode
    const pincode = order.shipping_address?.zip ||
      order.billing_address?.zip;

    // Extract customer ID
    const customerId = order.customer?.id?.toString() || order.email;

    // Extract items
    const items = order.line_items?.map((item: any) => ({
      sku: item.sku,
      name: item.title,
      quantity: item.quantity,
      price: item.price,
      category: item.product_type || item.title,
    })) || [];

    // Log order for historical data
    await this.logOrder({
      orderId: order.id.toString(),
      customerId,
      customerPhone,
      customerAddress: {
        pincode,
        city: order.shipping_address?.city,
        state: order.shipping_address?.province,
      },
      amount: parseFloat(order.total_price || 0),
      items,
      merchantId,
      courier: order.shipping_lines?.[0]?.title,
      paymentMethod: order.financial_status === 'paid' ? 'prepaid' : 'cod',
    });

    // Score the order if COD
    if (order.financial_status !== 'paid') {
      return this.scoreOrder({
        orderId: order.id.toString(),
        customerId,
        customerPhone,
        customerEmail: order.email,
        amount: parseFloat(order.total_price || 0),
        items,
        pincode,
        merchantId,
        courier: order.shipping_lines?.[0]?.title,
      });
    }

    return null;
  }
}

export const codIntelligence = new CODIntelligenceService();
