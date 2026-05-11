/**
 * REE Seed Data
 * Default rules for production
 */

export const SEED_RULES = [
  // ============ COMMISSION RULES ============
  {
    ruleType: 'commission',
    category: 'merchant',
    subCategory: 'restaurant',
    name: 'Restaurant Commission',
    description: 'Standard commission for restaurant merchants',
    conditions: [
      { field: 'merchant.category', operator: 'eq', value: 'restaurant' }
    ],
    conditionLogic: 'AND',
    actions: [
      {
        actionType: 'set_commission',
        params: { commissionRate: 12 },
        order: 1
      }
    ],
    priority: 10,
    isActive: true,
    effectiveFrom: new Date()
  },
  {
    ruleType: 'commission',
    category: 'merchant',
    subCategory: 'retail',
    name: 'Retail Commission',
    description: 'Standard commission for retail merchants',
    conditions: [
      { field: 'merchant.category', operator: 'eq', value: 'retail' }
    ],
    conditionLogic: 'AND',
    actions: [
      { actionType: 'set_commission', params: { commissionRate: 10 }, order: 1 }
    ],
    priority: 10,
    isActive: true,
    effectiveFrom: new Date()
  },

  // ============ CASHBACK RULES ============
  {
    ruleType: 'cashback',
    category: 'user',
    subCategory: 'transaction',
    name: 'Starter Cashback',
    description: 'Base cashback for all users',
    conditions: [
      { field: 'user.tier', operator: 'eq', value: 'starter' }
    ],
    conditionLogic: 'AND',
    actions: [
      {
        actionType: 'credit_coin',
        params: { coinType: 'rez', formula: 'transaction.amount * 0.05' },
        order: 1
      }
    ],
    priority: 10,
    isActive: true,
    effectiveFrom: new Date()
  },
  {
    ruleType: 'cashback',
    category: 'user',
    subCategory: 'gold',
    name: 'Gold Tier Bonus',
    description: 'Extra cashback for gold users',
    conditions: [
      { field: 'user.tier', operator: 'eq', value: 'gold' }
    ],
    conditionLogic: 'AND',
    actions: [
      {
        actionType: 'credit_coin',
        params: { coinType: 'rez', formula: 'transaction.amount * 0.07' },
        order: 1
      }
    ],
    priority: 20,
    isActive: true,
    effectiveFrom: new Date()
  },

  // ============ SOCIAL SHARING ============
  {
    ruleType: 'reward',
    category: 'social',
    subCategory: 'share',
    name: 'Social Share Bonus',
    description: '5% bonus for verified social shares',
    conditions: [
      { field: 'share.verified', operator: 'eq', value: true }
    ],
    conditionLogic: 'AND',
    actions: [
      {
        actionType: 'credit_coin',
        params: { coinType: 'rez', formula: 'transaction.amount * 0.05' },
        order: 1
      }
    ],
    priority: 15,
    isActive: true,
    effectiveFrom: new Date()
  },

  // ============ FRAUD RULES ============
  {
    ruleType: 'fraud_check',
    category: 'velocity',
    name: 'Rapid Click Detection',
    description: 'Flag rapid clicking (>10 per 30s)',
    conditions: [],
    conditionLogic: 'AND',
    actions: [{ actionType: 'log_event', params: { severity: 'medium' }, order: 1 }],
    priority: 100,
    isActive: true,
    effectiveFrom: new Date()
  },
  {
    ruleType: 'fraud_check',
    category: 'velocity',
    name: 'IP Flooding',
    description: 'Block >10 requests/hour per IP',
    conditions: [],
    conditionLogic: 'AND',
    actions: [{ actionType: 'fraud_alert', params: { action: 'block' }, order: 1 }],
    priority: 100,
    isActive: true,
    effectiveFrom: new Date()
  },
  {
    ruleType: 'fraud_check',
    category: 'impossible_travel',
    name: 'Impossible Travel',
    description: 'Block 500km+ travel in 1 hour',
    conditions: [],
    conditionLogic: 'AND',
    actions: [{ actionType: 'fraud_alert', params: { action: 'block' }, order: 1 }],
    priority: 100,
    isActive: true,
    effectiveFrom: new Date()
  },

  // ============ KARMA RULES ============
  {
    ruleType: 'karma',
    category: 'impact',
    name: 'Volunteer Hours',
    description: '15 karma per volunteer hour',
    conditions: [
      { field: 'event.type', operator: 'eq', value: 'volunteer' }
    ],
    conditionLogic: 'AND',
    actions: [
      {
        actionType: 'credit_karma',
        params: { karmaPoints: 15 },
        order: 1
      }
    ],
    priority: 5,
    isActive: true,
    effectiveFrom: new Date()
  },
  {
    ruleType: 'karma',
    category: 'engagement',
    name: 'Daily Check-in Streak',
    description: '2 karma per day, +5 bonus for 7-day streak',
    conditions: [
      { field: 'event.type', operator: 'eq', value: 'checkin' }
    ],
    conditionLogic: 'AND',
    actions: [
      { actionType: 'credit_karma', params: { karmaPoints: 2 }, order: 1 }
    ],
    priority: 5,
    isActive: true,
    effectiveFrom: new Date()
  },

  // ============ BRANDED COINS ============
  {
    ruleType: 'reward',
    category: 'branded',
    subCategory: 'review',
    name: 'Review Bonus',
    description: '10-50 branded coins for reviews',
    conditions: [
      { field: 'review.stars', operator: 'gte', value: 4 }
    ],
    conditionLogic: 'AND',
    actions: [
      {
        actionType: 'credit_coin',
        params: { coinType: 'branded', amount: 20 },
        order: 1
      }
    ],
    priority: 10,
    isActive: true,
    effectiveFrom: new Date()
  },

  // ============ PROMO COINS ============
  {
    ruleType: 'reward',
    category: 'promo',
    name: 'Promo Discount',
    description: 'Campaign-based promo coins',
    conditions: [],
    conditionLogic: 'AND',
    actions: [
      {
        actionType: 'credit_coin',
        params: { coinType: 'promo', amount: 50 },
        order: 1
      }
    ],
    priority: 5,
    isActive: true,
    effectiveFrom: new Date()
  }
];

