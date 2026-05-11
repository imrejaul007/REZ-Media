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

export interface CommunicationsPlatform {
  email: EmailService;
  sms: SMSService;
  whatsapp: WhatsAppService;
  push: PushService;
  templateEngine: TemplateEngine;
  campaignOrchestrator: CampaignOrchestrator;
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

  private app: express.Application;
  private config: PlatformConfig;
  private log = createLogger('CommunicationsPlatform', process.env.NODE_ENV || 'development');

  constructor(config: PlatformConfig) {
    this.config = config;
    this.app = express();

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

    this.setupMiddleware();
    this.setupRoutes();
  }

  private setupMiddleware(): void {
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));

    // Request logging
    this.app.use((req: Request, res: Response, next: NextFunction) => {
      const start = Date.now();
      res.on('finish', () => {
        const duration = Date.now() - start;
        this.log.info('Request completed', {
          method: req.method,
          path: req.path,
          status: res.statusCode,
          duration
        });
      });
      next();
    });

    // Error handler
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

  private setupRoutes(): void {
    // Health check endpoint
    this.app.get('/health', async (req: Request, res: Response) => {
      const results = await this.healthCheck();
      const allHealthy = results.every(r => r.healthy);

      res.status(allHealthy ? 200 : 503).json({
        status: allHealthy ? 'healthy' : 'unhealthy',
        services: results
      });
    });

    // Readiness check
    this.app.get('/ready', async (req: Request, res: Response) => {
      res.status(200).json({ status: 'ready' });
    });

    // Email routes
    this.app.post('/api/email/send', async (req: Request, res: Response) => {
      const result = await this.email.send(req.body);
      res.json(result);
    });

    this.app.post('/api/email/batch', async (req: Request, res: Response) => {
      const result = await this.email.sendBatch(req.body.messages);
      res.json({ results: result });
    });

    // SMS routes
    this.app.post('/api/sms/send', async (req: Request, res: Response) => {
      const result = await this.sms.send(req.body);
      res.json(result);
    });

    this.app.post('/api/sms/batch', async (req: Request, res: Response) => {
      const result = await this.sms.sendBatch(req.body.messages);
      res.json({ results: result });
    });

    this.app.post('/api/sms/validate', async (req: Request, res: Response) => {
      const isValid = await this.sms.validateNumber(req.body);
      res.json({ valid: isValid });
    });

    // WhatsApp routes
    this.app.post('/api/whatsapp/send', async (req: Request, res: Response) => {
      const result = await this.whatsapp.send(req.body);
      res.json(result);
    });

    this.app.post('/api/whatsapp/send-template', async (req: Request, res: Response) => {
      const result = await this.whatsapp.sendTemplate(req.body.templateName, req.body.variables);
      res.json(result);
    });

    this.app.post('/api/whatsapp/batch', async (req: Request, res: Response) => {
      const result = await this.whatsapp.sendBatch(req.body.messages);
      res.json({ results: result });
    });

    // Push routes
    this.app.post('/api/push/send', async (req: Request, res: Response) => {
      const result = await this.push.send(req.body);
      res.json(result);
    });

    this.app.post('/api/push/send-to-topic', async (req: Request, res: Response) => {
      const result = await this.push.sendToTopic(req.body.topic, req.body.notification);
      res.json(result);
    });

    this.app.post('/api/push/batch', async (req: Request, res: Response) => {
      const result = await this.push.sendBatch(req.body.notifications);
      res.json({ results: result });
    });

    this.app.post('/api/push/subscribe', async (req: Request, res: Response) => {
      await this.push.subscribeToTopic(req.body.tokens, req.body.topic);
      res.json({ success: true });
    });

    // Template routes
    this.app.get('/api/templates', (req: Request, res: Response) => {
      const templates = this.templateEngine.listTemplates();
      res.json({ templates });
    });

    this.app.get('/api/templates/:id', (req: Request, res: Response) => {
      const template = this.templateEngine.getTemplate(req.params.id);
      if (!template) {
        return res.status(404).json({ error: 'Template not found' });
      }
      res.json(template);
    });

    this.app.post('/api/templates/:id/render', async (req: Request, res: Response) => {
      const result = await this.templateEngine.render(req.params.id, req.body.variables);
      res.json({ rendered: result });
    });

    this.app.post('/api/templates', (req: Request, res: Response) => {
      this.templateEngine.registerTemplate(req.body.id, req.body.template, req.body.metadata);
      res.json({ success: true });
    });

    // Campaign routes
    this.app.post('/api/campaigns', async (req: Request, res: Response) => {
      const result = await this.campaignOrchestrator.createCampaign(req.body);
      res.json(result);
    });

    this.app.post('/api/campaigns/:id/execute', async (req: Request, res: Response) => {
      const result = await this.campaignOrchestrator.executeCampaign(req.params.id);
      res.json(result);
    });

    this.app.post('/api/campaigns/:id/cancel', async (req: Request, res: Response) => {
      await this.campaignOrchestrator.cancelCampaign(req.params.id);
      res.json({ success: true });
    });

    this.app.get('/api/campaigns/:id/status', async (req: Request, res: Response) => {
      const result = await this.campaignOrchestrator.getCampaignStatus(req.params.id);
      res.json(result);
    });

    this.app.post('/api/campaigns/schedule', async (req: Request, res: Response) => {
      const result = await this.campaignOrchestrator.scheduleCampaign(
        req.body.campaign,
        new Date(req.body.scheduledAt)
      );
      res.json(result);
    });
  }

  /**
   * Start the Express server
   */
  start(port: number = 3000): Promise<void> {
    return new Promise((resolve) => {
      this.app.listen(port, () => {
        this.log.info(`REZ Communications Platform started on port ${port}`);
        this.log.info('Available channels:', {
          email: this.config.email.provider,
          sms: this.config.sms.provider,
          whatsapp: this.config.whatsapp.provider,
          push: this.config.push.provider
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
