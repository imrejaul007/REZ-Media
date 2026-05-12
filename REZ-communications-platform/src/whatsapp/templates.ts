/**
 * WhatsApp Business API Message Templates
 *
 * These templates define the structure for automated WhatsApp messages
 * sent through the Twilio WhatsApp Business API.
 *
 * Each template includes:
 * - id: Unique identifier
 * - name: Human-readable name
 * - twilioContentSid: Twilio Content SID for approved templates
 * - category: Message category (MARKETING, UTILITY, AUTHENTICATION)
 * - body: Template string with {{variable}} placeholders
 * - requiredVariables: List of required variables
 * - defaults: Default values for optional variables
 * - validFor: How long the template remains relevant (in milliseconds)
 */

export type WhatsAppTemplateType =
  | 'order_confirmation'
  | 'delivery_update'
  | 'appointment_reminder'
  | 'abandonment_recovery'
  | 'win_back'
  | 'campaign_promotion';

export interface WhatsAppTemplate {
  id: WhatsAppTemplateType;
  name: string;
  twilioContentSid: string;
  category: 'MARKETING' | 'UTILITY' | 'AUTHENTICATION';
  description: string;
  body: string;
  requiredVariables: string[];
  optionalVariables: string[];
  defaults: Record<string, string>;
  validFor: number; // milliseconds
  restrictions?: {
    minAge?: number;
    maxAge?: number;
    requiresUserConsent?: boolean;
  };
}

export interface TemplateVariables {
  [key: string]: string;
}

/**
 * Template registry containing all available WhatsApp message templates.
 *
 * NOTE: TwilioContentSid values must be replaced with actual SIDs
 * obtained from Twilio's Content Editor API after template approval.
 *
 * In development/testing, you can use the sandbox template format.
 */
