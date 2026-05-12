import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { instagramRouter } from './routes/instagram.routes';
import { logger } from './config/logger';

dotenv.config();

const app: Application = express();
const PORT = process.env.PORT || 4091;

// Middleware
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
  credentials: true
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logging middleware
app.use((req: Request, _res: Response, next: NextFunction) => {
  logger.info(`${req.method} ${req.path}`, {
    ip: req.ip,
    userAgent: req.get('user-agent')
  });
  next();
});

// Health check endpoint
app.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    service: 'rez-instagram-sales-agent',
    timestamp: new Date().toISOString()
  });
});

// Instagram routes
app.use('/api/instagram', instagramRouter);

// Webhook endpoint for Instagram
app.post('/api/instagram/webhook', async (req: Request, res: Response) => {
  try {
    const { body } = req;

    // Handle Instagram verification
    if (req.query['hub.mode'] === 'subscribe' && req.query['hub.verify_token']) {
      const verifyToken = process.env.INSTAGRAM_VERIFY_TOKEN;
      if (req.query['hub.verify_token'] === verifyToken) {
        logger.info('Instagram webhook verified');
        res.send(req.query['hub.challenge']);
        return;
      }
      res.sendStatus(403);
      return;
    }

    // Process webhook payload
    logger.info('Received Instagram webhook', { payload: body });

    // Process the webhook based on entry type
    if (body.object === 'instagram') {
      for (const entry of body.entry) {
        for (const messaging of entry.messaging) {
          // Handle different message types
          if (messaging.message) {
            logger.info('Received DM', {
              senderId: messaging.sender.id,
              messageId: messaging.message.mid
            });
          }
        }
      }
    }

    res.sendStatus(200);
  } catch (error) {
    logger.error('Webhook processing error', { error });
    res.sendStatus(500);
  }
});

// 404 handler
app.use((_req: Request, res: Response) => {
  res.status(404).json({
    error: 'Not Found',
    message: 'The requested endpoint does not exist'
  });
});

// Global error handler
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  logger.error('Unhandled error', {
    error: err.message,
    stack: err.stack
  });

  res.status(500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

// Start server
app.listen(PORT, () => {
  logger.info(`REZ Instagram Sales Agent running on port ${PORT}`);
  logger.info(`Health check: http://localhost:${PORT}/health`);
});

export default app;
