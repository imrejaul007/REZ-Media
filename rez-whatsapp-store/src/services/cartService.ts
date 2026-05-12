import winston from 'winston';
import { Cart, ICart, ICartItem } from '../models/Cart';
import { catalogService } from './catalogService';
import { configManager } from '../config';

const logger = winston.createLogger({
  level: configManager.get().logging.level,
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [new winston.transports.Console()],
});

export interface AddToCartInput {
  phoneNumber: string;
  userId?: string;
  productId: string;
  variantId?: string;
  quantity?: number;
}

export interface UpdateCartItemInput {
  phoneNumber: string;
  userId?: string;
  productId: string;
  variantId?: string;
  quantity: number;
}

export interface RemoveFromCartInput {
  phoneNumber: string;
  userId?: string;
  productId: string;
  variantId?: string;
}

export interface CartResponse {
  success: boolean;
  cart?: ICart;
  message?: string;
  error?: string;
}

export class CartService {
  private static instance: CartService;

  private constructor() {}

  static getInstance(): CartService {
    if (!CartService.instance) {
      CartService.instance = new CartService();
    }
    return CartService.instance;
  }

  private getOrCreateSessionId(phoneNumber: string, userId?: string): string {
    return userId || phoneNumber;
  }

  async getOrCreateCart(phoneNumber: string, userId?: string): Promise<ICart> {
    const sessionId = this.getOrCreateSessionId(phoneNumber, userId);
    const cartExpiryHours = configManager.get().cart.expiryHours;

    let cart = await Cart.findOne({
      $or: [{ phoneNumber }, { userId }],
      status: 'active',
    });

    if (!cart) {
      cart = await Cart.create({
        phoneNumber,
        userId,
        items: [],
        currency: configManager.get().store.currency,
        expiresAt: new Date(Date.now() + cartExpiryHours * 60 * 60 * 1000),
      });
      logger.info('New cart created', { cartId: cart.cartId, phoneNumber });
    }

    // Check if cart is expired
    if (cart.isExpired?.() || new Date() > cart.expiresAt) {
      cart.status = 'expired';
      await cart.save();

      cart = await Cart.create({
        phoneNumber,
        userId,
        items: [],
        currency: configManager.get().store.currency,
        expiresAt: new Date(Date.now() + cartExpiryHours * 60 * 60 * 1000),
      });
      logger.info('Expired cart replaced with new one', { cartId: cart.cartId, phoneNumber });
    }

    return cart;
  }

  async getCart(phoneNumber: string, userId?: string): Promise<ICart | null> {
    return Cart.findOne({
      $or: [{ phoneNumber }, { userId }],
      status: 'active',
    });
  }

