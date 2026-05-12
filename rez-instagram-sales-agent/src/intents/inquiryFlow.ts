import { logger } from '../config/logger';
import { productDiscoveryService, Product } from '../services/productDiscovery';
import { linkService } from '../services/linkService';

export interface InquiryFlowState {
  userId: string;
  stage: InquiryStage;
  productId?: string;
  product?: Product;
  questions: string[];
  answers: Record<string, string>;
  preferences: string[];
  createdAt: Date;
  lastInteraction: Date;
}

export type InquiryStage =
  | 'started'
  | 'product_identified'
  | 'collecting_requirements'
  | 'presenting_options'
  | 'finalizing'
  | 'completed';

export interface InquiryResponse {
  message: string;
  quickReplies?: string[];
  products?: Product[];
  product?: Product;
  links?: string[];
  stage: InquiryStage;
  isComplete: boolean;
}

export class InquiryFlow {
  private activeFlows: Map<string, InquiryFlowState> = new Map();

  startFlow(userId: string): InquiryFlowState {
    const state: InquiryFlowState = {
      userId,
      stage: 'started',
      questions: [],
      answers: {},
      preferences: [],
      createdAt: new Date(),
      lastInteraction: new Date()
    };

    this.activeFlows.set(userId, state);
    logger.info('Inquiry flow started', { userId });

    return state;
  }

  getFlow(userId: string): InquiryFlowState | undefined {
    const flow = this.activeFlows.get(userId);
    if (flow) {
      flow.lastInteraction = new Date();
    }
    return flow;
  }

  processInquiry(
    userId: string,
    message: string,
    context?: { detectedProduct?: string; detectedCategory?: string }
  ): InquiryResponse {
    let flow = this.activeFlows.get(userId);

    if (!flow) {
      flow = this.startFlow(userId);
    }

    // Parse the inquiry
    const parsedMessage = this.parseInquiryMessage(message);

    switch (flow.stage) {
      case 'started':
        return this.handleStarted(flow, parsedMessage, context);
      case 'product_identified':
        return this.handleProductIdentified(flow, parsedMessage);
      case 'collecting_requirements':
        return this.handleCollectingRequirements(flow, parsedMessage);
      case 'presenting_options':
        return this.handlePresentingOptions(flow, parsedMessage);
      case 'finalizing':
        return this.handleFinalizing(flow, parsedMessage);
      default:
        return this.handleCompleted(flow);
    }
  }

