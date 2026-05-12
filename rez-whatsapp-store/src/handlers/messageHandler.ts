import winston from 'winston';
import { configManager } from '../config';
import { cartService } from '../services/cartService';
import { checkoutService } from '../services/checkoutService';
import { paymentService } from '../services/paymentService';
import { orderService } from '../services/orderService';
import { catalogService } from '../services/catalogService';
import { productCards } from '../messages/productCards';
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

export interface WhatsAppMessage {
  from: string;
  to: string;
  body: string;
  messageId?: string;
  timestamp?: string;
  type?: 'text' | 'image' | 'audio' | 'video' | 'document' | 'location' | 'contact' | 'sticker';
}

export interface ProcessedMessage {
  intent: MessageIntent;
  entities: MessageEntities;
  rawText: string;
}

export type MessageIntent =
  | 'greeting'
  | 'browse_products'
  | 'view_product'
  | 'add_to_cart'
  | 'view_cart'
  | 'update_cart'
  | 'remove_from_cart'
  | 'clear_cart'
  | 'checkout'
  | 'provide_address'
  | 'select_delivery'
  | 'make_payment'
  | 'view_orders'
  | 'track_order'
  | 'cancel_order'
  | 'help'
  | 'unknown';

export interface MessageEntities {
  productId?: string;
  productName?: string;
  quantity?: number;
  category?: string;
  orderId?: string;
  couponCode?: string;
  addressParts?: {
    name?: string;
    phone?: string;
    address?: string;
    city?: string;
    state?: string;
    pincode?: string;
    instructions?: string;
  };
  deliveryType?: 'home_delivery' | 'store_pickup' | 'instant';
}

export interface HandlerResponse {
  messages: WhatsAppOutboundMessage[];
  stateUpdate?: {
    sessionState?: string;
    checkoutStep?: string;
    cartId?: string;
    orderId?: string;
  };
}

export interface WhatsAppOutboundMessage {
  type: 'text' | 'interactive' | 'image' | 'document' | 'template';
  to: string;
  body?: string;
  content?: string;
  interactive?: {
    type: 'button' | 'list' | 'product' | 'product_list';
    header?: { type: 'text' | 'image' | 'video' | 'document'; text?: string; mediaUrl?: string };
    body: { text: string };
    footer?: { text: string };
    action: Record<string, unknown>;
  };
  mediaUrl?: string;
  filename?: string;
  caption?: string;
  template?: {
    name: string;
    language: { code: string };
    components: Array<{
      type: 'header' | 'body' | 'button';
      parameters: Array<{ type: string; [key: string]: unknown }>;
    }>;
  };
}

export class MessageHandler {
  private static instance: MessageHandler;
  private userSessions: Map<string, UserSession>;

  private constructor() {
    this.userSessions = new Map();
  }

  static getInstance(): MessageHandler {
    if (!MessageHandler.instance) {
      MessageHandler.instance = new MessageHandler();
    }
    return MessageHandler.instance;
  }

