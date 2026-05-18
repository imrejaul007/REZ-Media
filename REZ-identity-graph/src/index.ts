/**
 * REZ Identity Graph Service
 *
 * Identity resolution and customer graph
 */

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { logger } from './utils/logger.js';
import identityRouter from './routes/identity.js';

const app = express();

const PORT = parseInt(process.env.PORT || '4065', 10);

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '1mb' }));

// Request logging
app.use((req, _res, next) => {
  logger.debug('Incoming request', {
    method: req.method,
    path: req.path,
  });
  next();
});

// Health check
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'rez-identity-graph',
    timestamp: new Date().toISOString(),
  });
});

// Routes
app.use(identityRouter);

// Error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error('Unhandled error', { error: err.message });
  res.status(500).json({
    success: false,
    error: 'Internal server error',
  });
});

app.listen(PORT, '0.0.0.0', () => {
  logger.info(`REZ Identity Graph Service started`, {
    port: PORT,
    env: process.env.NODE_ENV || 'development',
  });
});

export default app;
