/**
 * ReZ Service Template
 * Copy this as a starting point for new services
 */
import 'dotenv/config';
import express, { Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import mongoSanitize from 'express-mongo-sanitize';
import mongoose from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

// Middleware
import { authMiddleware } from './middleware/auth.js';
import { rateLimitMiddleware } from './middleware/rateLimit.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { requestIdMiddleware } from './middleware/requestLogger.js';

// Routes
import routes from './routes/index.js';

// Environment validation
const requiredEnv = ['PORT', 'MONGODB_URI', 'REDIS_URL', 'INTERNAL_SERVICE_TOKEN'];
for (const env of requiredEnv) {
  if (!process.env[env]) {
    console.error(`Missing required environment variable: ${env}`);
    process.exit(1);
  }
}

// Create Express app
const app: Express = express();
const PORT = parseInt(process.env.PORT || '3000', 10);

// Trust proxy for proper IP detection
app.set('trust proxy', 1);

// Request ID middleware
app.use((req, _res, next) => {
  req.requestId = (req.headers['x-request-id'] as string) || uuidv4();
  next();
});

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN?.split(',') || '*',
  credentials: true,
}));
app.use(compression());

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// MongoDB sanitize
app.use(mongoSanitize());

// Rate limiting
app.use(rateLimitMiddleware);

// Health check (no auth required)
app.get('/health', (_req, res) => {
  res.json({
    status: 'healthy',
    service: '[SERVICE_NAME]',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// Readiness check
app.get('/ready', async (_req, res) => {
  try {
    const mongoState = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
    if (mongoState !== 'connected') {
      res.status(503).json({ status: 'not ready', mongodb: mongoState });
      return;
    }
    res.json({ status: 'ready', mongodb: mongoState });
  } catch {
    res.status(503).json({ status: 'not ready' });
  }
});

// Auth middleware for API routes
app.use('/api', authMiddleware);

// API routes
app.use('/api', routes);

// 404 handler
app.use(notFoundHandler);

// Error handler
app.use(errorHandler);

// Graceful shutdown
const gracefulShutdown = (signal: string) => {
  console.log(`Received ${signal}. Shutting down gracefully...`);
  server.close(() => {
    console.log('HTTP server closed');
    mongoose.connection.close(false, () => {
      console.log('MongoDB connection closed');
      process.exit(0);
    });
  });
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Start server
const server = app.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════════════════════╗
║  [SERVICE_NAME]                                    ║
║  Port: ${PORT}                                       ║
║  Environment: ${process.env.NODE_ENV || 'development'}                          ║
╚══════════════════════════════════════════════════════╝
  `);

  // Connect to MongoDB
  mongoose.connect(process.env.MONGODB_URI!)
    .then(() => console.log('Connected to MongoDB'))
    .catch((err) => {
      console.error('MongoDB connection error:', err);
      process.exit(1);
    });
});

export default app;
