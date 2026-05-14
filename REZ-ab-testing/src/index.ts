import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import mongoose from 'mongoose';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Import routes
import experimentsRouter from './routes/experiments';
import variantsRouter from './routes/variants';
import resultsRouter from './routes/results';

// Import middleware
import {
  authenticateInternal,
  requestLogger,
  errorHandler,
  notFoundHandler,
  corsHeaders,
  rateLimitHeaders,
} from './middleware';

// Import config
import { config } from './config';

// Initialize Express app
const app: Application = express();

// Trust proxy (for rate limiting behind reverse proxy)
app.set('trust proxy', 1);

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
  credentials: true,
}));

// Parse JSON bodies
app.use(express.json({ limit: '10mb' }));

// Parse URL-encoded bodies
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use(morgan('combined'));

// Custom request logger for debugging
app.use(requestLogger);

// Rate limit headers
app.use(rateLimitHeaders);

// CORS headers
app.use(corsHeaders);

// Health check endpoint (public)
app.get('/health', (_req, res) => {
  res.json({
    status: 'healthy',
    service: 'REZ-ab-testing',
    version: process.env.npm_package_version || '1.0.0',
    timestamp: new Date().toISOString(),
    mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
  });
});

// Readiness check endpoint (public)
app.get('/ready', (_req, res) => {
  const isReady = mongoose.connection.readyState === 1;

  if (isReady) {
    res.json({
      status: 'ready',
      service: 'REZ-ab-testing',
      timestamp: new Date().toISOString(),
    });
  } else {
    res.status(503).json({
      status: 'not ready',
      service: 'REZ-ab-testing',
      timestamp: new Date().toISOString(),
      reason: 'MongoDB not connected',
    });
  }
});

// API documentation
app.get('/api', (_req, res) => {
  res.json({
    service: 'REZ-ab-testing',
    version: '1.0.0',
    description: 'A/B Testing Service for REZ-Media',
    endpoints: {
      experiments: {
        'POST /api/experiments': 'Create a new experiment',
        'GET /api/experiments': 'List experiments (paginated)',
        'GET /api/experiments/:id': 'Get experiment by ID',
        'PATCH /api/experiments/:id': 'Update experiment',
        'DELETE /api/experiments/:id': 'Delete experiment (draft only)',
        'POST /api/experiments/:id/start': 'Start experiment',
        'POST /api/experiments/:id/pause': 'Pause experiment',
        'POST /api/experiments/:id/complete': 'Complete experiment',
        'POST /api/experiments/:id/archive': 'Archive experiment',
      },
      variants: {
        'POST /api/experiments/:id/variants': 'Add variant',
        'GET /api/experiments/:id/variants': 'List variants',
        'GET /api/experiments/:id/variants/:variantId': 'Get variant',
        'DELETE /api/experiments/:id/variants/:variantId': 'Remove variant',
        'POST /api/experiments/:id/allocate': 'Allocate user to variant',
        'POST /api/experiments/:id/impressions': 'Batch track impressions',
        'POST /api/experiments/:id/conversions': 'Batch track conversions',
        'GET /api/experiments/:id/preview': 'Allocation preview',
      },
      results: {
        'GET /api/experiments/:id/results': 'Get experiment results',
        'GET /api/experiments/:id/stats': 'Get variant statistics',
        'GET /api/experiments/:id/timeseries': 'Time series data',
        'GET /api/experiments/:id/revenue': 'Revenue breakdown',
        'GET /api/experiments/:id/sample-size': 'Sample size calculator',
        'GET /api/experiments/:id/significance': 'Significance analysis',
        'GET /api/experiments/:id/daily': 'Daily summary',
      },
    },
    authentication: 'X-Internal-Token header required for all API endpoints',
  });
});

// Apply authentication to API routes
app.use('/api', authenticateInternal);

// API routes
app.use('/api/experiments', experimentsRouter);
app.use('/api', variantsRouter);
app.use('/api', resultsRouter);

// Not found handler
app.use(notFoundHandler);

// Global error handler
app.use(errorHandler);

// Database connection
async function connectDatabase(): Promise<void> {
  const mongoUri = config.mongodb.uri;

  try {
    await mongoose.connect(mongoUri, {
      maxPoolSize: config.mongodb.maxPoolSize,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });

    console.log('Connected to MongoDB');

    mongoose.connection.on('error', (err) => {
      console.error('MongoDB connection error:', err);
    });

    mongoose.connection.on('disconnected', () => {
      console.warn('MongoDB disconnected');
    });

    mongoose.connection.on('reconnected', () => {
      console.log('MongoDB reconnected');
    });
  } catch (error) {
    console.error('Failed to connect to MongoDB:', error);
    process.exit(1);
  }
}

// Graceful shutdown
async function shutdown(): Promise<void> {
  console.log('Shutting down gracefully...');

  try {
    await mongoose.connection.close();
    console.log('MongoDB connection closed');
    process.exit(0);
  } catch (error) {
    console.error('Error during shutdown:', error);
    process.exit(1);
  }
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

// Start server
async function startServer(): Promise<void> {
  await connectDatabase();

  const port = config.app.port;
  const host = config.app.host;

  app.listen(port, () => {
    console.log(`REZ-ab-testing service running on http://${host}:${port}`);
    console.log(`Health check: http://${host}:${port}/health`);
    console.log(`API docs: http://${host}:${port}/api`);
  });
}

// Start the server
startServer().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});

export default app;
