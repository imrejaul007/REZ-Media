import { logger } from '../config/logger';
import { leadCaptureService } from '../services/leadCapture';
import { productDiscoveryService } from '../services/productDiscovery';
import { linkService } from '../services/linkService';

export interface FollowUpState {
  leadId: string;
  userId: string;
  username: string;
  type: FollowUpType;
  stage: FollowUpStage;
  productId?: string;
  productName?: string;
  cartValue?: number;
  lastMessage?: string;
  followUpCount: number;
  maxFollowUps: number;
  nextFollowUp?: Date;
  createdAt: Date;
  completedAt?: Date;
  metadata: Record<string, unknown>;
}

export type FollowUpType =
  | 'abandoned_cart'
  | 'product_inquiry'
  | 'price_quote'
  | 'out_of_stock'
  | 'back_in_stock'
  | 'order_update'
  | 'review_request'
  | 're_engagement';

export type FollowUpStage =
  | 'pending'
  | 'scheduled'
  | 'message_1_sent'
  | 'message_2_sent'
  | 'message_3_sent'
  | 'converted'
  | 'unsubscribed'
  | 'exhausted';

export interface FollowUpMessage {
  stage: FollowUpStage;
  delayHours: number;
  template: string;
  hasOffer?: boolean;
  offerType?: 'discount' | 'free_shipping' | 'bonus_item';
  offerValue?: number;
}

export class FollowUpFlow {
  private activeFlows: Map<string, FollowUpState> = new Map();
  private messageTemplates: Map<FollowUpType, FollowUpMessage[]> = new Map();

  constructor() {
    this.initializeTemplates();
  }

  private initializeTemplates(): void {
    // Abandoned cart templates
    this.messageTemplates.set('abandoned_cart', [
      { stage: 'message_1_sent', delayHours: 2, template: 'Hey! You left something behind 👀' },
      {
        stage: 'message_2_sent',
        delayHours: 24,
        template: 'Still thinking about it? Your cart is waiting!',
        hasOffer: true,
        offerType: 'free_shipping',
        offerValue: 0
      },
      {
        stage: 'message_3_sent',
        delayHours: 72,
        template: 'Last chance! 10% off your order if you complete checkout today',
        hasOffer: true,
        offerType: 'discount',
        offerValue: 10
      }
    ]);

    // Product inquiry follow-up templates
    this.messageTemplates.set('product_inquiry', [
      { stage: 'message_1_sent', delayHours: 4, template: 'Hi! Did you get all the info you needed?' },
      {
        stage: 'message_2_sent',
        delayHours: 48,
        template: 'Just checking in! Still interested in that product?'
      }
    ]);

    // Price quote templates
    this.messageTemplates.set('price_quote', [
      { stage: 'message_1_sent', delayHours: 24, template: 'Ready with that quote!' },
      {
        stage: 'message_2_sent',
        delayHours: 72,
        template: 'Hey! The price I mentioned is still available. Want me to hold it?'
      }
    ]);

    // Back in stock templates
    this.messageTemplates.set('back_in_stock', [
      {
        stage: 'message_1_sent',
        delayHours: 0,
        template: 'Good news! Your favorite item is back in stock! 🎉'
      },
      {
        stage: 'message_2_sent',
        delayHours: 48,
        template: 'Just a heads up - limited stock available!',
        hasOffer: true,
        offerType: 'free_shipping'
      }
    ]);

    // Re-engagement templates
    this.messageTemplates.set('re_engagement', [
      {
        stage: 'message_1_sent',
        delayHours: 0,
        template: 'Hey! We\'ve got some new arrivals you might love ✨'
      },
      { stage: 'message_2_sent', delayHours: 168, template: 'Missing you! Here\'s 15% off for your next order' }
    ]);
  }

  createFollowUp(
    userId: string,
    username: string,
    type: FollowUpType,
    options?: {
      productId?: string;
      productName?: string;
      cartValue?: number;
    }
  ): FollowUpState {
    const lead = leadCaptureService.findByInstagramId(userId);
    const leadId = lead?.id || `pending_${userId}`;

    const state: FollowUpState = {
      leadId,
      userId,
      username,
      type,
      stage: 'pending',
      productId: options?.productId,
      productName: options?.productName,
      cartValue: options?.cartValue,
      followUpCount: 0,
      maxFollowUps: this.getMaxFollowUps(type),
      createdAt: new Date(),
      metadata: {}
    };

    const flowKey = this.getFlowKey(userId, type);
    this.activeFlows.set(flowKey, state);

    logger.info('Follow-up created', { userId, username, type });
    return state;
  }

  private getFlowKey(userId: string, type: FollowUpType): string {
    return `${userId}_${type}`;
  }

  private getMaxFollowUps(type: FollowUpType): number {
    const maxMap: Record<FollowUpType, number> = {
      abandoned_cart: 3,
      product_inquiry: 2,
      price_quote: 2,
      out_of_stock: 1,
      back_in_stock: 2,
      order_update: 1,
      review_request: 1,
      re_engagement: 2
    };
    return maxMap[type] || 2;
  }

  getFlow(userId: string, type: FollowUpType): FollowUpState | undefined {
    const flowKey = this.getFlowKey(userId, type);
    return this.activeFlows.get(flowKey);
  }

  scheduleNextMessage(userId: string, type: FollowUpType): FollowUpState | undefined {
    const flow = this.getFlow(userId, type);
    if (!flow) return undefined;

    const templates = this.messageTemplates.get(type);
    if (!templates || flow.followUpCount >= templates.length) {
      flow.stage = 'exhausted';
      return flow;
    }

    const nextTemplate = templates[flow.followUpCount];
    const nextFollowUp = new Date(Date.now() + nextTemplate.delayHours * 60 * 60 * 1000);

    flow.nextFollowUp = nextFollowUp;
    flow.stage = 'scheduled';

    logger.info('Follow-up scheduled', {
      userId,
      type,
      delayHours: nextTemplate.delayHours,
      scheduledFor: nextFollowUp.toISOString()
    });

    return flow;
  }

