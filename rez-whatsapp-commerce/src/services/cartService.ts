import Redis from 'ioredis';
import { Cart, ICart, ICartItem } from '../models/Cart';
import { catalogService } from './catalogService';
import { v4 as uuidv4 } from 'uuid';

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

const CACHE_TTL_CART = 1800; // 30 minutes

export interface AddToCartRequest {
  productId: string;
  variantId?: string;
  quantity?: number;
}

export interface UpdateCartItemRequest {
  productId: string;
  variantId?: string;
  quantity: number;
}

export interface ApplyDiscountRequest {
  code: string;
}

export class CartService {
  /**
   * Get cart for customer
   */
  async getCart(customerId: string, merchantId: string): Promise<ICart | null> {
    const cacheKey = `cart:${merchantId}:${customerId}`;

    const cached = await redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    const cart = await Cart.findOne({
      customerId,
      merchantId,
      isActive: true,
    });

    if (cart) {
      await redis.setex(cacheKey, CACHE_TTL_CART, JSON.stringify(cart));
    }

    return cart;
  }

  /**
   * Get or create cart for customer
   */
  async getOrCreateCart(
    customerId: string,
    customerPhone: string,
    merchantId: string
  ): Promise<ICart> {
    let cart = await this.getCart(customerId, merchantId);

    if (!cart) {
      cart = await Cart.findOrCreate(customerId, customerPhone, merchantId);

      const cacheKey = `cart:${merchantId}:${customerId}`;
      await redis.setex(cacheKey, CACHE_TTL_CART, JSON.stringify(cart));
    }

    return cart;
  }

  /**
   * Add item to cart
   */
  async addItem(
    customerId: string,
    customerPhone: string,
    merchantId: string,
    item: AddToCartRequest
  ): Promise<ICart> {
    const quantity = item.quantity || 1;

    // Get product details
    const product = await catalogService.getProductById(item.productId, merchantId);
    if (!product) {
      throw new Error('Product not found');
    }

    // Check stock
    const stockCheck = await catalogService.checkStock(
      item.productId,
      item.variantId,
      quantity,
      merchantId
    );

    if (!stockCheck.available) {
      throw new Error(
        `Insufficient stock. Available: ${stockCheck.currentStock}, Requested: ${stockCheck.requested}`
      );
    }

    // Get or create cart
    const cart = await this.getOrCreateCart(customerId, customerPhone, merchantId);

    // Find variant if specified
    let variantName: string | undefined;
    let unitPrice: number;

    if (item.variantId) {
      const variant = product.variants.find((v) => v.sku === item.variantId);
      if (!variant) {
        throw new Error('Product variant not found');
      }
      variantName = variant.name;
      unitPrice = variant.price;
    } else {
      unitPrice = product.basePrice;
    }

    // Check if item already exists in cart
    const existingItemIndex = cart.items.findIndex(
      (i) =>
        i.productId === item.productId &&
        i.variantId === (item.variantId || i.variantId)
    );

    const newQuantity = existingItemIndex >= 0
      ? cart.items[existingItemIndex].quantity + quantity
      : quantity;

    // Check if new quantity is available
    const newStockCheck = await catalogService.checkStock(
      item.productId,
      item.variantId,
      newQuantity,
      merchantId
    );

    if (!newStockCheck.available) {
      throw new Error(
        `Cannot add more items. Available stock: ${newStockCheck.currentStock}`
      );
    }

    // Prepare cart item
    const cartItem: Partial<ICartItem> = {
      productId: product.productId,
      variantId: item.variantId,
      name: product.name,
      sku: product.sku,
      image: product.images[0]?.url,
      quantity,
      unitPrice,
      totalPrice: quantity * unitPrice,
      variantName,
    };

    // Add to cart using Mongoose method
    cart.addItem(cartItem);
    await cart.save();

    // Invalidate cache
    await this.invalidateCartCache(merchantId, customerId);

    return cart;
  }

