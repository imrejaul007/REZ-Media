import { ICart } from '../models/Cart';
import { configManager } from '../config';

export interface CartItemDisplay {
  name: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  imageUrl?: string;
}

export class CartDisplayFormatter {
  private static instance: CartDisplayFormatter;

  private constructor() {}

  static getInstance(): CartDisplayFormatter {
    if (!CartDisplayFormatter.instance) {
      CartDisplayFormatter.instance = new CartDisplayFormatter();
    }
    return CartDisplayFormatter.instance;
  }

  formatCart(cart: ICart): string {
    const config = configManager.get();
    const currency = config.store.currency;
    const freeThreshold = config.delivery.freeThreshold;

    let message = '';

    if (cart.items.length === 0) {
      return '🛒 Your cart is empty!\n\nStart shopping by typing "Shop" or "Browse".';
    }

    message += `*Your Cart*\n\n`;
    message += `─────────────────\n\n`;

    // Items
    cart.items.forEach((item, idx) => {
      const itemPrice = new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency,
        maximumFractionDigits: 0,
      }).format(item.totalPrice);

      const unitPrice = new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency,
        maximumFractionDigits: 0,
      }).format(item.unitPrice);

      message += `${idx + 1}. ${item.name}\n`;
      message += `   Qty: ${item.quantity} × ${unitPrice}\n`;
      message += `   Total: ${itemPrice}\n\n`;
    });

    message += `─────────────────\n`;

    // Subtotal
    const subtotal = new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(cart.subtotal);

    message += `Subtotal: ${subtotal}\n`;

    // Discount
    if (cart.discountTotal > 0) {
      const discount = new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency,
        maximumFractionDigits: 0,
      }).format(cart.discountTotal);

      message += `Discount: -${discount}\n`;
    }

    // Delivery
    message += `Delivery: `;
    if (cart.deliveryFee === 0) {
      const savings = new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency,
        maximumFractionDigits: 0,
      }).format(config.delivery.defaultFee);

      message += `FREE 🎉\n`;
      message += `(You saved ${savings}!)\n`;
    } else {
      const delivery = new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency,
        maximumFractionDigits: 0,
      }).format(cart.deliveryFee);

      message += `${delivery}\n`;

      // Show free delivery progress
      if (cart.subtotal < freeThreshold) {
        const remaining = freeThreshold - cart.subtotal;
        const remainingFormatted = new Intl.NumberFormat('en-IN', {
          style: 'currency',
          currency,
          maximumFractionDigits: 0,
        }).format(remaining);

        message += `\n💡 Add ${remainingFormatted} more for FREE delivery!\n`;
      }
    }

    message += `─────────────────\n`;

    // Total
    const total = new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(cart.totalAmount);

    message += `*TOTAL: ${total}*\n`;
    message += `─────────────────\n\n`;

    // Item count
    const itemCount = cart.items.reduce((sum, item) => sum + item.quantity, 0);
    message += `📦 ${itemCount} item(s) in cart\n\n`;

    // Actions hint
    message += `Reply with:\n`;
    message += `• "Checkout" - Place order\n`;
    message += `• "Update [qty] [item]" - Change quantity\n`;
    message += `• "Remove [item]" - Remove item`;

    return message;
  }

  formatMiniCart(cart: ICart): string {
    const config = configManager.get();
    const currency = config.store.currency;
    const itemCount = cart.items.reduce((sum, item) => sum + item.quantity, 0);
    const total = new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(cart.totalAmount);

    return `🛒 Cart: ${itemCount} items | ${total}`;
  }

  formatCartUpdatedMessage(itemName: string, newQuantity: number, cart: ICart): string {
    const config = configManager.get();
    const currency = config.store.currency;

    const total = new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(cart.totalAmount);

    if (newQuantity === 0) {
      return `✅ Removed ${itemName} from cart.\n\n${this.formatMiniCart(cart)}`;
    }

    return `✅ Updated ${itemName} quantity to ${newQuantity}.\n\n` +
      `${this.formatMiniCart(cart)}`;
  }

  formatAddedToCartMessage(itemName: string, quantity: number, unitPrice: number, cart: ICart): string {
    const config = configManager.get();
    const currency = config.store.currency;

    const itemTotal = new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(unitPrice * quantity);

    const cartTotal = new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(cart.totalAmount);

    const itemCount = cart.items.reduce((sum, item) => sum + item.quantity, 0);

    return `✅ Added to cart!\n\n` +
      `${itemName} × ${quantity}\n` +
      `Item total: ${itemTotal}\n\n` +
      `🛒 Cart: ${itemCount} items | ${cartTotal}`;
  }

  formatCartCleared(): string {
    return `🧹 Cart cleared!\n\nStart fresh by browsing our products.`;
  }

  formatEmptyCart(): string {
    return `🛒 Your cart is empty!\n\nBrowse our products and add items to get started.`;
  }

  formatCartExpired(): string {
    return `⏰ Your cart has expired.\n\nStart fresh by browsing our products.`;
  }

  formatMinimumOrderMessage(currentTotal: number): string {
    const config = configManager.get();
    const currency = config.store.currency;
    const minOrder = config.cart.minOrderValue;

    const remaining = new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(minOrder - currentTotal);

    return `Minimum order value is ${config.store.currency} ${minOrder}.\n\n` +
      `Add ${remaining} more to proceed with checkout.`;
  }

  formatMaximumOrderMessage(currentTotal: number): string {
    const config = configManager.get();
    const currency = config.store.currency;
    const maxOrder = config.cart.maxOrderValue;

    return `Maximum order value is ${config.store.currency} ${maxOrder}.\n\n` +
      `Current total: ${config.store.currency} ${currentTotal}.\n\n` +
      `Please remove some items to proceed.`;
  }

  formatOutOfStockMessage(itemName: string): string {
    return `❌ ${itemName} is out of stock.\n\nPlease remove it from your cart or reduce the quantity.`;
  }

  formatInsufficientStockMessage(itemName: string, requested: number, available: number): string {
    return `⚠️ ${itemName}\n\n` +
      `Requested: ${requested}\n` +
      `Available: ${available}\n\n` +
      `Please update the quantity.`;
  }

  formatDeliveryFeeBreakdown(subtotal: number, deliveryFee: number): string {
    const config = configManager.get();
    const currency = config.store.currency;
    const freeThreshold = config.delivery.freeThreshold;
    const defaultFee = config.delivery.defaultFee;

    let message = `📦 *Delivery Information*\n\n`;

    if (deliveryFee === 0) {
      const saved = new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency,
        maximumFractionDigits: 0,
      }).format(defaultFee);

      message += `🎉 You're eligible for *FREE delivery!*\n`;
      message += `(You saved ${saved})\n`;
    } else {
      const total = new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency,
        maximumFractionDigits: 0,
      }).format(deliveryFee);

      const remaining = new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency,
        maximumFractionDigits: 0,
      }).format(freeThreshold - subtotal);

      message += `Delivery: ${total}\n\n`;
      message += `💡 Add ${remaining} more to get FREE delivery!`;
    }

    return message;
  }
}

export const cartDisplay = CartDisplayFormatter.getInstance();
export default cartDisplay;
