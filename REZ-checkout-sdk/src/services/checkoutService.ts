import { Cart, ICart } from '../models/Cart';
import { Order, IOrder, IOrderItem, IShippingAddress, IPaymentDetails } from '../models/Order';
import { Address } from '../models/Address';
import * as cartService from './cartService';
import * as addressService from './addressService';
import * as paymentRouter from './paymentRouter';

// Checkout input interface
export interface CheckoutInput {
  userId?: string;
  sessionId: string;
  merchantId: string;
  shippingAddressId?: string;
  shippingAddress?: IShippingAddress;
  billingAddress?: IShippingAddress;
  paymentMethod?: string;
  couponCode?: string;
  metadata?: Record<string, unknown>;
}

// Checkout response interface
export interface CheckoutResponse {
  success: boolean;
  order?: IOrder;
  redirectUrl?: string;
  paymentDetails?: IPaymentDetails;
  error?: string;
  code?: string;
}

// Shipping calculation result
export interface ShippingCalculation {
  method: string;
  cost: number;
  estimatedDays: number;
  estimatedDelivery?: Date;
}

/**
 * Calculate shipping cost based on address and cart
 */
export const calculateShipping = async (
  address: IShippingAddress,
  cart: ICart
): Promise<ShippingCalculation> => {
  // Free shipping threshold
  const FREE_SHIPPING_THRESHOLD = 499;
  const BASE_SHIPPING_COST = 49;
  const EXPRESS_SHIPPING_COST = 99;

  // Calculate subtotal
  const subtotal = cart.items.reduce((sum, item) => sum + item.price * item.quantity, 0);

  // Free shipping for orders above threshold
  if (subtotal >= FREE_SHIPPING_THRESHOLD) {
    const deliveryDate = new Date();
    deliveryDate.setDate(deliveryDate.getDate() + 5);
    return {
      method: 'standard',
      cost: 0,
      estimatedDays: 5,
      estimatedDelivery: deliveryDate,
    };
  }

  // Standard shipping
  const deliveryDate = new Date();
  deliveryDate.setDate(deliveryDate.getDate() + 5);
  return {
    method: 'standard',
    cost: BASE_SHIPPING_COST,
    estimatedDays: 5,
    estimatedDelivery: deliveryDate,
  };
};

/**
 * Calculate tax based on state
 */
export const calculateTax = (
  subtotal: number,
  state: string
): number => {
  // Simplified GST calculation
  // In production, this would use a proper tax calculation service
  const GST_RATE = 0.18; // 18% GST

  // Some states may have different rates
  const EXEMPT_STATES = ['Nagaland', 'Meghalaya', 'Mizoram']; // Special category states

  if (EXEMPT_STATES.includes(state)) {
    return 0;
  }

  return Math.round(subtotal * GST_RATE * 100) / 100;
};

/**
 * Validate checkout prerequisites
 */
export const validateCheckout = async (
  input: CheckoutInput
): Promise<{ valid: boolean; errors: string[] }> => {
  const errors: string[] = [];

  // Get cart
  const { cart } = await cartService.getCart(input.userId, input.sessionId);

  if (!cart || cart.items.length === 0) {
    errors.push('Cart is empty');
  }

  // Validate address
  if (input.shippingAddressId) {
    const addressDoc = await Address.findByUser(input.userId!);
    if (!addressDoc) {
      errors.push('No saved addresses found');
    } else {
      const address = addressDoc.addresses.find(
        (a) => a._id?.toString() === input.shippingAddressId
      );
      if (!address) {
        errors.push('Selected address not found');
      }
    }
  } else if (!input.shippingAddress) {
    errors.push('Shipping address is required');
  }

  return { valid: errors.length === 0, errors };
};

/**
 * Get recommended payment method
 */
