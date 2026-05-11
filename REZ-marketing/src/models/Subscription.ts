import { Schema, model, Document, Types } from 'mongoose';

// ── Enums & Types ─────────────────────────────────────────────────────────────────

export type PlanInterval = 'monthly' | 'quarterly' | 'yearly';
export type SubscriptionStatus = 'active' | 'paused' | 'cancelled' | 'expired' | 'pending' | 'trial';
export type PaymentProvider = 'razorpay' | 'stripe' | 'internal';
export type PaymentStatus = 'pending' | 'completed' | 'failed' | 'refunded' | 'partially_refunded';

/**
 * Membership plan definition with pricing and benefits.
 * Plans are static configurations, not stored per-subscription.
 */
export interface MembershipPlan {
  id: string;
  name: string;
  interval: PlanInterval;
  price: number;                    // Price in INR (smallest unit: paise forrazorpay compatibility)
  displayPrice: string;             // Formatted price for display (e.g., "₹999")
  durationDays: number;             // Number of days in the billing cycle
  benefits: PlanBenefit[];
  features: string[];                // List of feature flags
  maxCashbackPercent: number;       // Maximum cashback percentage
  maxCashbackAmount: number;        // Maximum cashback amount per month
  priority: number;                 // Display priority (lower = higher in list)
  isActive: boolean;                // Whether plan is available for new subscriptions
  metadata?: Record<string, unknown>;
}

export interface PlanBenefit {
  id: string;
  title: string;
  description: string;
  icon?: string;
  limit?: number;                   // Optional usage limit
}

/**
 * Predefined membership plans
 */
export const MEMBERSHIP_PLANS: MembershipPlan[] = [
  {
    id: 'monthly_basic',
    name: 'Basic',
    interval: 'monthly',
    price: 99900,                   // ₹999 in paise
    displayPrice: '₹999',
    durationDays: 30,
    benefits: [
      {
        id: 'cashback_10',
        title: '10% Cashback',
        description: 'Get 10% cashback on all transactions',
        icon: 'percent',
        limit: 500,                  // Max ₹500 cashback per month
      },
      {
        id: 'email_support',
        title: 'Email Support',
        description: 'Get priority email support',
        icon: 'mail',
      },
      {
        id: 'basic_analytics',
        title: 'Basic Analytics',
        description: 'Access to basic spending analytics',
        icon: 'chart',
      },
    ],
    features: ['cashback', 'analytics', 'email_support'],
    maxCashbackPercent: 10,
    maxCashbackAmount: 500,
    priority: 1,
    isActive: true,
  },
  {
    id: 'quarterly_premium',
    name: 'Premium',
    interval: 'quarterly',
    price: 499900,                  // ₹4999 in paise
    displayPrice: '₹4,999',
    durationDays: 90,
    benefits: [
      {
        id: 'cashback_10_unlimited',
        title: '10% Unlimited Cashback',
        description: 'Get 10% cashback on all transactions with no monthly cap',
        icon: 'percent',
      },
      {
        id: 'priority_support',
        title: 'Priority Support',
        description: 'Get priority chat and phone support',
        icon: 'headphones',
      },
      {
        id: 'advanced_analytics',
        title: 'Advanced Analytics',
        description: 'Access to detailed spending analytics and trends',
        icon: 'chart-bar',
      },
      {
        id: 'exclusive_offers',
        title: 'Exclusive Offers',
        description: 'Access to exclusive partner offers',
        icon: 'gift',
      },
    ],
    features: ['cashback', 'analytics', 'priority_support', 'exclusive_offers', 'early_access'],
    maxCashbackPercent: 10,
    maxCashbackAmount: 999999,      // Effectively unlimited
    priority: 2,
    isActive: true,
  },
  {
    id: 'yearly_vip',
    name: 'VIP',
    interval: 'yearly',
    price: 999900,                  // ₹9999 in paise
    displayPrice: '₹9,999',
    durationDays: 365,
    benefits: [
      {
        id: 'cashback_10_max',
        title: '10% Premium Cashback',
        description: 'Get 10% cashback on all transactions with VIP limits',
        icon: 'crown',
      },
      {
        id: 'dedicated_support',
        title: 'Dedicated Support',
        description: 'Get dedicated account manager and 24/7 phone support',
        icon: 'user-tie',
      },
      {
        id: 'full_analytics',
        title: 'Full Analytics Suite',
        description: 'Access to complete analytics with custom reports',
        icon: 'chart-line',
      },
      {
        id: 'premium_offers',
        title: 'Premium Offers',
        description: 'Access to all partner offers and early access to new features',
        icon: 'star',
      },
      {
        id: 'cashback_boost',
        title: 'Cashback Boost',
        description: '+2% extra cashback on special categories',
        icon: 'bolt',
      },
    ],
    features: [
      'cashback',
      'analytics',
      'priority_support',
      'dedicated_support',
      'exclusive_offers',
      'premium_offers',
      'early_access',
      'cashback_boost',
      'custom_reports',
    ],
    maxCashbackPercent: 12,
    maxCashbackAmount: 999999,
    priority: 3,
    isActive: true,
  },
];

