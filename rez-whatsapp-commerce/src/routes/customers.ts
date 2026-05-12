import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { CustomerSession, SessionState, Intent } from '../models/CustomerSession';
import { cartService } from '../services/cartService';
import { orderService } from '../services/orderService';
import {
  authenticateCustomer,
  verifyTwilioWebhook,
  extractTwilioCustomerInfo,
  generateCustomerToken,
  validateWhatsAppPhone,
} from '../middleware/auth';
import { catalogService } from '../services/catalogService';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// Validation schemas
const sendMessageSchema = z.object({
  to: z.string().min(1),
  message: z.string().min(1).max(4096),
  type: z.enum(['TEXT', 'IMAGE', 'INTERACTIVE']).default('TEXT'),
});

const updateStateSchema = z.object({
  state: z.enum([
    'INIT', 'BROWSE', 'SEARCH', 'VIEW_PRODUCT', 'ADD_TO_CART',
    'VIEW_CART', 'CHECKOUT', 'SELECT_ADDRESS', 'SELECT_PAYMENT',
    'ORDER_CONFIRMATION', 'TRACK_ORDER', 'HELP', 'END',
  ]),
  intent: z.enum([
    'BROWSE_CATALOG', 'SEARCH_PRODUCTS', 'VIEW_PRODUCT', 'ADD_TO_CART',
    'UPDATE_CART', 'REMOVE_FROM_CART', 'VIEW_CART', 'CHECKOUT',
    'SELECT_ADDRESS', 'SELECT_PAYMENT_METHOD', 'PAY', 'CONFIRM_ORDER',
    'VIEW_ORDERS', 'TRACK_ORDER', 'CANCEL_ORDER', 'RETURN_ORDER',
    'CONTACT_SUPPORT', 'EXIT',
  ]).optional(),
});

// Twilio client
const twilioClient = require('twilio')(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

const WHATSAPP_PHONE_NUMBER = process.env.TWILIO_WHATSAPP_PHONE_NUMBER;

/**
 * POST /api/customers/webhook
 * Handle incoming WhatsApp messages from Twilio
 */
router.post(
  '/webhook',
  verifyTwilioWebhook,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { From, Body, MessageSid, NumMedia } = req.body;

      // Extract customer info
      const { phone: customerPhone, waId } = extractTwilioCustomerInfo(From);

      // Get merchant ID from request (would be determined by business account)
      const merchantId = 'default'; // In production, map WhatsApp number to merchant

      // Create or update session
      const session = await CustomerSession.findOrCreate(
        waId, // Using waId as customerId
        customerPhone,
        merchantId,
        WHATSAPP_PHONE_NUMBER || ''
      );

      // Parse incoming message
      const message = Body ? Body.trim().toLowerCase() : '';

      // Determine intent from message
      const intent = parseMessageIntent(message);
      const state = determineStateFromIntent(intent);

      // Update session
      session.intent = intent;
      session.previousIntent = session.intent;
      session.state = state;
      session.previousState = session.state;
      session.addToRecentViews([]);
      await session.save();

      // Add inbound message
      session.addMessage({
        messageId: MessageSid,
        direction: 'INBOUND',
        content: Body || '',
        type: NumMedia > 0 ? 'IMAGE' : 'TEXT',
        whatsappMessageId: MessageSid,
      });

      // Process message and generate response
      const response = await processCustomerMessage(session, message);

      // Send response via Twilio
      if (response.messages.length > 0) {
        for (const msg of response.messages) {
          await sendWhatsAppMessage(customerPhone, msg.content, msg.type);
        }

        // Add outbound messages to session
        for (const msg of response.messages) {
          session.addMessage({
            messageId: uuidv4(),
            direction: 'OUTBOUND',
            content: msg.content,
            type: msg.type as 'TEXT' | 'IMAGE' | 'INTERACTIVE',
          });
        }
      }

      await session.save();

      // Return TwiML response
      res.type('text/xml').send('<Response></Response>');
    } catch (error) {
      console.error('Webhook error:', error);
      // Always return 200 to Twilio to prevent retries
      res.type('text/xml').send('<Response></Response>');
    }
  }
);

/**
 * GET /api/customers/webhook
 * Verify Twilio webhook
 */
