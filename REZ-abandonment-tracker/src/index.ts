/**
 * Abandonment Tracker Service for ReZ Marketing Platform
 *
 * Tracks all incomplete user actions and triggers re-engagement campaigns.
 * Supports abandoned searches, carts, views, and payment flows.
 */

import { v4 as uuidv4 } from 'uuid';

// ============================================================================
// Type Definitions
// ============================================================================

export type AbandonmentType = 'search' | 'cart' | 'view' | 'payment';
export type UrgencyLevel = 'critical' | 'high' | 'medium' | 'low';
export type ReEngagementChannel = 'whatsapp' | 'push' | 'sms' | 'email';

export interface AbandonedActionContext {
  query?: string;
  products?: string[];
  totalValue?: number;
  lastStep?: string;
  category?: string;
  brand?: string;
  priceRange?: { min: number; max: number };
}

export interface AbandonedAction {
  id: string;
  userId: string;
  type: AbandonmentType;
  context: AbandonedActionContext;
  intentDetected: string;
  urgency: UrgencyLevel;
  decayScore: number; // decreases over time (100 = fresh, 0 = cold)
  createdAt: Date;
  reminderCount: number;
  lastReminderAt?: Date;
  resolved: boolean;
  resolvedAt?: Date;
  metadata?: Record<string, unknown>;
}

export interface ReEngagementOffer {
  discount: number;
  coins: number;
  freeTrial: boolean;
  bonusCredits?: number;
}

export interface ReEngagementTrigger {
  abandonmentId: string;
  userId: string;
  channel: ReEngagementChannel;
  message: string;
  offer?: ReEngagementOffer;
  scheduledAt: Date;
  sentAt?: Date;
  deliveredAt?: Date;
  clickedAt?: Date;
  convertedAt?: Date;
  status: 'pending' | 'sent' | 'delivered' | 'clicked' | 'converted' | 'failed';
}

export interface AbandonmentStats {
  total: number;
  resolved: number;
  unresolved: number;
  byType: Record<AbandonmentType, number>;
  byUrgency: Record<UrgencyLevel, number>;
  averageDecayScore: number;
  reEngagementRate: number;
  conversionRate: number;
}

export interface DecayConfig {
  initialScore: number;
  decayRatePerHour: number;
  criticalThreshold: number;
  highThreshold: number;
  mediumThreshold: number;
  lowThreshold: number;
}

// ============================================================================
// Configuration
// ============================================================================

const DEFAULT_DECAY_CONFIG: DecayConfig = {
  initialScore: 100,
  decayRatePerHour: 5, // 5 points per hour
  criticalThreshold: 80,
  highThreshold: 60,
  mediumThreshold: 30,
  lowThreshold: 0,
};

const DECAY_RATES_BY_TYPE: Record<AbandonmentType, number> = {
  cart: 4,      // Carts decay slower - high intent
  payment: 8,   // Payments decay faster - urgency
  search: 6,    // Searches decay medium
  view: 3,      // Views decay slowest - low intent
};

const REMINDER_THRESHOLDS = {
  critical: 2,   // Max 2 reminders for critical
  high: 4,       // Max 4 reminders for high
  medium: 3,     // Max 3 reminders for medium
  low: 2,        // Max 2 reminders for low
};

const REMINDER_DELAYS_HOURS = {
  critical: [1, 4],       // Remind at 1h and 4h
  high: [2, 8, 24],        // Remind at 2h, 8h, 24h
  medium: [4, 24],         // Remind at 4h, 24h
  low: [24],               // Remind at 24h
};

// ============================================================================
// Storage (In-Memory - Replace with Database in Production)
// ============================================================================

class AbandonmentStore {
  private abandonments: Map<string, AbandonedAction> = new Map();
  private reEngagementTriggers: Map<string, ReEngagementTrigger> = new Map();

  // Index for fast lookups
  private userIndex: Map<string, Set<string>> = new Map();
  private typeIndex: Map<AbandonmentType, Set<string>> = new Map();
  private urgencyIndex: Map<UrgencyLevel, Set<string>> = new Map();
  private unresolvedIndex: Set<string> = new Set();

  add(action: AbandonedAction): void {
    this.abandonments.set(action.id, action);
    this.updateIndexes(action);
  }

  get(id: string): AbandonedAction | undefined {
    return this.abandonments.get(id);
  }

