import { logger } from '../config/logger';
import { checkoutFlowService, CartItem } from '../services/checkoutFlow';
import { linkService } from '../services/linkService';
import { productDiscoveryService, Product } from '../services/productDiscovery';

export interface PurchaseFlowState {
  userId: string;
  stage: PurchaseStage;
  sessionId?: string;
  selectedProduct?: Product;
  selectedVariant?: { type: string; value: string };
  quantity: number;
  shippingAddress?: {
    fullName?: string;
    addressLine1?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
  };
  paymentMethod?: string;
  promoCode?: string;
  createdAt: Date;
  lastInteraction: Date;
}

export type PurchaseStage =
  | 'initiated'
  | 'product_confirmed'
  | 'variant_selected'
  | 'quantity_confirmed'
  | 'address_collected'
  | 'shipping_selected'
  | 'payment_collected'
  | 'reviewing'
  | 'confirmed'
  | 'completed'
  | 'cancelled';

export interface PurchaseResponse {
  message: string;
  stage: PurchaseStage;
  cart?: CartItem[];
  total?: number;
  shippingCost?: number;
  tax?: number;
  promoApplied?: boolean;
  links?: string[];
  quickReplies?: string[];
  isComplete: boolean;
  needsWhatsapp?: boolean;
}

export class PurchaseFlow {
  private activeFlows: Map<string, PurchaseFlowState> = new Map();

  startFlow(userId: string, productId?: string): PurchaseFlowState {
    let product: Product | undefined;

    if (productId) {
      product = productDiscoveryService.getProductById(productId);
    }

    const state: PurchaseFlowState = {
      userId,
      stage: 'initiated',
      selectedProduct: product,
      quantity: 1,
      createdAt: new Date(),
      lastInteraction: new Date()
    };

    this.activeFlows.set(userId, state);
    logger.info('Purchase flow started', { userId, productId });

    return state;
  }

  getFlow(userId: string): PurchaseFlowState | undefined {
    const flow = this.activeFlows.get(userId);
    if (flow) {
      flow.lastInteraction = new Date();
    }
    return flow;
  }

  processMessage(
    userId: string,
    message: string
  ): PurchaseResponse {
    let flow = this.activeFlows.get(userId);

    if (!flow) {
      flow = this.startFlow(userId);
    }

    const lowerMessage = message.toLowerCase();

    switch (flow.stage) {
      case 'initiated':
        return this.handleInitiated(flow, message);
      case 'product_confirmed':
        return this.handleProductConfirmed(flow, message);
      case 'variant_selected':
        return this.handleVariantSelected(flow, message);
      case 'quantity_confirmed':
        return this.handleQuantityConfirmed(flow, message);
      case 'address_collected':
        return this.handleAddressCollected(flow, message);
      case 'shipping_selected':
        return this.handleShippingSelected(flow, message);
      case 'payment_collected':
        return this.handlePaymentCollected(flow, message);
      case 'reviewing':
        return this.handleReviewing(flow, message);
      case 'confirmed':
        return this.handleConfirmed(flow);
      default:
        return this.handleCompleted(flow);
    }
  }

  setProduct(userId: string, productId: string): PurchaseResponse {
    const product = productDiscoveryService.getProductById(productId);

    if (!product) {
      return {
        message: 'Sorry, I couldn\'t find that product. Can you try again?',
        stage: 'initiated',
        isComplete: false
      };
    }

    let flow = this.activeFlows.get(userId);
    if (!flow) {
      flow = this.startFlow(userId);
    }

    flow.selectedProduct = product;
    flow.stage = 'product_confirmed';

    // Check if product has variants
    if (product.variants && product.variants.length > 0) {
      return {
        message: `Great choice! Is there a specific ${product.variants[0].type} or color you prefer?`,
        product,
        stage: flow.stage,
        quickReplies: this.generateVariantOptions(product),
        isComplete: false
      };
    }

    return {
      message: `Perfect! You picked the ${product.name}. How many would you like?`,
      product,
      stage: flow.stage,
      quickReplies: ['Just 1', '2', '3', 'Something else'],
      isComplete: false
    };
  }

  private handleInitiated(flow: PurchaseFlowState, message: string): PurchaseResponse {
    if (flow.selectedProduct) {
      flow.stage = 'product_confirmed';
      return this.handleProductConfirmed(flow, message);
    }

    return {
      message: 'What would you like to buy? Share the product name or link!',
      stage: flow.stage,
      quickReplies: ['I need help finding something', 'Show me featured items'],
      isComplete: false
    };
  }

