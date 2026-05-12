import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { logger } from '../config/logger';
import { conversationService } from '../services/conversationService';
import { leadCaptureService } from '../services/leadCapture';
import { productDiscoveryService } from '../services/productDiscovery';
import { checkoutFlowService } from '../services/checkoutFlow';
import { carouselService } from '../services/carouselService';
import { linkService } from '../services/linkService';
import { instagramIntentClassifier } from '../intents/instagramIntents';
import { inquiryFlow } from '../intents/inquiryFlow';
import { purchaseFlow } from '../intents/purchaseFlow';
import { responseGenerator } from '../responses/templates';
import { QuickReplyGenerator } from '../responses/quickReplies';
import { CarouselFormatter } from '../responses/carousels';
import { followUpFlow } from '../intents/followUpFlow';

const router = Router();

// Validation schemas
const messageSchema = z.object({
  senderId: z.string(),
  recipientId: z.string(),
  message: z.object({
    mid: z.string().optional(),
    text: z.string().optional(),
    attachments: z.array(z.any()).optional()
  }),
  timestamp: z.string().optional(),
  source: z.enum(['dm', 'comment', 'story_reply']).optional()
});

const webhookSchema = z.object({
  object: z.string(),
  entry: z.array(z.object({
    id: z.string(),
    time: z.number(),
    messaging: z.array(z.object({
      sender: z.object({ id: z.string() }),
      recipient: z.object({ id: z.string() }),
      timestamp: z.number(),
      message: z.object({
        mid: z.string(),
        text: z.string().optional(),
        attachments: z.array(z.any()).optional()
      }).passthrough()
    })).optional()
  }))
});

// Middleware for validating requests
const validateBody = (schema: z.ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        logger.warn('Validation error', { errors: error.errors });
        res.status(400).json({ error: 'Validation failed', details: error.errors });
        return;
      }
      next(error);
    }
  };
};

// Send message endpoint
router.post('/send', validateBody(z.object({
  recipientId: z.string(),
  message: z.string(),
  quickReplies: z.array(z.string()).optional()
})), async (req: Request, res: Response) => {
  try {
    const { recipientId, message, quickReplies } = req.body;

    // In production, this would call Instagram API
    logger.info('Message sent', { recipientId, message: message.slice(0, 50) });

    res.json({
      success: true,
      recipientId,
      message,
      quickReplies
    });
  } catch (error) {
    logger.error('Failed to send message', { error });
    res.status(500).json({ error: 'Failed to send message' });
  }
});

// Send carousel endpoint
router.post('/carousel', validateBody(z.object({
  recipientId: z.string(),
  products: z.array(z.object({
    id: z.string(),
    name: z.string(),
    price: z.number(),
    image: z.string().optional(),
    description: z.string().optional()
  })),
  introText: z.string().optional()
})), async (req: Request, res: Response) => {
  try {
    const { recipientId, products, introText } = req.body;

    const carouselPayload = CarouselFormatter.formatProductCarousel(
      products.map(p => ({
        id: p.id,
        name: p.name,
        description: p.description || '',
        price: p.price,
        images: [p.image || ''],
        category: '',
        tags: [],
        inStock: true
      }))
    );

    // In production, this would call Instagram API
    logger.info('Carousel sent', { recipientId, productCount: products.length });

    res.json({
      success: true,
      recipientId,
      carouselPayload
    });
  } catch (error) {
    logger.error('Failed to send carousel', { error });
    res.status(500).json({ error: 'Failed to send carousel' });
  }
});