  getByUser(userId: string): AbandonedAction[] {
    const ids = this.userIndex.get(userId);
    if (!ids) return [];
    return Array.from(ids)
      .map(id => this.abandonments.get(id))
      .filter((a): a is AbandonedAction => a !== undefined);
  }

  getByType(type: AbandonmentType): AbandonedAction[] {
    const ids = this.typeIndex.get(type);
    if (!ids) return [];
    return Array.from(ids)
      .map(id => this.abandonments.get(id))
      .filter((a): a is AbandonedAction => a !== undefined);
  }

  getUnresolved(): AbandonedAction[] {
    return Array.from(this.unresolvedIndex)
      .map(id => this.abandonments.get(id))
      .filter((a): a is AbandonedAction => a !== undefined);
  }

  getByUrgency(urgency: UrgencyLevel): AbandonedAction[] {
    const ids = this.urgencyIndex.get(urgency);
    if (!ids) return [];
    return Array.from(ids)
      .map(id => this.abandonments.get(id))
      .filter((a): a is AbandonedAction => a !== undefined);
  }

  update(action: AbandonedAction): void {
    this.abandonments.set(action.id, action);
    this.updateIndexes(action);
  }

  delete(id: string): boolean {
    const action = this.abandonments.get(id);
    if (!action) return false;

    this.removeFromIndexes(action);
    return this.abandonments.delete(id);
  }

  getAll(): AbandonedAction[] {
    return Array.from(this.abandonments.values());
  }

  // Re-engagement triggers
  addTrigger(trigger: ReEngagementTrigger): void {
    this.reEngagementTriggers.set(trigger.abandonmentId, trigger);
  }

  getTrigger(abandonmentId: string): ReEngagementTrigger | undefined {
    return this.reEngagementTriggers.get(abandonmentId);
  }

  getPendingTriggers(): ReEngagementTrigger[] {
    return Array.from(this.reEngagementTriggers.values())
      .filter(t => t.status === 'pending');
  }

  updateTrigger(trigger: ReEngagementTrigger): void {
    this.reEngagementTriggers.set(trigger.abandonmentId, trigger);
  }

  private updateIndexes(action: AbandonedAction): void {
    // User index
    if (!this.userIndex.has(action.userId)) {
      this.userIndex.set(action.userId, new Set());
    }
    this.userIndex.get(action.userId)!.add(action.id);

    // Type index
    if (!this.typeIndex.has(action.type)) {
      this.typeIndex.set(action.type, new Set());
    }
    this.typeIndex.get(action.type)!.add(action.id);

    // Urgency index
    if (!this.urgencyIndex.has(action.urgency)) {
      this.urgencyIndex.set(action.urgency, new Set());
    }
    this.urgencyIndex.get(action.urgency)!.add(action.id);

    // Unresolved index
    if (!action.resolved) {
      this.unresolvedIndex.add(action.id);
    } else {
      this.unresolvedIndex.delete(action.id);
    }
  }

  private removeFromIndexes(action: AbandonedAction): void {
    this.userIndex.get(action.userId)?.delete(action.id);
    this.typeIndex.get(action.type)?.delete(action.id);
    this.urgencyIndex.get(action.urgency)?.delete(action.id);
    this.unresolvedIndex.delete(action.id);
  }

  clear(): void {
    this.abandonments.clear();
    this.reEngagementTriggers.clear();
    this.userIndex.clear();
    this.typeIndex.clear();
    this.urgencyIndex.clear();
    this.unresolvedIndex.clear();
  }
}

// ============================================================================
// Notification Service Interface (Implement in Production)
// ============================================================================

interface NotificationService {
  sendWhatsApp(userId: string, message: string, metadata?: Record<string, unknown>): Promise<boolean>;
  sendPush(userId: string, title: string, body: string, data?: Record<string, unknown>): Promise<boolean>;
  sendSMS(userId: string, message: string): Promise<boolean>;
  sendEmail(userId: string, subject: string, body: string): Promise<boolean>;
}