  private handleProductConfirmed(flow: PurchaseFlowState, message: string): PurchaseResponse {
    const product = flow.selectedProduct!;
    const lowerMessage = message.toLowerCase();

    // Check for variant selection
    if (product.variants) {
      const variantMatch = product.variants.find(v =>
        lowerMessage.includes(v.value.toLowerCase()) ||
        lowerMessage.includes(v.type.toLowerCase())
      );

      if (variantMatch) {
        flow.selectedVariant = { type: variantMatch.type, value: variantMatch.value };
        flow.stage = 'variant_selected';
        return this.handleVariantSelected(flow, message);
      }

      return {
        message: `Which ${product.variants[0].type} would you like? Options: ${[...new Set(product.variants.map(v => v.value))].join(', ')}`,
        product,
        quickReplies: this.generateVariantOptions(product),
        stage: flow.stage,
        isComplete: false
      };
    }

    flow.stage = 'quantity_confirmed';
    return this.handleQuantityConfirmed(flow, message);
  }

  private handleVariantSelected(flow: PurchaseFlowState, message: string): PurchaseResponse {
    const product = flow.selectedProduct!;
    const lowerMessage = message.toLowerCase();

    // Check for variant confirmation or quantity
    const quantityMatch = lowerMessage.match(/\d+/);
    if (quantityMatch) {
      flow.quantity = parseInt(quantityMatch[0]);
      flow.stage = 'quantity_confirmed';
      return this.handleQuantityConfirmed(flow, message);
    }

    flow.stage = 'quantity_confirmed';
    return {
      message: `Got it! How many ${flow.selectedVariant.value} would you like?`,
      product,
      stage: flow.stage,
      quickReplies: ['Just 1', '2', '3'],
      isComplete: false
    };
  }

  private handleQuantityConfirmed(flow: PurchaseFlowState, message: string): PurchaseResponse {
    const product = flow.selectedProduct!;
    const lowerMessage = message.toLowerCase();

    // Parse quantity
    const quantityMatch = lowerMessage.match(/\d+/);
    if (quantityMatch) {
      flow.quantity = Math.min(parseInt(quantityMatch[0]), 10);
    }

    // Create checkout session
    const cartItem: CartItem = {
      productId: product.id,
      productName: product.name,
      variant: flow.selectedVariant,
      quantity: flow.quantity,
      price: product.price,
      image: product.images[0]
    };

    const session = checkoutFlowService.createSession(flow.userId, [cartItem]);
    flow.sessionId = session.id;
    flow.stage = 'address_collected';

    // Calculate totals
    const subtotal = product.price * flow.quantity;
    const shipping = subtotal >= 50 ? 0 : 5.99;
    const tax = subtotal * 0.08;
    const total = subtotal + shipping + tax;

    return {
      message: `Your cart:\n${product.name}${flow.selectedVariant ? ` (${flow.selectedVariant.value})` : ''} x${flow.quantity}\nSubtotal: $${subtotal.toFixed(2)}\nShipping: ${shipping === 0 ? 'FREE' : '$' + shipping.toFixed(2)}\n\nReady to checkout? Where should we send it?`,
      stage: flow.stage,
      cart: [cartItem],
      total,
      shippingCost: shipping,
      tax,
      quickReplies: ['DM my address', 'Continue on WhatsApp', 'I have a promo code'],
      isComplete: false
    };
  }

  private handleAddressCollected(flow: PurchaseFlowState, message: string): PurchaseResponse {
    const lowerMessage = message.toLowerCase();

    // Check for WhatsApp handoff preference
    if (lowerMessage.includes('whatsapp') || lowerMessage.includes('continue')) {
      const whatsappLink = linkService.generateWhatsAppLink({
        sessionId: flow.sessionId,
        productId: flow.selectedProduct?.id
      });

      return {
        message: 'Let\'s switch to WhatsApp for a smoother checkout experience!',
        links: [whatsappLink.url],
        stage: flow.stage,
        needsWhatsapp: true,
        quickReplies: ['Open WhatsApp', 'Stay here'],
        isComplete: false
      };
    }

    // For now, assume address will be collected via WhatsApp
    const whatsappLink = linkService.generateWhatsAppLink({
      sessionId: flow.sessionId,
      message: 'Hi! I\'m ready to checkout. Here\'s my shipping info:'
    });

    flow.stage = 'shipping_selected';

    return {
      message: 'I\'ll need your shipping address to continue. You can share it here or let\'s move to WhatsApp for a faster checkout!',
      links: [whatsappLink.url],
      stage: flow.stage,
      needsWhatsapp: true,
      quickReplies: ['Share address here', 'WhatsApp checkout'],
      isComplete: false
    };
  }

