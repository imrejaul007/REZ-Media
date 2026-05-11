import { v4 as uuidv4 } from 'uuid';
import { Subscription, ISubscription, MEMBERSHIP_PLANS, getPlanById, getAvailablePlans, SubscriptionStatus, PaymentProvider } from '../models/Subscription';
import { logger } from '../config/logger';
import { getRedis } from '../config/redis';
import { sendSubscriptionNotification } from './notificationService';

// ── Configuration ─────────────────────────────────────────────────────────────────

const REDIS_KEY_PREFIX = 'subscription:';
const RENEWAL_REMINDER_DAYS = [7, 3, 1]; // Days before renewal to send reminders

// Payment provider configuration
const PAYMENT_CONFIG = {
  razorpay: {
    webhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET,
    apiKey: process.env.RAZORPAY_KEY_ID,
    apiSecret: process.env.RAZORPAY_KEY_SECRET,
  },
  stripe: {
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
    apiKey: process.env.STRIPE_API_KEY,
  },
};

// ── DTOs ─────────────────────────────────────────────────────────────────────────

export interface CreateSubscriptionDTO {
  userId: string;
  planId: string;
  paymentProvider?: PaymentProvider;
  paymentMethodId?: string;
  trialDays?: number;
  metadata?: Record<string, unknown>;
}

export interface UpdateSubscriptionDTO {
  planId?: string;
  autoRenew?: boolean;
  metadata?: Record<string, unknown>;
}

export interface PauseSubscriptionDTO {
  reason?: string;
  resumeDate?: Date;
}

export interface CancelSubscriptionDTO {
  reason?: string;
  immediate?: boolean; // If true, cancel immediately; otherwise at period end
}

export interface SubscriptionFilters {
  userId?: string;
  status?: SubscriptionStatus;
  planId?: string;
  autoRenew?: boolean;
  page?: number;
  limit?: number;
}

export interface CashbackClaimDTO {
  subscriptionId: string;
  userId: string;
  amount?: number; // If not provided, claims all available
}

// ── Payment Provider Interfaces ───────────────────────────────────────────────────

export interface PaymentIntent {
  id: string;
  clientSecret?: string;
  amount: number;
  currency: string;
  status: string;
  metadata?: Record<string, unknown>;
}

export interface PaymentWebhookPayload {
  event: string;
  paymentId: string;
  subscriptionId?: string;
  userId?: string;
  amount?: number;
  status?: string;
  timestamp: string;
}

// ── Payment Service Interface ────────────────────────────────────────────────────

export interface PaymentService {
  createPaymentIntent(subscription: ISubscription): Promise<PaymentIntent>;
  confirmPayment(paymentId: string, paymentMethodId: string): Promise<boolean>;
  cancelSubscription(paymentId: string): Promise<boolean>;
  processRefund(paymentId: string, amount?: number): Promise<boolean>;
  handleWebhook(payload: PaymentWebhookPayload): Promise<void>;
}

// ── Razorpay Payment Service ─────────────────────────────────────────────────────

class RazorpayPaymentService implements PaymentService {
  private apiKey: string;
  private apiSecret: string;

  constructor() {
    this.apiKey = PAYMENT_CONFIG.razorpay.apiKey || '';
    this.apiSecret = PAYMENT_CONFIG.razorpay.apiSecret || '';
  }

  async createPaymentIntent(subscription: ISubscription): Promise<PaymentIntent> {
    // In production, this would call Razorpay API
    // For now, return a mock payment intent
    logger.info('[RazorpayPaymentService] Creating payment intent', {
      subscriptionId: subscription._id,
      amount: subscription.amount,
    });

    const paymentIntent: PaymentIntent = {
      id: `pi_${uuidv4()}`,
      amount: subscription.amount,
      currency: subscription.currency,
      status: 'pending',
      metadata: {
        subscriptionId: String(subscription._id),
        userId: String(subscription.userId),
        planId: subscription.planId,
      },
    };

    return paymentIntent;
  }