// Mock notification service for development
const mockNotificationService: NotificationService = {
  async sendWhatsApp(userId: string, message: string): Promise<boolean> {
    console.log(`[WhatsApp] To: ${userId}, Message: ${message}`);
    return true;
  },
  async sendPush(userId: string, title: string, body: string): Promise<boolean> {
    console.log(`[Push] To: ${userId}, Title: ${title}, Body: ${body}`);
    return true;
  },
  async sendSMS(userId: string, message: string): Promise<boolean> {
    console.log(`[SMS] To: ${userId}, Message: ${message}`);
    return true;
  },
  async sendEmail(userId: string, subject: string, body: string): Promise<boolean> {
    console.log(`[Email] To: ${userId}, Subject: ${subject}`);
    return true;
  },
};

// ============================================================================
// Intent Detection
// ============================================================================

function detectSearchIntent(query: string, results: string[]): string {
  const queryLower = query.toLowerCase();

  const intentPatterns: Record<string, RegExp[]> = {
    'product_comparison': [/compare/i, /vs\.?/i, /versus/i, /difference between/i],
    'price_lookup': [/price/i, /cost/i, /cheap/i, /afford/i, /budget/i, /deal/i],
    'product_research': [/review/i, /rating/i, /best/i, /top/i, /recommend/i],
    'specific_purchase': [/buy/i, /purchase/i, /order/i, /get/i, /need/i],
    'availability_check': [/in stock/i, /available/i, /delivery/i, /ship/i],
    '规格查询': [/spec/i, /specs/i, /specification/i, /规格/i],
  };

  for (const [intent, patterns] of Object.entries(intentPatterns)) {
    if (patterns.some(pattern => pattern.test(queryLower))) {
      return intent;
    }
  }

  // Default based on query characteristics
  if (query.length > 30) return 'product_research';
  if (results.length > 0) return 'specific_purchase';
  return 'exploration';
}

function detectCartIntent(cartItems: { productId: string; quantity: number; price: number }[]): string {
  if (cartItems.length === 0) return 'empty_cart';

  const totalValue = cartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const itemCount = cartItems.length;

  if (totalValue > 500) return 'high_value_cart';
  if (itemCount > 5) return 'bulk_shopping';
  if (itemCount > 1) return 'multi_item_cart';
  return 'single_item_cart';
}

function detectViewIntent(products: { productId: string; category?: string; price?: number }[]): string {
  if (products.length === 0) return 'no_products';
  if (products.length > 5) return 'browsing_session';
  if (products.length > 1) return 'comparison_shopping';
  return 'single_product_interest';
}

// ============================================================================
// Urgency Calculation
// ============================================================================

function calculateUrgency(
  type: AbandonmentType,
  totalValue: number | undefined,
  intent: string,
  context: AbandonedActionContext
): UrgencyLevel {
  // High value items get bumped urgency
  const valueBonus = (totalValue && totalValue > 200) ? 1 : 0;
  const highIntentBonus = ['high_value_cart', 'specific_purchase', 'price_lookup'].includes(intent) ? 1 : 0;

  // Type-based base urgency
  const typeUrgency: Record<AbandonmentType, number> = {
    payment: 4,  // Critical - they were about to pay
    cart: 3,     // High - strong purchase intent
    search: 2,   // Medium - some intent
    view: 1,     // Low - browsing behavior
  };

  const score = typeUrgency[type] + valueBonus + highIntentBonus;

  if (score >= 5) return 'critical';
  if (score >= 4) return 'high';
  if (score >= 2) return 'medium';
  return 'low';
}

// ============================================================================
// Decay Calculation
// ============================================================================

function calculateDecay(
  createdAt: Date,
  type: AbandonmentType,
  config: DecayConfig = DEFAULT_DECAY_CONFIG
): number {
  const now = new Date();
  const hoursElapsed = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60);

  const decayRate = DECAY_RATES_BY_TYPE[type];
  const decay = hoursElapsed * decayRate;

  const score = Math.max(0, config.initialScore - decay);
  return Math.round(score * 100) / 100; // Round to 2 decimal places
}

function getUrgencyFromDecay(decayScore: number): UrgencyLevel {
  if (decayScore >= DEFAULT_DECAY_CONFIG.criticalThreshold) return 'critical';
  if (decayScore >= DEFAULT_DECAY_CONFIG.highThreshold) return 'high';
  if (decayScore >= DEFAULT_DECAY_CONFIG.mediumThreshold) return 'medium';
  return 'low';
}

// ============================================================================
// Message Templates
// ============================================================================