// ── Subscription Document Interface ─────────────────────────────────────────────

export interface ISubscription extends Document {
  // User & Plan
  userId: Types.ObjectId;
  planId: string;

  // Status
  status: SubscriptionStatus;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;

  // Payment
  paymentProvider: PaymentProvider;
  paymentId?: string;               // External payment reference
  paymentStatus: PaymentStatus;

  // Billing
  amount: number;                   // Amount charged in paise
  currency: string;                 // Currency code (INR)

  // Auto-renewal
  autoRenew: boolean;
  failedPaymentAttempts: number;
  maxFailedAttempts: number;

  // Cancellation
  cancelledAt?: Date;
  cancellationReason?: string;

  // Pause
  pausedAt?: Date;
  pauseReason?: string;
  resumeDate?: Date;

  // Usage tracking
  usage: SubscriptionUsage;

  // Reminders
  renewalRemindersSent: number[];    // Days before renewal when reminders were sent
  reminderDates: Date[];

  // Trial
  trialEnd?: Date;
  isInTrialPeriod: boolean;

  // Metadata
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface SubscriptionUsage {
  totalTransactions: number;
  totalCashbackEarned: number;
  totalCashbackClaimed: number;
  cashbackThisMonth: number;
  cashbackClaimedThisMonth: number;
  lastActivityAt?: Date;
  usageByCategory: Record<string, number>;  // Category -> count
  monthlyResetAt: Date;
}

// ── Mongoose Schema ─────────────────────────────────────────────────────────────

const PlanBenefitSchema = new Schema<PlanBenefit>(
  {
    id: { type: String, required: true },
    title: { type: String, required: true },
    description: { type: String, required: true },
    icon: { type: String },
    limit: { type: Number },
  },
  { _id: false },
);

const SubscriptionUsageSchema = new Schema<SubscriptionUsage>(
  {
    totalTransactions: { type: Number, default: 0 },
    totalCashbackEarned: { type: Number, default: 0 },
    totalCashbackClaimed: { type: Number, default: 0 },
    cashbackThisMonth: { type: Number, default: 0 },
    cashbackClaimedThisMonth: { type: Number, default: 0 },
    lastActivityAt: { type: Date },
    usageByCategory: { type: Map, of: Number, default: {} },
    monthlyResetAt: { type: Date, required: true },
  },
  { _id: false },
);

const SubscriptionSchema = new Schema<ISubscription>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    planId: {
      type: String,
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['active', 'paused', 'cancelled', 'expired', 'pending', 'trial'],
      default: 'pending',
      index: true,
    },
    currentPeriodStart: {
      type: Date,
      required: true,
      index: true,
    },
    currentPeriodEnd: {
      type: Date,
      required: true,
      index: true,
    },
    paymentProvider: {
      type: String,
      enum: ['razorpay', 'stripe', 'internal'],
      default: 'razorpay',
    },
    paymentId: {
      type: String,
      index: true,
    },
    paymentStatus: {
      type: String,
      enum: ['pending', 'completed', 'failed', 'refunded', 'partially_refunded'],
      default: 'pending',
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    currency: {
      type: String,
      default: 'INR',
    },
    autoRenew: {
      type: Boolean,
      default: true,
    },
    failedPaymentAttempts: {
      type: Number,
      default: 0,
    },
    maxFailedAttempts: {
      type: Number,
      default: 3,
    },
    cancelledAt: {
      type: Date,
    },
    cancellationReason: {
      type: String,
    },
    pausedAt: {
      type: Date,
    },
    pauseReason: {
      type: String,
    },
    resumeDate: {
      type: Date,
    },
    usage: {
      type: SubscriptionUsageSchema,
      default: () => ({
        totalTransactions: 0,
        totalCashbackEarned: 0,
        totalCashbackClaimed: 0,
        cashbackThisMonth: 0,
        cashbackClaimedThisMonth: 0,
        usageByCategory: {},
        monthlyResetAt: new Date(),
      }),
    },
    renewalRemindersSent: {
      type: [Number],
      default: [],
    },
    reminderDates: {
      type: [Date],
      default: [],
    },
    trialEnd: {
      type: Date,
    },
    isInTrialPeriod: {
      type: Boolean,
      default: false,
    },
    metadata: {
      type: Schema.Types.Mixed,
    },
  },
  { timestamps: true },
);

