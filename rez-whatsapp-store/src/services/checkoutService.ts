import winston from 'winston';
import { Checkout, ICheckout, CheckoutStep, IDeliveryAddress } from '../models/Checkout';
import { Cart } from '../models/Cart';
import { cartService } from './cartService';
import { configManager } from '../config';

const logger = winston.createLogger({
  level: configManager.get().logging.level,
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [new winston.transports.Console()],
});

export interface InitiateCheckoutInput {
  phoneNumber: string;
  userId?: string;
  source?: 'whatsapp' | 'web' | 'app';
}

export interface CheckoutResponse<T = ICheckout> {
  success: boolean;
  checkout?: T;
  message?: string;
  error?: string;
}

export interface AddressInput {
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

export interface DeliveryInput {
  type: 'home_delivery' | 'store_pickup' | 'instant';
  address?: AddressInput;
  notes?: string;
}

export class CheckoutService {
  private static instance: CheckoutService;

  private constructor() {}

  static getInstance(): CheckoutService {
    if (!CheckoutService.instance) {
      CheckoutService.instance = new CheckoutService();
    }
    return CheckoutService.instance;
  }

  async initiateCheckout(input: InitiateCheckoutInput): Promise<CheckoutResponse> {
    try {
      const { phoneNumber, userId, source = 'whatsapp' } = input;

      // Check if there's an active checkout
      let checkout = await Checkout.findActiveByPhone(phoneNumber);
      if (checkout) {
        // Return existing checkout if still active
        if (!checkout.isExpired()) {
          return {
            success: true,
            checkout,
            message: 'Returning to existing checkout',
          };
        } else {
          checkout.status = 'expired';
          await checkout.save();
        }
      }

      // Get cart and convert to checkout data
      const cartResult = await cartService.convertCartToCheckout(phoneNumber, userId);
      if (!cartResult.success || !cartResult.checkoutData) {
        return {
          success: false,
          error: cartResult.error || 'Unable to start checkout',
        };
      }

      // Create new checkout
      checkout = await Checkout.create({
        cartId: cartResult.checkoutData.cartId,
        userId,
        phoneNumber,
        items: cartResult.checkoutData.items.map((item) => ({
          productId: item.productId,
          variantId: item.variantId,
          name: item.name,
          sku: item.sku,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          discount: item.discount || 0,
          totalPrice: item.totalPrice,
          imageUrl: item.imageUrl,
        })),
        subtotal: cartResult.checkoutData.subtotal,
        discountTotal: cartResult.checkoutData.discountTotal,
        deliveryFee: cartResult.checkoutData.deliveryFee,
        totalAmount: cartResult.checkoutData.totalAmount,
        currency: cartResult.checkoutData.currency,
        step: 'cart_review',
        status: 'initiated',
        source,
        expiresAt: new Date(Date.now() + 30 * 60 * 1000), // 30 minutes
      });

      logger.info('Checkout initiated', { checkoutId: checkout.checkoutId, phoneNumber });

      return {
        success: true,
        checkout,
        message: 'Checkout initiated',
      };
    } catch (error) {
      logger.error('Error initiating checkout', { error, input });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to initiate checkout',
      };
    }
  }

  async getCheckout(checkoutId: string): Promise<ICheckout | null> {
    const checkout = await Checkout.findOne({ checkoutId });
    if (checkout && checkout.isExpired()) {
      checkout.status = 'expired';
      await checkout.save();
      return null;
    }
    return checkout;
  }

  async getCheckoutByPhone(phoneNumber: string): Promise<ICheckout | null> {
    const checkout = await Checkout.findActiveByPhone(phoneNumber);
    if (checkout && checkout.isExpired()) {
      checkout.status = 'expired';
      await checkout.save();
      return null;
    }
    return checkout;
  }

  async getCheckoutByCart(cartId: string): Promise<ICheckout | null> {
    const checkout = await Checkout.findActiveByCart(cartId);
    if (checkout && checkout.isExpired()) {
      checkout.status = 'expired';
      await checkout.save();
      return null;
    }
    return checkout;
  }