export const COIN_CONFIGS = {
  rez: {
    name: 'REZ Coins',
    description: 'Platform currency earned on transactions',
    earningRules: [
      { source: 'transaction', percent: 5 },
      { source: 'social_share', percent: 5 }
    ],
    usageRules: [
      { type: 'universal' }
    ],
    expiryDays: 0
  },
  branded: {
    name: 'Branded Coins',
    description: 'Merchant-specific coins',
    earningRules: [
      { source: 'review', amounts: { 1: 5, 5: 50 } }
    ],
    usageRules: [{ type: 'same_merchant_only' }],
    expiryDays: 180
  },
  cashback: {
    name: 'Cashback',
    description: 'Earned from bill uploads',
    earningRules: [
      { source: 'bill_upload', percent: 5 }
    ],
    usageRules: [{ type: 'universal' }],
    expiryDays: 365
  },
  promo: {
    name: 'Promo Coins',
    description: 'Discount currency',
    earningRules: [
      { source: 'campaign' }
    ],
    usageRules: [
      { type: 'discount_only' },
      { type: 'max_discount', value: 100 }
    ],
    expiryDays: 90
  },
  prive: {
    name: 'Prive Coins',
    description: 'Premium universal coins',
    earningRules: [
      { source: 'milestone' }
    ],
    usageRules: [
      { type: 'universal' },
      { type: 'finance_allowed' }
    ],
    expiryDays: 365
  },
  karma: {
    name: 'Karma Coins',
    description: 'Impact economy coins',
    earningRules: [
      { source: 'volunteer', pointsPerHour: 15 }
    ],
    usageRules: [
      { type: 'conversion_only' },
      { type: 'conversion_rate', karmaPerRez: 20 }
    ],
    expiryDays: 0
  }
};
