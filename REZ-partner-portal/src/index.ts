/**
 * REZ Partner Portal - Entry Point
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import mongoose from 'mongoose';
import { rateLimit } from 'express-rate-limit';
import routes from './routes';
import { errorHandler, notFoundHandler } from './middleware';

const app = express();
const PORT = parseInt(process.env.PORT || '4059', 10);
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/partner-portal';

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { success: false, error: 'Too many requests' },
});
app.use('/api/', limiter);

// Routes
app.use('/api', routes);

// Error handlers
app.use(notFoundHandler);
app.use(errorHandler);

// Database connection
async function connectDatabase(): Promise<void> {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log(`[${new Date().toISOString()}] Connected to MongoDB`);
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
}

// Start server
async function start(): Promise<void> {
  await connectDatabase();

  app.listen(PORT, () => {
    console.log(`[${new Date().toISOString()}] Partner Portal running on port ${PORT}`);
  });
}

start().catch(console.error);

export default app;