  async confirmPayment(paymentId: string, _paymentMethodId: string): Promise<boolean> {
    logger.info('[RazorpayPaymentService] Confirming payment', { paymentId });
    // In production, verify payment with Razorpay API
    return true;
  }

  async cancelSubscription(paymentId: string): Promise<boolean> {
    logger.info('[RazorpayPaymentService] Cancelling subscription', { paymentId });
    // In production, cancel subscription in Razorpay
    return true;
  }

  async processRefund(paymentId: string, amount?: number): Promise<boolean> {
    logger.info('[RazorpayPaymentService] Processing refund', { paymentId, amount });
    // In production, process refund with Razorpay API
    return true;
  }

  async handleWebhook(_payload: PaymentWebhookPayload): Promise<void> {
    // Handled in subscription service webhook handler
    logger.info('[RazorpayPaymentService] Webhook received');
  }
}

// ── Stripe Payment Service ────────────────────────────────────────────────────────

class StripePaymentService implements PaymentService {
  private apiKey: string;

  constructor() {
    this.apiKey = PAYMENT_CONFIG.stripe.apiKey || '';
  }

  async createPaymentIntent(subscription: ISubscription): Promise<PaymentIntent> {
    logger.info('[StripePaymentService] Creating payment intent', {
      subscriptionId: subscription._id,
      amount: subscription.amount,
    });

    const paymentIntent: PaymentIntent = {
      id: `pi_${uuidv4()}`,
      amount: subscription.amount,
      currency: subscription.currency.toLowerCase(),
      status: 'pending',
      metadata: {
        subscriptionId: String(subscription._id),
        userId: String(subscription.userId),
        planId: subscription.planId,
      },
    };

    return paymentIntent;
  }

  async confirmPayment(paymentId: string, _paymentMethodId: string): Promise<boolean> {
    logger.info('[StripePaymentService] Confirming payment', { paymentId });
    return true;
  }

  async cancelSubscription(paymentId: string): Promise<boolean> {
    logger.info('[StripePaymentService] Cancelling subscription', { paymentId });
    return true;
  }

  async processRefund(paymentId: string, amount?: number): Promise<boolean> {
    logger.info('[StripePaymentService] Processing refund', { paymentId, amount });
    return true;
  }

  async handleWebhook(_payload: PaymentWebhookPayload): Promise<void> {
    logger.info('[StripePaymentService] Webhook received');
  }
}

// ── Payment Service Factory ──────────────────────────────────────────────────────

function getPaymentService(provider: PaymentProvider): PaymentService {
  switch (provider) {
    case 'razorpay':
      return new RazorpayPaymentService();
    case 'stripe':
      return new StripePaymentService();
    case 'internal':
      // Return internal payment service (simplified)
      return {
        async createPaymentIntent(subscription: ISubscription): Promise<PaymentIntent> {
          return {
            id: `int_${uuidv4()}`,
            amount: subscription.amount,
            currency: subscription.currency,
            status: 'pending',
          };
        },
        async confirmPayment(): Promise<boolean> { return true; },
        async cancelSubscription(): Promise<boolean> { return true; },
        async processRefund(): Promise<boolean> { return true; },
        async handleWebhook(): Promise<void> {},
      };
    default:
      return new RazorpayPaymentService();
  }
}

// ── Subscription Service ──────────────────────────────────────────────────────────