interface MessageTemplate {
  whatsapp: (context: AbandonedActionContext, offer?: ReEngagementOffer) => string;
  push: (context: AbandonedActionContext, offer?: ReEngagementOffer) => { title: string; body: string };
  sms: (context: AbandonedActionContext, offer?: ReEngagementOffer) => string;
  email: (context: AbandonedActionContext, offer?: ReEngagementOffer) => { subject: string; body: string };
}

const messageTemplates: Record<AbandonmentType, MessageTemplate> = {
  search: {
    whatsapp: (ctx) =>
      `Hey! We noticed you were searching for "${ctx.query}". Did you find what you were looking for? Let us help you find the perfect match!`,

    push: (ctx) => ({
      title: 'Still thinking about it?',
      body: `Check out results for "${ctx.query}" - exclusive deals await!`,
    }),

    sms: (ctx) =>
      `ReZ: Still looking for "${ctx.query}"? We have great recommendations waiting for you!`,

    email: (ctx) => ({
      subject: `Your search results for "${ctx.query}" - still available!`,
      body: `We noticed you were researching "${ctx.query}". Here's a curated selection based on your interests.`,
    }),
  },

  cart: {
    whatsapp: (ctx, offer) => {
      const discountText = offer?.discount ? ` ${offer.discount}% OFF` : '';
      const coinsText = offer?.coins ? ` +${offer.coins} coins` : '';
      return `Your cart is waiting!${discountText}${coinsText} Complete your purchase before items sell out.`;
    },

    push: (ctx, offer) => ({
      title: 'Complete your purchase',
      body: offer?.discount
        ? `Don't miss ${offer.discount}% off your cart!`
        : 'Your cart items are still reserved!',
    }),

    sms: (ctx, offer) =>
      offer?.discount
        ? `ReZ: ${offer.discount}% off your cart! Complete purchase now. Use code CART${offer.discount}`
        : 'ReZ: Your cart items are waiting! Complete your order today.',

    email: (ctx, offer) => ({
      subject: 'Your cart is waiting - special offer inside!',
      body: offer?.discount
        ? `Complete your purchase and enjoy ${offer.discount}% off! This offer expires in 24 hours.`
        : 'You left items in your cart. They are still available!',
    }),
  },

  view: {
    whatsapp: (ctx) =>
      `We saw you checking out some amazing products! Need any help making a decision?`,

    push: (ctx) => ({
      title: 'Products you viewed are popular!',
      body: 'Check them out - limited stock available!',
    }),

    sms: (ctx) =>
      'ReZ: Products you viewed are going fast! Complete your purchase today.',

    email: (ctx) => ({
      subject: 'Still considering? We can help!',
      body: 'Take another look at the products you viewed. Still have questions? Our team is here to help.',
    }),
  },

  payment: {
    whatsapp: (ctx, offer) =>
      `Complete your payment now and get ${offer?.discount || 10}% off! Your order is almost complete.`,

    push: (ctx, offer) => ({
      title: 'Complete your payment!',
      body: offer?.discount
        ? `${offer.discount}% off if you complete payment within 24 hours!`
        : 'Your order is waiting - complete payment now!',
    }),

    sms: (ctx, offer) =>
      `ReZ: Complete your payment and get ${offer?.discount || 10}% off! Offer expires soon.`,

    email: (ctx, offer) => ({
      subject: 'Complete your payment - exclusive bonus inside!',
      body: `Your order is pending payment. Complete it now to enjoy ${offer?.discount || 10}% off and priority shipping!`,
    }),
  },
};

// ============================================================================
// Main Service
// ============================================================================

export class AbandonmentTrackerService {
  private store: AbandonmentStore;
  private notificationService: NotificationService;
  private decayConfig: DecayConfig;

  constructor(
    notificationService: NotificationService = mockNotificationService,
    decayConfig: DecayConfig = DEFAULT_DECAY_CONFIG
  ) {
    this.store = new AbandonmentStore();
    this.notificationService = notificationService;
    this.decayConfig = decayConfig;
  }

