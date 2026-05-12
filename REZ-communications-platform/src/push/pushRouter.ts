/**
 * Push Notification Router
 * Express routes for push notification operations
 */

import { Router, Request, Response, NextFunction } from 'express';
import {
  DeviceRegistry,
  createDeviceRegistry,
  SupportedApp,
  DevicePlatform,
  RegisterDeviceParams,
  FindDevicesParams
} from './deviceRegistry';
import {
  PushService,
  createPushService,
  PushNotification,
  DeliveryResult
} from './push-service';
import {
  renderTemplate,
  PushTemplateEngine,
  pushTemplateEngine,
  TemplateType,
  TemplateVariables
} from './templates';
import { ValidationError, PushError } from '../utils/errors';
import { logger, LogContext } from '../utils/logger';
import { PushConfig } from '../types';

// ============================================
// REQUEST/RESPONSE TYPES
// ============================================

export interface SendPushRequest {
  userId: string;
  appId: SupportedApp;
  templateType?: TemplateType;
  templateVariables?: TemplateVariables;
  title?: string;
  body?: string;
  data?: Record<string, string>;
  badge?: number;
  sound?: string;
  clickAction?: string;
  icon?: string;
  color?: string;
}

export interface SendMultipleRequest {
  appId: SupportedApp;
  userIds: string[];
  templateType?: TemplateType;
  templateVariables?: TemplateVariables;
  title?: string;
  body?: string;
  data?: Record<string, string>;
  badge?: number;
  sound?: string;
}

export interface SubscribeDeviceRequest {
  userId: string;
  appId: SupportedApp;
  token: string;
  platform: DevicePlatform;
  deviceId?: string;
  deviceName?: string;
  deviceVersion?: string;
  appVersion?: string;
}

export interface UnsubscribeDeviceRequest {
  userId: string;
  token: string;
}

export interface SubscribeTopicRequest {
  userId: string;
  appId: SupportedApp;
  token: string;
  topic: string;
}

export interface UnsubscribeTopicRequest {
  userId: string;
  appId: SupportedApp;
  token: string;
  topic: string;
}

export interface SendTemplateRequest {
  userId: string;
  appId: SupportedApp;
  templateType: TemplateType;
  variables: TemplateVariables;
}

export interface SendMultipleTemplateRequest {
  appId: SupportedApp;
  notifications: Array<{
    userId: string;
    templateType: TemplateType;
    variables: TemplateVariables;
  }>;
}

// ============================================
// ROUTER CLASS
// ============================================

export class PushRouter {
  private router: Router;
  private deviceRegistry: DeviceRegistry;
  private pushService: PushService;
  private templateEngine: PushTemplateEngine;
  private log: LogContext;

  constructor(
    deviceRegistry: DeviceRegistry,
    pushService: PushService,
    config?: PushConfig
  ) {
    this.router = Router();
    this.deviceRegistry = deviceRegistry;
    this.pushService = pushService;
    this.templateEngine = pushTemplateEngine;
    this.log = new LogContext(logger, { service: 'PushRouter' });

    this.setupRoutes();
  }

  /**
   * Setup all routes
   */
  private setupRoutes(): void {
    // Device registration routes
    this.router.post('/subscribe', this.subscribeDevice.bind(this));
    this.router.post('/unsubscribe', this.unsubscribeDevice.bind(this));
    this.router.get('/devices/:userId', this.getUserDevices.bind(this));
    this.router.delete('/devices/:userId/:token', this.removeDevice.bind(this));

    // Push sending routes
    this.router.post('/send', this.sendPush.bind(this));
    this.router.post('/send-multiple', this.sendMultiplePush.bind(this));
    this.router.post('/send-template', this.sendTemplatePush.bind(this));
    this.router.post('/send-multiple-template', this.sendMultipleTemplatePush.bind(this));

    // Topic subscription routes
    this.router.post('/subscribe-topic', this.subscribeTopic.bind(this));
    this.router.post('/unsubscribe-topic', this.unsubscribeTopic.bind(this));

    // Query routes
    this.router.get('/tokens/:userId', this.getUserTokens.bind(this));
    this.router.get('/stats/:appId', this.getAppStats.bind(this));

    // Template routes
    this.router.get('/templates', this.listTemplates.bind(this));
    this.router.get('/templates/:appId', this.getAppTemplates.bind(this));
  }

  /**
   * Get Express Router
   */
  getRouter(): Router {
    return this.router;
  }

  // ============================================
  // DEVICE REGISTRATION HANDLERS
  // ============================================