  async handleIncomingMessage(message: WhatsAppMessage): Promise<HandlerResponse> {
    const phoneNumber = message.from.replace('whatsapp:', '');
    const normalizedPhone = this.normalizePhoneNumber(phoneNumber);

    logger.info('Processing message', {
      from: normalizedPhone,
      body: message.body,
      type: message.type,
    });

    try {
      // Get or create user session
      let session = this.userSessions.get(normalizedPhone);
      if (!session) {
        session = this.createNewSession(normalizedPhone);
        this.userSessions.set(normalizedPhone, session);
      }

      // Parse the message
      const parsed = this.parseMessage(message.body, session);

      // Process based on intent
      let response: HandlerResponse;

      switch (parsed.intent) {
        case 'greeting':
          response = await this.handleGreeting(normalizedPhone, session);
          break;
        case 'browse_products':
          response = await this.handleBrowseProducts(normalizedPhone, session, parsed.entities);
          break;
        case 'view_product':
          response = await this.handleViewProduct(normalizedPhone, session, parsed.entities);
          break;
        case 'add_to_cart':
          response = await this.handleAddToCart(normalizedPhone, session, parsed.entities);
          break;
        case 'view_cart':
          response = await this.handleViewCart(normalizedPhone, session);
          break;
        case 'update_cart':
          response = await this.handleUpdateCart(normalizedPhone, session, parsed.entities);
          break;
        case 'remove_from_cart':
          response = await this.handleRemoveFromCart(normalizedPhone, session, parsed.entities);
          break;
        case 'clear_cart':
          response = await this.handleClearCart(normalizedPhone, session);
          break;
        case 'checkout':
          response = await this.handleCheckout(normalizedPhone, session);
          break;
        case 'provide_address':
          response = await this.handleProvideAddress(normalizedPhone, session, parsed.entities);
          break;
        case 'select_delivery':
          response = await this.handleSelectDelivery(normalizedPhone, session, parsed.entities);
          break;
        case 'make_payment':
          response = await this.handleMakePayment(normalizedPhone, session);
          break;
        case 'view_orders':
          response = await this.handleViewOrders(normalizedPhone, session);
          break;
        case 'track_order':
          response = await this.handleTrackOrder(normalizedPhone, session, parsed.entities);
          break;
        case 'cancel_order':
          response = await this.handleCancelOrder(normalizedPhone, session, parsed.entities);
          break;
        case 'help':
          response = await this.handleHelp(normalizedPhone);
          break;
        default:
          response = await this.handleUnknown(normalizedPhone, session);
      }

      // Update session state
      this.userSessions.set(normalizedPhone, session);

      return response;
    } catch (error) {
      logger.error('Error handling message', { error, phoneNumber });
      return this.createErrorResponse(normalizedPhone, 'Sorry, something went wrong. Please try again.');
    }
  }

  private normalizePhoneNumber(phone: string): string {
    return phone.replace(/[^\d+]/g, '').replace(/^91/, '');
  }

  private createNewSession(phoneNumber: string): UserSession {
    return {
      phoneNumber,
      state: 'idle',
      lastActivity: new Date(),
      checkoutId: undefined,
      currentProductId: undefined,
      selectedCategory: undefined,
    };
  }

