import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import mongoose from 'mongoose';
import winston from 'winston';
import dotenv from 'dotenv';

import { instagramConfig } from './config/instagram';
import { config } from './config';
import webhookRoutes from './routes/webhook.routes';
import dmRoutes from './routes/dm.routes';
import commentRoutes from './routes/comment.routes';
import settingsRoutes from './routes/settings.routes';

dotenv.config();

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' }),
  ],
});

const app: Express = express();

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Request logging middleware
app.use((req: Request, _res: Response, next: NextFunction) => {
  logger.info(`${req.method} ${req.path}`, {
    ip: req.ip,
    userAgent: req.get('user-agent'),
  });
  next();
});

// Health check endpoint
app.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    service: 'rez-instagram-bridge',
    timestamp: new Date().toISOString(),
  });
});

// API Routes
app.use('/webhook', webhookRoutes);
app.use('/api/dm', dmRoutes);
app.use('/api/comment', commentRoutes);
app.use('/api/settings', settingsRoutes);

// Error handling middleware
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  logger.error('Unhandled error', {
    error: err.message,
    stack: err.stack,
  });
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined,
  });
});

// 404 handler
app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: 'Not found' });
});

async function connectDatabase(): Promise<void> {
  const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/rez-instagram-bridge';

  try {
    await mongoose.connect(mongoUri);
    logger.info('Connected to MongoDB', { uri: mongoUri.replace(/\/\/.*@/, '//<credentials>@') });
  } catch (error) {
    logger.error('Failed to connect to MongoDB', { error });
    throw error;
  }
}

async function startServer(): Promise<void> {
  const port = parseInt(process.env.PORT || '4090', 10);

  try {
    await connectDatabase();

    // Initialize Instagram configuration
    await instagramConfig.initialize();

    app.listen(port, () => {
      logger.info(`REZ Instagram Bridge started`, {
        port,
        nodeEnv: process.env.NODE_ENV || 'development',
        webhookUrl: process.env.WEBHOOK_CALLBACK_URL,
      });
      console.log(`\n🚀 REZ Instagram Bridge Service running on port ${port}`);
      console.log(`📱 Webhook endpoint: /webhook/instagram`);
      console.log(`💬 DM API: /api/dm`);
      console.log(`💭 Comment API: /api/comment`);
      console.log(`⚙️  Settings API: /api/settings\n`);
    });
  } catch (error) {
    logger.error('Failed to start server', { error });
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  await mongoose.connection.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully');
  await mongoose.connection.close();
  process.exit(0);
});

startServer();

export { app, logger };
