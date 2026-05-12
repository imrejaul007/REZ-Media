import express, { Express, Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import winston from 'winston';
import { configManager, appConfig } from './config';
import { createCartRoutes } from './routes/cart.routes';
import { createCheckoutRoutes } from './routes/checkout.routes';
import { createOrderRoutes } from './routes/order.routes';
import { messageHandler, WhatsAppMessage } from './handlers/messageHandler';
import { Twilio } from 'twilio';

// Logger setup
const logger = winston.createLogger({
  level: configManager.get().logging.level,
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
      ),
    }),
  ],
});

// Twilio client
const twilioClient = new Twilio(
  configManager.get().twilio.accountSid,
  configManager.get().twilio.authToken
);

// Create Express app
const app: Express = express();

// Middleware
app.use(helmet({
  contentSecurityPolicy: false,
}));
app.use(cors());
app.use(compression());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req: Request, res: Response, next: NextFunction) => {
  logger.info('Incoming request', {
    method: req.method,
    path: req.path,
    ip: req.ip,
  });
  next();
});

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    service: 'rez-whatsapp-store',
    timestamp: new Date().toISOString(),
    mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
  });
});

// Readiness check
app.get('/ready', async (req: Request, res: Response) => {
  const checks = {
    mongodb: mongoose.connection.readyState === 1,
    twilio: !!twilioClient,
  };

  const allReady = Object.values(checks).every(Boolean);

  res.status(allReady ? 200 : 503).json({
    ready: allReady,
    checks,
  });
});

// WhatsApp webhook verification (GET)
app.get('/webhook/whatsapp', (req: Request, res: Response) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  const verifyToken = configManager.get().whatsapp.verifyToken;

  if (mode === 'subscribe' && token === verifyToken) {
    logger.info('Webhook verified');
    res.status(200).send(challenge);
  } else {
    logger.warn('Webhook verification failed');
    res.status(403).send('Forbidden');
  }
});

// WhatsApp webhook (POST)
app.post('/webhook/whatsapp', async (req: Request, res: Response) => {
  try {
    const { entry } = req.body;

    if (!entry || !entry[0]?.changes) {
      return res.status(400).send('Bad Request');
    }

    const changes = entry[0].changes;

    for (const change of changes) {
      if (change.value?.messages) {
        for (const message of change.value.messages) {
          await processIncomingMessage(message);
        }
      }
    }

    // Respond quickly to WhatsApp
    res.status(200).send('OK');
  } catch (error) {
    logger.error('Webhook error', { error });
    res.status(500).send('Internal Server Error');
  }
});

// Process incoming WhatsApp message
async function processIncomingMessage(message: {
  from: string;
  id: string;
  timestamp: string;
  type: string;
  text?: { body: string };
}): Promise<void> {
  const phoneNumber = message.from.replace('whatsapp:', '');

  logger.info('Processing WhatsApp message', {
    messageId: message.id,
    from: phoneNumber,
    type: message.type,
  });

  try {
    if (message.type === 'text' && message.text?.body) {
      const whatsappMessage: WhatsAppMessage = {
        from: phoneNumber,
        to: configManager.get().twilio.whatsappFrom,
        body: message.text.body,
        messageId: message.id,
        timestamp: message.timestamp,
        type: 'text',
      };

      const response = await messageHandler.handleIncomingMessage(whatsappMessage);

      // Send responses
      for (const outboundMessage of response.messages) {
        await sendWhatsAppMessage(outboundMessage);
      }
    } else if (message.type === 'interactive') {
      // Handle button replies and list selections
      const interactive = req.body.entry?.[0]?.changes?.[0]?.value?.messages?.[0]?.interactive;
      if (interactive) {
        const buttonReply = interactive.button_reply?.id;
        const listReply = interactive.list_reply?.id;

        const responseText = buttonReply || listReply || '';

        const whatsappMessage: WhatsAppMessage = {
          from: phoneNumber,
          to: configManager.get().twilio.whatsappFrom,
          body: responseText,
          messageId: message.id,
          timestamp: message.timestamp,
          type: 'text',
        };

        const response = await messageHandler.handleIncomingMessage(whatsappMessage);

        for (const outboundMessage of response.messages) {
          await sendWhatsAppMessage(outboundMessage);
        }
      }
    }
  } catch (error) {
    logger.error('Error processing message', { error, messageId: message.id });

    // Send error message
    await sendWhatsAppMessage({
      type: 'text',
      to: phoneNumber,
      body: 'Sorry, something went wrong. Please try again.',
    });
  }
}

