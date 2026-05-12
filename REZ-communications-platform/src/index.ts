/**
 * REZ Communications Platform - Main Entry Point
 * Multi-channel communications service (Email, SMS, WhatsApp, Push)
 */

import express, { Request, Response, NextFunction } from 'express';
import { logger, createLogger } from './utils/logger';
import { PlatformConfig, ChannelType, HealthCheckResult } from './types';
import { CommunicationError, ValidationError } from './utils/errors';

// Services
import { EmailService, createEmailService } from './email/email-service';
import { SMSService, createSMSService } from './sms/sms-service';
import { WhatsAppService, createWhatsAppService } from './whatsapp/whatsapp-service';
import { PushService, createPushService } from './push/push-service';
import { TemplateEngine, createTemplateEngine } from './templates/template-engine';
import { CampaignOrchestrator, createCampaignOrchestrator } from './orchestrator/campaign-orchestrator';

// Push integration
import { createDeviceRegistry, DeviceRegistry, SUPPORTED_APPS } from './push/deviceRegistry';
import { createPushRouter, PushRouter } from './push/pushRouter';
import {
  pushTemplateEngine,
  getSupportedTemplateTypes,
  getTemplateMetadata
} from './push/templates';

// Auth middleware
import {
  internalServiceAuth,
  optionalInternalAuth,
  rateLimitByService,
  auditLogger,
  corsConfig,
  initializeServiceTokens,
  AuthenticatedRequest,
} from './middleware/auth';

// Marketing routes
import { createMarketingRoutes } from './routes/marketing-routes';

// Webhook routes
import { createWebhookRoutes, WebhookConfig } from './routes/webhook-routes';

// Agent routes
import { createAgentRoutes } from './routes/agent-routes';

// Marketing templates
import { getMarketingTemplates } from './templates/marketing-templates';

export interface CommunicationsPlatform {
  email: EmailService;
  sms: SMSService;
  whatsapp: WhatsAppService;
  push: PushService;
  templateEngine: TemplateEngine;
  campaignOrchestrator: CampaignOrchestrator;
  deviceRegistry: DeviceRegistry;
  pushRouter: PushRouter;
  healthCheck: () => Promise<HealthCheckResult[]>;
  destroy: () => Promise<void>;
}

class CommunicationsPlatformImpl implements CommunicationsPlatform {
  public email: EmailService;
  public sms: SMSService;
  public whatsapp: WhatsAppService;
  public push: PushService;
  public templateEngine: TemplateEngine;
  public campaignOrchestrator: CampaignOrchestrator;
  public deviceRegistry: DeviceRegistry;
  public pushRouter: PushRouter;

  private app: express.Application;
  private config: PlatformConfig;
  private log = createLogger('CommunicationsPlatform', process.env.NODE_ENV || 'development');

  constructor(config: PlatformConfig) {
    this.config = config;
    this.app = express();

    // Initialize service tokens for internal auth
    initializeServiceTokens();

    // Initialize services
    this.email = createEmailService(config.email);
    this.sms = createSMSService(config.sms);
    this.whatsapp = createWhatsAppService(config.whatsapp);
    this.push = createPushService(config.push);
    this.templateEngine = createTemplateEngine();
    this.campaignOrchestrator = createCampaignOrchestrator(
      config,
      this.email,
      this.sms,
      this.whatsapp,
      this.push,
      this.templateEngine
    );

    // Initialize push integration
    this.deviceRegistry = createDeviceRegistry();
    this.pushRouter = createPushRouter(this.deviceRegistry, this.push, config.push);

    this.setupMiddleware();
    this.setupRoutes();
  }