  /**
   * Track when a user abandons a search
   */
  async trackSearchAbandonment(
    userId: string,
    query: string,
    results: string[] = []
  ): Promise<AbandonedAction> {
    const intent = detectSearchIntent(query, results);
    const context: AbandonedActionContext = {
      query,
      products: results,
    };

    const urgency = calculateUrgency('search', undefined, intent, context);
    const now = new Date();

    const abandonment: AbandonedAction = {
      id: uuidv4(),
      userId,
      type: 'search',
      context,
      intentDetected: intent,
      urgency,
      decayScore: this.decayConfig.initialScore,
      createdAt: now,
      reminderCount: 0,
      resolved: false,
    };

    this.store.add(abandonment);
    console.log(`[AbandonmentTracker] Tracked search abandonment: ${abandonment.id}`);

    // Auto-trigger for high urgency
    if (urgency === 'critical' || urgency === 'high') {
      this.scheduleReEngagement(abandonment);
    }

    return abandonment;
  }

  /**
   * Track when a user abandons their cart
   */
  async trackCartAbandonment(
    userId: string,
    cartItems: { productId: string; quantity: number; price: number; name?: string }[]
  ): Promise<AbandonedAction> {
    const intent = detectCartIntent(cartItems);
    const totalValue = cartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const productIds = cartItems.map(item => item.productId);

    const context: AbandonedActionContext = {
      products: productIds,
      totalValue,
      lastStep: 'cart_page',
    };

    const urgency = calculateUrgency('cart', totalValue, intent, context);
    const now = new Date();

    const abandonment: AbandonedAction = {
      id: uuidv4(),
      userId,
      type: 'cart',
      context,
      intentDetected: intent,
      urgency,
      decayScore: this.decayConfig.initialScore,
      createdAt: now,
      reminderCount: 0,
      resolved: false,
    };

    this.store.add(abandonment);
    console.log(`[AbandonmentTracker] Tracked cart abandonment: ${abandonment.id}, Value: $${totalValue}`);

    // Auto-trigger for high value carts
    if (totalValue > 100) {
      this.scheduleReEngagement(abandonment);
    }

    return abandonment;
  }

  /**
   * Track when a user abandons product views
   */
  async trackViewAbandonment(
    userId: string,
    products: { productId: string; category?: string; price?: number; brand?: string }[]
  ): Promise<AbandonedAction> {
    const intent = detectViewIntent(products);
    const productIds = products.map(p => p.productId);
    const avgPrice = products.length > 0
      ? products.reduce((sum, p) => sum + (p.price || 0), 0) / products.length
      : undefined;

    const context: AbandonedActionContext = {
      products: productIds,
      totalValue: avgPrice,
      category: products[0]?.category,
      brand: products[0]?.brand,
    };

    const urgency = calculateUrgency('view', avgPrice, intent, context);
    const now = new Date();

    const abandonment: AbandonedAction = {
      id: uuidv4(),
      userId,
      type: 'view',
      context,
      intentDetected: intent,
      urgency,
      decayScore: this.decayConfig.initialScore,
      createdAt: now,
      reminderCount: 0,
      resolved: false,
    };

    this.store.add(abandonment);
    console.log(`[AbandonmentTracker] Tracked view abandonment: ${abandonment.id}`);

    return abandonment;
  }

  /**
   * Track payment abandonment
   */
  async trackPaymentAbandonment(
    userId: string,
    orderDetails: { orderId: string; totalValue: number; products: string[] }
  ): Promise<AbandonedAction> {
    const context: AbandonedActionContext = {
      products: orderDetails.products,
      totalValue: orderDetails.totalValue,
      lastStep: 'payment_page',
    };

    // Payment abandonment is always high urgency
    const urgency: UrgencyLevel = 'critical';
    const now = new Date();

    const abandonment: AbandonedAction = {
      id: uuidv4(),
      userId,
      type: 'payment',
      context,
      intentDetected: 'payment_intent',
      urgency,
      decayScore: this.decayConfig.initialScore,
      createdAt: now,
      reminderCount: 0,
      resolved: false,
      metadata: { orderId: orderDetails.orderId },
    };

    this.store.add(abandonment);
    console.log(`[AbandonmentTracker] Tracked payment abandonment: ${abandonment.id}`);

    // Immediate re-engagement for payment abandonment
    this.scheduleReEngagement(abandonment);

    return abandonment;
  }

  /**
   * Calculate current decay score for an abandonment
   */
  calculateDecay(abandonment: AbandonedAction): number {
    return calculateDecay(abandonment.createdAt, abandonment.type, this.decayConfig);
  }

