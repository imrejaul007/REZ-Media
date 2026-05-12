/**
 * REZ Voice Billing Service - Main Entry Point
 *
 * Express server that handles:
 * - Call session tracking and lifecycle management
 * - Credit balance management via REZ Media Wallet integration
 * - Billing and payment processing
 * - Usage analytics and reporting
 */

import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import mongoose from 'mongoose';
import Redis from 'ioredis';
import { Queue, Worker } from 'bullmq';

import { getConfig, getMongoConfig, getRedisConfig, getServerConfig, getQueueConfig } from './config';
import { logger } from './utils/logger';
import { billingService } from './services/billingService';

// Routes
import callRoutes from './routes/call.routes';
import usageRoutes from './routes/usage.routes';
import analyticsRoutes from './routes/analytics.routes';

// Initialize express app
const app: Express = express();

// Get configuration
const config = getConfig();
const mongoConfig = getMongoConfig();
const redisConfig = getRedisConfig();
const serverConfig = getServerConfig();
const queueConfig = getQueueConfig();

// Middleware
app.use(helmet());
app.use(cors());
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logging middleware
app.use((req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info('Request processed', {
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
    });
  });
  next();
});

// Health check endpoint
app.get('/health', async (req: Request, res: Response) => {
  const health = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'rez-voice-billing',
    version: '1.0.0',
    uptime: process.uptime(),
    checks: {
      mongodb: 'unknown',
      redis: 'unknown',
    },
  };

  try {
    // Check MongoDB
    health.checks.mongodb = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
  } catch {
    health.checks.mongodb = 'error';
  }

  try {
    // Check Redis
    const redis = new Redis(redisConfig.url, { maxRetriesPerRequest: 1 });
    await redis.ping();
    await redis.quit();
    health.checks.redis = 'connected';
  } catch {
    health.checks.redis = 'error';
  }

  const isHealthy = health.checks.mongodb === 'connected' && health.checks.redis === 'connected';
  res.status(isHealthy ? 200 : 503).json({
    ...health,
    status: isHealthy ? 'ok' : 'degraded',
  });
});

// Readiness endpoint
app.get('/ready', async (req: Request, res: Response) => {
  const isReady = mongoose.connection.readyState === 1;
  res.status(isReady ? 200 : 503).json({
    ready: isReady,
    timestamp: new Date().toISOString(),
  });
});

// Liveness endpoint
app.get('/live', (req: Request, res: Response) => {
  res.json({ alive: true, timestamp: new Date().toISOString() });
});

// API Routes
app.use('/api/v1/calls', callRoutes);
app.use('/api/v1/usage', usageRoutes);
app.use('/api/v1/analytics', analyticsRoutes);

// Aliases for common paths
app.use('/calls', callRoutes);
app.use('/usage', usageRoutes);
app.use('/analytics', analyticsRoutes);

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
    path: req.path,
  });
});

// Error handler
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  logger.error('Unhandled error', {
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
  });

  res.status(500).json({
    success: false,
    error: serverConfig.isProduction ? 'Internal server error' : err.message,
  });
});

// MongoDB connection
async function connectMongoDB(): Promise<void> {
  try {
    const uri = mongoConfig.uri;
    logger.info('Connecting to MongoDB...', { uri: uri.replace(/\/\/.*@/, '//<credentials>@') });

    await mongoose.connect(uri, {
      maxPoolSize: mongoConfig.options.maxPoolSize,
      minPoolSize: mongoConfig.options.minPoolSize,
      serverSelectionTimeoutMS: mongoConfig.options.serverSelectionTimeoutMS,
      socketTimeoutMS: mongoConfig.options.socketTimeoutMS,
    });

    logger.info('MongoDB connected successfully');

    mongoose.connection.on('error', (err) => {
      logger.error('MongoDB connection error', { error: err.message });
    });

    mongoose.connection.on('disconnected', () => {
      logger.warn('MongoDB disconnected');
    });

    mongoose.connection.on('reconnected', () => {
      logger.info('MongoDB reconnected');
    });
  } catch (error) {
    logger.error('Failed to connect to MongoDB', { error });
    throw error;
  }
}

