/**
 * Local logger implementation for media events service.
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

const logger = winston.createLogger({
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
        errors({ stack: true }),
        timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        logFormat
      ),
    }),
  ],
});

export { logger };

export function createServiceLogger(serviceName: string) {
  return {
    info: (message: string, meta?: object) => logger.info(message, { service: serviceName, ...meta }),
    error: (message: string, meta?: object) => logger.error(message, { service: serviceName, ...meta }),
    warn: (message: string, meta?: object) => logger.warn(message, { service: serviceName, ...meta }),
    debug: (message: string, meta?: object) => logger.debug(message, { service: serviceName, ...meta }),
  };
}
