import mongoose, { Schema, Document } from 'mongoose';

export type SessionState =
  | 'INIT'
  | 'BROWSE'
  | 'SEARCH'
  | 'VIEW_PRODUCT'
  | 'ADD_TO_CART'
  | 'VIEW_CART'
  | 'CHECKOUT'
  | 'SELECT_ADDRESS'
  | 'SELECT_PAYMENT'
  | 'ORDER_CONFIRMATION'
  | 'TRACK_ORDER'
  | 'HELP'
  | 'END';

export type Intent =
  | 'BROWSE_CATALOG'
  | 'SEARCH_PRODUCTS'
  | 'VIEW_PRODUCT'
  | 'ADD_TO_CART'
  | 'UPDATE_CART'
  | 'REMOVE_FROM_CART'
  | 'VIEW_CART'
  | 'CHECKOUT'
  | 'SELECT_ADDRESS'
  | 'SELECT_PAYMENT_METHOD'
  | 'PAY'
  | 'CONFIRM_ORDER'
  | 'VIEW_ORDERS'
  | 'TRACK_ORDER'
  | 'CANCEL_ORDER'
  | 'RETURN_ORDER'
  | 'CONTACT_SUPPORT'
  | 'EXIT';

export interface IConversationContext {
  currentProductId?: string;
  currentCategory?: string;
  currentCartId?: string;
  currentOrderId?: string;
  searchQuery?: string;
  selectedVariantId?: string;
  recentViews: string[];
  recentOrders: string[];
  pendingAction?: string;
}

export interface IMessage {
  messageId: string;
  direction: 'INBOUND' | 'OUTBOUND';
  content: string;
  type: 'TEXT' | 'IMAGE' | 'INTERACTIVE' | 'LOCATION' | 'DOCUMENT';
  timestamp: Date;
  whatsappMessageId?: string;
  metadata?: Record<string, unknown>;
}

