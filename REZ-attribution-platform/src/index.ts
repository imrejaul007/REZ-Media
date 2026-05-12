import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { trackRoutes, reportsRoutes } from './routes';
import logger from './utils/logger';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/rez-attribution';

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true
}));
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logging middleware
app.use((req: Request, _res: Response, next: NextFunction) => {
  logger.info(`${req.method} ${req.path}`, {
    query: req.query,
    ip: req.ip
  });
  next();
});

// Health check endpoint
app.get('/health', (_req: Request, res: Response) => {
  const healthcheck = {
    uptime: process.uptime(),
    message: 'OK',
    timestamp: new Date().toISOString(),
    database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
  };
  res.json(healthcheck);
});

// API Routes
app.use('/api/track', trackRoutes);
app.use('/api/reports', reportsRoutes);

// Campaign attribution endpoint (POST version)
app.post('/api/campaigns/:id/attribution', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id: campaignId } = req.params;
    const { reportGenerator } = await import('./services/ReportGenerator');
    const { AttributionModel } = await import('./models/AttributionReport');

    const {
      startDate,
      endDate,
      attributionModel
    } = req.body;

    const report = await reportGenerator.generateCampaignAttribution(campaignId, {
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      attributionModel: attributionModel || AttributionModel.LINEAR
    });

    res.json({
      success: true,
      data: report
    });
  } catch (error) {
    next(error);
  }
});

// Error handling middleware
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  logger.error('Unhandled error', {
    error: err.message,
    stack: err.stack
  });

  res.status(500).json({
    success: false,
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// 404 handler
app.use((_req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: 'Not found'
  });
});

// Database connection
async function connectDatabase(): Promise<void> {
  try {
    await mongoose.connect(MONGODB_URI, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000
    });
    logger.info('Connected to MongoDB', { uri: MONGODB_URI.replace(/\/\/.*@/, '//<credentials>@') });
  } catch (error) {
    logger.error('Failed to connect to MongoDB', { error });
    process.exit(1);
  }
}

// Graceful shutdown
async function shutdown(signal: string): Promise<void> {
  logger.info(`Received ${signal}. Shutting down gracefully...`);

  try {
    await mongoose.connection.close();
    logger.info('MongoDB connection closed');
    process.exit(0);
  } catch (error) {
    logger.error('Error during shutdown', { error });
    process.exit(1);
  }
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Start server
async function startServer(): Promise<void> {
  await connectDatabase();

  app.listen(PORT, () => {
    logger.info(`REZ Attribution Platform running on port ${PORT}`, {
      nodeEnv: process.env.NODE_ENV,
      mongodbUri: MONGODB_URI.replace(/\/\/.*@/, '//<credentials>@')
    });
    logger.info('Available endpoints:', {
      'POST /api/track/touchpoint': 'Track a touchpoint',
      'POST /api/track/conversion': 'Track a conversion',
      'GET /api/reports/attribution': 'Get attribution report',
      'GET /api/reports/funnel': 'Get conversion funnel',
      'POST /api/campaigns/:id/attribution': 'Get campaign attribution'
    });
  });
}

startServer().catch(error => {
  logger.error('Failed to start server', { error });
  process.exit(1);
});

export default app;