export const getRecommendedPaymentMethod = async (
  userId?: string,
  cart?: ICart
): Promise<string> => {
  if (!userId) {
    // Guest users - suggest COD or simpler methods
    return 'UPI';
  }

  // Check user's payment history
  // In production, this would analyze user's previous payment methods
  const preferredMethod = await paymentRouter.getPreferredPaymentMethod(userId);
  if (preferredMethod) {
    return preferredMethod;
  }

  // Default to UPI
  return 'UPI';
};

/**
 * Process checkout
 */
export const processCheckout = async (
  input: CheckoutInput
): Promise<CheckoutResponse> => {
  try {
    // Validate checkout
    const validation = await validateCheckout(input);
    if (!validation.valid) {
      return {
        success: false,
        error: validation.errors.join(', '),
        code: 'CHECKOUT_VALIDATION_FAILED',
      };
    }

    // Get cart
    const { cart } = await cartService.getCart(input.userId, input.sessionId);
    if (!cart) {
      return {
        success: false,
        error: 'Cart not found',
        code: 'CART_NOT_FOUND',
      };
    }

    // Get or validate shipping address
    let shippingAddress: IShippingAddress;

    if (input.shippingAddress) {
      shippingAddress = input.shippingAddress;
    } else if (input.shippingAddressId) {
      const addressDoc = await Address.findByUser(input.userId!);
      const address = addressDoc?.addresses.find(
        (a) => a._id?.toString() === input.shippingAddressId
      );
      if (!address) {
        return {
          success: false,
          error: 'Address not found',
          code: 'ADDRESS_NOT_FOUND',
        };
      }
      shippingAddress = {
        recipientName: address.recipientName,
        phone: address.phone,
        addressLine1: address.addressLine1,
        addressLine2: address.addressLine2,
        city: address.city,
        state: address.state,
        postalCode: address.postalCode,
        country: address.country,
        landmark: address.landmark,
        deliveryInstructions: address.deliveryInstructions,
      };
    } else {
      return {
        success: false,
        error: 'Shipping address is required',
        code: 'ADDRESS_REQUIRED',
      };
    }

    // Calculate shipping
    const shippingCalc = await calculateShipping(shippingAddress, cart);

    // Calculate tax
    const subtotal = cart.items.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0
    );
    const tax = calculateTax(subtotal, shippingAddress.state);
    const discount = cart.discount || 0;
    const total = subtotal + tax + shippingCalc.cost - discount;

    // Determine payment method
    let paymentMethod = input.paymentMethod;
    if (!paymentMethod) {
      paymentMethod = await getRecommendedPaymentMethod(input.userId, cart);
    }

    // Get smart payment routing
    const paymentRouting = await paymentRouter.routePayment({
      amount: total,
      userId: input.userId,
      preferredMethod: paymentMethod,
      cartTotal: subtotal,
    });

    // Create order items
    const orderItems: IOrderItem[] = cart.items.map((item) => ({
      productId: item.productId,
      merchantId: item.merchantId,
      name: item.name,
      price: item.price,
      quantity: item.quantity,
      sku: item.sku,
      imageUrl: item.imageUrl,
      subtotal: item.price * item.quantity,
      metadata: item.metadata,
    }));

    // Initialize payment details
    const paymentDetails: IPaymentDetails = {
      method: paymentRouting.recommendedMethod,
      provider: paymentRouting.provider,
      status: 'pending',
      amount: total,
      currency: cart.currency || 'INR',
    };

    // Generate order ID
    const orderId = Order.generateOrderId();

    // Create order
    const order = new Order({
      orderId,
      userId: input.userId,
      sessionId: input.sessionId,
      merchantId: input.merchantId,
      items: orderItems,
      subtotal,
      tax,
      discount,
      shippingCost: shippingCalc.cost,
      total,
      currency: cart.currency || 'INR',
      status: 'pending',
      shippingAddress,
      billingAddress: input.billingAddress || shippingAddress,
      payment: paymentDetails,
      tracking: [
        {
          status: 'pending',
          timestamp: new Date(),
          description: 'Order placed',
        },
      ],
      couponCode: input.couponCode,
      isGuest: !input.userId,
      estimatedDelivery: shippingCalc.estimatedDelivery,
      metadata: input.metadata,
    });

    await order.save();

    // Initiate payment based on routing decision
    if (paymentRouting.shouldRedirect) {
      return {
        success: true,
        order,
        redirectUrl: paymentRouting.redirectUrl,
        paymentDetails,
      };
    }

    // For methods like COD that don't need redirect
    if (paymentRouting.recommendedMethod === 'COD') {
      order.payment.status = 'captured';
      order.status = 'confirmed';
      order.tracking.push({
        status: 'confirmed',
        timestamp: new Date(),
        description: 'Payment confirmed via Cash on Delivery',
      });
      await order.save();

      // Clear cart after successful order
      await cartService.clearCart(input.userId, input.sessionId);
    }

    return {
      success: true,
      order,
      paymentDetails,
    };
  } catch (error) {
    console.error('Checkout error:', error);
    return {
      success: false,
      error: 'Failed to process checkout',
      code: 'CHECKOUT_FAILED',
    };
  }
};

