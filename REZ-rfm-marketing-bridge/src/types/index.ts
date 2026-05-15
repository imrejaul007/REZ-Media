import { z } from 'zod';

// RFM Score Schema
export const RFMScoreSchema = z.object({
  customerId: z.string(),
  businessId: z.string(),
  recency: z.number().min(1).max(5),
  frequency: z.number().min(1).max(5),
  monetary: z.number().min(1).max(5),
  rfmScore: z.number().min(3).max(15),
  lastPurchaseDate: z.date(),
  totalPurchases: z.number(),
  totalSpent: z.number(),
  averageOrderValue: z.number(),
  calculatedAt: z.date(),
});

export type RFMScore = z.infer<typeof RFMScoreSchema>;

// RFM Calculation Request
export const RFMCalculationRequestSchema = z.object({
  businessId: z.string(),
  customerIds: z.array(z.string()).optional(),
  lookbackDays: z.number().min(1).max(365).default(90),
  referenceDate: z.date().optional(),
});

export type RFMCalculationRequest = z.infer<typeof RFMCalculationRequestSchema>;

// Segment Types
export enum SegmentType {
  CHAMPIONS = 'champions',
  LOYAL = 'loyal',
  POTENTIAL_LOYALIST = 'potential_loyalist',
  RECENT_CUSTOMERS = 'recent_customers',
  PROMISING = 'promising',
  AT_RISK = 'at_risk',
  CANT_LOSE_THEM = 'cant_lose_them',
  LOST = 'lost',
  HESITANT = 'hesitant',
  NEWPOLLOYAL = 'new_loyal',
}

export enum SegmentPriority {
  CRITICAL = 1,
  HIGH = 2,
  MEDIUM = 3,
  LOW = 4,
}

// Segment Definition
export const SegmentSchema = z.object({
  _id: z.string().optional(),
  businessId: z.string(),
  type: z.nativeEnum(SegmentType),
  name: z.string(),
  description: z.string(),
  rfmRange: z.object({
    min: z.number(),
    max: z.number(),
  }),
  criteria: z.object({
    recencyMin: z.number().optional(),
    recencyMax: z.number().optional(),
    frequencyMin: z.number().optional(),
    frequencyMax: z.number().optional(),
    monetaryMin: z.number().optional(),
    monetaryMax: z.number().optional(),
  }),
  priority: z.nativeEnum(SegmentPriority),
  customerCount: z.number().default(0),
  averageOrderValue: z.number().optional(),
  isActive: z.boolean().default(true),
  createdAt: z.date().default(() => new Date()),
  updatedAt: z.date().default(() => new Date()),
});

export type Segment = z.infer<typeof SegmentSchema>;

// Customer Segment Assignment
export const CustomerSegmentSchema = z.object({
  _id: z.string().optional(),
  customerId: z.string(),
  businessId: z.string(),
  segmentId: z.string(),
  segmentType: z.nativeEnum(SegmentType),
  previousSegmentType: z.nativeEnum(SegmentType).optional(),
  transitionReason: z.string().optional(),
  rfmScore: z.object({
    recency: z.number(),
    frequency: z.number(),
    monetary: z.number(),
  }),
  assignedAt: z.date().default(() => new Date()),
  lastTriggeredAt: z.date().optional(),
  campaignCount: z.number().default(0),
});

export type CustomerSegment = z.infer<typeof CustomerSegmentSchema>;

// Campaign Types
export enum CampaignType {
  EMAIL = 'email',
  SMS = 'sms',
  PUSH = 'push',
  WHATSAPP = 'whatsapp',
  AUTO = 'auto',
}

export enum CampaignStatus {
  DRAFT = 'draft',
  SCHEDULED = 'scheduled',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  PAUSED = 'paused',
}

// Campaign Template
export const CampaignTemplateSchema = z.object({
  _id: z.string().optional(),
  businessId: z.string(),
  segmentId: z.string(),
  segmentType: z.nativeEnum(SegmentType),
  name: z.string(),
  subject: z.string().optional(),
  type: z.nativeEnum(CampaignType),
  status: z.nativeEnum(CampaignStatus).default(CampaignStatus.DRAFT),
  content: z.object({
    subject: z.string().optional(),
    headline: z.string(),
    body: z.string(),
    cta: z.string().optional(),
    ctaUrl: z.string().optional(),
    imageUrl: z.string().optional(),
  }),
  personalization: z.object({
    includeName: z.boolean().default(true),
    includeLastPurchase: z.boolean().default(true),
    includePoints: z.boolean().default(false),
    includeRecommendations: z.boolean().default(false),
  }),
  schedule: z.object({
    type: z.enum(['immediate', 'scheduled', 'triggered']),
    sendAt: z.date().optional(),
    timezone: z.string().default('Asia/Kolkata'),
  }).optional(),
  metrics: z.object({
    sent: z.number().default(0),
    delivered: z.number().default(0),
    opened: z.number().default(0),
    clicked: z.number().default(0),
    converted: z.number().default(0),
    revenue: z.number().default(0),
  }).optional(),
  journeyId: z.string().optional(),
  journeyStep: z.number().optional(),
  createdAt: z.date().default(() => new Date()),
  updatedAt: z.date().default(() => new Date()),
});

