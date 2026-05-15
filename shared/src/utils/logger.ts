/**
 * ReZ Shared Logger
 * Structured logging with winston
 */

import winston from 'winston';

const { combine, timestamp, printf, colorize, errors } = winston.format;

const logFormat = printf(({ level, message, timestamp, stack, ...metadata }) => {
  let msg = `${timestamp} [${level}]: ${message}`;
  if (Object.keys(metadata).length > 0) {
    msg += ` ${JSON.stringify(metadata)}`;
  }
  if (stack) {
    msg += `\n${stack}`;
  }
  return msg;
});

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: combine(
    errors({ stack: true }),
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    logFormat
  ),
  transports: [
    new winston.transports.Console({
      format: combine(
        colorize(),
        timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        logFormat
      ),
    }),
  ],
});

export function createServiceLogger(serviceName: string) {
  return {
    info: (message: string, metadata?: Record<string, unknown>) =>
      logger.info(message, { service: serviceName, ...metadata }),
    error: (message: string, error?: Error | unknown, metadata?: Record<string, unknown>) =>
      logger.error(message, {
        service: serviceName,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        ...metadata,
      }),
    warn: (message: string, metadata?: Record<string, unknown>) =>
      logger.warn(message, { service: serviceName, ...metadata }),
    debug: (message: string, metadata?: Record<string, unknown>) =>
      logger.debug(message, { service: serviceName, ...metadata }),
  };
}

export default logger;