  /**
   * Update decay scores for all active abandonments
   */
  updateAllDecayScores(): AbandonedAction[] {
    const updated: AbandonedAction[] = [];

    for (const abandonment of this.store.getUnresolved()) {
      const newDecay = calculateDecay(abandonment.createdAt, abandonment.type, this.decayConfig);
      const newUrgency = getUrgencyFromDecay(newDecay);

      if (newDecay !== abandonment.decayScore) {
        abandonment.decayScore = newDecay;
        abandonment.urgency = newUrgency;
        this.store.update(abandonment);
        updated.push(abandonment);
      }
    }

    return updated;
  }

  /**
   * Get all urgent abandonments requiring attention
   */
  getUrgentAbandonments(): AbandonedAction[] {
    const urgent: AbandonedAction[] = [];
    const now = new Date();

    for (const abandonment of this.store.getUnresolved()) {
      // Update decay score
      const decay = calculateDecay(abandonment.createdAt, abandonment.type, this.decayConfig);
      abandonment.decayScore = decay;
      abandonment.urgency = getUrgencyFromDecay(decay);

      // Check if urgency thresholds are met for reminders
      const reminderDelays = REMINDER_DELAYS_HOURS[abandonment.urgency];
      const hoursSinceCreation = (now.getTime() - abandonment.createdAt.getTime()) / (1000 * 60 * 60);
      const maxReminders = REMINDER_THRESHOLDS[abandonment.urgency];

      // Check if we should trigger a reminder
      if (abandonment.reminderCount < maxReminders) {
        for (const delay of reminderDelays) {
          if (
            hoursSinceCreation >= delay &&
            (!abandonment.lastReminderAt || abandonment.lastReminderAt.getTime() < abandonment.createdAt.getTime() + delay * 60 * 60 * 1000)
          ) {
            urgent.push(abandonment);
            break;
          }
        }
      }
    }

    // Sort by urgency (critical first) then by decay (lowest first = coldest)
    urgent.sort((a, b) => {
      const urgencyOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      const urgencyDiff = urgencyOrder[a.urgency] - urgencyOrder[b.urgency];
      if (urgencyDiff !== 0) return urgencyDiff;
      return a.decayScore - b.decayScore;
    });

    return urgent;
  }

  /**
   * Trigger re-engagement for a specific abandonment
   */
  async triggerReEngagement(
    abandonmentId: string,
    channel?: ReEngagementChannel,
    offer?: ReEngagementOffer
  ): Promise<ReEngagementTrigger | null> {
    const abandonment = this.store.get(abandonmentId);
    if (!abandonment || abandonment.resolved) {
      console.log(`[AbandonmentTracker] Cannot trigger re-engagement: ${abandonmentId} not found or resolved`);
      return null;
    }

    // Determine best channel if not specified
    const targetChannel = channel || this.determineBestChannel(abandonment);
    const template = messageTemplates[abandonment.type];

    // Generate message based on channel
    let message: string;
    let title: string | undefined;
    let subject: string | undefined;

    switch (targetChannel) {
      case 'whatsapp':
        message = template.whatsapp(abandonment.context, offer);
        break;
      case 'push':
        const pushContent = template.push(abandonment.context, offer);
        title = pushContent.title;
        message = pushContent.body;
        break;
      case 'sms':
        message = template.sms(abandonment.context, offer);
        break;
      case 'email':
        const emailContent = template.email(abandonment.context, offer);
        subject = emailContent.subject;
        message = emailContent.body;
        break;
      default:
        message = template.whatsapp(abandonment.context, offer);
    }

    const trigger: ReEngagementTrigger = {
      abandonmentId,
      userId: abandonment.userId,
      channel: targetChannel,
      message,
      offer,
      scheduledAt: new Date(),
      status: 'pending',
    };

    // Send notification
    try {
      let success = false;

      switch (targetChannel) {
        case 'whatsapp':
          success = await this.notificationService.sendWhatsApp(abandonment.userId, message);
          break;
        case 'push':
          success = await this.notificationService.sendPush(abandonment.userId, title!, message);
          break;
        case 'sms':
          success = await this.notificationService.sendSMS(abandonment.userId, message);
          break;
        case 'email':
          success = await this.notificationService.sendEmail(abandonment.userId, subject!, message);
          break;
      }

      trigger.status = success ? 'sent' : 'failed';
      trigger.sentAt = success ? new Date() : undefined;

      // Update abandonment tracking
      abandonment.reminderCount += 1;
      abandonment.lastReminderAt = new Date();
      this.store.update(abandonment);
      this.store.addTrigger(trigger);

      console.log(`[AbandonmentTracker] Re-engagement triggered: ${abandonmentId} via ${targetChannel}`);

      return trigger;
    } catch (error) {
      console.error(`[AbandonmentTracker] Failed to trigger re-engagement:`, error);
      trigger.status = 'failed';
      this.store.addTrigger(trigger);
      return trigger;
    }
  }

