import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import mongoose from 'mongoose';
import Redis from 'ioredis';
import { config } from 'dotenv';
import winston from 'winston';

// Load environment variables
config();

// Logger setup
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      ),
    }),
  ],
});

// Import routes
import {
  campaignRoutes,
  placementRoutes,
  biddingRoutes,
  serveRoutes,
  eventRoutes,
} from './routes/index.js';

// Import services
import { createBidEngine } from './services/bidEngine.js';
import { createFraudDetectionService } from './services/fraudDetection.js';
import { createAdServer } from './services/adServer.js';

// Import middleware
import { createApiRateLimiter } from './middleware/rateLimit.js';

// Configuration
const PORT = parseInt(process.env.PORT || '3005', 10);
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/rez-ads';
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

// Create Express app
const app: Express = express();

// Initialize Redis
const redis = new Redis(REDIS_URL, {
  maxRetriesPerRequest: 3,
  retryDelayOnFailover: 100,
  lazyConnect: true,
});

redis.on('error', (err) => {
  logger.error('Redis connection error:', err);
});

redis.on('connect', () => {
  logger.info('Connected to Redis');
});

// Initialize services
const bidEngine = createBidEngine(redis);
const fraudDetection = createFraudDetectionService(redis);
const adServer = createAdServer(redis, bidEngine, fraudDetection);

// Store services in app.locals for route access
app.locals.redis = redis;
app.locals.bidEngine = bidEngine;
app.locals.fraudDetection = fraudDetection;
app.locals.adServer = adServer;

// Security middleware
app.use(helmet({
  contentSecurityPolicy: false, // Disable for ad serving
}));

// CORS configuration
const corsOptions: cors.CorsOptions = {
  origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3000'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Internal-Token', 'X-Service-Name'],
};

app.use(cors(corsOptions));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate limiting
app.use('/api/', createApiRateLimiter(redis));

// Request logging
app.use((req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info({
      method: req.method,
      path: req.path,
      status: res.statusCode,
      duration,
      ip: req.ip,
    });
  });

  next();
});

// Health check
app.get('/health', async (req: Request, res: Response) => {
  try {
    // Check MongoDB
    const mongoOk = mongoose.connection.readyState === 1;

    // Check Redis
    let redisOk = false;
    try {
      await redis.ping();
      redisOk = true;
    } catch {
      redisOk = false;
    }

    const healthy = mongoOk && redisOk;

    res.status(healthy ? 200 : 503).json({
      status: healthy ? 'healthy' : 'unhealthy',
      services: {
        mongodb: mongoOk ? 'connected' : 'disconnected',
        redis: redisOk ? 'connected' : 'disconnected',
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      error: 'Service unavailable',
      timestamp: new Date().toISOString(),
    });
  }
});

// Ready check (for Kubernetes readiness probe)
app.get('/ready', async (req: Request, res: Response) => {
  try {
    await redis.ping();
    res.json({ ready: true });
  } catch (error) {
    res.status(503).json({ ready: false });
  }
});

// API routes
app.use('/api/campaigns', campaignRoutes);
app.use('/api/placements', placementRoutes);
app.use('/api/bidding', biddingRoutes);
app.use('/api/serve', serveRoutes);
app.use('/api/events', eventRoutes);

// Ad serving endpoint (simpler path)
app.use('/api/ads', serveRoutes);

// Metrics endpoint
app.get('/metrics', async (req: Request, res: Response) => {
  try {
    const mongoStats = mongoose.connection.readyState === 1
      ? await mongoose.connection.db?.admin().serverStatus()
      : null;

    const redisInfo = await redis.info();

    res.json({
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      cpu: process.cpuUsage(),
      mongodb: mongoStats ? {
        connections: mongoStats.connections,
        opcounters: mongoStats.opcounters,
      } : null,
      redis: {
        connected: redis.connection?.offset > 0,
        info: redisInfo,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to collect metrics',
      timestamp: new Date().toISOString(),
    });
  }
});

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({
    error: 'Not Found',
    path: req.path,
  });
});

// Error handler
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  logger.error({
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
  });

  res.status(500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined,
  });
});

// Graceful shutdown
async function shutdown() {
  logger.info('Shutting down...');

  try {
    await redis.quit();
    await mongoose.connection.close();
    logger.info('Connections closed');
    process.exit(0);
  } catch (error) {
    logger.error('Error during shutdown:', error);
    process.exit(1);
  }
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

// Start server
async function start() {
  try {
    // Connect to MongoDB
    logger.info('Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    logger.info('Connected to MongoDB');

    // Connect to Redis
    await redis.connect();

    // Start listening
    app.listen(PORT, () => {
      logger.info(`REZ-Ads server running on port ${PORT}`);
      logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

start();

export default app;