router.get(
  '/webhook',
  (req: Request, res: Response): void => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    const verifyToken = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN;

    if (mode === 'subscribe' && token === verifyToken) {
      console.log('Webhook verified');
      res.status(200).send(challenge);
    } else {
      res.status(403).send('Forbidden');
    }
  }
);

/**
 * GET /api/customers/session
 * Get current session for customer
 */
router.get(
  '/session',
  authenticateCustomer,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const session = await CustomerSession.findOne({
        customerId: req.customerId,
        merchantId: req.merchantId,
        isActive: true,
      });

      if (!session) {
        res.status(404).json({
          success: false,
          error: 'No active session found',
        });
        return;
      }

      res.json({
        success: true,
        data: {
          sessionId: session.sessionId,
          state: session.state,
          intent: session.intent,
          context: session.context,
          lastActivityAt: session.lastActivityAt,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PUT /api/customers/session/state
 * Update session state
 */
router.put(
  '/session/state',
  authenticateCustomer,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const bodyResult = updateStateSchema.safeParse(req.body);

      if (!bodyResult.success) {
        res.status(400).json({
          success: false,
          error: 'Invalid request body',
          details: bodyResult.error.issues,
        });
        return;
      }

      const session = await CustomerSession.findOne({
        customerId: req.customerId,
        merchantId: req.merchantId,
        isActive: true,
      });

      if (!session) {
        res.status(404).json({
          success: false,
          error: 'No active session found',
        });
        return;
      }

      session.transitionState(bodyResult.data.state, bodyResult.data.intent);
      await session.save();

      res.json({
        success: true,
        data: {
          sessionId: session.sessionId,
          state: session.state,
          intent: session.intent,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/customers/session/reset
 * Reset session to initial state
 */
router.post(
  '/session/reset',
  authenticateCustomer,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const session = await CustomerSession.findOne({
        customerId: req.customerId,
        merchantId: req.merchantId,
        isActive: true,
      });

      if (!session) {
        res.status(404).json({
          success: false,
          error: 'No active session found',
        });
        return;
      }

      session.reset();
      await session.save();

      res.json({
        success: true,
        message: 'Session reset successfully',
        data: {
          sessionId: session.sessionId,
          state: session.state,
          intent: session.intent,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/customers/cart
 * Get customer's cart
 */
router.get(
  '/cart',
  authenticateCustomer,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const cart = await cartService.getCart(req.customerId!, req.merchantId!);

      if (!cart) {
        res.json({
          success: true,
          data: {
            items: [],
            subtotal: 0,
            total: 0,
          },
        });
        return;
      }

      res.json({
        success: true,
        data: {
          cartId: cart.cartId,
          items: cart.items,
          subtotal: cart.subtotal,
          tax: cart.tax,
          discount: cart.discount,
          deliveryFee: cart.deliveryFee,
          total: cart.total,
          itemCount: cart.items.reduce((sum, item) => sum + item.quantity, 0),
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/customers/orders
 * Get customer's orders
 */
router.get(
  '/orders',
  authenticateCustomer,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;

      const result = await orderService.getOrdersForCustomer(
        req.customerId!,
        req.merchantId!,
        { page, limit }
      );

      res.json({
        success: true,
        data: result.data.map((order) => ({
          orderId: order.orderId,
          orderNumber: order.orderNumber,
          status: order.status,
          paymentStatus: order.paymentStatus,
          total: order.total,
          itemCount: order.items.length,
          createdAt: order.createdAt,
        })),
        pagination: result.pagination,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/customers/token
 * Generate auth token for customer
 */
router.post(
  '/token',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const customerId = req.body.customerId;
      const customerPhone = req.body.customerPhone;
      const merchantId = req.body.merchantId || 'default';

      if (!customerId || !customerPhone) {
        res.status(400).json({
          success: false,
          error: 'customerId and customerPhone are required',
        });
        return;
      }

      // Get or create session
      const session = await CustomerSession.findOrCreate(
        customerId,
        validateWhatsAppPhone(customerPhone),
        merchantId,
        WHATSAPP_PHONE_NUMBER || ''
      );

      // Generate token
      const token = generateCustomerToken({
        customerId,
        customerPhone: validateWhatsAppPhone(customerPhone),
        merchantId,
        sessionId: session.sessionId,
      });

      res.json({
        success: true,
        data: {
          token,
          sessionId: session.sessionId,
          expiresIn: '24h',
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/customers/send-message
 * Send WhatsApp message to customer (internal service only)
 */
router.post(
  '/send-message',
  authenticateInternalService,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const bodyResult = sendMessageSchema.safeParse(req.body);

      if (!bodyResult.success) {
        res.status(400).json({
          success: false,
          error: 'Invalid request body',
          details: bodyResult.error.issues,
        });
        return;
      }

      await sendWhatsAppMessage(
        validateWhatsAppPhone(bodyResult.data.to),
        bodyResult.data.message,
        bodyResult.data.type
      );

      res.json({
        success: true,
        message: 'Message sent',
      });
    } catch (error) {
      next(error);
    }
  }
);

// Helper functions

function parseMessageIntent(message: string): Intent {
  const lowerMessage = message.toLowerCase().trim();

  if (lowerMessage.includes('cart') || lowerMessage.includes('basket')) {
    return 'VIEW_CART';
  }
  if (lowerMessage.includes('order') && (lowerMessage.includes('track') || lowerMessage.includes('status'))) {
    return 'TRACK_ORDER';
  }
  if (lowerMessage.includes('order')) {
    return 'VIEW_ORDERS';
  }
  if (lowerMessage.includes('cancel')) {
    return 'CANCEL_ORDER';
  }
  if (lowerMessage.includes('help') || lowerMessage.includes('support')) {
    return 'CONTACT_SUPPORT';
  }
  if (lowerMessage.includes('search') || lowerMessage.includes('find')) {
    return 'SEARCH_PRODUCTS';
  }
  if (lowerMessage.includes('buy') || lowerMessage.includes('checkout') || lowerMessage.includes('order now')) {
    return 'CHECKOUT';
  }
  if (lowerMessage.includes('add')) {
    return 'ADD_TO_CART';
  }
  if (lowerMessage.includes('catalog') || lowerMessage.includes('shop') || lowerMessage.includes('browse')) {
    return 'BROWSE_CATALOG';
  }

  return 'BROWSE_CATALOG';
}

function determineStateFromIntent(intent: Intent): SessionState {
  const stateMap: Partial<Record<Intent, SessionState>> = {
    VIEW_CART: 'VIEW_CART',
    CHECKOUT: 'CHECKOUT',
    SELECT_ADDRESS: 'SELECT_ADDRESS',
    SELECT_PAYMENT_METHOD: 'SELECT_PAYMENT',
    PAY: 'SELECT_PAYMENT',
    CONFIRM_ORDER: 'ORDER_CONFIRMATION',
    VIEW_ORDERS: 'TRACK_ORDER',
    TRACK_ORDER: 'TRACK_ORDER',
    CANCEL_ORDER: 'TRACK_ORDER',
    CONTACT_SUPPORT: 'HELP',
    SEARCH_PRODUCTS: 'SEARCH',
    ADD_TO_CART: 'ADD_TO_CART',
    BROWSE_CATALOG: 'BROWSE',
  };

  return stateMap[intent] || 'BROWSE';
}

interface ProcessResponse {
  messages: Array<{ content: string; type: 'TEXT' | 'IMAGE' | 'INTERACTIVE' }>;
}

async function processCustomerMessage(
  session: InstanceType<typeof CustomerSession>,
  message: string
): Promise<ProcessResponse> {
  const intent = session.intent;
  const merchantId = session.merchantId;

  switch (intent) {
    case 'BROWSE_CATALOG': {
      const products = await catalogService.getFeaturedProducts(merchantId, 5);
      if (products.length === 0) {
        return {
          messages: [{
            content: 'Welcome! Our catalog is currently empty. Please check back later.',
            type: 'TEXT',
          }],
        };
      }

      const productList = products
        .map((p, i) => `${i + 1}. ${p.name} - Rs. ${p.basePrice}`)
        .join('\n');

      return {
        messages: [{
          content: `Welcome to our store! Here are some featured products:\n\n${productList}\n\nReply with product number to view details, or type "search" to find specific items.`,
          type: 'TEXT',
        }],
      };
    }

    case 'SEARCH_PRODUCTS': {
      if (message.length < 3) {
        return {
          messages: [{
            content: 'Please provide a search term (at least 3 characters).',
            type: 'TEXT',
          }],
        };
      }

      const result = await catalogService.searchProducts(merchantId, message, { limit: 5 });

      if (result.data.length === 0) {
        return {
          messages: [{
            content: `No products found for "${message}". Try a different search term.`,
            type: 'TEXT',
          }],
        };
      }

      const productList = result.data
        .map((p, i) => `${i + 1}. ${p.name} - Rs. ${p.basePrice}`)
        .join('\n');

      return {
        messages: [{
          content: `Found ${result.pagination.total} products:\n\n${productList}\n\nReply with product number to view details.`,
          type: 'TEXT',
        }],
      };
    }

    case 'VIEW_CART': {
      const cart = await cartService.getCart(session.customerId, merchantId);

      if (!cart || cart.items.length === 0) {
        return {
          messages: [{
            content: 'Your cart is empty. Browse our catalog to add items!',
            type: 'TEXT',
          }],
        };
      }

      const itemList = cart.items
        .map((item, i) => `${i + 1}. ${item.name} x${item.quantity} - Rs. ${item.totalPrice}`)
        .join('\n');

      return {
        messages: [{
          content: `Your Cart:\n\n${itemList}\n\nSubtotal: Rs. ${cart.subtotal}\nTotal: Rs. ${cart.total}\n\nReply "checkout" to place order or "add" to continue shopping.`,
          type: 'TEXT',
        }],
      };
    }

    case 'VIEW_ORDERS': {
      const result = await orderService.getOrdersForCustomer(session.customerId, merchantId, { limit: 5 });

      if (result.data.length === 0) {
        return {
          messages: [{
            content: 'You have no orders yet. Browse our catalog to start shopping!',
            type: 'TEXT',
          }],
        };
      }

      const orderList = result.data
        .map((o) => `${o.orderNumber} - ${o.status} - Rs. ${o.total}`)
        .join('\n');

      return {
        messages: [{
          content: `Your Orders:\n\n${orderList}\n\nReply with order number for details.`,
          type: 'TEXT',
        }],
      };
    }

    case 'TRACK_ORDER': {
      const latestOrders = await orderService.getOrdersForCustomer(session.customerId, merchantId, { limit: 1 });

      if (latestOrders.data.length === 0) {
        return {
          messages: [{
            content: 'You have no orders to track.',
            type: 'TEXT',
          }],
        };
      }

      const order = latestOrders.data[0];
      const statusMessages: Record<string, string> = {
        PENDING: 'Your order is being processed.',
        CONFIRMED: 'Your order has been confirmed and is being prepared.',
        PROCESSING: 'Your order is being prepared for shipment.',
        SHIPPED: 'Your order has been shipped.',
        OUT_FOR_DELIVERY: 'Your order is out for delivery!',
        DELIVERED: 'Your order has been delivered.',
        CANCELLED: 'Your order has been cancelled.',
      };

      return {
        messages: [{
          content: `Order ${order.orderNumber}:\n\nStatus: ${statusMessages[order.status] || order.status}\nTotal: Rs. ${order.total}\n\nThank you for shopping with us!`,
          type: 'TEXT',
        }],
      };
    }

    case 'CONTACT_SUPPORT': {
      return {
        messages: [{
          content: 'Our support team is here to help! Please email us at support@example.com or call +91-XXXXX-XXXXX.\n\nFor urgent matters, reply with your order number.',
          type: 'TEXT',
        }],
      };
    }

    default: {
      return {
        messages: [{
          content: 'I did not understand that. Type "catalog" to browse products, "cart" to view your cart, or "help" for support.',
          type: 'TEXT',
        }],
      };
    }
  }
}

async function sendWhatsAppMessage(
  to: string,
  message: string,
  type: 'TEXT' | 'IMAGE' | 'INTERACTIVE'
): Promise<void> {
  if (!WHATSAPP_PHONE_NUMBER) {
    console.log(`Would send WhatsApp message to ${to}: ${message}`);
    return;
  }

  try {
    await twilioClient.messages.create({
      from: `whatsapp:${WHATSAPP_PHONE_NUMBER}`,
      to: `whatsapp:${to}`,
      body: message,
    });
  } catch (error) {
    console.error('Failed to send WhatsApp message:', error);
    throw error;
  }
}

export default router;