export const WHATSAPP_TEMPLATES: Record<WhatsAppTemplateType, WhatsAppTemplate> = {
  /**
   * Order Confirmation Template
   * Sent when a customer places an order successfully.
   * Category: UTILITY
   */
  order_confirmation: {
    id: 'order_confirmation',
    name: 'Order Confirmation',
    twilioContentSid: 'HXaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', // Replace with actual SID
    category: 'UTILITY',
    description: 'Sent when a customer successfully places an order',
    body: `Your order #{{1}} has been confirmed! 🎉\n\n{{2}}\nTotal: {{3}}\n\nWe'll notify you when it's ready for {{4}}. Track your order in the app.`,
    requiredVariables: ['orderId', 'items', 'total', 'deliveryType'],
    optionalVariables: ['estimatedTime', 'specialInstructions'],
    defaults: {
      orderId: '',
      items: '',
      total: '',
      deliveryType: 'delivery',
      estimatedTime: '20-30 minutes',
    },
    validFor: 24 * 60 * 60 * 1000, // 24 hours
    restrictions: {
      requiresUserConsent: false,
    },
  },

  /**
   * Delivery Update Template
   * Sent to provide real-time delivery status updates.
   * Category: UTILITY
   */
  delivery_update: {
    id: 'delivery_update',
    name: 'Delivery Update',
    twilioContentSid: 'HXbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb', // Replace with actual SID
    category: 'UTILITY',
    description: 'Sent to update customers on delivery progress',
    body: `📍 Delivery Update\n\nOrder #{{1}}\n\nStatus: {{2}}\n\n{{3}}\n\nQuestions? Reply to this message or call us at {{4}}.`,
    requiredVariables: ['orderId', 'status', 'message', 'supportPhone'],
    optionalVariables: ['driverName', 'eta', 'location'],
    defaults: {
      orderId: '',
      status: 'In Progress',
      message: 'Your order is being prepared',
      supportPhone: '+1-800-REZ-HELP',
      driverName: 'Your driver',
      eta: '10-15 minutes',
    },
    validFor: 60 * 60 * 1000, // 1 hour
    restrictions: {
      requiresUserConsent: false,
    },
  },

  /**
   * Appointment Reminder Template
   * Sent to remind customers of upcoming appointments.
   * Category: UTILITY
   */
  appointment_reminder: {
    id: 'appointment_reminder',
    name: 'Appointment Reminder',
    twilioContentSid: 'HXcccccccccccccccccccccccccccccccc', // Replace with actual SID
    category: 'UTILITY',
    description: 'Reminds customers of upcoming appointments',
    body: `⏰ Appointment Reminder\n\nHi {{1}}!\n\nThis is a reminder for your {{2}} appointment:\n\n📅 {{3}}\n🕐 {{4}}\n📍 {{5}}\n\nReply CONFIRM to confirm or RESCHEDULE to change the time.\n\nSee you soon!`,
    requiredVariables: ['customerName', 'serviceType', 'date', 'time', 'location'],
    optionalVariables: ['providerName', 'preparationInstructions', 'cancellationPolicy'],
    defaults: {
      customerName: 'there',
      serviceType: '',
      date: '',
      time: '',
      location: 'our location',
      providerName: 'your service provider',
    },
    validFor: 7 * 24 * 60 * 60 * 1000, // 7 days
    restrictions: {
      requiresUserConsent: false,
    },
  },

  /**
   * Abandonment Recovery Template
   * Sent to recover abandoned carts/checkouts.
   * Category: MARKETING
   */
  abandonment_recovery: {
    id: 'abandonment_recovery',
    name: 'Abandonment Recovery',
    twilioContentSid: 'HXdddddddddddddddddddddddddddddddd', // Replace with actual SID
    category: 'MARKETING',
    description: 'Re-engages customers who abandoned checkout',
    body: `😟 Did you forget something?\n\nYour cart is waiting for you!\n\n{{1}}\n\nSubtotal: {{2}}\n\nComplete your order in the next {{3}} and get {{4}}!\n\n👇 Tap to complete:\n{{5}}`,
    requiredVariables: ['cartItems', 'subtotal', 'validityPeriod', 'promoOffer', 'checkoutLink'],
    optionalVariables: ['expiryTime', 'loyaltyPoints'],
    defaults: {
      cartItems: '',
      subtotal: '',
      validityPeriod: '24 hours',
      promoOffer: 'free delivery',
      checkoutLink: 'https://app.rez.com/cart',
      expiryTime: '24 hours',
    },
    validFor: 48 * 60 * 60 * 1000, // 48 hours
    restrictions: {
      requiresUserConsent: true,
    },
  },

  /**
   * Win-Back Campaign Template
   * Sent to re-engage inactive/lapsed customers.
   * Category: MARKETING
   */
  win_back: {
    id: 'win_back',
    name: 'Win Back',
    twilioContentSid: 'HXeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee', // Replace with actual SID
    category: 'MARKETING',
    description: 'Re-engages lapsed customers with special offers',
    body: `{{1}} We miss you! 👋\n\nIt's been a while since your last order from {{2}}.\n\nAs a thank you, here's an exclusive offer just for you:\n\n🎁 {{3}} OFF your next order\n\nUse code: {{4}}\n\nValid for {{5}}. Order now!`,
    requiredVariables: ['customerName', 'restaurantName', 'discountPercent', 'promoCode', 'validity'],
    optionalVariables: ['lastOrderDate', 'favoriteItems', 'newMenuItems'],
    defaults: {
      customerName: 'there',
      restaurantName: 'our restaurant',
      discountPercent: '20%',
      promoCode: 'WELCOME BACK',
      validity: '7 days',
      lastOrderDate: '',
    },
    validFor: 7 * 24 * 60 * 60 * 1000, // 7 days
    restrictions: {
      requiresUserConsent: true,
      minAge: 18,
    },
  },

  /**
   * Campaign Promotion Template
   * Sent for promotional campaigns and marketing.
   * Category: MARKETING
   */
  campaign_promotion: {
    id: 'campaign_promotion',
    name: 'Campaign Promotion',
    twilioContentSid: 'HXffffffffffffffffffffffffffffffff', // Replace with actual SID
    category: 'MARKETING',
    description: 'General promotional messages for campaigns',
    body: `{{1}}\n\n{{2}}\n\n{{3}}\n\n{{4}}\n\nValid {{5}}. T&Cs apply.\n\nUnsubscribe: Reply STOP`,
    requiredVariables: ['headline', 'promoDetails', 'cta', 'promoCode', 'validityPeriod'],
    optionalVariables: ['imageUrl', 'termsUrl', 'expiryDate'],
    defaults: {
      headline: 'Special Offer',
      promoDetails: '',
      cta: 'Order now!',
      promoCode: '',
      validityPeriod: 'while stocks last',
      termsUrl: 'https://rez.com/terms',
    },
    validFor: 14 * 24 * 60 * 60 * 1000, // 14 days
    restrictions: {
      requiresUserConsent: true,
    },
  },
};

/**
 * Get all available templates
 */
export function getWhatsAppTemplates(): Record<WhatsAppTemplateType, WhatsAppTemplate> {
  return { ...WHATSAPP_TEMPLATES };
}

/**
 * Get a specific template by type
 */
export function getTemplate(type: WhatsAppTemplateType): WhatsAppTemplate | undefined {
  return WHATSAPP_TEMPLATES[type];
}

/**
 * Validate template variables
 * Returns an array of missing required variables
 */
export function validateTemplateVariables(
  type: WhatsAppTemplateType,
  variables: TemplateVariables
): string[] {
  const template = WHATSAPP_TEMPLATES[type];

  if (!template) {
    return [`Unknown template type: ${type}`];
  }

  const missing: string[] = [];

  for (const required of template.requiredVariables) {
    if (!variables[required] || variables[required].trim() === '') {
      missing.push(required);
    }
  }

  return missing;
}

