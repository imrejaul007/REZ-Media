import 'express-async-errors';
import dotenv from 'dotenv';
dotenv.config();

import * as Sentry from '@sentry/node';
import { expressIntegration } from '@sentry/node';
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  integrations: [expressIntegration()],
});

import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import mongoSanitize from 'express-mongo-sanitize';
import mongoose from 'mongoose';
import client from 'prom-client';

const register = new client.Registry();
client.collectDefaultMetrics({ register });

import { connectDB } from './config/database';
import { getRedis, closeRedis } from './config/redis';
import { logger } from './config/logger';
import { serverConfig, validateConfig } from './config';

import shopifyRoutes from './routes';

// ── Express App Setup ─────────────────────────────────────────────────────────

const app = express();

// Trust proxy for proper IP detection behind load balancers
app.set('trust proxy', 1);

// ── Raw Body for Webhook Signature Verification ───────────────────────────────

// Store raw body for webhook signature verification
app.use(
  '/api/shopify/webhook',
  express.json({
    verify: (req: Request, _res: Response, buf: Buffer) => {
      (req as unknown as { rawBody: string }).rawBody = buf.toString();
    },
  })
);

// ── Middleware ────────────────────────────────────────────────────────────────

app.use(helmet());
app.use(
  cors({
    origin: (process.env.CORS_ORIGIN || '*').split(',').map((s) => s.trim()),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Internal-Token',
      'X-Internal-Key',
      'X-Shopify-Store-Id',
      'X-Shopify-Store-Domain',
    ],
  })
);
app.use(compression());
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(mongoSanitize());

// ── Request Logging ──────────────────────────────────────────────────────────

const apiLogger = createServiceLogger('api');

app.use((req: Request, _res: Response, next: NextFunction) => {
  const start = Date.now();

  _res.on('finish', () => {
    const duration = Date.now() - start;
    apiLogger.debug(`${req.method} ${req.path} ${_res.statusCode} ${duration}ms`, {
      method: req.method,
      path: req.path,
      statusCode: _res.statusCode,
      duration,
      ip: req.ip,
    });
  });

  next();
});

// Strip /api prefix injected by API gateway
app.use((req: Request, _res: Response, next: NextFunction) => {
  if (req.url.startsWith('/api/')) {
    req.url = req.url.replace(/^\/api/, '');
  }
  next();
});

// ── Health Check Endpoints ─────────────────────────────────────────────────────

app.get('/health', async (_req: Request, res: Response) => {
  const checks: Record<string, string> = { db: 'ok', redis: 'ok' };
  const errors: string[] = [];

  if (mongoose.connection.readyState !== 1) {
    checks.db = 'error';
    errors.push('MongoDB not connected');
  }

  try {
    const redis = getRedis();
    if (redis.status !== 'ready') {
      checks.redis = 'error';
      errors.push('Redis not ready');
    } else {
      await redis.ping();
    }
  } catch {
    checks.redis = 'error';
    errors.push('Redis unavailable');
  }

  const status = errors.length > 0 ? 'degraded' : 'ok';
  res.status(errors.length > 0 ? 503 : 200).json({
    status,
    service: 'rez-shopify-connector',
    checks,
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

app.get('/healthz', (_req: Request, res: Response) =>
  res.status(200).json({ status: 'ok', service: 'rez-shopify-connector' })
);

app.get('/health/detailed', async (_req: Request, res: Response) => {
  const checks: Record<string, unknown> = {};
  let isHealthy = true;

  // MongoDB check
  const mongoStart = Date.now();
  try {
    if (mongoose.connection.readyState !== 1) throw new Error('not connected');
    await mongoose.connection.db?.admin().ping();
    checks.database = { status: 'up', latencyMs: Date.now() - mongoStart };
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    checks.database = { status: 'down', error: error.message, latencyMs: Date.now() - mongoStart };
    isHealthy = false;
  }

  // Redis check
  const redisStart = Date.now();
  try {
    const redis = getRedis();
    if (redis.status !== 'ready') throw new Error('Redis not ready');
    await redis.ping();
    checks.redis = { status: 'up', latencyMs: Date.now() - redisStart };
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    checks.redis = { status: 'down', error: error.message, latencyMs: Date.now() - redisStart };
    isHealthy = false;
  }

  const overallStatus = isHealthy ? 'healthy' : 'unhealthy';
  res.status(overallStatus === 'healthy' ? 200 : 503).json({
    status: overallStatus,
    timestamp: new Date().toISOString(),
    version: serverConfig.serviceVersion,
    uptime: process.uptime(),
    checks,
  });
});

// ── Prometheus Metrics ────────────────────────────────────────────────────────

app.get('/metrics', async (_req: Request, res: Response) => {
  res.setHeader('Content-Type', register.contentType);
  res.end(await register.metrics());
});

// ── API Routes ────────────────────────────────────────────────────────────────

app.use('/api/shopify', shopifyRoutes);

// ── 404 Handler ───────────────────────────────────────────────────────────────

app.use((_req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
  });
});

// ── Error Handler ────────────────────────────────────────────────────────────

setupExpressErrorHandler(app);

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  logger.error('[API] Unhandled error', { err: err.message, stack: err.stack });

  res.status(500).json({
    success: false,
    error: 'Internal server error',
  });
});

