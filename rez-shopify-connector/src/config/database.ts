import mongoose from 'mongoose';
import { logger } from './logger';

export async function connectDB(): Promise<void> {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI is required');

  await mongoose.connect(uri, {
    maxPoolSize: 50,
    minPoolSize: 10,
    serverSelectionTimeoutMS: 10_000,
    socketTimeoutMS: 45000,
    connectTimeoutMS: 10_000,
    retryWrites: true,
    w: 'majority',
  });

  logger.info('[DB] Connected to MongoDB');

  mongoose.connection.on('error', (err) => {
    logger.error('[DB] MongoDB error:', err);
  });

  mongoose.connection.on('disconnected', () => {
    logger.warn('[DB] MongoDB disconnected — will auto-reconnect');
  });
}