  private parseInquiryMessage(message: string): {
    intent: 'identify' | 'specify' | 'browse' | 'compare' | 'confirm' | 'cancel';
    keywords: string[];
    budget?: { min: number; max: number };
    style?: string;
    occasion?: string;
  } {
    const lowerMessage = message.toLowerCase();

    let intent: InquiryResponse['stage'] extends string ? 'identify' | 'specify' | 'browse' | 'compare' | 'confirm' | 'cancel' : never = 'identify';

    if (/show me|browse|what do you have|all|list/i.test(lowerMessage)) {
      intent = 'browse';
    } else if (/prefer|preference|like|want|looking for/i.test(lowerMessage)) {
      intent = 'specify';
    } else if (/compare|difference|better/i.test(lowerMessage)) {
      intent = 'compare';
    } else if (/yes|yeah|sure|that('s| is) it|perfect/i.test(lowerMessage)) {
      intent = 'confirm';
    } else if (/cancel|nevermind|nope|not interested/i.test(lowerMessage)) {
      intent = 'cancel';
    }

    // Extract budget
    const budgetRegex = /\$?\d+\s*-\s*\$?\d+|\$\d+|\d+\s*(dollars?|bucks?)/gi;
    const budgetMatches = message.match(budgetRegex);
    let budget: { min: number; max: number } | undefined;

    if (budgetMatches && budgetMatches.length >= 2) {
      const nums = budgetMatches.map(m => parseInt(m.replace(/\D/g, '')));
      budget = { min: Math.min(...nums), max: Math.max(...nums) };
    } else if (budgetMatches && budgetMatches.length === 1) {
      const num = parseInt(budgetMatches[0].replace(/\D/g, ''));
      budget = { min: 0, max: num };
    }

    // Extract style preferences
    const styleKeywords = ['casual', 'formal', 'elegant', 'sporty', 'boho', 'minimalist', 'vintage', 'modern', 'classic'];
    const style = styleKeywords.find(s => lowerMessage.includes(s));

    // Extract occasions
    const occasionKeywords = ['work', 'party', 'wedding', 'beach', 'office', 'date', 'everyday', 'gym', 'casual'];
    const occasion = occasionKeywords.find(o => lowerMessage.includes(o));

    return {
      intent,
      keywords: lowerMessage.split(/\s+/).filter(w => w.length > 2),
      budget,
      style,
      occasion
    };
  }

  private handleStarted(
    flow: InquiryFlowState,
    parsed: ReturnType<InquiryFlow['parseInquiryMessage']>,
    context?: { detectedProduct?: string; detectedCategory?: string }
  ): InquiryResponse {
    // Try to identify product from message or context
    if (parsed.intent === 'browse') {
      // User wants to browse - skip product identification
      flow.stage = 'collecting_requirements';
      return {
        message: 'Sure! What are you looking for? Tell me about your style or any specific product you have in mind.',
        quickReplies: ['Dresses', 'Tops', 'Accessories', 'Show me everything'],
        stage: flow.stage,
        isComplete: false
      };
    }

    // Search for products based on message
    const products = productDiscoveryService.searchProducts(flow.questions.join(' ') + ' ' + parsed.keywords.join(' '));

    if (products.length === 1) {
      flow.product = products[0];
      flow.productId = products[0].id;
      flow.stage = 'product_identified';

      return {
        message: `Found it! Are you asking about the ${products[0].name}? It\'s $${products[0].price.toFixed(2)} and ${products[0].inStock ? 'in stock' : 'currently out of stock'}.`,
        product: products[0],
        quickReplies: ['Yes, tell me more!', 'What about sizing?', 'Show me similar items'],
        stage: flow.stage,
        isComplete: false
      };
    }

    if (products.length > 1) {
      flow.stage = 'presenting_options';
      return {
        message: `Found ${products.length} products that might match! Here are the top picks:`,
        products: products.slice(0, 3),
        quickReplies: ['Show me more', 'Filter by price', 'I\'m interested in #1'],
        stage: flow.stage,
        isComplete: false
      };
    }

    // No products found - ask for more info
    return {
      message: 'I\'d love to help! Can you tell me more about what you\'re looking for?',
      quickReplies: ['Just browsing', 'Something casual', 'A gift idea'],
      stage: flow.stage,
      isComplete: false
    };
  }

  private handleProductIdentified(
    flow: InquiryFlowState,
    parsed: ReturnType<InquiryFlow['parseInquiryMessage']>
  ): InquiryResponse {
    if (parsed.intent === 'confirm' && flow.product) {
      flow.stage = 'collecting_requirements';
      return {
        message: `Great! The ${flow.product.name} is a solid choice! What size do you need? And are you looking for any specific color?`,
        product: flow.product,
        quickReplies: ['Size S', 'Size M', 'Size L', 'What colors?'],
        stage: flow.stage,
        isComplete: false
      };
    }

    if (parsed.intent === 'browse') {
      // User wants to see other options
      flow.stage = 'presenting_options';
      return this.handlePresentingOptions(flow, parsed);
    }

    if (parsed.style || parsed.occasion) {
      flow.preferences.push(parsed.style || parsed.occasion || '');
      flow.stage = 'finalizing';
      return this.handleFinalizing(flow, parsed);
    }

    // Ask for clarification
    return {
      message: 'Want me to share more details about this product, or would you like to see similar options?',
      product: flow.product,
      quickReplies: ['More details', 'Show similar', 'Not this one'],
      stage: flow.stage,
      isComplete: false
    };
  }

  private handleCollectingRequirements(
    flow: InquiryFlowState,
    parsed: ReturnType<InquiryFlow['parseInquiryMessage']>
  ): InquiryResponse {
    // Store requirements
    if (parsed.style) flow.preferences.push(parsed.style);
    if (parsed.occasion) flow.preferences.push(parsed.occasion);
    if (parsed.budget) {
      flow.answers['budget'] = `$${parsed.budget.min}-$${parsed.budget.max}`;
    }

    // Find matching products
    const filters = {
      minPrice: parsed.budget?.min,
      maxPrice: parsed.budget?.max
    };

    const products = productDiscoveryService.searchProducts(
      flow.questions.join(' ') + ' ' + flow.preferences.join(' '),
      filters
    );

    if (products.length > 0) {
      flow.stage = 'presenting_options';
      return {
        message: `Found ${products.length} options that match what you\'re looking for! Here are my top picks:`,
        products: products.slice(0, 3),
        quickReplies: ['Show me all', 'More like #1', 'What\'s the price range?'],
        stage: flow.stage,
        isComplete: false
      };
    }

    // No matches - broaden search
    return {
      message: 'Let me check what we have available... Can you tell me your max budget?',
      quickReplies: ['Under $50', '$50-100', 'No limit'],
      stage: flow.stage,
      isComplete: false
    };
  }

  private handlePresentingOptions(
    flow: InquiryFlowState,
    parsed: ReturnType<InquiryFlow['parseInquiryMessage']>
  ): InquiryResponse {
    const products = flow.product
      ? productDiscoveryService.getRelatedProducts(flow.product.id)
      : productDiscoveryService.getFeaturedProducts(5);

    if (parsed.intent === 'confirm' && products.length > 0) {
      flow.product = products[0];
      flow.productId = products[0].id;
      flow.stage = 'finalizing';
      return this.handleFinalizing(flow, parsed);
    }

    return {
      message: 'Here are some great options for you:',
      products: products.slice(0, 5),
      quickReplies: ['I like #1', '#2 looks good', 'Show me the details'],
      stage: flow.stage,
      isComplete: false
    };
  }

  private handleFinalizing(
    flow: InquiryFlowState,
    parsed: ReturnType<InquiryFlow['parseInquiryMessage']>
  ): InquiryResponse {
    if (!flow.product) {
      return this.handleCompleted(flow);
    }

    const product = flow.product;
    const link = linkService.generateProductLink(product.id);

    if (parsed.intent === 'confirm') {
      const whatsappLink = linkService.generateWhatsAppLink({ productId: product.id });
      return {
        message: `Awesome choice! You can grab the ${product.name} here: ${link.shortCode}\n\nNeed help with checkout? I can send you to WhatsApp for a smooth experience!`,
        product,
        links: [link.url, whatsappLink.url],
        quickReplies: ['Continue on WhatsApp', 'I\'ll checkout here', 'One more question'],
        stage: 'completed',
        isComplete: true
      };
    }

    return {
      message: `Looking at ${product.name} - $${product.price.toFixed(2)}. Want to proceed or need more info?`,
      product,
      links: [link.url],
      quickReplies: ['Yes, get it!', 'Tell me more', 'Show me something else'],
      stage: flow.stage,
      isComplete: false
    };
  }

  private handleCompleted(flow: InquiryFlowState): InquiryResponse {
    return {
      message: 'Great chatting with you! Let me know if you have any other questions.',
      stage: 'completed',
      isComplete: true
    };
  }

  cancelFlow(userId: string): boolean {
    return this.activeFlows.delete(userId);
  }

  getActiveFlowCount(): number {
    return this.activeFlows.size;
  }
}

export const inquiryFlow = new InquiryFlow();
