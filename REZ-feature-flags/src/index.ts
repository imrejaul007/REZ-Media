import express, { Express, Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import helmet from 'helmet';
import { createClient } from 'redis';
import flagsRouter from './routes/flags';
import { FlagService } from './services/flagService';
import { createFlagMiddleware } from './middleware/flagMiddleware';

// Environment variables with defaults
const PORT = process.env.PORT || 4035;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/rez-feature-flags';
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const INTERNAL_SERVICE_TOKEN = process.env.INTERNAL_SERVICE_TOKEN;
const NODE_ENV = process.env.NODE_ENV || 'development';

// Create Express app
const app: Express = express();

// Trust proxy for rate limiting behind load balancer
app.set('trust proxy', 1);

// Security middleware
app.use(helmet({
  contentSecurityPolicy: false, // Disable for API
}));

// CORS configuration
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Internal-Token',
    'X-User-Id',
    'X-Environment',
    'X-User-Attributes',
  ],
  credentials: true,
}));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`${req.method} ${req.path} ${res.statusCode} ${duration}ms`);
  });
  next();
});

// Health check endpoint (no auth required)
app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    service: 'rez-feature-flags',
    timestamp: new Date().toISOString(),
    environment: NODE_ENV,
    mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
  });
});

// Authentication middleware for internal routes
const authenticateInternal = (req: Request, res: Response, next: NextFunction) => {
  // Skip auth in development if no token is configured
  if (NODE_ENV === 'development' && !INTERNAL_SERVICE_TOKEN) {
    return next();
  }

  const token = req.headers['x-internal-token'];

  if (!token || token !== INTERNAL_SERVICE_TOKEN) {
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid or missing X-Internal-Token header',
    });
    return;
  }

  next();
};

// Apply authentication to API routes
app.use('/api', authenticateInternal);

// Initialize Flag Service
let flagService: FlagService;

// Initialize Redis client (optional)
let redisClient: any = null;

async function initRedis(): Promise<void> {
  try {
    redisClient = createClient({ url: REDIS_URL });
    redisClient.on('error', (err) => console.error('Redis Client Error:', err));
    redisClient.on('connect', () => console.log('Redis connected'));
    await redisClient.connect();
    console.log('Redis initialization complete');
  } catch (error) {
    console.warn('Redis connection failed, continuing without cache:', error);
    redisClient = null;
  }
}

// Initialize MongoDB and services
async function initialize(): Promise<void> {
  try {
    // Connect to MongoDB
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('MongoDB connected');

    // Initialize Redis (optional)
    await initRedis();

    // Initialize flag service
    flagService = new FlagService(redisClient);

    // Initialize routes with flag service
    initRoutes();

    console.log('Service initialization complete');
  } catch (error) {
    console.error('Failed to initialize service:', error);
    process.exit(1);
  }
}

// Initialize routes
function initRoutes(): void {
  // Initialize flags router with service
  flagsRouter.setFlagService = (service: FlagService) => {
    (flagsRouter as any).flagService = service;
  };

  // Mount flags routes
  app.use('/api/flags', flagsRouter);

  // Create and attach flag middleware for easy access
  const flagMiddleware = createFlagMiddleware({
    flagService,
    defaultEnvironment: 'production',
  });

  // Export middleware for use in other services
  app.locals.flagMiddleware = flagMiddleware;
  app.locals.flagService = flagService;

  // Debug endpoint to check middleware
  app.get('/debug/flags', flagMiddleware.extractContext, (req: Request, res: Response) => {
    res.json({
      flagContext: req.flagContext,
    });
  });
}

// Graceful shutdown
async function shutdown(): Promise<void> {
  console.log('Shutting down...');

  try {
    // Close Redis connection
    if (redisClient) {
      await redisClient.quit();
    }

    // Close MongoDB connection
    await mongoose.connection.close();

    console.log('Shutdown complete');
    process.exit(0);
  } catch (error) {
    console.error('Error during shutdown:', error);
    process.exit(1);
  }
}

// Handle shutdown signals
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

// Handle unhandled rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Start server
async function start(): Promise<void> {
  await initialize();

  app.listen(PORT, () => {
    console.log(`
╔═══════════════════════════════════════════════════════════════╗
║            REZ Feature Flags Service                           ║
╠═══════════════════════════════════════════════════════════════╣
║  Status:     Running                                          ║
║  Port:        ${PORT}                                              ║
║  Environment: ${NODE_ENV}                                           ║
╠═══════════════════════════════════════════════════════════════╣
║  Endpoints:                                                  ║
║  Health:     GET  /health                                     ║
║  Flags:      GET  /api/flags                                  ║
║  Create:     POST /api/flags                                   ║
║  Evaluate:   POST /api/flags/evaluate/:key                    ║
║  Bulk Eval:  POST /api/flags/evaluate                          ║
║  Analytics:  GET  /api/flags/:key/analytics                    ║
║  Stats:      GET  /api/flags/:key/stats                       ║
╚═══════════════════════════════════════════════════════════════╝
    `);
  });
}

// Start the service
start().catch((error) => {
  console.error('Failed to start service:', error);
  process.exit(1);
});

// Export for testing
export { app, flagService };
