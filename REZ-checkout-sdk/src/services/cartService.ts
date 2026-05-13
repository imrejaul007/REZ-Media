import { Cart, ICart, ICartItem } from '../models/Cart';
import { Order } from '../models/Order';

// Cart item input interface
export interface AddItemInput {
  productId: string;
  merchantId: string;
  name: string;
  price: number;
  quantity: number;
  sku?: string;
  imageUrl?: string;
  metadata?: Record<string, unknown>;
}

// Update item input interface
export interface UpdateItemInput {
  quantity?: number;
  price?: number;
  metadata?: Record<string, unknown>;
}

// Cart response interface
export interface CartResponse {
  success: boolean;
  cart?: ICart;
  error?: string;
  code?: string;
}

/**
 * Get or create cart for user/session
 */
export const getOrCreateCart = async (
  userId?: string,
  sessionId?: string
): Promise<ICart> => {
  // Priority: userId > sessionId
  if (userId) {
    // Check if user has an existing cart
    let cart = await Cart.findByUser(userId);
    if (cart) {
      return cart;
    }
    // Create new cart for user
    cart = new Cart({
      userId,
      sessionId: sessionId || `session-${Date.now()}`,
      items: [],
      isGuest: false,
      expiresAt: undefined, // User carts don't expire
    });
    await cart.save();
    return cart;
  }

  // Session-based cart
  if (sessionId) {
    return Cart.findOrCreateBySession(sessionId, userId);
  }

  throw new Error('Either userId or sessionId is required');
};

/**
 * Add item to cart
 */
export const addItem = async (
  userId: string | undefined,
  sessionId: string,
  item: AddItemInput
): Promise<CartResponse> => {
  try {
    const cart = await getOrCreateCart(userId, sessionId);

    // Check if item already exists
    const existingIndex = cart.items.findIndex(
      (i) => i.productId === item.productId && i.merchantId === item.merchantId
    );

    if (existingIndex !== -1) {
      // Update existing item quantity
      cart.items[existingIndex].quantity += item.quantity;
      // Update other fields
      cart.items[existingIndex].price = item.price;
      cart.items[existingIndex].name = item.name;
      if (item.imageUrl) cart.items[existingIndex].imageUrl = item.imageUrl;
      if (item.metadata) cart.items[existingIndex].metadata = item.metadata;
    } else {
      // Add new item
      cart.items.push({
        productId: item.productId,
        merchantId: item.merchantId,
        name: item.name,
        price: item.price,
        quantity: item.quantity,
        sku: item.sku,
        imageUrl: item.imageUrl,
        metadata: item.metadata,
      });
    }

    // Update merchant if not set
    if (!cart.merchantId && item.merchantId) {
      cart.merchantId = item.merchantId;
    }

    await cart.save();
    return { success: true, cart };
  } catch (error) {
    console.error('Error adding item to cart:', error);
    return {
      success: false,
      error: 'Failed to add item to cart',
      code: 'CART_ADD_FAILED',
    };
  }
};

/**
 * Update item in cart
 */
export const updateItem = async (
  userId: string | undefined,
  sessionId: string,
  productId: string,
  updates: UpdateItemInput
): Promise<CartResponse> => {
  try {
    const cart = await getOrCreateCart(userId, sessionId);

    const itemIndex = cart.items.findIndex((i) => i.productId === productId);
    if (itemIndex === -1) {
      return {
        success: false,
        error: 'Item not found in cart',
        code: 'ITEM_NOT_FOUND',
      };
    }

    if (updates.quantity !== undefined) {
      if (updates.quantity <= 0) {
        // Remove item if quantity is 0 or less
        cart.items.splice(itemIndex, 1);
      } else {
        cart.items[itemIndex].quantity = updates.quantity;
      }
    }

    if (updates.price !== undefined) {
      cart.items[itemIndex].price = updates.price;
    }

    if (updates.metadata) {
      cart.items[itemIndex].metadata = {
        ...cart.items[itemIndex].metadata,
        ...updates.metadata,
      };
    }

    await cart.save();
    return { success: true, cart };
  } catch (error) {
    console.error('Error updating cart item:', error);
    return {
      success: false,
      error: 'Failed to update cart item',
      code: 'CART_UPDATE_FAILED',
    };
  }
};

/**
 * Remove item from cart
 */
export const removeItem = async (
  userId: string | undefined,
  sessionId: string,
  productId: string
): Promise<CartResponse> => {
  return updateItem(userId, sessionId, productId, { quantity: 0 });
};

/**
 * Clear cart
 */
export const clearCart = async (
  userId: string | undefined,
  sessionId: string
): Promise<CartResponse> => {
  try {
    const cart = await getOrCreateCart(userId, sessionId);
    cart.items = [];
    cart.subtotal = 0;
    cart.tax = 0;
    cart.discount = 0;
    cart.total = 0;
    await cart.save();
    return { success: true, cart };
  } catch (error) {
    console.error('Error clearing cart:', error);
    return {
      success: false,
      error: 'Failed to clear cart',
      code: 'CART_CLEAR_FAILED',
    };
  }
};

