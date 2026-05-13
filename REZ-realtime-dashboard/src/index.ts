import express, { Request, Response, NextFunction } from 'express';
import { createServer } from 'http';
import cors from 'cors';
import dotenv from 'dotenv';
import { CampaignSocketHandler } from './websocket/campaignSocket.js';
import { AnalyticsSocketHandler } from './websocket/analyticsSocket.js';
import campaignRoutes from './routes/campaigns.js';
import analyticsRoutes from './routes/analytics.js';
import { broadcastService } from './services/broadcast.js';

// Load environment variables
dotenv.config();

const app = express();
const server = createServer(app);

// Configuration
const PORT = parseInt(process.env.PORT || '3001', 10);
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:3000';

// Middleware
app.use(cors({
  origin: CORS_ORIGIN,
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging middleware
app.use((req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path} ${res.statusCode} ${duration}ms`);
  });
  next();
});

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    ws: {
      connections: broadcastService.getConnectionCount(),
      rooms: broadcastService.getRoomCount(),
    },
  });
});

// Ready check (for load balancers)
app.get('/ready', (req: Request, res: Response) => {
  res.json({
    status: 'ready',
    timestamp: new Date().toISOString(),
  });
});

// API Routes
app.use('/api/campaigns', campaignRoutes);
app.use('/api/analytics', analyticsRoutes);

// Root endpoint
app.get('/', (req: Request, res: Response) => {
  res.json({
    name: 'ReZ Real-time Dashboard',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      ready: '/ready',
      campaigns: '/api/campaigns',
      analytics: '/api/analytics',
      websocket: {
        campaigns: '/ws/campaigns',
        analytics: '/ws/analytics',
      },
    },
  });
});

// WebSocket Handlers
const campaignSocket = new CampaignSocketHandler(server);
const analyticsSocket = new AnalyticsSocketHandler(server);

// Global error handler
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error('[Error]', err);
  res.status(500).json({
    success: false,
    error: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message,
  });
});

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: 'Not found',
  });
});

// Graceful shutdown
const shutdown = (signal: string) => {
  console.log(`\n[Server] Received ${signal}. Shutting down gracefully...`);

  // Close WebSocket connections
  campaignSocket.close();
  analyticsSocket.close();

  server.close((err) => {
    if (err) {
      console.error('[Server] Error during shutdown:', err);
      process.exit(1);
    }
    console.log('[Server] Closed successfully');
    process.exit(0);
  });

  // Force exit after timeout
  setTimeout(() => {
    console.error('[Server] Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Start server
server.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════════════════════════════╗
║           ReZ Real-time Dashboard Server                     ║
╠══════════════════════════════════════════════════════════════╣
║  HTTP:      http://localhost:${PORT}                            ║
║  WS:        ws://localhost:${PORT}/ws/campaigns                ║
║             ws://localhost:${PORT}/ws/analytics                ║
║                                                              ║
║  Health:    http://localhost:${PORT}/health                    ║
║  API:       http://localhost:${PORT}/api/campaigns             ║
║             http://localhost:${PORT}/api/analytics             ║
╠══════════════════════════════════════════════════════════════╣
║  Environment: ${process.env.NODE_ENV || 'development'}                                ║
╚══════════════════════════════════════════════════════════════╝
  `);
});

export { app, server };
