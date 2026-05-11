/**
 * Event Bridge Service
 *
 * Publishes marketing events to all connected services:
 * - Consumer App (via Redis pub/sub)
 * - Loyalty Ecosystem (via Profile Aggregator)
 * - Notification Service (via BullMQ)
 * - Intent Graph (via HTTP)
 */

import axios from 'axios';
import { redis, publisher } from '../config/redis';

// Event types for cross-service communication
export interface MarketingEvent {
  eventId: string;
  eventType: string;
  timestamp: string;
  source: 'marketing-service';
  data: {
    // Common fields
    merchantId?: string;
    userId?: string;
    campaignId?: string;
    offerId?: string;
    voucherId?: string;
    // Event-specific data
    [key: string]: any;
  };
}

// Services to notify
const SERVICES = {
  PROFILE_AGGREGATOR: process.env.PROFILE_AGGREGATOR_URL || 'http://localhost:4025',
  NOTIFICATIONS: process.env.NOTIFICATIONS_URL || 'http://localhost:4032',
  EVENT_BUS: process.env.EVENT_BUS_URL || 'http://localhost:4031',
  INTENT_GRAPH: process.env.INTENT_GRAPH_URL || 'http://rez-intent-graph.onrender.com',
  CONSUMER_APP_WS: process.env.CONSUMER_WS_URL, // WebSocket for real-time
};

export class EventBridgeService {

  /**
   * Publish event to all connected services
   */
  async publish(event: MarketingEvent): Promise<void> {
    const promises: Promise<void>[] = [];

    // 1. Redis pub/sub for real-time
    promises.push(this.publishToRedis(event));

    // 2. Profile Aggregator - for loyalty updates
    promises.push(this.notifyProfileAggregator(event));

    // 3. Event Bus - for downstream consumers
    promises.push(this.notifyEventBus(event));

    // 4. Intent Graph - for AI insights
    promises.push(this.notifyIntentGraph(event));

    // 5. Consumer App - real-time via WebSocket or polling
    promises.push(this.notifyConsumerApp(event));

    await Promise.allSettled(promises);
  }

  /**
   * Publish to Redis for real-time subscribers
   */
  private async publishToRedis(event: MarketingEvent): Promise<void> {
    try {
      const channel = `marketing.${event.eventType}`;
      await publisher.publish(channel, JSON.stringify(event));

      // Also publish to merchant-specific channel
      if (event.data.merchantId) {
        const merchantChannel = `merchant.${event.data.merchantId}`;
        await publisher.publish(merchantChannel, JSON.stringify(event));
      }

      // Publish to user-specific channel
      if (event.data.userId) {
        const userChannel = `user.${event.data.userId}`;
        await publisher.publish(userChannel, JSON.stringify(event));
      }
    } catch (error) {
      console.error('Redis publish failed:', error);
    }
  }

  /**
   * Notify Profile Aggregator for loyalty updates
   */
  private async notifyProfileAggregator(event: MarketingEvent): Promise<void> {
    // Map marketing events to loyalty events
    const loyaltyEvent = this.mapToLoyaltyEvent(event);
    if (!loyaltyEvent) return;

    try {
      await axios.post(
        `${SERVICES.PROFILE_AGGREGATOR}/api/v1/events`,
        loyaltyEvent,
        { timeout: 5000 }
      );
    } catch (error) {
      console.error('Profile Aggregator notify failed:', error);
    }
  }

  /**
   * Notify Event Bus for downstream processing
   */
  private async notifyEventBus(event: MarketingEvent): Promise<void> {
    try {
      await axios.post(
        `${SERVICES.EVENT_BUS}/api/events/publish`,
        {
          eventType: `marketing.${event.eventType}`,
          userId: event.data.userId,
          merchantId: event.data.merchantId,
          source: 'marketing-service',
          data: event.data,
        },
        { timeout: 5000 }
      );
    } catch (error) {
      console.error('Event Bus notify failed:', error);
    }
  }

  /**
   * Notify Intent Graph for AI insights
   */
  private async notifyIntentGraph(event: MarketingEvent): Promise<void> {
    try {
      await axios.post(
        `${SERVICES.INTENT_GRAPH}/api/intent`,
        {
          source: 'marketing',
          event: event.eventType,
          userId: event.data.userId,
          merchantId: event.data.merchantId,
          data: event.data,
          timestamp: event.timestamp,
        },
        { timeout: 5000 }
      );
    } catch (error) {
      // Intent graph is fire-and-forget
      console.warn('Intent Graph notify failed (non-critical):', error);
    }
  }

