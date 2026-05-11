/**
 * REZ REAL-TIME TRIGGER ENGINE
 *
 * This connects user behavior to instant actions
 *
 * Triggers fire within 100ms of user action
 */

import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

const PREFIX = 'rde:trigger:';

// ============================================
// TYPES
// ============================================

export type TriggerEvent =
  | 'search'
  | 'scan'
  | 'location_entry'
  | 'location_exit'
  | 'cart_add'
  | 'cart_abandon'
  | 'wishlist_add'
  | 'view'
  | 'purchase'
  | 'review_submit';

export type TriggerAction =
  | 'send_whatsapp'
  | 'send_push'
  | 'send_email'
  | 'show_offer'
  | 'credit_coins'
  | 'show_nearby'
  | 'send_recovery'
  | 'send_loyalty';

export interface TriggerContext {
  userId: string;
  event: TriggerEvent;
  data: {
    intent?: string;
    query?: string;
    merchantId?: string;
    category?: string;
    productId?: string;
    location?: { lat: number; lng: number };
    amount?: number;
    cartValue?: number;
    [key: string]: any;
  };
  timestamp: Date;
}

export interface TriggerRule {
  id: string;
  event: TriggerEvent;
  conditions: TriggerCondition[];
  action: TriggerAction;
  actionConfig: Record<string, any>;
  priority: number;
  active: boolean;
  cooldownMinutes: number;
}

export interface TriggerCondition {
  field: string;
  operator: 'eq' | 'ne' | 'gt' | 'lt' | 'contains' | 'in';
  value: any;
}

export interface TriggerResult {
  triggered: boolean;
  ruleId?: string;
  action?: TriggerAction;
  config?: Record<string, any>;
  decision?: any;
}

// ============================================
// DEFAULT RULES
// ============================================

const DEFAULT_RULES: TriggerRule[] = [
  // Search triggers
  {
    id: 'search_high_intent',
    event: 'search',
    conditions: [
      { field: 'data.query', operator: 'contains', value: ['biryani', 'pizza', 'burger', 'dosa'] }
    ],
    action: 'send_whatsapp',
    actionConfig: {
      template: 'search_offer',
      delay: 0
    },
    priority: 100,
    active: true,
    cooldownMinutes: 120
  },
  {
    id: 'search_generic',
    event: 'search',
    conditions: [],
    action: 'send_push',
    actionConfig: {
      template: 'search_result',
      delay: 300
    },
    priority: 50,
    active: true,
    cooldownMinutes: 240
  },

  // QR Scan triggers
  {
    id: 'scan_credit_coins',
    event: 'scan',
    conditions: [],
    action: 'credit_coins',
    actionConfig: {
      baseCoins: 50,
      bonusForNewUser: 1.5
    },
    priority: 100,
    active: true,
    cooldownMinutes: 0
  },
  {
    id: 'scan_followup',
    event: 'scan',
    conditions: [],
    action: 'send_whatsapp',
    actionConfig: {
      template: 'scan_followup',
      delay: 300 // 5 minutes later
    },
    priority: 80,
    active: true,
    cooldownMinutes: 360
  },

  // Location triggers
  {
    id: 'location_nearby',
    event: 'location_entry',
    conditions: [],
    action: 'show_nearby',
    actionConfig: {
      radius: 500, // meters
      limit: 5
    },
    priority: 70,
    active: true,
    cooldownMinutes: 60
  },

  // Cart triggers
  {
    id: 'cart_abandon_recovery',
    event: 'cart_abandon',
    conditions: [
      { field: 'data.cartValue', operator: 'gt', value: 100 }
    ],
    action: 'send_recovery',
    actionConfig: {
      template: 'cart_recovery',
      delay: 1800, // 30 minutes
      discount: 10
    },
    priority: 100,
    active: true,
    cooldownMinutes: 1440
  },
  {
    id: 'cart_high_value',
    event: 'cart_add',
    conditions: [
      { field: 'data.cartValue', operator: 'gt', value: 500 }
    ],
    action: 'send_whatsapp',
    actionConfig: {
      template: 'cart_high_value',
      delay: 0
    },
    priority: 90,
    active: true,
    cooldownMinutes: 240
  },

  // Purchase triggers
  {
    id: 'purchase_loyalty',
    event: 'purchase',
    conditions: [],
    action: 'send_loyalty',
    actionConfig: {
      coinsPercent: 10 // 10% back in coins
    },
    priority: 100,
    active: true,
    cooldownMinutes: 0
  },
  {
    id: 'purchase_thank_you',
    event: 'purchase',
    conditions: [],
    action: 'send_whatsapp',
    actionConfig: {
      template: 'purchase_thank_you',
      delay: 0
    },
    priority: 100,
    active: true,
    cooldownMinutes: 0
  },

  // View triggers
  {
    id: 'view_multiple',
    event: 'view',
    conditions: [],
    action: 'show_offer',
    actionConfig: {
      threshold: 3,
      template: 'view_offer'
    },
    priority: 60,
    active: true,
    cooldownMinutes: 720
  }
];

