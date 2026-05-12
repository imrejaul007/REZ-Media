/**
 * Marketing Routes for REZ Communications Platform
 *
 * These routes handle marketing campaigns, notifications, and multi-channel
 * messaging for all REZ-Media apps. Routes are protected by internal service auth.
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { AuthenticatedRequest } from '../middleware/auth';
import { ValidationError } from '../utils/errors';
import { EmailService } from '../email/email-service';
import { SMSService } from '../sms/sms-service';
import { WhatsAppService } from '../whatsapp/whatsapp-service';
import { PushService } from '../push/push-service';
import { TemplateEngine } from '../templates/template-engine';
import { getMarketingTemplates } from '../templates/marketing-templates';

export interface MarketingServices {
  email: EmailService;
  sms: SMSService;
  whatsapp: WhatsAppService;
  push: PushService;
  templateEngine: TemplateEngine;
}

// ============================================================================
// REQUEST SCHEMAS (Zod validation)
// ============================================================================

const SendNotificationSchema = z.object({
  userId: z.string().optional(),
  merchantId: z.string().optional(),
  channels: z.array(z.enum(['email', 'sms', 'whatsapp', 'push', 'in_app'])).min(1),
  templateId: z.string().optional(),
  payload: z.object({
    title: z.string(),
    body: z.string(),
    data: z.record(z.unknown()).optional(),
    emailSubject: z.string().optional(),
    emailHtml: z.string().optional(),
    phone: z.string().optional(),
    email: z.string().email().optional(),
    fcmToken: z.string().optional(),
  }),
  priority: z.enum(['high', 'normal', 'low']).default('normal'),
  scheduledFor: z.string().datetime().optional(),
  correlationId: z.string().optional(),
});

const SendCampaignSchema = z.object({
  name: z.string().min(1).max(200),
  templateId: z.string(),
  audience: z.object({
    userIds: z.array(z.string()).optional(),
    merchantIds: z.array(z.string()).optional(),
    segment: z.string().optional(),
    filters: z.record(z.unknown()).optional(),
  }),
  channels: z.array(z.enum(['email', 'sms', 'whatsapp', 'push'])).min(1),
  payload: z.object({
    title: z.string().optional(),
    body: z.string().optional(),
    data: z.record(z.unknown()).optional(),
  }),
  schedule: z.object({
    type: z.enum(['immediate', 'scheduled', 'recurring']),
    sendAt: z.string().datetime().optional(),
    recurringConfig: z.object({
      frequency: z.enum(['daily', 'weekly', 'monthly']),
      time: z.string().regex(/^\d{2}:\d{2}$/),
      dayOfWeek: z.number().min(0).max(6).optional(),
      dayOfMonth: z.number().min(1).max(31).optional(),
    }).optional(),
  }).optional(),
  settings: z.object({
    throttlePerMinute: z.number().positive().optional(),
    retryFailed: z.boolean().default(true),
    maxRetries: z.number().min(0).max(5).default(3),
    trackOpens: z.boolean().default(true),
    trackClicks: z.boolean().default(true),
  }).optional(),
});

const SendEmailSchema = z.object({
  to: z.string().email(),
  subject: z.string().min(1).max(500),
  html: z.string().optional(),
  text: z.string().optional(),
  templateId: z.string().optional(),
  templateVariables: z.record(z.string()).optional(),
  from: z.string().email().optional(),
  fromName: z.string().optional(),
  replyTo: z.string().email().optional(),
  attachments: z.array(z.object({
    filename: z.string(),
    content: z.string(),
    contentType: z.string().optional(),
  })).optional(),
});

const SendSMSchema = z.object({
  to: z.string().min(10).max(20),
  body: z.string().min(1).max(1600),
  from: z.string().optional(),
});

const SendWhatsAppSchema = z.object({
  to: z.string().min(10).max(20),
  body: z.string().optional(),
  templateName: z.string().optional(),
  templateVariables: z.record(z.string()).optional(),
  mediaUrl: z.string().url().optional(),
  mediaCaption: z.string().optional(),
  interactiveButtons: z.array(z.object({
    type: z.enum(['reply', 'url']),
    title: z.string().max(25),
    payload: z.string().optional(),
    url: z.string().url().optional(),
  })).max(3).optional(),
});

const SendPushSchema = z.object({
  userId: z.string().optional(),
  fcmToken: z.string().optional(),
  title: z.string().max(100),
  body: z.string().max(500),
  data: z.record(z.unknown()).optional(),
  imageUrl: z.string().url().optional(),
  clickAction: z.string().optional(),
  badge: z.number().int().positive().optional(),
  sound: z.string().optional(),
  priority: z.enum(['high', 'normal', 'low']).default('normal'),
  topic: z.string().optional(),
});

// ============================================================================
// ROUTER FACTORY
// ============================================================================

export function createMarketingRoutes(services: MarketingServices): Router {
  const router = Router();
  const { email, sms, whatsapp, push, templateEngine } = services;
  const templates = getMarketingTemplates();

  // =========================================================================
  // CAMPAIGN ROUTES
  // =========================================================================

  /**
   * POST /api/campaigns/send
   * Send a marketing campaign to specified audience
   */
  router.post('/campaigns/send', async (req: Request, res: Response) => {
    try {
      const validated = SendCampaignSchema.parse(req.body);

      // Get template
      const template = templates[validated.templateId as keyof typeof templates];
      if (!template) {
        throw new ValidationError('Invalid template ID', [
          { field: 'templateId', message: `Template '${validated.templateId}' not found` }
        ]);
      }

      // Build campaign data
      const campaignData = {
        campaignId: `campaign-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        name: validated.name,
        template: validated.templateId,
        audience: validated.audience,
        channels: validated.channels,
        payload: {
          title: validated.payload.title || template.title,
          body: validated.payload.body || template.body,
          ...validated.payload.data,
        },
        schedule: validated.schedule || { type: 'immediate' },
        settings: validated.settings || {
          throttlePerMinute: 100,
          retryFailed: true,
          maxRetries: 3,
          trackOpens: true,
          trackClicks: true,
        },
        createdBy: (req as AuthenticatedRequest).serviceName || 'unknown',
        createdAt: new Date().toISOString(),
      };

      // Execute campaign (in production, this would queue to BullMQ)
      const results = await executeCampaign(campaignData, services);

      res.status(201).json({
        success: true,
        campaignId: campaignData.campaignId,
        status: 'sent',
        results: {
          total: results.length,
          successful: results.filter(r => r.success).length,
          failed: results.filter(r => !r.success).length,
        },
        channels: validated.channels,
        template: validated.templateId,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new ValidationError(
          'Invalid request body',
          error.errors.map(e => ({
            field: e.path.join('.'),
            message: e.message
          }))
        );
      }
      throw error;
    }
  });

  /**
   * GET /api/campaigns/templates
   * List available marketing campaign templates
   */
  router.get('/campaigns/templates', (req: Request, res: Response) => {
    const templateList = Object.entries(templates).map(([id, template]) => ({
      id,
      name: template.name,
      description: template.description,
      channels: template.channels,
      variables: template.variables,
    }));

    res.json({ templates: templateList });
  });

  /**
   * GET /api/campaigns/templates/:templateId
   * Get specific campaign template details
   */
  router.get('/campaigns/templates/:templateId', (req: Request, res: Response) => {
    const template = templates[req.params.templateId as keyof typeof templates];

    if (!template) {
      res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: `Template '${req.params.templateId}' not found`
        }
      });
      return;
    }

    res.json({
      id: req.params.templateId,
      ...template,
    });
  });

  /**
   * GET /api/campaigns/history
   * Get campaign history (would connect to database in production)
   */
  router.get('/campaigns/history', async (req: Request, res: Response) => {
    const { limit = '50', offset = '0', status, templateId } = req.query;

    // In production, query from database
    res.json({
      campaigns: [],
      pagination: {
        limit: parseInt(limit as string),
        offset: parseInt(offset as string),
        total: 0,
      },
      filters: { status, templateId },
    });
  });

  // =========================================================================
  // NOTIFICATION ROUTES
  // =========================================================================

  /**
   * POST /api/notifications/send
   * Send a notification to a user across specified channels
   */
  router.post('/notifications/send', async (req: Request, res: Response) => {
    try {
      const validated = SendNotificationSchema.parse(req.body);
      const results = [];

      for (const channel of validated.channels) {
        try {
          const result = await sendToChannel(channel, validated, services);
          results.push(result);
        } catch (error) {
          results.push({
            channel,
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }

      const successful = results.filter(r => r.success).length;
      const failed = results.filter(r => !r.success).length;

      res.json({
        success: failed === 0,
        partialSuccess: successful > 0 && failed > 0,
        messageId: `notif-${Date.now()}`,
        results,
        correlationId: validated.correlationId,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new ValidationError(
          'Invalid request body',
          error.errors.map(e => ({
            field: e.path.join('.'),
            message: e.message
          }))
        );
      }
      throw error;
    }
  });

  /**
   * POST /api/notifications/send-batch
   * Send multiple notifications in batch
   */
  router.post('/notifications/send-batch', async (req: Request, res: Response) => {
    const { notifications } = req.body;

    if (!Array.isArray(notifications) || notifications.length === 0) {
      throw new ValidationError('Invalid request', [
        { field: 'notifications', message: 'Must be a non-empty array' }
      ]);
    }

    if (notifications.length > 100) {
      throw new ValidationError('Batch too large', [
        { field: 'notifications', message: 'Maximum 100 notifications per batch' }
      ]);
    }

    const results = [];
    for (const notification of notifications) {
      try {
        const validated = SendNotificationSchema.parse(notification);
        const channelResults = [];

        for (const channel of validated.channels) {
          try {
            const result = await sendToChannel(channel, validated, services);
            channelResults.push(result);
          } catch (error) {
            channelResults.push({
              channel,
              success: false,
              error: error instanceof Error ? error.message : 'Unknown error',
            });
          }
        }
        results.push({ userId: validated.userId, results: channelResults });
      } catch (error) {
        results.push({
          userId: notification.userId,
          error: error instanceof Error ? error.message : 'Validation failed',
          results: [],
        });
      }
    }

    res.json({
      success: true,
      batchId: `batch-${Date.now()}`,
      totalNotifications: notifications.length,
      results,
    });
  });

  // =========================================================================
  // EMAIL ROUTES
  // =========================================================================

  /**
   * POST /api/email/send
   * Send an email directly
   */
  router.post('/email/send', async (req: Request, res: Response) => {
    try {
      const validated = SendEmailSchema.parse(req.body);

      let html = validated.html;
      let text = validated.text;

      // If template provided, render it
      if (validated.templateId) {
        const rendered = await templateEngine.render(validated.templateId, validated.templateVariables || {});
        html = rendered.html || html;
        text = rendered.text || text;
      }

      const result = await email.send({
        to: validated.to,
        subject: validated.subject,
        html,
        text,
        from: validated.from,
        fromName: validated.fromName,
        replyTo: validated.replyTo,
        attachments: validated.attachments,
      });

      res.json({
        success: result.success,
        messageId: result.messageId,
        error: result.error,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new ValidationError(
          'Invalid request body',
          error.errors.map(e => ({
            field: e.path.join('.'),
            message: e.message
          }))
        );
      }
      throw error;
    }
  });

  /**
   * POST /api/email/send-batch
   * Send multiple emails in batch
   */
  router.post('/email/send-batch', async (req: Request, res: Response) => {
    const { messages } = req.body;

    if (!Array.isArray(messages) || messages.length === 0) {
      throw new ValidationError('Invalid request', [
        { field: 'messages', message: 'Must be a non-empty array' }
      ]);
    }

    if (messages.length > 500) {
      throw new ValidationError('Batch too large', [
        { field: 'messages', message: 'Maximum 500 emails per batch' }
      ]);
    }

    const results = await email.sendBatch(messages);

    res.json({
      success: true,
      batchId: `email-batch-${Date.now()}`,
      total: messages.length,
      successful: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      results,
    });
  });

  // =========================================================================
  // SMS ROUTES
  // =========================================================================

  /**
   * POST /api/sms/send
   * Send an SMS directly
   */
  router.post('/sms/send', async (req: Request, res: Response) => {
    try {
      const validated = SendSMSchema.parse(req.body);

      const result = await sms.send({
        to: validated.to,
        body: validated.body,
        from: validated.from,
      });

      res.json({
        success: result.success,
        messageId: result.messageId,
        error: result.error,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new ValidationError(
          'Invalid request body',
          error.errors.map(e => ({
            field: e.path.join('.'),
            message: e.message
          }))
        );
      }
      throw error;
    }
  });

  /**
   * POST /api/sms/send-batch
   * Send multiple SMS in batch
   */
  router.post('/sms/send-batch', async (req: Request, res: Response) => {
    const { messages } = req.body;

    if (!Array.isArray(messages) || messages.length === 0) {
      throw new ValidationError('Invalid request', [
        { field: 'messages', message: 'Must be a non-empty array' }
      ]);
    }

    if (messages.length > 1000) {
      throw new ValidationError('Batch too large', [
        { field: 'messages', message: 'Maximum 1000 SMS per batch' }
      ]);
    }

    const results = await sms.sendBatch(messages);

    res.json({
      success: true,
      batchId: `sms-batch-${Date.now()}`,
      total: messages.length,
      successful: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      results,
    });
  });

  // =========================================================================
  // WHATSAPP ROUTES
  // =========================================================================

  /**
   * POST /api/whatsapp/send
   * Send a WhatsApp message
   */
  router.post('/whatsapp/send', async (req: Request, res: Response) => {
    try {
      const validated = SendWhatsAppSchema.parse(req.body);

      let result;

      if (validated.templateName) {
        // Send template message
        result = await whatsapp.sendTemplate(
          validated.templateName,
          validated.templateVariables || {},
          validated.to
        );
      } else if (validated.interactiveButtons) {
        // Send interactive message
        result = await whatsapp.sendInteractive(
          validated.to,
          validated.body || '',
          validated.interactiveButtons
        );
      } else {
        // Send regular message
        result = await whatsapp.send({
          to: validated.to,
          body: validated.body || '',
          mediaUrl: validated.mediaUrl,
          mediaCaption: validated.mediaCaption,
        });
      }

      res.json({
        success: result.success,
        messageId: result.messageId,
        error: result.error,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new ValidationError(
          'Invalid request body',
          error.errors.map(e => ({
            field: e.path.join('.'),
            message: e.message
          }))
        );
      }
      throw error;
    }
  });

  /**
   * POST /api/whatsapp/send-template
   * Send a WhatsApp template message
   */
  router.post('/whatsapp/send-template', async (req: Request, res: Response) => {
    const { to, templateName, variables } = req.body;

    if (!to || !templateName) {
      throw new ValidationError('Missing required fields', [
        { field: 'to', message: 'Recipient phone number is required' },
        { field: 'templateName', message: 'Template name is required' },
      ]);
    }

    const result = await whatsapp.sendTemplate(
      templateName,
      variables || {},
      to
    );

    res.json({
      success: result.success,
      messageId: result.messageId,
      error: result.error,
    });
  });

  // =========================================================================
  // PUSH NOTIFICATION ROUTES
  // =========================================================================

  /**
   * POST /api/push/send
   * Send a push notification
   */
  router.post('/push/send', async (req: Request, res: Response) => {
    try {
      const validated = SendPushSchema.parse(req.body);

      if (!validated.userId && !validated.fcmToken && !validated.topic) {
        throw new ValidationError('Missing recipient', [
          { field: 'userId|fcmToken|topic', message: 'At least one recipient identifier is required' }
        ]);
      }

      let result;

      if (validated.topic) {
        result = await push.sendToTopic(validated.topic, {
          title: validated.title,
          body: validated.body,
          data: validated.data,
          imageUrl: validated.imageUrl,
          clickAction: validated.clickAction,
          badge: validated.badge,
          sound: validated.sound,
        });
      } else {
        result = await push.send({
          token: validated.fcmToken,
          userId: validated.userId,
          title: validated.title,
          body: validated.body,
          data: validated.data,
          imageUrl: validated.imageUrl,
          clickAction: validated.clickAction,
          badge: validated.badge,
          sound: validated.sound,
          priority: validated.priority,
        });
      }

      res.json({
        success: result.success,
        messageId: result.messageId,
        error: result.error,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new ValidationError(
          'Invalid request body',
          error.errors.map(e => ({
            field: e.path.join('.'),
            message: e.message
          }))
        );
      }
      throw error;
    }
  });

  /**
   * POST /api/push/send-to-topic
   * Send push notification to a topic
   */
  router.post('/push/send-to-topic', async (req: Request, res: Response) => {
    const { topic, notification } = req.body;

    if (!topic || !notification) {
      throw new ValidationError('Missing required fields', [
        { field: 'topic', message: 'Topic name is required' },
        { field: 'notification', message: 'Notification payload is required' },
      ]);
    }

    const result = await push.sendToTopic(topic, notification);

    res.json({
      success: result.success,
      messageId: result.messageId,
      error: result.error,
    });
  });

  /**
   * POST /api/push/subscribe
   * Subscribe tokens to a topic
   */
  router.post('/push/subscribe', async (req: Request, res: Response) => {
    const { tokens, topic } = req.body;

    if (!tokens || !Array.isArray(tokens) || tokens.length === 0) {
      throw new ValidationError('Invalid tokens', [
        { field: 'tokens', message: 'Must be a non-empty array of FCM tokens' }
      ]);
    }

    if (!topic) {
      throw new ValidationError('Missing topic', [
        { field: 'topic', message: 'Topic name is required' }
      ]);
    }

    await push.subscribeToTopic(tokens, topic);

    res.json({
      success: true,
      topic,
      subscribedCount: tokens.length,
    });
  });

  /**
   * POST /api/push/unsubscribe
   * Unsubscribe tokens from a topic
   */
  router.post('/push/unsubscribe', async (req: Request, res: Response) => {
    const { tokens, topic } = req.body;

    if (!tokens || !Array.isArray(tokens) || tokens.length === 0) {
      throw new ValidationError('Invalid tokens', [
        { field: 'tokens', message: 'Must be a non-empty array of FCM tokens' }
      ]);
    }

    if (!topic) {
      throw new ValidationError('Missing topic', [
        { field: 'topic', message: 'Topic name is required' }
      ]);
    }

    await push.unsubscribeFromTopic(tokens, topic);

    res.json({
      success: true,
      topic,
      unsubscribedCount: tokens.length,
    });
  });

  return router;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

interface CampaignData {
  campaignId: string;
  name: string;
  template: string;
  audience: {
    userIds?: string[];
    merchantIds?: string[];
    segment?: string;
    filters?: Record<string, unknown>;
  };
  channels: string[];
  payload: Record<string, unknown>;
  schedule: { type: string; sendAt?: string };
  settings: {
    throttlePerMinute?: number;
    retryFailed: boolean;
    maxRetries: number;
    trackOpens: boolean;
    trackClicks: boolean;
  };
  createdBy: string;
  createdAt: string;
}

async function executeCampaign(
  campaign: CampaignData,
  services: MarketingServices
): Promise<Array<{ success: boolean; userId?: string; error?: string }>> {
  const { email, sms, whatsapp, push, templateEngine } = services;
  const results: Array<{ success: boolean; userId?: string; error?: string }> = [];

  // In production, this would:
  // 1. Query user database for audience
  // 2. Fetch user contact info (email, phone, fcmToken)
  // 3. Queue messages to BullMQ with throttling
  // 4. Track campaign metrics

  const userIds = campaign.audience.userIds || [];
  const throttleMs = campaign.settings.throttlePerMinute
    ? (60000 / campaign.settings.throttlePerMinute)
    : 100; // Default: 100 per minute

  for (let i = 0; i < Math.min(userIds.length, 1000); i++) {
    const userId = userIds[i];

    for (const channel of campaign.channels) {
      try {
        switch (channel) {
          case 'email':
            await email.send({
              to: `user-${userId}@example.com`, // Would fetch from user service
              subject: campaign.payload.title as string,
              html: campaign.payload.body as string,
            });
            break;
          case 'sms':
            await sms.send({
              to: '+1234567890', // Would fetch from user service
              body: campaign.payload.body as string,
            });
            break;
          case 'whatsapp':
            await whatsapp.send({
              to: '+1234567890',
              body: campaign.payload.body as string,
            });
            break;
          case 'push':
            await push.send({
              userId,
              title: campaign.payload.title as string,
              body: campaign.payload.body as string,
              data: { campaignId: campaign.campaignId },
            });
            break;
        }
        results.push({ success: true, userId });
      } catch (error) {
        results.push({
          success: false,
          userId,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    // Throttle to prevent rate limiting
    if (i < userIds.length - 1) {
      await new Promise(resolve => setTimeout(resolve, throttleMs));
    }
  }

  return results;
}

async function sendToChannel(
  channel: string,
  notification: z.infer<typeof SendNotificationSchema>,
  services: MarketingServices
): Promise<{ channel: string; success: boolean; messageId?: string; error?: string }> {
  const { email, sms, whatsapp, push } = services;
  const { payload, userId } = notification;

  switch (channel) {
    case 'email':
      if (!payload.email) {
        return { channel, success: false, error: 'No email provided' };
      }
      const emailResult = await email.send({
        to: payload.email,
        subject: payload.emailSubject || payload.title,
        html: payload.emailHtml || payload.body,
      });
      return { channel, ...emailResult };

    case 'sms':
      if (!payload.phone) {
        return { channel, success: false, error: 'No phone provided' };
      }
      const smsResult = await sms.send({
        to: payload.phone,
        body: payload.body,
      });
      return { channel, ...smsResult };

    case 'whatsapp':
      if (!payload.phone) {
        return { channel, success: false, error: 'No phone provided' };
      }
      const waResult = await whatsapp.send({
        to: payload.phone,
        body: payload.body,
      });
      return { channel, ...waResult };

    case 'push':
      const pushResult = await push.send({
        userId,
        token: payload.fcmToken,
        title: payload.title,
        body: payload.body,
        data: payload.data,
      });
      return { channel, ...pushResult };

    case 'in_app':
      // Store for in-app display
      return { channel, success: true, messageId: `inapp-${Date.now()}` };

    default:
      return { channel, success: false, error: `Unknown channel: ${channel}` };
  }
}
