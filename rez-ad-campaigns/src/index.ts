// @ts-nocheck
import 'express-async-errors';
import dotenv from 'dotenv';
dotenv.config();

import * as Sentry from '@sentry/node';
import { expressIntegration, setupExpressErrorHandler } from '@sentry/node';
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  integrations: [expressIntegration()],
});

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import mongoSanitize from 'express-mongo-sanitize';
import mongoose from 'mongoose';
import client from 'prom-client';

const register = new client.Registry();
client.collectDefaultMetrics({ register });

import { connectDB } from './config/database';
import { logger } from './config/logger';
import { tracingMiddleware } from './middleware/tracing';
import { startReengagementScheduler, stopReengagementScheduler } from './services/reEngagementService';

import merchantRoutes from './routes/merchant';
import adminRoutes from './routes/admin';
import serveRoutes from './routes/serve';
import interactionRoutes from './routes/interactionRoutes';
import adbazaarRoutes from './routes/adbazaar';
import conversionRoutes from './routes/conversion';

const app = express();
app.set('trust proxy', 1); // P1: Trust nginx/Render LB X-Forwarded-For so req.ip reflects real client IP
const PORT = parseInt(process.env.PORT || '4008');

function validateEnv(): void {
  if (!process.env.ADS_MONGO_URI && !process.env.MONGO_URI && !process.env.MONGODB_URI) {
    throw new Error('ADS_MONGO_URI, MONGO_URI, or MONGODB_URI is required');
  }
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET is required');
  }
}

// ── Middleware ────────────────────────────────────────────────────────────────

app.use(helmet());
app.use(cors({
  origin: (process.env.CORS_ORIGIN || 'https://rez.money').split(',').map((s) => s.trim()),
  credentials: true,
}));
app.use(compression());
app.use(express.json({ limit: '1mb' }));
app.use(mongoSanitize());
app.use(tracingMiddleware);

// Strip /api prefix injected by the API gateway so route handlers remain
// unaware of the gateway's URL scheme.
app.use((req: express.Request, _res: express.Response, next: express.NextFunction) => {
  if (req.url.startsWith('/api/')) req.url = req.url.replace(/^\/api/, '');
  next();
});

// ── Routes ────────────────────────────────────────────────────────────────────

app.get('/health', async (_req, res) => {
  const checks: Record<string, string> = { db: 'ok', redis: 'ok' };
  const errors: string[] = [];

  if (mongoose.connection.readyState !== 1) {
    checks.db = 'error';
    errors.push('MongoDB not connected');
  }

  try {
    const { getRedis } = await import('./config/redis');
    const redis = getRedis();
    if (redis.status !== 'ready') {
      checks.redis = 'error';
      errors.push('Redis not ready');
    }
  } catch {
    checks.redis = 'error';
    errors.push('Redis unavailable');
  }

  const status = errors.length > 0 ? 'degraded' : 'ok';
  res.status(errors.length > 0 ? 503 : 200).json({
    status,
    service: 'rez-ads-service',
    checks,
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

app.get('/healthz', (_req, res) => res.status(200).json({ status: 'ok', service: 'rez-ads-service' }));

// GET /health/detailed — Comprehensive health check with latency metrics
app.get('/health/detailed', async (_req, res) => {
  const checks: Record<string, any> = {};
  let isHealthy = true;

  // Check MongoDB with latency
  const mongoStart = Date.now();
  try {
    if (mongoose.connection.readyState !== 1) throw new Error('not connected');
    await mongoose.connection.db?.admin().ping();
    checks.database = { status: 'up', latencyMs: Date.now() - mongoStart };
  } catch (err: any) {
    checks.database = { status: 'down', error: err.message, latencyMs: Date.now() - mongoStart };
    isHealthy = false;
  }

  // Check Redis with latency
  const redisStart = Date.now();
  try {
    const { getRedis } = await import('./config/redis');
    const redis = getRedis();
    if (redis.status !== 'ready') throw new Error('Redis not ready');
    await redis.ping();
    checks.redis = { status: 'up', latencyMs: Date.now() - redisStart };
  } catch (err: any) {
    checks.redis = { status: 'down', error: err.message, latencyMs: Date.now() - redisStart };
  }

  const overallStatus = isHealthy ? 'healthy' : 'unhealthy';
  res.status(overallStatus === 'healthy' ? 200 : 503).json({
    status: overallStatus,
    timestamp: new Date().toISOString(),
    version: process.env.SERVICE_VERSION || '1.0.0',
    uptime: process.uptime(),
    checks,
  });
});

app.get('/metrics', async (_req, res) => {
  res.setHeader('Content-Type', register.contentType);
  res.end(await register.metrics());
});

app.use('/merchant/ads', merchantRoutes);
app.use('/admin/ads', adminRoutes);
app.use('/ads', interactionRoutes);
app.use('/ads', serveRoutes);
app.use('/', adbazaarRoutes);
app.use('/', conversionRoutes);

// ── Error handler ─────────────────────────────────────────────────────────────

setupExpressErrorHandler(app);

app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error('[API] Unhandled error', { err: err.message, stack: err.stack });
  res.status(500).json({ error: 'Internal server error' });
});

// ── Boot ──────────────────────────────────────────────────────────────────────

async function boot() {
  validateEnv();
  await connectDB();

  // BAK-ADS-007 FIX: Initialize Redis connection on boot.
  // Previously getRedis() was called in the billing service but never connected,
  // causing the in-memory fallback to be used and Redis-based click deduplication
  // to silently fail. Redis must be connected before any route handler runs.
  try {
    const { getRedis } = await import('./config/redis');
    const redis = getRedis();
    await redis.ping();
    logger.info('[Boot] Redis connected successfully');
  } catch (err: any) {
    logger.error('[Boot] Redis connection failed — ensure REDIS_URL is set', { error: err.message });
    throw err; // Fail-closed: do not start without Redis
  }

  // Start the re-engagement scheduler (hourly engagement spike checks)
  await startReengagementScheduler();

  const server = app.listen(PORT, () => {
    logger.info(`[Boot] rez-ads-service listening on port ${PORT}`);
  });

  const shutdown = async (signal: string) => {
    logger.info(`[Shutdown] ${signal} received — shutting down gracefully`);
    await stopReengagementScheduler();
    await new Promise<void>((resolve, reject) => {
      server.close((err?: Error) => {
        if (err) {
          reject(err);
          return;
        }
        resolve();
      });
    });
    await mongoose.disconnect();
    process.exit(0);
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('unhandledRejection', (reason: unknown) => {
    logger.error('Unhandled promise rejection', { reason: reason instanceof Error ? reason.message : String(reason) });
  });
}

boot().catch((err) => {
  logger.error('[Boot] Fatal startup error', err);
  process.exit(1);
});