export class SubscriptionService {
  /**
   * Create a new subscription with payment intent
   */
  async create(dto: CreateSubscriptionDTO): Promise<{ subscription: ISubscription; paymentIntent: PaymentIntent }> {
    const plan = getPlanById(dto.planId);
    if (!plan) {
      throw new Error(`Plan not found: ${dto.planId}`);
    }

    if (!plan.isActive) {
      throw new Error(`Plan is not available: ${dto.planId}`);
    }

    // Check for existing active subscription
    const existingSubscription = await Subscription.findOne({
      userId: dto.userId,
      status: { $in: ['active', 'trial', 'pending'] },
    });

    if (existingSubscription) {
      throw new Error('User already has an active subscription');
    }

    const now = new Date();
    const periodStart = now;
    const periodEnd = new Date(now.getTime() + plan.durationDays * 24 * 60 * 60 * 1000);

    // Handle trial period
    const trialEnd = dto.trialDays ? new Date(now.getTime() + dto.trialDays * 24 * 60 * 60 * 1000) : undefined;

    const subscription = new Subscription({
      userId: dto.userId,
      planId: dto.planId,
      status: trialEnd ? 'trial' : 'pending',
      currentPeriodStart: periodStart,
      currentPeriodEnd: trialEnd || periodEnd,
      paymentProvider: dto.paymentProvider || 'razorpay',
      amount: plan.price,
      currency: 'INR',
      autoRenew: true,
      trialEnd,
      isInTrialPeriod: !!trialEnd,
      usage: {
        totalTransactions: 0,
        totalCashbackEarned: 0,
        totalCashbackClaimed: 0,
        cashbackThisMonth: 0,
        cashbackClaimedThisMonth: 0,
        monthlyResetAt: now,
      },
      metadata: dto.metadata,
    });

    await subscription.save();

    // Create payment intent
    const paymentService = getPaymentService(subscription.paymentProvider);
    const paymentIntent = await paymentService.createPaymentIntent(subscription);

    // Store payment intent ID
    subscription.paymentId = paymentIntent.id;
    await subscription.save();

    logger.info('[SubscriptionService] Created subscription', {
      subscriptionId: subscription._id,
      userId: dto.userId,
      planId: dto.planId,
      status: subscription.status,
    });

    return { subscription, paymentIntent };
  }

  /**
   * Activate subscription after successful payment
   */
  async activate(subscriptionId: string, paymentId: string): Promise<ISubscription> {
    const subscription = await Subscription.findById(subscriptionId);
    if (!subscription) {
      throw new Error('Subscription not found');
    }

    if (subscription.status !== 'pending' && subscription.status !== 'trial') {
      throw new Error(`Cannot activate subscription with status: ${subscription.status}`);
    }

    const plan = getPlanById(subscription.planId);
    if (!plan) {
      throw new Error('Plan not found');
    }

    const now = new Date();
    subscription.status = 'active';
    subscription.paymentStatus = 'completed';
    subscription.paymentId = paymentId;
    subscription.currentPeriodStart = now;
    subscription.currentPeriodEnd = new Date(now.getTime() + plan.durationDays * 24 * 60 * 60 * 1000);
    subscription.isInTrialPeriod = false;

    await subscription.save();

    logger.info('[SubscriptionService] Activated subscription', {
      subscriptionId: subscription._id,
      userId: subscription.userId,
    });

    // Send welcome notification
    await this.sendStatusNotification(subscription, 'welcome');

    return subscription;
  }

  /**
   * Get subscription by ID
   */
  async getById(subscriptionId: string): Promise<ISubscription | null> {
    return Subscription.findById(subscriptionId).populate('userId');
  }

  /**
   * Get subscription by user ID
   */
  async getByUserId(userId: string): Promise<ISubscription[]> {
    return Subscription.find({ userId }).sort({ createdAt: -1 });
  }

  /**
   * Get active subscription for user
   */
  async getActiveSubscription(userId: string): Promise<ISubscription | null> {
    return Subscription.findOne({
      userId,
      status: { $in: ['active', 'trial'] },
    });
  }

  /**
   * List subscriptions with filters
   */
  async list(filters: SubscriptionFilters): Promise<{ subscriptions: ISubscription[]; total: number }> {
    const query: Record<string, unknown> = {};

    if (filters.userId) query.userId = filters.userId;
    if (filters.status) query.status = filters.status;
    if (filters.planId) query.planId = filters.planId;
    if (filters.autoRenew !== undefined) query.autoRenew = filters.autoRenew;

    const page = filters.page || 1;
    const limit = filters.limit || 20;
    const skip = (page - 1) * limit;

    const [subscriptions, total] = await Promise.all([
      Subscription.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('userId'),
      Subscription.countDocuments(query),
    ]);

    return { subscriptions, total };
  }