// Process incoming DM
router.post('/message', validateBody(messageSchema), async (req: Request, res: Response) => {
  try {
    const { senderId, message, source = 'dm' } = req.body;
    const messageText = message.text || '';

    logger.info('Incoming message', { senderId, message: messageText.slice(0, 50) });

    // Get or create conversation
    let conversation = conversationService.getConversationByUserId(senderId);
    if (!conversation) {
      conversation = conversationService.createConversation(senderId, {
        platform: 'instagram',
        source,
        username: senderId,
        isFollowing: true,
        isBusinessAccount: false
      });
    }

    // Add customer message
    conversationService.addMessage(conversation.conversationId, 'customer', messageText);

    // Classify intent
    const intentMatch = instagramIntentClassifier.classify(messageText, {
      conversationState: conversation.state
    });

    logger.debug('Intent classified', { intent: intentMatch.intent, confidence: intentMatch.confidence });

    // Generate response based on intent
    let response: { message: string; quickReplies?: string[] };
    let autoResponse: string;

    switch (intentMatch.intent) {
      case 'greeting':
        autoResponse = responseGenerator.generateResponse('greeting', {
          isReturning: conversation.messages.length > 2,
          userName: senderId
        }).message;
        break;

      case 'product_inquiry':
        const products = productDiscoveryService.searchProducts(messageText);
        if (products.length > 0) {
          autoResponse = `Found ${products.length} products! Let me show you the best match.`;
          // Would send carousel here
        } else {
          autoResponse = 'What are you looking for? Tell me more!';
        }
        conversationService.updateState(conversation.conversationId, 'inquiry');
        break;

      case 'purchase_intent':
        autoResponse = 'Great! Let\'s get you checked out. What product are you interested in?';
        conversationService.updateState(conversation.conversationId, 'purchase_intent');
        break;

      case 'price_inquiry':
        autoResponse = 'I can help with that! What product would you like to know the price for?';
        break;

      case 'thanks':
        autoResponse = responseGenerator.generateResponse('thanks').message;
        break;

      case 'goodbye':
        autoResponse = responseGenerator.generateResponse('goodbye').message;
        conversationService.updateState(conversation.conversationId, 'completed');
        break;

      default:
        autoResponse = 'I\'m here to help! What can I assist you with today?';
    }

    // Add agent response
    conversationService.addMessage(conversation.conversationId, 'agent', autoResponse, {
      intent: intentMatch.intent
    });

    // Get quick replies for context
    const quickReplies = QuickReplyGenerator.getForContext('general');

    res.json({
      success: true,
      response: {
        message: autoResponse,
        quickReplies: quickReplies.map(q => q.title)
      },
      metadata: {
        intent: intentMatch.intent,
        confidence: intentMatch.confidence,
        conversationId: conversation.conversationId
      }
    });
  } catch (error) {
    logger.error('Message processing failed', { error });
    res.status(500).json({ error: 'Failed to process message' });
  }
});

// Search products
router.get('/products', async (req: Request, res: Response) => {
  try {
    const { q, category, minPrice, maxPrice, sort } = req.query;

    const products = productDiscoveryService.searchProducts(
      (q as string) || '',
      {
        category: category as string,
        minPrice: minPrice ? parseFloat(minPrice as string) : undefined,
        maxPrice: maxPrice ? parseFloat(maxPrice as string) : undefined,
        sortBy: sort as 'price_asc' | 'price_desc' | 'newest' | 'popular'
      }
    );

    res.json({
      success: true,
      count: products.length,
      products: products.map(p => ({
        id: p.id,
        name: p.name,
        price: p.price,
        image: p.images[0],
        inStock: p.inStock,
        rating: p.rating
      }))
    });
  } catch (error) {
    logger.error('Product search failed', { error });
    res.status(500).json({ error: 'Failed to search products' });
  }
});

// Get product by ID
router.get('/products/:id', async (req: Request, res: Response) => {
  try {
    const product = productDiscoveryService.getProductById(req.params.id);

    if (!product) {
      res.status(404).json({ error: 'Product not found' });
      return;
    }

    res.json({
      success: true,
      product
    });
  } catch (error) {
    logger.error('Get product failed', { error });
    res.status(500).json({ error: 'Failed to get product' });
  }
});