  private setupMiddleware(): void {
    // CORS for REZ services
    this.app.use(corsConfig);

    // Body parsing
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true }));

    // Request logging with audit trail
    this.app.use(auditLogger);

    // Health checks (no auth required)
    this.app.get('/health', async (req: Request, res: Response) => {
      const results = await this.healthCheck();
      const allHealthy = results.every(r => r.healthy);

      res.status(allHealthy ? 200 : 503).json({
        status: allHealthy ? 'healthy' : 'unhealthy',
        services: results
      });
    });

    this.app.get('/ready', async (req: Request, res: Response) => {
      res.status(200).json({ status: 'ready' });
    });

    // Webhook endpoints (verify signatures, no internal auth)
    const webhookConfig: WebhookConfig = {
      whatsapp: {
        verifyToken: process.env.WHATSAPP_VERIFY_TOKEN || '',
        appSecret: process.env.WHATSAPP_APP_SECRET || '',
        autoReply: process.env.WHATSAPP_AUTO_REPLY === 'true',
        autoReplyMessage: process.env.WHATSAPP_AUTO_REPLY_MESSAGE,
      },
      twilio: {
        authToken: process.env.TWILIO_AUTH_TOKEN || '',
        accountSid: process.env.TWILIO_ACCOUNT_SID || '',
      },
      handlers: this.getWebhookHandlers(),
    };
    this.app.use('/webhooks', createWebhookRoutes(webhookConfig));

    // Error handler (must be last)
    this.app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
      if (err instanceof CommunicationError) {
        res.status(err.statusCode).json({
          error: {
            code: err.code,
            message: err.message,
            channel: err.channel,
            details: err.details
          }
        });
      } else if (err instanceof ValidationError) {
        res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: err.message,
            validationErrors: err.validationErrors
          }
        });
      } else {
        this.log.error('Unhandled error', err);
        res.status(500).json({
          error: {
            code: 'INTERNAL_ERROR',
            message: 'An unexpected error occurred'
          }
        });
      }
    });
  }

  /**
   * Get webhook handlers from environment configuration
   */
  private getWebhookHandlers(): Array<{ url: string; events?: string[] }> {
    const handlers: Array<{ url: string; events?: string[] }> = [];

    if (process.env.WEBHOOK_HANDLER_URL_1) {
      handlers.push({
        url: process.env.WEBHOOK_HANDLER_URL_1,
        events: process.env.WEBHOOK_HANDLER_EVENTS_1?.split(','),
      });
    }
    if (process.env.WEBHOOK_HANDLER_URL_2) {
      handlers.push({
        url: process.env.WEBHOOK_HANDLER_URL_2,
        events: process.env.WEBHOOK_HANDLER_EVENTS_2?.split(','),
      });
    }

    return handlers;
  }

  private setupRoutes(): void {
    // ==========================================
    // PROTECTED API ROUTES (Internal Service Auth)
    // ==========================================

    // Marketing routes - Campaign and Notification APIs
    const marketingServices = {
      email: this.email,
      sms: this.sms,
      whatsapp: this.whatsapp,
      push: this.push,
      templateEngine: this.templateEngine,
    };
    this.app.use(
      '/api',
      internalServiceAuth,
      rateLimitByService,
      createMarketingRoutes(marketingServices)
    );

    // Agent routes - REZ-Agent-OS integration
    this.app.use(
      '/api/agents',
      internalServiceAuth,
      rateLimitByService,
      createAgentRoutes(marketingServices)
    );

    // Legacy routes (backward compatibility) - also protected
    this.app.use('/api', internalServiceAuth, rateLimitByService, this.createLegacyRoutes());

    // Public marketing template listing (no auth for viewing templates)
    this.app.get('/api/marketing/templates', (req: Request, res: Response) => {
      const templates = getMarketingTemplates();
      const templateList = Object.entries(templates).map(([id, template]) => ({
        id,
        name: template.name,
        description: template.description,
        channels: template.channels,
        variables: {
          required: template.variables.required,
          optional: template.variables.optional,
        },
        metadata: template.metadata,
      }));
      res.json({ templates: templateList });
    });

    this.app.get('/api/marketing/templates/:templateId', (req: Request, res: Response) => {
      const templates = getMarketingTemplates();
      const template = templates[req.params.templateId as keyof typeof templates];
      if (!template) {
        return res.status(404).json({ error: 'Template not found' });
      }
      res.json({ id: req.params.templateId, ...template });
    });

    // Platform info (public)
    this.app.get('/api/platform/info', (req: Request, res: Response) => {
      res.json({
        name: 'REZ Communications Platform',
        version: '2.0.0',
        description: 'Central Marketing Hub for REZ-Media apps',
        capabilities: {
          channels: ['email', 'sms', 'whatsapp', 'push'],
          features: [
            'campaign_management',
            'marketing_automation',
            'agent_integration',
            'webhook_processing',
            'template_engine',
            'ab_testing',
          ],
          agentTypes: [
            'engagement_agent',
            'retention_agent',
            'referral_agent',
            'upsell_agent',
            'notification_agent',
            'email_agent',
            'sms_agent',
            'whatsapp_agent',
          ],
        },
        supportedApps: SUPPORTED_APPS,
      });
    });
  }

  /**
   * Create legacy route handlers for backward compatibility
   */
  private createLegacyRoutes(): express.Router {
    const router = express.Router();

    // Push routes (using router for extended functionality)
    router.use('/push', this.pushRouter.getRouter());

    // Push convenience routes
    router.post('/push/send-raw', async (req: Request, res: Response) => {
      const result = await this.push.send(req.body);
      res.json(result);
    });

    router.post('/push/send-to-topic', async (req: Request, res: Response) => {
      const result = await this.push.sendToTopic(req.body.topic, req.body.notification);
      res.json(result);
    });

    router.post('/push/batch', async (req: Request, res: Response) => {
      const result = await this.push.sendBatch(req.body.notifications);
      res.json({ results: result });
    });

    router.post('/push/subscribe-to-topic', async (req: Request, res: Response) => {
      await this.push.subscribeToTopic(req.body.tokens, req.body.topic);
      res.json({ success: true });
    });

    // Push info routes
    router.get('/push/supported-apps', (req: Request, res: Response) => {
      res.json({
        apps: SUPPORTED_APPS,
        templates: getSupportedTemplateTypes()
      });
    });

    router.get('/push/app-templates/:appId', (req: Request, res: Response) => {
      const { appId } = req.params;
      const templates: Record<string, unknown> = {};

      for (const type of getSupportedTemplateTypes()) {
        const metadata = getTemplateMetadata(appId as typeof SUPPORTED_APPS[number], type);
        if (metadata) {
          templates[type] = {
            title: metadata.title,
            body: metadata.body,
            variables: metadata.variables
          };
        }
      }

      res.json({ appId, templates });
    });

    // Email routes
    router.post('/email/send', async (req: Request, res: Response) => {
      const result = await this.email.send(req.body);
      res.json(result);
    });

    router.post('/email/batch', async (req: Request, res: Response) => {
      const result = await this.email.sendBatch(req.body.messages);
      res.json({ results: result });
    });

    // SMS routes
    router.post('/sms/send', async (req: Request, res: Response) => {
      const result = await this.sms.send(req.body);
      res.json(result);
    });

    router.post('/sms/batch', async (req: Request, res: Response) => {
      const result = await this.sms.sendBatch(req.body.messages);
      res.json({ results: result });
    });

    router.post('/sms/validate', async (req: Request, res: Response) => {
      const isValid = await this.sms.validateNumber(req.body);
      res.json({ valid: isValid });
    });

    // WhatsApp routes
    router.post('/whatsapp/send', async (req: Request, res: Response) => {
      const result = await this.whatsapp.send(req.body);
      res.json(result);
    });

    router.post('/whatsapp/send-template', async (req: Request, res: Response) => {
      const result = await this.whatsapp.sendTemplate(req.body.templateName, req.body.variables);
      res.json(result);
    });

    router.post('/whatsapp/batch', async (req: Request, res: Response) => {
      const result = await this.whatsapp.sendBatch(req.body.messages);
      res.json({ results: result });
    });

    // Template routes
    router.get('/templates', (req: Request, res: Response) => {
      const templates = this.templateEngine.listTemplates();
      res.json({ templates });
    });

    router.get('/templates/:id', (req: Request, res: Response) => {
      const template = this.templateEngine.getTemplate(req.params.id);
      if (!template) {
        return res.status(404).json({ error: 'Template not found' });
      }
      res.json(template);
    });

    router.post('/templates/:id/render', async (req: Request, res: Response) => {
      const result = await this.templateEngine.render(req.params.id, req.body.variables);
      res.json({ rendered: result });
    });

    router.post('/templates', (req: Request, res: Response) => {
      this.templateEngine.registerTemplate(req.body.id, req.body.template, req.body.metadata);
      res.json({ success: true });
    });

    // Campaign routes
    router.post('/campaigns', async (req: Request, res: Response) => {
      const result = await this.campaignOrchestrator.createCampaign(req.body);
      res.json(result);
    });

    router.post('/campaigns/:id/execute', async (req: Request, res: Response) => {
      const result = await this.campaignOrchestrator.executeCampaign(req.params.id);
      res.json(result);
    });

    router.post('/campaigns/:id/cancel', async (req: Request, res: Response) => {
      await this.campaignOrchestrator.cancelCampaign(req.params.id);
      res.json({ success: true });
    });

    router.get('/campaigns/:id/status', async (req: Request, res: Response) => {
      const result = await this.campaignOrchestrator.getCampaignStatus(req.params.id);
      res.json(result);
    });

    router.post('/campaigns/schedule', async (req: Request, res: Response) => {
      const result = await this.campaignOrchestrator.scheduleCampaign(
        req.body.campaign,
        new Date(req.body.scheduledAt)
      );
      res.json(result);
    });

    return router;
  }

  /**
   * Start the Express server
   */
  start(port: number = 3000): Promise<void> {
    return new Promise((resolve) => {
      this.app.listen(port, () => {
        this.log.info(`REZ Communications Platform v2.0 started on port ${port}`);
        this.log.info('Available channels:', {
          email: this.config.email.provider,
          sms: this.config.sms.provider,
          whatsapp: this.config.whatsapp.provider,
          push: this.config.push.provider
        });
        this.log.info('Marketing Hub Features:', {
          agentIntegration: 'REZ-Agent-OS integration enabled',
          webhookEndpoints: ['/webhooks/whatsapp', '/webhooks/twilio', '/webhooks/sendgrid'],
          marketingTemplates: Object.keys(getMarketingTemplates()).length,
        });
        this.log.info('Push notification integration:', {
          supportedApps: SUPPORTED_APPS,
          templates: getSupportedTemplateTypes().length,
          router: 'pushRouter'
        });
        resolve();
      });
    });
  }

  /**
   * Health check for all services
   */
  async healthCheck(): Promise<HealthCheckResult[]> {
    const results: HealthCheckResult[] = [];

    // Email health
    try {
      const emailHealth = await this.email.healthCheck();
      results.push({
        service: 'email',
        healthy: emailHealth.healthy,
        latency: emailHealth.latency,
        error: emailHealth.error,
        lastChecked: new Date()
      });
    } catch (error) {
      results.push({
        service: 'email',
        healthy: false,
        error: (error as Error).message,
        lastChecked: new Date()
      });
    }

    // SMS health
    try {
      const smsHealth = await this.sms.healthCheck();
      results.push({
        service: 'sms',
        healthy: smsHealth.healthy,
        latency: smsHealth.latency,
        error: smsHealth.error,
        lastChecked: new Date()
      });
    } catch (error) {
      results.push({
        service: 'sms',
        healthy: false,
        error: (error as Error).message,
        lastChecked: new Date()
      });
    }

    // WhatsApp health
    try {
      const whatsappHealth = await this.whatsapp.healthCheck();
      results.push({
        service: 'whatsapp',
        healthy: whatsappHealth.healthy,
        latency: whatsappHealth.latency,
        error: whatsappHealth.error,
        lastChecked: new Date()
      });
    } catch (error) {
      results.push({
        service: 'whatsapp',
        healthy: false,
        error: (error as Error).message,
        lastChecked: new Date()
      });
    }

    // Push health
    try {
      const pushHealth = await this.push.healthCheck();
      results.push({
        service: 'push',
        healthy: pushHealth.healthy,
        latency: pushHealth.latency,
        error: pushHealth.error,
        lastChecked: new Date()
      });
    } catch (error) {
      results.push({
        service: 'push',
        healthy: false,
        error: (error as Error).message,
        lastChecked: new Date()
      });
    }

    // Device registry health
    try {
      const registryHealth = await this.deviceRegistry.healthCheck();
      results.push({
        service: 'deviceRegistry',
        healthy: registryHealth.healthy,
        error: registryHealth.error,
        lastChecked: new Date()
      });
    } catch (error) {
      results.push({
        service: 'deviceRegistry',
        healthy: false,
        error: (error as Error).message,
        lastChecked: new Date()
      });
    }

    // Orchestrator health
    try {
      const orchestratorHealth = await this.campaignOrchestrator.healthCheck();
      results.push({
        service: 'orchestrator',
        healthy: orchestratorHealth.healthy,
        lastChecked: new Date()
      });
    } catch (error) {
      results.push({
        service: 'orchestrator',
        healthy: false,
        error: (error as Error).message,
        lastChecked: new Date()
      });
    }

    return results;
  }

  /**
   * Cleanup resources
   */
  async destroy(): Promise<void> {
    this.log.info('Shutting down REZ Communications Platform');

    if (this.whatsapp instanceof WhatsAppService) {
      await this.whatsapp.destroy();
    }

    await this.campaignOrchestrator.destroy();
    await this.deviceRegistry.destroy();
    this.log.info('Shutdown complete');
  }

  /**
   * Get Express app for custom routing
   */
  getApp(): express.Application {
    return this.app;
  }
}

