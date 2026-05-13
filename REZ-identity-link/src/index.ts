/**
 * REZ Identity Link - Main Entry Point
 */

import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import mongoose from 'mongoose';
import { identityRoutes } from './routes/identity';
import { linkRequestService } from './models/LinkRequest';

// Initialize Express app
const app = express();

// Security middleware
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging (development)
if (process.env.NODE_ENV !== 'production') {
  app.use((req: Request, res: Response, next: NextFunction) => {
    console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
    next();
  });
}

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    service: 'rez-identity-link',
    timestamp: new Date().toISOString(),
    mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
  });
});

// Readiness check
app.get('/ready', async (req: Request, res: Response) => {
  try {
    // Check MongoDB connection
    if (mongoose.connection.readyState !== 1) {
      res.status(503).json({
        status: 'not ready',
        reason: 'MongoDB not connected',
      });
      return;
    }

    // Ping database
    await mongoose.connection.db?.admin().ping();

    res.json({
      status: 'ready',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(503).json({
      status: 'not ready',
      reason: (error as Error).message,
    });
  }
});

// API Routes
app.use('/api/identity', identityRoutes);

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
    path: req.path,
  });
});

// Global error handler
app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
  console.error('Unhandled error:', err);

  res.status(500).json({
    success: false,
    error: process.env.NODE_ENV === 'production'
      ? 'Internal server error'
      : err.message,
  });
});

// MongoDB connection configuration
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/rez_identity';

mongoose.connect(MONGODB_URI)
  .then(() => {
    console.log('Connected to MongoDB');

    // Start background tasks
    startBackgroundTasks();
  })
  .catch(err => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });

// MongoDB connection events
mongoose.connection.on('error', (err) => {
  console.error('MongoDB error:', err);
});

mongoose.connection.on('disconnected', () => {
  console.log('MongoDB disconnected');
});

mongoose.connection.on('reconnected', () => {
  console.log('MongoDB reconnected');
});

// Graceful shutdown
process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);

async function gracefulShutdown() {
  console.log('Shutting down gracefully...');

  try {
    await mongoose.connection.close();
    console.log('MongoDB connection closed');
    process.exit(0);
  } catch (error) {
    console.error('Error during shutdown:', error);
    process.exit(1);
  }
}

// Background tasks
function startBackgroundTasks(): void {
  // Expire old link requests every 5 minutes
  setInterval(async () => {
    try {
      const expired = await linkRequestService.expireOldRequests();
      if (expired > 0) {
        console.log(`Expired ${expired} old link requests`);
      }
    } catch (error) {
      console.error('Error expiring link requests:', error);
    }
  }, 5 * 60 * 1000);
}

// Start server
const PORT = process.env.PORT || 4017;

app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════════════╗
║     REZ Identity Link Service                       ║
╠════════════════════════════════════════════════════╣
║  Status:    Running                                 ║
║  Port:      ${PORT}                                    ║
║  Database:  MongoDB                                 ║
║  Env:       ${process.env.NODE_ENV || 'development'}                          ║
╚════════════════════════════════════════════════════╝
  `);
});

export default app;
