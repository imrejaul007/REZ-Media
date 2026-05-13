/**
 * Main Entry Point for Prompt-to-Workflow AI Service
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import mongoose from 'mongoose';
import { createClient } from 'redis';

import config from './config';
import routes from './routes';
import logger from './utils/logger';
import { GeneratedWorkflow } from './models/GeneratedWorkflow';

const app = express();

// Trust proxy for rate limiting behind reverse proxy
app.set('trust proxy', 1);

// Security middleware
app.use(helmet());
app.use(cors());

// Body parsing
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// Rate limiting
const limiter = rateLimit({
  windowMs: config.rateLimitWindowMs,
  max: config.rateLimitRequests,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: 'RATE_LIMITED',
      message: 'Too many requests, please try again later.',
    },
  },
});
app.use(limiter);

// Request logging
app.use((req, _res, next) => {
  logger.info(`${req.method} ${req.path}`, {
    ip: req.ip,
    userAgent: req.get('user-agent'),
  });
  next();
});

// API routes
app.use('/api', routes);

// Root endpoint
app.get('/', (_req, res) => {
  res.json({
    service: 'REZ Prompt-to-Workflow AI',
    version: '1.0.0',
    description: 'Generate workflows from natural language using AI',
    endpoints: {
      generate: 'POST /api/generate',
      'generate/step': 'POST /api/generate/step',
      validate: 'POST /api/validate',
      optimize: 'POST /api/optimize',
      templates: 'GET /api/templates',
      'templates/:id': 'GET /api/templates/:id',
      'templates/from-prompt': 'POST /api/templates/from-prompt',
      import: 'POST /api/journeys/import',
      health: 'GET /api/health',
      metrics: 'GET /api/metrics',
    },
    documentation: '/api/docs',
  });
});

// 404 handler
app.use((_req, res) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: 'Endpoint not found',
    },
  });
});

// Redis client (optional)
let redisClient: ReturnType<typeof createClient> | null = null;

async function connectRedis(): Promise<void> {
  if (!config.redisEnabled) {
    logger.info('Redis disabled, skipping connection');
    return;
  }

  try {
    redisClient = createClient({ url: config.redisUrl });
    redisClient.on('error', (err) => {
      logger.error('Redis error', { error: err });
    });
    redisClient.on('connect', () => {
      logger.info('Connected to Redis');
    });
    await redisClient.connect();
  } catch (error) {
    logger.warn('Failed to connect to Redis, continuing without cache', { error });
  }
}

// MongoDB connection
async function connectMongoDB(): Promise<void> {
  try {
    await mongoose.connect(config.mongodbUri, {
      maxPoolSize: config.mongodbOptions.maxPoolSize,
      serverSelectionTimeoutMS: config.mongodbOptions.serverSelectionTimeoutMS,
    });
    logger.info('Connected to MongoDB');
  } catch (error) {
    logger.error('Failed to connect to MongoDB', { error });
    throw error;
  }
}

// Graceful shutdown
async function shutdown(): Promise<void> {
  logger.info('Shutting down...');

  try {
    if (redisClient) {
      await redisClient.quit();
    }
    await mongoose.connection.close();
    logger.info('Connections closed');
  } catch (error) {
    logger.error('Error during shutdown', { error });
  }

  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

// Start server
async function start(): Promise<void> {
  try {
    // Connect to MongoDB
    await connectMongoDB();

    // Connect to Redis (optional)
    await connectRedis();

    // Start HTTP server
    app.listen(config.port, () => {
      logger.info(`Server started on port ${config.port}`);
      logger.info(`Environment: ${config.nodeEnv}`);
      logger.info(`OpenAI Model: ${config.openaiModel}`);
    });
  } catch (error) {
    logger.error('Failed to start server', { error });
    process.exit(1);
  }
}

start();

export { app };