// Redis connection
let redisClient: Redis;

function connectRedis(): void {
  redisClient = new Redis(redisConfig.url, {
    maxRetriesPerRequest: redisConfig.maxRetriesPerRequest,
    enableReadyCheck: redisConfig.enableReadyCheck,
    retryStrategy: redisConfig.retryStrategy,
  });

  redisClient.on('connect', () => {
    logger.info('Redis connected successfully');
  });

  redisClient.on('error', (err) => {
    logger.error('Redis connection error', { error: err.message });
  });

  redisClient.on('close', () => {
    logger.warn('Redis connection closed');
  });
}

// Billing queue
let billingQueue: Queue;
let billingWorker: Worker;

async function initializeBillingQueue(): Promise<void> {
  billingQueue = new Queue('voice-billing', {
    connection: redisClient,
    defaultJobOptions: queueConfig.defaultJobOptions,
  });

  billingWorker = new Worker(
    'voice-billing',
    async (job) => {
      const { sessionId } = job.data;
      logger.info('Processing billing job', { jobId: job.id, sessionId });

      const result = await billingService.processCallBilling(sessionId);

      if (!result.success) {
        throw new Error(result.error || 'Billing failed');
      }

      return result.data;
    },
    {
      connection: redisClient,
      concurrency: queueConfig.concurrency,
    }
  );

  billingWorker.on('completed', (job) => {
    logger.info('Billing job completed', { jobId: job.id });
  });

  billingWorker.on('failed', (job, err) => {
    logger.error('Billing job failed', { jobId: job?.id, error: err.message });
  });

  logger.info('Billing queue initialized', { concurrency: queueConfig.concurrency });
}

// Graceful shutdown
async function gracefulShutdown(signal: string): Promise<void> {
  logger.info(`Received ${signal}. Starting graceful shutdown...`);

  // Stop accepting new requests
  // In a real implementation, we'd stop the HTTP server here

  try {
    // Close billing worker
    if (billingWorker) {
      await billingWorker.close();
      logger.info('Billing worker closed');
    }

    // Close billing queue
    if (billingQueue) {
      await billingQueue.close();
      logger.info('Billing queue closed');
    }

    // Close Redis
    if (redisClient) {
      await redisClient.quit();
      logger.info('Redis connection closed');
    }

    // Close MongoDB
    await mongoose.connection.close();
    logger.info('MongoDB connection closed');

    logger.info('Graceful shutdown completed');
    process.exit(0);
  } catch (error) {
    logger.error('Error during graceful shutdown', { error });
    process.exit(1);
  }
}

// Process signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Unhandled rejection handler
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection', { reason, promise });
});

// Uncaught exception handler
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception', { error: error.message, stack: error.stack });
  process.exit(1);
});

// Start server
async function startServer(): Promise<void> {
  try {
    // Connect to MongoDB
    await connectMongoDB();

    // Connect to Redis
    connectRedis();

    // Initialize billing queue
    await initializeBillingQueue();

    // Start HTTP server
    app.listen(serverConfig.port, serverConfig.host, () => {
      logger.info(`REZ Voice Billing Service started`, {
        host: serverConfig.host,
        port: serverConfig.port,
        nodeEnv: serverConfig.nodeEnv,
        pid: process.pid,
      });
      logger.info(`Health check: http://${serverConfig.host}:${serverConfig.port}/health`);
      logger.info(`API endpoints:`);
      logger.info(`  - Calls: /api/v1/calls`);
      logger.info(`  - Usage: /api/v1/usage`);
      logger.info(`  - Analytics: /api/v1/analytics`);
    });
  } catch (error) {
    logger.error('Failed to start server', { error });
    process.exit(1);
  }
}

// Start
startServer();

// Export for testing
export { app };