  private parseMessage(body: string, session: UserSession): ProcessedMessage {
    const text = body.trim().toLowerCase();

    // Intent patterns
    const patterns = {
      greeting: /^(hi|hello|hey|namaste|namast[ey]|good\s*(morning|afternoon|evening|night)|hai|hlw|hl(o)+)/i,
      browse: /^(shop|browse|products|items|show|catalogue|catalog|see|view|all|menu|categories)/i,
      viewProduct: /^(view|show|details|info|about)\s*(product)?\s*(\S+)?/i,
      addToCart: /^(add|buy|get|cart)\s*(\d+)?\s*(.+)/i,
      viewCart: /^(cart|my cart|basket|items?)\s*(\?)?$/i,
      updateCart: /^(update|change|edit)\s*(cart)?\s*(\d+)?\s*(.+)/i,
      removeFromCart: /^(remove|delete)\s*(from cart)?\s*(.+)/i,
      clearCart: /^(clear|empty|reset)\s*cart/i,
      checkout: /^(checkout|buy|order|place order|pay|proceed|confirm)/i,
      provideAddress: /^(address|deliver|ship|home)\s*(to|at)?\s*(.+)/i,
      selectDelivery: /^(delivery|pickup|instant|home|store)\s*(delivery|pickup)?/i,
      makePayment: /^(pay|payment|upi|card|cash|wallet|paynow)/i,
      viewOrders: /^(orders?|my orders|order history|past)/i,
      trackOrder: /^(track|where|status|delivery|tracking)\s*(order)?\s*(\S+)?/i,
      cancelOrder: /^(cancel|stop|abort)\s*(order)?\s*(\S+)?/i,
      help: /^(help|\?|support|assist|how)/i,
    };

    // Check for quick reply responses first
    if (session.state === 'awaiting_category') {
      return { intent: 'browse_products', entities: { category: text }, rawText: body };
    }

    if (session.state === 'awaiting_product_selection') {
      const num = parseInt(text, 10);
      if (!isNaN(num)) {
        return { intent: 'view_product', entities: { quantity: num }, rawText: body };
      }
    }

    if (session.state === 'awaiting_address_name') {
      return { intent: 'provide_address', entities: { addressParts: { name: body } }, rawText: body };
    }

    if (session.state === 'awaiting_address_phone') {
      return { intent: 'provide_address', entities: { addressParts: { phone: body } }, rawText: body };
    }

    if (session.state === 'awaiting_address_line') {
      return { intent: 'provide_address', entities: { addressParts: { address: body } }, rawText: body };
    }

    if (session.state === 'awaiting_city') {
      return { intent: 'provide_address', entities: { addressParts: { city: body } }, rawText: body };
    }

    if (session.state === 'awaiting_state') {
      return { intent: 'provide_address', entities: { addressParts: { state: body } }, rawText: body };
    }

    if (session.state === 'awaiting_pincode') {
      return { intent: 'provide_address', entities: { addressParts: { pincode: body } }, rawText: body };
    }

    if (session.state === 'awaiting_delivery_type') {
      if (text.includes('home') || text.includes('delivery')) {
        return { intent: 'select_delivery', entities: { deliveryType: 'home_delivery' }, rawText: body };
      }
      if (text.includes('pickup') || text.includes('store')) {
        return { intent: 'select_delivery', entities: { deliveryType: 'store_pickup' }, rawText: body };
      }
      if (text.includes('instant')) {
        return { intent: 'select_delivery', entities: { deliveryType: 'instant' }, rawText: body };
      }
    }

    if (session.state === 'awaiting_payment') {
      return { intent: 'make_payment', entities: {}, rawText: body };
    }

    // Match intents
    if (patterns.greeting.test(text)) {
      return { intent: 'greeting', entities: {}, rawText: body };
    }

    if (patterns.browse.test(text)) {
      return { intent: 'browse_products', entities: {}, rawText: body };
    }

    if (patterns.viewProduct.test(text)) {
      const match = text.match(/view\s*(product)?\s*(.+)?/i);
      return {
        intent: 'view_product',
        entities: { productName: match?.[2] },
        rawText: body,
      };
    }

    if (patterns.addToCart.test(text)) {
      const match = text.match(/(?:add|buy|get)\s*(\d+)?\s*(.+)/i);
      return {
        intent: 'add_to_cart',
        entities: {
          quantity: match?.[1] ? parseInt(match[1], 10) : 1,
          productName: match?.[2],
        },
        rawText: body,
      };
    }

    if (patterns.viewCart.test(text)) {
      return { intent: 'view_cart', entities: {}, rawText: body };
    }

    if (patterns.updateCart.test(text)) {
      const match = text.match(/update\s*(cart)?\s*(\d+)?\s*(.+)/i);
      return {
        intent: 'update_cart',
        entities: {
          quantity: match?.[2] ? parseInt(match[2], 10) : undefined,
          productName: match?.[3],
        },
        rawText: body,
      };
    }

    if (patterns.removeFromCart.test(text)) {
      const match = text.match(/remove\s*(from cart)?\s*(.+)/i);
      return {
        intent: 'remove_from_cart',
        entities: { productName: match?.[2] },
        rawText: body,
      };
    }

    if (patterns.clearCart.test(text)) {
      return { intent: 'clear_cart', entities: {}, rawText: body };
    }

    if (patterns.checkout.test(text)) {
      return { intent: 'checkout', entities: {}, rawText: body };
    }

    if (patterns.provideAddress.test(text)) {
      return { intent: 'provide_address', entities: {}, rawText: body };
    }

    if (patterns.selectDelivery.test(text)) {
      let deliveryType: 'home_delivery' | 'store_pickup' | 'instant' = 'home_delivery';
      if (text.includes('pickup') || text.includes('store')) {
        deliveryType = 'store_pickup';
      } else if (text.includes('instant')) {
        deliveryType = 'instant';
      }
      return { intent: 'select_delivery', entities: { deliveryType }, rawText: body };
    }

    if (patterns.makePayment.test(text)) {
      return { intent: 'make_payment', entities: {}, rawText: body };
    }

    if (patterns.viewOrders.test(text)) {
      return { intent: 'view_orders', entities: {}, rawText: body };
    }

    if (patterns.trackOrder.test(text)) {
      const match = text.match(/track\s*(order)?\s*(\S+)?/i);
      return {
        intent: 'track_order',
        entities: { orderId: match?.[2] },
        rawText: body,
      };
    }

    if (patterns.cancelOrder.test(text)) {
      const match = text.match(/cancel\s*(order)?\s*(\S+)?/i);
      return {
        intent: 'cancel_order',
        entities: { orderId: match?.[2] },
        rawText: body,
      };
    }

    if (patterns.help.test(text)) {
      return { intent: 'help', entities: {}, rawText: body };
    }

    return { intent: 'unknown', entities: {}, rawText: body };
  }