// ============================================
// TRIGGER ENGINE
// ============================================

export class RealTimeTriggerEngine {

  /**
   * Process a trigger event - called within 100ms of user action
   */
  async process(event: TriggerContext): Promise<TriggerResult[]> {
    const start = Date.now();

    // 1. Get matching rules
    const rules = await this.getMatchingRules(event);

    // 2. Filter by cooldown
    const eligibleRules = await this.filterByCooldown(event.userId, rules);

    // 3. Sort by priority
    eligibleRules.sort((a, b) => b.priority - a.priority);

    // 4. Execute top rules
    const results: TriggerResult[] = [];

    for (const rule of eligibleRules.slice(0, 3)) { // Max 3 actions per event
      const result = await this.executeRule(event, rule);
      if (result.triggered) {
        results.push(result);

        // Set cooldown
        await this.setCooldown(event.userId, rule);
      }
    }

    const latency = Date.now() - start;
    console.log(`[RDE Triggers] Processed ${event.event} in ${latency}ms, triggered ${results.length} actions`);

    return results;
  }

  /**
   * Get rules matching this event type
   */
  private async getMatchingRules(event: TriggerContext): Promise<TriggerRule[]> {
    // Get all active rules for this event
    const ruleIds = await redis.smembers(`${PREFIX}rules:event:${event.event}`);

    if (ruleIds.length === 0) {
      // Load default rules if not in Redis
      await this.loadDefaultRules();
      return DEFAULT_RULES.filter(r => r.event === event.event && r.active);
    }

    const rules: TriggerRule[] = [];

    for (const ruleId of ruleIds) {
      const rule = await this.getRule(ruleId);
      if (rule && rule.active) {
        if (this.evaluateConditions(event, rule)) {
          rules.push(rule);
        }
      }
    }

    return rules;
  }

  /**
   * Evaluate rule conditions
   */
  private evaluateConditions(event: TriggerContext, rule: TriggerRule): boolean {
    if (rule.conditions.length === 0) {
      return true; // No conditions = always match
    }

    return rule.conditions.every(condition => {
      const value = this.getNestedValue(event, condition.field);
      return this.evaluateOperator(value, condition.operator, condition.value);
    });
  }

  /**
   * Get nested object value by path
   */
  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  /**
   * Evaluate operator
   */
  private evaluateOperator(value: any, operator: string, target: any): boolean {
    switch (operator) {
      case 'eq':
        return value === target;
      case 'ne':
        return value !== target;
      case 'gt':
        return value > target;
      case 'lt':
        return value < target;
      case 'contains':
        return String(value).toLowerCase().includes(String(target).toLowerCase());
      case 'in':
        return Array.isArray(target) && target.includes(value);
      default:
        return false;
    }
  }

  /**
   * Filter rules by cooldown
   */
  private async filterByCooldown(userId: string, rules: TriggerRule[]): Promise<TriggerRule[]> {
    const eligible: TriggerRule[] = [];

    for (const rule of rules) {
      const cooldownKey = `${PREFIX}cooldown:${userId}:${rule.id}`;
      const lastTriggered = await redis.get(cooldownKey);

      if (!lastTriggered) {
        eligible.push(rule);
      } else {
        const minutesSince = (Date.now() - parseInt(lastTriggered)) / 60000;
        if (minutesSince >= rule.cooldownMinutes) {
          eligible.push(rule);
        }
      }
    }

    return eligible;
  }

  /**
   * Set cooldown for rule
   */
  private async setCooldown(userId: string, rule: TriggerRule): Promise<void> {
    const cooldownKey = `${PREFIX}cooldown:${userId}:${rule.id}`;
    await redis.set(cooldownKey, Date.now().toString());
    await redis.expire(cooldownKey, rule.cooldownMinutes * 60);
  }

  /**
   * Execute a rule
   */
  private async executeRule(event: TriggerContext, rule: TriggerRule): Promise<TriggerResult> {
    // Build action config
    const actionConfig = { ...rule.actionConfig };

    // Customize based on event data
    if (rule.action === 'send_whatsapp') {
      actionConfig.content = this.buildWhatsAppContent(event, rule);
      actionConfig.merchantId = event.data.merchantId;
      actionConfig.intent = event.data.intent;
    }

    if (rule.action === 'credit_coins') {
      actionConfig.coins = this.calculateCoins(event, rule);
    }

    // Get decision from Supreme Controller
    const decision = await this.getDecision(event, rule, actionConfig);

    return {
      triggered: decision.approved,
      ruleId: rule.id,
      action: rule.action,
      config: actionConfig,
      decision
    };
  }