  /**
   * Update subscription (plan change, auto-renew settings)
   */
  async update(subscriptionId: string, dto: UpdateSubscriptionDTO): Promise<ISubscription> {
    const subscription = await Subscription.findById(subscriptionId);
    if (!subscription) {
      throw new Error('Subscription not found');
    }

    if (subscription.status !== 'active' && subscription.status !== 'trial') {
      throw new Error(`Cannot update subscription with status: ${subscription.status}`);
    }

    if (dto.planId && dto.planId !== subscription.planId) {
      await this.changePlan(subscription, dto.planId);
    }

    if (dto.autoRenew !== undefined) {
      subscription.autoRenew = dto.autoRenew;
    }

    if (dto.metadata) {
      subscription.metadata = { ...subscription.metadata, ...dto.metadata };
    }

    await subscription.save();

    logger.info('[SubscriptionService] Updated subscription', {
      subscriptionId: subscription._id,
      changes: dto,
    });

    return subscription;
  }

  /**
   * Change subscription plan (upgrade/downgrade)
   */
  async changePlan(subscription: ISubscription, newPlanId: string): Promise<ISubscription> {
    const newPlan = getPlanById(newPlanId);
    if (!newPlan) {
      throw new Error(`Plan not found: ${newPlanId}`);
    }

    const oldPlan = getPlanById(subscription.planId);
    if (!oldPlan) {
      throw new Error('Current plan not found');
    }

    // Calculate prorated amount
    const daysRemaining = Math.ceil(
      (subscription.currentPeriodEnd.getTime() - Date.now()) / (1000 * 60 * 60 * 24),
    );
    const oldPlanDailyRate = oldPlan.price / oldPlan.durationDays;
    const creditAmount = Math.floor(oldPlanDailyRate * daysRemaining);

    subscription.planId = newPlanId;
    subscription.amount = newPlan.price;

    await subscription.save();

    logger.info('[SubscriptionService] Changed plan', {
      subscriptionId: subscription._id,
      oldPlan: oldPlan.id,
      newPlan: newPlan.id,
      creditAmount,
    });

    return subscription;
  }

  /**
   * Pause subscription
   */
  async pause(subscriptionId: string, dto: PauseSubscriptionDTO): Promise<ISubscription> {
    const subscription = await Subscription.findById(subscriptionId);
    if (!subscription) {
      throw new Error('Subscription not found');
    }

    if (subscription.status !== 'active') {
      throw new Error(`Cannot pause subscription with status: ${subscription.status}`);
    }

    subscription.status = 'paused';
    subscription.pausedAt = new Date();
    subscription.pauseReason = dto.reason;
    subscription.resumeDate = dto.resumeDate;

    await subscription.save();

    // Store in Redis for quick access
    try {
      const redis = getRedis();
      await redis.setex(
        `${REDIS_KEY_PREFIX}paused:${subscriptionId}`,
        30 * 24 * 60 * 60, // 30 days
        JSON.stringify({ pausedAt: subscription.pausedAt, resumeDate: dto.resumeDate }),
      );
    } catch (err) {
      logger.warn('[SubscriptionService] Redis pause tracking failed', { subscriptionId, err });
    }

    logger.info('[SubscriptionService] Paused subscription', {
      subscriptionId: subscription._id,
      reason: dto.reason,
      resumeDate: dto.resumeDate,
    });

    return subscription;
  }

  /**
   * Resume paused subscription
   */
  async resume(subscriptionId: string): Promise<ISubscription> {
    const subscription = await Subscription.findById(subscriptionId);
    if (!subscription) {
      throw new Error('Subscription not found');
    }

    if (subscription.status !== 'paused') {
      throw new Error(`Cannot resume subscription with status: ${subscription.status}`);
    }

    subscription.status = 'active';
    subscription.pausedAt = undefined;
    subscription.pauseReason = undefined;
    subscription.resumeDate = undefined;

    await subscription.save();

    logger.info('[SubscriptionService] Resumed subscription', { subscriptionId: subscription._id });

    await this.sendStatusNotification(subscription, 'resumed');

    return subscription;
  }

