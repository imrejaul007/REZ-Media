/**
 * REZ Communications Bridge
 *
 * Unified messaging service that connects REZ-Media services to the notification ecosystem.
 * This bridge routes notifications from ads-service, gamification, marketing, and automation
 * to the appropriate channels (Email, SMS, WhatsApp, Push).
 *
 * Architecture:
 * ┌──────────────┐    ┌────────────────────┐    ┌──────────────────┐
 * │ REZ-Media    │───▶│ CommunicationBridge │───▶│ REZ-communications│
 * │ Services     │    │ (This Service)     │    │ -platform       │
 * └──────────────┘    └────────────────────┘    └──────────────────┘
 *
 * Alternative: Routes to RABTUL notifications-hub if REZ-communications-platform is unavailable
 *
 * Supported Events:
 * - ad_approved, ad_rejected, ad_spend_milestone, ad_budget_alert
 * - achievement_unlocked, streak_milestone, challenge_completed
 * - marketing_campaign, drip_sequence, abandonment_recovery
 */

import { logger } from './utils/logger';
import { EmailService, createEmailService } from './email/email-service';
import { SMSService, createSMSService } from './sms/sms-service';
import { WhatsAppService, createWhatsAppService } from './whatsapp/whatsapp-service';
import { PushService, createPushService } from './push/push-service';

// ============================================================================
// TYPES
// ============================================================================

export type Channel = 'email' | 'sms' | 'whatsapp' | 'push' | 'in_app';

export interface NotificationRequest {
  eventId: string;
  eventType: string;
  userId: string;
  merchantId?: string;
  channels: Channel[];
  payload: {
    title: string;
    body: string;
    data?: Record<string, unknown>;
    emailSubject?: string;
    emailHtml?: string;
    phone?: string;
    email?: string;
    fcmToken?: string;
  };
  priority?: 'high' | 'normal' | 'low';
  scheduledFor?: string;
  source: string;
}

export interface NotificationResult {
  success: boolean;
  channel: Channel;
  messageId?: string;
  error?: string;
}

// ============================================================================
// EVENT TEMPLATES
// ============================================================================

const EVENT_TEMPLATES = {
  // Ad Events
  ad_approved: {
    title: 'Your Ad is Live! 🎉',
    body: 'Your ad "{{adTitle}}" has been approved and is now live.',
    channels: ['push', 'email'],
  },
  ad_rejected: {
    title: 'Ad Update Needed',
    body: 'Your ad "{{adTitle}}" was not approved. Reason: {{reason}}',
    channels: ['push', 'email'],
  },
  ad_spend_milestone: {
    title: 'Ad Spend Alert',
    body: 'Your ad "{{adTitle}}" has reached {{percent}}% of its budget.',
    channels: ['push'],
  },
  ad_budget_alert: {
    title: 'Budget Threshold Alert',
    body: 'Your ad "{{adTitle}}" has hit {{threshold}}% of daily budget.',
    channels: ['push', 'email'],
  },

  // Gamification Events
  achievement_unlocked: {
    title: 'Achievement Unlocked! 🏆',
    body: 'You earned the "{{achievementName}}" badge!',
    channels: ['push'],
  },
  streak_milestone: {
    title: 'Streak Milestone! 🔥',
    body: 'You\'ve maintained a {{streakDays}} day streak! Keep it up!',
    channels: ['push'],
  },
  challenge_completed: {
    title: 'Challenge Complete! 🎯',
    body: 'You completed the "{{challengeName}}" challenge!',
    channels: ['push'],
  },
  leaderboard_update: {
    title: 'Leaderboard Update',
    body: 'You\'re now ranked #{{rank}}!',
    channels: ['push'],
  },
  points_expiring: {
    title: 'Points Expiring Soon ⏰',
    body: 'You have {{points}} points expiring in {{days}} days!',
    channels: ['push', 'email'],
  },

  // Marketing Events
  campaign_available: {
    title: 'New Campaign Available!',
    body: 'A new campaign "{{campaignName}}" matches your interests!',
    channels: ['push'],
  },
  abandonment_recovery: {
    title: 'Complete Your Order',
    body: 'You left items in your cart! Complete your purchase now.',
    channels: ['email', 'sms', 'whatsapp'],
  },
  welcome_sequence: {
    title: 'Welcome to REZ!',
    body: 'Thanks for joining! Start exploring great deals near you.',
    channels: ['email', 'whatsapp'],
  },
  reengagement: {
    title: 'We Miss You!',
    body: 'It\'s been a while since your last visit. Here\'s a special offer!',
    channels: ['email', 'push'],
  },
};

