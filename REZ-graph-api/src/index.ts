import express, { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';

import nodesRouter from './routes/nodes';
import edgesRouter from './routes/edges';
import queriesRouter from './routes/queries';
import {
  verifyInternalToken,
  verifyJwtToken,
  requestLogger,
  corsConfig,
} from './middleware/auth';
import { logger } from './utils/logger';

// Load environment variables
dotenv.config();

const app = express();
const PORT = parseInt(process.env.PORT || '3008', 10);

// Trust proxy for accurate IP logging
app.set('trust proxy', 1);

// Security middleware
app.use(helmet());

// CORS configuration
const corsOrigins = process.env.CORS_ORIGINS?.split(',') || ['*'];
app.use(corsConfig(corsOrigins));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use(requestLogger);

// Health check endpoint (no auth required)
app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    service: 'rez-graph-api',
    timestamp: new Date().toISOString(),
    mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
  });
});

// Service routes (internal service-to-service)
app.use('/internal/nodes', verifyInternalToken, nodesRouter);
app.use('/internal/edges', verifyInternalToken, edgesRouter);
app.use('/internal/queries', verifyInternalToken, queriesRouter);

// Public routes (with optional JWT auth)
app.use('/nodes', nodesRouter);
app.use('/edges', edgesRouter);
app.use('/queries', queriesRouter);

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: 'Not found',
    path: req.path,
  });
});

// Error handling middleware
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  logger.error('Unhandled error', {
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
  });

  // Don't expose internal errors in production
  const isDev = process.env.NODE_ENV === 'development';

  res.status(500).json({
    success: false,
    error: isDev ? err.message : 'Internal server error',
    ...(isDev && { stack: err.stack }),
  });
});

// Database connection
async function connectDatabase(): Promise<void> {
  const mongodbUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/rez_graph';

  try {
    await mongoose.connect(mongodbUri, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });

    logger.info('Connected to MongoDB', { uri: mongodbUri.replace(/\/\/.*@/, '//<credentials>@') });
  } catch (error) {
    logger.error('Failed to connect to MongoDB', { error });
    throw error;
  }
}

// Graceful shutdown
async function shutdown(signal: string): Promise<void> {
  logger.info(`Received ${signal}, starting graceful shutdown...`);

  try {
    await mongoose.connection.close();
    logger.info('MongoDB connection closed');
  } catch (error) {
    logger.error('Error during shutdown', { error });
  }

  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Start server
async function start(): Promise<void> {
  try {
    await connectDatabase();

    app.listen(PORT, () => {
      logger.info(`ReZ Graph API server started`, {
        port: PORT,
        environment: process.env.NODE_ENV || 'development',
      });
    });
  } catch (error) {
    logger.error('Failed to start server', { error });
    process.exit(1);
  }
}

start();

export default app;
