import express, { Express } from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import Redis from 'ioredis';
import rateLimit from 'express-rate-limit';

import { config, validateConfig } from './config/index.js';
import routes from './routes/index.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { authService } from './services/authService.js';
import { syncService } from './services/syncService.js';

// Initialize Redis client (optional)
let redisClient: Redis | null = null;

async function initializeRedis(): Promise<void> {
  if (!config.redis.url) {
    console.warn('Redis URL not configured. Running without Redis.');
    return;
  }

  try {
    redisClient = new Redis(config.redis.url, {
      lazyConnect: true,
      maxRetriesPerRequest: 3,
    });

    await redisClient.connect();
    console.log('Redis connected successfully');
  } catch (error) {
    console.warn('Redis connection failed. Running without Redis:', error);
    redisClient = null;
  }
}

// Initialize MongoDB connection
async function initializeDatabase(): Promise<void> {
  try {
    await mongoose.connect(config.mongodb.uri, config.mongodb.options);
    console.log('MongoDB connected successfully');
  } catch (error) {
    console.error('MongoDB connection failed:', error);
    throw error;
  }
}

// Initialize Express app
function createApp(): Express {
  const app = express();

  // CORS configuration
  app.use(cors({
    origin: true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Internal-Token'],
  }));

  // Body parsing
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));

  // Rate limiting
  const limiter = rateLimit({
    windowMs: config.rateLimit.windowMs,
    max: config.rateLimit.max,
    message: {
      success: false,
      error: 'Too many requests, please try again later',
    },
    standardHeaders: true,
    legacyHeaders: false,
  });
  app.use(limiter);

  // Request logging (simple)
  app.use((req, _res, next) => {
    const start = Date.now();
    _res.on('finish', () => {
      const duration = Date.now() - start;
      console.log(`${req.method} ${req.path} ${_res.statusCode} ${duration}ms`);
    });
    next();
  });

  // Trust proxy (for rate limiting behind reverse proxy)
  app.set('trust proxy', 1);

  // Health check at root
  app.get('/', (_req, res) => {
    res.json({
      success: true,
      service: 'REZ CRM Hub',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
    });
  });

  // API routes
  app.use('/api', routes);

  // Error handling
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

// Graceful shutdown handler
async function gracefulShutdown(signal: string): Promise<void> {
  console.log(`Received ${signal}. Starting graceful shutdown...`);

  // Stop the sync scheduler
  syncService.stopScheduler();

  // Close Redis connection
  if (redisClient) {
    await redisClient.quit();
  }

  // Close MongoDB connection
  await mongoose.connection.close();

  console.log('Graceful shutdown completed');
  process.exit(0);
}

// Main startup function
async function main(): Promise<void> {
  try {
    // Validate configuration
    validateConfig();

    console.log('Starting REZ CRM Hub service...');
    console.log(`Environment: ${config.nodeEnv}`);

    // Initialize Redis
    await initializeRedis();

    // Initialize Database
    await initializeDatabase();

    // Initialize client tokens from database
    await authService.initializeClientTokens();

    // Create Express app
    const app = createApp();

    // Start sync scheduler
    syncService.startScheduler();

    // Start server
    const server = app.listen(config.port, () => {
      console.log(`REZ CRM Hub listening on port ${config.port}`);
      console.log(`Health check: http://localhost:${config.port}/api/health`);
    });

    // Graceful shutdown handlers
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      console.error('Uncaught Exception:', error);
      gracefulShutdown('uncaughtException');
    });

    process.on('unhandledRejection', (reason, promise) => {
      console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    });

    // Export server for testing
    void server; // Suppress unused variable warning
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Start the application
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

export default main;
