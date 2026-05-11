/**
 * Trigger Engine Service
 *
 * Real-time event-driven marketing automation
 */

import mongoose from 'mongoose';

// Types
export interface ITriggerRule {
  _id: mongoose.Types.ObjectId;
  merchantId: string;
  name: string;
  description?: string;
  triggerType: 'inactivity' | 'location' | 'time' | 'event' | 'behavior' | 'birthday';
  conditions: {
    type: string;
    operator: 'eq' | 'ne' | 'gt' | 'lt' | 'gte' | 'lte' | 'contains';
    field: string;
    value: any;
  }[];
  actions: {
    type: 'push' | 'sms' | 'email' | 'in_app';
    template?: string;
    message?: string;
    delay?: number; // minutes
  }[];
  isActive: boolean;
  lastTriggered?: Date;
  triggeredCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface ITriggerEvent {
  _id: mongoose.Types.ObjectId;
  ruleId: string;
  userId: string;
  triggeredAt: Date;
  action: string;
  status: 'pending' | 'sent' | 'failed';
  metadata?: Record<string, any>;
}

// Schema
const TriggerRuleSchema = new Schema<ITriggerRule>({
  merchantId: { type: String, required: true, index: true },
  name: { type: String, required: true },
  description: String,
  triggerType: {
    type: String,
    enum: ['inactivity', 'location', 'time', 'event', 'behavior', 'birthday'],
    required: true,
  },
  conditions: [{
    type: { type: String, required: true },
    operator: { type: String, enum: ['eq', 'ne', 'gt', 'lt', 'gte', 'lte', 'contains'] },
    field: { type: String, required: true },
    value: Schema.Types.Mixed,
  }],
  actions: [{
    type: { type: String, enum: ['push', 'sms', 'email', 'in_app'], required: true },
    template: String,
    message: String,
    delay: Number,
  }],
  isActive: { type: Boolean, default: true },
  lastTriggered: Date,
  triggeredCount: { type: Number, default: 0 },
}, { timestamps: true });

TriggerRuleSchema.index({ merchantId: 1, triggerType: 1 });
TriggerRuleSchema.index({ merchantId: 1, isActive: 1 });

const TriggerEventSchema = new Schema<ITriggerEvent>({
  ruleId: { type: String, required: true, index: true },
  userId: { type: String, required: true, index: true },
  triggeredAt: { type: Date, default: Date.now },
  action: { type: String, required: true },
  status: { type: String, enum: ['pending', 'sent', 'failed'], default: 'pending' },
  metadata: Schema.Types.Mixed,
});

TriggerEventSchema.index({ ruleId: 1, triggeredAt: -1 });

export const TriggerRule = mongoose.model<ITriggerRule>('TriggerRule', TriggerRuleSchema);
export const TriggerEvent = mongoose.model<ITriggerEvent>('TriggerEvent', TriggerEventSchema);

// Service
export class TriggerEngine {

  /**
   * Create trigger rule
   */
  async createRule(data: Partial<ITriggerRule>): Promise<ITriggerRule> {
    const rule = new TriggerRule(data);
    await rule.save();
    return rule;
  }

  /**
   * Get merchant rules
   */
  async getMerchantRules(merchantId: string, triggerType?: string): Promise<ITriggerRule[]> {
    const query: any = { merchantId };
    if (triggerType) query.triggerType = triggerType;
    return TriggerRule.find(query).sort({ createdAt: -1 });
  }

  /**
   * Update rule
   */
  async updateRule(ruleId: string, updates: Partial<ITriggerRule>): Promise<ITriggerRule | null> {
    return TriggerRule.findByIdAndUpdate(ruleId, updates, { new: true });
  }

  /**
   * Toggle rule active/inactive
   */
  async toggleRule(ruleId: string, isActive: boolean): Promise<ITriggerRule | null> {
    return TriggerRule.findByIdAndUpdate(ruleId, { isActive }, { new: true });
  }

  /**
   * Evaluate user against rules
   */
  async evaluateUser(userId: string, userData: Record<string, any>): Promise<ITriggerRule[]> {
    // Get all active rules
    const rules = await TriggerRule.find({ isActive: true });

    const matchingRules: ITriggerRule[] = [];

    for (const rule of rules) {
      if (this.evaluateConditions(rule.conditions, userData)) {
        matchingRules.push(rule);
      }
    }

    return matchingRules;
  }

