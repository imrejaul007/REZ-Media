import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import mongoose from 'mongoose';

import { initSentry } from './config/sentry';
import { authMiddleware, rateLimitMiddleware, requestIdMiddleware, errorHandler, ALLOWED_ORIGINS } from './middleware/auth';
import feedbackRoutes from './routes/feedback';
import dashboardRoutes from './dashboard';
import { checkHealth, isAlive, isReady } from './health';
import { logger } from './utils/logger';
import { feedbackProcessor } from './workers/feedback-processor';

// Initialize Sentry
initSentry();

const PORT = parseInt(process.env.PORT || '4010');
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/rez-feedback';

const app: Express = express();

// Middleware
app.use(requestIdMiddleware);
app.use(helmet());
app.use(cors({
  origin: ALLOWED_ORIGINS,
  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Internal-Token', 'X-Request-Id'],
  maxAge: 86400,
}));
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Global rate limiting
app.use(rateLimitMiddleware);

// Request logging
app.use((req: Request, _res: Response, next: NextFunction) => {
  logger.info(`${req.method} ${req.path}`, {
    ip: req.ip,
    query: req.query
  });
  next();
});

// Health endpoints
app.get('/health', async (_req: Request, res: Response) => {
  const health = await checkHealth();
  const statusCode = health.status === 'healthy' ? 200 : health.status === 'degraded' ? 200 : 503;
  res.status(statusCode).json(health);
});

app.get('/health/live', (_req: Request, res: Response) => {
  if (isAlive()) {
    res.json({ status: 'alive' });
  } else {
    res.status(503).json({ status: 'dead' });
  }
});

app.get('/health/ready', async (_req: Request, res: Response) => {
  const ready = await isReady();
  if (ready) {
    res.json({ status: 'ready' });
  } else {
    res.status(503).json({ status: 'not ready' });
  }
});

// Apply authentication to API routes
app.use('/feedback', authMiddleware, feedbackRoutes);
app.use('/dashboard', authMiddleware, dashboardRoutes);

// Error handler
app.use(errorHandler);

// 404 handler
app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: 'Not found' });
});

// Error handler
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  logger.error('Unhandled error', { error: err.message, stack: err.stack });
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Connect to MongoDB
async function connectDatabase(): Promise<void> {
  try {
    await mongoose.connect(MONGODB_URI);
    logger.info('Connected to MongoDB');
  } catch (error) {
    logger.error('MongoDB connection failed', {
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    throw error;
  }
}

// Graceful shutdown
async function shutdown(): Promise<void> {
  logger.info('Shutting down gracefully...');

  try {
    await feedbackProcessor.shutdown();
    await mongoose.connection.close();
    logger.info('Shutdown complete');
    process.exit(0);
  } catch (error) {
    logger.error('Shutdown error', { error });
    process.exit(1);
  }
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

// Start server
async function start(): Promise<void> {
  try {
    await connectDatabase();

    app.listen(PORT, () => {
      logger.info(`REZ Feedback Service started on port ${PORT}`);
      logger.info(`Health check: http://localhost:${PORT}/health`);
      logger.info(`API: http://localhost:${PORT}/feedback`);
      logger.info(`Dashboard: http://localhost:${PORT}/dashboard`);
    });
  } catch (error) {
    logger.error('Failed to start server', {
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    process.exit(1);
  }
}

start();

// ── Global Error Handlers ─────────────────────────────────────────────────
process.on('uncaughtException', (error) => {
  console.error('UNCAUGHT EXCEPTION:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('UNHANDLED REJECTION at:', promise, 'reason:', reason);
});

export { app };
