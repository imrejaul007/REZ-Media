import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { trackRoutes, reportsRoutes } from './routes';
import logger from './utils/logger';
import { authMiddleware, rateLimitMiddleware, requestIdMiddleware, errorHandler } from './middleware/auth';

// Load environment variables
dotenv.config();

// Load service tokens
function getServiceTokens(): Record<string, string> {
  const tokensJson = process.env.INTERNAL_SERVICE_TOKENS_JSON;
  if (!tokensJson) return {};
  try {
    return JSON.parse(tokensJson);
  } catch {
    console.error('[AUTH] Failed to parse INTERNAL_SERVICE_TOKENS_JSON');
    return {};
  }
}

const SERVICE_TOKENS = getServiceTokens();

const app = express();
const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/rez-attribution';

// Get allowed CORS origins
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',')
  : ['https://rezapp.com', 'https://www.rezapp.com'];

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

// Request logging middleware
app.use((req: Request, res: Response, next: NextFunction) => {
  const requestId = (req as any).requestId;
  logger.info(`${req.method} ${req.path}`, {
    query: req.query,
    ip: req.ip,
    requestId,
  });
  next();
});

// Health check endpoint
app.get('/health', (_req: Request, res: Response) => {
  const healthcheck = {
    uptime: process.uptime(),
    message: 'OK',
    timestamp: new Date().toISOString(),
    database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
  };
  res.json(healthcheck);
});

// Ready check
app.get('/ready', (_req: Request, res: Response) => {
  const checks = {
    database: mongoose.connection.readyState === 1,
    service: true,
  };

  const allHealthy = Object.values(checks).every(v => v === true);
  res.status(allHealthy ? 200 : 503).json({
    status: allHealthy ? 'ready' : 'degraded',
    checks,
  });
});

// Apply authentication to API routes
app.use('/api', authMiddleware);

// API Routes
app.use('/api/track', trackRoutes);
app.use('/api/reports', reportsRoutes);

// Campaign attribution endpoint (POST version)
app.post('/api/campaigns/:id/attribution', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id: campaignId } = req.params;
    const { ReportGenerator } = await import('./services/ReportGenerator');
    const { AttributionModel } = await import('./models/AttributionReport');

    const {
      startDate,
      endDate,
      attributionModel
    } = req.body;

    const reportGenerator = new ReportGenerator();
    const report = await reportGenerator.generateAttributionReport({
      campaignId,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      attributionModel: attributionModel || 'LAST_CLICK',
    });

    res.json({
      success: true,
      report,
    });
  } catch (error) {
    next(error);
  }
});

// Error handler
app.use(errorHandler);

// 404 handler
app.use((_req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: 'Not found',
  });
});

// Database connection
async function connectDatabase() {
  try {
    await mongoose.connect(MONGODB_URI);
    logger.info('Connected to MongoDB');
  } catch (error) {
    logger.error('Failed to connect to MongoDB:', error);
    process.exit(1);
  }
}

// Graceful shutdown
async function shutdown() {
  logger.info('Shutting down...');
  await mongoose.disconnect();
  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

// Start server
async function start() {
  await connectDatabase();

  app.listen(PORT, () => {
    logger.info(`Attribution Platform running on port ${PORT}`);
    logger.info(`Health: http://localhost:${PORT}/health`);
    logger.info(`API: http://localhost:${PORT}/api`);
  });
}

start();

export default app;
