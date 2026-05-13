/**
 * Logging Middleware
 *
 * Provides structured logging for the REZ Pricing Engine with:
 * - Request logging (method, path, status, duration)
 * - Error tracking (stack traces, context)
 * - Performance metrics (slow request detection)
 */

import { Request, Response, NextFunction, RequestHandler } from 'express';

// =============================================================================
// LOG LEVELS & TYPES
// =============================================================================

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

export interface LogEntry {
  timestamp: string;
  level: string;
  message: string;
  context?: Record<string, any>;
}

export interface RequestLogData {
  method: string;
  path: string;
  statusCode: number;
  durationMs: number;
  requestId: string;
  userAgent?: string;
  ip?: string;
  body?: Record<string, any>;
}

export interface ErrorLogData {
  error: Error;
  requestId: string;
  method: string;
  path: string;
  body?: Record<string, any>;
  stack?: string;
}

// =============================================================================
// CONFIGURATION
// =============================================================================

interface LoggerConfig {
  level: LogLevel;
  slowRequestThresholdMs: number;
  logRequestBody: boolean;
  logResponseBody: boolean;
  prettyPrint: boolean;
}

const defaultConfig: LoggerConfig = {
  level: (process.env.LOG_LEVEL as any) !== undefined
    ? LogLevel[process.env.LOG_LEVEL.toUpperCase()]
    : LogLevel.INFO,
  slowRequestThresholdMs: parseInt(process.env.SLOW_REQUEST_THRESHOLD_MS || '1000', 10),
  logRequestBody: process.env.LOG_REQUEST_BODY !== 'false',
  logResponseBody: false,
  prettyPrint: process.env.NODE_ENV !== 'production',
};

let config: LoggerConfig = { ...defaultConfig };

/**
 * Configure logger settings
 */
export function configureLogger(newConfig: Partial<LoggerConfig>): void {
  config = { ...config, ...newConfig };
}

// =============================================================================
// LOGGING FUNCTIONS
// =============================================================================

function formatTimestamp(): string {
  return new Date().toISOString();
}

function formatLogEntry(entry: LogEntry): string {
  const base = {
    timestamp: entry.timestamp,
    level: entry.level,
    message: entry.message,
    ...entry.context,
  };

  if (config.prettyPrint) {
    return JSON.stringify(base, null, 2);
  }
  return JSON.stringify(base);
}

function shouldLog(level: LogLevel): boolean {
  return level >= config.level;
}

export function log(level: LogLevel, message: string, context?: Record<string, any>): void {
  if (!shouldLog(level)) return;

  const entry: LogEntry = {
    timestamp: formatTimestamp(),
    level: LogLevel[level],
    message,
    context,
  };

  const formatted = formatLogEntry(entry);

  switch (level) {
    case LogLevel.ERROR:
      console.error(formatted);
      break;
    case LogLevel.WARN:
      console.warn(formatted);
      break;
    default:
      console.log(formatted);
  }
}

export function debug(message: string, context?: Record<string, any>): void {
  log(LogLevel.DEBUG, message, context);
}

export function info(message: string, context?: Record<string, any>): void {
  log(LogLevel.INFO, message, context);
}

export function warn(message: string, context?: Record<string, any>): void {
  log(LogLevel.WARN, message, context);
}

export function error(message: string, context?: Record<string, any>): void {
  log(LogLevel.ERROR, message, context);
}

// =============================================================================
// REQUEST ID GENERATION
// =============================================================================

/**
 * Generate a unique request ID
 */
function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}

// Extend Express Request to include requestId
declare global {
  namespace Express {
    interface Request {
      requestId: string;
      startTime?: bigint;
    }
  }
}

// =============================================================================
// REQUEST LOGGING MIDDLEWARE
// =============================================================================

/**
 * Request logging middleware
 * Logs all incoming requests and their outcomes
 */
export function requestLogger(): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    // Generate unique request ID
    req.requestId = (req.headers['x-request-id'] as string) || generateRequestId();

    // Record start time
    req.startTime = process.hrtime.bigint();

    // Add request ID to response headers
    res.setHeader('X-Request-ID', req.requestId);

    // Log incoming request (DEBUG level)
    debug('Incoming request', {
      requestId: req.requestId,
      method: req.method,
      path: req.path,
      query: req.query,
      ip: req.ip,
      userAgent: req.get('user-agent'),
    });

    // Log request body if enabled and not a health check
    if (config.logRequestBody && req.path !== '/health' && req.path !== '/metrics') {
      const sanitizedBody = sanitizeBody(req.body);
      if (Object.keys(sanitizedBody).length > 0) {
        debug('Request body', {
          requestId: req.requestId,
          body: sanitizedBody,
        });
      }
    }

    // Capture original end function
    const originalEnd = res.end;
    const startTime = req.startTime;

    res.end = function (
      this: Response,
      chunk?: any,
      encoding?: BufferEncoding | (() => void),
      callback?: () => void
    ): Response {
      // Calculate duration
      const endTime = process.hrtime.bigint();
      const durationNs = Number(endTime - startTime);
      const durationMs = durationNs / 1e6;

      const logData: RequestLogData = {
        method: req.method,
        path: req.path,
        statusCode: res.statusCode,
        durationMs: Math.round(durationMs * 100) / 100,
        requestId: req.requestId,
        userAgent: req.get('user-agent'),
        ip: req.ip,
      };

      // Determine log level based on status code
      if (res.statusCode >= 500) {
        error('Request completed with server error', logData);
      } else if (res.statusCode >= 400) {
        warn('Request completed with client error', logData);
      } else if (durationMs > config.slowRequestThresholdMs) {
        warn('Slow request detected', {
          ...logData,
          threshold: config.slowRequestThresholdMs,
          durationMs,
        });
      } else {
        info('Request completed', logData);
      }

      // Call original end
      if (typeof encoding === 'function') {
        return originalEnd.call(this, chunk, encoding as any);
      }
      return originalEnd.call(this, chunk, encoding, callback);
    } as typeof res.end;

    next();
  };
}