  private handleShippingSelected(flow: PurchaseFlowState, message: string): PurchaseResponse {
    const session = flow.sessionId ? checkoutFlowService.getSession(flow.sessionId) : null;

    if (!session) {
      return this.handleCompleted(flow);
    }

    flow.stage = 'payment_collected';
    return {
      message: `Great! Shipping to your address.\n\nOrder Summary:\n${checkoutFlowService.formatCartSummary(session)}\n\nHow would you like to pay?`,
      cart: session.items,
      total: session.total,
      stage: flow.stage,
      quickReplies: ['Credit Card', 'PayPal', 'WhatsApp for payment'],
      isComplete: false
    };
  }

  private handlePaymentCollected(flow: PurchaseFlowState, message: string): PurchaseResponse {
    const session = flow.sessionId ? checkoutFlowService.getSession(flow.sessionId) : null;

    // Check payment method
    if (message.toLowerCase().includes('card')) {
      flow.paymentMethod = 'credit_card';
    } else if (message.toLowerCase().includes('paypal')) {
      flow.paymentMethod = 'paypal';
    } else {
      flow.paymentMethod = 'whatsapp';
    }

    if (flow.paymentMethod === 'whatsapp') {
      const whatsappLink = linkService.generateWhatsAppLink({
        sessionId: flow.sessionId,
        message: 'Hi! I\'d like to complete my payment. Can you help me?'
      });

      return {
        message: 'Let\'s finalize your payment on WhatsApp!',
        links: [whatsappLink.url],
        stage: flow.stage,
        needsWhatsapp: true,
        isComplete: false
      };
    }

    flow.stage = 'reviewing';
    return this.handleReviewing(flow, message);
  }

  private handleReviewing(flow: PurchaseFlowState, message: string): PurchaseResponse {
    const session = flow.sessionId ? checkoutFlowService.getSession(flow.sessionId) : null;

    if (!session) {
      return this.handleCompleted(flow);
    }

    const lowerMessage = message.toLowerCase();

    if (lowerMessage.includes('yes') || lowerMessage.includes('confirm') || lowerMessage.includes('pay')) {
      flow.stage = 'confirmed';
      return this.handleConfirmed(flow);
    }

    if (lowerMessage.includes('change') || lowerMessage.includes('edit')) {
      return {
        message: 'No problem! What would you like to change?',
        stage: flow.stage,
        quickReplies: ['Change address', 'Change quantity', 'Remove item'],
        isComplete: false
      };
    }

    const checkoutLink = linkService.generateCheckoutLink(flow.sessionId!);

    return {
      message: `Review your order:\n${checkoutFlowService.formatCartSummary(session)}\n\nLooks good?`,
      links: [checkoutLink.url],
      stage: flow.stage,
      quickReplies: ['Yes, pay now!', 'Change something', 'I have a promo code'],
      isComplete: false
    };
  }

  private handleConfirmed(flow: PurchaseFlowState): PurchaseResponse {
    if (flow.sessionId) {
      checkoutFlowService.completeCheckout(flow.sessionId);
    }

    flow.stage = 'completed';

    return {
      message: '🎉 Order confirmed! You\'ll receive a confirmation message shortly. Thanks for shopping with us!',
      stage: flow.stage,
      isComplete: true,
      quickReplies: ['Track my order', 'Need help with something else']
    };
  }

  private handleCompleted(flow: PurchaseFlowState): PurchaseResponse {
    this.activeFlows.delete(flow.userId);
    return {
      message: 'Your order is complete! Let me know if you need anything else.',
      stage: 'completed',
      isComplete: true
    };
  }

  private generateVariantOptions(product: Product): string[] {
    if (!product.variants) return [];

    const uniqueValues = [...new Set(product.variants.map(v => v.value))];
    return uniqueValues.slice(0, 5);
  }

  cancelFlow(userId: string): boolean {
    const flow = this.activeFlows.get(userId);
    if (flow?.sessionId) {
      checkoutFlowService.getSession(flow.sessionId);
    }
    return this.activeFlows.delete(userId);
  }

  getActiveFlowCount(): number {
    return this.activeFlows.size;
  }
}

export const purchaseFlow = new PurchaseFlow();
