/**
 * REZ Payment Gateway - Main Entry Point
 * Handles wallet top-ups, ad payments, and payouts via Razorpay
 */

import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import mongoose from 'mongoose';
import crypto from 'crypto';
import { config } from 'dotenv';

// Load environment variables
config();

// Import routes
import { walletRoutes } from './routes/wallet';
import { adsRoutes } from './routes/ads';
import { payoutsRoutes } from './routes/payouts';
import { webhooksRoutes } from './routes/webhooks';

// Import services for initialization
import './services/razorpay';
import './services/walletService';
import './services/paymentService';

const app = express();

// ============================================================================
// Security Middleware
// ============================================================================

// Helmet for security headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", 'data:', 'https:'],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
  },
}));

// CORS
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Internal-Token', 'X-Idempotency-Key'],
}));

// ============================================================================
// Body Parsers
// ============================================================================

// Raw body parser for webhooks (must be before json parser)
app.use('/api/webhooks', express.raw({
  type: 'application/json',
  limit: '10mb',
}) as any);

// JSON parser for other routes
app.use(express.json({
  limit: '1mb',
}));

// URL-encoded parser
app.use(express.urlencoded({
  extended: true,
  limit: '1mb',
}));

// ============================================================================
// Health Check
// ============================================================================

app.get('/health', async (req: Request, res: Response) => {
  const mongoStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';

  const health = {
    status: 'ok',
    service: 'rez-payment-gateway',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    dependencies: {
      mongodb: mongoStatus,
      razorpay: process.env.RAZORPAY_KEY_ID ? 'configured' : 'missing',
    },
  };

  // If any dependency is down, return degraded status
  if (mongoStatus !== 'connected') {
    return res.status(503).json({
      ...health,
      status: 'degraded',
    });
  }

  res.json(health);
});

app.get('/health/ready', async (req: Request, res: Response) => {
  // Readiness probe - check if service can accept traffic
  const mongoConnected = mongoose.connection.readyState === 1;
  const razorpayConfigured = !!(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);

  if (mongoConnected && razorpayConfigured) {
    res.json({ ready: true });
  } else {
    res.status(503).json({
      ready: false,
      issues: {
        mongodb: mongoConnected ? 'ok' : 'not connected',
        razorpay: razorpayConfigured ? 'ok' : 'not configured',
      },
    });
  }
});

// ============================================================================
// Webhook Routes (before other routes, uses raw body)
// ============================================================================

app.use('/api/webhooks', webhooksRoutes);

// ============================================================================
// Internal Service Authentication
// ============================================================================

const INTERNAL_TOKEN = process.env.INTERNAL_SERVICE_TOKEN;

/**
 * Internal service authentication middleware
 */
function internalAuth(req: Request, res: Response, next: NextFunction): void {
  // Skip auth for health checks
  if (req.path.startsWith('/health')) {
    return next();
  }

  // Skip auth for webhooks (they use their own signature verification)
  if (req.path.startsWith('/api/webhooks')) {
    return next();
  }

  // Check for internal service token
  const providedToken = req.headers['x-internal-token'] as string;

  if (!INTERNAL_TOKEN) {
    console.warn('INTERNAL_SERVICE_TOKEN not configured - auth disabled');
    return next();
  }

  if (!providedToken) {
    res.status(401).json({
      success: false,
      error: 'Missing X-Internal-Token header',
    });
    return;
  }

  // Use timing-safe comparison
  const providedBuffer = Buffer.from(providedToken);
  const expectedBuffer = Buffer.from(INTERNAL_TOKEN);

  if (providedBuffer.length !== expectedBuffer.length ||
      !crypto.timingSafeEqual(providedBuffer, expectedBuffer)) {
    res.status(401).json({
      success: false,
      error: 'Invalid token',
    });
    return;
  }

  next();
}

// Apply internal auth to all routes except health
app.use(internalAuth);

// ============================================================================
// API Routes
// ============================================================================

app.use('/api/wallet', walletRoutes);
app.use('/api/ads', adsRoutes);
app.use('/api/payouts', payoutsRoutes);

// ============================================================================
// Error Handler
// ============================================================================

interface AppError extends Error {
  statusCode?: number;
  isOperational?: boolean;
}

app.use((err: AppError, req: Request, res: Response, next: NextFunction) => {
  console.error('Error:', {
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
    timestamp: new Date().toISOString(),
  });

  // Don't leak error details in production
  const isProd = process.env.NODE_ENV === 'production';

  res.status(err.statusCode || 500).json({
    success: false,
    error: isProd ? 'Internal server error' : err.message,
    ...(isProd ? {} : { stack: err.stack }),
  });
});

// ============================================================================
// 404 Handler
// ============================================================================

app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
    path: req.path,
  });
});

// ============================================================================
// MongoDB Connection
// ============================================================================

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/rez-payment-gateway';

async function connectDatabase(): Promise<void> {
  try {
    await mongoose.connect(MONGODB_URI, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });
    console.log('MongoDB connected:', MONGODB_URI);
  } catch (error: any) {
    console.error('MongoDB connection error:', error.message);
    // Don't exit in development, allow retry
    if (process.env.NODE_ENV === 'production') {
      process.exit(1);
    }
  }
}

// Handle MongoDB connection events
mongoose.connection.on('disconnected', () => {
  console.warn('MongoDB disconnected');
});

mongoose.connection.on('error', (err) => {
  console.error('MongoDB error:', err);
});

mongoose.connection.on('reconnected', () => {
  console.log('MongoDB reconnected');
});

// ============================================================================
// Start Server
// ============================================================================

const PORT = process.env.PORT || 4010;

// Graceful shutdown
async function gracefulShutdown(signal: string): Promise<void> {
  console.log(`Received ${signal}. Starting graceful shutdown...`);

  // Close MongoDB connection
  await mongoose.connection.close();
  console.log('MongoDB connection closed');

  process.exit(0);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Start server
async function start(): Promise<void> {
  // Connect to database
  await connectDatabase();

  app.listen(PORT, () => {
    console.log(`REZ Payment Gateway running on port ${PORT}`);
    console.log(`Health check: http://localhost:${PORT}/health`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`Razorpay configured: ${!!process.env.RAZORPAY_KEY_ID}`);
  });
}

start().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});

export default app;
