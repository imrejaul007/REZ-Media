import winston from 'winston';
import { configManager } from '../config';
import { cartService } from '../services/cartService';
import { catalogService } from '../services/catalogService';
import { cartDisplay } from '../messages/cartDisplay';
import { quickReplies } from '../messages/quickReplies';

const logger = winston.createLogger({
  level: configManager.get().logging.level,
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [new winston.transports.Console()],
});

export interface AddToCartParams {
  phoneNumber: string;
  userId?: string;
  productId: string;
  variantId?: string;
  quantity?: number;
}

export interface UpdateCartParams {
  phoneNumber: string;
  userId?: string;
  productId: string;
  variantId?: string;
  quantity: number;
}

export class CartHandler {
  private static instance: CartHandler;

  private constructor() {}

  static getInstance(): CartHandler {
    if (!CartHandler.instance) {
      CartHandler.instance = new CartHandler();
    }
    return CartHandler.instance;
  }

  async addItem(params: AddToCartParams): Promise<{
    success: boolean;
    message?: string;
    cart?: Record<string, unknown>;
    error?: string;
  }> {
    try {
      const { phoneNumber, userId, productId, variantId, quantity = 1 } = params;

      // Validate product exists
      const product = variantId
        ? await catalogService.getProductWithVariant(productId, variantId)
        : await catalogService.getProduct(productId);

      if (!product) {
        return { success: false, error: 'Product not found' };
      }

      const productData = 'variant' in product ? product.variant : product;

      // Check stock
      const hasStock = await catalogService.checkStock(productId, variantId, quantity);
      if (!hasStock) {
        return { success: false, error: 'Product is out of stock or insufficient quantity' };
      }

      // Add to cart
      const result = await cartService.addToCart({
        phoneNumber,
        userId,
        productId,
        variantId,
        quantity,
      });

      if (!result.success) {
        return { success: false, error: result.error };
      }

      const cartSummary = await cartService.getCartSummary(phoneNumber, userId);
      const currency = configManager.get().store.currency;
      const mainProduct = 'product' in product ? product.product : product;

      logger.info('Item added to cart via handler', {
        phoneNumber,
        productId,
        quantity,
      });

      return {
        success: true,
        message: `✅ Added ${productData.name} to cart!\n\n` +
          `Quantity: ${quantity}\n` +
          `Price: ${currency} ${productData.price || mainProduct.basePrice * quantity}\n\n` +
          `🛒 Cart Total: ${currency} ${cartSummary?.total || 0} (${cartSummary?.itemCount || 0} items)`,
        cart: cartSummary || undefined,
      };
    } catch (error) {
      logger.error('Error adding item to cart', { error, params });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to add item to cart',
      };
    }
  }

  async removeItem(params: {
    phoneNumber: string;
    userId?: string;
    productId: string;
    variantId?: string;
  }): Promise<{
    success: boolean;
    message?: string;
    cart?: Record<string, unknown>;
    error?: string;
  }> {
    try {
      const { phoneNumber, userId, productId, variantId } = params;

      const result = await cartService.removeFromCart({
        phoneNumber,
        userId,
        productId,
        variantId,
      });

      if (!result.success) {
        return { success: false, error: result.error };
      }

      const cartSummary = await cartService.getCartSummary(phoneNumber, userId);

      logger.info('Item removed from cart via handler', { phoneNumber, productId });

      return {
        success: true,
        message: '✅ Item removed from cart',
        cart: cartSummary || undefined,
      };
    } catch (error) {
      logger.error('Error removing item from cart', { error, params });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to remove item from cart',
      };
    }
  }

  async updateQuantity(params: UpdateCartParams): Promise<{
    success: boolean;
    message?: string;
    cart?: Record<string, unknown>;
    error?: string;
  }> {
    try {
      const { phoneNumber, userId, productId, variantId, quantity } = params;

      if (quantity <= 0) {
        return this.removeItem({ phoneNumber, userId, productId, variantId });
      }

      const result = await cartService.updateCartItem({
        phoneNumber,
        userId,
        productId,
        variantId,
        quantity,
      });

      if (!result.success) {
        return { success: false, error: result.error };
      }

      const cartSummary = await cartService.getCartSummary(phoneNumber, userId);
      const currency = configManager.get().store.currency;

      return {
        success: true,
        message: `✅ Cart updated!\n\nQuantity: ${quantity}\nCart Total: ${currency} ${cartSummary?.total || 0}`,
        cart: cartSummary || undefined,
      };
    } catch (error) {
      logger.error('Error updating cart quantity', { error, params });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update cart',
      };
    }
  }

  async getCart(phoneNumber: string, userId?: string): Promise<{
    success: boolean;
    cart?: Record<string, unknown>;
    display?: string;
    error?: string;
  }> {
    try {
      const cart = await cartService.getCart(phoneNumber, userId);

      if (!cart) {
        return {
          success: true,
          cart: {
            isEmpty: true,
            items: [],
            subtotal: 0,
            discountTotal: 0,
            deliveryFee: 0,
            total: 0,
            itemCount: 0,
          },
          display: '🛒 Your cart is empty!',
        };
      }

      const display = cartDisplay.formatCart(cart);

      return {
        success: true,
        cart: {
          cartId: cart.cartId,
          items: cart.items,
          subtotal: cart.subtotal,
          discountTotal: cart.discountTotal,
          deliveryFee: cart.deliveryFee,
          total: cart.totalAmount,
          itemCount: cart.getItemCount(),
          currency: cart.currency,
          isEmpty: cart.items.length === 0,
        },
        display,
      };
    } catch (error) {
      logger.error('Error getting cart', { error, phoneNumber });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get cart',
      };
    }
  }

  async clearCart(phoneNumber: string, userId?: string): Promise<{
    success: boolean;
    message?: string;
    error?: string;
  }> {
    try {
      const result = await cartService.clearCart(phoneNumber, userId);

      if (!result.success) {
        return { success: false, error: result.error };
      }

      logger.info('Cart cleared via handler', { phoneNumber });

      return {
        success: true,
        message: '🧹 Your cart has been cleared!',
      };
    } catch (error) {
      logger.error('Error clearing cart', { error, phoneNumber });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to clear cart',
      };
    }
  }

  async getCartSummary(phoneNumber: string, userId?: string): Promise<{
    success: boolean;
    summary?: {
      cartId: string;
      itemCount: number;
      subtotal: number;
      discount: number;
      deliveryFee: number;
      total: number;
      currency: string;
      isEmpty: boolean;
      freeDeliveryEligible: boolean;
      amountToFreeDelivery: number;
    };
    error?: string;
  }> {
    try {
      const summary = await cartService.getCartSummary(phoneNumber, userId);

      if (!summary) {
        return {
          success: false,
          error: 'Cart not found',
        };
      }

      const config = configManager.get();
      const freeDeliveryEligible = summary.deliveryFee === 0;
      const amountToFreeDelivery = freeDeliveryEligible
        ? 0
        : Math.max(0, config.delivery.freeThreshold - summary.subtotal);

      return {
        success: true,
        summary: {
          ...summary,
          freeDeliveryEligible,
          amountToFreeDelivery,
        },
      };
    } catch (error) {
      logger.error('Error getting cart summary', { error, phoneNumber });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get cart summary',
      };
    }
  }

  formatCartSummaryForWhatsApp(summary: {
    itemCount: number;
    subtotal: number;
    discount: number;
    deliveryFee: number;
    total: number;
    currency: string;
  }): string {
    const currency = configManager.get().store.currency;
    const freeThreshold = configManager.get().delivery.freeThreshold;

    let message = `🛒 *Your Cart*\n\n`;
    message += `Items: ${summary.itemCount}\n\n`;
    message += `─────────────────\n`;
    message += `Subtotal: ${currency} ${summary.subtotal}\n`;

    if (summary.discount > 0) {
      message += `Discount: -${currency} ${summary.discount}\n`;
    }

    message += `Delivery: `;
    if (summary.deliveryFee === 0) {
      message += `FREE 🎉\n`;
    } else {
      message += `${currency} ${summary.deliveryFee}\n`;
      if (summary.subtotal < freeThreshold) {
        const remaining = freeThreshold - summary.subtotal;
        message += `\nAdd ${currency} ${remaining} more for FREE delivery!\n`;
      }
    }

    message += `─────────────────\n`;
    message += `*Total: ${currency} ${summary.total}*\n`;

    return message;
  }

  getCartActionButtons(): Array<{ id: string; title: string }> {
    return [
      { id: 'checkout', title: 'Checkout 🛍️' },
      { id: 'apply_coupon', title: 'Apply Coupon' },
      { id: 'clear_cart', title: 'Clear Cart' },
      { id: 'continue_shopping', title: 'Continue Shopping' },
    ];
  }

  async validateCartForCheckout(phoneNumber: string, userId?: string): Promise<{
    success: boolean;
    valid?: boolean;
    message?: string;
    errors?: string[];
  }> {
    try {
      const cart = await cartService.getCart(phoneNumber, userId);

      if (!cart) {
        return {
          success: false,
          errors: ['Cart not found'],
        };
      }

      const errors: string[] = [];
      const config = configManager.get();

      if (cart.items.length === 0) {
        errors.push('Your cart is empty');
      }

      if (cart.totalAmount < config.cart.minOrderValue) {
        errors.push(`Minimum order value is ${config.store.currency} ${config.cart.minOrderValue}`);
      }

      if (cart.totalAmount > config.cart.maxOrderValue) {
        errors.push(`Maximum order value is ${config.store.currency} ${config.cart.maxOrderValue}`);
      }

      // Check stock for all items
      for (const item of cart.items) {
        const hasStock = await catalogService.checkStock(item.productId, item.variantId, item.quantity);
        if (!hasStock) {
          errors.push(`${item.name} is out of stock`);
        }
      }

      return {
        success: true,
        valid: errors.length === 0,
        errors: errors.length > 0 ? errors : undefined,
        message: errors.length > 0 ? errors.join('\n') : 'Cart is valid for checkout',
      };
    } catch (error) {
      logger.error('Error validating cart', { error, phoneNumber });
      return {
        success: false,
        errors: [error instanceof Error ? error.message : 'Failed to validate cart'],
      };
    }
  }
}

export const cartHandler = CartHandler.getInstance();
export default cartHandler;
