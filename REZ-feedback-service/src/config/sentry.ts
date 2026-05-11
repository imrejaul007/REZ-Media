/**
 * Sentry Configuration for rez-feedback-service
 */
import * as Sentry from '@sentry/node';

const SENTRY_DSN = process.env.SENTRY_DSN;
const ENVIRONMENT = process.env.NODE_ENV || 'development';

export function initSentry(): void {
  if (!SENTRY_DSN) {
    console.warn('[Sentry] SENTRY_DSN not set');
    return;
  }

  Sentry.init({
    dsn: SENTRY_DSN,
    environment: ENVIRONMENT,
    tracesSampleRate: ENVIRONMENT === 'production' ? 0.1 : 1.0,
    debug: ENVIRONMENT !== 'production',
    integrations: [
      new Sentry.Integrations.Http({ tracing: true }),
    ],
    ignoreErrors: ['AbortError', 'ECONNRESET', 'ETIMEDOUT'],
    denyUrls: [/localhost/, /127\.0\.0\.1/],
  });

  console.log('[Sentry] Initialized for', ENVIRONMENT);
}

export { Sentry };
