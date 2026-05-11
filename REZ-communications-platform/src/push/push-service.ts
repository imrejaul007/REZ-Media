/**
 * Push Notification Service - Firebase Cloud Messaging
 * Handles push notifications for iOS, Android, and Web
 */

import admin from 'firebase-admin';
import { v4 as uuidv4 } from 'uuid';
import {
  IPushService,
  PushNotification,
  DeliveryResult,
  PushConfig,
  ChannelType,
  MessageStatus,
  DeviceToken
} from '../types';
import { PushError, ValidationError } from '../utils/errors';
import { Validator } from '../utils/validation';
import { logger, LogContext } from '../utils/logger';

export class PushService implements IPushService {
  private config: PushConfig;
  private log: LogContext;
  private app: admin.app.App | null = null;
  private messaging: admin.messaging.Messaging | null = null;
  private isConfigured: boolean = false;

  constructor(config: PushConfig) {
    this.config = config;
    this.log = new LogContext(logger, { service: 'PushService' });

    this.initialize();
  }

  private initialize(): void {
    if (this.config.provider === 'mock' || !this.config.serviceAccountPath) {
      this.log.warn('Push service running in mock mode - no Firebase config');
      this.isConfigured = false;
      return;
    }

    if (this.config.provider === 'firebase') {
      try {
        // Initialize Firebase Admin SDK
        if (admin.apps.length === 0) {
          this.app = admin.initializeApp({
            credential: admin.credential.cert(this.config.serviceAccountPath),
            projectId: this.config.projectId
          });
        } else {
          this.app = admin.apps[0];
        }

        this.messaging = admin.messaging();
        this.isConfigured = true;
        this.log.info('Push service initialized with Firebase', {
          projectId: this.config.projectId
        });
      } catch (error) {
        this.log.error('Failed to initialize Firebase', error);
        this.isConfigured = false;
      }
    }
  }

  /**
   * Send a push notification to a single device
   */
  async send(notification: PushNotification): Promise<DeliveryResult> {
    const messageId = uuidv4();
    const startTime = Date.now();

    this.log.info('Sending push notification', {
      messageId,
      to: notification.to.token.substring(0, 20) + '...',
      title: notification.title,
      platform: notification.to.platform
    });

    // Validate notification
    const validation = Validator.validatePushNotification(notification);
    if (!validation.valid) {
      throw new ValidationError('Invalid push notification', [{
        field: 'pushNotification',
        message: validation.error!
      }]);
    }

    try {
      if (!this.isConfigured) {
        return this.mockSend(notification, messageId, startTime);
      }

      const message = this.buildFCMMessage(notification, messageId);
      const response = await this.messaging!.send(message);

      const deliveryResult: DeliveryResult = {
        messageId,
        channel: ChannelType.PUSH,
        status: MessageStatus.SENT,
        timestamp: new Date(),
        providerMessageId: response,
        metadata: {
          latencyMs: Date.now() - startTime,
          platform: notification.to.platform
        }
      };

      this.log.info('Push notification sent', {
        messageId,
        providerMessageId: response,
        latencyMs: Date.now() - startTime
      });

      return deliveryResult;
    } catch (error) {
      const err = error as Error;
      this.log.error('Failed to send push notification', error, { messageId });

      if (err.message.includes('registration-token-not-registered') ||
          err.message.includes('INVALID_ARGUMENT')) {
        throw new PushError(
          'Invalid device token',
          'INVALID_TOKEN',
          { retryable: false, details: { token: notification.to.token.substring(0, 20) + '...' } }
        );
      }

      if (err.message.includes('quota-exceeded') || err.message.includes('UNAVAILABLE')) {
        throw new PushError(
          'Firebase quota exceeded',
          'QUOTA_EXCEEDED',
          { retryable: true }
        );
      }

      throw new PushError(err.message, 'SEND_FAILED', { retryable: true });
    }
  }

  /**
   * Send notification to a topic
   */
  async sendToTopic(topic: string, notification: PushNotification): Promise<DeliveryResult> {
    const messageId = uuidv4();
    const startTime = Date.now();

    this.log.info('Sending push to topic', { messageId, topic, title: notification.title });

    try {
      if (!this.isConfigured) {
        return this.mockSend(notification, messageId, startTime, { topic });
      }

      const message = this.buildFCMTopicMessage(notification, topic, messageId);
      const response = await this.messaging!.send(message);

      return {
        messageId,
        channel: ChannelType.PUSH,
        status: MessageStatus.SENT,
        timestamp: new Date(),
        providerMessageId: response,
        metadata: {
          latencyMs: Date.now() - startTime,
          topic,
          type: 'topic'
        }
      };
    } catch (error) {
      throw new PushError(
        `Failed to send to topic: ${(error as Error).message}`,
        'TOPIC_SEND_FAILED',
        { retryable: true }
      );
    }
  }