  getMessageForStage(flow: FollowUpState): {
    message: string;
    hasOffer: boolean;
    offerDetails?: { type: string; value: number };
    links?: string[];
  } | null {
    const templates = this.messageTemplates.get(flow.type);
    if (!templates) return null;

    const templateIndex = flow.followUpCount;
    const template = templates[templateIndex];

    if (!template) return null;

    // Personalize message
    let message = template.template;
    message = message.replace('{username}', flow.username);
    message = message.replace('{product}', flow.productName || 'your item');

    const result: {
      message: string;
      hasOffer: boolean;
      offerDetails?: { type: string; value: number };
      links?: string[];
    } = {
      message,
      hasOffer: template.hasOffer || false
    };

    // Add offer details if applicable
    if (template.hasOffer && template.offerType) {
      result.offerDetails = {
        type: template.offerType,
        value: template.offerValue || 0
      };
    }

    // Generate relevant links
    if (flow.productId) {
      const productLink = linkService.generateProductLink(flow.productId);
      result.links = [productLink.shortCode || productLink.url];
    }

    return result;
  }

  recordMessageSent(userId: string, type: FollowUpType): FollowUpState | undefined {
    const flow = this.getFlow(userId, type);
    if (!flow) return undefined;

    flow.followUpCount++;
    flow.lastMessage = this.getMessageForStage(flow)?.message;

    // Update stage
    const stageMap: Record<number, FollowUpStage> = {
      1: 'message_1_sent',
      2: 'message_2_sent',
      3: 'message_3_sent'
    };
    flow.stage = stageMap[flow.followUpCount] || 'message_3_sent';

    logger.info('Follow-up message recorded', {
      userId,
      type,
      followUpCount: flow.followUpCount
    });

    // Schedule next message
    return this.scheduleNextMessage(userId, type);
  }

  markConverted(userId: string, type: FollowUpType): boolean {
    const flow = this.getFlow(userId, type);
    if (!flow) return false;

    flow.stage = 'converted';
    flow.completedAt = new Date();

    logger.info('Follow-up converted', { userId, type });
    return true;
  }

  markUnsubscribed(userId: string, type: FollowUpType): boolean {
    const flow = this.getFlow(userId, type);
    if (!flow) return false;

    flow.stage = 'unsubscribed';
    flow.completedAt = new Date();

    logger.info('Follow-up unsubscribed', { userId, type });
    return true;
  }

  getDueFollowUps(): FollowUpState[] {
    const now = new Date();
    const due: FollowUpState[] = [];

    for (const flow of this.activeFlows.values()) {
      if (
        flow.stage === 'pending' ||
        flow.stage === 'scheduled' ||
        (flow.nextFollowUp && flow.nextFollowUp <= now)
      ) {
        if (flow.followUpCount < flow.maxFollowUps) {
          due.push(flow);
        }
      }
    }

    return due;
  }

  cleanupCompletedFlows(): number {
    let cleaned = 0;
    const now = new Date();

    for (const [key, flow] of this.activeFlows.entries()) {
      if (
        flow.stage === 'converted' ||
        flow.stage === 'unsubscribed' ||
        flow.stage === 'exhausted' ||
        (flow.completedAt && now.getTime() - flow.completedAt.getTime() > 7 * 24 * 60 * 60 * 1000)
      ) {
        this.activeFlows.delete(key);
        cleaned++;
      }
    }

    return cleaned;
  }

  getStats(): {
    total: number;
    byType: Record<FollowUpType, number>;
    byStage: Record<FollowUpStage, number>;
    conversionRate: number;
  } {
    const flows = Array.from(this.activeFlows.values());

    const byType: Record<string, number> = {};
    const byStage: Record<string, number> = {};
    let converted = 0;

    for (const flow of flows) {
      byType[flow.type] = (byType[flow.type] || 0) + 1;
      byStage[flow.stage] = (byStage[flow.stage] || 0) + 1;

      if (flow.stage === 'converted') {
        converted++;
      }
    }

    return {
      total: flows.length,
      byType: byType as Record<FollowUpType, number>,
      byStage: byStage as Record<FollowUpStage, number>,
      conversionRate: flows.length > 0 ? converted / flows.length : 0
    };
  }

  // Create abandoned cart follow-up
  createAbandonedCartFollowUp(
    userId: string,
    username: string,
    productId: string,
    cartValue: number
  ): FollowUpState {
    const product = productDiscoveryService.getProductById(productId);

    const flow = this.createFollowUp(userId, username, 'abandoned_cart', {
      productId,
      productName: product?.name,
      cartValue
    });

    // Schedule first message
    this.scheduleNextMessage(userId, 'abandoned_cart');

    return flow;
  }

  // Create back in stock follow-up
  createBackInStockFollowUp(
    userId: string,
    username: string,
    productId: string
  ): FollowUpState {
    const product = productDiscoveryService.getProductById(productId);

    const flow = this.createFollowUp(userId, username, 'back_in_stock', {
      productId,
      productName: product?.name
    });

    // Immediately schedule first message
    this.scheduleNextMessage(userId, 'back_in_stock');

    return flow;
  }

  // Create re-engagement follow-up
  createReEngagementFollowUp(
    userId: string,
    username: string
  ): FollowUpState {
    const flow = this.createFollowUp(userId, username, 're_engagement');

    // Schedule first message
    this.scheduleNextMessage(userId, 're_engagement');

    return flow;
  }
}

export const followUpFlow = new FollowUpFlow();