  // Handler methods
  private async handleGreeting(phone: string, session: UserSession): Promise<HandlerResponse> {
    const cart = await cartService.getCartSummary(phone);
    const welcomeMessage = `Welcome to ${configManager.get().store.name}! 🛍️

We're here to help you shop easily through WhatsApp.

What would you like to do?

1️⃣ Browse Products
2️⃣ View Cart (${cart?.itemCount || 0} items)
3️⃣ Track Order
4️⃣ Get Help

Just type your choice or tell us what you need!`;

    const messages: WhatsAppOutboundMessage[] = [
      {
        type: 'text',
        to: phone,
        body: welcomeMessage,
      },
    ];

    return { messages };
  }

  private async handleBrowseProducts(phone: string, session: UserSession, entities: MessageEntities): Promise<HandlerResponse> {
    const categories = await catalogService.getCategories();

    let headerText = 'Browse Our Products';
    let bodyText = `Here are our categories:\n\n`;

    categories.forEach((cat, idx) => {
      bodyText += `${idx + 1}. ${cat}\n`;
    });

    bodyText += `\n\nType a number or category name to browse.`;

    const messages: WhatsAppOutboundMessage[] = [
      {
        type: 'interactive',
        to: phone,
        interactive: {
          type: 'list',
          header: { type: 'text', text: headerText },
          body: { text: bodyText },
          action: {
            button: 'View Categories',
            sections: [
              {
                title: 'Categories',
                rows: categories.map((cat, idx) => ({
                  id: `cat_${idx}`,
                  title: cat,
                  description: `Browse ${cat}`,
                })),
              },
            ],
          },
        },
      },
    ];

    session.state = 'awaiting_category';
    session.lastActivity = new Date();

    return { messages };
  }

  private async handleViewProduct(phone: string, session: UserSession, entities: MessageEntities): Promise<HandlerResponse> {
    const productName = entities.productName;
    let product;

    if (entities.productId) {
      product = await catalogService.getProduct(entities.productId);
    } else if (productName) {
      const result = await catalogService.searchProducts(productName);
      product = result.items[0];
    }

    if (!product) {
      return this.createErrorResponse(phone, 'Product not found. Try browsing our catalog.');
    }

    session.currentProductId = product.productId;
    session.lastActivity = new Date();

    const card = productCards.formatProductCard(product);
    const messages: WhatsAppOutboundMessage[] = [
      {
        type: 'interactive',
        to: phone,
        interactive: {
          type: 'button',
          header: { type: 'image', mediaUrl: product.thumbnail || product.images?.[0] },
          body: { text: card },
          action: {
            buttons: [
              { type: 'reply', reply: { id: `add_${product.productId}_1`, title: 'Add to Cart' } },
              { type: 'reply', reply: { id: `add_${product.productId}_2`, title: 'Add 2' } },
              { type: 'reply', reply: { id: `add_${product.productId}_3`, title: 'Add 3' } },
            ],
          },
        },
      },
    ];

    return { messages };
  }

  private async handleAddToCart(phone: string, session: UserSession, entities: MessageEntities): Promise<HandlerResponse> {
    const { productName, quantity = 1, productId } = entities;
    let product;

    if (productId) {
      product = await catalogService.getProduct(productId);
    } else if (productName) {
      const result = await catalogService.searchProducts(productName);
      product = result.items[0];
    }

    if (!product) {
      return this.createErrorResponse(phone, 'Product not found. Try browsing our catalog.');
    }

    const result = await cartService.addToCart({
      phoneNumber: phone,
      productId: product.productId,
      quantity,
    });

    session.lastActivity = new Date();

    if (result.success) {
      const cartSummary = await cartService.getCartSummary(phone);
      const messages: WhatsAppOutboundMessage[] = [
        {
          type: 'text',
          to: phone,
          body: `Added ${product.name} to your cart! ✅

Quantity: ${quantity}
Price: ${configManager.get().store.currency} ${product.basePrice * quantity}

🛒 Your cart (${cartSummary?.itemCount || 0} items)
Total: ${configManager.get().store.currency} ${cartSummary?.total || 0}

Reply with:
• "Checkout" to place order
• "Cart" to view cart
• "More" to continue shopping`,
        },
      ];
      return { messages };
    } else {
      return this.createErrorResponse(phone, result.error || 'Failed to add to cart');
    }
  }