  /**
   * Mark an abandonment as resolved
   */
  resolveAbandonment(abandonmentId: string, metadata?: Record<string, unknown>): AbandonedAction | null {
    const abandonment = this.store.get(abandonmentId);
    if (!abandonment) {
      console.log(`[AbandonmentTracker] Cannot resolve: ${abandonmentId} not found`);
      return null;
    }

    abandonment.resolved = true;
    abandonment.resolvedAt = new Date();
    if (metadata) {
      abandonment.metadata = { ...abandonment.metadata, ...metadata };
    }

    this.store.update(abandonment);
    console.log(`[AbandonmentTracker] Abandonment resolved: ${abandonmentId}`);

    return abandonment;
  }

  /**
   * Get abandonment statistics for a period
   */
  getAbandonmentStats(period: 'day' | 'week' | 'month' | 'all' = 'all'): AbandonmentStats {
    const now = new Date();
    let periodStart: Date | null = null;

    switch (period) {
      case 'day':
        periodStart = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case 'week':
        periodStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        periodStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case 'all':
        periodStart = null;
        break;
    }

    const abandonments = this.store.getAll().filter(a =>
      periodStart ? a.createdAt >= periodStart : true
    );

    const stats: AbandonmentStats = {
      total: abandonments.length,
      resolved: abandonments.filter(a => a.resolved).length,
      unresolved: abandonments.filter(a => !a.resolved).length,
      byType: {
        search: 0,
        cart: 0,
        view: 0,
        payment: 0,
      },
      byUrgency: {
        critical: 0,
        high: 0,
        medium: 0,
        low: 0,
      },
      averageDecayScore: 0,
      reEngagementRate: 0,
      conversionRate: 0,
    };

    // Calculate type distribution
    for (const a of abandonments) {
      stats.byType[a.type]++;
      stats.byUrgency[a.urgency]++;
    }

    // Calculate average decay score (only unresolved)
    const unresolved = abandonments.filter(a => !a.resolved);
    if (unresolved.length > 0) {
      stats.averageDecayScore = unresolved.reduce((sum, a) => sum + this.calculateDecay(a), 0) / unresolved.length;
    }

    // Calculate re-engagement rate (abandonments with at least 1 reminder / total unresolved)
    const withReminders = abandonments.filter(a => !a.resolved && a.reminderCount > 0).length;
    stats.reEngagementRate = unresolved.length > 0 ? (withReminders / unresolved.length) * 100 : 0;

    // Calculate conversion rate (resolved / total with reminders)
    const resolvedWithReminders = abandonments.filter(a => a.resolved && a.reminderCount > 0).length;
    stats.conversionRate = withReminders > 0 ? (resolvedWithReminders / withReminders) * 100 : 0;

    // Round decimals
    stats.averageDecayScore = Math.round(stats.averageDecayScore * 100) / 100;
    stats.reEngagementRate = Math.round(stats.reEngagementRate * 100) / 100;
    stats.conversionRate = Math.round(stats.conversionRate * 100) / 100;

    return stats;
  }

  /**
   * Get abandonments by user ID
   */
  getUserAbandonments(userId: string): AbandonedAction[] {
    return this.store.getByUser(userId);
  }

  /**
   * Get abandonment by ID
   */
  getAbandonment(id: string): AbandonedAction | undefined {
    return this.store.get(id);
  }

  /**
   * Get all abandonments of a specific type
   */
  getAbandonmentsByType(type: AbandonmentType): AbandonedAction[] {
    return this.store.getByType(type);
  }

