/**
 * ReZ Economic Engine - Main Entry Point
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import mongoose from 'mongoose';
import { config } from './config';
import { auth } from './middleware/auth';

// Routes
import adminRoutes from './routes/admin.routes';
import queryRoutes from './routes/query.routes';
import eventRoutes from './routes/event.routes';
import featureRoutes from './routes/feature.routes';
import { adminRules } from './routes/admin.routes';

// Services
import { startAllWorkers, shutdownWorkers } from './workers';
import { cacheService } from './services/cacheService';

// Initialize Express app
const app = express();

// Middleware
app.use(helmet());
app.use(cors());
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Apply auth to API routes
app.use('/api', auth);

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'rez-economic-engine',
    timestamp: new Date().toISOString()
  });
});

// API Routes
app.use('/api/admin/rules', adminRoutes);
app.use('/api/query', queryRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/features', featureRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ success: false, error: 'Route not found' });
});

// Error handler
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err);
  res.status(500).json({
    success: false,
    error: process.env.NODE_ENV === 'production'
      ? 'Internal server error'
      : err.message
  });
});

// Start server
async function startServer() {
  // SECURITY: Validate required env vars in production
  if (process.env.NODE_ENV === 'production') {
    if (!config.MONGODB_URI) {
      console.error('FATAL: MONGODB_URI is required in production');
      process.exit(1);
    }
    if (!config.JWT_SECRET) {
      console.error('FATAL: JWT_SECRET is required in production');
      process.exit(1);
    }
    if (!config.SERVICE_API_KEY) {
      console.error('FATAL: SERVICE_API_KEY is required in production');
      process.exit(1);
    }
  }

  // Try MongoDB, but continue without it for testing
  try {
    await mongoose.connect(config.MONGODB_URI);
    console.log('Connected to MongoDB');
  } catch (mongoError) {
    console.warn('[MongoDB] Connection failed, running in mock mode');
    console.warn('[MongoDB] Some features may be limited');
  }

  // Start workers
  try {
    startAllWorkers();
  } catch (workerError) {
    console.warn('[Workers] Failed to start workers:', workerError);
  }

  // Start listening
  app.listen(config.PORT, () => {
    console.log(`ReZ Economic Engine running on port config.PORT`);
    console.log(`Environment: ${config.NODE_ENV}`);
  });
}

// Handle graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down...');
  await mongoose.connection.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down...');
  await mongoose.connection.close();
  process.exit(0);
});

// Start the server
startServer();

export default app;