// =============================================================================
// ERROR TRACKING MIDDLEWARE
// =============================================================================

/**
 * Global error handler middleware
 * Must be registered after all routes
 */
export function errorHandler(
  err: Error & { statusCode?: number; status?: number },
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  const statusCode = err.statusCode || err.status || 500;
  const requestId = req.requestId || 'unknown';

  const errorData = {
    requestId,
    method: req.method,
    path: req.path,
    statusCode,
    error: {
      name: err.name,
      message: err.message,
      stack: config.level >= LogLevel.DEBUG ? err.stack : undefined,
    },
  };

  error('Request error', errorData);

  // Don't expose internal error details in production
  const responseMessage =
    process.env.NODE_ENV === 'production' && statusCode === 500
      ? 'Internal server error'
      : err.message;

  res.status(statusCode).json({
    success: false,
    error: {
      message: responseMessage,
      requestId,
    },
  });
}

/**
 * 404 handler for unmatched routes
 */
export function notFoundHandler(req: Request, res: Response): void {
  const requestId = req.requestId || 'unknown';

  warn('Route not found', {
    requestId,
    method: req.method,
    path: req.path,
  });

  res.status(404).json({
    success: false,
    error: {
      message: `Route ${req.method} ${req.path} not found`,
      requestId,
    },
  });
}

// =============================================================================
// PERFORMANCE TRACKING
// =============================================================================

export interface PerformanceMarker {
  name: string;
  startTime: bigint;
  endTime?: bigint;
  durationMs?: number;
}

/**
 * Create a performance timer
 */
export function startPerformanceMarker(name: string): PerformanceMarker {
  return {
    name,
    startTime: process.hrtime.bigint(),
  };
}

/**
 * End a performance timer and log if slow
 */
export function endPerformanceMarker(
  marker: PerformanceMarker,
  thresholdMs?: number
): number {
  marker.endTime = process.hrtime.bigint();
  const durationNs = Number(marker.endTime - marker.startTime);
  marker.durationMs = durationNs / 1e6;

  const threshold = thresholdMs || config.slowRequestThresholdMs;

  if (marker.durationMs > threshold) {
    warn('Performance threshold exceeded', {
      name: marker.name,
      durationMs: Math.round(marker.durationMs * 100) / 100,
      thresholdMs: threshold,
    });
  }

  return marker.durationMs;
}

/**
 * Track async operation duration
 */
export async function trackPerformance<T>(
  name: string,
  fn: () => Promise<T>,
  thresholdMs?: number
): Promise<T> {
  const marker = startPerformanceMarker(name);
  try {
    const result = await fn();
    endPerformanceMarker(marker, thresholdMs);
    return result;
  } catch (error) {
    marker.endTime = process.hrtime.bigint();
    const durationNs = Number(marker.endTime - marker.startTime);
    marker.durationMs = durationNs / 1e6;

    error(`Performance tracking failed for ${name}`, {
      name,
      durationMs: marker.durationMs,
      error: (error as Error).message,
    });
    throw error;
  }
}

// =============================================================================
// UTILITIES
// =============================================================================

/**
 * Sanitize body to remove sensitive fields
 */
function sanitizeBody(body: any): any {
  if (!body || typeof body !== 'object') return {};

  const sensitiveFields = ['password', 'token', 'secret', 'apiKey', 'api_key', 'authorization'];
  const sanitized: any = {};

  for (const [key, value] of Object.entries(body)) {
    if (sensitiveFields.some((field) => key.toLowerCase().includes(field))) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeBody(value);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

/**
 * Create a child logger with default context
 */
export function createChildLogger(defaultContext: Record<string, any>) {
  return {
    debug: (message: string, context?: Record<string, any>) =>
      debug(message, { ...defaultContext, ...context }),
    info: (message: string, context?: Record<string, any>) =>
      info(message, { ...defaultContext, ...context }),
    warn: (message: string, context?: Record<string, any>) =>
      warn(message, { ...defaultContext, ...context }),
    error: (message: string, context?: Record<string, any>) =>
      error(message, { ...defaultContext, ...context }),
  };
}