/**
 * One-tap reorder from previous order
 */
export const reorder = async (
  userId: string,
  orderId: string,
  sessionId: string
): Promise<CheckoutResponse> => {
  try {
    // Find the original order
    const originalOrder = await Order.findByOrderId(orderId);

    if (!originalOrder) {
      return {
        success: false,
        error: 'Original order not found',
        code: 'ORDER_NOT_FOUND',
      };
    }

    // Verify user owns this order
    if (originalOrder.userId !== userId) {
      return {
        success: false,
        error: 'Order not found',
        code: 'ORDER_NOT_FOUND',
      };
    }

    // Create cart from order items
    const cart = await cartService.getOrCreateCart(userId, sessionId);

    // Clear existing items and add order items
    cart.items = originalOrder.items.map((item) => ({
      productId: item.productId,
      merchantId: item.merchantId,
      name: item.name,
      price: item.price, // Current price, not historical
      quantity: item.quantity,
      sku: item.sku,
      imageUrl: item.imageUrl,
      metadata: { ...item.metadata, reorderedFrom: orderId },
    }));
    cart.merchantId = originalOrder.merchantId;
    cart.discount = 0; // Clear previous discounts
    await cart.save();

    return {
      success: true,
      // Return minimal order info - actual order created on checkout
      paymentDetails: {
        method: originalOrder.payment.method,
        status: 'pending',
        amount: cart.total,
        currency: cart.currency,
      },
    };
  } catch (error) {
    console.error('Reorder error:', error);
    return {
      success: false,
      error: 'Failed to reorder',
      code: 'REORDER_FAILED',
    };
  }
};

/**
 * Get checkout summary
 */
export const getCheckoutSummary = async (
  userId?: string,
  sessionId?: string
): Promise<{
  success: boolean;
  summary?: {
    itemCount: number;
    subtotal: number;
    tax: number;
    shipping: number;
    discount: number;
    total: number;
    recommendedPayment: string;
  };
  error?: string;
}> => {
  try {
    const { cart } = await cartService.getCart(userId, sessionId);

    if (!cart) {
      return {
        success: false,
        error: 'Cart not found',
      };
    }

    const itemCount = cart.items.reduce((sum, item) => sum + item.quantity, 0);
    const recommendedPayment = await getRecommendedPaymentMethod(userId, cart);

    return {
      success: true,
      summary: {
        itemCount,
        subtotal: cart.subtotal,
        tax: cart.tax,
        shipping: 0, // Calculated at checkout with address
        discount: cart.discount,
        total: cart.total,
        recommendedPayment,
      },
    };
  } catch (error) {
    console.error('Get checkout summary error:', error);
    return {
      success: false,
      error: 'Failed to get checkout summary',
    };
  }
};