  /**
   * POST /api/push/subscribe
   * Subscribe/device a new device token
   */
  private async subscribeDevice(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const {
        userId,
        appId,
        token,
        platform,
        deviceId,
        deviceName,
        deviceVersion,
        appVersion
      } = req.body as SubscribeDeviceRequest;

      // Validate required fields
      this.validateRequiredFields({ userId, appId, token, platform }, req.path);

      const params: RegisterDeviceParams = {
        userId,
        appId,
        token,
        platform,
        deviceId,
        deviceName,
        deviceVersion,
        appVersion
      };

      const registration = await this.deviceRegistry.registerDevice(params);

      this.log.info('Device subscribed', {
        deviceId: registration.id,
        userId,
        appId,
        platform
      });

      res.status(201).json({
        success: true,
        device: {
          id: registration.id,
          userId: registration.userId,
          appId: registration.appId,
          platform: registration.platform,
          deviceId: registration.deviceId,
          createdAt: registration.createdAt
        }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/push/unsubscribe
   * Unsubscribe a device token
   */
  private async unsubscribeDevice(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { userId, token } = req.body as UnsubscribeDeviceRequest;

      if (!userId || !token) {
        throw new ValidationError('Missing required fields', [
          { field: 'userId', message: 'userId is required' },
          { field: 'token', message: 'token is required' }
        ]);
      }

      const success = await this.deviceRegistry.unregisterDevice(userId, token);

      if (!success) {
        throw new PushError('Device not found', 'DEVICE_NOT_FOUND', { retryable: false });
      }

      this.log.info('Device unsubscribed', { userId, tokenPrefix: token.substring(0, 10) });

      res.json({
        success: true,
        message: 'Device unregistered successfully'
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/push/devices/:userId
   * Get all devices for a user
   */
  private async getUserDevices(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { userId } = req.params;
      const appId = req.query.appId as SupportedApp | undefined;
      const platform = req.query.platform as DevicePlatform | undefined;
      const activeOnly = req.query.activeOnly !== 'false';

      if (!userId) {
        throw new ValidationError('Missing userId', [
          { field: 'userId', message: 'userId is required' }
        ]);
      }

      const params: FindDevicesParams = { userId, appId, platform, activeOnly };
      const devices = await this.deviceRegistry.findDevicesByUser(params);

      // Remove tokens from response for security
      const sanitizedDevices = devices.map(d => ({
        id: d.id,
        appId: d.appId,
        platform: d.platform,
        deviceId: d.deviceId,
        deviceName: d.deviceName,
        appVersion: d.appVersion,
        isActive: d.isActive,
        lastActiveAt: d.lastActiveAt
      }));

      res.json({
        userId,
        count: sanitizedDevices.length,
        devices: sanitizedDevices
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * DELETE /api/push/devices/:userId/:token
   * Remove a specific device
   */
  private async removeDevice(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { userId, token } = req.params;

      if (!userId || !token) {
        throw new ValidationError('Missing required parameters', [
          { field: 'userId', message: 'userId is required' },
          { field: 'token', message: 'token is required' }
        ]);
      }

      const success = await this.deviceRegistry.unregisterDevice(userId, token);

      res.json({
        success,
        message: success ? 'Device removed' : 'Device not found'
      });
    } catch (error) {
      next(error);
    }
  }

  // ============================================
  // PUSH SENDING HANDLERS
  // ============================================

  /**
   * POST /api/push/send
   * Send push notification to a user
   */
  private async sendPush(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const body = req.body as SendPushRequest;
      const { userId, appId, templateType, templateVariables, ...notificationFields } = body;

      // Validate required fields
      this.validateRequiredFields({ userId, appId }, req.path);

      // Get user's device tokens
      const tokens = await this.deviceRegistry.getTokensForUser(userId, appId);

      if (tokens.length === 0) {
        throw new PushError(
          `No registered devices for user ${userId} in app ${appId}`,
          'NO_DEVICES',
          { retryable: false }
        );
      }

      let notifications: PushNotification[];

      if (templateType && templateVariables) {
        // Render from template
        const rendered = renderTemplate(appId, templateType, templateVariables);
        if (!rendered) {
          throw new ValidationError('Invalid template', [
            { field: 'templateType', message: `Template ${templateType} not found for app ${appId}` }
          ]);
        }

        notifications = tokens.map(token => ({
          to: { token, platform: 'android' as DevicePlatform }, // Platform will be determined by token lookup
          title: rendered.title,
          body: rendered.body,
          data: { ...rendered.data, ...notificationFields.data },
          badge: rendered.badge || notificationFields.badge,
          sound: rendered.sound || notificationFields.sound,
          clickAction: rendered.data.action,
          icon: notificationFields.icon,
          color: notificationFields.color
        }));
      } else if (notificationFields.title && notificationFields.body) {
        // Direct push
        notifications = tokens.map(token => ({
          to: { token, platform: 'android' as DevicePlatform },
          title: notificationFields.title,
          body: notificationFields.body,
          data: notificationFields.data,
          badge: notificationFields.badge,
          sound: notificationFields.sound,
          clickAction: notificationFields.clickAction,
          icon: notificationFields.icon,
          color: notificationFields.color
        }));
      } else {
        throw new ValidationError('Missing notification content', [
          { field: 'templateType', message: 'templateType and templateVariables required OR title and body required' }
        ]);
      }

      // Send in batch for efficiency
      const results = await this.pushService.sendBatch(notifications);

      const successCount = results.filter(r => r.status === 'sent').length;

      this.log.info('Push sent', {
        userId,
        appId,
        tokenCount: tokens.length,
        successCount,
        templateType
      });

      res.json({
        success: true,
        userId,
        appId,
        tokenCount: tokens.length,
        successful: successCount,
        failed: tokens.length - successCount,
        results: results.map(r => ({
          status: r.status,
          messageId: r.messageId,
          error: r.error
        }))
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/push/send-multiple
   * Send push notification to multiple users
   */
  private async sendMultiplePush(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const body = req.body as SendMultipleRequest;
      const { appId, userIds, templateType, templateVariables, ...notificationFields } = body;

      // Validate required fields
      this.validateRequiredFields({ appId }, req.path);

      if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
        throw new ValidationError('Invalid userIds', [
          { field: 'userIds', message: 'userIds must be a non-empty array' }
        ]);
      }

      // Get all tokens for all users
      const allTokens: string[] = [];
      for (const userId of userIds) {
        const tokens = await this.deviceRegistry.getTokensForUser(userId, appId);
        allTokens.push(...tokens);
      }

      if (allTokens.length === 0) {
        throw new PushError(
          'No registered devices found for any of the specified users',
          'NO_DEVICES',
          { retryable: false }
        );
      }

      let notifications: PushNotification[];

      if (templateType && templateVariables) {
        const rendered = renderTemplate(appId, templateType, templateVariables);
        if (!rendered) {
          throw new ValidationError('Invalid template', [
            { field: 'templateType', message: `Template ${templateType} not found for app ${appId}` }
          ]);
        }

        notifications = allTokens.map(token => ({
          to: { token, platform: 'android' as DevicePlatform },
          title: rendered.title,
          body: rendered.body,
          data: { ...rendered.data, ...notificationFields.data },
          badge: rendered.badge || notificationFields.badge,
          sound: rendered.sound || notificationFields.sound,
          clickAction: rendered.data.action
        }));
      } else if (notificationFields.title && notificationFields.body) {
        notifications = allTokens.map(token => ({
          to: { token, platform: 'android' as DevicePlatform },
          title: notificationFields.title,
          body: notificationFields.body,
          data: notificationFields.data,
          badge: notificationFields.badge,
          sound: notificationFields.sound,
          clickAction: notificationFields.clickAction
        }));
      } else {
        throw new ValidationError('Missing notification content', [
          { field: 'templateType', message: 'templateType and templateVariables required OR title and body required' }
        ]);
      }

      // Send in batch
      const results = await this.pushService.sendBatch(notifications);
      const successCount = results.filter(r => r.status === 'sent').length;

      this.log.info('Multi-user push sent', {
        appId,
        userCount: userIds.length,
        tokenCount: allTokens.length,
        successCount
      });

      res.json({
        success: true,
        appId,
        userCount: userIds.length,
        tokenCount: allTokens.length,
        successful: successCount,
        failed: allTokens.length - successCount,
        results: results.map(r => ({
          status: r.status,
          messageId: r.messageId,
          error: r.error
        }))
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/push/send-template
   * Send a template push notification
   */
  private async sendTemplatePush(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { userId, appId, templateType, variables } = req.body as SendTemplateRequest;

      // Validate required fields
      this.validateRequiredFields({ userId, appId, templateType }, req.path);

      if (!variables || typeof variables !== 'object') {
        throw new ValidationError('Invalid variables', [
          { field: 'variables', message: 'variables must be an object with key-value pairs' }
        ]);
      }

      // Render template
      const rendered = renderTemplate(appId, templateType, variables);
      if (!rendered) {
        throw new ValidationError('Invalid template', [
          { field: 'templateType', message: `Template ${templateType} not found for app ${appId}` }
        ]);
      }

      // Get user tokens
      const tokens = await this.deviceRegistry.getTokensForUser(userId, appId);

      if (tokens.length === 0) {
        throw new PushError(
          `No registered devices for user ${userId} in app ${appId}`,
          'NO_DEVICES',
          { retryable: false }
        );
      }

      // Create notifications
      const notifications: PushNotification[] = tokens.map(token => ({
        to: { token, platform: 'android' as DevicePlatform },
        title: rendered.title,
        body: rendered.body,
        data: rendered.data,
        badge: rendered.badge,
        sound: rendered.sound,
        clickAction: rendered.data.action
      }));

      // Send
      const results = await this.pushService.sendBatch(notifications);
      const successCount = results.filter(r => r.status === 'sent').length;

      this.log.info('Template push sent', {
        userId,
        appId,
        templateType,
        tokenCount: tokens.length,
        successCount
      });

      res.json({
        success: true,
        userId,
        appId,
        templateType,
        rendered: {
          title: rendered.title,
          body: rendered.body
        },
        tokenCount: tokens.length,
        successful: successCount,
        failed: tokens.length - successCount
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/push/send-multiple-template
   * Send multiple template notifications to different users
   */
  private async sendMultipleTemplatePush(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { appId, notifications } = req.body as SendMultipleTemplateRequest;

      if (!appId) {
        throw new ValidationError('Missing appId', [
          { field: 'appId', message: 'appId is required' }
        ]);
      }

      if (!notifications || !Array.isArray(notifications) || notifications.length === 0) {
        throw new ValidationError('Invalid notifications', [
          { field: 'notifications', message: 'notifications must be a non-empty array' }
        ]);
      }

      // Build all notifications
      const allNotifications: PushNotification[] = [];
      const results: Array<{ userId: string; templateType: TemplateType; success: boolean; error?: string }> = [];

      for (const item of notifications) {
        const { userId, templateType, variables } = item;

        // Render template
        const rendered = renderTemplate(appId, templateType, variables);
        if (!rendered) {
          results.push({
            userId,
            templateType,
            success: false,
            error: `Template ${templateType} not found`
          });
          continue;
        }

        // Get user tokens
        const tokens = await this.deviceRegistry.getTokensForUser(userId, appId);

        if (tokens.length === 0) {
          results.push({
            userId,
            templateType,
            success: false,
            error: 'No devices'
          });
          continue;
        }

        // Add notifications
        for (const token of tokens) {
          allNotifications.push({
            to: { token, platform: 'android' as DevicePlatform },
            title: rendered.title,
            body: rendered.body,
            data: rendered.data,
            badge: rendered.badge,
            sound: rendered.sound,
            clickAction: rendered.data.action
          });
        }

        results.push({
          userId,
          templateType,
          success: true
        });
      }

      if (allNotifications.length === 0) {
        throw new PushError(
          'No notifications to send',
          'EMPTY_BATCH',
          { retryable: false }
        );
      }

      // Send all
      const sendResults = await this.pushService.sendBatch(allNotifications);
      const successCount = sendResults.filter(r => r.status === 'sent').length;

      this.log.info('Multi-template push sent', {
        appId,
        userCount: notifications.length,
        tokenCount: allNotifications.length,
        successCount
      });

      res.json({
        success: true,
        appId,
        userCount: notifications.length,
        tokenCount: allNotifications.length,
        successful: successCount,
        failed: allNotifications.length - successCount,
        results
      });
    } catch (error) {
      next(error);
    }
  }

  // ============================================
  // TOPIC SUBSCRIPTION HANDLERS
  // ============================================

  /**
   * POST /api/push/subscribe-topic
   * Subscribe a device to a topic
   */
  private async subscribeTopic(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { userId, appId, token, topic } = req.body as SubscribeTopicRequest;

      this.validateRequiredFields({ userId, appId, token, topic }, req.path);

      // Register device if not exists
      const existingDevice = await this.deviceRegistry.findByToken(token);
      if (!existingDevice) {
        throw new PushError(
          'Device not registered. Please subscribe device first.',
          'DEVICE_NOT_FOUND',
          { retryable: false }
        );
      }

      // Subscribe to topic in device registry
      await this.deviceRegistry.subscribeToTopic(userId, token, topic, appId);

      // Also subscribe via FCM
      await this.pushService.subscribeToTopic([token], topic);

      this.log.info('Subscribed to topic', { userId, appId, topic, tokenPrefix: token.substring(0, 10) });

      res.json({
        success: true,
        userId,
        appId,
        topic,
        message: `Successfully subscribed to ${topic}`
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/push/unsubscribe-topic
   * Unsubscribe a device from a topic
   */
  private async unsubscribeTopic(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { userId, appId, token, topic } = req.body as UnsubscribeTopicRequest;

      this.validateRequiredFields({ userId, appId, token, topic }, req.path);

      // Unsubscribe from device registry
      await this.deviceRegistry.unsubscribeFromTopic(userId, token, topic, appId);

      // Also unsubscribe via FCM
      await this.pushService.unsubscribeFromTopic([token], topic);

      this.log.info('Unsubscribed from topic', { userId, appId, topic, tokenPrefix: token.substring(0, 10) });

      res.json({
        success: true,
        userId,
        appId,
        topic,
        message: `Successfully unsubscribed from ${topic}`
      });
    } catch (error) {
      next(error);
    }
  }

  // ============================================
  // QUERY HANDLERS
  // ============================================

  /**
   * GET /api/push/tokens/:userId
   * Get all tokens for a user
   */
  private async getUserTokens(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { userId } = req.params;
      const appId = req.query.appId as SupportedApp | undefined;

      if (!userId) {
        throw new ValidationError('Missing userId', [
          { field: 'userId', message: 'userId is required' }
        ]);
      }

      const tokens = await this.deviceRegistry.getTokensForUser(userId, appId);

      res.json({
        userId,
        appId: appId || 'all',
        count: tokens.length,
        // Return masked tokens for security
        tokens: tokens.map(t => ({
          token: t.substring(0, 20) + '...',
          fullToken: t // Only for internal use
        }))
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/push/stats/:appId
   * Get statistics for an app
   */
  private async getAppStats(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { appId } = req.params;

      if (!appId) {
        throw new ValidationError('Missing appId', [
          { field: 'appId', message: 'appId is required' }
        ]);
      }

      const stats = await this.deviceRegistry.getAppStats(appId as SupportedApp);

      res.json({
        appId,
        ...stats,
        timestamp: new Date()
      });
    } catch (error) {
      next(error);
    }
  }

  // ============================================
  // TEMPLATE HANDLERS
  // ============================================

  /**
   * GET /api/push/templates
   * List all available templates
   */
  private listTemplates(req: Request, res: Response): void {
    const templates = this.templateEngine.listAllTemplates();

    res.json({
      count: templates.length,
      templates: templates.map(t => ({
        appId: t.appId,
        type: t.type,
        title: t.template.title,
        body: t.template.body,
        priority: t.template.priority,
        sound: t.template.sound
      }))
    });
  }

  /**
   * GET /api/push/templates/:appId
   * Get templates for a specific app
   */
  private getAppTemplates(req: Request, res: Response): void {
    const { appId } = req.params;

    if (!appId) {
      throw new ValidationError('Missing appId', [
        { field: 'appId', message: 'appId is required' }
      ]);
    }

    const templates = pushTemplateEngine.getTemplatesForApp(appId as SupportedApp);

    if (Object.keys(templates).length === 0) {
      throw new ValidationError('Invalid appId', [
        { field: 'appId', message: `App ${appId} not found` }
      ]);
    }

    res.json({
      appId,
      templates: Object.entries(templates).map(([type, template]) => ({
        type,
        title: template.title,
        body: template.body,
        priority: template.priority,
        sound: template.sound,
        data: template.data
      }))
    });
  }

  // ============================================
  // HELPER METHODS
  // ============================================

  private validateRequiredFields(fields: Record<string, unknown>, path: string): void {
    const missing = Object.entries(fields)
      .filter(([_, value]) => value === undefined || value === null || value === '')
      .map(([key]) => key);

    if (missing.length > 0) {
      throw new ValidationError(`Missing required fields for ${path}`, [
        ...missing.map(field => ({ field, message: `${field} is required` }))
      ]);
    }
  }
}

// ============================================
// FACTORY FUNCTION
// ============================================

let pushRouterInstance: PushRouter | null = null;

export function createPushRouter(
  deviceRegistry?: DeviceRegistry,
  pushService?: PushService,
  config?: PushConfig
): PushRouter {
  const registry = deviceRegistry || createDeviceRegistry();
  const pushSvc = pushService || createPushService(config || {
    provider: 'mock',
    projectId: process.env.FIREBASE_PROJECT_ID,
    serviceAccountPath: process.env.FIREBASE_SERVICE_ACCOUNT_PATH
  });

  if (!pushRouterInstance) {
    pushRouterInstance = new PushRouter(registry, pushSvc, config);
  }

  return pushRouterInstance;
}

export function getPushRouter(): PushRouter | null {
  return pushRouterInstance;
}
