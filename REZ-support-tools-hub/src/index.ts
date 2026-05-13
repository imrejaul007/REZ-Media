import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import mongoose from 'mongoose';
import Redis from 'ioredis';
import rateLimit from 'express-rate-limit';

import config, { validatePlatformCredentials } from './config';
import createRouter from './routes';
import { getAuthService } from './services/authService';
import { startSyncWorker, stopSyncWorker } from './workers/syncWorker';

// Initialize Express app
const app: Express = express();

// Middleware
app.use(helmet());
app.use(cors({
  origin: config.security.cors.origin,
  credentials: config.security.cors.credentials,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Rate limiting
const limiter = rateLimit({
  windowMs: config.security.rateLimit.windowMs,
  max: config.security.rateLimit.max,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many requests, please try again later.',
  },
});
app.use(limiter);

// Request logging middleware
app.use((req: Request, _res: Response, next: NextFunction) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
  next();
});

// Health check endpoint (before auth middleware)
app.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    service: 'rez-support-tools-hub',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

// API routes
app.use('/api', createRouter());

// 404 handler
app.use((_req: Request, res: Response) => {
  res.status(404).json({
    error: 'Not Found',
    message: 'The requested endpoint does not exist',
  });
});

// Error handler
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Unhandled error:', err);

  res.status(500).json({
    error: 'Internal Server Error',
    message: config.server.isProduction ? 'An unexpected error occurred' : err.message,
  });
});

// Redis client (for future queue implementation)
let redisClient: Redis | null = null;

async function connectRedis(): Promise<void> {
  try {
    redisClient = new Redis(config.redis.url, {
      keyPrefix: config.redis.keyPrefix,
      retryStrategy: (times: number) => {
        if (times > config.redis.maxRetries) {
          return null;
        }
        return Math.min(times * config.redis.retryDelayMs, 5000);
      },
    });

    redisClient.on('connect', () => {
      console.log('Connected to Redis');
    });

    redisClient.on('error', (error) => {
      console.error('Redis error:', error);
    });

    // Test connection
    await redisClient.ping();
    console.log('Redis connection verified');
  } catch (error) {
    console.warn('Redis connection failed, continuing without Redis:', error);
    redisClient = null;
  }
}

// MongoDB connection
async function connectMongoDB(): Promise<void> {
  try {
    const mongoOptions = {
      maxPoolSize: config.database.mongodb.options.maxPoolSize,
      minPoolSize: config.database.mongodb.options.minPoolSize,
      serverSelectionTimeoutMS: config.database.mongodb.options.serverSelectionTimeoutMS,
      socketTimeoutMS: config.database.mongodb.options.socketTimeoutMS,
    };

    await mongoose.connect(config.database.mongodb.uri, mongoOptions);
    console.log('Connected to MongoDB');

    mongoose.connection.on('error', (error) => {
      console.error('MongoDB error:', error);
    });

    mongoose.connection.on('disconnected', () => {
      console.log('MongoDB disconnected');
    });
  } catch (error) {
    console.error('MongoDB connection failed:', error);
    throw error;
  }
}

// Initialize services
async function initializeServices(): Promise<void> {
  console.log('Initializing services...');

  // Initialize auth service
  const authService = getAuthService();
  const connectionStatuses = authService.getAllConnectionStatuses();

  for (const status of connectionStatuses) {
    if (status.credentials.configured) {
      console.log(`${status.platform} credentials configured`);
    }
  }

  // Validate credentials in production
  if (config.server.isProduction) {
    const validation = validatePlatformCredentials();
    if (!validation.valid) {
      console.warn('Platform credentials not fully configured:', validation.errors);
    }
  }
}

// Graceful shutdown
async function shutdown(): Promise<void> {
  console.log('Shutting down...');

  // Stop sync worker
  stopSyncWorker();

  // Close Redis connection
  if (redisClient) {
    await redisClient.quit();
  }

  // Close MongoDB connection
  await mongoose.connection.close();

  console.log('Shutdown complete');
  process.exit(0);
}

// Handle shutdown signals
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

// Start server
async function start(): Promise<void> {
  try {
    console.log('Starting ReZ Support Tools Hub...');
    console.log(`Environment: ${config.server.nodeEnv}`);
    console.log(`Port: ${config.server.port}`);

    // Connect to databases
    await Promise.all([
      connectMongoDB(),
      connectRedis(),
    ]);

    // Initialize services
    await initializeServices();

    // Start sync worker
    if (!config.server.isProduction || process.env.ENABLE_SYNC_WORKER === 'true') {
      startSyncWorker();
      console.log('Sync worker started');
    }

    // Start HTTP server
    const server = app.listen(config.server.port, () => {
      console.log(`Server listening on port ${config.server.port}`);
      console.log(`Health check: http://localhost:${config.server.port}/health`);
      console.log(`API base: http://localhost:${config.server.port}/api`);
    });

    server.on('error', (error: NodeJS.ErrnoException) => {
      if (error.code === 'EADDRINUSE') {
        console.error(`Port ${config.server.port} is already in use`);
      } else {
        console.error('Server error:', error);
      }
      process.exit(1);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Export app for testing
export { app };

// Start the server
start();
