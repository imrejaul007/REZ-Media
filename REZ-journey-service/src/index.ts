import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import journeyRoutes from './routes/journey.routes';
import { journeyWorker } from './workers/journeyWorker';
import { logger } from './utils/logger';
import { auth, rateLimit, requestId } from './middleware/auth';

// Initialize Express app
const app: Application = express();
const PORT = process.env.PORT || 4019;

// Middleware
app.use(requestId);
app.use(helmet());
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Internal-Token']
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(rateLimit);

// Request logging middleware
app.use((req: Request, _res: Response, next: NextFunction) => {
  logger.info(`${req.method} ${req.path}`, {
    query: req.query,
    ip: req.ip
  });
  next();
});

// API Routes
app.use('/api', journeyRoutes);

// Root endpoint
app.get('/', (_req: Request, res: Response) => {
  res.json({
    service: 'ReZ Journey Service',
    version: '1.0.0',
    status: 'running',
    port: PORT,
    endpoints: {
      health: '/api/health',
      journeys: '/api/journeys',
      entries: '/api/entries',
      triggers: '/api/triggers',
      templates: '/api/templates',
      worker: '/api/worker/status'
    }
  });
});

// 404 handler
app.use((_req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found'
  });
});

// Global error handler
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  logger.error('Unhandled error', { error: err.message, stack: err.stack });

  res.status(500).json({
    success: false,
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Start server
const server = app.listen(PORT, () => {
  logger.info(`ReZ Journey Service started on port ${PORT}`);
  logger.info(`API available at http://localhost:${PORT}/api`);

  // Start the journey worker
  journeyWorker.start();
  logger.info('Journey worker started');
});

// Graceful shutdown
const gracefulShutdown = (signal: string) => {
  logger.info(`${signal} received. Starting graceful shutdown...`);

  // Stop accepting new connections
  server.close(() => {
    logger.info('HTTP server closed');

    // Stop the worker
    journeyWorker.stop();
    logger.info('Journey worker stopped');

    // Close database connections, etc.
    logger.info('Graceful shutdown completed');

    process.exit(0);
  });

  // Force close after 30 seconds
  setTimeout(() => {
    logger.error('Could not close connections in time, forcefully shutting down');
    process.exit(1);
  }, 30000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (error: Error) => {
  logger.error('Uncaught Exception', { error: error.message, stack: error.stack });
  gracefulShutdown('uncaughtException');
});

process.on('unhandledRejection', (reason: unknown) => {
  logger.error('Unhandled Rejection', { reason });
});

// Export app for testing
export { app };