// ── Boot Sequence ────────────────────────────────────────────────────────────

async function boot(): Promise<void> {
  // Validate configuration
  try {
    validateConfig();
    logger.info('[Boot] Configuration validated');
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error('[Boot] Configuration validation failed:', err.message);
    process.exit(1);
  }

  // Connect to MongoDB
  try {
    await connectDB();
    logger.info('[Boot] MongoDB connected');
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error('[Boot] MongoDB connection failed:', err.message);
    process.exit(1);
  }

  // Connect to Redis
  try {
    const redis = getRedis();
    await redis.ping();
    logger.info('[Boot] Redis connected');
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error('[Boot] Redis connection failed:', err.message);
    process.exit(1);
  }

  // Start HTTP server
  const server = app.listen(serverConfig.port, () => {
    logger.info(`[Boot] rez-shopify-connector listening on port ${serverConfig.port}`);
    logger.info(`[Boot] Environment: ${serverConfig.nodeEnv}`);
  });

  // ── Graceful Shutdown ─────────────────────────────────────────────────────

  const shutdown = async (signal: string): Promise<void> => {
    logger.info(`[Shutdown] ${signal} received — shutting down gracefully`);

    // Stop accepting new connections
    server.close(async (err?: Error) => {
      if (err) {
        logger.error('[Shutdown] Server close error:', err);
      }

      try {
        // Close Redis
        await closeRedis();
        logger.info('[Shutdown] Redis disconnected');

        // Close MongoDB
        await mongoose.disconnect();
        logger.info('[Shutdown] MongoDB disconnected');

        logger.info('[Shutdown] Graceful shutdown complete');
        process.exit(0);
      } catch (shutdownError) {
        const error = shutdownError instanceof Error ? shutdownError : new Error(String(shutdownError));
        logger.error('[Shutdown] Error during shutdown:', error);
        process.exit(1);
      }
    });

    // Force exit after timeout
    setTimeout(() => {
      logger.error('[Shutdown] Forced exit after timeout');
      process.exit(1);
    }, 30_000);
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('unhandledRejection', (reason: unknown) => {
    const error = reason instanceof Error ? reason : new Error(String(reason));
    logger.error('Unhandled promise rejection', { reason: error.message });
  });
}

// ── Start ─────────────────────────────────────────────────────────────────────

boot().catch((err) => {
  const error = err instanceof Error ? err : new Error(String(err));
  logger.error('[Boot] Fatal startup error', error);
  process.exit(1);
});