export type CampaignTemplate = z.infer<typeof CampaignTemplateSchema>;

// Journey Mapping
export const JourneyMappingSchema = z.object({
  _id: z.string().optional(),
  businessId: z.string(),
  journeyId: z.string(),
  journeyName: z.string(),
  segmentType: z.nativeEnum(SegmentType),
  stepNumber: z.number(),
  trigger: z.object({
    type: z.enum(['entry', 'exit', 'transition', 'time', 'activity']),
    condition: z.string(),
  }),
  delay: z.number().default(0), // in hours
  isActive: z.boolean().default(true),
  createdAt: z.date().default(() => new Date()),
});

export type JourneyMapping = z.infer<typeof JourneyMappingSchema>;

// Segment Transition Event
export const SegmentTransitionSchema = z.object({
  _id: z.string().optional(),
  customerId: z.string(),
  businessId: z.string(),
  fromSegment: z.nativeEnum(SegmentType).nullable(),
  toSegment: z.nativeEnum(SegmentType),
  triggerType: z.enum(['rfm_recalculation', 'manual', 'time_based', 'campaign']),
  triggerId: z.string().optional(),
  triggeredCampaign: z.string().optional(),
  metadata: z.record(z.any).optional(),
  occurredAt: z.date().default(() => new Date()),
});

export type SegmentTransition = z.infer<typeof SegmentTransitionSchema>;

// Segment Health Metrics
export const SegmentHealthSchema = z.object({
  _id: z.string().optional(),
  businessId: z.string(),
  segmentId: z.string(),
  segmentType: z.nativeEnum(SegmentType),
  date: z.date(),
  customerCount: z.number(),
  newCustomers: z.number(),
  churnedCustomers: z.number(),
  averageOrderValue: z.number(),
  totalRevenue: z.number(),
  campaignCount: z.number(),
  campaignEngagement: z.number(),
  createdAt: z.date().default(() => new Date()),
});

export type SegmentHealth = z.infer<typeof SegmentHealthSchema>;

// API Response Types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  timestamp: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// RFM Score Response
export interface RFMScoreResponse {
  customerId: string;
  businessId: string;
  recency: number;
  frequency: number;
  monetary: number;
  rfmScore: number;
  segment: SegmentType;
  lastPurchaseDate: string;
  totalPurchases: number;
  totalSpent: number;
  averageOrderValue: number;
}

// Segment Summary Response
export interface SegmentSummaryResponse {
  segmentId: string;
  type: SegmentType;
  name: string;
  customerCount: number;
  averageOrderValue: number;
  priority: SegmentPriority;
  lastUpdated: string;
  health: {
    trend: 'improving' | 'stable' | 'declining';
    changePercent: number;
  };
}

// Campaign Trigger Request
export const CampaignTriggerRequestSchema = z.object({
  segmentId: z.string().optional(),
  segmentType: z.nativeEnum(SegmentType).optional(),
  campaignType: z.nativeEnum(CampaignType),
  content: z.object({
    headline: z.string(),
    body: z.string(),
    cta: z.string().optional(),
    ctaUrl: z.string().optional(),
  }),
  schedule: z.object({
    type: z.enum(['immediate', 'scheduled']),
    sendAt: z.string().optional(),
  }).optional(),
  personalization: z.object({
    includeName: z.boolean().default(true),
    includeLastPurchase: z.boolean().default(true),
  }).optional(),
});

export type CampaignTriggerRequest = z.infer<typeof CampaignTriggerRequestSchema>;

// Journey Builder Integration
export interface JourneyBuilderPayload {
  customerId: string;
  businessId: string;
  segmentType: SegmentType;
  journeyId: string;
  stepNumber: number;
  triggerType: string;
  customerData: {
    name: string;
    email?: string;
    phone?: string;
    lastPurchaseDate?: Date;
    totalSpent: number;
    loyaltyPoints?: number;
  };
  metadata: Record<string, any>;
}

