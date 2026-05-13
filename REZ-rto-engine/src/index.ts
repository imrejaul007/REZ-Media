import express, { Application, Request, Response } from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Import routes
import { scoreRouter, verifyRouter, decisionRouter } from './routes';
import { internalServiceAuth, optionalInternalAuth, requestLogger, errorHandler } from './middleware';
import { logger } from './config/logger';

// Initialize Express app
const app: Application = express();

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Internal-Token', 'X-Admin-Token'],
}));

// Rate limiting
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // Limit each IP to 1000 requests per windowMs
  message: {
    success: false,
    error: 'Too many requests',
    message: 'Please try again later',
  },
});

const strictLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // Limit each IP to 100 requests per windowMs
  message: {
    success: false,
    error: 'Too many requests',
    message: 'Rate limit exceeded, please try again later',
  },
});

// Apply rate limiters
app.use(generalLimiter);

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging
app.use(requestLogger);

// Health check endpoint (public)
app.get('/health', (req: Request, res: Response) => {
  const mongoStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';

  res.status(200).json({
    status: 'healthy',
    service: 'rez-rto-engine',
    version: process.env.npm_package_version || '1.0.0',
    timestamp: new Date().toISOString(),
    dependencies: {
      mongodb: mongoStatus,
    },
  });
});

// Ready check endpoint
app.get('/ready', (req: Request, res: Response) => {
  const mongoStatus = mongoose.connection.readyState === 1;

  if (!mongoStatus) {
    return res.status(503).json({
      status: 'not ready',
      reason: 'Database connection not established',
    });
  }

  res.status(200).json({
    status: 'ready',
    timestamp: new Date().toISOString(),
  });
});

// API v1 routes
// Apply strict rate limiting to API endpoints
app.use('/api/v1', strictLimiter);

// Score endpoint - requires internal service auth
app.use('/api/v1/score', internalServiceAuth, scoreRouter);

// Verify endpoint - requires internal service auth
app.use('/api/v1/verify', internalServiceAuth, verifyRouter);

// Decision endpoint - requires internal service auth
app.use('/api/v1/decision', internalServiceAuth, decisionRouter);

// Public risk check (limited) - for checkout widget
app.get('/api/v1/public/score/:orderId', async (req: Request, res: Response) => {
  try {
    const { orderId } = req.params;

    const { OrderRisk } = await import('./models/OrderRisk');
    const orderRisk = await OrderRisk.findOne({ orderId });

    if (!orderRisk) {
      return res.status(404).json({
        success: false,
        error: 'Order not found',
      });
    }

    // Return only public-safe information
    return res.status(200).json({
      success: true,
      data: {
        orderId: orderRisk.orderId,
        riskTier: orderRisk.riskTier,
        riskScore: orderRisk.riskScore,
        decision: orderRisk.codDecision,
        canProceed: orderRisk.codDecision !== 'BLOCKED',
      },
    });
  } catch (error) {
    logger.error('Error fetching public score', { orderId: req.params.orderId });
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch risk information',
    });
  }
});

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: 'Not found',
    message: `Route ${req.method} ${req.path} not found`,
  });
});

// Error handler
app.use(errorHandler);

// Database connection
const connectDatabase = async (): Promise<void> => {
  const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/rez_rto_engine';

  try {
    await mongoose.connect(mongoUri);
    logger.info('Connected to MongoDB', { mongoUri });
  } catch (error) {
    logger.error('Failed to connect to MongoDB', {
      error: error instanceof Error ? error.message : 'Unknown error',
      mongoUri,
    });
    throw error;
  }
};

// Graceful shutdown
const gracefulShutdown = async (signal: string): Promise<void> => {
  logger.info(`Received ${signal}, shutting down gracefully...`);

  try {
    await mongoose.connection.close();
    logger.info('MongoDB connection closed');

    process.exit(0);
  } catch (error) {
    logger.error('Error during shutdown', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    process.exit(1);
  }
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Start server
const startServer = async (): Promise<void> => {
  try {
    // Connect to database
    await connectDatabase();

    const port = parseInt(process.env.PORT || '3008', 10);
    const host = process.env.HOST || '0.0.0.0';

    app.listen(port, host, () => {
      logger.info(`REZ RTO Engine started`, {
        port,
        host,
        nodeEnv: process.env.NODE_ENV || 'development',
        mongoUri: process.env.MONGODB_URI || 'mongodb://localhost:27017/rez_rto_engine',
      });

      console.log(`
╔══════════════════════════════════════════════════════════════╗
║                  REZ RTO ENGINE                               ║
║              COD Fraud Prevention Service                     ║
╠══════════════════════════════════════════════════════════════╣
║  Status:    Running                                           ║
║  Port:      ${port.toString().padEnd(54)}║
║  Mode:      ${(process.env.NODE_ENV || 'development').padEnd(54)}║
║  Database:  MongoDB Connected                                 ║
╠══════════════════════════════════════════════════════════════╣
║  Endpoints:                                                   ║
║  GET  /health           Health check                          ║
║  GET  /ready            Readiness check                       ║
║  POST /api/v1/score     Get risk score                        ║
║  POST /api/v1/verify    Verify order                          ║
║  POST /api/v1/decision  Get COD decision                      ║
╚══════════════════════════════════════════════════════════════╝
      `);
    });
  } catch (error) {
    logger.error('Failed to start server', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    process.exit(1);
  }
};

// Start the server
startServer();

export default app;