  async proceedToAddress(checkoutId: string): Promise<CheckoutResponse> {
    try {
      const checkout = await this.getCheckout(checkoutId);
      if (!checkout) {
        return { success: false, error: 'Checkout not found or expired' };
      }

      if (checkout.step !== 'cart_review') {
        return { success: false, error: 'Cannot proceed to address from current step' };
      }

      checkout.step = 'address';
      checkout.status = 'address_pending';
      await checkout.save();

      logger.info('Checkout proceeded to address', { checkoutId });

      return {
        success: true,
        checkout,
        message: 'Please share your delivery address',
      };
    } catch (error) {
      logger.error('Error proceeding to address', { error, checkoutId });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to proceed',
      };
    }
  }

  async setDeliveryAddress(checkoutId: string, address: AddressInput): Promise<CheckoutResponse> {
    try {
      const checkout = await this.getCheckout(checkoutId);
      if (!checkout) {
        return { success: false, error: 'Checkout not found or expired' };
      }

      if (checkout.step !== 'address' && checkout.step !== 'delivery') {
        return { success: false, error: 'Must be at address step' };
      }

      const deliveryAddress: IDeliveryAddress = {
        fullName: address.fullName,
        phoneNumber: address.phoneNumber,
        addressLine1: address.addressLine1,
        addressLine2: address.addressLine2,
        city: address.city,
        state: address.state,
        postalCode: address.postalCode,
        country: address.country || 'India',
        instructions: address.instructions,
      };

      checkout.deliveryAddress = deliveryAddress;
      checkout.step = 'delivery';
      checkout.status = 'delivery_pending';
      await checkout.save();

      logger.info('Delivery address set', { checkoutId });

      return {
        success: true,
        checkout,
        message: 'Address saved. Now choose delivery option.',
      };
    } catch (error) {
      logger.error('Error setting delivery address', { error, checkoutId });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to set address',
      };
    }
  }

  async selectDeliveryOption(checkoutId: string, deliveryInput: DeliveryInput): Promise<CheckoutResponse> {
    try {
      const checkout = await this.getCheckout(checkoutId);
      if (!checkout) {
        return { success: false, error: 'Checkout not found or expired' };
      }

      if (checkout.step !== 'delivery') {
        return { success: false, error: 'Must be at delivery selection step' };
      }

      // Set delivery type
      checkout.deliveryType = deliveryInput.type;

      // Set address if home delivery
      if (deliveryInput.type === 'home_delivery') {
        if (!checkout.deliveryAddress && deliveryInput.address) {
          const addr: IDeliveryAddress = {
            fullName: deliveryInput.address.fullName,
            phoneNumber: deliveryInput.address.phoneNumber,
            addressLine1: deliveryInput.address.addressLine1,
            addressLine2: deliveryInput.address.addressLine2,
            city: deliveryInput.address.city,
            state: deliveryInput.address.state,
            postalCode: deliveryInput.address.postalCode,
            country: deliveryInput.address.country || 'India',
            instructions: deliveryInput.address.instructions,
          };
          checkout.deliveryAddress = addr;
        }

        if (!checkout.deliveryAddress) {
          return { success: false, error: 'Delivery address is required for home delivery' };
        }
      }

      // Store notes
      if (deliveryInput.notes) {
        checkout.notes = deliveryInput.notes;
      }

      // Update delivery fee for store pickup
      if (deliveryInput.type === 'store_pickup') {
        checkout.deliveryFee = 0;
        checkout.recalculateTotal();
      }

      checkout.step = 'payment';
      checkout.status = 'payment_pending';
      await checkout.save();

      logger.info('Delivery option selected', { checkoutId, type: deliveryInput.type });

      return {
        success: true,
        checkout,
        message: 'Delivery option selected. Proceeding to payment.',
      };
    } catch (error) {
      logger.error('Error selecting delivery option', { error, checkoutId });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to select delivery option',
      };
    }
  }

  async applyCoupon(checkoutId: string, couponCode: string): Promise<CheckoutResponse> {
    try {
      const checkout = await this.getCheckout(checkoutId);
      if (!checkout) {
        return { success: false, error: 'Checkout not found or expired' };
      }

      // Coupon validation logic would go here
      // For now, just simulate a valid coupon
      const validCoupons: Record<string, number> = {
        'FIRST10': 10,
        'SAVE20': 20,
        'REZSTORE': 5,
      };

      const discountPercent = validCoupons[couponCode.toUpperCase()];
      if (!discountPercent) {
        return { success: false, error: 'Invalid coupon code' };
      }

      const discountAmount = Math.round((checkout.subtotal * discountPercent) / 100);
      checkout.applyCoupon(couponCode.toUpperCase(), discountAmount);
      await checkout.save();

      logger.info('Coupon applied', { checkoutId, code: couponCode, discount: discountAmount });

      return {
        success: true,
        checkout,
        message: `Coupon applied! You saved ${checkout.currency} ${discountAmount}`,
      };
    } catch (error) {
      logger.error('Error applying coupon', { error, checkoutId });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to apply coupon',
      };
    }
  }

  async removeCoupon(checkoutId: string): Promise<CheckoutResponse> {
    try {
      const checkout = await this.getCheckout(checkoutId);
      if (!checkout) {
        return { success: false, error: 'Checkout not found or expired' };
      }

      checkout.removeCoupon();
      await checkout.save();

      logger.info('Coupon removed', { checkoutId });

      return {
        success: true,
        checkout,
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

  async proceedToPayment(checkoutId: string, paymentMethod?: string): Promise<CheckoutResponse> {
    try {
      const checkout = await this.getCheckout(checkoutId);
      if (!checkout) {
        return { success: false, error: 'Checkout not found or expired' };
      }

      if (checkout.step !== 'payment') {
        return { success: false, error: 'Must be at payment step' };
      }

      // Validate delivery requirements
      if (checkout.deliveryType === 'home_delivery' && !checkout.deliveryAddress) {
        return { success: false, error: 'Delivery address is required' };
      }

      if (paymentMethod) {
        checkout.paymentMethod = paymentMethod;
      }

      await checkout.save();

      logger.info('Ready for payment', { checkoutId, paymentMethod });

      return {
        success: true,
        checkout,
        message: 'Ready for payment',
      };
    } catch (error) {
      logger.error('Error proceeding to payment', { error, checkoutId });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to proceed to payment',
      };
    }
  }

  async completeCheckout(checkoutId: string, paymentDetails?: {
    paymentId: string;
    razorpayOrderId?: string;
    razorpayPaymentId?: string;
  }): Promise<CheckoutResponse> {
    try {
      const checkout = await this.getCheckout(checkoutId);
      if (!checkout) {
        return { success: false, error: 'Checkout not found or expired' };
      }

      // Final validation
      if (!checkout.deliveryType) {
        return { success: false, error: 'Delivery option must be selected' };
      }

      if (checkout.deliveryType === 'home_delivery' && !checkout.deliveryAddress) {
        return { success: false, error: 'Delivery address is required' };
      }

      // Mark as completed
      checkout.step = 'confirmation';
      checkout.status = 'completed';
      checkout.completedAt = new Date();

      if (paymentDetails) {
        checkout.metadata = {
          ...checkout.metadata,
          paymentId: paymentDetails.paymentId,
          razorpayOrderId: paymentDetails.razorpayOrderId,
          razorpayPaymentId: paymentDetails.razorpayPaymentId,
        };
      }

      await checkout.save();

      // Mark cart as converted
      await cartService.markCartAsConverted(checkout.cartId);

      logger.info('Checkout completed', { checkoutId });

      return {
        success: true,
        checkout,
        message: 'Order placed successfully!',
      };
    } catch (error) {
      logger.error('Error completing checkout', { error, checkoutId });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to complete checkout',
      };
    }
  }

  async cancelCheckout(checkoutId: string): Promise<CheckoutResponse> {
    try {
      const checkout = await this.getCheckout(checkoutId);
      if (!checkout) {
        return { success: false, error: 'Checkout not found or expired' };
      }

      if (checkout.status === 'completed') {
        return { success: false, error: 'Cannot cancel completed checkout' };
      }

      checkout.status = 'cancelled';
      await checkout.save();

      logger.info('Checkout cancelled', { checkoutId });

      return {
        success: true,
        checkout,
        message: 'Checkout cancelled',
      };
    } catch (error) {
      logger.error('Error cancelling checkout', { error, checkoutId });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to cancel checkout',
      };
    }
  }

  async getCheckoutSummary(checkoutId: string): Promise<Record<string, unknown> | null> {
    const checkout = await this.getCheckout(checkoutId);
    return checkout?.getSummary() || null;
  }

  async goBackToStep(checkoutId: string, step: CheckoutStep): Promise<CheckoutResponse> {
    try {
      const checkout = await this.getCheckout(checkoutId);
      if (!checkout) {
        return { success: false, error: 'Checkout not found or expired' };
      }

      const success = checkout.goToStep(step);
      if (!success) {
        return { success: false, error: 'Cannot go back to this step' };
      }

      await checkout.save();

      logger.info('Checkout went back to step', { checkoutId, step });

      return {
        success: true,
        checkout,
        message: `Returned to ${step}`,
      };
    } catch (error) {
      logger.error('Error going back in checkout', { error, checkoutId });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to go back',
      };
    }
  }
}

export const checkoutService = CheckoutService.getInstance();
export default checkoutService;
