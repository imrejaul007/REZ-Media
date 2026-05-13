/**
 * WooCommerce Connector Service
 *
 * Main entry point for the ReZ WooCommerce integration service.
 */

import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import mongoose from 'mongoose';

import appConfig from './config';
import routes from './routes';
import { auth } from './middleware/auth';
import { webhookService } from './services/webhookService';
import logger from './utils/logger';

// ============================================
// Express Application
// ============================================

const app = express();

// Trust proxy (for rate limiting behind load balancer)
app.set('trust proxy', 1);

// Raw body parser for webhook signature verification
app.use(
  '/api/woocommerce/webhook',
  express.json({
    verify: (req: any, _res, buf) => {
      req.rawBody = buf.toString();
    },
  })
);

// Standard JSON parser for other routes
app.use(express.json({ limit: '10mb' }));

// Security middleware
app.use(helmet());
app.use(cors());
app.use(compression());

// Request logging
app.use((req: Request, _res: Response, next: NextFunction) => {
  logger.debug(`${req.method} ${req.path}`, {
    ip: req.ip,
    query: req.query,
  });
  next();
});

// Health check (no auth required)
app.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    service: 'woocommerce-connector',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

// API routes with authentication
app.use('/api/woocommerce', auth, routes);

// 404 handler
app.use((_req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: 'Not Found',
    message: 'The requested endpoint does not exist',
  });
});

// Global error handler
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  const errorId = `ERR-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

  logger.error(`[${errorId}] Error:`, {
    message: err.message,
    stack: err.stack,
  });

  // Determine status code
  let statusCode = 500;
  let message = 'Internal server error';

  if ('statusCode' in err) {
    statusCode = (err as any).statusCode;
  }

  if (err instanceof SyntaxError && 'body' in err) {
    statusCode = 400;
    message = 'Invalid JSON in request body';
  }

  res.status(statusCode).json({
    success: false,
    error: 'Internal server error',
    errorId,
    message: appConfig.isDevelopment ? err.message : message,
  });
});

// ============================================
// Database Connection
// ============================================

async function connectDatabase(): Promise<void> {
  try {
    await mongoose.connect(appConfig.mongodb.uri);
    logger.info('MongoDB connected successfully');
  } catch (error) {
    logger.error('MongoDB connection failed:', error);
    throw error;
  }
}

// ============================================
// Initialize Webhook Handlers
// ============================================

function initializeWebhookHandlers(): void {
  // Set up webhook event handlers
  webhookService.setHandlers({
    onCustomerCreated: async (customer, storeUrl) => {
      logger.info(`New customer from WooCommerce: ${customer.email}`);
      await webhookService.syncCustomerToReZ(customer, storeUrl);
    },
    onCustomerUpdated: async (customer, storeUrl) => {
      logger.info(`Customer updated in WooCommerce: ${customer.email}`);
      await webhookService.syncCustomerToReZ(customer, storeUrl);
    },
    onProductCreated: async (product, storeUrl) => {
      logger.info(`New product from WooCommerce: ${product.name}`);
      await webhookService.syncProductToReZ(product, storeUrl);
    },
    onProductUpdated: async (product, storeUrl) => {
      logger.info(`Product updated in WooCommerce: ${product.name}`);
      await webhookService.syncProductToReZ(product, storeUrl);
    },
    onOrderCreated: async (order, storeUrl) => {
      logger.info(`New order from WooCommerce: #${order.number}`);
      await webhookService.syncOrderToReZ(order, storeUrl);
    },
    onOrderUpdated: async (order, storeUrl) => {
      logger.info(`Order updated in WooCommerce: #${order.number}`);
      await webhookService.syncOrderToReZ(order, storeUrl);
    },
  });

  logger.info('Webhook handlers initialized');
}

// ============================================
// Graceful Shutdown
// ============================================

let isShuttingDown = false;

async function gracefulShutdown(signal: string): Promise<void> {
  if (isShuttingDown) return;
  isShuttingDown = true;

  logger.info(`Received ${signal}. Starting graceful shutdown...`);

  // Close database connection
  try {
    await mongoose.connection.close();
    logger.info('MongoDB connection closed');
  } catch (error) {
    logger.error('Error closing MongoDB:', error);
  }

  process.exit(0);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception:', error);
  gracefulShutdown('uncaughtException');
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled rejection:', { reason, promise });
});

// ============================================
// Start Server
// ============================================

async function startServer(): Promise<void> {
  try {
    // Connect to database
    await connectDatabase();

    // Initialize webhook handlers
    initializeWebhookHandlers();

    // Start HTTP server
    app.listen(appConfig.port, () => {
      logger.info(`WooCommerce Connector started on port ${appConfig.port}`);
      logger.info(`Environment: ${appConfig.nodeEnv}`);
      logger.info(`MongoDB: ${appConfig.mongodb.uri}`);
      logger.info(`Redis: ${appConfig.redis.url}`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Start the server
startServer();

export default app;
