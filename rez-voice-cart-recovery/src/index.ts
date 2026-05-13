import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import rateLimit from 'express-rate-limit';
import config from './config';
import routes from './routes';
import { campaignWorker } from './workers/campaignWorker';
import { CallModel } from './models/Call';
import { CampaignModel } from './models/Campaign';
import { ApiResponse } from './types';
import winston from 'winston';

// ============================================
// LOGGER SETUP
// ============================================

const logger = winston.createLogger({
  level: config.logLevel,
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ]
});

// ============================================
// EXPRESS APP SETUP
// ============================================

const app = express();

// Body parsing middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CORS configuration
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Internal-Token']
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: config.rateLimitWindowMs,
  max: config.rateLimitMax,
  message: {
    success: false,
    error: {
      code: 'RATE_LIMITED',
      message: 'Too many requests, please try again later'
    }
  },
  standardHeaders: true,
  legacyHeaders: false
});

app.use('/api', limiter);

// Trust proxy for rate limiting behind reverse proxy
app.set('trust proxy', 1);

// ============================================
// SECURITY MIDDLEWARE
// ============================================

// Internal service authentication
app.use('/api', (req: Request, res: Response, next: NextFunction) => {
  // Skip auth for health checks
  if (req.path === '/health') {
    return next();
  }

  // Skip auth for webhook endpoints (they use Twilio signature verification)
  if (req.path.includes('/webhook')) {
    return next();
  }

  const token = req.headers['x-internal-token'] as string;

  if (config.internalServiceToken && token !== config.internalServiceToken) {
    const response: ApiResponse = {
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Invalid or missing internal service token'
      }
    };
    return res.status(401).json(response);
  }

  next();
});

// Request logging
app.use((req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info(`${req.method} ${req.path} ${res.statusCode} ${duration}ms`);
  });

  next();
});

// ============================================
// TWILIO WEBHOOK ROUTES (Must be before body parser for TwiML)
// ============================================

// TwiML generation endpoints (no JSON body parsing)
app.post('/twiml/start/:callId', async (req: Request, res: Response) => {
  try {
    const { callId } = req.params;
    const { voiceService } = await import('./services/voiceService');

    const twiml = await voiceService.generateStartTwiML(callId);

    res.type('text/xml').send(twiml);
  } catch (error) {
    logger.error('Failed to generate TwiML:', error);
    res.type('text/xml').send('<?xml version="1.0" encoding="UTF-8"?><Response><Hangup/></Response>');
  }
});

app.post('/twiml/recording/:callId', async (req: Request, res: Response) => {
  try {
    const { callId } = req.params;
    const { voiceService } = await import('./services/voiceService');

    const { RecordingUrl, RecordingSid } = req.body;

    await voiceService.handleRecording(callId, RecordingUrl, RecordingSid);

    const twiml = await voiceService.generateGoodbyeTwiML(
      callId,
      "Thank you for your time. Have a great day!"
    );

    res.type('text/xml').send(twiml);
  } catch (error) {
    logger.error('Failed to process recording:', error);
    res.type('text/xml').send('<?xml version="1.0" encoding="UTF-8"?><Response><Hangup/></Response>');
  }
});

app.post('/twiml/continue/:callId', async (req: Request, res: Response) => {
  try {
    const { callId } = req.params;
    const { voiceService } = await import('./services/voiceService');

    const { SpeechResult, Confidence } = req.body;

    const response = await voiceService.processUserResponse(
      callId,
      SpeechResult || ''
    );

    const twiml = voiceService.generateUserInputTwiML(callId, response, false);

    res.type('text/xml').send(twiml);
  } catch (error) {
    logger.error('Failed to continue conversation:', error);
    res.type('text/xml').send('<?xml version="1.0" encoding="UTF-8"?><Response><Say>I apologize, but there was an error. Goodbye.</Say><Hangup/></Response>');
  }
});

app.post('/twiml/goodbye/:callId', async (req: Request, res: Response) => {
  try {
    const { callId } = req.params;
    const { voiceService } = await import('./services/voiceService');

    const twiml = await voiceService.generateGoodbyeTwiML(
      callId,
      "Thank you for your time. Have a great day!"
    );

    res.type('text/xml').send(twiml);
  } catch (error) {
    logger.error('Failed to generate goodbye:', error);
    res.type('text/xml').send('<?xml version="1.0" encoding="UTF-8"?><Response><Hangup/></Response>');
  }
});

app.post('/twiml/transfer/:callId', async (req: Request, res: Response) => {
  try {
    const { callId } = req.params;
    const { voiceService } = await import('./services/voiceService');

    const twiml = voiceService.generateTransferTwiML(callId);

    res.type('text/xml').send(twiml);
  } catch (error) {
    logger.error('Failed to generate transfer:', error);
    res.type('text/xml').send('<?xml version="1.0" encoding="UTF-8"?><Response><Say>I apologize, but there was an error transferring you. Goodbye.</Say><Hangup/></Response>');
  }
});

// ============================================
// API ROUTES
// ============================================

app.use(routes);

// ============================================
// ERROR HANDLING
// ============================================

// 404 handler
app.use((req: Request, res: Response) => {
  const response: ApiResponse = {
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: `Route ${req.method} ${req.path} not found`
    }
  };
  res.status(404).json(response);
});

// Global error handler
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  logger.error('Unhandled error:', err);

  const response: ApiResponse = {
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: config.env === 'development' ? err.message : 'An internal error occurred'
    }
  };

  res.status(500).json(response);
});

// ============================================
// DATABASE CONNECTION
// ============================================

async function connectToDatabase(): Promise<void> {
  try {
    await mongoose.connect(config.mongodbUri, {
      maxPoolSize: 10
    });
    logger.info('Connected to MongoDB');

    // Create indexes
    await createIndexes();
  } catch (error) {
    logger.error('Failed to connect to MongoDB:', error);
    throw error;
  }
}

async function createIndexes(): Promise<void> {
  try {
    await CallModel.createIndexes();
    await CampaignModel.createIndexes();
    logger.info('Database indexes created');
  } catch (error) {
    logger.warn('Failed to create some indexes:', error);
  }
}

// ============================================
// GRACEFUL SHUTDOWN
// ============================================

async function shutdown(): Promise<void> {
  logger.info('Shutting down gracefully...');

  // Stop accepting new requests
  // (Express server would be closed here if we had a server instance)

  // Stop campaign worker
  await campaignWorker.stop();

  // Close database connection
  await mongoose.connection.close();

  logger.info('Shutdown complete');
  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

// ============================================
// START SERVER
// ============================================

async function start(): Promise<void> {
  try {
    // Connect to database
    await connectToDatabase();

    // Initialize and start campaign worker
    await campaignWorker.initialize();
    campaignWorker.start();

    // Start listening for automation events
    await campaignWorker.listenToAutomationEvents();

    // Start HTTP server
    app.listen(config.port, () => {
      logger.info(`Voice Cart Recovery service running on port ${config.port}`);
      logger.info(`Environment: ${config.env}`);
      logger.info(`Twilio Account SID: ${config.twilioAccountSid ? 'configured' : 'NOT CONFIGURED'}`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Start the application
start();

export { app };
