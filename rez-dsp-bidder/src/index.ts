import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import mongoose from 'mongoose';
import rateLimit from 'express-rate-limit';
import { v4 as uuidv4 } from 'uuid';
import routes from './routes/index.js';
import { config } from './config/index.js';

const app = express();

// Request ID
app.use((req: Request, _res: Response, next: NextFunction) => {
  req.requestId = (req.headers['x-request-id'] as string) || uuidv4();
  next();
});

// Security
app.use(helmet());
app.use(cors({
  origin: config.corsOrigin.split(','),
  credentials: true,
}));
app.use(compression());

// Body parsing
app.use(express.json({ limit: '1mb' }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  message: { error: 'Too many requests' },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

// Health checks
app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'healthy', service: 'dsp-bidder', timestamp: new Date().toISOString() });
});

app.get('/ready', async (_req: Request, res: Response) => {
  const mongoState = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
  if (mongoState !== 'connected') {
    res.status(503).json({ status: 'not ready', mongodb: mongoState });
    return;
  }
  res.json({ status: 'ready', mongodb: mongoState });
});

// Auth middleware for API routes
app.use('/api', (req: Request, res: Response, next: NextFunction) => {
  const token = req.headers['x-internal-token'];
  if (token !== config.internalServiceToken) {
    res.status(401).json({ error: 'Unauthorized', requestId: req.requestId });
    return;
  }
  next();
});

// Routes
app.use('/api', routes);

// Error handler
app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
  console.error(JSON.stringify({
    level: 'error',
    requestId: req.requestId,
    error: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
  }));
  res.status(500).json({ error: 'Internal server error', requestId: req.requestId });
});

// Graceful shutdown
async function shutdown(signal: string) {
  console.log(`Received ${signal}, shutting down...`);
  await mongoose.connection.close();
  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Start
mongoose.connect(config.MONGODB_URI)
  .then(() => {
    console.log(`DSP Bidder running on port ${config.port}`);
    app.listen(config.port);
  })
  .catch((err) => {
    console.error('Failed to start:', err);
    process.exit(1);
  });

export default app;