  /**
   * Cancel subscription
   */
  async cancel(subscriptionId: string, dto: CancelSubscriptionDTO): Promise<ISubscription> {
    const subscription = await Subscription.findById(subscriptionId);
    if (!subscription) {
      throw new Error('Subscription not found');
    }

    if (subscription.status === 'cancelled' || subscription.status === 'expired') {
      throw new Error(`Cannot cancel subscription with status: ${subscription.status}`);
    }

    if (dto.immediate) {
      subscription.status = 'cancelled';
      subscription.cancelledAt = new Date();

      // Cancel payment subscription if exists
      if (subscription.paymentId) {
        const paymentService = getPaymentService(subscription.paymentProvider);
        await paymentService.cancelSubscription(subscription.paymentId);
      }
    } else {
      // Mark for cancellation at period end
      subscription.autoRenew = false;
      subscription.cancellationReason = dto.reason;
    }

    subscription.cancellationReason = dto.reason;

    await subscription.save();

    logger.info('[SubscriptionService] Cancelled subscription', {
      subscriptionId: subscription._id,
      immediate: dto.immediate,
      reason: dto.reason,
    });

    if (dto.immediate) {
      await this.sendStatusNotification(subscription, 'cancelled');
    }

    return subscription;
  }

  /**
   * Renew subscription
   */
  async renew(subscriptionId: string): Promise<ISubscription> {
    const subscription = await Subscription.findById(subscriptionId);
    if (!subscription) {
      throw new Error('Subscription not found');
    }

    const plan = getPlanById(subscription.planId);
    if (!plan) {
      throw new Error('Plan not found');
    }

    const now = new Date();

    // Check if user has already been charged (idempotency)
    if (subscription.currentPeriodStart && subscription.currentPeriodStart > now) {
      throw new Error('Subscription period has not started');
    }

    // Create payment intent for renewal
    const paymentService = getPaymentService(subscription.paymentProvider);
    const paymentIntent = await paymentService.createPaymentIntent(subscription);

    subscription.paymentId = paymentIntent.id;
    subscription.paymentStatus = 'pending';
    subscription.currentPeriodStart = subscription.currentPeriodEnd;
    subscription.currentPeriodEnd = new Date(subscription.currentPeriodEnd.getTime() + plan.durationDays * 24 * 60 * 60 * 1000);
    subscription.failedPaymentAttempts = 0;

    await subscription.save();

    logger.info('[SubscriptionService] Initiated renewal', {
      subscriptionId: subscription._id,
      newPeriodEnd: subscription.currentPeriodEnd,
    });

    return subscription;
  }

  /**
   * Confirm payment and activate subscription
   */
  async confirmPayment(subscriptionId: string, paymentId: string): Promise<ISubscription> {
    const subscription = await Subscription.findById(subscriptionId);
    if (!subscription) {
      throw new Error('Subscription not found');
    }

    const paymentService = getPaymentService(subscription.paymentProvider);
    const confirmed = await paymentService.confirmPayment(paymentId, '');

    if (!confirmed) {
      throw new Error('Payment confirmation failed');
    }

    subscription.paymentStatus = 'completed';

    if (subscription.status === 'pending' || subscription.status === 'trial') {
      subscription.status = 'active';
      subscription.isInTrialPeriod = false;

      const plan = getPlanById(subscription.planId);
      if (plan) {
        subscription.currentPeriodStart = new Date();
        subscription.currentPeriodEnd = new Date(Date.now() + plan.durationDays * 24 * 60 * 60 * 1000);
      }
    }

    await subscription.save();

    logger.info('[SubscriptionService] Confirmed payment', {
      subscriptionId: subscription._id,
      paymentId,
    });

    if (subscription.status === 'active') {
      await this.sendStatusNotification(subscription, 'renewed');
    }

    return subscription;
  }