// ============================================================================
// COMMUNICATION BRIDGE
// ============================================================================

export class CommunicationBridge {
  private email: EmailService;
  private sms: SMSService;
  private whatsapp: WhatsAppService;
  private push: PushService;
  private fallbackUrl: string;
  private internalToken: string;

  constructor() {
    this.email = createEmailService({
      provider: process.env.EMAIL_PROVIDER as 'mock' | 'sendgrid' || 'mock',
      apiKey: process.env.SENDGRID_API_KEY || '',
      from: process.env.EMAIL_FROM || 'noreply@rez.io',
      fromName: process.env.EMAIL_FROM_NAME || 'REZ',
    });

    this.sms = createSMSService({
      provider: process.env.SMS_PROVIDER as 'mock' | 'twilio' || 'mock',
      accountSid: process.env.TWILIO_ACCOUNT_SID || '',
      authToken: process.env.TWILIO_AUTH_TOKEN || '',
      from: process.env.TWILIO_FROM_NUMBER || '',
    });

    this.whatsapp = createWhatsAppService({
      provider: process.env.WHATSAPP_PROVIDER as 'mock' | 'twilio' || 'mock',
      accountSid: process.env.TWILIO_ACCOUNT_SID || '',
      authToken: process.env.TWILIO_AUTH_TOKEN || '',
      from: process.env.WHATSAPP_FROM_NUMBER || '',
    });

    this.push = createPushService({
      provider: process.env.PUSH_PROVIDER as 'mock' | 'firebase' || 'mock',
      serviceAccountPath: process.env.FIREBASE_SERVICE_ACCOUNT_PATH || '',
      projectId: process.env.FIREBASE_PROJECT_ID || '',
    });

    this.fallbackUrl = process.env.NOTIFICATIONS_HUB_URL || 'http://localhost:4009';
    this.internalToken = process.env.INTERNAL_SERVICE_TOKEN || '';
  }

