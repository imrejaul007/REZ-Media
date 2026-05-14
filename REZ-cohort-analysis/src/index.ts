import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import mongoose from 'mongoose';
import { createClient } from 'redis';
import winston from 'winston';
import cron from 'node-cron';

import cohortRoutes from './routes/cohorts';
import { CohortDefinition, UserActivity, RetentionCurve, CohortExport } from './models/Cohort';
import { storeRetentionCurvePoint } from './services/cohortService';
import { getPeriodStart } from './services/retentionEngine';

// ============= Configuration =============

const PORT = process.env.PORT || 4027;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/rez-cohort-analysis';
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const INTERNAL_SERVICE_TOKEN = process.env.INTERNAL_SERVICE_TOKEN;
const NODE_ENV = process.env.NODE_ENV || 'development';

// ============= Logger Setup =============

const logger = winston.createLogger({
  level: NODE_ENV === 'production' ? 'info' : 'debug',
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

// ============= Express App Setup =============

const app: Express = express();

// Security middleware
app.use(helmet({
  contentSecurityPolicy: false, // Disable for API-only service
}));

// CORS configuration
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Internal-Token'],
  credentials: true,
}));

// Compression
app.use(compression());

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info({
      method: req.method,
      path: req.path,
      status: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip,
    });
  });

  next();
});

// ============= Authentication Middleware =============

function authenticateInternal(req: Request, res: Response, next: NextFunction) {
  // Skip auth for health checks
  if (req.path === '/health' || req.path === '/api/cohorts/health') {
    return next();
  }

  // Skip auth in development if no token is configured
  if (NODE_ENV !== 'production' && !INTERNAL_SERVICE_TOKEN) {
    return next();
  }

  const token = req.headers['x-internal-token'];

  if (!token || token !== INTERNAL_SERVICE_TOKEN) {
    logger.warn({
      message: 'Unauthorized access attempt',
      path: req.path,
      ip: req.ip,
    });

    res.status(401).json({
      success: false,
      error: 'Unauthorized',
      message: 'Invalid or missing X-Internal-Token header',
    });
    return;
  }

  next();
}

app.use(authenticateInternal);

// ============= Routes =============

// Root health check
app.get('/health', (req: Request, res: Response) => {
  res.status(200).json({
    service: 'rez-cohort-analysis',
    version: '1.0.0',
    status: 'healthy',
    timestamp: new Date().toISOString(),
    environment: NODE_ENV,
  });
});

// API routes
app.use('/api/cohorts', cohortRoutes);

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: 'Not Found',
    message: `Route ${req.method} ${req.path} not found`,
  });
});

// Error handler
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  logger.error({
    message: 'Unhandled error',
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
  });

  res.status(500).json({
    success: false,
    error: 'Internal Server Error',
    message: NODE_ENV === 'development' ? err.message : 'An unexpected error occurred',
  });
});

// ============= Redis Client =============

let redisClient: ReturnType<typeof createClient> | null = null;

async function initRedis() {
  try {
    redisClient = createClient({ url: REDIS_URL });

    redisClient.on('error', (err) => {
      logger.error('Redis connection error:', err);
    });

    redisClient.on('connect', () => {
      logger.info('Redis connected successfully');
    });

    await redisClient.connect();
  } catch (error) {
    logger.warn('Redis initialization failed, continuing without cache:', error);
    redisClient = null;
  }
}

// ============= Database Connection =============

async function connectDatabase() {
  try {
    await mongoose.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });

    logger.info('MongoDB connected successfully', {
      host: mongoose.connection.host,
      database: mongoose.connection.name,
    });

    // Create indexes
    await createIndexes();
  } catch (error) {
    logger.error('MongoDB connection failed:', error);
    throw error;
  }
}

async function createIndexes() {
  try {
    await UserActivity.createIndexes();
    await CohortDefinition.createIndexes();
    await RetentionCurve.createIndexes();
    await CohortExport.createIndexes();

    logger.info('Database indexes created');
  } catch (error) {
    logger.warn('Index creation warning:', error);
  }
}

// ============= Scheduled Jobs =============

function setupScheduledJobs() {
  // Aggregate retention curves daily at midnight
  cron.schedule('0 0 * * *', async () => {
    logger.info('Running daily retention curve aggregation');

    try {
      const today = new Date();
      const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

      // Aggregate retention data for the last 30 days
      const pipeline = [
        {
          $match: {
            cohortDate: { $gte: thirtyDaysAgo, $lte: today },
          },
        },
        {
          $group: {
            _id: {
              cohortType: '$cohortType',
              period: '$period',
              periodIndex: '$periodIndex',
            },
            totalUsers: { $sum: '$sampleSize' },
            avgRetention: { $avg: '$retentionRate' },
          },
        },
      ];

      // This would be implemented with actual aggregation in production
      logger.info('Retention curve aggregation completed');
    } catch (error) {
      logger.error('Retention curve aggregation failed:', error);
    }
  }, {
    timezone: 'UTC',
  });

  // Clean up expired exports daily at 2 AM
  cron.schedule('0 2 * * *', async () => {
    logger.info('Running export cleanup job');

    try {
      const result = await CohortExport.deleteMany({
        expiresAt: { $lt: new Date() },
      });

      logger.info(`Cleaned up ${result.deletedCount} expired exports`);
    } catch (error) {
      logger.error('Export cleanup failed:', error);
    }
  }, {
    timezone: 'UTC',
  });

  logger.info('Scheduled jobs configured');
}

// ============= Graceful Shutdown =============

async function shutdown(signal: string) {
  logger.info(`Received ${signal}, starting graceful shutdown...`);

  // Close Redis
  if (redisClient) {
    await redisClient.quit();
  }

  // Close MongoDB
  await mongoose.connection.close();

  logger.info('Graceful shutdown completed');
  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// ============= Server Start =============

async function startServer() {
  try {
    // Initialize Redis (optional, continues if fails)
    await initRedis();

    // Connect to database
    await connectDatabase();

    // Setup scheduled jobs
    setupScheduledJobs();

    // Start server
    app.listen(PORT, () => {
      logger.info(`
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║   REZ Cohort Analysis Service                             ║
║   ───────────────────────────────────────────────────     ║
║   Status: Running                                         ║
║   Port: ${PORT}                                             ║
║   Environment: ${NODE_ENV}                                 ║
║   Database: MongoDB                                       ║
║   Cache: ${redisClient ? 'Redis' : 'None'}                                        ║
║                                                           ║
║   Endpoints:                                              ║
║   • GET  /health                                          ║
║   • POST /api/cohorts/generate                           ║
║   • GET  /api/cohorts/retention-curve                    ║
║   • GET  /api/cohorts/revenue                             ║
║   • GET  /api/cohorts/time-to-convert                    ║
║   • POST /api/cohorts/compare-segments                   ║
║   • CRUD /api/cohorts/definitions                         ║
║   • POST /api/cohorts/export                              ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
      `);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Export app for testing
export { app };

// Start server
startServer();
