/**
 * REZ Anniversary Rewards Service
 *
 * Express server for anniversary rewards management
 * - Anniversary date detection
 * - Milestone rewards (1yr, 2yr, 3yr, 5yr, 10yr)
 * - Tenure-based offers
 * - Analytics tracking
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { router as anniversaryRoutes } from './routes/anniversary';

const app = express();

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
  credentials: true,
}));

// Compression
app.use(compression());

// Body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // 100 requests per minute
  message: { success: false, error: 'Too many requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api/', limiter);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'REZ-anniversary-rewards',
    timestamp: new Date().toISOString(),
  });
});

// Readiness check
app.get('/ready', (req, res) => {
  res.json({
    status: 'ready',
    service: 'REZ-anniversary-rewards',
  });
});

// API Routes
app.use('/api/anniversary', anniversaryRoutes);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    service: 'REZ Anniversary Rewards Service',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      ready: '/ready',
      anniversary: {
        config: 'GET/PUT /api/anniversary/config/:merchantId',
        milestones: 'GET/PUT /api/anniversary/milestones/:merchantId',
        tenure: 'GET /api/anniversary/tenure/:merchantId/:userId',
        calculateTenure: 'POST /api/anniversary/calculate-tenure',
        eligibility: 'GET /api/anniversary/eligibility/:merchantId/:userId',
        offers: 'GET /api/anniversary/offers/:merchantId/:userId',
        generateOffer: 'POST /api/anniversary/generate-offer',
        claim: 'POST /api/anniversary/claim',
        analytics: 'GET /api/anniversary/analytics/:merchantId',
        trigger: 'POST /api/anniversary/trigger',
        channels: 'GET /api/anniversary/channels',
      },
    },
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
  });
});

// Error handler
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err.message);
  res.status(500).json({
    success: false,
    error: 'Internal server error',
  });
});

// Start server
const PORT = process.env.PORT || 4035;

app.listen(PORT, () => {
  console.log(`REZ Anniversary Rewards Service running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`API docs: http://localhost:${PORT}/`);
});

export default app;
