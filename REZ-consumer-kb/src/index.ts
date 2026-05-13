import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import winston from 'winston';

// Import routes
import kbRoutes from './routes/kb';
import profileRoutes from './routes/profile';

// Import services
import { intentExtractor } from './services/intentExtractor';
import { preferenceEngine } from './services/preferenceEngine';

// Load environment variables
dotenv.config();

// Configure logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'rez-consumer-kb' },
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      ),
    }),
  ],
});

// Create Express app
const app = express();

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Internal-Token'],
}));
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req: Request, _res: Response, next: NextFunction) => {
  logger.info({
    method: req.method,
    path: req.path,
    ip: req.ip,
  });
  next();
});

// Health check endpoint
app.get('/health', (_req: Request, res: Response) => {
  const mongoStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';

  res.json({
    status: 'healthy',
    service: 'rez-consumer-kb',
    timestamp: new Date().toISOString(),
    mongodb: mongoStatus,
    version: process.env.npm_package_version || '1.0.0',
  });
});

// Readiness check
app.get('/ready', (_req: Request, res: Response) => {
  const mongoStatus = mongoose.connection.readyState === 1;

  if (!mongoStatus) {
    res.status(503).json({
      status: 'not ready',
      reason: 'MongoDB not connected',
    });
    return;
  }

  res.json({
    status: 'ready',
    timestamp: new Date().toISOString(),
  });
});

// API routes
app.use('/api/kb', kbRoutes);
app.use('/api/profiles', profileRoutes);

// API info endpoint
app.get('/api', (_req: Request, res: Response) => {
  res.json({
    service: 'rez-consumer-kb',
    version: '1.0.0',
    description: 'Consumer Knowledge Base Service - stores memory, preferences, goals, context',
    endpoints: {
      kb: '/api/kb/:consumerId',
      profiles: '/api/profiles/:consumerId',
      health: '/health',
      ready: '/ready',
    },
  });
});

// 404 handler
app.use((_req: Request, res: Response) => {
  res.status(404).json({
    error: 'Not Found',
    message: 'The requested resource was not found',
  });
});

// Error handler
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  logger.error({
    error: err.message,
    stack: err.stack,
  });

  res.status(500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'An unexpected error occurred',
  });
});

// Database connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/rez-consumer-kb';

async function connectToDatabase(): Promise<void> {
  try {
    await mongoose.connect(MONGODB_URI, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });
    logger.info('Connected to MongoDB');
  } catch (error) {
    logger.error('Failed to connect to MongoDB:', error);
    throw error;
  }
}

// Graceful shutdown
async function shutdown(): Promise<void> {
  logger.info('Shutting down gracefully...');

  try {
    await mongoose.connection.close();
    logger.info('MongoDB connection closed');
    process.exit(0);
  } catch (error) {
    logger.error('Error during shutdown:', error);
    process.exit(1);
  }
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

// Start server
const PORT = parseInt(process.env.PORT || '4010', 10);

async function startServer(): Promise<void> {
  try {
    await connectToDatabase();

    app.listen(PORT, () => {
      logger.info(`Consumer KB Service running on port ${PORT}`);
      logger.info(`Health check: http://localhost:${PORT}/health`);
      logger.info(`API info: http://localhost:${PORT}/api`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Export app for testing
export { app };

// Start server if not in test mode
if (process.env.NODE_ENV !== 'test') {
  startServer();
}
