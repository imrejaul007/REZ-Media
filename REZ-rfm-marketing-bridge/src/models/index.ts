import mongoose, { Schema, Document } from 'mongoose';
import { SegmentType, SegmentPriority, CampaignType, CampaignStatus } from '../types';

// RFM Score Model
export interface IRFMScore extends Document {
  customerId: string;
  businessId: string;
  recency: number;
  frequency: number;
  monetary: number;
  rfmScore: number;
  lastPurchaseDate: Date;
  totalPurchases: number;
  totalSpent: number;
  averageOrderValue: number;
  calculatedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const RFMScoreSchema = new Schema<IRFMScore>(
  {
    customerId: { type: String, required: true, index: true },
    businessId: { type: String, required: true, index: true },
    recency: { type: Number, required: true, min: 1, max: 5 },
    frequency: { type: Number, required: true, min: 1, max: 5 },
    monetary: { type: Number, required: true, min: 1, max: 5 },
    rfmScore: { type: Number, required: true, min: 3, max: 15 },
    lastPurchaseDate: { type: Date, required: true },
    totalPurchases: { type: Number, required: true, default: 0 },
    totalSpent: { type: Number, required: true, default: 0 },
    averageOrderValue: { type: Number, required: true, default: 0 },
    calculatedAt: { type: Date, required: true },
  },
  {
    timestamps: true,
  }
);

// Compound index for efficient lookups
RFMScoreSchema.index({ businessId: 1, customerId: 1 }, { unique: true });
RFMScoreSchema.index({ businessId: 1, rfmScore: -1 });
RFMScoreSchema.index({ businessId: 1, recency: 1, frequency: 1, monetary: 1 });

// Segment Definition Model
export interface ISegment extends Document {
  businessId: string;
  type: SegmentType;
  name: string;
  description: string;
  rfmRange: {
    min: number;
    max: number;
  };
  criteria: {
    recencyMin?: number;
    recencyMax?: number;
    frequencyMin?: number;
    frequencyMax?: number;
    monetaryMin?: number;
    monetaryMax?: number;
  };
  priority: SegmentPriority;
  customerCount: number;
  averageOrderValue?: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const SegmentSchema = new Schema<ISegment>(
  {
    businessId: { type: String, required: true, index: true },
    type: {
      type: String,
      required: true,
      enum: Object.values(SegmentType),
      index: true,
    },
    name: { type: String, required: true },
    description: { type: String, required: true },
    rfmRange: {
      min: { type: Number, required: true },
      max: { type: Number, required: true },
    },
    criteria: {
      recencyMin: { type: Number },
      recencyMax: { type: Number },
      frequencyMin: { type: Number },
      frequencyMax: { type: Number },
      monetaryMin: { type: Number },
      monetaryMax: { type: Number },
    },
    priority: {
      type: Number,
      required: true,
      enum: Object.values(SegmentPriority).map(v => Number(v)),
    },
    customerCount: { type: Number, default: 0 },
    averageOrderValue: { type: Number },
    isActive: { type: Boolean, default: true },
  },
  {
    timestamps: true,
  }
);

SegmentSchema.index({ businessId: 1, type: 1 }, { unique: true });
SegmentSchema.index({ businessId: 1, priority: 1 });

// Customer Segment Assignment Model
export interface ICustomerSegment extends Document {
  customerId: string;
  businessId: string;
  segmentId: string;
  segmentType: SegmentType;
  previousSegmentType?: SegmentType;
  transitionReason?: string;
  rfmScore: {
    recency: number;
    frequency: number;
    monetary: number;
  };
  assignedAt: Date;
  lastTriggeredAt?: Date;
  campaignCount: number;
  createdAt: Date;
  updatedAt: Date;
}

const CustomerSegmentSchema = new Schema<ICustomerSegment>(
  {
    customerId: { type: String, required: true, index: true },
    businessId: { type: String, required: true, index: true },
    segmentId: { type: String, required: true },
    segmentType: {
      type: String,
      required: true,
      enum: Object.values(SegmentType),
    },
    previousSegmentType: {
      type: String,
      enum: [...Object.values(SegmentType), null],
    },
    transitionReason: { type: String },
    rfmScore: {
      recency: { type: Number, required: true },
      frequency: { type: Number, required: true },
      monetary: { type: Number, required: true },
    },
    assignedAt: { type: Date, default: Date.now },
    lastTriggeredAt: { type: Date },
    campaignCount: { type: Number, default: 0 },
  },
  {
    timestamps: true,
  }
);

CustomerSegmentSchema.index({ businessId: 1, customerId: 1 }, { unique: true });
CustomerSegmentSchema.index({ businessId: 1, segmentType: 1 });
CustomerSegmentSchema.index({ customerId: 1, segmentType: 1 });

// Campaign Template Model
export interface ICampaign extends Document {
  businessId: string;
  segmentId: string;
  segmentType: SegmentType;
  name: string;
  subject?: string;
  type: CampaignType;
  status: CampaignStatus;
  content: {
    subject?: string;
    headline: string;
    body: string;
    cta?: string;
    ctaUrl?: string;
    imageUrl?: string;
  };
  personalization: {
    includeName: boolean;
    includeLastPurchase: boolean;
    includePoints: boolean;
    includeRecommendations: boolean;
  };
  schedule: {
    type: 'immediate' | 'scheduled' | 'triggered';
    sendAt?: Date;
    timezone: string;
  };
  metrics: {
    sent: number;
    delivered: number;
    opened: number;
    clicked: number;
    converted: number;
    revenue: number;
  };
  journeyId?: string;
  journeyStep?: number;
  createdAt: Date;
  updatedAt: Date;
}

const CampaignSchema = new Schema<ICampaign>(
  {
    businessId: { type: String, required: true, index: true },
    segmentId: { type: String, required: true, index: true },
    segmentType: {
      type: String,
      required: true,
      enum: Object.values(SegmentType),
    },
    name: { type: String, required: true },
    subject: { type: String },
    type: {
      type: String,
      required: true,
      enum: Object.values(CampaignType),
    },
    status: {
      type: String,
      required: true,
      enum: Object.values(CampaignStatus),
      default: CampaignStatus.DRAFT,
    },
    content: {
      subject: { type: String },
      headline: { type: String, required: true },
      body: { type: String, required: true },
      cta: { type: String },
      ctaUrl: { type: String },
      imageUrl: { type: String },
    },
    personalization: {
      includeName: { type: Boolean, default: true },
      includeLastPurchase: { type: Boolean, default: true },
      includePoints: { type: Boolean, default: false },
      includeRecommendations: { type: Boolean, default: false },
    },
    schedule: {
      type: { type: String, enum: ['immediate', 'scheduled', 'triggered'], default: 'immediate' },
      sendAt: { type: Date },
      timezone: { type: String, default: 'Asia/Kolkata' },
    },
    metrics: {
      sent: { type: Number, default: 0 },
      delivered: { type: Number, default: 0 },
      opened: { type: Number, default: 0 },
      clicked: { type: Number, default: 0 },
      converted: { type: Number, default: 0 },
      revenue: { type: Number, default: 0 },
    },
    journeyId: { type: String },
    journeyStep: { type: Number },
  },
  {
    timestamps: true,
  }
);

CampaignSchema.index({ businessId: 1, status: 1 });
CampaignSchema.index({ businessId: 1, segmentType: 1 });
CampaignSchema.index({ segmentId: 1, status: 1 });

// Journey Mapping Model
export interface IJourneyMapping extends Document {
  businessId: string;
  journeyId: string;
  journeyName: string;
  segmentType: SegmentType;
  stepNumber: number;
  trigger: {
    type: 'entry' | 'exit' | 'transition' | 'time' | 'activity';
    condition: string;
  };
  delay: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const JourneyMappingSchema = new Schema<IJourneyMapping>(
  {
    businessId: { type: String, required: true, index: true },
    journeyId: { type: String, required: true, index: true },
    journeyName: { type: String, required: true },
    segmentType: {
      type: String,
      required: true,
      enum: Object.values(SegmentType),
    },
    stepNumber: { type: Number, required: true },
    trigger: {
      type: {
        type: String,
        required: true,
        enum: ['entry', 'exit', 'transition', 'time', 'activity'],
      },
      condition: { type: String, required: true },
    },
    delay: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  {
    timestamps: true,
  }
);

JourneyMappingSchema.index({ businessId: 1, segmentType: 1 });
JourneyMappingSchema.index({ journeyId: 1, segmentType: 1 }, { unique: true });

// Segment Transition Log Model
export interface ISegmentTransition extends Document {
  customerId: string;
  businessId: string;
  fromSegment?: SegmentType;
  toSegment: SegmentType;
  triggerType: 'rfm_recalculation' | 'manual' | 'time_based' | 'campaign';
  triggerId?: string;
  triggeredCampaign?: string;
  metadata?: Record<string, any>;
  occurredAt: Date;
  createdAt: Date;
}

const SegmentTransitionSchema = new Schema<ISegmentTransition>(
  {
    customerId: { type: String, required: true, index: true },
    businessId: { type: String, required: true, index: true },
    fromSegment: {
      type: String,
      enum: [...Object.values(SegmentType), null],
    },
    toSegment: {
      type: String,
      required: true,
      enum: Object.values(SegmentType),
    },
    triggerType: {
      type: String,
      required: true,
      enum: ['rfm_recalculation', 'manual', 'time_based', 'campaign'],
    },
    triggerId: { type: String },
    triggeredCampaign: { type: String },
    metadata: { type: Schema.Types.Mixed },
    occurredAt: { type: Date, default: Date.now },
  },
  {
    timestamps: true,
  }
);

SegmentTransitionSchema.index({ businessId: 1, toSegment: 1 });
SegmentTransitionSchema.index({ customerId: 1, occurredAt: -1 });

// Segment Health Metrics Model
export interface ISegmentHealth extends Document {
  businessId: string;
  segmentId: string;
  segmentType: SegmentType;
  date: Date;
  customerCount: number;
  newCustomers: number;
  churnedCustomers: number;
  averageOrderValue: number;
  totalRevenue: number;
  campaignCount: number;
  campaignEngagement: number;
  createdAt: Date;
}

const SegmentHealthSchema = new Schema<ISegmentHealth>(
  {
    businessId: { type: String, required: true, index: true },
    segmentId: { type: String, required: true, index: true },
    segmentType: {
      type: String,
      required: true,
      enum: Object.values(SegmentType),
    },
    date: { type: Date, required: true, index: true },
    customerCount: { type: Number, required: true, default: 0 },
    newCustomers: { type: Number, default: 0 },
    churnedCustomers: { type: Number, default: 0 },
    averageOrderValue: { type: Number, default: 0 },
    totalRevenue: { type: Number, default: 0 },
    campaignCount: { type: Number, default: 0 },
    campaignEngagement: { type: Number, default: 0 },
  },
  {
    timestamps: true,
  }
);

SegmentHealthSchema.index({ businessId: 1, segmentType: 1, date: -1 });
SegmentHealthSchema.index({ businessId: 1, date: -1 });

// Order Model (for RFM calculations)
export interface IOrder extends Document {
  orderId: string;
  customerId: string;
  businessId: string;
  items: {
    productId: string;
    name: string;
    quantity: number;
    price: number;
    total: number;
  }[];
  subtotal: number;
  tax: number;
  discount: number;
  totalAmount: number;
  status: 'pending' | 'confirmed' | 'preparing' | 'ready' | 'delivered' | 'completed' | 'cancelled';
  paymentStatus: 'pending' | 'paid' | 'failed' | 'refunded';
  createdAt: Date;
  updatedAt: Date;
}

const OrderSchema = new Schema<IOrder>(
  {
    orderId: { type: String, required: true, unique: true, index: true },
    customerId: { type: String, required: true, index: true },
    businessId: { type: String, required: true, index: true },
    items: [
      {
        productId: { type: String, required: true },
        name: { type: String, required: true },
        quantity: { type: Number, required: true },
        price: { type: Number, required: true },
        total: { type: Number, required: true },
      },
    ],
    subtotal: { type: Number, required: true },
    tax: { type: Number, default: 0 },
    discount: { type: Number, default: 0 },
    totalAmount: { type: Number, required: true },
    status: {
      type: String,
      required: true,
      enum: ['pending', 'confirmed', 'preparing', 'ready', 'delivered', 'completed', 'cancelled'],
      default: 'pending',
    },
    paymentStatus: {
      type: String,
      required: true,
      enum: ['pending', 'paid', 'failed', 'refunded'],
      default: 'pending',
    },
  },
  {
    timestamps: true,
  }
);

OrderSchema.index({ customerId: 1, businessId: 1, status: 1 });
OrderSchema.index({ businessId: 1, status: 1, createdAt: -1 });

// Customer Model (minimal for RFM)
export interface ICustomer extends Document {
  customerId: string;
  businessId: string;
  name: string;
  email?: string;
  phone?: string;
  loyaltyPoints?: number;
  createdAt: Date;
  updatedAt: Date;
}

const CustomerSchema = new Schema<ICustomer>(
  {
    customerId: { type: String, required: true, unique: true, index: true },
    businessId: { type: String, required: true, index: true },
    name: { type: String, required: true },
    email: { type: String },
    phone: { type: String },
    loyaltyPoints: { type: Number, default: 0 },
  },
  {
    timestamps: true,
  }
);

CustomerSchema.index({ businessId: 1 });

// Export models
export const RFMScoreModel = mongoose.model<IRFMScore>('RFMScore', RFMScoreSchema);
export const SegmentModel = mongoose.model<ISegment>('Segment', SegmentSchema);
export const CustomerSegmentModel = mongoose.model<ICustomerSegment>('CustomerSegment', CustomerSegmentSchema);
export const CampaignModel = mongoose.model<ICampaign>('Campaign', CampaignSchema);
export const JourneyMappingModel = mongoose.model<IJourneyMapping>('JourneyMapping', JourneyMappingSchema);
export const SegmentTransitionModel = mongoose.model<ISegmentTransition>('SegmentTransition', SegmentTransitionSchema);
export const SegmentHealthModel = mongoose.model<ISegmentHealth>('SegmentHealth', SegmentHealthSchema);
export const OrderModel = mongoose.model<IOrder>('Order', OrderSchema);
export const CustomerModel = mongoose.model<ICustomer>('Customer', CustomerSchema);

export default {
  RFMScoreModel,
  SegmentModel,
  CustomerSegmentModel,
  CampaignModel,
  JourneyMappingModel,
  SegmentTransitionModel,
  SegmentHealthModel,
  OrderModel,
  CustomerModel,
};
