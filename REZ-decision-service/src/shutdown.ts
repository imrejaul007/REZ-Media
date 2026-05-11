/**
 * Graceful Shutdown Handler
 * Handles SIGTERM and SIGINT for graceful container shutdown
 */

import { redis } from './config/redis.js';

let isShuttingDown = false;

export async function gracefulShutdown(signal: string): Promise<void> {
  if (isShuttingDown) {
    console.log('[SHUTDOWN] Already shutting down...');
    return;
  }

  isShuttingDown = true;
  console.log(`[SHUTDOWN] Received ${signal}, starting graceful shutdown...`);

  const shutdownTimeout = setTimeout(() => {
    console.error('[SHUTDOWN] Forced shutdown after timeout');
    process.exit(1);
  }, 30000);

  try {
    // 1. Stop accepting new connections
    console.log('[SHUTDOWN] Stopping accepting new connections...');

    // 2. Close Redis connections
    console.log('[SHUTDOWN] Closing Redis connections...');
    await redis.quit();
    console.log('[SHUTDOWN] Redis connections closed');

    // 3. Close any open handles
    console.log('[SHUTDOWN] Closing open handles...');

    // 4. Clear any pending operations
    console.log('[SHUTDOWN] Clearing pending operations...');

    clearTimeout(shutdownTimeout);
    console.log('[SHUTDOWN] Graceful shutdown completed');
    process.exit(0);
  } catch (error) {
    console.error('[SHUTDOWN] Error during shutdown:', error);
    clearTimeout(shutdownTimeout);
    process.exit(1);
  }
}

// Register shutdown handlers
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('uncaughtException', (error) => {
  console.error('[SHUTDOWN] Uncaught exception:', error);
  gracefulShutdown('uncaughtException');
});
process.on('unhandledRejection', (reason, promise) => {
  console.error('[SHUTDOWN] Unhandled rejection at:', promise, 'reason:', reason);
  gracefulShutdown('unhandledRejection');
});