// ============================================
// FACTORY FUNCTION
// ============================================

export function createCommunicationsPlatform(config: PlatformConfig): CommunicationsPlatform {
  return new CommunicationsPlatformImpl(config);
}

// ============================================
// DEFAULT CONFIGURATION
// ============================================

export function getDefaultConfig(): PlatformConfig {
  return {
    email: {
      provider: process.env.EMAIL_PROVIDER as 'sendgrid' | 'ses' | 'mock' || 'mock',
      apiKey: process.env.SENDGRID_API_KEY,
      fromEmail: process.env.EMAIL_FROM || 'noreply@rez.io',
      fromName: process.env.EMAIL_FROM_NAME || 'REZ'
    },
    sms: {
      provider: process.env.SMS_PROVIDER as 'twilio' | 'mock' || 'mock',
      accountSid: process.env.TWILIO_ACCOUNT_SID,
      authToken: process.env.TWILIO_AUTH_TOKEN,
      fromNumber: process.env.TWILIO_FROM_NUMBER
    },
    whatsapp: {
      provider: process.env.WHATSAPP_PROVIDER as 'twilio' | 'whatsapp-web' | 'mock' || 'mock',
      accountSid: process.env.TWILIO_ACCOUNT_SID,
      authToken: process.env.TWILIO_AUTH_TOKEN,
      fromNumber: process.env.WHATSAPP_FROM_NUMBER,
      sessionPath: process.env.WHATSAPP_SESSION_PATH || './whatsapp-sessions'
    },
    push: {
      provider: process.env.PUSH_PROVIDER as 'firebase' | 'mock' || 'mock',
      serviceAccountPath: process.env.FIREBASE_SERVICE_ACCOUNT_PATH,
      projectId: process.env.FIREBASE_PROJECT_ID
    },
    queue: {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
      db: parseInt(process.env.REDIS_DB || '0')
    },
    environment: (process.env.NODE_ENV as 'development' | 'staging' | 'production') || 'development',
    logLevel: (process.env.LOG_LEVEL as 'debug' | 'info' | 'warn' | 'error') || 'info'
  };
}

