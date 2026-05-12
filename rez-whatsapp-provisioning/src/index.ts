import express, { Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';

import { validateTwilioConfig, rateLimitConfig } from './config/twilio.config';
import { initializeServiceTokens } from './middleware/auth';
import { errorHandler, notFoundHandler } from './middleware/error';
import { logger } from './utils/logger';

import provisionRoutes from './routes/provision.routes';
import numberRoutes from './routes/number.routes';
import templateRoutes from './routes/template.routes';
import webhookRoutes from './routes/webhook.routes';

dotenv.config();

const app: Express = express();
const PORT = process.env.PORT || 3005;

app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
}));

const corsOrigins = process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000'];
app.use(cors({
  origin: corsOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Internal-Token'],
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

const limiter = rateLimit({
  windowMs: rateLimitConfig.windowMs,
  max: rateLimitConfig.maxRequests,
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests, please try again later.',
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api/', limiter);

app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'rez-whatsapp-provisioning',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
  });
});

app.get('/ready', async (req, res) => {
  try {
    const mongoState = mongoose.connection.readyState;
    const mongoReady = mongoState === 1;

    if (!mongoReady) {
      res.status(503).json({
        status: 'not ready',
        checks: {
          mongodb: mongoState === 1 ? 'connected' : 'disconnected',
        },
      });
      return;
    }

    res.json({
      status: 'ready',
      checks: {
        mongodb: 'connected',
      },
    });
  } catch (error) {
    res.status(503).json({
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

app.use('/api/v1/provision', provisionRoutes);
app.use('/api/v1/numbers', numberRoutes);
app.use('/api/v1/templates', templateRoutes);
app.use('/webhooks', webhookRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

async function connectToMongoDB(): Promise<void> {
  const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/rez_whatsapp_provisioning';

  try {
    await mongoose.connect(mongoUri, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });

    logger.info('Connected to MongoDB', { uri: mongoUri.replace(/\/\/.*@/, '//<credentials>@') });
  } catch (error) {
    logger.error('Failed to connect to MongoDB', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
}

mongoose.connection.on('error', (error) => {
  logger.error('MongoDB connection error', { error: error.message });
});

mongoose.connection.on('disconnected', () => {
  logger.warn('MongoDB disconnected');
});

mongoose.connection.on('reconnected', () => {
  logger.info('MongoDB reconnected');
});

async function startServer(): Promise<void> {
  try {
    validateTwilioConfig();
    logger.info('Twilio configuration validated');

    initializeServiceTokens();

    await connectToMongoDB();

    app.listen(PORT, () => {
      logger.info(`Server started`, {
        port: PORT,
        nodeEnv: process.env.NODE_ENV || 'development',
        baseUrl: process.env.WEBHOOK_BASE_URL || `http://localhost:${PORT}`,
      });

      logger.info('API Routes:', {
        'POST /api/v1/provision/provision': 'Provision WhatsApp for merchant',
        'GET /api/v1/provision/:merchantId': 'Get merchant WhatsApp details',
        'PATCH /api/v1/provision/:merchantId/suspend': 'Suspend merchant WhatsApp',
        'PATCH /api/v1/provision/:merchantId/activate': 'Activate merchant WhatsApp',
        'DELETE /api/v1/provision/:merchantId': 'Close merchant WhatsApp',
        'GET /api/v1/provision/:merchantId/usage': 'Get merchant usage stats',
        'POST /api/v1/provision/:merchantId/regenerate-credentials': 'Regenerate API credentials',
        'POST /api/v1/numbers/search': 'Search available phone numbers',
        'POST /api/v1/numbers/provision': 'Provision a phone number',
        'GET /api/v1/numbers/:merchantId': 'List merchant phone numbers',
        'GET /api/v1/numbers/:merchantId/:sid': 'Get phone number details',
        'PATCH /api/v1/numbers/:merchantId/:sid': 'Update phone number',
        'DELETE /api/v1/numbers/:merchantId/:sid': 'Release phone number',
        'POST /api/v1/numbers/:merchantId/:sid/sandbox': 'Add number to sandbox',
        'POST /api/v1/templates': 'Create a template',
        'GET /api/v1/templates/merchant/:merchantId': 'List merchant templates',
        'GET /api/v1/templates/merchant/:merchantId/approved': 'List approved templates',
        'GET /api/v1/templates/:sid': 'Get template details',
        'PATCH /api/v1/templates/:merchantId/:name': 'Update template',
        'DELETE /api/v1/templates/:merchantId/:sid': 'Delete template',
        'POST /webhooks/whatsapp/inbound': 'Inbound message webhook',
        'POST /webhooks/whatsapp/status': 'Message status webhook',
        'POST /webhooks/whatsapp/outbound': 'Outbound webhook',
        'POST /webhooks/whatsapp/template': 'Template status webhook',
        'GET /webhooks/events': 'Get event history',
        'GET /webhooks/events/:id': 'Get event details',
      });
    });
  } catch (error) {
    logger.error('Failed to start server', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    process.exit(1);
  }
}

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection', {
    reason: reason instanceof Error ? reason.message : String(reason),
    promise: String(promise),
  });
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception', {
    error: error.message,
    stack: error.stack,
  });
  process.exit(1);
});

process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  try {
    await mongoose.connection.close();
    logger.info('MongoDB connection closed');
    process.exit(0);
  } catch (error) {
    logger.error('Error during shutdown', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    process.exit(1);
  }
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully');
  try {
    await mongoose.connection.close();
    logger.info('MongoDB connection closed');
    process.exit(0);
  } catch (error) {
    logger.error('Error during shutdown', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    process.exit(1);
  }
});

startServer();

export default app;