// Create checkout session
router.post('/checkout', validateBody(z.object({
  userId: z.string(),
  items: z.array(z.object({
    productId: z.string(),
    quantity: z.number().min(1)
  }))
})), async (req: Request, res: Response) => {
  try {
    const { userId, items } = req.body;

    // Build cart items
    const cartItems = items.map(item => {
      const product = productDiscoveryService.getProductById(item.productId);
      if (!product) {
        throw new Error(`Product not found: ${item.productId}`);
      }

      return {
        productId: product.id,
        productName: product.name,
        quantity: item.quantity,
        price: product.price,
        image: product.images[0]
      };
    });

    const session = checkoutFlowService.createSession(userId, cartItems);

    res.json({
      success: true,
      session: {
        id: session.id,
        items: session.items,
        subtotal: session.subtotal,
        shipping: session.shipping,
        tax: session.tax,
        total: session.total,
        expiresAt: session.expiresAt
      },
      checkoutUrl: linkService.generateCheckoutLink(session.id).url,
      whatsappUrl: checkoutFlowService.initiateWhatsAppHandoff(session.id)
    });
  } catch (error) {
    logger.error('Checkout creation failed', { error });
    res.status(500).json({ error: 'Failed to create checkout session' });
  }
});

// Capture lead
router.post('/leads', validateBody(z.object({
  instagramId: z.string(),
  username: z.string(),
  displayName: z.string(),
  source: z.enum(['dm', 'comment', 'story_mention', 'story_reply']),
  profilePicture: z.string().optional(),
  interests: z.array(z.string()).optional(),
  email: z.string().email().optional(),
  phone: z.string().optional()
})), async (req: Request, res: Response) => {
  try {
    const lead = leadCaptureService.createLead(
      req.body.instagramId,
      req.body.username,
      req.body.displayName,
      req.body.source,
      req.body.profilePicture
    );

    if (req.body.email) {
      leadCaptureService.updateContactInfo(lead.id, { email: req.body.email });
    }
    if (req.body.phone) {
      leadCaptureService.updateContactInfo(lead.id, { phone: req.body.phone });
    }
    if (req.body.interests) {
      req.body.interests.forEach((interest: string) => {
        leadCaptureService.addInterest(lead.id, interest);
      });
    }

    res.json({
      success: true,
      lead: {
        id: lead.id,
        instagramId: lead.instagramId,
        status: lead.status
      }
    });
  } catch (error) {
    logger.error('Lead capture failed', { error });
    res.status(500).json({ error: 'Failed to capture lead' });
  }
});

// Get lead stats
router.get('/leads/stats', async (req: Request, res: Response) => {
  try {
    const stats = leadCaptureService.getStats();
    res.json({ success: true, stats });
  } catch (error) {
    logger.error('Get lead stats failed', { error });
    res.status(500).json({ error: 'Failed to get lead stats' });
  }
});

// Generate link
router.post('/links', validateBody(z.object({
  type: z.enum(['product', 'collection', 'checkout', 'whatsapp']),
  id: z.string().optional(),
  message: z.string().optional()
})), async (req: Request, res: Response) => {
  try {
    const { type, id, message } = req.body;

    let link;
    switch (type) {
      case 'product':
        link = linkService.generateProductLink(id!);
        break;
      case 'collection':
        link = linkService.generateCollectionLink(id!);
        break;
      case 'checkout':
        link = linkService.generateCheckoutLink(id!);
        break;
      case 'whatsapp':
        link = linkService.generateWhatsAppLink({ productId: id, message });
        break;
    }

    res.json({
      success: true,
      link: link?.url,
      shortCode: link?.shortCode
    });
  } catch (error) {
    logger.error('Link generation failed', { error });
    res.status(500).json({ error: 'Failed to generate link' });
  }
});

// Health check for routes
router.get('/status', (req: Request, res: Response) => {
  res.json({
    service: 'instagram-sales-agent',
    status: 'operational',
    activeConversations: conversationService.getActiveConversationCount(),
    activeLeads: leadCaptureService.getStats().total,
    timestamp: new Date().toISOString()
  });
});

// Error handling middleware
router.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  logger.error('Route error', { error: err.message, path: req.path });
  res.status(500).json({ error: 'Internal server error' });
});

export { router as instagramRouter };