  /**
   * Schedule automatic re-engagement for an abandonment
   */
  private scheduleReEngagement(abandonment: AbandonedAction): void {
    const delays = REMINDER_DELAYS_HOURS[abandonment.urgency];
    if (delays.length === 0) return;

    // Schedule the first reminder
    const firstDelay = delays[0];
    const scheduledTime = new Date(abandonment.createdAt.getTime() + firstDelay * 60 * 60 * 1000);

    console.log(`[AbandonmentTracker] Scheduled re-engagement for ${abandonment.id} at ${scheduledTime.toISOString()}`);

    // In production, this would integrate with a job scheduler (e.g., Bull, Agenda)
    // For now, we'll track it and let the caller handle scheduling
    const trigger: ReEngagementTrigger = {
      abandonmentId: abandonment.id,
      userId: abandonment.userId,
      channel: this.determineBestChannel(abandonment),
      message: '',
      scheduledAt: scheduledTime,
      status: 'pending',
    };

    this.store.addTrigger(trigger);
  }

  /**
   * Determine the best channel for re-engagement based on abandonment type and urgency
   */
  private determineBestChannel(abandonment: AbandonedAction): ReEngagementChannel {
    // Critical/High urgency -> WhatsApp (immediate, personal)
    if (abandonment.urgency === 'critical' || abandonment.urgency === 'high') {
      return 'whatsapp';
    }

    // Payment abandonment -> SMS (urgent, reliable)
    if (abandonment.type === 'payment') {
      return 'sms';
    }

    // Cart abandonment -> WhatsApp (personal, high conversion)
    if (abandonment.type === 'cart') {
      return 'whatsapp';
    }

    // Search/View abandonment -> Push (non-intrusive)
    return 'push';
  }

  /**
   * Generate offer based on abandonment type and urgency
   */
  generateOffer(abandonment: AbandonedAction): ReEngagementOffer | undefined {
    const baseOffers: Record<AbandonmentType, ReEngagementOffer> = {
      search: { discount: 0, coins: 50, freeTrial: false },
      view: { discount: 5, coins: 25, freeTrial: false },
      cart: { discount: 10, coins: 100, freeTrial: false },
      payment: { discount: 15, coins: 150, freeTrial: false },
    };

    const baseOffer = baseOffers[abandonment.type];

    // Increase offer for lower decay scores (colder leads)
    const urgencyMultiplier: Record<UrgencyLevel, number> = {
      critical: 1.5,
      high: 1.2,
      medium: 1,
      low: 0.8,
    };

    const multiplier = urgencyMultiplier[abandonment.urgency];

    return {
      discount: Math.round(baseOffer.discount * multiplier),
      coins: Math.round(baseOffer.coins * multiplier),
      freeTrial: baseOffer.freeTrial,
    };
  }

  /**
   * Clear all stored data (for testing)
   */
  clear(): void {
    this.store.clear();
  }

  /**
   * Get all pending triggers
   */
  getPendingTriggers(): ReEngagementTrigger[] {
    return this.store.getPendingTriggers();
  }

  /**
   * Update trigger status
   */
  updateTriggerStatus(
    abandonmentId: string,
    status: ReEngagementTrigger['status']
  ): ReEngagementTrigger | null {
    const trigger = this.store.getTrigger(abandonmentId);
    if (!trigger) return null;

    trigger.status = status;

    if (status === 'delivered') {
      trigger.deliveredAt = new Date();
    } else if (status === 'clicked') {
      trigger.clickedAt = new Date();
    } else if (status === 'converted') {
      trigger.convertedAt = new Date();
      // Auto-resolve the abandonment
      this.resolveAbandonment(abandonmentId, { converted: true, channel: trigger.channel });
    }

    this.store.updateTrigger(trigger);
    return trigger;
  }
}

// ============================================================================
// Factory Function
// ============================================================================

let serviceInstance: AbandonmentTrackerService | null = null;

export function createAbandonmentTrackerService(
  notificationService?: NotificationService
): AbandonmentTrackerService {
  if (serviceInstance) {
    console.log('[AbandonmentTracker] Returning existing service instance');
    return serviceInstance;
  }

  serviceInstance = new AbandonmentTrackerService(notificationService);
  return serviceInstance;
}

export function getAbandonmentTrackerService(): AbandonmentTrackerService {
  if (!serviceInstance) {
    return createAbandonmentTrackerService();
  }
  return serviceInstance;
}

// ============================================================================
// Default Export
// ============================================================================

export default AbandonmentTrackerService;