/**
 * Get cart by user/session
 */
export const getCart = async (
  userId?: string,
  sessionId?: string
): Promise<CartResponse> => {
  try {
    if (userId) {
      const cart = await Cart.findByUser(userId);
      if (!cart) {
        return {
          success: true,
          cart: await getOrCreateCart(userId, sessionId),
        };
      }
      return { success: true, cart };
    }

    if (sessionId) {
      const cart = await Cart.findOne({ sessionId });
      if (!cart) {
        return {
          success: true,
          cart: await getOrCreateCart(undefined, sessionId),
        };
      }
      return { success: true, cart };
    }

    return {
      success: false,
      error: 'Either userId or sessionId is required',
      code: 'MISSING_IDENTIFIER',
    };
  } catch (error) {
    console.error('Error getting cart:', error);
    return {
      success: false,
      error: 'Failed to get cart',
      code: 'CART_GET_FAILED',
    };
  }
};

/**
 * Quick buy - Create cart with single item and return for immediate checkout
 */
export const quickBuy = async (
  userId: string | undefined,
  sessionId: string,
  item: AddItemInput
): Promise<CartResponse> => {
  try {
    // Clear existing cart first
    const cart = await getOrCreateCart(userId, sessionId);
    cart.items = [
      {
        productId: item.productId,
        merchantId: item.merchantId,
        name: item.name,
        price: item.price,
        quantity: item.quantity || 1,
        sku: item.sku,
        imageUrl: item.imageUrl,
        metadata: item.metadata,
      },
    ];
    cart.merchantId = item.merchantId;
    await cart.save();
    return { success: true, cart };
  } catch (error) {
    console.error('Error creating quick buy cart:', error);
    return {
      success: false,
      error: 'Failed to create quick buy order',
      code: 'QUICK_BUY_FAILED',
    };
  }
};

/**
 * Apply discount to cart
 */
export const applyDiscount = async (
  userId: string | undefined,
  sessionId: string,
  discountAmount: number,
  couponCode?: string
): Promise<CartResponse> => {
  try {
    const cart = await getOrCreateCart(userId, sessionId);
    cart.discount = Math.min(discountAmount, cart.subtotal); // Don't allow discount > subtotal
    if (couponCode) {
      cart.metadata = { ...cart.metadata, couponCode };
    }
    await cart.save();
    return { success: true, cart };
  } catch (error) {
    console.error('Error applying discount:', error);
    return {
      success: false,
      error: 'Failed to apply discount',
      code: 'DISCOUNT_FAILED',
    };
  }
};

/**
 * Merge guest cart to user cart (on login)
 */
export const mergeGuestCart = async (
  guestSessionId: string,
  userId: string
): Promise<CartResponse> => {
  try {
    const guestCart = await Cart.findOne({ sessionId: guestSessionId });
    const userCart = await Cart.findByUser(userId);

    if (!guestCart || guestCart.items.length === 0) {
      return {
        success: true,
        cart: userCart || (await getOrCreateCart(userId)),
      };
    }

    if (!userCart) {
      // Simply upgrade guest cart to user cart
      guestCart.userId = userId;
      guestCart.isGuest = false;
      guestCart.expiresAt = undefined;
      await guestCart.save();
      return { success: true, cart: guestCart };
    }

    // Merge items
    const existingProductIds = new Set(userCart.items.map((i) => i.productId));
    for (const item of guestCart.items) {
      if (existingProductIds.has(item.productId)) {
        // Update quantity for existing items
        const existingItem = userCart.items.find((i) => i.productId === item.productId);
        if (existingItem) {
          existingItem.quantity += item.quantity;
        }
      } else {
        userCart.items.push(item);
      }
    }

    await userCart.save();
    await guestCart.deleteOne();

    return { success: true, cart: userCart };
  } catch (error) {
    console.error('Error merging carts:', error);
    return {
      success: false,
      error: 'Failed to merge carts',
      code: 'CART_MERGE_FAILED',
    };
  }
};

/**
 * Get cart item count
 */
export const getCartItemCount = async (
  userId?: string,
  sessionId?: string
): Promise<number> => {
  try {
    const { cart } = await getCart(userId, sessionId);
    if (!cart) return 0;
    return cart.items.reduce((sum, item) => sum + item.quantity, 0);
  } catch {
    return 0;
  }
};

/**
 * Calculate cart totals
 */
export const calculateCartTotals = async (
  userId?: string,
  sessionId?: string
): Promise<{ subtotal: number; tax: number; discount: number; total: number }> => {
  try {
    const { cart } = await getCart(userId, sessionId);
    if (!cart) {
      return { subtotal: 0, tax: 0, discount: 0, total: 0 };
    }
    return {
      subtotal: cart.subtotal,
      tax: cart.tax,
      discount: cart.discount,
      total: cart.total,
    };
  } catch {
    return { subtotal: 0, tax: 0, discount: 0, total: 0 };
  }
};