  async addToCart(input: AddToCartInput): Promise<CartResponse> {
    try {
      const { phoneNumber, userId, productId, variantId, quantity = 1 } = input;

      // Get product details
      const product = variantId
        ? await catalogService.getProductWithVariant(productId, variantId)
        : await catalogService.getProduct(productId);

      if (!product) {
        return { success: false, error: 'Product not found' };
      }

      const productData = variantId && 'variant' in product ? product.variant : product;
      const mainProduct = variantId && 'product' in product ? product.product : product;

      // Check stock
      const hasStock = await catalogService.checkStock(productId, variantId, quantity);
      if (!hasStock) {
        return { success: false, error: 'Insufficient stock' };
      }

      // Get or create cart
      const cart = await this.getOrCreateCart(phoneNumber, userId);

      // Prepare cart item
      const cartItem: Omit<ICartItem, 'totalPrice'> = {
        productId: mainProduct.productId,
        variantId: variantId,
        name: productData.name || mainProduct.name,
        sku: productData.sku || mainProduct.sku,
        quantity,
        unitPrice: productData.price || mainProduct.basePrice,
        imageUrl: mainProduct.thumbnail || mainProduct.images?.[0],
      };

      // Check if item already exists in cart
      const existingItemIndex = cart.items.findIndex(
        (item) => item.productId === productId && item.variantId === variantId
      );

      if (existingItemIndex >= 0) {
        const newQuantity = cart.items[existingItemIndex].quantity + quantity;
        const hasEnoughStock = await catalogService.checkStock(productId, variantId, newQuantity);
        if (!hasEnoughStock) {
          return { success: false, error: 'Not enough stock available' };
        }
        cart.items[existingItemIndex].quantity = newQuantity;
        cart.items[existingItemIndex].totalPrice = cart.items[existingItemIndex].unitPrice * newQuantity;
      } else {
        cart.items.push({
          ...cartItem,
          totalPrice: cartItem.unitPrice * cartItem.quantity,
        });
      }

      // Update delivery fee based on subtotal
      this.updateDeliveryFee(cart);

      await cart.save();

      logger.info('Item added to cart', {
        cartId: cart.cartId,
        productId,
        variantId,
        quantity,
      });

      return {
        success: true,
        cart,
        message: `Added ${productData.name} to your cart`,
      };
    } catch (error) {
      logger.error('Error adding to cart', { error, input });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to add item to cart',
      };
    }
  }

  async updateCartItem(input: UpdateCartItemInput): Promise<CartResponse> {
    try {
      const { phoneNumber, userId, productId, variantId, quantity } = input;

      const cart = await this.getCart(phoneNumber, userId);
      if (!cart) {
        return { success: false, error: 'Cart not found' };
      }

      if (quantity <= 0) {
        return this.removeFromCart({ phoneNumber, userId, productId, variantId });
      }

      // Check stock
      const hasStock = await catalogService.checkStock(productId, variantId, quantity);
      if (!hasStock) {
        return { success: false, error: 'Insufficient stock' };
      }

      const itemIndex = cart.items.findIndex(
        (item) => item.productId === productId && item.variantId === variantId
      );

      if (itemIndex === -1) {
        return { success: false, error: 'Item not found in cart' };
      }

      cart.items[itemIndex].quantity = quantity;
      cart.items[itemIndex].totalPrice = cart.items[itemIndex].unitPrice * quantity;

      this.updateDeliveryFee(cart);
      await cart.save();

      logger.info('Cart item updated', {
        cartId: cart.cartId,
        productId,
        quantity,
      });

      return {
        success: true,
        cart,
        message: `Updated quantity to ${quantity}`,
      };
    } catch (error) {
      logger.error('Error updating cart item', { error, input });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update cart item',
      };
    }
  }

  async removeFromCart(input: RemoveFromCartInput): Promise<CartResponse> {
    try {
      const { phoneNumber, userId, productId, variantId } = input;

      const cart = await this.getCart(phoneNumber, userId);
      if (!cart) {
        return { success: false, error: 'Cart not found' };
      }

      const itemIndex = cart.items.findIndex(
        (item) => item.productId === productId && item.variantId === variantId
      );

      if (itemIndex === -1) {
        return { success: false, error: 'Item not found in cart' };
      }

      const removedItem = cart.items[itemIndex];
      cart.items.splice(itemIndex, 1);

      this.updateDeliveryFee(cart);
      await cart.save();

      logger.info('Item removed from cart', {
        cartId: cart.cartId,
        productId,
        variantId,
      });

      return {
        success: true,
        cart,
        message: `Removed ${removedItem.name} from your cart`,
      };
    } catch (error) {
      logger.error('Error removing from cart', { error, input });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to remove item from cart',
      };
    }
  }

  async clearCart(phoneNumber: string, userId?: string): Promise<CartResponse> {
    try {
      const cart = await this.getCart(phoneNumber, userId);
      if (!cart) {
        return { success: false, error: 'Cart not found' };
      }

      cart.items = [];
      cart.subtotal = 0;
      cart.discountTotal = 0;
      cart.deliveryFee = 0;
      cart.totalAmount = 0;

      await cart.save();

      logger.info('Cart cleared', { cartId: cart.cartId });

      return {
        success: true,
        cart,
        message: 'Cart cleared',
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
    cartId: string;
    itemCount: number;
    subtotal: number;
    deliveryFee: number;
    discount: number;
    total: number;
    currency: string;
    isEmpty: boolean;
  } | null> {
    const cart = await this.getCart(phoneNumber, userId);
    if (!cart) return null;

    return {
      cartId: cart.cartId,
      itemCount: cart.getItemCount(),
      subtotal: cart.subtotal,
      deliveryFee: cart.deliveryFee,
      discount: cart.discountTotal,
      total: cart.totalAmount,
      currency: cart.currency,
      isEmpty: cart.items.length === 0,
    };
  }

  private updateDeliveryFee(cart: ICart): void {
    const config = configManager.get();
    const subtotal = cart.items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);

    if (subtotal === 0) {
      cart.deliveryFee = 0;
    } else if (subtotal >= config.delivery.freeThreshold) {
      cart.deliveryFee = 0;
    } else {
      cart.deliveryFee = config.delivery.defaultFee;
    }

    cart.totalAmount = subtotal - cart.discountTotal + cart.deliveryFee;
  }

  async convertCartToCheckout(phoneNumber: string, userId?: string): Promise<{
    success: boolean;
    checkoutData?: {
      cartId: string;
      items: ICartItem[];
      subtotal: number;
      discountTotal: number;
      deliveryFee: number;
      totalAmount: number;
      currency: string;
    };
    error?: string;
  }> {
    const cart = await this.getCart(phoneNumber, userId);
    if (!cart) {
      return { success: false, error: 'Cart not found' };
    }

    if (cart.items.length === 0) {
      return { success: false, error: 'Cart is empty' };
    }

    const minOrderValue = configManager.get().cart.minOrderValue;
    if (cart.totalAmount < minOrderValue) {
      return {
        success: false,
        error: `Minimum order value is ${configManager.get().store.currency} ${minOrderValue}. Please add more items.`,
      };
    }

    return {
      success: true,
      checkoutData: {
        cartId: cart.cartId,
        items: cart.items,
        subtotal: cart.subtotal,
        discountTotal: cart.discountTotal,
        deliveryFee: cart.deliveryFee,
        totalAmount: cart.totalAmount,
        currency: cart.currency,
      },
    };
  }

  async markCartAsConverted(cartId: string): Promise<boolean> {
    try {
      const cart = await Cart.findOne({ cartId });
      if (!cart) return false;

      cart.status = 'converted';
      await cart.save();

      logger.info('Cart marked as converted', { cartId });
      return true;
    } catch (error) {
      logger.error('Error marking cart as converted', { error, cartId });
      return false;
    }
  }
}

export const cartService = CartService.getInstance();
export default cartService;
