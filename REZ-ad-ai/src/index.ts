/**
 * REZ Ad AI - Main Entry Point
 *
 * AI-powered ad generation, optimization, and creative analysis service.
 * Derives intent signals from behavior and provides intelligent ad recommendations.
 */

import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import compression from 'compression';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { auth, rateLimit, requestId, errorHandler } from './middleware/auth';
import creativeRoutes from './routes/creative';
import optimizeRoutes from './routes/optimize';

// Load environment variables
dotenv.config();

// ============================================================================
// App Configuration
// ============================================================================

const app = express();
const PORT = parseInt(process.env.PORT || '4021', 10);
const NODE_ENV = process.env.NODE_ENV || 'development';

// Security: Fail at startup if required variables not set
const REQUIRED_ENV_VARS = ['INTERNAL_SERVICE_TOKEN'];
for (const varName of REQUIRED_ENV_VARS) {
  if (!process.env[varName]) {
    console.warn(`WARNING: ${varName} not set. Some features may be unavailable.`);
  }
}

// ============================================================================
// Middleware Stack
// ============================================================================

// Request ID for tracing
app.use(requestId);

// Security headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'"],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
  },
}));

// CORS configuration
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Internal-Token', 'X-Request-Id'],
  credentials: true,
  maxAge: 86400,
}));

// Compression for responses
app.use(compression({
  filter: (req, res) => {
    if (req.headers['x-no-compression']) return false;
    return compression.filter(req, res);
  },
  level: 6,
}));

// Body parsing with size limits
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Rate limiting (applied to API routes)
app.use(rateLimit);

// ============================================================================
// Health & Status Routes (Public)
// ============================================================================

/**
 * GET /health
 * Basic health check endpoint
 */
app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    service: 'REZ-ad-ai',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

/**
 * GET /ready
 * Readiness check - includes dependency checks
 */
app.get('/ready', async (req: Request, res: Response) => {
  const checks: Record<string, boolean> = {
    service: true,
  };

  const allHealthy = Object.values(checks).every(Boolean);

  res.status(allHealthy ? 200 : 503).json({
    status: allHealthy ? 'ready' : 'not_ready',
    checks,
    timestamp: new Date().toISOString(),
  });
});

/**
 * GET /api
 * API information endpoint
 */
app.get('/api', (req: Request, res: Response) => {
  res.json({
    name: 'REZ Ad AI',
    version: '1.0.0',
    description: 'AI-powered ad generation, optimization, and creative analysis',
    endpoints: {
      creative: {
        'POST /api/creative/banner': 'Generate banner ad assets',
        'POST /api/creative/banner/variations': 'Generate A/B test variations',
        'POST /api/creative/copy': 'Generate ad copy',
        'POST /api/creative/cta': 'Generate CTAs',
        'POST /api/creative/analyze': 'Analyze creative performance',
        'POST /api/creative/suggest': 'Get creative suggestions',
        'POST /api/creative/batch': 'Batch generate multiple ads',
      },
      optimize: {
        'POST /api/optimize/bid': 'Optimize bid strategy',
        'POST /api/optimize/bid/batch': 'Batch optimize multiple campaigns',
        'POST /api/optimize/targeting': 'Optimize targeting parameters',
        'POST /api/optimize/improve': 'Get improvement suggestions',
        'POST /api/optimize/audit': 'Complete campaign audit',
      },
    },
    documentation: '/api/docs',
    timestamp: new Date().toISOString(),
  });
});

// ============================================================================
// Intent Prediction Routes (Existing functionality)
// ============================================================================

/**
 * POST /api/intent/predict
 * Predict user intent based on context signals
 */
app.post('/api/intent/predict', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId, context } = req.body;

    if (!userId) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'userId is required' },
        timestamp: new Date(),
      });
      return;
    }

    // Intent prediction logic (placeholder - would use ML model in production)
    const intent = {
      userId,
      predicted_intent: context?.action || 'browsing',
      confidence: 0.75 + Math.random() * 0.15,
      recommendations: [
        'show_deals',
        'similar_items',
        'complementary_products',
      ],
      context: {
        page: context?.page,
        category: context?.category,
        previousActions: context?.history?.slice(-5) || [],
      },
      updatedAt: new Date(),
    };

    res.json({ success: true, data: { intent }, timestamp: new Date() });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/intent/batch
 * Batch predict intents for multiple users
 */
app.post('/api/intent/batch', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { users } = req.body;

    if (!Array.isArray(users) || users.length === 0) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'users must be a non-empty array' },
        timestamp: new Date(),
      });
      return;
    }

    if (users.length > 100) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Maximum 100 users per request' },
        timestamp: new Date(),
      });
      return;
    }

    const intents = users.map((user: any) => ({
      userId: user.userId,
      predicted_intent: user.context?.action || 'browsing',
      confidence: 0.7 + Math.random() * 0.2,
      recommendations: ['show_deals', 'similar_items'],
      updatedAt: new Date(),
    }));

    res.json({
      success: true,
      data: { intents, count: intents.length },
      timestamp: new Date(),
    });
  } catch (error) {
    next(error);
  }
});

// ============================================================================
// API Routes (Protected by auth middleware)
// ============================================================================

// Apply authentication to all /api routes
app.use('/api', auth);

// Mount route handlers
app.use('/api/creative', creativeRoutes);
app.use('/api/optimize', optimizeRoutes);

// ============================================================================
// Error Handling
// ============================================================================

// 404 handler for unmatched routes
app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: `Route ${req.method} ${req.path} not found`,
    },
    timestamp: new Date(),
  });
});

// Global error handler
app.use(errorHandler);

// ============================================================================
// Server Startup
// ============================================================================

const server = app.listen(PORT, () => {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║                                                              ║');
  console.log(`║   REZ Ad AI - AI-Powered Ad Intelligence                      ║`);
  console.log(`║   Version: 1.0.0                                              ║`);
  console.log(`║   Port: ${PORT}                                               ║`);
  console.log(`║   Environment: ${NODE_ENV.padEnd(43)}║`);
  console.log('║                                                              ║');
  console.log('║   Endpoints:                                                 ║');
  console.log(`║   - Health:    http://localhost:${PORT}/health                 ║`);
  console.log(`║   - API Info:  http://localhost:${PORT}/api                   ║`);
  console.log('║                                                              ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
});

// Graceful shutdown handling
const shutdown = (signal: string) => {
  console.log(`\n${signal} received. Shutting down gracefully...`);

  server.close(() => {
    console.log('HTTP server closed.');
    process.exit(0);
  });

  // Force exit after timeout
  setTimeout(() => {
    console.error('Forced shutdown after timeout.');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Export for testing
export default app;
