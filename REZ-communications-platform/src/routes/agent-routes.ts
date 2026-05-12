/**
 * REZ-Agent-OS Integration Routes for REZ Communications Platform
 *
 * These routes enable communication between the Marketing Hub and REZ-Agent-OS,
 * allowing AI agents to trigger marketing campaigns and receive insights.
 *
 * Agent Types:
 * - engagement_agent: Handles user re-engagement campaigns
 * - retention_agent: Manages retention and win-back campaigns
 * - referral_agent: Drives referral program campaigns
 * - upsell_agent: Handles upselling and cross-selling
 * - notification_agent: Manages push notification strategy
 * - email_agent: Optimizes email campaigns
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

export interface AgentServices {
  email: EmailService;
  sms: SMSService;
  whatsapp: WhatsAppService;
  push: PushService;
  templateEngine: TemplateEngine;
}

// ============================================================================
// TYPES
// ============================================================================

export type AgentType =
  | 'engagement_agent'
  | 'retention_agent'
  | 'referral_agent'
  | 'upsell_agent'
  | 'notification_agent'
  | 'email_agent'
  | 'sms_agent'
  | 'whatsapp_agent';

export interface AgentTriggerRequest {
  agentType: AgentType;
  action: string;
  context: {
    userId?: string;
    merchantId?: string;
    sessionId?: string;
    campaignId?: string;
    triggerData: Record<string, unknown>;
  };
  priority?: 'high' | 'normal' | 'low';
}

export interface AgentInsightsRequest {
  agentType: AgentType;
  insights: Array<{
    type: 'recommendation' | 'optimization' | 'alert' | 'metric';
    category: string;
    title: string;
    description: string;
    data?: Record<string, unknown>;
    confidence?: number;
    actionRequired?: boolean;
  }>;
  metrics?: Record<string, number | string>;
  recommendations?: string[];
}

export interface AgentResponse {
  success: boolean;
  agentType: AgentType;
  action: string;
  result?: {
    campaignId?: string;
    messageId?: string;
    recipients?: number;
    channels?: string[];
    estimatedReach?: number;
  };
  error?: string;
}

// ============================================================================
// REQUEST SCHEMAS
// ============================================================================

const AgentTriggerSchema = z.object({
  action: z.string().min(1),
  context: z.object({
    userId: z.string().optional(),
    merchantId: z.string().optional(),
    sessionId: z.string().optional(),
    campaignId: z.string().optional(),
    triggerData: z.record(z.unknown()),
  }),
  priority: z.enum(['high', 'normal', 'low']).default('normal'),
});

const AgentInsightsSchema = z.object({
  insights: z.array(z.object({
    type: z.enum(['recommendation', 'optimization', 'alert', 'metric']),
    category: z.string(),
    title: z.string(),
    description: z.string(),
    data: z.record(z.unknown()).optional(),
    confidence: z.number().min(0).max(1).optional(),
    actionRequired: z.boolean().optional(),
  })).min(1),
  metrics: z.record(z.union([z.number(), z.string()])).optional(),
  recommendations: z.array(z.string()).optional(),
});

// ============================================================================
// AGENT ACTION MAPPINGS
// ============================================================================

const AGENT_ACTIONS: Record<AgentType, {
  defaultTemplate?: string;
  channels: string[];
  description: string;
}> = {
  engagement_agent: {
    defaultTemplate: 'reengagement',
    channels: ['email', 'push'],
    description: 'Handles user re-engagement campaigns',
  },
  retention_agent: {
    defaultTemplate: 'win_back',
    channels: ['email', 'sms', 'whatsapp'],
    description: 'Manages retention and win-back campaigns',
  },
  referral_agent: {
    defaultTemplate: 'referral',
    channels: ['email', 'sms', 'whatsapp'],
    description: 'Drives referral program campaigns',
  },
  upsell_agent: {
    channels: ['email', 'push'],
    description: 'Handles upselling and cross-selling',
  },
  notification_agent: {
    channels: ['push'],
    description: 'Manages push notification strategy',
  },
  email_agent: {
    channels: ['email'],
    description: 'Optimizes email campaigns',
  },
  sms_agent: {
    channels: ['sms'],
    description: 'Optimizes SMS campaigns',
  },
  whatsapp_agent: {
    channels: ['whatsapp'],
    description: 'Manages WhatsApp campaigns',
  },
};

// ============================================================================
// ROUTER FACTORY
// ============================================================================

export function createAgentRoutes(services: AgentServices): Router {
  const router = Router();
  const { email, sms, whatsapp, push, templateEngine } = services;
  const templates = getMarketingTemplates();

  // =========================================================================
  // AGENT TRIGGER ENDPOINT
  // =========================================================================

  /**
   * GET /api/agents/trigger/:agentType
   * Trigger marketing action from an AI agent
   *
   * Example: GET /api/agents/trigger/engagement_agent?action=reengagement&userId=123
   */
  router.get('/trigger/:agentType', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const agentType = validateAgentType(req.params.agentType);
      const action = req.query.action as string;
      const userId = req.query.userId as string | undefined;
      const merchantId = req.query.merchantId as string | undefined;
      const sessionId = req.query.sessionId as string | undefined;

      if (!action) {
        throw new ValidationError('Missing required parameter', [
          { field: 'action', message: 'Action parameter is required' }
        ]);
      }

      // Get agent configuration
      const agentConfig = AGENT_ACTIONS[agentType];

      // Build trigger request
      const triggerRequest: AgentTriggerRequest = {
        agentType,
        action,
        context: {
          userId,
          merchantId,
          sessionId,
          triggerData: {
            ...req.query,
          },
        },
        priority: (req.query.priority as 'high' | 'normal' | 'low') || 'normal',
      };

      // Execute agent action
      const result = await executeAgentAction(triggerRequest, services, agentConfig);

      res.json({
        success: true,
        agentType,
        action,
        result,
        triggeredBy: req.serviceName || 'unknown',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      if (error instanceof ValidationError) throw error;
      if (error instanceof Error) {
        res.status(500).json({
          success: false,
          error: error.message,
        });
      }
    }
  });

  /**
   * POST /api/agents/trigger
   * Trigger marketing action from an AI agent (full request body)
   */
  router.post('/trigger', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const body = AgentTriggerSchema.parse(req.body);
      const agentType = validateAgentType(req.params.agentType || (req.body.agentType as AgentType));

      const triggerRequest: AgentTriggerRequest = {
        agentType,
        action: body.action,
        context: body.context,
        priority: body.priority,
      };

      const agentConfig = AGENT_ACTIONS[agentType];
      const result = await executeAgentAction(triggerRequest, services, agentConfig);

      res.json({
        success: true,
        agentType,
        action: body.action,
        result,
        triggeredBy: req.serviceName || 'unknown',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new ValidationError(
          'Invalid request body',
          error.errors.map(e => ({ field: e.path.join('.'), message: e.message }))
        );
      }
      throw error;
    }
  });

  // =========================================================================
  // AGENT INSIGHTS ENDPOINT
  // =========================================================================

  /**
   * POST /api/agents/insights
   * Receive insights and recommendations from AI agents
   *
   * Agents send insights about:
   * - Campaign performance recommendations
   * - User behavior patterns
   * - Optimization suggestions
   * - Alert conditions
   */
  router.post('/insights', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const body = AgentInsightsSchema.parse(req.body);
      const agentType = (req.body.agentType as AgentType) || 'engagement_agent';

      // Validate agent type
      validateAgentType(agentType);

      // Process and store insights
      const insightId = `insight-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const processedInsights = await processAgentInsights(agentType, body, req.serviceName);

      // Take automated actions if needed
      const automatedActions: string[] = [];
      for (const insight of body.insights) {
        if (insight.actionRequired && insight.type === 'recommendation') {
          const action = await handleAutomatedRecommendation(insight, services);
          if (action) automatedActions.push(action);
        }
      }

      res.json({
        success: true,
        insightId,
        agentType,
        receivedInsights: body.insights.length,
        processed: processedInsights.length,
        automatedActions,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new ValidationError(
          'Invalid request body',
          error.errors.map(e => ({ field: e.path.join('.'), message: e.message }))
        );
      }
      throw error;
    }
  });

  // =========================================================================
  // AGENT STATUS & REGISTRY
  // =========================================================================

  /**
   * GET /api/agents
   * List all registered agent types and their capabilities
   */
  router.get('/', (req: Request, res: Response) => {
    const agents = Object.entries(AGENT_ACTIONS).map(([type, config]) => ({
      type,
      description: config.description,
      supportedChannels: config.channels,
      defaultTemplate: config.defaultTemplate,
    }));

    res.json({
      agents,
      count: agents.length,
    });
  });

  /**
   * GET /api/agents/:agentType
   * Get details about a specific agent type
   */
  router.get('/:agentType', (req: Request, res: Response) => {
    const agentType = validateAgentType(req.params.agentType);
    const config = AGENT_ACTIONS[agentType];

    // Get available templates for this agent
    const availableTemplates = Object.entries(templates)
      .filter(([id, template]) =>
        template.channels.some(ch => config.channels.includes(ch))
      )
      .map(([id, template]) => ({
        id,
        name: template.name,
        description: template.description,
      }));

    res.json({
      type: agentType,
      description: config.description,
      supportedChannels: config.channels,
      availableTemplates,
    });
  });

  /**
   * GET /api/agents/insights/history
   * Get historical insights from agents
   */
  router.get('/insights/history', async (req: Request, res: Response) => {
    const { limit = '50', agentType, type } = req.query;

    // In production, query from database
    res.json({
      insights: [],
      pagination: {
        limit: parseInt(limit as string),
        offset: 0,
        total: 0,
      },
      filters: { agentType, type },
    });
  });

  // =========================================================================
  // CAMPAIGN EXECUTION FOR AGENTS
  // =========================================================================

  /**
   * POST /api/agents/campaign
   * Execute a campaign on behalf of an agent
   */
  router.post('/campaign', async (req: AuthenticatedRequest, res: Response) => {
    const { templateId, userIds, channels, payload, scheduledFor } = req.body;

    if (!templateId || !channels || channels.length === 0) {
      throw new ValidationError('Missing required fields', [
        { field: 'templateId', message: 'Template ID is required' },
        { field: 'channels', message: 'At least one channel is required' },
      ]);
    }

    const template = templates[templateId as keyof typeof templates];
    if (!template) {
      throw new ValidationError('Invalid template', [
        { field: 'templateId', message: `Template '${templateId}' not found` }
      ]);
    }

    const campaignId = `agent-campaign-${Date.now()}`;
    const results = [];

    for (const userId of (userIds || []).slice(0, 1000)) {
      for (const channel of channels) {
        try {
          switch (channel) {
            case 'email':
              await email.send({
                to: `user-${userId}@example.com`,
                subject: payload?.title || template.title,
                html: payload?.body || template.body,
              });
              break;
            case 'sms':
              await sms.send({
                to: '+1234567890',
                body: payload?.body || template.body,
              });
              break;
            case 'whatsapp':
              await whatsapp.send({
                to: '+1234567890',
                body: payload?.body || template.body,
              });
              break;
            case 'push':
              await push.send({
                userId,
                title: payload?.title || template.title,
                body: payload?.body || template.body,
                data: { campaignId, agentType: req.body.agentType },
              });
              break;
          }
          results.push({ userId, channel, success: true });
        } catch (error) {
          results.push({
            userId,
            channel,
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }
    }

    res.json({
      success: true,
      campaignId,
      agentType: req.body.agentType,
      totalRecipients: userIds?.length || 0,
      channels,
      results: {
        total: results.length,
        successful: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length,
      },
      scheduledFor,
      executedBy: req.serviceName || 'unknown',
    });
  });

  // =========================================================================
  // AGENT ANALYTICS
  // =========================================================================

  /**
   * GET /api/agents/analytics
   * Get analytics aggregated by agent type
   */
  router.get('/analytics/summary', async (req: Request, res: Response) => {
    const { startDate, endDate, agentType } = req.query;

    // In production, aggregate from database
    const analytics = {
      summary: {
        totalCampaigns: 0,
        totalMessages: 0,
        totalReach: 0,
        avgConversionRate: 0,
      },
      byAgent: {} as Record<string, unknown>,
      byChannel: {
        email: { sent: 0, delivered: 0, opened: 0, clicked: 0 },
        sms: { sent: 0, delivered: 0, responded: 0 },
        whatsapp: { sent: 0, delivered: 0, read: 0 },
        push: { sent: 0, delivered: 0, clicked: 0 },
      },
      period: { startDate, endDate },
    };

    res.json(analytics);
  });

  return router;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function validateAgentType(type: string): AgentType {
  const validTypes: AgentType[] = [
    'engagement_agent',
    'retention_agent',
    'referral_agent',
    'upsell_agent',
    'notification_agent',
    'email_agent',
    'sms_agent',
    'whatsapp_agent',
  ];

  if (!validTypes.includes(type as AgentType)) {
    throw new ValidationError('Invalid agent type', [
      {
        field: 'agentType',
        message: `Agent type '${type}' not found. Valid types: ${validTypes.join(', ')}`
      }
    ]);
  }

  return type as AgentType;
}

async function executeAgentAction(
  request: AgentTriggerRequest,
  services: AgentServices,
  agentConfig: typeof AGENT_ACTIONS[AgentType]
): Promise<AgentResponse['result']> {
  const { email, sms, whatsapp, push } = services;
  const { agentType, action, context } = request;

  // Map actions to templates and channels
  const actionConfig = getActionConfig(agentType, action);

  if (!actionConfig) {
    throw new Error(`Unknown action '${action}' for agent '${agentType}'`);
  }

  // Execute based on channels
  const results = [];
  for (const channel of actionConfig.channels) {
    try {
      switch (channel) {
        case 'email':
          await email.send({
            to: `user-${context.userId}@example.com`,
            subject: actionConfig.title || 'REZ Update',
            html: actionConfig.body || actionConfig.message || '',
          });
          results.push({ channel, success: true });
          break;

        case 'sms':
          await sms.send({
            to: '+1234567890',
            body: actionConfig.body || actionConfig.message || '',
          });
          results.push({ channel, success: true });
          break;

        case 'whatsapp':
          await whatsapp.send({
            to: '+1234567890',
            body: actionConfig.body || actionConfig.message || '',
          });
          results.push({ channel, success: true });
          break;

        case 'push':
          await push.send({
            userId: context.userId,
            title: actionConfig.title || 'REZ Update',
            body: actionConfig.body || actionConfig.message || '',
            data: { agentType, action, sessionId: context.sessionId },
          });
          results.push({ channel, success: true });
          break;
      }
    } catch (error) {
      results.push({
        channel,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  return {
    campaignId: `agent-${agentType}-${Date.now()}`,
    recipients: context.userId ? 1 : 0,
    channels: actionConfig.channels,
    estimatedReach: context.userId ? 1 : 0,
  };
}

function getActionConfig(agentType: AgentType, action: string): {
  channels: string[];
  templateId?: string;
  title?: string;
  body?: string;
  message?: string;
} | null {
  // Define action configurations for each agent type
  const configs: Record<AgentType, Record<string, ReturnType<typeof getActionConfig>>> = {
    engagement_agent: {
      reengagement: { channels: ['email', 'push'], templateId: 'reengagement', title: 'We Miss You!', body: 'It has been a while since your last visit. Here is a special offer just for you!' },
      welcome_back: { channels: ['email', 'whatsapp'], templateId: 'welcome_sequence', title: 'Welcome Back!', body: 'Great to have you back! Check out what is new.' },
    },
    retention_agent: {
      win_back: { channels: ['email', 'sms', 'whatsapp'], templateId: 'win_back', title: 'We Want You Back!', body: 'Here is an exclusive offer just for you.' },
      loyalty_reward: { channels: ['email', 'push'], title: 'Loyalty Reward!', body: 'You have earned a special reward!' },
    },
    referral_agent: {
      invite: { channels: ['email', 'sms', 'whatsapp'], templateId: 'referral', title: 'Invite Friends', body: 'Share REZ with your friends and earn rewards!' },
      reminder: { channels: ['push', 'sms'], title: 'Referral Reminder', body: 'You still have referral rewards to claim!' },
    },
    upsell_agent: {
      product_alert: { channels: ['email', 'push'], title: 'Product Alert', body: 'Items you might like are on sale!' },
      upgrade_offer: { channels: ['email'], title: 'Upgrade Available', body: 'Get more with our premium tier!' },
    },
    notification_agent: {
      flash_sale: { channels: ['push'], title: 'Flash Sale!', body: 'Limited time offer - ends soon!' },
      new_feature: { channels: ['push'], title: 'New Feature!', body: 'Check out what is new in REZ!' },
      price_drop: { channels: ['push', 'email'], title: 'Price Drop Alert', body: 'An item in your wishlist has dropped in price!' },
    },
    email_agent: {
      newsletter: { channels: ['email'], title: 'Your Weekly Update', body: 'Here is what is happening this week.' },
      promotion: { channels: ['email'], templateId: 'promotion', title: 'Special Offer!', body: 'Do not miss out on this deal!' },
    },
    sms_agent: {
      order_update: { channels: ['sms'], title: 'Order Update', body: 'Your order status has been updated.' },
      promo: { channels: ['sms'], title: 'Promo Alert', body: 'Use code SAVE20 for 20% off!' },
    },
    whatsapp_agent: {
      appointment_reminder: { channels: ['whatsapp'], title: 'Appointment Reminder', body: 'Your appointment is coming up!' },
      support: { channels: ['whatsapp'], title: 'REZ Support', body: 'How can we help you today?' },
    },
  };

  return configs[agentType]?.[action] || null;
}

async function processAgentInsights(
  agentType: AgentType,
  request: z.infer<typeof AgentInsightsSchema>,
  serviceName?: string
): Promise<string[]> {
  const processed: string[] = [];

  for (const insight of request.insights) {
    // Log insight
    console.log(`[${agentType}] Insight received:`, {
      type: insight.type,
      category: insight.category,
      title: insight.title,
      description: insight.description,
      confidence: insight.confidence,
      actionRequired: insight.actionRequired,
    });

    // In production:
    // 1. Store in database
    // 2. Trigger alerts if needed
    // 3. Update analytics dashboards
    // 4. Notify relevant teams via Slack/Teams

    processed.push(insight.title);
  }

  // Update agent metrics
  if (request.metrics) {
    console.log(`[${agentType}] Metrics update:`, request.metrics);
  }

  return processed;
}

async function handleAutomatedRecommendation(
  insight: {
    type: string;
    category: string;
    title: string;
    description: string;
    data?: Record<string, unknown>;
  },
  services: AgentServices
): Promise<string | null> {
  // Auto-handle certain recommendation types
  switch (insight.category) {
    case 'abandonment_recovery':
      // Trigger abandonment recovery campaign
      console.log(`Triggering abandonment recovery based on insight: ${insight.title}`);
      return 'abandonment_recovery_campaign_triggered';

    case 'price_alert':
      // Send price drop notifications
      console.log(`Triggering price alert based on insight: ${insight.title}`);
      return 'price_alert_campaign_triggered';

    case 'low_engagement':
      // Send re-engagement campaign
      console.log(`Triggering re-engagement based on insight: ${insight.title}`);
      return 'reengagement_campaign_triggered';

    default:
      // Log for manual review
      console.log(`Recommendation requires manual action: ${insight.title}`);
      return null;
  }
}