  /**
   * Update item quantity in cart
   */
  async updateItem(
    customerId: string,
    merchantId: string,
    item: UpdateCartItemRequest
  ): Promise<ICart> {
    const cart = await this.getCart(customerId, merchantId);

    if (!cart) {
      throw new Error('Cart not found');
    }

    if (item.quantity <= 0) {
      return this.removeItem(customerId, merchantId, {
        productId: item.productId,
        variantId: item.variantId,
      });
    }

    // Check stock
    const stockCheck = await catalogService.checkStock(
      item.productId,
      item.variantId,
      item.quantity,
      merchantId
    );

    if (!stockCheck.available) {
      throw new Error(
        `Insufficient stock. Available: ${stockCheck.currentStock}, Requested: ${stockCheck.requested}`
      );
    }

    // Update using Mongoose method
    const success = cart.updateItemQuantity(
      item.productId,
      item.variantId,
      item.quantity
    );

    if (!success) {
      throw new Error('Item not found in cart');
    }

    await cart.save();

    // Invalidate cache
    await this.invalidateCartCache(merchantId, customerId);

    return cart;
  }

  /**
   * Remove item from cart
   */
  async removeItem(
    customerId: string,
    merchantId: string,
    item: { productId: string; variantId?: string }
  ): Promise<ICart> {
    const cart = await this.getCart(customerId, merchantId);

    if (!cart) {
      throw new Error('Cart not found');
    }

    const success = cart.removeItem(item.productId, item.variantId);

    if (!success) {
      throw new Error('Item not found in cart');
    }

    await cart.save();

    // Invalidate cache
    await this.invalidateCartCache(merchantId, customerId);

    return cart;
  }

  /**
   * Clear cart
   */
  async clearCart(customerId: string, merchantId: string): Promise<boolean> {
    const cart = await this.getCart(customerId, merchantId);

    if (!cart) {
      return false;
    }

    cart.clear();
    await cart.save();

    // Invalidate cache
    await this.invalidateCartCache(merchantId, customerId);

    return true;
  }