export interface ICustomerSession extends Document {
  _id: mongoose.Types.ObjectId;
  sessionId: string;
  customerId: string;
  customerPhone: string;
  customerName?: string;
  merchantId: string;
  whatsappPhone: string;
  state: SessionState;
  previousState?: SessionState;
  intent: Intent;
  previousIntent?: Intent;
  context: IConversationContext;
  messages: IMessage[];
  language: string;
  isActive: boolean;
  lastActivityAt: Date;
  expiresAt: Date;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const ConversationContextSchema = new Schema<IConversationContext>(
  {
    currentProductId: String,
    currentCategory: String,
    currentCartId: String,
    currentOrderId: String,
    searchQuery: String,
    selectedVariantId: String,
    recentViews: [String],
    recentOrders: [String],
    pendingAction: String,
  },
  { _id: false }
);

const MessageSchema = new Schema<IMessage>(
  {
    messageId: {
      type: String,
      required: true,
    },
    direction: {
      type: String,
      enum: ['INBOUND', 'OUTBOUND'],
      required: true,
    },
    content: {
      type: String,
      required: true,
    },
    type: {
      type: String,
      enum: ['TEXT', 'IMAGE', 'INTERACTIVE', 'LOCATION', 'DOCUMENT'],
      default: 'TEXT',
    },
    timestamp: {
      type: Date,
      required: true,
      default: Date.now,
    },
    whatsappMessageId: String,
    metadata: {
      type: Map,
      of: Schema.Types.Mixed,
    },
  },
  { _id: false }
);

const CustomerSessionSchema = new Schema<ICustomerSession>(
  {
    sessionId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    customerId: {
      type: String,
      required: true,
      index: true,
    },
    customerPhone: {
      type: String,
      required: true,
      index: true,
    },
    customerName: String,
    merchantId: {
      type: String,
      required: true,
      index: true,
    },
    whatsappPhone: {
      type: String,
      required: true,
    },
    state: {
      type: String,
      enum: Object.values(SessionState),
      default: 'INIT',
      index: true,
    },
    previousState: {
      type: String,
      enum: Object.values(SessionState),
    },
    intent: {
      type: String,
      enum: Object.values(Intent),
      default: 'BROWSE_CATALOG',
      index: true,
    },
    previousIntent: {
      type: String,
      enum: Object.values(Intent),
    },
    context: {
      type: ConversationContextSchema,
      default: () => ({
        recentViews: [],
        recentOrders: [],
      }),
    },
    messages: [MessageSchema],
    language: {
      type: String,
      default: 'en',
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    lastActivityAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: true,
    },
    metadata: {
      type: Map,
      of: Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (_doc, ret) => {
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Compound indexes
CustomerSessionSchema.index({ customerId: 1, merchantId: 1, isActive: 1 });
CustomerSessionSchema.index({ customerPhone: 1, merchantId: 1 });
CustomerSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // TTL index
CustomerSessionSchema.index({ state: 1, lastActivityAt: -1 });
CustomerSessionSchema.index({ merchantId: 1, isActive: 1 });

// Pre-save hook to update lastActivityAt
CustomerSessionSchema.pre('save', function (next) {
  this.lastActivityAt = new Date();
  next();
});

// Method to transition state
CustomerSessionSchema.methods.transitionState = function (
  newState: SessionState,
  newIntent?: Intent
): void {
  this.previousState = this.state;
  this.state = newState;
  if (newIntent) {
    this.previousIntent = this.intent;
    this.intent = newIntent;
  }
};

// Method to add message to conversation
CustomerSessionSchema.methods.addMessage = function (
  message: Omit<IMessage, 'messageId' | 'timestamp'>
): void {
  const { v4: uuidv4 } = require('uuid') as { v4: () => string };
  this.messages.push({
    ...message,
    messageId: uuidv4(),
    timestamp: new Date(),
  });
};

// Method to add viewed product to recent views
CustomerSessionSchema.methods.addToRecentViews = function (
  productId: string
): void {
  if (!this.context.recentViews) {
    this.context.recentViews = [];
  }
  // Remove if already exists
  this.context.recentViews = this.context.recentViews.filter(
    (id) => id !== productId
  );
  // Add to front
  this.context.recentViews.unshift(productId);
  // Keep only last 10
  this.context.recentViews = this.context.recentViews.slice(0, 10);
};

// Method to add order to recent orders
CustomerSessionSchema.methods.addToRecentOrders = function (
  orderId: string
): void {
  if (!this.context.recentOrders) {
    this.context.recentOrders = [];
  }
  // Remove if already exists
  this.context.recentOrders = this.context.recentOrders.filter(
    (id) => id !== orderId
  );
  // Add to front
  this.context.recentOrders.unshift(orderId);
  // Keep only last 5
  this.context.recentOrders = this.context.recentOrders.slice(0, 5);
};

// Method to reset session
CustomerSessionSchema.methods.reset = function (): void {
  this.state = 'INIT';
  this.previousState = undefined;
  this.intent = 'BROWSE_CATALOG';
  this.previousIntent = undefined;
  this.context = {
    recentViews: [],
    recentOrders: [],
  };
  this.messages = [];
  this.lastActivityAt = new Date();
};

// Method to extend session expiry
CustomerSessionSchema.methods.extendExpiry = function (
  hours: number = 24
): void {
  this.expiresAt = new Date(Date.now() + hours * 60 * 60 * 1000);
  this.isActive = true;
};

// Static method to find or create session
CustomerSessionSchema.statics.findOrCreate = async function (
  customerId: string,
  customerPhone: string,
  merchantId: string,
  whatsappPhone: string
): Promise<ICustomerSession> {
  let session = await this.findOne({
    customerId,
    merchantId,
    isActive: true,
  });

  if (!session) {
    const { v4: uuidv4 } = await import('uuid');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
    session = await this.create({
      sessionId: uuidv4(),
      customerId,
      customerPhone,
      merchantId,
      whatsappPhone,
      state: 'INIT',
      intent: 'BROWSE_CATALOG',
      context: {
        recentViews: [],
        recentOrders: [],
      },
      messages: [],
      language: 'en',
      isActive: true,
      lastActivityAt: new Date(),
      expiresAt,
      metadata: {},
    });
  } else {
    // Extend expiry
    session.extendExpiry();
  }

  return session;
};

// Static method to get active sessions count
CustomerSessionSchema.statics.getActiveSessionsCount = async function (
  merchantId: string
): Promise<number> {
  return this.countDocuments({
    merchantId,
    isActive: true,
    expiresAt: { $gt: new Date() },
  });
};

export const CustomerSession = mongoose.model<ICustomerSession>(
  'CustomerSession',
  CustomerSessionSchema
);

export { CustomerSessionSchema };
export type { IConversationContext, IMessage, ConversationContextSchema };
