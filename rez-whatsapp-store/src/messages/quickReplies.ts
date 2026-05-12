import { configManager } from '../config';

export interface QuickReplyButton {
  id: string;
  title: string;
}

export interface QuickReplySection {
  title: string;
  rows: Array<{
    id: string;
    title: string;
    description?: string;
  }>;
}

export class QuickRepliesFormatter {
  private static instance: QuickRepliesFormatter;

  private constructor() {}

  static getInstance(): QuickRepliesFormatter {
    if (!QuickRepliesFormatter.instance) {
      QuickRepliesFormatter.instance = new QuickRepliesFormatter();
    }
    return QuickRepliesFormatter.instance;
  }

  getWelcomeMessage(): string {
    const config = configManager.get();
    return `Welcome to ${config.store.name}! 🛍️\n\n` +
      `Shop easily through WhatsApp!\n\n` +
      `What would you like to do?`;
  }

  getHelpMessage(): string {
    return `🆘 *Help & Support*\n\n` +
      `Here are commands you can use:\n\n` +
      `🛍️ *Shop*\n` +
      `• "Shop" or "Browse" - View products\n` +
      `• "Add [product]" - Add to cart\n` +
      `• "Search [query]" - Find products\n\n` +
      `🛒 *Cart*\n` +
      `• "Cart" - View your cart\n` +
      `• "Update [qty] [product]" - Change quantity\n` +
      `• "Remove [product]" - Remove item\n` +
      `• "Clear Cart" - Empty your cart\n\n` +
      `💳 *Checkout*\n` +
      `• "Checkout" - Start ordering\n` +
      `• Share address when asked\n` +
      `• Choose delivery & payment\n\n` +
      `📦 *Orders*\n` +
      `• "Orders" - View order history\n` +
      `• "Track [order ID]" - Check status\n\n` +
      `Need more help? Contact support!`;
  }

  getMainMenuButtons(): QuickReplyButton[] {
    return [
      { id: 'browse', title: '🛍️ Browse Products' },
      { id: 'cart', title: '🛒 View Cart' },
      { id: 'orders', title: '📦 My Orders' },
      { id: 'help', title: '❓ Help' },
    ];
  }

  getProductActionButtons(): QuickReplyButton[] {
    return [
      { id: 'add_to_cart', title: 'Add to Cart' },
      { id: 'view_cart', title: 'View Cart' },
      { id: 'continue_shopping', title: 'Continue Shopping' },
    ];
  }

  getCartActionButtons(): QuickReplyButton[] {
    return [
      { id: 'checkout', title: 'Checkout 🛍️' },
      { id: 'apply_coupon', title: 'Apply Coupon' },
      { id: 'clear_cart', title: 'Clear Cart' },
      { id: 'continue_shopping', title: 'Continue Shopping' },
    ];
  }

  getDeliveryOptions(): QuickReplySection[] {
    return [
      {
        title: 'Delivery Options',
        rows: [
          {
            id: 'delivery_home',
            title: '🏠 Home Delivery',
            description: 'Get it delivered to your doorstep',
          },
          {
            id: 'delivery_pickup',
            title: '🏪 Store Pickup',
            description: 'Pick up from our store (FREE)',
          },
          {
            id: 'delivery_instant',
            title: '⚡ Instant Delivery',
            description: 'Get it within 2 hours',
          },
        ],
      },
    ];
  }

  getPaymentOptions(): QuickReplySection[] {
    return [
      {
        title: 'Payment Methods',
        rows: [
          {
            id: 'payment_upi',
            title: '📱 UPI',
            description: 'Google Pay, PhonePe, Paytm',
          },
          {
            id: 'payment_card',
            title: '💳 Card',
            description: 'Credit/Debit Card',
          },
          {
            id: 'payment_wallet',
            title: '👛 Wallet',
            description: 'REZ Wallet Balance',
          },
          {
            id: 'payment_cod',
            title: '💵 Cash on Delivery',
            description: 'Pay when you receive',
          },
        ],
      },
    ];
  }

  getAddressFormMessage(): string {
    return `📍 *Delivery Address*\n\n` +
      `Please provide your address in this format:\n\n` +
      `Name: [Your Name]\n` +
      `Phone: [Phone Number]\n` +
      `Address: [Street, Area]\n` +
      `City: [City]\n` +
      `State: [State]\n` +
      `PIN: [Pincode]\n\n` +
      `Example:\n` +
      `John Doe\n` +
      `9876543210\n` +
      `123 Main Street, Koramangala\n` +
      `Bangalore\n` +
      `Karnataka\n` +
      `560001`;
  }

  getCategoryButtons(): string[] {
    return ['Food & Beverages', 'Personal Care', 'Lifestyle'];
  }

  getNavigationButtons(): QuickReplyButton[] {
    return [
      { id: 'back', title: '⬅️ Back' },
      { id: 'home', title: '🏠 Home' },
      { id: 'cart', title: '🛒 Cart' },
    ];
  }