  /**
   * Notify Consumer App (via WebSocket or polling endpoint)
   */
  private async notifyConsumerApp(event: MarketingEvent): Promise<void> {
    // In production, this would connect to a WebSocket server
    // For now, we publish to Redis and consumer app subscribes
    try {
      const consumerChannel = `consumer.updates`;
      await publisher.publish(consumerChannel, JSON.stringify({
        type: event.eventType,
        data: event.data,
        timestamp: event.timestamp,
      });
    } catch (error) {
      console.error('Consumer App notify failed:', error);
    }
  }

  /**
   * Map marketing events to loyalty events
   */
  private mapToLoyaltyEvent(event: MarketingEvent): any | null {
    const mappings: Record<string, any> = {
      'campaign.completed': {
        eventType: 'loyalty.campaign_participated',
        userId: event.data.userId,
        data: {
          campaignId: event.data.campaignId,
          merchantId: event.data.merchantId,
        },
      },
      'voucher.redeemed': {
        eventType: 'loyalty.voucher_redeemed',
        userId: event.data.userId,
        data: {
          voucherId: event.data.voucherId,
          merchantId: event.data.merchantId,
          discount: event.data.discountAmount,
        },
      },
      'offer.redeemed': {
        eventType: 'loyalty.offer_redeemed',
        userId: event.data.userId,
        data: {
          offerId: event.data.offerId,
          merchantId: event.data.merchantId,
        },
      },
      'rendez.booking.confirmed': {
        eventType: 'loyalty.social_booking',
        userId: event.data.userId,
        data: {
          rendezId: event.data.rendezId,
          type: event.data.rendezType,
          participants: event.data.participants,
        },
      },
      'karma.campaign.participated': {
        eventType: 'loyalty.karma_earned',
        userId: event.data.userId,
        data: {
          coins: event.data.coinsEarned,
          source: 'karma_campaign',
        },
      },
    };

    return mappings[event.eventType] || null;
  }

  /**
   * Subscribe to marketing events (for testing/monitoring)
   */
  async subscribeToEvents(callback: (event: MarketingEvent) => void): Promise<void> {
    const subscriber = redis.duplicate();

    await subscriber.psubscribe('marketing.*', 'merchant.*', 'user.*');

    subscriber.on('pmessage', (_pattern: string, channel: string, message: string) => {
      try {
        const event = JSON.parse(message);
        callback(event);
      } catch (error) {
        console.error('Failed to parse event:', error);
      }
    });
  }
}

export const eventBridge = new EventBridgeService();

// Marketing event types
export const MARKETING_EVENTS = {
  // Campaign events
  CAMPAIGN_CREATED: 'campaign.created',
  CAMPAIGN_LAUNCHED: 'campaign.launched',
  CAMPAIGN_COMPLETED: 'campaign.completed',

  // Voucher events
  VOUCHER_CREATED: 'voucher.created',
  VOUCHER_REDEEMED: 'voucher.redeemed',

  // Offer events
  OFFER_CREATED: 'offer.created',
  OFFER_REDEEMED: 'offer.redeemed',

  // rendez events
  RENDEZ_BOOKING_CONFIRMED: 'rendez.booking.confirmed',
  RENDEZ_BOOKING_CANCELLED: 'rendez.booking.cancelled',

  // Karma campaign events
  KARMA_CAMPAIGN_PARTICIPATED: 'karma.campaign.participated',
  KARMA_CAMPAIGN_COMPLETED: 'karma.campaign.completed',

  // Subscription events
  SUBSCRIPTION_CREATED: 'subscription.created',
  SUBSCRIPTION_RENEWED: 'subscription.renewed',
  SUBSCRIPTION_CANCELLED: 'subscription.cancelled',

  // Influencer events
  INFLUENCER_APPLICATION: 'influencer.application',
  INFLUENCER_CONTENT_SUBMITTED: 'influencer.content_submitted',
  INFLUENCER_PAYMENT_RELEASED: 'influencer.payment_released',
};
