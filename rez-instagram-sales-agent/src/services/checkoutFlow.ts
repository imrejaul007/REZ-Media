import { logger } from '../config/logger';

export interface CartItem {
  productId: string;
  productName: string;
  variant?: {
    type: string;
    value: string;
  };
  quantity: number;
  price: number;
  image?: string;
}

export interface CheckoutSession {
  id: string;
  userId: string;
  items: CartItem[];
  subtotal: number;
  shipping: number;
  tax: number;
  total: number;
  currency: string;
  shippingAddress?: ShippingAddress;
  paymentMethod?: string;
  status: CheckoutStatus;
  whatsappHandoff: boolean;
  createdAt: Date;
  expiresAt: Date;
}

export type CheckoutStatus =
  | 'initiated'
  | 'address_collected'
  | 'payment_pending'
  | 'confirmed'
  | 'failed'
  | 'expired'
  | 'completed';

export interface ShippingAddress {
  fullName: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  phone?: string;
}

export interface CheckoutContext {
  currentStep: CheckoutStep;
  requiredFields: string[];
  collectedFields: string[];
  errors: string[];
}

export type CheckoutStep =
  | 'cart_review'
  | 'shipping_address'
  | 'shipping_method'
  | 'payment_method'
  | 'order_confirmation'
  | 'whatsapp_handoff';

export class CheckoutFlowService {
  private sessions: Map<string, CheckoutSession> = new Map();
  private readonly SESSION_EXPIRY_MS = 60 * 60 * 1000; // 1 hour

  generateSessionId(): string {
    return `checkout_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  createSession(userId: string, items: CartItem[]): CheckoutSession {
    const id = this.generateSessionId();
    const subtotal = this.calculateSubtotal(items);

    const session: CheckoutSession = {
      id,
      userId,
      items,
      subtotal,
      shipping: subtotal >= 50 ? 0 : 5.99,
      tax: subtotal * 0.08, // 8% tax
      total: 0,
      currency: 'USD',
      status: 'initiated',
      whatsappHandoff: false,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + this.SESSION_EXPIRY_MS)
    };

    session.total = session.subtotal + session.shipping + session.tax;

    this.sessions.set(id, session);
    logger.info('Checkout session created', { sessionId: id, userId, total: session.total });

    return session;
  }

  getSession(sessionId: string): CheckoutSession | undefined {
    const session = this.sessions.get(sessionId);
    if (session && session.expiresAt < new Date()) {
      this.updateStatus(sessionId, 'expired');
      return undefined;
    }
    return session;
  }

  getSessionByUserId(userId: string): CheckoutSession | undefined {
    for (const session of this.sessions.values()) {
      if (session.userId === userId && session.expiresAt > new Date()) {
        return session;
      }
    }
    return undefined;
  }

  calculateSubtotal(items: CartItem[]): number {
    return items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  }

  addItem(sessionId: string, item: CartItem): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;

    const existingIndex = session.items.findIndex(
      i => i.productId === item.productId &&
        i.variant?.type === item.variant?.type &&
        i.variant?.value === item.variant?.value
    );

    if (existingIndex >= 0) {
      session.items[existingIndex].quantity += item.quantity;
    } else {
      session.items.push(item);
    }

    this.recalculateTotals(session);
    logger.debug('Item added to checkout', { sessionId, productId: item.productId });

    return true;
  }

  removeItem(sessionId: string, productId: string, variant?: CartItem['variant']): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;

    session.items = session.items.filter(
      item => !(item.productId === productId &&
        (variant?.type === item.variant?.type && variant?.value === item.variant?.value))
    );

    if (session.items.length === 0) {
      this.sessions.delete(sessionId);
      return true;
    }

    this.recalculateTotals(session);
    return true;
  }

  updateQuantity(sessionId: string, productId: string, quantity: number): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;

    const item = session.items.find(i => i.productId === productId);
    if (!item) return false;

    if (quantity <= 0) {
      return this.removeItem(sessionId, productId);
    }

    item.quantity = quantity;
    this.recalculateTotals(session);
    return true;
  }

  recalculateTotals(session: CheckoutSession): void {
    session.subtotal = this.calculateSubtotal(session.items);
    session.shipping = session.subtotal >= 50 ? 0 : 5.99;
    session.tax = session.subtotal * 0.08;
    session.total = session.subtotal + session.shipping + session.tax;
  }

  setShippingAddress(sessionId: string, address: ShippingAddress): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;

    session.shippingAddress = address;
    this.updateStatus(sessionId, 'address_collected');

    logger.debug('Shipping address set', { sessionId, country: address.country });
    return true;
  }

  setPaymentMethod(sessionId: string, method: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;

    session.paymentMethod = method;
    return true;
  }

  updateStatus(sessionId: string, status: CheckoutStatus): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;

    const previousStatus = session.status;
    session.status = status;

    logger.info('Checkout status updated', { sessionId, from: previousStatus, to: status });
    return true;
  }

  initiateWhatsAppHandoff(sessionId: string): string | undefined {
    const session = this.sessions.get(sessionId);
    if (!session) return undefined;

    session.whatsappHandoff = true;
    const sessionData = encodeURIComponent(JSON.stringify({
      id: session.id,
      items: session.items.map(i => ({
        name: i.productName,
        qty: i.quantity,
        price: i.price
      })),
      total: session.total,
      currency: session.currency
    }));

    // Generate WhatsApp link with pre-filled message
    const whatsappNumber = process.env.WHATSAPP_BUSINESS_NUMBER || '1234567890';
    const message = `Hi! I want to complete my order ($${session.total.toFixed(2)} total). Can you help me checkout?`;
    const whatsappUrl = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`;

    logger.info('WhatsApp handoff initiated', { sessionId });
    return whatsappUrl;
  }