  /**
   * Apply discount to cart
   */
  async applyDiscount(
    customerId: string,
    merchantId: string,
    discount: ApplyDiscountRequest
  ): Promise<ICart> {
    const cart = await this.getCart(customerId, merchantId);

    if (!cart) {
      throw new Error('Cart not found');
    }

    // Validate discount code with external service
    const discountServiceUrl = process.env.DISCOUNT_SERVICE_URL;

    if (discountServiceUrl) {
      try {
        const response = await fetch(`${discountServiceUrl}/validate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            code: discount.code,
            merchantId,
            customerId,
            cartTotal: cart.subtotal,
          }),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.message || 'Invalid discount code');
        }

        const discountData = await response.json();

        cart.applyDiscount(discount.code, discountData.discountAmount);
        cart.metadata = {
          ...cart.metadata,
          discountId: discountData.discountId,
          discountType: discountData.type,
        };
      } catch (error) {
        // If discount service is not available, just set a fixed discount
        // In production, you would handle this more carefully
        if (error instanceof Error && error.message.includes('Invalid discount')) {
          throw error;
        }
        console.warn('Discount service unavailable, using basic validation');
        cart.applyDiscount(discount.code, 0);
      }
    } else {
      // Basic validation for development
      // In production, always use external discount service
      cart.applyDiscount(discount.code, 0);
    }

    await cart.save();

    // Invalidate cache
    await this.invalidateCartCache(merchantId, customerId);

    return cart;
  }

  /**
   * Remove discount from cart
   */
  async removeDiscount(
    customerId: string,
    merchantId: string
  ): Promise<ICart> {
    const cart = await this.getCart(customerId, merchantId);

    if (!cart) {
      throw new Error('Cart not found');
    }

    cart.discountCode = undefined;
    cart.discount = 0;

    await cart.save();

    // Invalidate cache
    await this.invalidateCartCache(merchantId, customerId);

    return cart;
  }

  /**
   * Calculate delivery fee
   */
  async calculateDeliveryFee(
    customerId: string,
    merchantId: string,
    shippingAddress: {
      city: string;
      state: string;
      postalCode: string;
    }
  ): Promise<number> {
    const cart = await this.getCart(customerId, merchantId);

    if (!cart) {
      throw new Error('Cart not found');
    }

    if (cart.items.length === 0) {
      return 0;
    }

    // Calculate based on order total and location
    // This is a simplified implementation
    const FREE_DELIVERY_THRESHOLD = 500; // Free delivery for orders above 500
    const BASE_DELIVERY_FEE = 50;

    if (cart.subtotal >= FREE_DELIVERY_THRESHOLD) {
      return 0;
    }

    // Additional fees for remote areas (simplified)
    const remoteAreas = ['JK', 'LA', 'NL', 'ML', 'AR']; // Example state codes
    const additionalFee = remoteAreas.includes(shippingAddress.state)
      ? 30
      : 0;

    return BASE_DELIVERY_FEE + additionalFee;
  }

  /**
   * Update delivery fee
   */
  async updateDeliveryFee(
    customerId: string,
    merchantId: string,
    deliveryFee: number
  ): Promise<ICart> {
    const cart = await this.getCart(customerId, merchantId);

    if (!cart) {
      throw new Error('Cart not found');
    }

    cart.deliveryFee = deliveryFee;
    await cart.save();

    // Invalidate cache
    await this.invalidateCartCache(merchantId, customerId);

    return cart;
  }

  /**
   * Get cart summary
   */
  async getCartSummary(customerId: string, merchantId: string): Promise<{
    itemCount: number;
    uniqueItemCount: number;
    subtotal: number;
    tax: number;
    discount: number;
    deliveryFee: number;
    total: number;
  }> {
    const cart = await this.getCart(customerId, merchantId);

    if (!cart) {
      return {
        itemCount: 0,
        uniqueItemCount: 0,
        subtotal: 0,
        tax: 0,
        discount: 0,
        deliveryFee: 0,
        total: 0,
      };
    }

    const itemCount = cart.items.reduce((sum, item) => sum + item.quantity, 0);

    return {
      itemCount,
      uniqueItemCount: cart.items.length,
      subtotal: cart.subtotal,
      tax: cart.tax,
      discount: cart.discount,
      deliveryFee: cart.deliveryFee,
      total: cart.total,
    };
  }

  /**
   * Mark cart as checked out
   */
  async markCheckedOut(customerId: string, merchantId: string): Promise<void> {
    const cart = await this.getCart(customerId, merchantId);

    if (cart) {
      cart.isActive = false;
      cart.checkedOutAt = new Date();
      await cart.save();

      // Invalidate cache
      await this.invalidateCartCache(merchantId, customerId);
    }
  }

  /**
   * Validate cart for checkout
   */
  async validateForCheckout(
    customerId: string,
    merchantId: string
  ): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];
    const cart = await this.getCart(customerId, merchantId);

    if (!cart) {
      errors.push('Cart not found');
      return { valid: false, errors };
    }

    if (cart.items.length === 0) {
      errors.push('Cart is empty');
    }

    // Check stock for all items
    for (const item of cart.items) {
      const stockCheck = await catalogService.checkStock(
        item.productId,
        item.variantId,
        item.quantity,
        merchantId
      );

      if (!stockCheck.available) {
        errors.push(
          `${item.name}: Insufficient stock (available: ${stockCheck.currentStock})`
        );
      }
    }

    if (cart.total <= 0) {
      errors.push('Cart total must be greater than 0');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Invalidate cart cache
   */
  private async invalidateCartCache(
    merchantId: string,
    customerId: string
  ): Promise<void> {
    const cacheKey = `cart:${merchantId}:${customerId}`;
    await redis.del(cacheKey);
  }

  /**
   * Get abandoned carts
   */
  async getAbandonedCarts(
    merchantId: string,
    hoursSinceLastActivity: number = 24
  ): Promise<ICart[]> {
    const cutoffTime = new Date(
      Date.now() - hoursSinceLastActivity * 60 * 60 * 1000
    );

    return Cart.find({
      merchantId,
      isActive: true,
      'items.0': { $exists: true },
      updatedAt: { $lt: cutoffTime },
    })
      .sort({ updatedAt: -1 })
      .limit(100);
  }
}

export const cartService = new CartService();
