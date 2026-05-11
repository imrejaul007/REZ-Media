/**
 * Winston logger configuration for REZ Communications Platform
 */

import winston from 'winston';
import path from 'path';

const { combine, timestamp, printf, colorize, errors, json } = winston.format;

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

const structuredLogFormat = printf(({ level, message, timestamp, ...metadata }) => {
  return JSON.stringify({
    timestamp,
    level,
    message,
    ...metadata
  });
});

export const createLogger = (service: string, environment: string) => {
  const isProduction = environment === 'production';

  return winston.createLogger({
    level: isProduction ? 'info' : 'debug',
    defaultMeta: { service, environment },
    format: combine(
      errors({ stack: true }),
      timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
      isProduction ? structuredLogFormat : combine(colorize(), logFormat)
    ),
    transports: [
      new winston.transports.Console({
        handleExceptions: true,
        handleRejections: true
      }),
      ...(isProduction ? [
        new winston.transports.File({
          filename: path.join(process.cwd(), 'logs', 'error.log'),
          level: 'error',
          maxsize: 10 * 1024 * 1024, // 10MB
          maxFiles: 5
        }),
        new winston.transports.File({
          filename: path.join(process.cwd(), 'logs', 'combined.log'),
          maxsize: 10 * 1024 * 1024,
          maxFiles: 5
        })
      ] : [])
    ],
    exitOnError: false
  });
};

export class LogContext {
  private logger: winston.Logger;
  private context: Record<string, unknown>;

  constructor(logger: winston.Logger, context: Record<string, unknown> = {}) {
    this.logger = logger;
    this.context = context;
  }

  child(additionalContext: Record<string, unknown>): LogContext {
    return new LogContext(this.logger, { ...this.context, ...additionalContext });
  }

  debug(message: string, meta?: Record<string, unknown>): void {
    this.logger.debug(message, { ...this.context, ...meta });
  }

  info(message: string, meta?: Record<string, unknown>): void {
    this.logger.info(message, { ...this.context, ...meta });
  }

  warn(message: string, meta?: Record<string, unknown>): void {
    this.logger.warn(message, { ...this.context, ...meta });
  }

  error(message: string, error?: Error | unknown, meta?: Record<string, unknown>): void {
    if (error instanceof Error) {
      this.logger.error(message, { ...this.context, ...meta, stack: error.stack, errorName: error.name });
    } else {
      this.logger.error(message, { ...this.context, ...meta, error });
    }
  }
}

export const logger = createLogger('rez-communications', process.env.NODE_ENV || 'development');