  private async handleViewCart(phone: string, session: UserSession): Promise<HandlerResponse> {
    const cart = await cartService.getCart(phone);

    if (!cart || cart.items.length === 0) {
      return {
        messages: [
          {
            type: 'text',
            to: phone,
            body: `Your cart is empty! 🛒\n\nBrowse our products and add items to get started.`,
          },
        ],
      };
    }

    const display = cartDisplay.formatCart(cart);
    const messages: WhatsAppOutboundMessage[] = [
      {
        type: 'interactive',
        to: phone,
        interactive: {
          type: 'button',
          header: { type: 'text', text: '🛒 Your Cart' },
          body: { text: display },
          action: {
            buttons: [
              { type: 'reply', reply: { id: 'checkout', title: 'Checkout' } },
              { type: 'reply', reply: { id: 'clear_cart', title: 'Clear Cart' } },
              { type: 'reply', reply: { id: 'continue_shopping', title: 'Continue' } },
            ],
          },
        },
      },
    ];

    session.lastActivity = new Date();
    return { messages };
  }

  private async handleUpdateCart(phone: string, session: UserSession, entities: MessageEntities): Promise<HandlerResponse> {
    const { productName, quantity, productId } = entities;
    const cart = await cartService.getCart(phone);

    if (!cart || cart.items.length === 0) {
      return this.createErrorResponse(phone, 'Your cart is empty.');
    }

    let itemToUpdate = cart.items.find((i) => i.productId === productId);

    if (!itemToUpdate && productName) {
      itemToUpdate = cart.items.find((i) =>
        i.name.toLowerCase().includes(productName.toLowerCase())
      );
    }

    if (!itemToUpdate) {
      return this.createErrorResponse(phone, 'Item not found in cart.');
    }

    if (quantity === undefined) {
      return {
        messages: [
          {
            type: 'text',
            to: phone,
            body: `Update quantity for ${itemToUpdate.name}:\n\nCurrent: ${itemToUpdate.quantity}\n\nReply with the new quantity (or 0 to remove).`,
          },
        ],
      };
    }

    const result = await cartService.updateCartItem({
      phoneNumber: phone,
      productId: itemToUpdate.productId,
      variantId: itemToUpdate.variantId,
      quantity,
    });

    session.lastActivity = new Date();

    if (result.success) {
      if (quantity === 0) {
        return {
          messages: [
            {
              type: 'text',
              to: phone,
              body: `Removed ${itemToUpdate.name} from cart.`,
            },
          ],
        };
      }
      return {
        messages: [
          {
            type: 'text',
            to: phone,
            body: `Updated ${itemToUpdate.name} quantity to ${quantity}.`,
          },
        ],
      };
    }

    return this.createErrorResponse(phone, result.error || 'Failed to update cart');
  }

  private async handleRemoveFromCart(phone: string, session: UserSession, entities: MessageEntities): Promise<HandlerResponse> {
    const { productName, productId } = entities;
    const cart = await cartService.getCart(phone);

    if (!cart || cart.items.length === 0) {
      return this.createErrorResponse(phone, 'Your cart is empty.');
    }

    let itemToRemove = cart.items.find((i) => i.productId === productId);

    if (!itemToRemove && productName) {
      itemToRemove = cart.items.find((i) =>
        i.name.toLowerCase().includes(productName.toLowerCase())
      );
    }

    if (!itemToRemove) {
      return this.createErrorResponse(phone, 'Item not found in cart.');
    }

    const result = await cartService.removeFromCart({
      phoneNumber: phone,
      productId: itemToRemove.productId,
      variantId: itemToRemove.variantId,
    });

    session.lastActivity = new Date();

    if (result.success) {
      return {
        messages: [
          {
            type: 'text',
            to: phone,
            body: `Removed ${itemToRemove.name} from cart.`,
          },
        ],
      };
    }

    return this.createErrorResponse(phone, result.error || 'Failed to remove item');
  }

