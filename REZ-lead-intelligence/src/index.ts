/**
 * Lead Intelligence Service
 * Main entry point
 *
 * Detects hot/warm/cold leads based on user behavior:
 * - Scores users based on signals (searches, carts, views, activity)
 * - Detects abandoned carts and searches
 * - Sends signals to ReZ Mind for learning
 * - Integrates with marketing for channel selection
 */

import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import mongoose from 'mongoose';
import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import nodeCron from 'node-cron';

import config from './config';
import routes from './routes';
import { errorHandler, notFoundHandler, requestLogger, validationErrorHandler } from './middleware';
import { logger } from '@rez/shared';
import { leadIntelligenceService } from './services/LeadIntelligenceService';
import { marketingIntegration } from './integrations/marketingIntegration';

// ============================================================================
// Express App Setup
// ============================================================================

const app: Application = express();

// Trust proxy (for load balancers)
app.set('trust proxy', 1);

// Security middleware
app.use(helmet());
app.use(cors({
  origin: config.cors.origin,
  methods: config.cors.methods,
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID', 'X-Service-Token'],
}));

// Compression
app.use(compression());

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging
app.use(morgan('combined', { stream: { write: (message) => logger.info(message.trim()) } }));

// Request ID middleware
app.use((req, res, next) => {
  req.headers['x-request-id'] = req.headers['x-request-id'] || generateRequestId();
  res.setHeader('X-Request-ID', req.headers['x-request-id']);
  next();
});

// Request logger middleware
app.use(requestLogger);

// ============================================================================
// Swagger Documentation
// ============================================================================

const swaggerOptions: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Lead Intelligence Service API',
      version: '1.0.0',
      description: 'API for lead scoring, abandoned cart/search detection, and re-engagement',
    },
    servers: [
      {
        url: `http://localhost:${config.port}`,
        description: 'Development server',
      },
    ],
    tags: [
      { name: 'Leads', description: 'Lead score endpoints' },
      { name: 'Carts', description: 'Abandoned cart endpoints' },
      { name: 'Searches', description: 'Abandoned search endpoints' },
      { name: 'Channels', description: 'Channel recommendation endpoints' },
      { name: 'Re-Engagement', description: 'Re-engagement endpoints' },
      { name: 'Activity', description: 'User activity tracking endpoints' },
      { name: 'Health', description: 'Health check endpoints' },
    ],
  },
  apis: ['./src/routes/*.ts'],
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'Lead Intelligence API Docs',
}));

// ============================================================================
// API Routes
// ============================================================================

app.use('/api/v1', routes);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    service: 'Lead Intelligence Service',
    version: '1.0.0',
    description: 'Hot/Warm/Cold lead detection and re-engagement',
    documentation: '/api-docs',
    health: '/api/v1/health',
  });
});

// Health check endpoint
app.get('/api/v1/health', (req, res) => {
  const mongoStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';

  res.json({
    status: 'healthy',
    service: 'lead-intelligence',
    timestamp: new Date().toISOString(),
    mongodb: mongoStatus,
  });
});

// Readiness check
app.get('/api/v1/ready', async (req, res) => {
  try {
    // Check MongoDB connection
    await mongoose.connection.db?.admin().ping();

    res.json({
      status: 'ready',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(503).json({
      status: 'not_ready',
      error: 'Database connection failed',
    });
  }
});

// Validation error handler
app.use(validationErrorHandler);

// 404 handler
app.use(notFoundHandler);

// Error handler
app.use(errorHandler);

// ============================================================================
// Cron Jobs
// ============================================================================

/**
 * Process hot leads every hour
 */
nodeCron.schedule('0 * * * *', async () => {
  logger.info('[Cron] Processing hot leads batch');
  try {
    const result = await leadIntelligenceService.processHotLeadsBatch();
    logger.info('[Cron] Hot leads batch completed', result);
  } catch (error) {
    logger.error('[Cron] Hot leads batch failed', error);
  }
});

/**
 * Sync leads to marketing every hour
 * Creates campaigns for hot (WhatsApp), warm (Push), and cold (Email) leads
 */
nodeCron.schedule('5 * * * *', async () => {
  logger.info('[Cron] Syncing leads to marketing');
  try {
    const result = await marketingIntegration.syncLeadsToMarketing();
    logger.info('[Cron] Marketing sync completed', {
      totalProcessed: result.totalProcessed,
      totalErrors: result.totalErrors,
      hotCampaign: result.hotLeads.campaignId,
      warmCampaign: result.warmLeads.campaignId,
      coldCampaign: result.coldLeads.campaignId,
    });
  } catch (error) {
    logger.error('[Cron] Marketing sync failed', error);
  }
});

/**
 * Process abandoned carts every 4 hours
 */
nodeCron.schedule('0 */4 * * *', async () => {
  logger.info('[Cron] Processing abandoned carts batch');
  try {
    const result = await leadIntelligenceService.processAbandonedCartsBatch();
    logger.info('[Cron] Abandoned carts batch completed', result);
  } catch (error) {
    logger.error('[Cron] Abandoned carts batch failed', error);
  }
});

/**
 * Generate request ID
 */
function generateRequestId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}

// ============================================================================
// MongoDB Connection
// ============================================================================

async function connectToMongoDB(): Promise<void> {
  try {
    const mongoUri = `${config.mongodb.uri}/${config.mongodb.db}`;

    await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });

    logger.info('Connected to MongoDB', { database: config.mongodb.db });
  } catch (error) {
    logger.error('Failed to connect to MongoDB', error);
    throw error;
  }
}

// ============================================================================
// Server Start
// ============================================================================

async function startServer(): Promise<void> {
  try {
    // Connect to MongoDB
    await connectToMongoDB();

    // Start listening
    app.listen(config.port, () => {
      logger.info(`Lead Intelligence Service started`, {
        port: config.port,
        environment: config.nodeEnv,
        mongodb: config.mongodb.db,
        docs: `http://localhost:${config.port}/api-docs`,
      });
    });

    // Graceful shutdown
    process.on('SIGTERM', gracefulShutdown);
    process.on('SIGINT', gracefulShutdown);
  } catch (error) {
    logger.error('Failed to start server', error);
    process.exit(1);
  }
}

/**
 * Graceful shutdown
 */
async function gracefulShutdown(): Promise<void> {
  logger.info('Received shutdown signal, closing connections...');

  try {
    await mongoose.connection.close();
    logger.info('MongoDB connection closed');

    process.exit(0);
  } catch (error) {
    logger.error('Error during shutdown', error);
    process.exit(1);
  }
}

// Start the server
startServer();

export default app;
