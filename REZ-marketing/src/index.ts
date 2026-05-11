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
import mongoSanitize from 'express-mongo-sanitize';
import client from 'prom-client';
import crypto from 'crypto';

import mongoose from 'mongoose';
import { connectDB } from './config/database';
import { getRedis } from './config/redis';
import { logger } from './config/logger';
import { tracingMiddleware } from './middleware/tracing';

import campaignRoutes from './routes/campaigns';
import audienceRoutes from './routes/audience';
import analyticsRoutes from './routes/analytics';
import growthAnalyticsRoutes from './routes/growthAnalytics';
import keywordRoutes from './routes/keywords';
import webhookRoutes from './routes/webhooks';
import broadcastRoutes from './routes/broadcasts';
import adBazaarRoutes from './routes/adbazaar';
import voucherRoutes from './routes/vouchers';
import merchantGrowthRoutes from './routes/merchantGrowth';
import karmaCampaignRoutes from './routes/karmaCampaigns';
import loyaltyIntegrationRoutes from './routes/loyaltyIntegration';
import influencerRoutes from './routes/influencer';
import offlineAdsRoutes from './routes/offlineAds';
import triggerRoutes from './routes/triggers';
import dashboardRoutes from './routes/dashboard';
import hyperlocalRoutes from './routes/hyperlocal';
import rendezRoutes from './routes/rendez';
import subscriptionRoutes from './routes/subscriptions';

import { campaignWorker } from './workers/campaignWorker';
import { interestSyncWorker, startInterestSyncScheduler } from './workers/interestSyncWorker';
import { interestRetryWorker } from './workers/interestRetryWorker';
import { startBirthdayScheduler } from './audience/BirthdayScheduler';
import interactionRoutes from './routes/interactionRoutes';
import { verifyConsumer } from './middleware/auth';

const register = new client.Registry();
client.collectDefaultMetrics({ register });

const app = express();
app.set('trust proxy', 1); // P1: Trust nginx/Render LB X-Forwarded-For so req.ip reflects real client IP
const PORT = parseInt(process.env.PORT || '4000');

function validateEnv(): void {
  const required = ['MONGODB_URI', 'REDIS_URL'];
  const missing = required.filter((key) => !process.env[key]);

  // Accept either the scoped map or the legacy shared token during rollout
  if (!process.env.INTERNAL_SERVICE_TOKENS_JSON && !process.env.INTERNAL_SERVICE_TOKEN) {
    missing.push('INTERNAL_SERVICE_TOKENS_JSON or INTERNAL_SERVICE_TOKEN');
  }

  if (missing.length > 0) {
    throw new Error(`Missing required env vars: ${missing.join(', ')}`);
  }
}

// ── Prometheus metrics counters ───────────────────────────────────────────────
let requestCount = 0;
let errorCount = 0;

// ── Middleware ────────────────────────────────────────────────────────────────

app.use(helmet());
app.use(cors({ origin: (process.env.CORS_ORIGIN || 'https://rez.money').split(',').map(s => s.trim()), credentials: true }));
// WhatsApp webhook must receive raw body for HMAC verification (Meta signs the raw bytes)
app.use('/webhooks/whatsapp', express.raw({ type: 'application/json', limit: '1mb' }));
app.use(express.json({ limit: '1mb' }));
// MKT-SEC-FIX: mongoSanitize was missing — NoSQL injection possible via query/body params.
// The /campaigns and /broadcasts routes accept merchantId, userId, and campaignId params
// that could contain MongoDB operators like $where, $ne, etc. This middleware strips
// them before they reach route handlers.
app.use(mongoSanitize());
app.use(tracingMiddleware);

// Gateway sends /api/marketing/* — strip /api/marketing prefix so routes match /campaigns, /broadcasts etc.
app.use((req: express.Request, _res: express.Response, next: express.NextFunction) => {
  if (req.url.startsWith('/api/marketing')) req.url = req.url.replace(/^\/api\/marketing/, '');
  else if (req.url.startsWith('/api/')) req.url = req.url.replace(/^\/api/, '');
  next();
});

// Metrics tracking middleware (before routes)
app.use((_req: express.Request, res: express.Response, next: express.NextFunction) => {
  requestCount++;
  res.on('finish', () => { if (res.statusCode >= 500) errorCount++; });
  next();
});