  /**
   * Record failed payment attempt
   */
  async recordFailedPayment(subscriptionId: string): Promise<ISubscription> {
    const subscription = await Subscription.findById(subscriptionId);
    if (!subscription) {
      throw new Error('Subscription not found');
    }

    subscription.failedPaymentAttempts += 1;
    subscription.paymentStatus = 'failed';

    if (subscription.failedPaymentAttempts >= subscription.maxFailedAttempts) {
      subscription.status = 'expired';
      await this.sendStatusNotification(subscription, 'expired_payment');
    } else {
      await this.sendStatusNotification(subscription, 'payment_failed');
    }

    await subscription.save();

    logger.warn('[SubscriptionService] Payment failed', {
      subscriptionId: subscription._id,
      attempts: subscription.failedPaymentAttempts,
      maxAttempts: subscription.maxFailedAttempts,
    });

    return subscription;
  }

  /**
   * Track transaction for cashback
   */
  async trackTransaction(
    subscriptionId: string,
    transactionAmount: number,
    category?: string,
  ): Promise<{ eligible: boolean; cashbackAmount: number }> {
    const subscription = await Subscription.findById(subscriptionId);
    if (!subscription) {
      throw new Error('Subscription not found');
    }

    if (subscription.status !== 'active') {
      return { eligible: false, cashbackAmount: 0 };
    }

    const plan = getPlanById(subscription.planId);
    if (!plan || !plan.features.includes('cashback')) {
      return { eligible: false, cashbackAmount: 0 };
    }

    // Calculate cashback
    const cashbackAmount = subscription.calculateCashback(transactionAmount);

    // Update usage
    subscription.usage.totalTransactions += 1;
    subscription.usage.totalCashbackEarned += cashbackAmount;
    subscription.usage.cashbackThisMonth += cashbackAmount;
    subscription.usage.lastActivityAt = new Date();

    if (category) {
      const currentCategoryCount = subscription.usage.usageByCategory.get(category) || 0;
      subscription.usage.usageByCategory.set(category, currentCategoryCount + 1);
    }

    await subscription.save();

    // Store usage in Redis for quick access
    try {
      const redis = getRedis();
      const usageKey = `${REDIS_KEY_PREFIX}usage:${subscriptionId}`;
      await redis.hset(usageKey, {
        cashbackThisMonth: subscription.usage.cashbackThisMonth.toString(),
        transactions: subscription.usage.totalTransactions.toString(),
        lastActivity: new Date().toISOString(),
      });
      await redis.expire(usageKey, 86400); // 24 hours
    } catch (err) {
      logger.warn('[SubscriptionService] Redis usage tracking failed', { subscriptionId, err });
    }

    logger.info('[SubscriptionService] Tracked transaction', {
      subscriptionId: subscription._id,
      transactionAmount,
      cashbackAmount,
    });

    return { eligible: cashbackAmount > 0, cashbackAmount };
  }

  /**
   * Claim cashback
   */
  async claimCashback(dto: CashbackClaimDTO): Promise<{ success: boolean; amount: number; message: string }> {
    const subscription = await Subscription.findById(dto.subscriptionId);
    if (!subscription) {
      throw new Error('Subscription not found');
    }

    if (String(subscription.userId) !== dto.userId) {
      throw new Error('Subscription does not belong to user');
    }

    if (subscription.status !== 'active') {
      return { success: false, amount: 0, message: 'Subscription is not active' };
    }

    const availableCashback = subscription.usage.cashbackThisMonth - subscription.usage.cashbackClaimedThisMonth;

    if (availableCashback <= 0) {
      return { success: false, amount: 0, message: 'No cashback available to claim' };
    }

    const claimAmount = dto.amount ? Math.min(dto.amount, availableCashback) : availableCashback;

    subscription.usage.cashbackClaimedThisMonth += claimAmount;
    subscription.usage.totalCashbackClaimed += claimAmount;

    await subscription.save();

    logger.info('[SubscriptionService] Claimed cashback', {
      subscriptionId: subscription._id,
      userId: dto.userId,
      amount: claimAmount,
    });

    return {
      success: true,
      amount: claimAmount,
      message: `Successfully claimed ₹${(claimAmount / 100).toFixed(2)} cashback`,
    };
  }