  private async handleClearCart(phone: string, session: UserSession): Promise<HandlerResponse> {
    const result = await cartService.clearCart(phone);
    session.lastActivity = new Date();

    if (result.success) {
      return {
        messages: [
          {
            type: 'text',
            to: phone,
            body: 'Your cart has been cleared. 🧹\n\nType "Shop" to browse products.',
          },
        ],
      };
    }

    return this.createErrorResponse(phone, result.error || 'Failed to clear cart');
  }

  private async handleCheckout(phone: string, session: UserSession): Promise<HandlerResponse> {
    const cartResult = await cartService.convertCartToCheckout(phone);

    if (!cartResult.success || !cartResult.checkoutData) {
      return this.createErrorResponse(phone, cartResult.error || 'Cannot start checkout');
    }

    if (cartResult.checkoutData.items.length === 0) {
      return this.createErrorResponse(phone, 'Your cart is empty. Add items before checkout.');
    }

    const checkoutResult = await checkoutService.initiateCheckout({
      phoneNumber: phone,
      source: 'whatsapp',
    });

    if (!checkoutResult.success || !checkoutResult.checkout) {
      return this.createErrorResponse(phone, checkoutResult.error || 'Failed to start checkout');
    }

    session.checkoutId = checkoutResult.checkout.checkoutId;
    session.state = 'checkout_address';
    session.lastActivity = new Date();

    const addressForm = quickReplies.getAddressFormMessage();

    return {
      messages: [
        {
          type: 'text',
          to: phone,
          body: `📦 Checkout Started!\n\nOrder Total: ${configManager.get().store.currency} ${cartResult.checkoutData.totalAmount}\n\n${addressForm}`,
        },
      ],
      stateUpdate: {
        checkoutStep: 'address',
        cartId: cartResult.checkoutData.cartId,
      },
    };
  }

  private async handleProvideAddress(phone: string, session: UserSession, entities: MessageEntities): Promise<HandlerResponse> {
    if (!session.checkoutId) {
      return this.createErrorResponse(phone, 'No active checkout. Start by adding items to cart.');
    }

    const checkout = await checkoutService.getCheckout(session.checkoutId);
    if (!checkout) {
      return this.createErrorResponse(phone, 'Checkout expired. Please start again.');
    }

    const addressParts = entities.addressParts || {};

    // Build address from provided parts
    if (addressParts.name && addressParts.phone && addressParts.address && addressParts.city && addressParts.state && addressParts.pincode) {
      const result = await checkoutService.setDeliveryAddress(session.checkoutId, {
        fullName: addressParts.name,
        phoneNumber: addressParts.phone,
        addressLine1: addressParts.address,
        city: addressParts.city,
        state: addressParts.state,
        postalCode: addressParts.pincode,
        instructions: addressParts.instructions,
      });

      if (result.success) {
        session.state = 'checkout_delivery';
        return {
          messages: [
            {
              type: 'text',
              to: phone,
              body: 'Address saved! ✅\n\nHow would you like to receive your order?\n\n1️⃣ Home Delivery\n2️⃣ Store Pickup\n3️⃣ Instant Delivery',
            },
          ],
        };
      }

      return this.createErrorResponse(phone, result.error || 'Failed to save address');
    }

    // Prompt for address parts
    let prompt = '';
    if (!addressParts.name) {
      session.state = 'awaiting_address_name';
      prompt = 'Please provide your full name:';
    } else if (!addressParts.phone) {
      session.state = 'awaiting_address_phone';
      prompt = 'Please provide your phone number:';
    } else if (!addressParts.address) {
      session.state = 'awaiting_address_line';
      prompt = 'Please provide your address (street, area):';
    } else if (!addressParts.city) {
      session.state = 'awaiting_city';
      prompt = 'Please provide your city:';
    } else if (!addressParts.state) {
      session.state = 'awaiting_state';
      prompt = 'Please provide your state:';
    } else if (!addressParts.pincode) {
      session.state = 'awaiting_pincode';
      prompt = 'Please provide your PIN code:';
    }

    session.lastActivity = new Date();

    return {
      messages: [
        {
          type: 'text',
          to: phone,
          body: prompt,
        },
      ],
    };
  }