  /**
   * Send batch of push notifications
   */
  async sendBatch(notifications: PushNotification[]): Promise<DeliveryResult[]> {
    const batchId = uuidv4();
    this.log.info('Starting batch push send', { batchId, count: notifications.length });

    if (notifications.length === 0) {
      return [];
    }

    // Validate all notifications
    const invalidNotifications: { index: number; error: string }[] = [];
    notifications.forEach((notif, index) => {
      const validation = Validator.validatePushNotification(notif);
      if (!validation.valid) {
        invalidNotifications.push({ index, error: validation.error! });
      }
    });

    if (invalidNotifications.length > 0) {
      throw new ValidationError(
        `${invalidNotifications.length} invalid notifications in batch`,
        invalidNotifications.map(i => ({ field: `notifications[${i.index}]`, message: i.error }))
      );
    }

    if (!this.isConfigured) {
      return notifications.map((notif, index) =>
        this.mockSend(notif, uuidv4(), Date.now())
      );
    }

    // Firebase allows up to 500 messages per batch
    const chunkSize = 500;
    const results: DeliveryResult[] = [];

    for (let i = 0; i < notifications.length; i += chunkSize) {
      const chunk = notifications.slice(i, i + chunkSize);

      try {
        const messages = chunk.map((notif, idx) =>
          this.buildFCMMessage(notif, uuidv4())
        );

        const batchResponse = await this.messaging!.sendEach(messages);

        batchResponse.responses.forEach((response, index) => {
          if (response.success) {
            results.push({
              messageId: uuidv4(),
              channel: ChannelType.PUSH,
              status: MessageStatus.SENT,
              timestamp: new Date(),
              providerMessageId: response.messageId || undefined,
              metadata: {
                platform: chunk[index].to.platform
              }
            });
          } else {
            results.push({
              messageId: uuidv4(),
              channel: ChannelType.PUSH,
              status: MessageStatus.FAILED,
              timestamp: new Date(),
              error: response.error?.message
            });
          }
        });
      } catch (error) {
        // If entire batch fails, mark all as failed
        chunk.forEach(notif => {
          results.push({
            messageId: uuidv4(),
            channel: ChannelType.PUSH,
            status: MessageStatus.FAILED,
            timestamp: new Date(),
            error: (error as Error).message
          });
        });
      }

      // Small delay between chunks to avoid rate limiting
      if (i + chunkSize < notifications.length) {
        await this.delay(100);
      }
    }

    const successCount = results.filter(r => r.status !== MessageStatus.FAILED).length;
    this.log.info('Batch push send completed', {
      batchId,
      total: notifications.length,
      successful: successCount,
      failed: notifications.length - successCount
    });

    return results;
  }

  /**
   * Subscribe devices to a topic
   */
  async subscribeToTopic(tokens: string[], topic: string): Promise<void> {
    this.log.info('Subscribing to topic', { tokenCount: tokens.length, topic });

    if (!this.isConfigured) {
      this.log.warn('Mock: subscribing to topic', { topic, tokens: tokens.length });
      return;
    }

    try {
      // Topic names can only contain letters, numbers, underscores, and hyphens
      const sanitizedTopic = topic.replace(/[^a-zA-Z0-9_-]/g, '_');

      // Firebase allows max 1000 tokens per subscription request
      const chunkSize = 1000;
      for (let i = 0; i < tokens.length; i += chunkSize) {
        const chunk = tokens.slice(i, i + chunkSize);
        await this.messaging!.subscribeToTopic(chunk, sanitizedTopic);
      }

      this.log.info('Subscribed to topic', { topic: sanitizedTopic, count: tokens.length });
    } catch (error) {
      throw new PushError(
        `Failed to subscribe to topic: ${(error as Error).message}`,
        'SUBSCRIBE_FAILED',
        { retryable: true }
      );
    }
  }

