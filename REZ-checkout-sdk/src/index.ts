import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { v4 as uuidv4 } from 'uuid';

// Load environment variables
dotenv.config();

// Import routes
import cartRoutes from './routes/cart';
import checkoutRoutes from './routes/checkout';
import addressRoutes from './routes/address';
import paymentRoutes from './routes/payment';
import orderRoutes from './routes/orders';

// Import middleware
import { authenticate, optionalAuth } from './middleware/auth';
import { fraudCheck } from './middleware/fraudCheck';

// Configuration
const PORT = parseInt(process.env.PORT || '3000', 10);
const NODE_ENV = process.env.NODE_ENV || 'development';
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/rez-checkout';
const CORS_ORIGINS = (process.env.CORS_ORIGINS || 'http://localhost:3000').split(',');

// Create Express app
const app: Express = express();

// Security middleware
app.use(helmet());

// CORS configuration
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || CORS_ORIGINS.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`CORS policy violation: origin ${origin} not allowed`));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Session-Id', 'X-Internal-Token'],
}));

// Compression
app.use(compression());

// Request logging
app.use(morgan(NODE_ENV === 'production' ? 'combined' : 'dev'));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Trust proxy (for rate limiting behind load balancer)
app.set('trust proxy', 1);

// Generate session ID for requests without one
app.use((req: Request, _res: Response, next: NextFunction) => {
  if (!req.headers['x-session-id'] && !req.headers.authorization) {
    req.headers['x-session-id'] = uuidv4();
  }
  next();
});

// Health check endpoint
app.get('/health', (_req: Request, res: Response) => {
  const mongoStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';

  res.json({
    status: 'healthy',
    version: process.env.API_VERSION || 'v1',
    timestamp: new Date().toISOString(),
    services: {
      mongodb: mongoStatus,
    },
  });
});

// Readiness check endpoint
app.get('/ready', async (_req: Request, res: Response) => {
  try {
    // Check MongoDB connection
    await mongoose.connection.db?.admin().ping();

    res.json({
      status: 'ready',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(503).json({
      status: 'not ready',
      error: 'Database connection failed',
    });
  }
});

// API routes
const API_PREFIX = `/${process.env.API_VERSION || 'v1'}`;

// Apply authentication middleware to protected routes
app.use(`${API_PREFIX}/cart`, authenticate, fraudCheck, cartRoutes);
app.use(`${API_PREFIX}/checkout`, optionalAuth, checkoutRoutes);
app.use(`${API_PREFIX}/addresses`, authenticate, addressRoutes);
app.use(`${API_PREFIX}/payment`, optionalAuth, paymentRoutes);
app.use(`${API_PREFIX}/orders`, orderRoutes);

// API documentation endpoint
app.get(API_PREFIX, (_req: Request, res: Response) => {
  res.json({
    name: 'ReZ Checkout SDK',
    version: '1.0.0',
    description: 'Universal one-click checkout for merchants',
    endpoints: {
      cart: {
        'GET /cart': 'Get current cart',
        'GET /cart/count': 'Get cart item count',
        'POST /cart/items': 'Add item to cart',
        'PUT /cart/items/:productId': 'Update cart item',
        'DELETE /cart/items/:productId': 'Remove item from cart',
        'DELETE /cart': 'Clear cart',
        'POST /cart/quick-buy': 'Quick buy (single item)',
        'POST /cart/discount': 'Apply discount',
        'POST /cart/merge': 'Merge guest cart to user',
      },
      checkout: {
        'GET /checkout/summary': 'Get checkout summary',
        'GET /checkout/payment-methods': 'Get available payment methods',
        'POST /checkout/payment/route': 'Get payment routing',
        'POST /checkout': 'Process checkout',
        'POST /checkout/reorder': 'One-tap reorder',
        'POST /checkout/shipping/calculate': 'Calculate shipping',
        'POST /checkout/validate': 'Validate checkout',
      },
      addresses: {
        'GET /addresses': 'Get all addresses',
        'GET /addresses/default': 'Get default address',
        'GET /addresses/:id': 'Get specific address',
        'POST /addresses': 'Add new address',
        'PUT /addresses/:id': 'Update address',
        'DELETE /addresses/:id': 'Delete address',
        'POST /addresses/:id/default': 'Set as default',
        'POST /addresses/validate': 'Validate address',
        'POST /addresses/normalize': 'Normalize address',
        'GET /addresses/validate/pincode/:pinCode': 'Validate PIN code',
      },
      payment: {
        'POST /payment/route': 'Smart payment routing',
        'GET /payment/methods': 'Get available methods',
        'GET /payment/methods/:method/eligibility': 'Check method eligibility',
        'POST /payment/cod/check': 'Check COD eligibility',
        'POST /payment/preferred': 'Set preferred method',
        'GET /payment/preferred': 'Get preferred method',
        'POST /payment/validate': 'Validate payment',
        'POST /payment/refund': 'Process refund',
      },
      orders: {
        'GET /orders': 'Get user orders',
        'GET /orders/:orderId': 'Get order details',
        'GET /orders/:orderId/tracking': 'Get tracking info',
        'POST /orders/:orderId/cancel': 'Cancel order',
        'PUT /orders/:orderId/status': 'Update order status',
        'GET /orders/stats/summary': 'Get order statistics',
        'POST /orders/:orderId/payment/confirm': 'Confirm payment',
      },
    },
  });
});

// 404 handler
app.use((_req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
    code: 'NOT_FOUND',
  });
});

// Global error handler
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Unhandled error:', err);

  // Don't leak error details in production
  const message = NODE_ENV === 'production'
    ? 'Internal server error'
    : err.message;

  res.status(500).json({
    success: false,
    error: message,
    code: 'INTERNAL_ERROR',
  });
});

// Database connection
const connectDB = async (): Promise<void> => {
  try {
    await mongoose.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });
    console.log('MongoDB connected successfully');
  } catch (error) {
    console.error('MongoDB connection error:', error);
    // Don't exit in production - let the service restart
    if (NODE_ENV === 'development') {
      process.exit(1);
    }
  }
};

// Graceful shutdown
const gracefulShutdown = async (signal: string): Promise<void> => {
  console.log(`Received ${signal}. Starting graceful shutdown...`);

  try {
    await mongoose.connection.close();
    console.log('MongoDB connection closed');
    process.exit(0);
  } catch (error) {
    console.error('Error during shutdown:', error);
    process.exit(1);
  }
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  if (NODE_ENV === 'development') {
    process.exit(1);
  }
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Start server
const startServer = async (): Promise<void> => {
  await connectDB();

  app.listen(PORT, () => {
    console.log(`
╔═══════════════════════════════════════════════════════════════╗
║                   ReZ Checkout SDK                            ║
╠═══════════════════════════════════════════════════════════════╣
║  Server running on port ${PORT}                                  ║
║  Environment: ${NODE_ENV.padEnd(42)}║
║  API Base URL: http://localhost:${PORT}/${process.env.API_VERSION || 'v1'}        ║
║  Health Check: http://localhost:${PORT}/health                  ║
╚═══════════════════════════════════════════════════════════════╝
    `);
  });
};

startServer().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});

export default app;