// ── Indexes ─────────────────────────────────────────────────────────────────────

// Compound indexes for common queries
SubscriptionSchema.index({ userId: 1, status: 1 });
SubscriptionSchema.index({ status: 1, currentPeriodEnd: 1 });
SubscriptionSchema.index({ autoRenew: 1, status: 1, currentPeriodEnd: 1 });
SubscriptionSchema.index({ paymentStatus: 1, createdAt: 1 });
SubscriptionSchema.index({ 'usage.monthlyResetAt': 1, userId: 1 });

// ── Virtuals ────────────────────────────────────────────────────────────────────

SubscriptionSchema.virtual('plan').get(function () {
  return MEMBERSHIP_PLANS.find((p) => p.id === this.planId);
});

SubscriptionSchema.virtual('isExpired').get(function () {
  return this.currentPeriodEnd < new Date();
});

SubscriptionSchema.virtual('daysUntilExpiry').get(function () {
  const now = new Date();
  const diff = this.currentPeriodEnd.getTime() - now.getTime();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
});

SubscriptionSchema.virtual('remainingCashback').get(function () {
  const plan = MEMBERSHIP_PLANS.find((p) => p.id === this.planId);
  if (!plan) return 0;
  return Math.max(0, plan.maxCashbackAmount - this.usage.cashbackThisMonth);
});

// ── Methods ──────────────────────────────────────────────────────────────────────

/**
 * Check if subscription has a specific feature
 */
SubscriptionSchema.methods.hasFeature = function (feature: string): boolean {
  const plan = MEMBERSHIP_PLANS.find((p) => p.id === this.planId);
  if (!plan) return false;
  return plan.features.includes(feature);
};

/**
 * Calculate cashback for a transaction amount
 */
SubscriptionSchema.methods.calculateCashback = function (amount: number): number {
  const plan = MEMBERSHIP_PLANS.find((p) => p.id === this.planId);
  if (!plan) return 0;

  const cashbackPercent = plan.maxCashbackPercent;
  const rawCashback = (amount * cashbackPercent) / 100;

  // Apply monthly limit
  const remainingLimit = plan.maxCashbackAmount - this.usage.cashbackThisMonth;
  return Math.min(rawCashback, Math.max(0, remainingLimit));
};

/**
 * Check if user can claim more cashback this month
 */
SubscriptionSchema.methods.canClaimCashback = function (amount?: number): boolean {
  if (amount === undefined) return true;
  const cashback = this.calculateCashback(amount);
  return cashback > 0;
};

// ── Pre-save Hook ───────────────────────────────────────────────────────────────

SubscriptionSchema.pre('save', function (next) {
  // Auto-expire if period has ended and status is active
  if (this.status === 'active' && this.currentPeriodEnd < new Date()) {
    this.status = 'expired';
  }

  // Reset monthly usage if needed
  const now = new Date();
  if (this.usage.monthlyResetAt && now.getMonth() !== this.usage.monthlyResetAt.getMonth()) {
    this.usage.cashbackThisMonth = 0;
    this.usage.cashbackClaimedThisMonth = 0;
    this.usage.monthlyResetAt = now;
  }

  next();
});

// ── Model Export ────────────────────────────────────────────────────────────────

export const Subscription = model<ISubscription>('Subscription', SubscriptionSchema);
export default Subscription;

// ── Helper Functions ─────────────────────────────────────────────────────────────

/**
 * Get all available membership plans
 */
export function getAvailablePlans(): MembershipPlan[] {
  return MEMBERSHIP_PLANS.filter((p) => p.isActive).sort((a, b) => a.priority - b.priority);
}

/**
 * Get plan by ID
 */
export function getPlanById(planId: string): MembershipPlan | undefined {
  return MEMBERSHIP_PLANS.find((p) => p.id === planId);
}

/**
 * Get plan benefits for a subscription
 */
export function getSubscriptionBenefits(subscription: ISubscription): PlanBenefit[] {
  const plan = getPlanById(subscription.planId);
  return plan?.benefits || [];
}