  /**
   * Unsubscribe devices from a topic
   */
  async unsubscribeFromTopic(tokens: string[], topic: string): Promise<void> {
    this.log.info('Unsubscribing from topic', { tokenCount: tokens.length, topic });

    if (!this.isConfigured) {
      return;
    }

    try {
      const sanitizedTopic = topic.replace(/[^a-zA-Z0-9_-]/g, '_');

      const chunkSize = 1000;
      for (let i = 0; i < tokens.length; i += chunkSize) {
        const chunk = tokens.slice(i, i + chunkSize);
        await this.messaging!.unsubscribeFromTopic(chunk, sanitizedTopic);
      }

      this.log.info('Unsubscribed from topic', { topic: sanitizedTopic, count: tokens.length });
    } catch (error) {
      throw new PushError(
        `Failed to unsubscribe from topic: ${(error as Error).message}`,
        'UNSUBSCRIBE_FAILED',
        { retryable: true }
      );
    }
  }

  /**
   * Build FCM message from notification
   */
  private buildFCMMessage(notification: PushNotification, messageId: string): admin.messaging.Message {
    const platformNotification = this.buildPlatformSpecificNotification(notification);

    return {
      token: notification.to.token,
      notification: {
        title: notification.title,
        body: notification.body
      },
      data: notification.data as Record<string, string>,
      android: {
        notification: {
          channelId: 'rez_notifications',
          icon: notification.icon,
          color: notification.color,
          clickAction: notification.clickAction
        },
        priority: 'high' as const
      },
      apns: {
        payload: {
          aps: {
            badge: notification.badge,
            sound: notification.sound || 'default',
            'click-action': notification.clickAction
          }
        },
        headers: {
          'apns-priority': '10',
          'apns-push-type': 'alert'
        }
      },
      webpush: {
        notification: {
          icon: notification.icon,
          badge: notification.badge?.toString(),
          actions: notification.clickAction ? [
            { action: notification.clickAction, title: 'Open' }
          ] : undefined
        },
        fcmOptions: {
          link: notification.clickAction
        }
      },
      ...platformNotification
    };
  }

  /**
   * Build FCM topic message
   */
  private buildFCMTopicMessage(
    notification: PushNotification,
    topic: string,
    messageId: string
  ): admin.messaging.Message {
    const baseMessage = this.buildFCMMessage(notification, messageId);

    return {
      ...baseMessage,
      topic: topic.replace(/[^a-zA-Z0-9_-]/g, '_')
    };
  }

  /**
   * Build platform-specific notification options
   */
  private buildPlatformSpecificNotification(notification: PushNotification): object {
    switch (notification.to.platform) {
      case 'ios':
        return {
          apns: {
            payload: {
              aps: {
                'mutable-content': 1,
                badge: notification.badge,
                sound: notification.sound || 'default'
              }
            }
          }
        };
      case 'android':
        return {
          android: {
            notification: {
              icon: notification.icon,
              color: notification.color,
              channelId: 'rez_notifications'
            },
            priority: 'high' as const
          }
        };
      case 'web':
        return {
          webpush: {
            notification: {
              icon: notification.icon
            },
            fcmOptions: {
              link: notification.clickAction
            }
          }
        };
      default:
        return {};
    }
  }

  /**
   * Mock send for testing
   */
  private mockSend(
    notification: PushNotification,
    messageId: string,
    startTime: number,
    extra?: Record<string, unknown>
  ): DeliveryResult {
    this.log.info('Mock push notification sent', {
      messageId,
      title: notification.title,
      platform: notification.to.platform,
      ...extra
    });

    return {
      messageId,
      channel: ChannelType.PUSH,
      status: MessageStatus.SENT,
      timestamp: new Date(),
      providerMessageId: `mock-push-${messageId}`,
      metadata: {
        latencyMs: Date.now() - startTime,
        mock: true,
        platform: notification.to.platform
      }
    };
  }

  /**
   * Delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<{ healthy: boolean; latency?: number; error?: string }> {
    const startTime = Date.now();

    if (!this.isConfigured) {
      return { healthy: true, latency: 0, error: 'Running in mock mode' };
    }

    try {
      // Simple health check by verifying messaging service
      if (this.messaging) {
        return { healthy: true, latency: Date.now() - startTime };
      }
      return { healthy: false, latency: Date.now() - startTime, error: 'Messaging not initialized' };
    } catch (error) {
      return {
        healthy: false,
        latency: Date.now() - startTime,
        error: (error as Error).message
      };
    }
  }
}

// ============================================
// FACTORY FUNCTION
// ============================================

export function createPushService(config: PushConfig): PushService {
  return new PushService(config);
}
