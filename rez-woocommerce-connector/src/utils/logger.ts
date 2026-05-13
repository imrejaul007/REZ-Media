/**
 * Logger Utility
 *
 * Winston-based structured logging with levels,
 * timestamps, and JSON output for production.
 */

import winston from 'winston';
import { appConfig } from '../config';

// Define log format
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  appConfig.isProduction
    ? winston.format.json()
    : winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(({ level, message, timestamp, ...meta }) => {
          const metaStr = Object.keys(meta).length
            ? ` ${JSON.stringify(meta)}`
            : '';
          return `${timestamp} [${level}]: ${message}${metaStr}`;
        })
      )
);

// Create logger instance
const logger: winston.Logger = winston.createLogger({
  level: appConfig.logging.level,
  format: logFormat,
  defaultMeta: {
    service: 'woocommerce-connector',
    env: appConfig.nodeEnv,
  },
  transports: [
    // Console transport
    new winston.transports.Console(),
  ],
  // Don't exit on unhandled exceptions in production
  exitOnError: appConfig.isDevelopment,
});

// Add file transport in production
if (appConfig.isProduction) {
  logger.add(
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    })
  );
  logger.add(
    new winston.transports.File({
      filename: 'logs/combined.log',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    })
  );
}

export default logger;

// ============================================
// Logging Helpers
// ============================================

/**
 * Log with request context
 */
export function logWithContext(
  log: winston.Logger,
  requestId: string,
  message: string,
  meta?: Record<string, unknown>
): void {
  log.info(message, { requestId, ...meta });
}

/**
 * Log webhook event
 */
export function logWebhookEvent(
  log: winston.Logger,
  event: string,
  resource: string,
  resourceId: number,
  storeUrl: string
): void {
  log.info(`Webhook event: ${event}`, {
    event,
    resource,
    resourceId,
    storeUrl,
  });
}

/**
 * Log sync operation
 */
export function logSyncOperation(
  log: winston.Logger,
  operation: 'start' | 'complete' | 'error',
  entityType: string,
  storeUrl: string,
  details?: Record<string, unknown>
): void {
  const messages = {
    start: `Sync started: ${entityType}`,
    complete: `Sync completed: ${entityType}`,
    error: `Sync error: ${entityType}`,
  };

  log.info(messages[operation], {
    operation,
    entityType,
    storeUrl,
    ...details,
  });
}
