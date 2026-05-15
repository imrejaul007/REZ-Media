/**
 * @deprecated Use @rez/shared utilities instead.
 * This file provides local logger for backward compatibility.
 *
 * Migration:
 *   Before: import { logger, createServiceLogger } from './config/logger';
 *   After:  import { logger, createServiceLogger } from '@rez/shared';
 */

import winston from 'winston';

// Singleton logger instance shared across all consumers
const serviceLogger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    process.env.NODE_ENV === 'production'
      ? winston.format.json()
      : winston.format.combine(winston.format.colorize(), winston.format.simple()),
  ),
  defaultMeta: { service: process.env.SERVICE_NAME || 'karma-service' },
  transports: [new winston.transports.Console()],
});

/**
 * Create a component-scoped logger.
 * Returns an object with standard log methods, each tagged with the component name.
 */
export function createServiceLogger(component: string) {
  return {
    info: (message: string, meta?: Record<string, unknown>) => serviceLogger.info(message, { component, ...meta }),
    warn: (message: string, meta?: Record<string, unknown>) => serviceLogger.warn(message, { component, ...meta }),
    error: (message: string, meta?: Record<string, unknown>) => serviceLogger.error(message, { component, ...meta }),
    debug: (message: string, meta?: Record<string, unknown>) => serviceLogger.debug(message, { component, ...meta }),
  };
}

// Default logger export
export const logger = {
  info: (message: string, meta?: Record<string, unknown>) => serviceLogger.info(message, meta),
  warn: (message: string, meta?: Record<string, unknown>) => serviceLogger.warn(message, meta),
  error: (message: string, meta?: Record<string, unknown>) => serviceLogger.error(message, meta),
  debug: (message: string, meta?: Record<string, unknown>) => serviceLogger.debug(message, meta),
};