  /**
   * Build WhatsApp content
   */
  private buildWhatsAppContent(event: TriggerContext, rule: TriggerRule): string {
    const templates: Record<string, string> = {
      'search_offer': `🔥 Found the best ${event.data.query} near you!

Get 20% off your first order. Click to claim 👇`,

      'scan_followup': `Your free sample is waiting!

Visit us today and show this message to claim your ${event.data.category || 'reward'}.

Coins credited to your wallet! 🪙`,

      'cart_recovery': `You left something behind! 🛒

Complete your order within 24 hours and get 10% extra off!

Tap to continue →`,

      'purchase_thank_you': `Order confirmed! 🎉

Thank you for ordering with us.

Your coins are on the way! 🪙`
    };

    return templates[rule.actionConfig.template] || `Check out this offer!`;
  }

  /**
   * Calculate coin reward
   */
  private calculateCoins(event: TriggerContext, rule: TriggerRule): number {
    let coins = rule.actionConfig.baseCoins || 50;

    // Check if new user
    const isNewUser = !event.data.userHistory;
    if (isNewUser && rule.actionConfig.bonusForNewUser) {
      coins = Math.round(coins * rule.actionConfig.bonusForNewUser);
    }

    return coins;
  }

  /**
   * Get decision from Supreme Controller
   */
  private async getDecision(event: TriggerContext, rule: TriggerRule, actionConfig: any): Promise<any> {
    const channelMap: Record<string, string> = {
      'send_whatsapp': 'whatsapp',
      'send_push': 'push',
      'send_email': 'email',
      'credit_coins': 'qr',
      'show_nearby': 'push'
    };

    // Call Supreme Controller
    const response = await fetch(`${process.env.RDE_URL || 'https://rez-decision-engine.onrender.com'}/api/rde/decide`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: event.userId,
        action: 'send_message',
        channel: channelMap[rule.action] || 'whatsapp',
        context: {
          trigger: rule.id,
          merchantId: event.data.merchantId,
          intent: event.data.intent,
          location: event.data.location
        }
      })
    });

    return response.json();
  }

  /**
   * Get rule by ID
   */
  private async getRule(ruleId: string): Promise<TriggerRule | null> {
    const data = await redis.hgetall(`${PREFIX}rule:${ruleId}`);
    if (!data || Object.keys(data).length === 0) {
      return null;
    }
    return {
      id: data.id,
      event: data.event as TriggerEvent,
      conditions: data.conditions ? JSON.parse(data.conditions) : [],
      action: data.action as TriggerAction,
      actionConfig: data.actionConfig ? JSON.parse(data.actionConfig) : {},
      priority: parseInt(data.priority),
      active: data.active === 'true',
      cooldownMinutes: parseInt(data.cooldownMinutes)
    };
  }

  /**
   * Load default rules to Redis
   */
  private async loadDefaultRules(): Promise<void> {
    for (const rule of DEFAULT_RULES) {
      await this.saveRule(rule);
    }
    console.log(`[RDE Triggers] Loaded ${DEFAULT_RULES.length} default rules`);
  }

  /**
   * Save rule to Redis
   */
  async saveRule(rule: TriggerRule): Promise<void> {
    const key = `${PREFIX}rule:${rule.id}`;
    await redis.hmset(key, {
      id: rule.id,
      event: rule.event,
      conditions: JSON.stringify(rule.conditions),
      action: rule.action,
      actionConfig: JSON.stringify(rule.actionConfig),
      priority: rule.priority.toString(),
      active: rule.active.toString(),
      cooldownMinutes: rule.cooldownMinutes.toString()
    });

    // Add to event index
    await redis.sadd(`${PREFIX}rules:event:${rule.event}`, rule.id);
  }

  /**
   * Get all rules
   */
  async getAllRules(): Promise<TriggerRule[]> {
    const ruleIds = await redis.keys(`${PREFIX}rule:*`);
    const rules: TriggerRule[] = [];

    for (const key of ruleIds) {
      const rule = await this.getRule(key.split(':').pop()!);
      if (rule) rules.push(rule);
    }

    return rules.length > 0 ? rules : DEFAULT_RULES;
  }

  /**
   * Toggle rule
   */
  async toggleRule(ruleId: string, active: boolean): Promise<void> {
    await redis.hset(`${PREFIX}rule:${ruleId}`, 'active', active.toString());
  }
}

// Export singleton
export const triggerEngine = new RealTimeTriggerEngine();

// Convenience function
export async function processTrigger(event: TriggerContext): Promise<TriggerResult[]> {
  return triggerEngine.process(event);
}