// Internal service key auth — applied to all non-public routes.
// WhatsApp verification (GET /webhooks/whatsapp) and tracking pixel are public.
app.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
  // Always allowed (health only — /metrics requires internal token)
  if (req.path === '/health') return next();

  // WhatsApp webhook verification challenge (GET) — must be reachable by Meta
  if (req.method === 'GET' && req.path === '/webhooks/whatsapp') return next();

  // Tracking pixel (GET) — embedded in emails, no auth
  if (req.method === 'GET' && req.path.startsWith('/webhooks/track/')) return next();

  // All other routes require a scoped internal service secret.
  // Keep x-internal-key header compatibility for existing callers, but require
  // x-internal-service so the token can be resolved from the scoped map.
  const key = req.headers['x-internal-token'] || req.headers['x-internal-key'];
  const callerService = req.headers['x-internal-service'];

  let scopedTokens: Record<string, string> | null = null;
  try {
    const raw = process.env.INTERNAL_SERVICE_TOKENS_JSON;
    const parsed = raw ? JSON.parse(raw) as Record<string, string> : {};
    scopedTokens = Object.keys(parsed).length > 0 ? parsed : null;
  } catch {
    scopedTokens = null;
  }

  if (!scopedTokens) {
    return res.status(503).json({ error: 'Service auth not configured' });
  }

  const expected = typeof callerService === 'string' ? scopedTokens[callerService] : undefined;
  const providedBuf = Buffer.from(typeof key === 'string' ? key : '');
  const expectedBuf = Buffer.from(expected || '');
  const isValid = !!expected &&
    providedBuf.length === expectedBuf.length &&
    crypto.timingSafeEqual(providedBuf, expectedBuf);

  if (!isValid) {
    return res.status(401).json({ error: 'Invalid internal token' });
  }
  next();
});

// ── Routes ────────────────────────────────────────────────────────────────────

app.get('/health', async (_req: express.Request, res: express.Response) => {
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
    }
  } catch {
    checks.redis = 'error';
    errors.push('Redis unavailable');
  }

  const status = errors.length > 0 ? 'degraded' : 'ok';
  res.status(errors.length > 0 ? 503 : 200).json({
    status,
    service: 'rez-marketing-service',
    checks,
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

app.get('/healthz', (_req: express.Request, res: express.Response) => res.status(200).json({ status: 'ok', service: 'rez-marketing-service' }));

app.get('/metrics', async (_req: express.Request, res: express.Response) => {
  res.setHeader('Content-Type', register.contentType);
  res.end(await register.metrics());
});

app.use('/campaigns', campaignRoutes);
app.use('/broadcasts', broadcastRoutes);
app.use('/audience', audienceRoutes);
app.use('/analytics', analyticsRoutes);
app.use('/growth-analytics', growthAnalyticsRoutes);
app.use('/keywords', keywordRoutes);
app.use('/webhooks', webhookRoutes);
app.use('/adbazaar', adBazaarRoutes);
app.use('/vouchers', voucherRoutes);
app.use('/merchant/growth', merchantGrowthRoutes);
app.use('/karma-campaigns', karmaCampaignRoutes);
app.use('/interaction', verifyConsumer, interactionRoutes);

// NEW ROUTES - Marketing Platform Upgrade
app.use('/influencer', influencerRoutes);
app.use('/offline-ads', offlineAdsRoutes);
app.use('/triggers', triggerRoutes);
app.use('/dashboard', dashboardRoutes);
app.use('/hyperlocal', hyperlocalRoutes);
app.use('/rendez', rendezRoutes);
app.use('/subscriptions', subscriptionRoutes);
app.use('/loyalty-marketing', loyaltyIntegrationRoutes);

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

  // Warm Redis connection
  getRedis();

  // Start BullMQ workers
  logger.info('[Boot] Workers started: campaignWorker, interestSyncWorker');

  // Start cron schedulers
  startInterestSyncScheduler();
  startBirthdayScheduler();

  app.listen(PORT, () => {
    logger.info(`[Boot] rez-marketing-service listening on port ${PORT}`);
  });
}

boot().catch((err) => {
  logger.error('[Boot] Fatal startup error', err);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('[Shutdown] SIGTERM received — closing workers');
  await campaignWorker.close();
  await interestSyncWorker.close();
  await interestRetryWorker.close();
  await mongoose.disconnect();
  logger.info('[Shutdown] MongoDB disconnected');
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('[Shutdown] SIGINT received — closing workers');
  await campaignWorker.close();
  await interestSyncWorker.close();
  await interestRetryWorker.close();
  await mongoose.disconnect();
  logger.info('[Shutdown] MongoDB disconnected');
  process.exit(0);
});

process.on('unhandledRejection', (reason: unknown) => {
  logger.error('Unhandled promise rejection', { reason: reason instanceof Error ? reason.message : String(reason) });
});

process.on('uncaughtException', (err: Error) => {
  logger.error('Uncaught exception', { error: err.message, stack: err.stack });
  process.exit(1);
});