/**
 * Fill template with variables
 * Replaces placeholders with actual values
 */
export function fillTemplate(
  type: WhatsAppTemplateType,
  variables: TemplateVariables
): { success: boolean; body?: string; error?: string } {
  const template = WHATSAPP_TEMPLATES[type];

  if (!template) {
    return { success: false, error: `Unknown template type: ${type}` };
  }

  const missing = validateTemplateVariables(type, variables);
  if (missing.length > 0) {
    return {
      success: false,
      error: `Missing required variables: ${missing.join(', ')}`,
    };
  }

  // Merge with defaults
  const merged = { ...template.defaults, ...variables };

  // Replace placeholders
  let body = template.body;
  const processedVariables: Record<number, string> = {};

  let varIndex = 1;
  for (const required of template.requiredVariables) {
    processedVariables[varIndex] = merged[required] || '';
    varIndex++;
  }

  for (const optional of template.optionalVariables) {
    if (merged[optional]) {
      processedVariables[varIndex] = merged[optional];
    }
    varIndex++;
  }

  // Replace numbered placeholders
  for (const [num, value] of Object.entries(processedVariables)) {
    body = body.replace(new RegExp(`\\{\\{${num}\\}\\}`, 'g'), value);
  }

  // Replace named placeholders (for legacy support)
  for (const [key, value] of Object.entries(merged)) {
    body = body.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
  }

  return { success: true, body };
}

/**
 * Template builder for programmatic template creation
 */
export class TemplateBuilder {
  private template: Partial<WhatsAppTemplate>;
  private type: WhatsAppTemplateType;

  constructor(type: WhatsAppTemplateType) {
    this.type = type;
    this.template = {
      id: type,
      requiredVariables: [],
      optionalVariables: [],
      defaults: {},
    };
  }

  name(name: string): TemplateBuilder {
    this.template.name = name;
    return this;
  }

  description(description: string): TemplateBuilder {
    this.template.description = description;
    return this;
  }

  body(body: string): TemplateBuilder {
    this.template.body = body;
    // Auto-detect variables from {{variable}} patterns
    const matches = body.match(/\{\{(\w+)\}\}/g);
    if (matches) {
      this.template.requiredVariables = matches.map((m) =>
        m.replace(/\{\{|\}\}/g, '')
      );
    }
    return this;
  }

  category(category: 'MARKETING' | 'UTILITY' | 'AUTHENTICATION'): TemplateBuilder {
    this.template.category = category;
    return this;
  }

  required(...vars: string[]): TemplateBuilder {
    this.template.requiredVariables = vars;
    return this;
  }

  optional(...vars: string[]): TemplateBuilder {
    this.template.optionalVariables = vars;
    return this;
  }

  defaults(defaults: Record<string, string>): TemplateBuilder {
    this.template.defaults = { ...this.template.defaults, ...defaults };
    return this;
  }

  twilioContentSid(sid: string): TemplateBuilder {
    this.template.twilioContentSid = sid;
    return this;
  }

  validFor(ms: number): TemplateBuilder {
    this.template.validFor = ms;
    return this;
  }

  build(): WhatsAppTemplate {
    const base = WHATSAPP_TEMPLATES[this.type];
    return {
      ...base,
      ...this.template,
    } as WhatsAppTemplate;
  }
}

/**
 * Export template metadata for analytics
 */
export interface TemplateAnalytics {
  type: WhatsAppTemplateType;
  name: string;
  category: string;
  averageDeliveryRate: number;
  averageOpenRate: number;
  averageConversionRate: number;
  lastUsed: Date | null;
  totalSends: number;
}

export function getTemplateAnalytics(): TemplateAnalytics[] {
  // This would typically come from a database
  return Object.values(WHATSAPP_TEMPLATES).map((template) => ({
    type: template.id,
    name: template.name,
    category: template.category,
    averageDeliveryRate: 0.95, // Placeholder
    averageOpenRate: 0.85, // Placeholder
    averageConversionRate: 0.12, // Placeholder
    lastUsed: null,
    totalSends: 0,
  }));
}

/**
 * Webhook event types from Twilio
 */
export interface WhatsAppWebhookEvent {
  MessageSid: string;
  AccountSid: string;
  MessagingServiceSid?: string;
  From: string;
  To: string;
  Body: string;
  NumMedia: string;
  MediaContentType0?: string;
  MediaUrl0?: string;
  Latitude?: string;
  Longitude?: string;
}

/**
 * Message status callback types
 */
export type MessageStatus = 'queued' | 'sent' | 'delivered' | 'read' | 'failed' | 'undelivered';

export interface MessageStatusCallback {
  MessageSid: string;
  MessageStatus: MessageStatus;
  ErrorCode?: string;
  ErrorMessage?: string;
  To?: string;
}