  getQuantityButtons(maxQuantity: number = 5): QuickReplyButton[] {
    const buttons: QuickReplyButton[] = [];
    for (let i = 1; i <= maxQuantity; i++) {
      buttons.push({ id: `qty_${i}`, title: `${i}` });
    }
    return buttons;
  }

  getOrderStatusMessage(status: string): string {
    const statusMessages: Record<string, string> = {
      pending: '⏳ Your order is being prepared.',
      confirmed: '✅ Your order has been confirmed!',
      processing: '🔄 Your order is being processed.',
      shipped: '🚚 Your order has been shipped!',
      out_for_delivery: '📦 Your order is out for delivery.',
      delivered: '🎉 Your order has been delivered. Enjoy!',
      cancelled: '❌ Your order has been cancelled.',
      refunded: '💰 Your refund has been processed.',
      failed: '⚠️ Payment failed. Please try again.',
    };

    return statusMessages[status] || `Order status: ${status}`;
  }

  getOrderTrackingMessage(orderId: string, status: string, estimatedDelivery?: Date): string {
    let message = `📦 *Order: ${orderId}*\n\n`;
    message += `Status: ${this.getOrderStatusMessage(status)}\n\n`;

    if (estimatedDelivery) {
      const date = new Date(estimatedDelivery);
      const formattedDate = date.toLocaleDateString('en-IN', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
      });
      message += `📅 Expected: ${formattedDate}\n\n`;
    }

    message += `We'll notify you of any updates!`;

    return message;
  }

  getConfirmationButtons(): QuickReplyButton[] {
    return [
      { id: 'confirm_yes', title: '✅ Yes, Confirm' },
      { id: 'confirm_no', title: '❌ No, Cancel' },
    ];
  }

  getYesNoButtons(): QuickReplyButton[] {
    return [
      { id: 'yes', title: '✅ Yes' },
      { id: 'no', title: '❌ No' },
    ];
  }

  formatInteractiveList(header: string, body: string, buttonText: string, sections: QuickReplySection[]): {
    type: string;
    header?: { type: string; text: string };
    body: { text: string };
    footer?: { text: string };
    action: {
      button: string;
      sections: Array<{
        title: string;
        rows: Array<{
          id: string;
          title: string;
          description?: string;
        }>;
      }>;
    };
  } {
    return {
      type: 'list',
      header: { type: 'text', text: header },
      body: { text: body },
      action: {
        button: buttonText,
        sections: sections.map((section) => ({
          title: section.title,
          rows: section.rows,
        })),
      },
    };
  }

  formatInteractiveButtons(
    headerText: string,
    bodyText: string,
    footerText: string,
    buttons: QuickReplyButton[]
  ): {
    type: string;
    header?: { type: string; text: string };
    body: { text: string };
    footer?: { text: string };
    action: {
      buttons: Array<{
        type: string;
        reply: { id: string; title: string };
      }>;
    };
  } {
    return {
      type: 'button',
      header: { type: 'text', text: headerText },
      body: { text: bodyText },
      footer: { text: footerText },
      action: {
        buttons: buttons.map((btn) => ({
          type: 'reply',
          reply: { id: btn.id, title: btn.title },
        })),
      },
    };
  }

  getErrorMessage(errorCode: string): string {
    const errorMessages: Record<string, string> = {
      'PRODUCT_NOT_FOUND': 'Product not found. Please check the product name.',
      'OUT_OF_STOCK': 'Sorry, this product is currently out of stock.',
      'INSUFFICIENT_STOCK': 'Not enough stock available for this quantity.',
      'CART_EMPTY': 'Your cart is empty. Add items to continue.',
      'CHECKOUT_EXPIRED': 'Your checkout session has expired. Please start again.',
      'PAYMENT_FAILED': 'Payment failed. Please try again or choose a different method.',
      'ORDER_NOT_FOUND': 'Order not found. Please check the order ID.',
      'INVALID_ADDRESS': 'Please provide a valid address.',
      'DELIVERY_UNAVAILABLE': 'Delivery is not available in your area.',
      'MIN_ORDER_NOT_MET': 'Minimum order value not met. Please add more items.',
    };

    return errorMessages[errorCode] || 'Something went wrong. Please try again.';
  }

  getSuccessMessage(action: string): string {
    const successMessages: Record<string, string> = {
      'ADDED_TO_CART': '✅ Added to cart!',
      'UPDATED_CART': '✅ Cart updated!',
      'REMOVED_FROM_CART': '✅ Removed from cart!',
      'ORDER_PLACED': '🎉 Order placed successfully!',
      'ADDRESS_SAVED': '✅ Address saved!',
      'PAYMENT_INITIATED': '💳 Payment initiated. Complete to confirm order.',
      'ORDER_CANCELLED': '❌ Order cancelled.',
      'COUPON_APPLIED': '🎉 Coupon applied!',
    };

    return successMessages[action] || '✅ Done!';
  }
}

export const quickReplies = QuickRepliesFormatter.getInstance();
export default quickReplies;