  private async handleSelectDelivery(phone: string, session: UserSession, entities: MessageEntities): Promise<HandlerResponse> {
    if (!session.checkoutId) {
      return this.createErrorResponse(phone, 'No active checkout. Start checkout first.');
    }

    const deliveryType = entities.deliveryType || 'home_delivery';

    const result = await checkoutService.selectDeliveryOption(session.checkoutId, {
      type: deliveryType,
    });

    if (!result.success) {
      return this.createErrorResponse(phone, result.error || 'Failed to select delivery option');
    }

    session.state = 'checkout_payment';
    session.lastActivity = new Date();

    const paymentOptions = `Payment Options:\n\n💳 Pay with UPI\n💳 Pay with Card\n💰 Pay with Wallet\n💵 Cash on Delivery`;

    return {
      messages: [
        {
          type: 'text',
          to: phone,
          body: `Delivery: ${deliveryType === 'home_delivery' ? 'Home Delivery' : deliveryType === 'store_pickup' ? 'Store Pickup' : 'Instant'}\n\n${paymentOptions}\n\nReply with your preferred payment method.`,
        },
      ],
      stateUpdate: {
        checkoutStep: 'payment',
      },
    };
  }

  private async handleMakePayment(phone: string, session: UserSession): Promise<HandlerResponse> {
    if (!session.checkoutId) {
      return this.createErrorResponse(phone, 'No active checkout. Start checkout first.');
    }

    const checkout = await checkoutService.getCheckout(session.checkoutId);
    if (!checkout) {
      return this.createErrorResponse(phone, 'Checkout expired. Please start again.');
    }

    const paymentResult = await paymentService.createPayment({
      orderId: session.checkoutId,
      amount: checkout.totalAmount,
      currency: checkout.currency,
      customerPhone: phone,
    });

    if (!paymentResult.success || !paymentResult.payment) {
      return this.createErrorResponse(phone, paymentResult.error || 'Failed to create payment');
    }

    session.lastActivity = new Date();

    const upiLink = await paymentService.processUPIIntent(phone, checkout.totalAmount, checkout.checkoutId);

    return {
      messages: [
        {
          type: 'text',
          to: phone,
          body: `💳 Payment Required\n\nAmount: ${checkout.currency} ${checkout.totalAmount}\n\nClick below to pay via UPI:\n${upiLink.upiLink || 'Payment link generation failed'}\n\nOr use this QR code to pay.`,
        },
      ],
    };
  }

