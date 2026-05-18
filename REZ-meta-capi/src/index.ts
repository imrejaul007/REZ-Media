/**
 * REZ Meta CAPI Service
 *
 * Server-side integration with Meta Conversions API
 *
 * Features:
 * - Receive events from browser SDK
 * - Receive events from Shopify
 * - Send events to Meta CAPI
 * - Event deduplication
 * - Batch processing
 * - Retry logic
 */

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { logger } from './utils/logger.js';
import eventsRouter from './routes/events.js';

const app = express();

// Configuration
const PORT = parseInt(process.env.PORT || '4080', 10);

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '1mb' }));

// Request logging
app.use((req, _res, next) => {
  logger.debug('Incoming request', {
    method: req.method,
    path: req.path,
    ip: req.ip,
  });
  next();
});

// Health check
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'rez-meta-capi',
    timestamp: new Date().toISOString(),
  });
});

// Routes
app.use(eventsRouter);

// Error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error('Unhandled error', { error: err.message });
  res.status(500).json({
    success: false,
    error: 'Internal server error',
  });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  logger.info(`REZ Meta CAPI Service started`, {
    port: PORT,
    env: process.env.NODE_ENV || 'development',
  });

  // Validate configuration
  if (!process.env.META_ACCESS_TOKEN) {
    logger.warn('META_ACCESS_TOKEN not configured - events will fail');
  }
  if (!process.env.META_PIXEL_ID) {
    logger.warn('META_PIXEL_ID not configured - events will fail');
  }
});

export default app;
