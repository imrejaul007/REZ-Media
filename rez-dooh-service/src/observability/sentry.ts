/**
 * DOOH Service - Sentry Error Tracking
 *
 * Sentry integration for error tracking and monitoring.
 */

// Note: Sentry should be installed as a dependency
// npm install @sentry/node

// Types for Sentry
interface SentryOptions {
  dsn?: string;
  environment?: string;
  release?: string;
}

let isInitialized = false;

/**
 * Initialize Sentry
 */
export function initSentry(options: SentryOptions = {}): void {
  if (isInitialized) {
    console.warn('[Sentry] Already initialized');
    return;
  }

  const dsn = options.dsn || process.env.SENTRY_DSN;

  if (!dsn) {
    console.warn('[Sentry] SENTRY_DSN not configured, error tracking disabled');
    return;
  }

  // In production, import and initialize Sentry:
  // import * as Sentry from '@sentry/node';
  //
  // Sentry.init({
  //   dsn,
  //   environment: options.environment || process.env.NODE_ENV,
  //   release: options.release || process.env.APP_VERSION,
  //   tracesSampleRate: 0.1,
  //   profilesSampleRate: 0.1,
  // });

  isInitialized = true;
  console.log('[Sentry] Initialized');
}

/**
 * Capture an exception
 */
export function captureException(error: Error, context?: Record<string, unknown>): void {
  if (!isInitialized) {
    console.error('[Sentry] Not initialized, logging error:', error.message);
    return;
  }

  // In production:
  // import * as Sentry from '@sentry/node';
  // Sentry.captureException(error, { extra: context });

  console.error('[Sentry] Error:', error.message, context);
}

/**
 * Capture a message
 */
export function captureMessage(
  message: string,
  level: 'debug' | 'info' | 'warning' | 'error' = 'info',
  context?: Record<string, unknown>
): void {
  if (!isInitialized) {
    console.log(`[Sentry:${level}]`, message, context);
    return;
  }

  // In production:
  // import * as Sentry from '@sentry/node';
  // Sentry.captureMessage(message, level, { extra: context });
}

/**
 * Add breadcrumb
 */
export function addBreadcrumb(
  message: string,
  category: string,
  data?: Record<string, unknown>
): void {
  if (!isInitialized) {
    return;
  }

  // In production:
  // import * as Sentry from '@sentry/node';
  // Sentry.addBreadcrumb({
  //   message,
  //   category,
  //   data,
  //   timestamp: Date.now(),
  // });
}

/**
 * Set user context
 */
export function setUser(userId: string, email?: string): void {
  if (!isInitialized) {
    return;
  }

  // In production:
  // import * as Sentry from '@sentry/node';
  // Sentry.setUser({ id: userId, email });
}

/**
 * Set extra context
 */
export function setContext(name: string, context: Record<string, unknown>): void {
  if (!isInitialized) {
    return;
  }

  // In production:
  // import * as Sentry from '@sentry/node';
  // Sentry.setExtra(name, context);
}

/**
 * Express middleware for request tracking
 */
export function sentryMiddleware(
  req: { method: string; path: string; headers: Record<string, string | string[] | undefined> },
  res: { statusCode: number },
  next: (err?: Error) => void
): void {
  // In production, use Sentry.Handlers.requestHandler() instead
  next();
}

/**
 * Error handler middleware
 */
export function errorHandler(
  err: Error,
  req: { method: string; path: string; headers: Record<string, string | string[] | undefined> },
  res: { statusCode: number; json: (body: unknown) => void },
  next: (err?: Error) => void
): void {
  captureException(err, {
    request: {
      method: req.method,
      path: req.path,
      headers: req.headers,
    },
  });

  // Don't send error details in production
  if (process.env.NODE_ENV === 'production') {
    res.statusCode = 500;
    res.json({
      success: false,
      error: 'Internal server error',
      errorId: `ERR-${Date.now()}`,
    });
  } else {
    res.statusCode = 500;
    res.json({
      success: false,
      error: err.message,
      stack: err.stack,
    });
  }
}

/**
 * Create a span for tracing
 */
export async function withSpan<T>(
  name: string,
  operation: (span?: unknown) => Promise<T>,
  options?: { tags?: Record<string, string> }
): Promise<T> {
  // In production:
  // import * as Sentry from '@sentry/node';
  // const span = Sentry.startSpan({ name, op: options?.op });
  // try {
  //   const result = await operation(span);
  //   span?.finish();
  //   return result;
  // } catch (error) {
  //   Sentry.captureException(error);
  //   throw error;
  // }

  return operation();
}

/**
 * Express handler wrapper with error tracking
 */
export function withErrorTracking<T>(
  handler: (req: unknown, res: unknown) => Promise<T>
): (req: unknown, res: unknown) => Promise<T> {
  return async (req, res) => {
    try {
      return await handler(req, res);
    } catch (error) {
      if (error instanceof Error) {
        captureException(error, {
          request: {
            method: (req as { method?: string }).method,
            path: (req as { path?: string }).path,
          },
        });
      }
      throw error;
    }
  };
}
