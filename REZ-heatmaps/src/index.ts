import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { heatmapService } from './services/heatmapService';
import heatmapRoutes from './routes/heatmaps';
import path from 'path';

const app: Express = express();

// Security middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

// CORS configuration
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
  credentials: true,
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'X-Internal-Token'],
}));

// Body parsing
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// Rate limiting headers (basic implementation)
app.use((req: Request, res: Response, next: NextFunction) => {
  const rateLimit = 100;
  const windowMs = 60 * 1000;

  res.setHeader('X-RateLimit-Limit', rateLimit.toString());
  res.setHeader('X-RateLimit-Remaining', rateLimit.toString());
  res.setHeader('X-RateLimit-Reset', (Date.now() + windowMs).toString());

  next();
});

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    service: 'rez-heatmaps',
    timestamp: Date.now(),
    uptime: process.uptime(),
  });
});

// Serve embeddable tracker script
app.get('/embed/heatmap.js', (req: Request, res: Response) => {
  const websiteId = req.query.websiteId as string;

  if (!websiteId) {
    res.status(400).json({ error: 'websiteId is required' });
    return;
  }

  const scriptPath = path.join(__dirname, 'embed', 'heatmap.js');
  res.setHeader('Content-Type', 'application/javascript');
  res.setHeader('Cache-Control', 'public, max-age=3600');
  res.sendFile(scriptPath);
});

// API routes
app.use('/api', heatmapRoutes);

// Serve static files for dashboard (optional)
app.use('/dashboard', express.static(path.join(__dirname, '../public')));

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({ error: 'Not found' });
});

// Error handler
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined,
  });
});

// Start server
const PORT = process.env.PORT || 4012;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/rez-heatmaps';

async function startServer(): Promise<void> {
  try {
    // Connect to databases
    await heatmapService.connect(MONGODB_URI);

    // Start listening
    app.listen(PORT, () => {
      console.log(`REZ Heatmaps service running on port ${PORT}`);
      console.log(`Health check: http://localhost:${PORT}/health`);
      console.log(`Embeddable tracker: http://localhost:${PORT}/embed/heatmap.js?websiteId=<YOUR_WEBSITE_ID>`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully');
  await heatmapService.disconnect();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully');
  await heatmapService.disconnect();
  process.exit(0);
});

// Export for testing
export { app, startServer };

// Start if running directly
if (require.main === module) {
  startServer();
}