// RFM Segment Message Templates
export const SegmentMessageTemplates: Record<SegmentType, {
  email: { subject: string; headline: string; body: string; cta: string };
  sms: string;
  push: { title: string; body: string };
}> = {
  [SegmentType.CHAMPIONS]: {
    email: {
      subject: 'Thank you for being a Champion, {{name}}!',
      headline: 'You\'re our Star Customer',
      body: 'As one of our most valued Champions, you deserve exclusive perks. Enjoy early access to new products and special rewards just for you.',
      cta: 'Claim Your Rewards',
    },
    sms: 'Hey Champion! You\'ve unlocked exclusive rewards. Use code CHAMPION20 for 20% off your next order!',
    push: {
      title: 'Champion Rewards Await!',
      body: 'Your exclusive 20% off code is ready.',
    },
  },
  [SegmentType.LOYAL]: {
    email: {
      subject: 'We miss you, {{name}}!',
      headline: 'Come Back for More',
      body: 'It\'s been a while since your last visit. We\'ve got something special waiting for you on your next order.',
      cta: 'Get Your Discount',
    },
    sms: 'We miss you! Here\'s 15% off your next visit. Code: COMEBACK15',
    push: {
      title: 'Special Offer Just for You',
      body: '15% off waiting on your next order.',
    },
  },
  [SegmentType.POTENTIAL_LOYALIST]: {
    email: {
      subject: 'Unlock Loyalty Benefits, {{name}}!',
      headline: 'You\'re Almost There',
      body: 'You\'re just one more purchase away from reaching our Loyalty tier. Here\'s a bonus to help you get there.',
      cta: 'Reach Loyalty Status',
    },
    sms: 'One more order to become a Loyalty member! Use LOYAL10 for 10% off.',
    push: {
      title: 'Almost a Loyalty Member!',
      body: 'One purchase away from exclusive benefits.',
    },
  },
  [SegmentType.RECENT_CUSTOMERS]: {
    email: {
      subject: 'Welcome to the family, {{name}}!',
      headline: 'Thank You for Your First Order',
      body: 'We\'re thrilled to have you. Here\'s a special welcome offer for your next visit.',
      cta: 'Explore More',
    },
    sms: 'Welcome! Thank you for choosing us. Use WELCOME10 for 10% off your next order.',
    push: {
      title: 'Welcome! 🎉',
      body: 'Here\'s a special offer for your next visit.',
    },
  },
  [SegmentType.PROMISING]: {
    email: {
      subject: 'Keep the momentum going, {{name}}!',
      headline: 'You\'re on a Roll',
      body: 'We\'ve noticed your growing engagement. Here\'s a little something to keep you coming back.',
      cta: 'Continue Shopping',
    },
    sms: 'You\'re on fire! Use MOMENTUM15 for 15% off your next order.',
    push: {
      title: 'You\'re on a Roll!',
      body: 'Here\'s 15% off to keep you going.',
    },
  },
  [SegmentType.AT_RISK]: {
    email: {
      subject: 'We want you back, {{name}}!',
      headline: 'We Haven\'t Seen You Lately',
      body: 'It\'s been a while since your last visit. We miss you and have a special offer just to welcome you back.',
      cta: 'Return Today',
    },
    sms: 'We miss you! Use COMEBACK20 for 20% off + free delivery on your next order.',
    push: {
      title: 'We Miss You!',
      body: '20% off + free delivery on your return.',
    },
  },
  [SegmentType.CANT_LOSE_THEM]: {
    email: {
      subject: 'Please come back, {{name}}',
      headline: 'We Can\'t Imagine This Without You',
      body: 'You\'ve been such an important customer. Here\'s our best offer ever to bring you back.',
      cta: 'Get 30% Off',
    },
    sms: 'We really miss you! Use COMEBACK30 for 30% off your next order. No minimum.',
    push: {
      title: 'Please Come Back',
      body: 'Our best offer: 30% off + bonus points.',
    },
  },
  [SegmentType.LOST]: {
    email: {
      subject: 'A message from the heart, {{name}}',
      headline: 'We Remember You',
      body: 'It\'s been a long time. We\'d love to have you back with a special comeback offer.',
      cta: 'Start Fresh',
    },
    sms: 'It\'s been a while! Use FRESH25 for 25% off your next order. Valid for 7 days.',
    push: {
      title: 'We Remember You',
      body: '25% off with no minimum. Valid 7 days.',
    },
  },
  [SegmentType.HESITANT]: {
    email: {
      subject: 'Still thinking?, {{name}}',
      headline: 'Take Your Time',
      body: 'No pressure! Here\'s a gentle reminder about what you might be missing, plus a small discount to help you decide.',
      cta: 'Browse Now',
    },
    sms: 'Still deciding? Use THINK10 for 10% off. No rush, valid all week.',
    push: {
      title: 'Thinking It Over?',
      body: 'Here\'s 10% off whenever you\'re ready.',
    },
  },
  [SegmentType.NEWPOLLOYAL]: {
    email: {
      subject: 'Welcome to Loyalty, {{name}}!',
      headline: 'You\'ve Earned It',
      body: 'Congratulations on reaching our Loyalty tier! Enjoy exclusive benefits and early access to new products.',
      cta: 'Explore Loyalty Benefits',
    },
    sms: 'Congratulations! You\'re now a Loyalty member. Use LOYALVIP for exclusive deals.',
    push: {
      title: 'Welcome to Loyalty! 🎊',
      body: 'Enjoy exclusive member benefits.',
    },
  },
};