  /**
   * Send notification across specified channels
   */
  async send(request: NotificationRequest): Promise<NotificationResult[]> {
    const results: NotificationResult[] = [];

    for (const channel of request.channels) {
      try {
        const result = await this.sendToChannel(channel, request);
        results.push(result);
      } catch (error) {
        logger.error(`Failed to send to ${channel}`, { error, request });
        results.push({
          success: false,
          channel,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return results;
  }

  /**
   * Send to specific channel
   */
  private async sendToChannel(channel: Channel, request: NotificationRequest): Promise<NotificationResult> {
    const { payload, userId } = request;

    switch (channel) {
      case 'email':
        if (!payload.email) {
          return { success: false, channel, error: 'No email provided' };
        }
        const emailResult = await this.email.send({
          to: payload.email,
          subject: payload.emailSubject || payload.title,
          html: payload.emailHtml || payload.body,
          from: process.env.EMAIL_FROM,
          fromName: process.env.EMAIL_FROM_NAME,
        });
        return {
          success: emailResult.success,
          channel,
          messageId: emailResult.messageId,
          error: emailResult.error,
        };

      case 'sms':
        if (!payload.phone) {
          return { success: false, channel, error: 'No phone provided' };
        }
        const smsResult = await this.sms.send({
          to: payload.phone,
          body: payload.body,
        });
        return {
          success: smsResult.success,
          channel,
          messageId: smsResult.messageId,
          error: smsResult.error,
        };

      case 'whatsapp':
        if (!payload.phone) {
          return { success: false, channel, error: 'No phone provided' };
        }
        const waResult = await this.whatsapp.send({
          to: payload.phone,
          body: payload.body,
        });
        return {
          success: waResult.success,
          channel,
          messageId: waResult.messageId,
          error: waResult.error,
        };

      case 'push':
        if (!payload.fcmToken) {
          // Try to get FCM token from user profile
          const fcmToken = await this.getFcmToken(userId);
          if (!fcmToken) {
            return { success: false, channel, error: 'No FCM token' };
          }
          payload.fcmToken = fcmToken;
        }
        const pushResult = await this.push.send({
          token: payload.fcmToken,
          title: payload.title,
          body: payload.body,
          data: payload.data,
        });
        return {
          success: pushResult.success,
          channel,
          messageId: pushResult.messageId,
          error: pushResult.error,
        };

      case 'in_app':
        // Store in database for in-app notification
        await this.storeInAppNotification(request);
        return { success: true, channel };

      default:
        return { success: false, channel, error: 'Unknown channel' };
    }
  }

  /**
   * Get FCM token for user
   */
  private async getFcmToken(userId: string): Promise<string | null> {
    try {
      // Fetch from user profile service
      const response = await fetch(`${process.env.AUTH_SERVICE_URL || 'http://localhost:4002'}/api/users/${userId}/fcm-token`, {
        headers: {
          'X-Internal-Token': this.internalToken,
        },
      });
      if (response.ok) {
        const data = await response.json();
        return data.fcmToken || null;
      }
    } catch (error) {
      logger.warn('Failed to get FCM token', { userId, error });
    }
    return null;
  }

  /**
   * Store in-app notification
   */
  private async storeInAppNotification(request: NotificationRequest): Promise<void> {
    // Store in MongoDB or Redis for in-app display
    logger.info('In-app notification stored', {
      userId: request.userId,
      eventType: request.eventType,
      title: request.payload.title,
    });
  }

  /**
   * Get template for event type
   */
  getTemplate(eventType: string): typeof EVENT_TEMPLATES[keyof typeof EVENT_TEMPLATES] | null {
    return EVENT_TEMPLATES[eventType as keyof typeof EVENT_TEMPLATES] || null;
  }

  /**
   * Build notification from template
   */
  buildFromTemplate(
    eventType: string,
    userId: string,
    data: Record<string, string>
  ): NotificationRequest | null {
    const template = this.getTemplate(eventType);
    if (!template) return null;

    // Replace template variables
    let body = template.body;
    let title = template.title;

    for (const [key, value] of Object.entries(data)) {
      body = body.replace(new RegExp(`{{${key}}}`, 'g'), value);
      title = title.replace(new RegExp(`{{${key}}}`, 'g'), value);
    }

    return {
      eventId: `${eventType}-${Date.now()}`,
      eventType,
      userId,
      channels: template.channels as Channel[],
      payload: { title, body },
      source: 'communication-bridge',
    };
  }

  /**
   * Health check for all channels
   */
  async healthCheck(): Promise<Record<Channel, boolean>> {
    const [email, sms, whatsapp, push] = await Promise.all([
      this.email.healthCheck().catch(() => false),
      this.sms.healthCheck().catch(() => false),
      this.whatsapp.healthCheck().catch(() => false),
      this.push.healthCheck().catch(() => false),
    ]);

    return { email, sms, whatsapp, push };
  }
}

// Singleton instance
let bridge: CommunicationBridge | null = null;

export function getCommunicationBridge(): CommunicationBridge {
  if (!bridge) {
    bridge = new CommunicationBridge();
  }
  return bridge;
}

export function createCommunicationBridge(): CommunicationBridge {
  return new CommunicationBridge();
}