  /**
   * Trigger action for user
   */
  async triggerAction(rule: ITriggerRule, userId: string): Promise<ITriggerEvent[]> {
    const events: ITriggerEvent[] = [];

    for (const action of rule.actions) {
      const event = new TriggerEvent({
        ruleId: rule._id.toString(),
        userId,
        action: action.type,
        status: 'pending',
        metadata: { action, template: action.template, message: action.message },
      });

      // Apply delay if specified
      if (action.delay && action.delay > 0) {
        // In production, use BullMQ for delayed jobs
        setTimeout(async () => {
          await this.sendAction(action);
          event.status = 'sent';
          event.triggeredAt = new Date();
          await event.save();
        }, action.delay * 60 * 1000);
      } else {
        await this.sendAction(action);
        event.status = 'sent';
        event.triggeredAt = new Date();
      }

      await event.save();
      events.push(event);
    }

    // Update rule stats
    await TriggerRule.findByIdAndUpdate(rule._id, {
      lastTriggered: new Date(),
      $inc: { triggeredCount: 1 },
    });

    return events;
  }

  /**
   * Get trigger events for user
   */
  async getUserEvents(userId: string, limit = 50): Promise<ITriggerEvent[]> {
    return TriggerEvent.find({ userId })
      .sort({ triggeredAt: -1 })
      .limit(limit);
  }

  /**
   * Get rule analytics
   */
  async getRuleAnalytics(ruleId: string): Promise<any> {
    const rule = await TriggerRule.findById(ruleId);
    if (!rule) return null;

    const events = await TriggerEvent.find({ ruleId });

    const sent = events.filter(e => e.status === 'sent').length;
    const failed = events.filter(e => e.status === 'failed').length;

    return {
      rule: {
        name: rule.name,
        triggerType: rule.triggerType,
        isActive: rule.isActive,
        triggeredCount: rule.triggeredCount,
        lastTriggered: rule.lastTriggered,
      },
      events: {
        total: events.length,
        sent,
        failed,
        pending: events.length - sent - failed,
      },
      conversion: {
        sent,
        rate: events.length > 0 ? (sent / events.length) * 100 : 0,
      },
    };
  }

  /**
   * Evaluate conditions
   */
  private evaluateConditions(conditions: ITriggerRule['conditions'], data: Record<string, any>): boolean {
    if (!conditions || conditions.length === 0) return true;

    for (const condition of conditions) {
      const value = this.getFieldValue(data, condition.field);
      if (!this.evaluateOperator(condition.operator, value, condition.value)) {
        return false;
      }
    }
    return true;
  }

  /**
   * Get nested field value
   */
  private getFieldValue(data: Record<string, any>, field: string): any {
    const parts = field.split('.');
    let value: any = data;
    for (const part of parts) {
      value = value?.[part];
    }
    return value;
  }

  /**
   * Evaluate operator
   */
  private evaluateOperator(operator: string, value: any, target: any): boolean {
    switch (operator) {
      case 'eq': return value === target;
      case 'ne': return value !== target;
      case 'gt': return value > target;
      case 'lt': return value < target;
      case 'gte': return value >= target;
      case 'lte': return value <= target;
      case 'contains': return String(value).includes(String(target));
      default: return false;
    }
  }

  /**
   * Send action (mock implementation)
   */
  private async sendAction(action: ITriggerRule['actions'][0]): Promise<void> {
    // In production, integrate with notification service
    console.log(`Sending ${action.type}: ${action.message || action.template}`);
  }
}

export const triggerEngine = new TriggerEngine();

// Pre-built templates
export const TRIGGER_TEMPLATES = [
  {
    name: 'Welcome Back After Inactivity',
    triggerType: 'inactivity',
    description: 'Send offer to users inactive for 7+ days',
    conditions: [
      { type: 'days_since_visit', operator: 'gt', field: 'daysSinceVisit', value: 7 },
    ],
    actions: [
      { type: 'push', template: 'welcome_back', delay: 0 },
    ],
  },
  {
    name: 'Birthday Special',
    triggerType: 'birthday',
    description: 'Send birthday offer',
    conditions: [
      { type: 'is_birthday', operator: 'eq', field: 'isBirthday', value: true },
    ],
    actions: [
      { type: 'push', template: 'birthday_special', delay: 0 },
      { type: 'email', template: 'birthday_email', delay: 60 },
    ],
  },
  {
    name: 'First Visit Reminder',
    triggerType: 'event',
    description: 'Send reminder for first-time visitors',
    conditions: [
      { type: 'visit_count', operator: 'eq', field: 'totalVisits', value: 1 },
    ],
    actions: [
      { type: 'push', template: 'first_visit_thank_you', delay: 60 },
    ],
  },
  {
    name: 'Abandoned Cart',
    triggerType: 'behavior',
    description: 'Send offer after browsing without purchase',
    conditions: [
      { type: 'has_browsed', operator: 'eq', field: 'browsedRecently', value: true },
      { type: 'has_purchased', operator: 'eq', field: 'purchasedRecently', value: false },
    ],
    actions: [
      { type: 'push', template: 'abandoned_cart', delay: 120 },
      { type: 'email', template: 'abandoned_cart_email', delay: 240 },
    ],
  },
];
