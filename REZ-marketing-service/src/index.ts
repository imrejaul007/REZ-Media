/**
 * REZ Marketing Service
 *
 * Marketing automation for campaigns and customer engagement
 * Port: 4026
 */

import 'dotenv/config';
import 'express-async-errors';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import mongoose from 'mongoose';
import { connectRedis, redis } from './config/redis';
import { logger } from './config/logger';
import { authMiddleware, rateLimitMiddleware, requestIdMiddleware, errorHandler, ALLOWED_ORIGINS } from './middleware/auth';

process.env.SERVICE_NAME = process.env.SERVICE_NAME || 'rez-marketing-service';

const app = express();
const PORT = parseInt(process.env.PORT || '4026', 10);

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

// Global rate limiting
app.use(rateLimitMiddleware);

// Health check
app.get('/health', (_req, res) => {
  const mongoOk = mongoose.connection.readyState === 1;
  const redisOk = redis.status === 'ready';
  res.json({
    service: 'marketing-service',
    status: mongoOk && redisOk ? 'ok' : 'degraded',
    mongo: mongoOk,
    redis: redisOk,
    timestamp: new Date().toISOString(),
  });
});

app.get('/ready', async (_req, res) => {
  try {
    await redis.ping();
    res.json({ ready: true });
  } catch {
    res.status(503).json({ ready: false });
  }
});

// Import routes
import campaignRoutes from './routes/campaign.routes';
import segmentRoutes from './routes/segment.routes';
import analyticsRoutes from './routes/analytics.routes';

// Apply authentication to API routes
app.use('/api', authMiddleware);

// Routes
app.use('/api/v1/campaigns', campaignRoutes);
app.use('/api/v1/segments', segmentRoutes);
app.use('/api/v1/analytics', analyticsRoutes);

// Error handler
app.use(errorHandler);

async function start(): Promise<void> {
  try {
    // Connect to MongoDB
    const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/rez_marketing';
    await mongoose.connect(MONGODB_URI);
    logger.info('MongoDB connected');

    // Connect to Redis
    await connectRedis();
    logger.info('Redis connected');

    // Start server
    app.listen(PORT, () => {
      logger.info(`Marketing Service listening on port ${PORT}`);
      logger.info(`Health check: http://localhost:${PORT}/health`);
    });
  } catch (error) {
    logger.error('Failed to start marketing service', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down');
  await redis.quit();
  await mongoose.disconnect();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down');
  await redis.quit();
  await mongoose.disconnect();
  process.exit(0);
});

start();

export default app;