  /**
   * Get subscription usage details
   */
  async getUsage(subscriptionId: string): Promise<{
    totalTransactions: number;
    totalCashbackEarned: number;
    totalCashbackClaimed: number;
    cashbackThisMonth: number;
    remainingCashback: number;
    lastActivityAt?: Date;
    usageByCategory: Record<string, number>;
  }> {
    const subscription = await Subscription.findById(subscriptionId);
    if (!subscription) {
      throw new Error('Subscription not found');
    }

    const plan = getPlanById(subscription.planId);
    const maxCashbackAmount = plan?.maxCashbackAmount || 0;
    const remainingCashback = Math.max(0, maxCashbackAmount - subscription.usage.cashbackThisMonth);

    return {
      totalTransactions: subscription.usage.totalTransactions,
      totalCashbackEarned: subscription.usage.totalCashbackEarned,
      totalCashbackClaimed: subscription.usage.totalCashbackClaimed,
      cashbackThisMonth: subscription.usage.cashbackThisMonth,
      remainingCashback,
      lastActivityAt: subscription.usage.lastActivityAt,
      usageByCategory: Object.fromEntries(subscription.usage.usageByCategory),
    };
  }

  /**
   * Send status notification
   */
  private async sendStatusNotification(
    subscription: ISubscription,
    eventType: 'welcome' | 'renewed' | 'cancelled' | 'paused' | 'resumed' | 'expired' | 'payment_failed',
  ): Promise<void> {
    const plan = getPlanById(subscription.planId);

    const messages: Record<string, { title: string; body: string }> = {
      welcome: {
        title: 'Welcome to REZ Membership!',
        body: `Your ${plan?.name || 'Membership'} subscription is now active. Enjoy your benefits!`,
      },
      renewed: {
        title: 'Subscription Renewed',
        body: `Your ${plan?.name || 'Membership'} subscription has been renewed.`,
      },
      cancelled: {
        title: 'Subscription Cancelled',
        body: 'Your REZ Membership has been cancelled. You can resubscribe anytime.',
      },
      paused: {
        title: 'Subscription Paused',
        body: 'Your REZ Membership has been paused. Resume anytime to continue enjoying benefits.',
      },
      resumed: {
        title: 'Subscription Resumed',
        body: 'Your REZ Membership is now active again!',
      },
      expired: {
        title: 'Subscription Expired',
        body: 'Your REZ Membership has expired. Resubscribe to continue enjoying benefits.',
      },
      payment_failed: {
        title: 'Payment Failed',
        body: 'We could not process your subscription payment. Please update your payment method.',
      },
    };

    const message = messages[eventType];
    if (!message) return;

    await sendSubscriptionNotification({
      subscriptionId: String(subscription._id),
      userId: String(subscription.userId),
      eventType: `subscription_${eventType}`,
      title: message.title,
      body: message.body,
      planName: plan?.name,
      planDisplayPrice: plan?.displayPrice,
    });
  }

  /**
   * Get subscriptions expiring in X days (for renewal reminders)
   */
  async getExpiringSubscriptions(daysUntilExpiry: number): Promise<ISubscription[]> {
    const now = new Date();
    const targetDate = new Date(now.getTime() + daysUntilExpiry * 24 * 60 * 60 * 1000);
    const startOfDay = new Date(targetDate.setHours(0, 0, 0, 0));
    const endOfDay = new Date(targetDate.setHours(23, 59, 59, 999));

    return Subscription.find({
      status: 'active',
      autoRenew: true,
      currentPeriodEnd: { $gte: startOfDay, $lte: endOfDay },
    });
  }

