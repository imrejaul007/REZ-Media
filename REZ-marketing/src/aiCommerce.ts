/**
 * WhatsApp AI Commerce Integration
 *
 * Enables AI-powered commerce through WhatsApp with:
 * - Intent parsing from natural language
 * - Product suggestions and order flow
 * - Payment link generation
 * - Campaign attribution tracking
 */

import { v4 as uuidv4 } from 'uuid';

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

export interface WhatsAppCommerceMessage {
  from: string;
  messageId: string;
  text: string;
  timestamp: Date;
  campaignId?: string;
}

export interface CommerceIntent {
  type: 'order' | 'browse' | 'offer' | 'support' | 'general';
  entities: {
    product?: string;
    category?: string;
    merchant?: string;
    quantity?: number;
    priceRange?: string;
  };
  confidence: number;
}

export interface CommerceResponse {
  type: 'product_list' | 'order_confirm' | 'payment_link' | 'offer' | 'support';
  message: string;
  products?: Product[];
  orderId?: string;
  paymentUrl?: string;
  attribution: {
    campaignId?: string;
    merchantId?: string;
    channel: 'whatsapp';
  };
}

export interface Product {
  id: string;
  name: string;
  merchantId: string;
  price: number;
  image?: string;
  coins?: number;
}

export interface Order {
  id: string;
  userId: string;
  items: OrderItem[];
  total: number;
  status: 'pending' | 'confirmed' | 'paid' | 'shipped' | 'delivered' | 'cancelled';
  paymentUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface OrderItem {
  product: Product;
  quantity: number;
  subtotal: number;
}

export interface Cart {
  userId: string;
  items: OrderItem[];
  sessionId: string;
  expiresAt: Date;
}

export interface AttributionData {
  campaignId?: string;
  merchantId?: string;
  userId: string;
  channel: 'whatsapp';
  timestamp: Date;
  messageId: string;
  intent: CommerceIntent['type'];
}

// =============================================================================
// INTENT PARSER
// =============================================================================

interface IntentPattern {
  type: CommerceIntent['type'];
  patterns: RegExp[];
  keywords: string[];
  weight: number;
}

const INTENT_PATTERNS: IntentPattern[] = [
  {
    type: 'order',
    patterns: [
      /\b(buy|order|purchase|get|want|need|have to|can i|add to|checkout)\b/i,
      /\b(\d+)\s*(pcs?|pieces?|units?|items?)\b/i,
      /\b(buy|order)\s+(.+?)\s+(for|with)\s+(\d+)/i,
    ],
    keywords: ['buy', 'order', 'purchase', 'checkout', 'get me', 'i want', 'add to cart', 'place order'],
    weight: 1.0,
  },
  {
    type: 'browse',
    patterns: [
      /\b(show|see|view|look|browse|find|search|have|stock)\b/i,
      /\bwhat.*(available|available|in stock|selling)\b/i,
      /\blist|collection|catalog\b/i,
    ],
    keywords: ['show', 'view', 'browse', 'catalog', 'what do you have', 'what\'s available', 'search'],
    weight: 0.8,
  },
  {
    type: 'offer',
    patterns: [
      /\b(discount|deal|promo|promotion|sale|offer|cheap|bargain|affordable)\b/i,
      /\bhow much|price|cost|worth\b/i,
      /\b(\d+%|\d+\s*%)\s*(off)?\b/i,
    ],
    keywords: ['discount', 'deal', 'sale', 'promotion', 'offer', 'cheap', 'affordable', 'best price'],
    weight: 0.9,
  },
  {
    type: 'support',
    patterns: [
      /\b(help|support|issue|problem|broken|defective|return|refund|cancel|track|where is)\b/i,
      /\bhow do i|how can i|can i track|want to return\b/i,
    ],
    keywords: ['help', 'support', 'track order', 'return', 'refund', 'cancel', 'issue', 'problem'],
    weight: 0.85,
  },
];

const ENTITY_PATTERNS = {
  product: /(?:buy|order|get|want|looking for)\s+(?:a\s+)?(?:nice\s+)?(.+?)(?:\s+for|\s+with|\s+at|\s+please|\s+now|$)/i,
  category: /\b(phone|laptop|shirt|shoes|watch|headphones|earbuds|case|cover|charger|cable)\b/i,
  quantity: /\b(\d+)\s*(pcs?|pieces?|units?|items?)?\b/i,
  priceRange: /(\$|USD|Rp|Rupiah)?\s*(\d+(?:,\d{3})*(?:\.\d{2})?)\s*(?:to|-)\s*(\$|USD|Rp|Rupiah)?\s*(\d+(?:,\d{3})*(?:\.\d{2})?)/i,
  merchant: /from\s+([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)?)|at\s+([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)?)/i,
};

/**
 * Parse user message to extract commerce intent
 */
export function parseIntent(message: string): CommerceIntent {
  const normalizedText = message.trim().toLowerCase();

  // Score each intent type
  const scores: { type: CommerceIntent['type']; score: number }[] = INTENT_PATTERNS.map((pattern) => {
    let score = 0;
    const matches: string[] = [];

    // Check regex patterns
    for (const regex of pattern.patterns) {
      if (regex.test(normalizedText)) {
        score += pattern.weight * 0.6;
        matches.push('pattern');
      }
    }

    // Check keywords
    for (const keyword of pattern.keywords) {
      if (normalizedText.includes(keyword.toLowerCase())) {
        score += pattern.weight * 0.4;
        matches.push(keyword);
      }
    }

    // Normalize score
    const maxPossibleScore = (pattern.patterns.length * 0.6 + pattern.keywords.length * 0.4) * pattern.weight;
    score = Math.min(score / maxPossibleScore, 1);

    return { type: pattern.type, score };
  });

  // Find highest scoring intent
  scores.sort((a, b) => b.score - a.score);
  const bestMatch = scores[0];

  // Extract entities from message
  const entities: CommerceIntent['entities'] = {};

  // Extract product
  const productMatch = normalizedText.match(ENTITY_PATTERNS.product);
  if (productMatch && productMatch[1]) {
    entities.product = productMatch[1].trim();
  }

  // Extract category
  const categoryMatch = normalizedText.match(ENTITY_PATTERNS.category);
  if (categoryMatch) {
    entities.category = categoryMatch[1].toLowerCase();
  }

  // Extract quantity
  const quantityMatch = normalizedText.match(ENTITY_PATTERNS.quantity);
  if (quantityMatch) {
    entities.quantity = parseInt(quantityMatch[1], 10);
  }

  // Extract price range
  const priceMatch = normalizedText.match(ENTITY_PATTERNS.priceRange);
  if (priceMatch) {
    const min = parseFloat(priceMatch[2].replace(/,/g, ''));
    const max = parseFloat(priceMatch[4].replace(/,/g, ''));
    entities.priceRange = `$${min}-${max}`;
  }

  // Extract merchant
  const merchantMatch = normalizedText.match(ENTITY_PATTERNS.merchant);
  if (merchantMatch && (merchantMatch[1] || merchantMatch[2])) {
    entities.merchant = (merchantMatch[1] || merchantMatch[2]).trim();
  }

  // Fallback: if no entities and general intent, try to extract any product mention
  if (bestMatch.type === 'browse' && !entities.product && !entities.category) {
    // Extract first noun phrase as potential product
    const words = normalizedText.split(/\s+/).filter((w) => w.length > 3);
    if (words.length > 0) {
      entities.product = words.slice(0, 3).join(' ');
    }
  }

  return {
    type: bestMatch.score > 0.1 ? bestMatch.type : 'general',
    entities,
    confidence: Math.round(bestMatch.score * 100) / 100,
  };
}

// =============================================================================
// RESPONSE GENERATOR
// =============================================================================

interface ResponseTemplate {
  type: CommerceResponse['type'];
  templates: {
    high_confidence: string[];
    medium_confidence: string[];
    low_confidence: string[];
  };
}

const RESPONSE_TEMPLATES: ResponseTemplate[] = [
  {
    type: 'product_list',
    templates: {
      high_confidence: [
        "Here are some great options for *{{product}}*:\n\n{{products}}\n\nJust reply with the product number to order!",
        "Found *{{count}}* products matching '{{product}}':\n\n{{products}}\n\nWhich one interests you?",
      ],
      medium_confidence: [
        "Here are some products you might like:\n\n{{products}}\n\nLet me know if you'd like more options!",
        "I found these for you:\n\n{{products}}\n\nReply with the number to buy.",
      ],
      low_confidence: [
        "Here are some popular items:\n\n{{products}}\n\nWhat catches your eye?",
        "Check these out:\n\n{{products}}\n\nI can show more if needed!",
      ],
    },
  },
  {
    type: 'order_confirm',
    templates: {
      high_confidence: [
        "Your order has been placed! 🎉\n\n*Order ID:* `{{orderId}}`\n*Items:* {{items}}\n*Total:* *{{total}}*\n\nWe'll send a payment link shortly.",
        "Done! Order *#{{orderId}}* confirmed.\n\n{{itemsSummary}}\n\nTotal: *{{total}}*\n\nPlease complete payment within 24 hours.",
      ],
      medium_confidence: [
        "Order confirmed! ✅\n\n*#{{orderId}}*\n{{items}}\n\nTotal: *{{total}}*\n\nCheck your payment link in a moment.",
      ],
      low_confidence: [
        "Got it! Your order is being processed.\n\nOrder ID: `{{orderId}}`\nTotal: {{total}}",
      ],
    },
  },
  {
    type: 'payment_link',
    templates: {
      high_confidence: [
        "Complete your payment here:\n\n{{paymentUrl}}\n\n*Order:* #{{orderId}}\n*Amount:* {{total}}\n\nThis link expires in 24 hours.",
      ],
      medium_confidence: [
        "Here's your payment link:\n\n{{paymentUrl}}\n\nPlease complete within 24 hours.",
      ],
      low_confidence: [
        "Payment link: {{paymentUrl}}\n\nExpires in 24 hours.",
      ],
    },
  },
  {
    type: 'offer',
    templates: {
      high_confidence: [
        "Great timing! 🔥\n\n{{offerDetails}}\n\n*Discount:* {{discount}}\n*Valid until:* {{validUntil}}\n\nUse code: `{{promoCode}}`",
        "We've got an amazing deal for you:\n\n{{offerDetails}}\n\nSave {{discount}} with code `{{promoCode}}`!",
      ],
      medium_confidence: [
        "Current promotions:\n\n{{offerDetails}}\n\nUse code `{{promoCode}}` at checkout!",
      ],
      low_confidence: [
        "Check out our latest deals:\n\n{{offerDetails}}",
      ],
    },
  },
  {
    type: 'support',
    templates: {
      high_confidence: [
        "I'd be happy to help! 💬\n\n{{supportDetails}}\n\nIs there anything else I can assist with?",
      ],
      medium_confidence: [
        "Let me help you with that.\n\n{{supportDetails}}",
      ],
      low_confidence: [
        "I'm here to help!\n\n{{supportDetails}}",
      ],
    },
  },
];

/**
 * Format product list for WhatsApp display
 */
function formatProductList(products: Product[], startIndex = 1): string {
  return products
    .slice(0, 10) // WhatsApp friendly limit
    .map((p, i) => {
      const idx = startIndex + i;
      const price = `$${p.price.toFixed(2)}`;
      const coins = p.coins ? ` (+${p.coins} coins)` : '';
      return `${idx}. *${p.name}*\n   ${price}${coins}\n   ID: ${p.id.slice(0, 8)}`;
    })
    .join('\n\n');
}

/**
 * Select appropriate confidence tier
 */
function getConfidenceTier(confidence: number): 'high_confidence' | 'medium_confidence' | 'low_confidence' {
  if (confidence >= 0.7) return 'high_confidence';
  if (confidence >= 0.4) return 'medium_confidence';
  return 'low_confidence';
}

/**
 * Generate contextual response based on intent
 */
export function generateResponse(
  intent: CommerceIntent,
  data: {
    products?: Product[];
    orderId?: string;
    paymentUrl?: string;
    total?: number;
    items?: string;
    offerDetails?: string;
    supportDetails?: string;
    promoCode?: string;
    discount?: string;
    validUntil?: string;
  }
): CommerceResponse {
  const template = RESPONSE_TEMPLATES.find((t) => t.type === getResponseType(intent.type));
  if (!template) {
    return generateFallbackResponse(intent);
  }

  const tier = getConfidenceTier(intent.confidence);
  const templates = template.templates[tier];
  const templateStr = templates[Math.floor(Math.random() * templates.length)];

  // Build response message
  let message = templateStr
    .replace('{{product}}', intent.entities.product || 'your search')
    .replace('{{count}}', String(data.products?.length || 0))
    .replace('{{products}}', data.products ? formatProductList(data.products) : '')
    .replace('{{orderId}}', data.orderId || '')
    .replace('{{total}}', data.total ? `$${data.total.toFixed(2)}` : '')
    .replace('{{items}}', data.items || '')
    .replace('{{itemsSummary}}', data.items || '')
    .replace('{{paymentUrl}}', data.paymentUrl || '')
    .replace('{{offerDetails}}', data.offerDetails || 'Check our website for current deals!')
    .replace('{{supportDetails}}', data.supportDetails || 'How can I assist you today?')
    .replace('{{promoCode}}', data.promoCode || 'SAVE10')
    .replace('{{discount}}', data.discount || '10%')
    .replace('{{validUntil}}', data.validUntil || 'end of month');

  // Determine response type
  let responseType: CommerceResponse['type'] = 'product_list';
  if (intent.type === 'order' && data.orderId) {
    responseType = 'order_confirm';
  } else if (data.paymentUrl) {
    responseType = 'payment_link';
  } else if (intent.type === 'offer') {
    responseType = 'offer';
  } else if (intent.type === 'support') {
    responseType = 'support';
  }

  return {
    type: responseType,
    message,
    products: data.products,
    orderId: data.orderId,
    paymentUrl: data.paymentUrl,
    attribution: {
      channel: 'whatsapp',
    },
  };
}

/**
 * Map intent type to response type
 */
function getResponseType(intentType: CommerceIntent['type']): CommerceResponse['type'] {
  switch (intentType) {
    case 'order':
      return 'order_confirm';
    case 'browse':
      return 'product_list';
    case 'offer':
      return 'offer';
    case 'support':
      return 'support';
    default:
      return 'product_list';
  }
}

/**
 * Generate fallback response when no template matches
 */
function generateFallbackResponse(intent: CommerceIntent): CommerceResponse {
  return {
    type: 'product_list',
    message:
      intent.type === 'general'
        ? "I'm here to help you shop! You can:\n\n* Browse products: \"Show me phones\"\n* Order items: \"Buy a laptop\"\n* Check deals: \"Any discounts?\"\n* Get help: \"Track my order\"\n\nWhat would you like to do?"
        : `I understand you want to ${intent.type}. Let me help you find what you need. Can you tell me more about what you're looking for?`,
    attribution: {
      channel: 'whatsapp',
    },
  };
}

// =============================================================================
// ORDER FLOW MANAGER
// =============================================================================

/**
 * In-memory cart storage (in production, use Redis/database)
 */
const carts = new Map<string, Cart>();

/**
 * In-memory order storage (in production, use database)
 */
const orders = new Map<string, Order>();

const CART_TTL_MS = 30 * 60 * 1000; // 30 minutes
const ORDER_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Get or create cart for user
 */
export function getCart(userId: string): Cart {
  const existingCart = carts.get(userId);
  if (existingCart && existingCart.expiresAt > new Date()) {
    return existingCart;
  }

  const newCart: Cart = {
    userId,
    items: [],
    sessionId: uuidv4(),
    expiresAt: new Date(Date.now() + CART_TTL_MS),
  };
  carts.set(userId, newCart);
  return newCart;
}

/**
 * Add item to cart
 */
export function addToCart(userId: string, product: Product, quantity: number = 1): Cart {
  const cart = getCart(userId);

  const existingIndex = cart.items.findIndex((item) => item.product.id === product.id);
  if (existingIndex >= 0) {
    cart.items[existingIndex].quantity += quantity;
    cart.items[existingIndex].subtotal = cart.items[existingIndex].product.price * cart.items[existingIndex].quantity;
  } else {
    cart.items.push({
      product,
      quantity,
      subtotal: product.price * quantity,
    });
  }

  cart.expiresAt = new Date(Date.now() + CART_TTL_MS);
  return cart;
}

/**
 * Remove item from cart
 */
export function removeFromCart(userId: string, productId: string): Cart {
  const cart = getCart(userId);
  cart.items = cart.items.filter((item) => item.product.id !== productId);
  cart.expiresAt = new Date(Date.now() + CART_TTL_MS);
  return cart;
}

/**
 * Update item quantity
 */
export function updateCartQuantity(userId: string, productId: string, quantity: number): Cart {
  const cart = getCart(userId);
  const item = cart.items.find((i) => i.product.id === productId);

  if (item) {
    if (quantity <= 0) {
      return removeFromCart(userId, productId);
    }
    item.quantity = quantity;
    item.subtotal = item.product.price * quantity;
  }

  cart.expiresAt = new Date(Date.now() + CART_TTL_MS);
  return cart;
}

/**
 * Clear cart
 */
export function clearCart(userId: string): void {
  carts.delete(userId);
}

/**
 * Calculate cart total
 */
export function getCartTotal(cart: Cart): number {
  return cart.items.reduce((sum, item) => sum + item.subtotal, 0);
}

/**
 * Create order from cart
 */
export function createOrder(
  userId: string,
  attribution: AttributionData
): Order | null {
  const cart = getCart(userId);

  if (cart.items.length === 0) {
    return null;
  }

  const orderId = `ORD-${Date.now()}-${uuidv4().slice(0, 8).toUpperCase()}`;
  const total = getCartTotal(cart);

  const order: Order = {
    id: orderId,
    userId,
    items: [...cart.items],
    total,
    status: 'pending',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  orders.set(orderId, order);

  // Store attribution with order
  orderAttributions.set(orderId, attribution);

  // Clear cart after order
  clearCart(userId);

  return order;
}

/**
 * Get order by ID
 */
export function getOrder(orderId: string): Order | undefined {
  return orders.get(orderId);
}

/**
 * Update order status
 */
export function updateOrderStatus(orderId: string, status: Order['status']): Order | undefined {
  const order = orders.get(orderId);
  if (order) {
    order.status = status;
    order.updatedAt = new Date();
  }
  return order;
}

/**
 * Generate payment URL for order
 */
export function generatePaymentUrl(orderId: string, baseUrl: string = 'https://pay.rez.com'): string {
  const order = orders.get(orderId);
  if (!order) {
    throw new Error(`Order not found: ${orderId}`);
  }

  // Generate a signed payment URL (in production, use proper signed URLs)
  const params = new URLSearchParams({
    order: orderId,
    amount: order.total.toString(),
    currency: 'USD',
    channel: 'whatsapp',
    timestamp: Date.now().toString(),
  });

  return `${baseUrl}/checkout?${params.toString()}`;
}

/**
 * Confirm order payment (webhook callback)
 */
export function confirmPayment(orderId: string, paymentId: string): Order | undefined {
  const order = orders.get(orderId);
  if (order && order.status === 'pending') {
    order.status = 'paid';
    order.updatedAt = new Date();
    return order;
  }
  return undefined;
}

// =============================================================================
// ATTRIBUTION TRACKING
// =============================================================================

interface AttributionRecord {
  data: AttributionData;
  conversions: number;
  revenue: number;
  lastActivity: Date;
}

const orderAttributions = new Map<string, AttributionData>();
const attributionRecords = new Map<string, AttributionRecord>();

/**
 * Track attribution event
 */
export function trackAttribution(data: AttributionData): void {
  const key = data.campaignId || data.merchantId || 'direct';

  const existing = attributionRecords.get(key);
  if (existing) {
    existing.lastActivity = new Date();
  } else {
    attributionRecords.set(key, {
      data,
      conversions: 0,
      revenue: 0,
      lastActivity: new Date(),
    });
  }
}

/**
 * Record conversion for attribution
 */
export function recordConversion(campaignId: string, revenue: number): void {
  const record = attributionRecords.get(campaignId);
  if (record) {
    record.conversions += 1;
    record.revenue += revenue;
  }
}

/**
 * Get attribution analytics
 */
export function getAttributionAnalytics(campaignId?: string): {
  campaignId?: string;
  conversions: number;
  revenue: number;
  lastActivity: Date;
}[] {
  if (campaignId) {
    const record = attributionRecords.get(campaignId);
    return record
      ? [
          {
            campaignId,
            conversions: record.conversions,
            revenue: record.revenue,
            lastActivity: record.lastActivity,
          },
        ]
      : [];
  }

  return Array.from(attributionRecords.entries()).map(([id, record]) => ({
    campaignId: id,
    conversions: record.conversions,
    revenue: record.revenue,
    lastActivity: record.lastActivity,
  }));
}

/**
 * Get attribution data for order
 */
export function getOrderAttribution(orderId: string): AttributionData | undefined {
  return orderAttributions.get(orderId);
}

// =============================================================================
// PRODUCT SUGGESTIONS ENGINE
// =============================================================================

interface ProductIndex {
  byId: Map<string, Product>;
  byCategory: Map<string, Product[]>;
  byMerchant: Map<string, Product[]>;
}

/**
 * In-memory product index (in production, use database search)
 */
const productIndex: ProductIndex = {
  byId: new Map(),
  byCategory: new Map(),
  byMerchant: new Map(),
};

/**
 * Index a product for fast lookup
 */
export function indexProduct(product: Product): void {
  productIndex.byId.set(product.id, product);

  // Index by category (derived from product name for simplicity)
  const category = categorizeProduct(product.name);
  const categoryProducts = productIndex.byCategory.get(category) || [];
  categoryProducts.push(product);
  productIndex.byCategory.set(category, categoryProducts);

  // Index by merchant
  const merchantProducts = productIndex.byMerchant.get(product.merchantId) || [];
  merchantProducts.push(product);
  productIndex.byMerchant.set(product.merchantId, merchantProducts);
}

/**
 * Simple product categorization based on name keywords
 */
function categorizeProduct(productName: string): string {
  const name = productName.toLowerCase();

  const categories: [string, RegExp][] = [
    ['electronics', /(?:phone|mobile|cell|smartphone|laptop|computer|tablet|ipad|watch|earbuds|headphones|charger|cable)/],
    ['clothing', /(?:shirt|tshirt|jeans|pants|dress|skirt|jacket|coat|shoes|sneakers|boots|sandals)/],
    ['accessories', /(?:case|cover|bag|wallet|watch|bracelet|necklace|ring|earring)/],
    ['home', /(?:furniture|bed|sofa|chair|table|lamp|cushion|curtain|rug|mat)/],
    ['sports', /(?:fitness|gym|yoga|running|cycling|sports|ball|bike)/],
    ['beauty', /(?:makeup|skincare|cream|lotion|perfume|cosmetics)/],
    ['food', /(?:snack|drink|food|grocery|coffee|tea)/],
  ];

  for (const [category, regex] of categories) {
    if (regex.test(name)) {
      return category;
    }
  }

  return 'general';
}

/**
 * Search products based on query and filters
 */
export function searchProducts(
  query?: string,
  filters?: {
    category?: string;
    merchantId?: string;
    minPrice?: number;
    maxPrice?: number;
    limit?: number;
  }
): Product[] {
  let results: Product[] = [];

  // Start with category or merchant filter if provided
  if (filters?.category) {
    results = productIndex.byCategory.get(filters.category) || [];
  } else if (filters?.merchantId) {
    results = productIndex.byMerchant.get(filters.merchantId) || [];
  } else {
    // Get all products
    results = Array.from(productIndex.byId.values());
  }

  // Filter by query if provided
  if (query) {
    const queryLower = query.toLowerCase();
    results = results.filter(
      (p) =>
        p.name.toLowerCase().includes(queryLower) ||
        p.id.toLowerCase().includes(queryLower) ||
        p.merchantId.toLowerCase().includes(queryLower)
    );
  }

  // Filter by price range
  if (filters?.minPrice !== undefined) {
    results = results.filter((p) => p.price >= filters.minPrice!);
  }
  if (filters?.maxPrice !== undefined) {
    results = results.filter((p) => p.price <= filters.maxPrice!);
  }

  // Limit results
  const limit = filters?.limit || 10;
  return results.slice(0, limit);
}

/**
 * Get personalized product suggestions based on user history
 */
export function getPersonalizedSuggestions(
  userId: string,
  intent: CommerceIntent,
  limit: number = 5
): Product[] {
  // In production, this would use ML/model-based recommendations
  // For now, use simple rule-based suggestions

  const filters: Parameters<typeof searchProducts>[1] = {
    limit,
  };

  // Apply entity filters from intent
  if (intent.entities.category) {
    filters.category = intent.entities.category;
  }

  if (intent.entities.merchant) {
    filters.merchantId = intent.entities.merchant;
  }

  // Apply price range if specified
  if (intent.entities.priceRange) {
    const priceMatch = intent.entities.priceRange.match(/\$(\d+)-(\d+)/);
    if (priceMatch) {
      filters.minPrice = parseFloat(priceMatch[1]);
      filters.maxPrice = parseFloat(priceMatch[2]);
    }
  }

  // Get products matching criteria
  let products = searchProducts(intent.entities.product, filters);

  // If no results, return popular items
  if (products.length === 0) {
    products = searchProducts(undefined, { limit });
  }

  return products;
}

// =============================================================================
// WHATSAPP MESSAGE HANDLER
// =============================================================================

export interface WhatsAppHandlerConfig {
  twilioAccountSid?: string;
  twilioAuthToken?: string;
  paymentBaseUrl?: string;
  maxProductsPerMessage?: number;
  sessionTimeout?: number;
}

/**
 * Main WhatsApp commerce handler
 */
export class WhatsAppCommerceHandler {
  private config: Required<WhatsAppHandlerConfig>;

  constructor(config: WhatsAppHandlerConfig = {}) {
    this.config = {
      twilioAccountSid: config.twilioAccountSid || process.env.TWILIO_ACCOUNT_SID || '',
      twilioAuthToken: config.twilioAuthToken || process.env.TWILIO_AUTH_TOKEN || '',
      paymentBaseUrl: config.paymentBaseUrl || 'https://pay.rez.com',
      maxProductsPerMessage: config.maxProductsPerMessage || 10,
      sessionTimeout: config.sessionTimeout || 30 * 60 * 1000,
    };
  }

  /**
   * Process incoming WhatsApp message
   */
  async handleMessage(
    message: WhatsAppCommerceMessage
  ): Promise<CommerceResponse> {
    try {
      // Parse intent from message
      const intent = parseIntent(message.text);

      // Track attribution
      if (message.campaignId) {
        trackAttribution({
          campaignId: message.campaignId,
          userId: message.from,
          channel: 'whatsapp',
          timestamp: message.timestamp,
          messageId: message.messageId,
          intent: intent.type,
        });
      }

      // Handle based on intent type
      switch (intent.type) {
        case 'order':
          return await this.handleOrderIntent(message, intent);

        case 'browse':
          return await this.handleBrowseIntent(message, intent);

        case 'offer':
          return await this.handleOfferIntent(message, intent);

        case 'support':
          return await this.handleSupportIntent(message, intent);

        default:
          return await this.handleGeneralIntent(message, intent);
      }
    } catch (error) {
      console.error('Error handling WhatsApp message:', error);
      return {
        type: 'support',
        message:
          'I encountered an issue processing your request. Please try again or contact support.',
        attribution: {
          channel: 'whatsapp',
        },
      };
    }
  }

  /**
   * Handle order intent
   */
  private async handleOrderIntent(
    message: WhatsAppCommerceMessage,
    intent: CommerceIntent
  ): Promise<CommerceResponse> {
    const quantity = intent.entities.quantity || 1;

    // Search for matching products
    const products = searchProducts(intent.entities.product, {
      category: intent.entities.category,
      limit: 1,
    });

    if (products.length === 0) {
      // No products found - show general browse options
      return generateResponse(intent, {
        products: searchProducts(undefined, { limit: 5 }),
        supportDetails:
          "I couldn't find that exact product. Here are some alternatives, or let me know if you'd like to search for something specific!",
      });
    }

    const product = products[0];

    // Check if user wants to add to cart or place order directly
    const text = message.text.toLowerCase();
    if (text.includes('add') || text.includes('cart')) {
      // Add to cart
      addToCart(message.from, product, quantity);
      const cart = getCart(message.from);

      return {
        type: 'product_list',
        message: `Added *${product.name}* (x${quantity}) to your cart!\n\nYour cart has ${cart.items.length} item(s).\n\nReply "checkout" when ready to order.`,
        products: [product],
        attribution: {
          campaignId: message.campaignId,
          channel: 'whatsapp',
        },
      };
    }

    // Direct order - create order immediately
    const order = createOrder(message.from, {
      campaignId: message.campaignId,
      userId: message.from,
      channel: 'whatsapp',
      timestamp: message.timestamp,
      messageId: message.messageId,
      intent: 'order',
    });

    if (!order) {
      return generateResponse(intent, {
        supportDetails: 'Unable to create order. Please try again.',
      });
    }

    // Generate payment URL
    const paymentUrl = generatePaymentUrl(order.id, this.config.paymentBaseUrl);
    order.paymentUrl = paymentUrl;

    // Track conversion
    if (message.campaignId) {
      recordConversion(message.campaignId, order.total);
    }

    return {
      type: 'order_confirm',
      message: `Order placed successfully! 🎉\n\n*Order ID:* ${order.id}\n*Item:* ${product.name}\n*Quantity:* ${quantity}\n*Total:* $${order.total.toFixed(2)}\n\nComplete payment: ${paymentUrl}\n\nThis link expires in 24 hours.`,
      orderId: order.id,
      paymentUrl,
      attribution: {
        campaignId: message.campaignId,
        merchantId: product.merchantId,
        channel: 'whatsapp',
      },
    };
  }

  /**
   * Handle browse intent
   */
  private async handleBrowseIntent(
    message: WhatsAppCommerceMessage,
    intent: CommerceIntent
  ): Promise<CommerceResponse> {
    const products = getPersonalizedSuggestions(message.from, intent, this.config.maxProductsPerMessage);

    if (products.length === 0) {
      return {
        type: 'product_list',
        message: "I couldn't find any products matching your search. Try a different keyword or browse our categories:\n\n- Electronics\n- Clothing\n- Accessories\n- Home & Living\n- Sports\n\nWhat would you like to explore?",
        attribution: {
          campaignId: message.campaignId,
          channel: 'whatsapp',
        },
      };
    }

    return generateResponse(intent, {
      products,
    });
  }

  /**
   * Handle offer intent
   */
  private async handleOfferIntent(
    message: WhatsAppCommerceMessage,
    intent: CommerceIntent
  ): Promise<CommerceResponse> {
    // In production, fetch active promotions from database
    const promoCode = 'WELCOME10';
    const discount = '10%';
    const validUntil = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString();

    // Find discounted products
    const products = searchProducts(intent.entities.product, { limit: 5 });
    const discountedProducts = products.map((p) => ({
      ...p,
      price: p.price * 0.9, // Apply 10% discount
    }));

    const offerDetails = discountedProducts.length > 0
      ? `*Hot Deals:*\n\n${formatProductList(discountedProducts)}\n\nUse code \`${promoCode}\` for extra savings!`
      : `*Current Promotions:*\n\n1. ${discount} off your first order\n2. Free shipping on orders over $50\n3. Buy 2 get 1 free on selected items\n\nUse code \`${promoCode}\` at checkout!`;

    return {
      type: 'offer',
      message: `Great timing! Here are our current deals:\n\n${offerDetails}`,
      products: discountedProducts,
      attribution: {
        campaignId: message.campaignId,
        channel: 'whatsapp',
      },
    };
  }

  /**
   * Handle support intent
   */
  private async handleSupportIntent(
    message: WhatsAppCommerceMessage,
    intent: CommerceIntent
  ): Promise<CommerceResponse> {
    const text = message.text.toLowerCase();

    let supportDetails = '';

    if (text.includes('track') || text.includes('where')) {
      supportDetails = "To track your order, please provide your Order ID (格式: ORD-xxxx).\n\nYou can find this in your confirmation message or email.";
    } else if (text.includes('return') || text.includes('refund')) {
      supportDetails = "For returns or refunds:\n\n1. Items must be returned within 14 days\n2. Products must be unused and in original packaging\n3. Contact support with your Order ID\n\nOur team will assist within 24 hours.";
    } else if (text.includes('cancel')) {
      supportDetails = "To cancel your order:\n\n1. If not yet paid: Reply 'cancel [Order ID]' to cancel\n2. If already paid: Request a refund after delivery\n\nNote: Orders ship within 24 hours of payment.";
    } else if (text.includes('help')) {
      supportDetails = "*How can I help you?*\n\n1. Track Order - Provide your Order ID\n2. Return/Refund - Contact support\n3. Product Info - Search for any product\n4. Make Purchase - Browse and buy\n\nWhat do you need assistance with?";
    } else {
      supportDetails = "I'm here to help! Here's what I can do:\n\n* Track your order (provide Order ID)\n* Help with returns or refunds\n* Answer product questions\n* Process new orders\n\nHow may I assist you today?";
    }

    return {
      type: 'support',
      message: supportDetails,
      attribution: {
        campaignId: message.campaignId,
        channel: 'whatsapp',
      },
    };
  }

  /**
   * Handle general intent
   */
  private async handleGeneralIntent(
    message: WhatsAppCommerceMessage,
    intent: CommerceIntent
  ): Promise<CommerceResponse> {
    // Show quick actions menu
    const popularProducts = searchProducts(undefined, { limit: 5 });

    return {
      type: 'product_list',
      message: `Hi there! 👋 Welcome to ReZ Commerce!\n\nI'm here to help you shop via WhatsApp.\n\n*Quick Actions:*\n1. 🔍 Browse products - "Show me phones"\n2. 🛒 Place order - "Buy a laptop"\n3. 💰 Check deals - "Any discounts?"\n4. 📦 Track order - "Track my order"\n\n*Popular Now:*\n${formatProductList(popularProducts)}\n\nWhat would you like to do?`,
      products: popularProducts,
      attribution: {
        channel: 'whatsapp',
      },
    };
  }

  /**
   * Handle checkout process
   */
  async handleCheckout(userId: string, campaignId?: string): Promise<CommerceResponse> {
    const cart = getCart(userId);

    if (cart.items.length === 0) {
      return {
        type: 'support',
        message: "Your cart is empty! Browse our products and add items to checkout.\n\nReply with what you're looking for.",
        attribution: { channel: 'whatsapp' },
      };
    }

    const order = createOrder(userId, {
      campaignId,
      userId,
      channel: 'whatsapp',
      timestamp: new Date(),
      messageId: uuidv4(),
      intent: 'order',
    });

    if (!order) {
      return {
        type: 'support',
        message: 'Unable to process checkout. Please try again.',
        attribution: { channel: 'whatsapp' },
      };
    }

    const paymentUrl = generatePaymentUrl(order.id, this.config.paymentBaseUrl);
    order.paymentUrl = paymentUrl;

    if (campaignId) {
      recordConversion(campaignId, order.total);
    }

    const itemsSummary = cart.items
      .map((item) => `- ${item.product.name} (x${item.quantity}): $${item.subtotal.toFixed(2)}`)
      .join('\n');

    return {
      type: 'order_confirm',
      message: `Order Summary:\n\n${itemsSummary}\n\n─────────────────\n*Total: $${order.total.toFixed(2)}*\n\n*Order ID:* ${order.id}\n\nComplete payment here:\n${paymentUrl}\n\nPayment expires in 24 hours.`,
      orderId: order.id,
      paymentUrl,
      attribution: {
        campaignId,
        channel: 'whatsapp',
      },
    };
  }

  /**
   * Process payment webhook
   */
  async processPaymentWebhook(
    orderId: string,
    paymentId: string,
    status: 'success' | 'failed' | 'pending'
  ): Promise<{ success: boolean; order?: Order }> {
    const order = getOrder(orderId);

    if (!order) {
      return { success: false };
    }

    if (status === 'success') {
      const updatedOrder = confirmPayment(orderId, paymentId);

      // Track revenue for attribution
      const attribution = getOrderAttribution(orderId);
      if (attribution?.campaignId) {
        recordConversion(attribution.campaignId, order.total);
      }

      return { success: true, order: updatedOrder };
    }

    if (status === 'failed') {
      updateOrderStatus(orderId, 'cancelled');
      return { success: true, order };
    }

    return { success: true, order };
  }
}

// =============================================================================
// TWILIO INTEGRATION
// =============================================================================

export interface TwilioWebhookPayload {
  From: string;
  To: string;
  Body: string;
  MessageSid: string;
  NumMedia?: string;
  MediaUrl0?: string;
}

/**
 * Create Twilio webhook handler
 */
export function createTwilioWebhookHandler(
  handler: WhatsAppCommerceHandler,
  config?: {
    validateSignature?: boolean;
    twilioAuthToken?: string;
  }
) {
  const { validateSignature = true, twilioAuthToken = process.env.TWILIO_AUTH_TOKEN } = config || {};

  return async (payload: TwilioWebhookPayload): Promise<string> => {
    try {
      // Validate Twilio signature in production
      if (validateSignature && twilioAuthToken) {
        // Implement Twilio signature validation
        // const isValid = validateTwilioSignature(payload, twilioAuthToken);
        // if (!isValid) throw new Error('Invalid signature');
      }

      // Parse campaign ID from message if present (custom protocol)
      const campaignIdMatch = payload.Body.match(/campaign:([A-Z0-9]+)/i);
      const campaignId = campaignIdMatch ? campaignIdMatch[1] : undefined;

      const message: WhatsAppCommerceMessage = {
        from: payload.From.replace('whatsapp:', ''),
        messageId: payload.MessageSid,
        text: payload.Body.replace(/campaign:[A-Z0-9]+\s*/i, '').trim(),
        timestamp: new Date(),
        campaignId,
      };

      const response = await handler.handleMessage(message);

      // Return TwiML response
      return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>${escapeXml(response.message)}</Message>
</Response>`;
    } catch (error) {
      console.error('Twilio webhook error:', error);
      return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>Sorry, I encountered an issue. Please try again.</Message>
</Response>`;
    }
  };
}

/**
 * Escape XML special characters
 */
function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Format price for WhatsApp display
 */
export function formatPrice(amount: number, currency: string = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(amount);
}

/**
 * Validate phone number format
 */
export function isValidPhoneNumber(phone: string): boolean {
  // Basic E.164 format validation
  const e164Regex = /^\+?[1-9]\d{1,14}$/;
  return e164Regex.test(phone.replace(/[\s\-()]/g, ''));
}

/**
 * Generate session ID from phone number
 */
export function generateSessionId(phone: string): string {
  const normalized = phone.replace(/[^0-9]/g, '');
  return `wa:${normalized}:${Date.now()}`;
}

// =============================================================================
// EXPORTS
// =============================================================================

export default {
  // Core functions
  parseIntent,
  generateResponse,

  // Order management
  getCart,
  addToCart,
  removeFromCart,
  updateCartQuantity,
  clearCart,
  createOrder,
  getOrder,
  updateOrderStatus,
  generatePaymentUrl,
  confirmPayment,

  // Product management
  indexProduct,
  searchProducts,
  getPersonalizedSuggestions,

  // Attribution
  trackAttribution,
  recordConversion,
  getAttributionAnalytics,
  getOrderAttribution,

  // Handler
  WhatsAppCommerceHandler,

  // Twilio integration
  createTwilioWebhookHandler,
  TwilioWebhookPayload,

  // Utilities
  formatPrice,
  isValidPhoneNumber,
  generateSessionId,
};
