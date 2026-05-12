import winston from 'winston';
import { configManager } from '../config';
import { checkoutService } from '../services/checkoutService';
import { cartService } from '../services/cartService';
import { paymentService } from '../services/paymentService';
import { orderService } from '../services/orderService';
import { cartDisplay } from '../messages/cartDisplay';

const logger = winston.createLogger({
  level: configManager.get().logging.level,
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [new winston.transports.Console()],
});

export interface InitiateCheckoutParams {
  phoneNumber: string;
  userId?: string;
  source?: 'whatsapp' | 'web' | 'app';
}

export interface AddressParams {
  fullName: string;
  phoneNumber: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  postalCode: string;
  country?: string;
  instructions?: string;
}

export interface DeliveryParams {
  type: 'home_delivery' | 'store_pickup' | 'instant';
  address?: AddressParams;
  notes?: string;
}

export interface PaymentParams {
  method: 'upi' | 'card' | 'wallet' | 'cod';
  upiId?: string;
  cardDetails?: {
    number: string;
    expiry: string;
    cvv: string;
  };
}

export class CheckoutHandler {
  private static instance: CheckoutHandler;

  private constructor() {}

  static getInstance(): CheckoutHandler {
    if (!CheckoutHandler.instance) {
      CheckoutHandler.instance = new CheckoutHandler();
    }
    return CheckoutHandler.instance;
  }

