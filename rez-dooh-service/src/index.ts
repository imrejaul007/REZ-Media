/**
 * DOOH Service - Unified Entry Point
 *
 * Digital Out of Home Advertising Network Service
 *
 * Combines:
 * - Screen management (from dooh/, adsos/dooh/)
 * - Ad decision engine (AdOS - adsos/)
 * - Area-based targeting (areaIntelligence)
 * - 1:1 personalization (personalization)
 * - DOOH analytics (analytics)
 * - AdQR integration (analytics)
 */

import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';

// Services
import { ScreenManagementService } from './services/screenManagement';
import { AdDecisionService } from './services/adDecision';
import { AreaIntelligenceService } from './services/areaIntelligence';
import { PersonalizationService } from './services/personalization';
import { AnalyticsService } from './services/analytics';

// Routes
import { createScreenRoutes } from './routes/screens';
import { createAdRoutes } from './routes/ads';
import { createAnalyticsRoutes } from './routes/analytics';

// Types
import { GuardrailConfig } from './types';

// ============================================================================
// Configuration
// ============================================================================

interface DOOHServiceConfig {
  port?: number;
  cors?: {
    origin?: string | string[];
    credentials?: boolean;
  };
  guardrails?: Partial<GuardrailConfig>;
  rezMind?: {
    endpoint: string;
    apiKey: string;
  };
}

// ============================================================================
// DOOH Service
// ============================================================================

export class DOOHService {
  private app: Express;
  private config: DOOHServiceConfig;

  // Services
  public screenService: ScreenManagementService;
  public adDecisionService: AdDecisionService;
  public areaService: AreaIntelligenceService;
  public personalizationService: PersonalizationService;
  public analyticsService: AnalyticsService;

  constructor(config: DOOHServiceConfig = {}) {
    this.config = config;

    // Initialize services in dependency order
    this.screenService = new ScreenManagementService();
    this.areaService = new AreaIntelligenceService();
    this.analyticsService = new AnalyticsService(this.screenService);
    this.adDecisionService = new AdDecisionService(
      this.screenService,
      this.areaService,
      config.guardrails
    );
    this.personalizationService = new PersonalizationService(
      this.screenService,
      this.areaService
    );

    // Initialize Express app
    this.app = express();

    // Setup middleware
    this.setupMiddleware();

    // Setup routes
    this.setupRoutes();

    // Setup error handling
    this.setupErrorHandling();

    // Connect to ReZ Mind if configured
    if (config.rezMind) {
      this.connectToRezMind(config.rezMind);
    }
  }

  // -------------------------------------------------------------------------
  // Setup
  // -------------------------------------------------------------------------

  private setupMiddleware(): void {
    // CORS
    this.app.use(cors(this.config.cors || {
      origin: '*',
      credentials: true,
    }));

    // Helmet for security headers
    this.app.use(helmet());

    // Body parsing
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true }));

    // Request logging
    this.app.use((req: Request, _res: Response, next: NextFunction) => {
      console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
      next();
    });

    // Health check endpoint
    this.app.get('/health', (_req: Request, res: Response) => {
      res.json({
        status: 'ok',
        service: 'dooh-service',
        version: '1.0.0',
        timestamp: new Date().toISOString(),
      });
    });

    // Ready check
    this.app.get('/ready', (_req: Request, res: Response) => {
      const checks = {
        screenService: true,
        adDecisionService: true,
        areaService: this.areaService.isConnectedToRezMind(),
        personalizationService: true,
        analyticsService: true,
      };

      const allHealthy = Object.values(checks).every(v => v === true);

      res.status(allHealthy ? 200 : 503).json({
        status: allHealthy ? 'ready' : 'degraded',
        checks,
      });
    });
  }

  private setupRoutes(): void {
    // Screen routes
    this.app.use('/api/screens', createScreenRoutes({
      screenService: this.screenService,
      analyticsService: this.analyticsService,
    }));

    // Ad routes
    this.app.use('/api/ads', createAdRoutes({
      adDecisionService: this.adDecisionService,
      personalizationService: this.personalizationService,
      screenService: this.screenService,
      areaService: this.areaService,
    }));

    // Analytics routes
    this.app.use('/api/analytics', createAnalyticsRoutes({
      analyticsService: this.analyticsService,
      screenService: this.screenService,
    }));

    // API root
    this.app.get('/api', (_req: Request, res: Response) => {
      res.json({
        service: 'DOOH Service',
        version: '1.0.0',
        endpoints: {
          screens: '/api/screens',
          ads: '/api/ads',
          analytics: '/api/analytics',
          health: '/health',
          ready: '/ready',
        },
      });
    });
  }

  private setupErrorHandling(): void {
    // 404 handler
    this.app.use((_req: Request, res: Response) => {
      res.status(404).json({
        success: false,
        error: 'Not found',
      });
    });

    // Error handler
    this.app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
      console.error('Error:', err);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? err.message : undefined,
      });
    });
  }

  // -------------------------------------------------------------------------
  // ReZ Mind Integration
  // -------------------------------------------------------------------------

  private async connectToRezMind(config: { endpoint: string; apiKey: string }): Promise<void> {
    try {
      await this.areaService.connectToRezMind(config.endpoint, config.apiKey);
      console.log('Connected to ReZ Mind');
    } catch (error) {
      console.warn('Failed to connect to ReZ Mind:', error);
    }
  }

  // -------------------------------------------------------------------------
  // Server Control
  // -------------------------------------------------------------------------

  start(): Promise<void> {
    return new Promise((resolve) => {
      const port = this.config.port || 3000;
      this.app.listen(port, () => {
        console.log(`DOOH Service started on port ${port}`);
        console.log(`Health check: http://localhost:${port}/health`);
        console.log(`API: http://localhost:${port}/api`);
        resolve();
      });
    });
  }

  stop(): void {
    // Cleanup resources
    this.areaService.disconnectFromRezMind();
    console.log('DOOH Service stopped');
  }

  // -------------------------------------------------------------------------
  // Express App Access
  // -------------------------------------------------------------------------

  getApp(): Express {
    return this.app;
  }
}

// ============================================================================
// Factory Function
// ============================================================================

let serviceInstance: DOOHService | null = null;

export function createDOOHService(config?: DOOHServiceConfig): DOOHService {
  if (!serviceInstance) {
    serviceInstance = new DOOHService(config);
  }
  return serviceInstance;
}

export function getDOOHService(): DOOHService | null {
  return serviceInstance;
}

// ============================================================================
// Standalone Service Runner
// ============================================================================

async function main(): Promise<void> {
  const config: DOOHServiceConfig = {
    port: parseInt(process.env.PORT || '4018'),
    guardrails: {
      min_budget_per_listing: 500,
      min_total_budget: 1000,
      max_cost_per_visit: 50,
    },
    rezMind: process.env.REZ_MIND_ENDPOINT ? {
      endpoint: process.env.REZ_MIND_ENDPOINT,
      apiKey: process.env.REZ_MIND_API_KEY || '',
    } : undefined,
  };

  const service = createDOOHService(config);
  await service.start();
}

// Run if executed directly
if (require.main === module) {
  main().catch(console.error);
}

// ============================================================================
// Re-exports
// ============================================================================

export {
  // Services
  ScreenManagementService,
  AdDecisionService,
  AreaIntelligenceService,
  PersonalizationService,
  AnalyticsService,

  // Routes
  createScreenRoutes,
  createAdRoutes,
  createAnalyticsRoutes,

  // Types
  DOOHServiceConfig,
} from './types';