  private async handleViewOrders(phone: string, session: UserSession): Promise<HandlerResponse> {
    const orders = await orderService.getOrderByPhone(phone, 5);

    if (orders.length === 0) {
      return {
        messages: [
          {
            type: 'text',
            to: phone,
            body: "You haven't placed any orders yet.\n\nStart shopping and your orders will appear here! 🛍️",
          },
        ],
      };
    }

    let message = '📦 Your Recent Orders:\n\n';

    orders.forEach((order, idx) => {
      const date = new Date(order.createdAt).toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });

      message += `${idx + 1}. ${order.orderId}\n`;
      message += `   ${order.items.length} item(s) | ${order.currency} ${order.totalAmount}\n`;
      message += `   Status: ${order.status}\n`;
      message += `   ${date}\n\n`;
    });

    message += '\nReply with "Track [order ID]" for details.';

    session.lastActivity = new Date();

    return {
      messages: [
        {
          type: 'text',
          to: phone,
          body: message,
        },
      ],
    };
  }

  private async handleTrackOrder(phone: string, session: UserSession, entities: MessageEntities): Promise<HandlerResponse> {
    let order;

    if (entities.orderId) {
      order = await orderService.getOrder(entities.orderId);
    } else {
      const orders = await orderService.getOrderByPhone(phone, 1);
      order = orders[0];
    }

    if (!order) {
      return this.createErrorResponse(phone, 'Order not found. Please check the order ID.');
    }

    session.lastActivity = new Date();

    const statusEmoji: Record<string, string> = {
      pending: '⏳',
      confirmed: '✅',
      processing: '🔄',
      shipped: '🚚',
      out_for_delivery: '📦',
      delivered: '🎉',
      cancelled: '❌',
      refunded: '💰',
    };

    const emoji = statusEmoji[order.status] || '📋';

    return {
      messages: [
        {
          type: 'text',
          to: phone,
          body: `📦 Order: ${order.orderId}\n\n${emoji} Status: ${order.status.toUpperCase()}\n\n💰 Total: ${order.currency} ${order.totalAmount}\n🛍️ Items: ${order.items.reduce((sum, i) => sum + i.quantity, 0)}\n\n${order.estimatedDelivery ? `📅 Expected: ${new Date(order.estimatedDelivery).toLocaleDateString('en-IN')}` : ''}\n\nWe\'ll notify you of any updates!`,
        },
      ],
    };
  }

  private async handleCancelOrder(phone: string, session: UserSession, entities: MessageEntities): Promise<HandlerResponse> {
    let order;

    if (entities.orderId) {
      order = await orderService.getOrder(entities.orderId);
    } else {
      const orders = await orderService.getOrderByPhone(phone, 1);
      order = orders[0];
    }

    if (!order) {
      return this.createErrorResponse(phone, 'Order not found.');
    }

    if (['delivered', 'cancelled', 'refunded'].includes(order.status)) {
      return this.createErrorResponse(phone, `Cannot cancel order in "${order.status}" status.`);
    }

    const result = await orderService.cancelOrder(order.orderId, 'Cancelled by customer via WhatsApp');

    session.lastActivity = new Date();

    if (result.success) {
      return {
        messages: [
          {
            type: 'text',
            to: phone,
            body: `✅ Order ${order.orderId} has been cancelled.\n\nRefunds (if applicable) will be processed within 5-7 business days.`,
          },
        ],
      };
    }

    return this.createErrorResponse(phone, result.error || 'Failed to cancel order');
  }

  private async handleHelp(phone: string): Promise<HandlerResponse> {
    const helpText = `🆘 Help & Support\n\nHere are things you can do:\n\n🛍️ *Shop*\n• Type "Shop" or "Browse" to see products\n• "Add [product name]" to add to cart\n\n🛒 *Cart*\n• "Cart" - View your cart\n• "Update [qty] [product]" - Change quantity\n• "Remove [product]" - Remove item\n• "Clear Cart" - Empty your cart\n\n💳 *Checkout*\n• "Checkout" - Start ordering\n• Provide address when asked\n• Choose delivery option\n• Select payment method\n\n📦 *Orders*\n• "Orders" - View order history\n• "Track [order ID]" - Check status\n• "Cancel [order ID]" - Cancel order\n\nNeed more help? Contact our support team!`;

    return {
      messages: [
        {
          type: 'text',
          to: phone,
          body: helpText,
        },
      ],
    };
  }

  private async handleUnknown(phone: string, session: UserSession): Promise<HandlerResponse> {
    const unknownResponses = [
      "I'm not sure I understand. Type 'Help' for available commands.",
      "Hmm, I didn't get that. Try browsing products or checking your cart.",
      "That's not something I can help with right now. Try 'Help' for options.",
    ];

    return {
      messages: [
        {
          type: 'text',
          to: phone,
          body: unknownResponses[Math.floor(Math.random() * unknownResponses.length)],
        },
      ],
    };
  }

  private createErrorResponse(phone: string, errorMessage: string): HandlerResponse {
    return {
      messages: [
        {
          type: 'text',
          to: phone,
          body: `❌ ${errorMessage}`,
        },
      ],
    };
  }

  clearSession(phoneNumber: string): void {
    this.userSessions.delete(phoneNumber);
  }

  getSession(phoneNumber: string): UserSession | undefined {
    return this.userSessions.get(phoneNumber);
  }
}

interface UserSession {
  phoneNumber: string;
  state: string;
  lastActivity: Date;
  checkoutId?: string;
  currentProductId?: string;
  selectedCategory?: string;
}

export const messageHandler = MessageHandler.getInstance();
export default messageHandler;