  async initiateCheckout(params: InitiateCheckoutParams): Promise<{
    success: boolean;
    checkoutId?: string;
    summary?: {
      itemCount: number;
      subtotal: number;
      discount: number;
      deliveryFee: number;
      total: number;
      currency: string;
    };
    message?: string;
    error?: string;
  }> {
    try {
      const { phoneNumber, userId, source = 'whatsapp' } = params;

      // Validate cart before checkout
      const cartResult = await cartService.convertCartToCheckout(phoneNumber, userId);
      if (!cartResult.success || !cartResult.checkoutData) {
        return {
          success: false,
          error: cartResult.error || 'Unable to start checkout',
        };
      }

      // Initiate checkout
      const result = await checkoutService.initiateCheckout({
        phoneNumber,
        userId,
        source,
      });

      if (!result.success || !result.checkout) {
        return {
          success: false,
          error: result.error,
        };
      }

      logger.info('Checkout initiated via handler', {
        checkoutId: result.checkout.checkoutId,
        phoneNumber,
      });

      return {
        success: true,
        checkoutId: result.checkout.checkoutId,
        summary: {
          itemCount: result.checkout.items.length,
          subtotal: result.checkout.subtotal,
          discount: result.checkout.discountTotal,
          deliveryFee: result.checkout.deliveryFee,
          total: result.checkout.totalAmount,
          currency: result.checkout.currency,
        },
        message: `Checkout initiated! Order Total: ${result.checkout.currency} ${result.checkout.totalAmount}`,
      };
    } catch (error) {
      logger.error('Error initiating checkout', { error, params });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to initiate checkout',
      };
    }
  }

  async setAddress(checkoutId: string, address: AddressParams): Promise<{
    success: boolean;
    message?: string;
    error?: string;
  }> {
    try {
      const result = await checkoutService.setDeliveryAddress(checkoutId, {
        ...address,
        country: address.country || 'India',
      });

      if (!result.success) {
        return { success: false, error: result.error };
      }

      logger.info('Address set in checkout', { checkoutId });

      return {
        success: true,
        message: '✅ Address saved!\n\nNow choose delivery option:',
      };
    } catch (error) {
      logger.error('Error setting address', { error, checkoutId });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to set address',
      };
    }
  }

  async selectDelivery(checkoutId: string, params: DeliveryParams): Promise<{
    success: boolean;
    checkoutId?: string;
    total?: number;
    currency?: string;
    paymentLink?: string;
    upiLink?: string;
    message?: string;
    error?: string;
  }> {
    try {
      const result = await checkoutService.selectDeliveryOption(checkoutId, {
        type: params.type,
        address: params.address,
        notes: params.notes,
      });

      if (!result.success || !result.checkout) {
        return { success: false, error: result.error };
      }

      logger.info('Delivery selected', { checkoutId, type: params.type });

      const currency = result.checkout.currency;
      const total = result.checkout.totalAmount;

      // Generate payment link
      const paymentLink = await paymentService.generatePaymentLink(checkoutId, total, result.checkout.phoneNumber);

      return {
        success: true,
        checkoutId,
        total,
        currency,
        paymentLink: paymentLink.paymentLink,
        upiLink: paymentLink.upiLink,
        message: `Delivery: ${this.formatDeliveryType(params.type)}\n\n` +
          `Total: ${currency} ${total}\n\n` +
          `💳 Payment Options:\n` +
          `• UPI (click link below)\n` +
          `• Card Payment\n` +
          `• Cash on Delivery\n\n` +
          `${paymentLink.shortUrl ? `Pay now: ${paymentLink.shortUrl}` : ''}`,
      };
    } catch (error) {
      logger.error('Error selecting delivery', { error, checkoutId });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to select delivery',
      };
    }
  }

  async processPayment(checkoutId: string, paymentParams: PaymentParams): Promise<{
    success: boolean;
    orderId?: string;
    paymentId?: string;
    status?: string;
    message?: string;
    error?: string;
  }> {
    try {
      const checkout = await checkoutService.getCheckout(checkoutId);
      if (!checkout) {
        return { success: false, error: 'Checkout not found or expired' };
      }

      // Create payment
      const paymentResult = await paymentService.createPayment({
        orderId: checkoutId,
        amount: checkout.totalAmount,
        currency: checkout.currency,
        customerPhone: checkout.phoneNumber,
      });

      if (!paymentResult.success || !paymentResult.payment) {
        return { success: false, error: paymentResult.error };
      }

      // Handle payment based on method
      if (paymentParams.method === 'cod') {
        // For COD, directly create order
        const orderResult = await this.completeCheckoutFlow(checkoutId, paymentResult.payment.razorpayOrderId);
        return orderResult;
      }

      // For UPI/Card, return payment details
      return {
        success: true,
        paymentId: paymentResult.payment.razorpayOrderId,
        status: 'pending',
        message: `Payment initiated: ${checkout.currency} ${checkout.totalAmount}\n\n` +
          `Complete payment and share the payment details to confirm your order.`,
      };
    } catch (error) {
      logger.error('Error processing payment', { error, checkoutId });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to process payment',
      };
    }
  }

  async verifyAndCompleteOrder(
    checkoutId: string,
    paymentDetails: {
      razorpayOrderId: string;
      razorpayPaymentId: string;
      razorpaySignature: string;
    }
  ): Promise<{
    success: boolean;
    orderId?: string;
    message?: string;
    error?: string;
  }> {
    try {
      // Verify payment
      const verifyResult = await paymentService.verifyPayment({
        razorpayOrderId: paymentDetails.razorpayOrderId,
        razorpayPaymentId: paymentDetails.razorpayPaymentId,
        razorpaySignature: paymentDetails.razorpaySignature,
      });

      if (!verifyResult.success || verifyResult.status !== 'paid') {
        return {
          success: false,
          error: verifyResult.error || 'Payment verification failed',
        };
      }

      // Complete checkout
      const completeResult = await this.completeCheckoutFlow(
        checkoutId,
        paymentDetails.razorpayPaymentId,
        paymentDetails.razorpayOrderId
      );

      return completeResult;
    } catch (error) {
      logger.error('Error verifying and completing order', { error, checkoutId });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to complete order',
      };
    }
  }

  private async completeCheckoutFlow(
    checkoutId: string,
    paymentId: string,
    razorpayOrderId?: string
  ): Promise<{
    success: boolean;
    orderId?: string;
    message?: string;
    error?: string;
  }> {
    try {
      // Complete checkout
      const checkoutResult = await checkoutService.completeCheckout(checkoutId, {
        paymentId,
        razorpayOrderId,
        razorpayPaymentId: paymentId,
      });

      if (!checkoutResult.success) {
        return { success: false, error: checkoutResult.error };
      }

      // Create order
      const orderResult = await orderService.createOrder({
        checkoutId,
        phoneNumber: checkoutResult.checkout!.phoneNumber,
        paymentId,
        razorpayOrderId,
        razorpayPaymentId: paymentId,
        source: 'whatsapp',
      });

      if (!orderResult.success || !orderResult.order) {
        return { success: false, error: orderResult.error || 'Failed to create order' };
      }

      logger.info('Order created via checkout handler', {
        orderId: orderResult.order.orderId,
        checkoutId,
      });

      return {
        success: true,
        orderId: orderResult.order.orderId,
        message: `🎉 *Order Confirmed!*\n\n` +
          `Order ID: ${orderResult.order.orderId}\n` +
          `Total: ${orderResult.order.currency} ${orderResult.order.totalAmount}\n` +
          `Items: ${orderResult.order.items.reduce((sum, i) => sum + i.quantity, 0)}\n\n` +
          `We'll send you updates on your order status!\n\n` +
          `Thank you for shopping with us! 🛍️`,
      };
    } catch (error) {
      logger.error('Error in complete checkout flow', { error, checkoutId });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to complete checkout',
      };
    }
  }

  async cancelCheckout(checkoutId: string): Promise<{
    success: boolean;
    message?: string;
    error?: string;
  }> {
    try {
      const result = await checkoutService.cancelCheckout(checkoutId);

      if (!result.success) {
        return { success: false, error: result.error };
      }

      logger.info('Checkout cancelled via handler', { checkoutId });

      return {
        success: true,
        message: 'Checkout cancelled. Your cart items are still saved.',
      };
    } catch (error) {
      logger.error('Error cancelling checkout', { error, checkoutId });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to cancel checkout',
      };
    }
  }

  async getCheckout(checkoutId: string): Promise<{
    success: boolean;
    checkout?: Record<string, unknown>;
    error?: string;
  }> {
    try {
      const checkout = await checkoutService.getCheckout(checkoutId);

      if (!checkout) {
        return { success: false, error: 'Checkout not found or expired' };
      }

      return {
        success: true,
        checkout: checkout.getSummary(),
      };
    } catch (error) {
      logger.error('Error getting checkout', { error, checkoutId });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get checkout',
      };
    }
  }

  async applyCoupon(checkoutId: string, couponCode: string): Promise<{
    success: boolean;
    newTotal?: number;
    discount?: number;
    message?: string;
    error?: string;
  }> {
    try {
      const result = await checkoutService.applyCoupon(checkoutId, couponCode);

      if (!result.success) {
        return { success: false, error: result.error };
      }

      logger.info('Coupon applied', { checkoutId, code: couponCode });

      return {
        success: true,
        newTotal: result.checkout!.totalAmount,
        discount: result.checkout!.couponDiscount,
        message: result.message,
      };
    } catch (error) {
      logger.error('Error applying coupon', { error, checkoutId, couponCode });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to apply coupon',
      };
    }
  }

  async removeCoupon(checkoutId: string): Promise<{
    success: boolean;
    newTotal?: number;
    message?: string;
    error?: string;
  }> {
    try {
      const result = await checkoutService.removeCoupon(checkoutId);

      if (!result.success) {
        return { success: false, error: result.error };
      }

      return {
        success: true,
        newTotal: result.checkout!.totalAmount,
        message: 'Coupon removed',
      };
    } catch (error) {
      logger.error('Error removing coupon', { error, checkoutId });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to remove coupon',
      };
    }
  }

  formatCheckoutSummaryForWhatsApp(checkout: {
    items: Array<{ name: string; quantity: number; totalPrice: number }>;
    subtotal: number;
    discountTotal: number;
    deliveryFee: number;
    couponDiscount: number;
    totalAmount: number;
    currency: string;
    deliveryType?: string;
    deliveryAddress?: {
      fullName: string;
      addressLine1: string;
      city: string;
    };
    step: string;
  }): string {
    let message = `📋 *Order Summary*\n\n`;

    // Items
    checkout.items.forEach((item, idx) => {
      message += `${idx + 1}. ${item.name}\n`;
      message += `   Qty: ${item.quantity} × ${checkout.currency} ${item.totalPrice / item.quantity}\n`;
    });

    message += `\n─────────────────\n`;
    message += `Subtotal: ${checkout.currency} ${checkout.subtotal}\n`;

    if (checkout.discountTotal > 0) {
      message += `Item Discount: -${checkout.currency} ${checkout.discountTotal}\n`;
    }

    if (checkout.couponDiscount > 0) {
      message += `Coupon Discount: -${checkout.currency} ${checkout.couponDiscount}\n`;
    }

    message += `Delivery: `;
    if (checkout.deliveryFee === 0) {
      message += `FREE\n`;
    } else {
      message += `${checkout.currency} ${checkout.deliveryFee}\n`;
    }

    message += `─────────────────\n`;
    message += `*Total: ${checkout.currency} ${checkout.totalAmount}*\n`;

    // Delivery info
    if (checkout.deliveryAddress) {
      message += `\n📍 Delivery to:\n`;
      message += `${checkout.deliveryAddress.fullName}\n`;
      message += `${checkout.deliveryAddress.addressLine1}, ${checkout.deliveryAddress.city}`;
    }

    if (checkout.deliveryType) {
      message += `\n🚚 ${this.formatDeliveryType(checkout.deliveryType)}`;
    }

    return message;
  }

  private formatDeliveryType(type: string): string {
    const types: Record<string, string> = {
      home_delivery: 'Home Delivery',
      store_pickup: 'Store Pickup',
      instant: 'Instant Delivery',
    };
    return types[type] || type;
  }

  getDeliveryOptions(): Array<{
    id: string;
    title: string;
    description: string;
    icon: string;
  }> {
    return [
      {
        id: 'home_delivery',
        title: 'Home Delivery',
        description: 'Get it delivered to your doorstep',
        icon: '🏠',
      },
      {
        id: 'store_pickup',
        title: 'Store Pickup',
        description: 'Pick up from our store (FREE)',
        icon: '🏪',
      },
      {
        id: 'instant',
        title: 'Instant Delivery',
        description: 'Get it within 2 hours',
        icon: '⚡',
      },
    ];
  }

  getPaymentOptions(): Array<{
    id: string;
    title: string;
    description: string;
    icon: string;
  }> {
    return [
      {
        id: 'upi',
        title: 'UPI',
        description: 'Pay via Google Pay, PhonePe, Paytm',
        icon: '📱',
      },
      {
        id: 'card',
        title: 'Card',
        description: 'Credit/Debit Card',
        icon: '💳',
      },
      {
        id: 'wallet',
        title: 'Wallet',
        description: 'Pay using REZ Wallet balance',
        icon: '👛',
      },
      {
        id: 'cod',
        title: 'Cash on Delivery',
        description: 'Pay when you receive',
        icon: '💵',
      },
    ];
  }
}

export const checkoutHandler = CheckoutHandler.getInstance();
export default checkoutHandler;