  /**
   * Process renewal reminders
   */
  async processRenewalReminders(): Promise<number> {
    let totalReminders = 0;

    for (const days of RENEWAL_REMINDER_DAYS) {
      const subscriptions = await this.getExpiringSubscriptions(days);

      for (const subscription of subscriptions) {
        if (subscription.renewalRemindersSent.includes(days)) {
          continue; // Already sent
        }

        const plan = getPlanById(subscription.planId);

        await sendSubscriptionNotification({
          subscriptionId: String(subscription._id),
          userId: String(subscription.userId),
          eventType: 'renewal_reminder',
          title: 'Your subscription renews soon',
          body: `Your ${plan?.name || 'Membership'} subscription will renew in ${days} day${days > 1 ? 's' : ''}.`,
          planName: plan?.name,
          planDisplayPrice: plan?.displayPrice,
          renewalAmount: subscription.amount,
          renewalDate: subscription.currentPeriodEnd,
        });

        subscription.renewalRemindersSent.push(days);
        subscription.reminderDates.push(new Date());
        await subscription.save();

        totalReminders++;
      }
    }

    logger.info('[SubscriptionService] Processed renewal reminders', { totalReminders });
    return totalReminders;
  }

  /**
   * Process expired subscriptions
   */
  async processExpiredSubscriptions(): Promise<number> {
    const now = new Date();

    const result = await Subscription.updateMany(
      {
        status: 'active',
        currentPeriodEnd: { $lte: now },
      },
      {
        $set: { status: 'expired' },
      },
    );

    logger.info('[SubscriptionService] Processed expired subscriptions', {
      expiredCount: result.modifiedCount,
    });

    return result.modifiedCount;
  }

  /**
   * Process auto-renewals
   */
  async processAutoRenewals(): Promise<number> {
    const now = new Date();
    const gracePeriodEnd = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hour grace period

    const subscriptions = await Subscription.find({
      status: { $in: ['active', 'expired'] },
      autoRenew: true,
      currentPeriodEnd: { $lte: gracePeriodEnd },
    });

    let renewals = 0;

    for (const subscription of subscriptions) {
      try {
        await this.renew(String(subscription._id));
        renewals++;
      } catch (err) {
        logger.error('[SubscriptionService] Auto-renewal failed', {
          subscriptionId: subscription._id,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    logger.info('[SubscriptionService] Processed auto-renewals', { renewals });
    return renewals;
  }

  /**
   * Handle payment webhook
   */
  async handlePaymentWebhook(provider: PaymentProvider, payload: PaymentWebhookPayload): Promise<void> {
    const paymentService = getPaymentService(provider);
    await paymentService.handleWebhook(payload);

    const { event, paymentId, subscriptionId } = payload;

    if (!subscriptionId) {
      logger.warn('[SubscriptionService] Webhook missing subscriptionId', { payload });
      return;
    }

    const subscription = await Subscription.findById(subscriptionId);
    if (!subscription) {
      logger.warn('[SubscriptionService] Subscription not found for webhook', { subscriptionId });
      return;
    }

    switch (event) {
      case 'payment.success':
        await this.confirmPayment(subscriptionId, paymentId);
        break;

      case 'payment.failed':
        await this.recordFailedPayment(subscriptionId);
        break;

      case 'subscription.cancelled':
        subscription.status = 'cancelled';
        subscription.cancelledAt = new Date();
        await subscription.save();
        break;

      case 'subscription.updated':
        // Handle subscription updates from payment provider
        break;
    }

    logger.info('[SubscriptionService] Processed webhook', {
      provider,
      event,
      subscriptionId,
    });
  }
}

// ── Singleton export ─────────────────────────────────────────────────────────────

export const subscriptionService = new SubscriptionService();

// ── Helper exports ──────────────────────────────────────────────────────────────

export { getAvailablePlans, getPlanById };