// Send WhatsApp message via Twilio
async function sendWhatsAppMessage(message: {
  type: 'text' | 'interactive' | 'image' | 'document' | 'template';
  to: string;
  body?: string;
  interactive?: Record<string, unknown>;
  mediaUrl?: string;
  filename?: string;
  caption?: string;
}): Promise<void> {
  try {
    const from = `whatsapp:${configManager.get().twilio.whatsappFrom}`;
    const to = `whatsapp:${message.to}`;

    const messageData: Record<string, unknown> = {
      from,
      to,
    };

    switch (message.type) {
      case 'text':
        messageData.body = message.body;
        break;
      case 'interactive':
        messageData.contentSid = undefined;
        messageData.hsmId = undefined;
        (messageData as Record<string, unknown>).contentVariables = undefined;
        messageData.to = to;
        messageData.from = from;
        messageData.content = message.interactive;
        break;
      case 'image':
        messageData.mediaUrl = message.mediaUrl;
        messageData.caption = message.caption;
        break;
      case 'document':
        messageData.mediaUrl = message.mediaUrl;
        messageData.filename = message.filename;
        break;
    }

    await twilioClient.messages.create({
      from,
      to,
      ...(message.type === 'text' && { body: message.body }),
      ...(message.type === 'interactive' && { content: message.interactive }),
      ...(message.type === 'image' && { mediaUrl: message.mediaUrl, caption: message.caption }),
      ...(message.type === 'document' && { mediaUrl: message.mediaUrl, filename: message.filename }),
    } as Parameters<typeof twilioClient.messages.create>[0]);

    logger.info('WhatsApp message sent', { to: message.to, type: message.type });
  } catch (error) {
    logger.error('Error sending WhatsApp message', { error, to: message.to });
  }
}

// API Routes
app.use('/api/cart', createCartRoutes());
app.use('/api/checkout', createCheckoutRoutes());
app.use('/api/orders', createOrderRoutes());

// Products API
app.get('/api/products', async (req: Request, res: Response) => {
  const { catalogService } = await import('./services/catalogService');
  const { page = 1, limit = 10, category, search } = req.query;

  const result = await catalogService.getProducts(
    {
      category: category as string,
      search: search as string,
    },
    {
      page: parseInt(page as string),
      limit: parseInt(limit as string),
    }
  );

  res.json(result);
});

app.get('/api/products/featured', async (req: Request, res: Response) => {
  const { catalogService } = await import('./services/catalogService');
  const { limit = 5 } = req.query;

  const products = await catalogService.getFeaturedProducts(parseInt(limit as string));

  res.json({ success: true, products });
});

app.get('/api/products/categories', async (req: Request, res: Response) => {
  const { catalogService } = await import('./services/catalogService');
  const categories = await catalogService.getCategories();

  res.json({ success: true, categories });
});

app.get('/api/products/:productId', async (req: Request, res: Response) => {
  const { catalogService } = await import('./services/catalogService');
  const { productId } = req.params;

  const product = await catalogService.getProduct(productId);

  if (!product) {
    return res.status(404).json({ success: false, error: 'Product not found' });
  }

  res.json({ success: true, product });
});

// Error handling middleware
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  logger.error('Unhandled error', {
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
  });

  res.status(500).json({
    success: false,
    error: 'Internal Server Error',
    message: configManager.isDevelopment() ? err.message : undefined,
  });
});

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: 'Not Found',
  });
});

// Connect to MongoDB and start server
async function startServer(): Promise<void> {
  try {
    // Connect to MongoDB
    const mongoUri = configManager.get().mongodb.uri;
    logger.info('Connecting to MongoDB...', { uri: mongoUri.replace(/\/\/.*@/, '//<credentials>@') });

    await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });

    logger.info('Connected to MongoDB');

    // Create indexes
    await createIndexes();

    // Start HTTP server
    const port = configManager.get().port;
    app.listen(port, () => {
      logger.info(`REZ WhatsApp Store Service started`, {
        port,
        env: configManager.get().env,
      });
      logger.info(`Health check: http://localhost:${port}/health`);
      logger.info(`Webhook URL: http://localhost:${port}/webhook/whatsapp`);
    });
  } catch (error) {
    logger.error('Failed to start server', { error });
    process.exit(1);
  }
}

// Create MongoDB indexes
async function createIndexes(): Promise<void> {
  const { Cart } = await import('./models/Cart');
  const { Order } = await import('./models/Order');
  const { Checkout } = await import('./models/Checkout');

  try {
    await Cart.createIndexes();
    await Order.createIndexes();
    await Checkout.createIndexes();
    logger.info('MongoDB indexes created');
  } catch (error) {
    logger.warn('Error creating indexes', { error });
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received. Shutting down gracefully...');

  try {
    await mongoose.connection.close();
    logger.info('MongoDB connection closed');

    process.exit(0);
  } catch (error) {
    logger.error('Error during shutdown', { error });
    process.exit(1);
  }
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received. Shutting down gracefully...');

  try {
    await mongoose.connection.close();
    logger.info('MongoDB connection closed');

    process.exit(0);
  } catch (error) {
    logger.error('Error during shutdown', { error });
    process.exit(1);
  }
});

// Start the server
startServer();

export { app };