  getCheckoutProgress(sessionId: string): CheckoutContext {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return {
        currentStep: 'cart_review',
        requiredFields: [],
        collectedFields: [],
        errors: []
      };
    }

    const context: CheckoutContext = {
      currentStep: 'cart_review',
      requiredFields: [],
      collectedFields: [],
      errors: []
    };

    // Determine current step based on what's been collected
    if (session.items.length === 0) {
      context.currentStep = 'cart_review';
      context.requiredFields = ['items'];
    } else if (!session.shippingAddress) {
      context.currentStep = 'shipping_address';
      context.requiredFields = ['fullName', 'address', 'city', 'state', 'postalCode', 'country'];
    } else if (!session.paymentMethod) {
      context.currentStep = 'payment_method';
      context.requiredFields = ['paymentMethod'];
    } else {
      context.currentStep = 'order_confirmation';
    }

    if (session.shippingAddress) {
      context.collectedFields.push('shippingAddress');
    }
    if (session.paymentMethod) {
      context.collectedFields.push('paymentMethod');
    }

    return context;
  }

  formatCartSummary(session: CheckoutSession): string {
    const lines: string[] = [];

    lines.push('🛒 Your Cart:');
    lines.push('');

    for (const item of session.items) {
      const variantInfo = item.variant ? ` (${item.variant.value})` : '';
      lines.push(`• ${item.productName}${variantInfo} x${item.quantity}`);
      lines.push(`  $${(item.price * item.quantity).toFixed(2)}`);
    }

    lines.push('');
    lines.push(`Subtotal: $${session.subtotal.toFixed(2)}`);
    lines.push(`Shipping: ${session.shipping === 0 ? 'FREE' : '$' + session.shipping.toFixed(2)}`);
    lines.push(`Tax: $${session.tax.toFixed(2)}`);
    lines.push('');
    lines.push(`Total: $${session.total.toFixed(2)}`);

    return lines.join('\n');
  }

  generateQuickReplies(session: CheckoutSession): string[] {
    const replies: string[] = [];

    switch (session.status) {
      case 'initiated':
        replies.push('Add more items');
        replies.push('Continue to checkout');
        replies.push('Remove an item');
        break;
      case 'address_collected':
        replies.push('Proceed to payment');
        replies.push('Change address');
        break;
      case 'payment_pending':
        replies.push('Pay now');
        replies.push('Use WhatsApp instead');
        replies.push('Change payment method');
        break;
    }

    replies.push('Continue in WhatsApp');
    replies.push('Speak to support');

    return replies;
  }

  completeCheckout(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;

    if (!session.shippingAddress || !session.paymentMethod) {
      return false;
    }

    this.updateStatus(sessionId, 'completed');
    logger.info('Checkout completed', { sessionId, total: session.total });

    // In production, this would trigger order creation in the backend
    return true;
  }

  cleanupExpiredSessions(): number {
    const now = new Date();
    let cleaned = 0;

    for (const [id, session] of this.sessions.entries()) {
      if (session.expiresAt < now || session.status === 'expired') {
        this.sessions.delete(id);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      logger.info('Expired checkout sessions cleaned', { count: cleaned });
    }

    return cleaned;
  }
}

export const checkoutFlowService = new CheckoutFlowService();