// ============================================
// MARKETING HUB CONFIGURATION
// ============================================

export interface MarketingHubConfig {
  // Internal service tokens (JSON map format)
  internalServiceTokens: Record<string, string>;

  // Webhook configuration
  whatsapp: {
    verifyToken: string;
    appSecret: string;
    autoReply: boolean;
    autoReplyMessage?: string;
  };
  twilio: {
    authToken: string;
    accountSid: string;
  };

  // Agent configuration
  agents: {
    enabled: boolean;
    autoExecute: boolean;
    insightRetentionDays: number;
  };

  // Rate limiting
  rateLimit: {
    requestsPerMinute: number;
    burstSize: number;
  };

  // Webhook handlers
  webhookHandlers: Array<{
    url: string;
    events?: string[];
  }>;
}

export function getMarketingHubConfig(): MarketingHubConfig {
  return {
    internalServiceTokens: JSON.parse(process.env.INTERNAL_SERVICE_TOKENS_JSON || '{}'),

    whatsapp: {
      verifyToken: process.env.WHATSAPP_VERIFY_TOKEN || '',
      appSecret: process.env.WHATSAPP_APP_SECRET || '',
      autoReply: process.env.WHATSAPP_AUTO_REPLY === 'true',
      autoReplyMessage: process.env.WHATSAPP_AUTO_REPLY_MESSAGE,
    },

    twilio: {
      authToken: process.env.TWILIO_AUTH_TOKEN || '',
      accountSid: process.env.TWILIO_ACCOUNT_SID || '',
    },

    agents: {
      enabled: process.env.AGENTS_ENABLED !== 'false',
      autoExecute: process.env.AGENTS_AUTO_EXECUTE === 'true',
      insightRetentionDays: parseInt(process.env.AGENTS_INSIGHT_RETENTION_DAYS || '90'),
    },

    rateLimit: {
      requestsPerMinute: parseInt(process.env.RATE_LIMIT_RPM || '1000'),
      burstSize: parseInt(process.env.RATE_LIMIT_BURST || '100'),
    },

    webhookHandlers: getWebhookHandlersFromEnv(),
  };
}

function getWebhookHandlersFromEnv(): Array<{ url: string; events?: string[] }> {
  const handlers: Array<{ url: string; events?: string[] }> = [];
  const maxHandlers = 10;

  for (let i = 1; i <= maxHandlers; i++) {
    const urlKey = `WEBHOOK_HANDLER_URL_${i}`;
    const eventsKey = `WEBHOOK_HANDLER_EVENTS_${i}`;
    const url = process.env[urlKey];

    if (url) {
      handlers.push({
        url,
        events: process.env[eventsKey]?.split(','),
      });
    }
  }

  return handlers;
}

// ============================================
// MAIN ENTRY POINT
// ============================================

async function main(): Promise<void> {
  const config = getDefaultConfig();
  const platform = createCommunicationsPlatform(config);

  const port = parseInt(process.env.PORT || '3000');

  // Graceful shutdown
  process.on('SIGTERM', async () => {
    await platform.destroy();
    process.exit(0);
  });

  process.on('SIGINT', async () => {
    await platform.destroy();
    process.exit(0);
  });

  await platform.start(port);
}

// Run if executed directly
if (require.main === module) {
  main().catch((error) => {
    logger.error('Failed to start platform', error);
    process.exit(1);
  });
}

// Export for programmatic use
export { main };
