/**
 * Prometheus Metrics Middleware
 *
 * Provides observability for the REZ Pricing Engine with:
 * - Request counter (total requests by method, route, status)
 * - Response time histogram (latency distribution)
 * - Error counter (errors by type and endpoint)
 * - Active requests gauge (current concurrent requests)
 */

import { Request, Response, NextFunction } from 'express';
import client, { Registry, Counter, Histogram, Gauge } from 'prom-client';

// Create a custom registry
const register = new Registry();

// Add default labels
register.setDefaultLabels({
  app: 'rez-pricing-engine',
});

// Collect default metrics (CPU, memory, etc.)
client.collectDefaultMetrics({ register });

// =============================================================================
// METRICS DEFINITIONS
// =============================================================================

/**
 * Request Counter - Total number of HTTP requests
 * Labels: method, route, status_code
 */
export const httpRequestsTotal = new Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
  registers: [register],
});

/**
 * Response Time Histogram - Request duration in seconds
 * Buckets optimized for API latency (10ms to 30s)
 */
export const httpRequestDurationSeconds = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10, 30],
  registers: [register],
});

/**
 * Error Counter - Total number of HTTP errors
 * Labels: method, route, status_code, error_type
 */
export const httpErrorsTotal = new Counter({
  name: 'http_errors_total',
  help: 'Total number of HTTP errors (4xx and 5xx)',
  labelNames: ['method', 'route', 'status_code', 'error_type'],
  registers: [register],
});

/**
 * Active Requests Gauge - Current number of concurrent requests
 */
export const httpActiveRequests = new Gauge({
  name: 'http_active_requests',
  help: 'Number of active HTTP requests',
  registers: [register],
});

/**
 * Business Metrics - Pricing calculations
 */
export const pricingCalculationsTotal = new Counter({
  name: 'pricing_calculations_total',
  help: 'Total number of pricing calculations performed',
  labelNames: ['ad_type', 'calculation_type'],
  registers: [register],
});

export const pricingCalculationDurationSeconds = new Histogram({
  name: 'pricing_calculation_duration_seconds',
  help: 'Pricing calculation duration in seconds',
  labelNames: ['ad_type', 'calculation_type'],
  buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.5, 1],
  registers: [register],
});

/**
 * Campaign Metrics
 */
export const campaignsCreatedTotal = new Counter({
  name: 'campaigns_created_total',
  help: 'Total number of campaigns created',
  labelNames: ['status'],
  registers: [register],
});

/**
 * Error tracking by type
 */
export const businessErrorsTotal = new Counter({
  name: 'business_errors_total',
  help: 'Total number of business logic errors',
  labelNames: ['error_type', 'endpoint'],
  registers: [register],
});

// =============================================================================
// MIDDLEWARE
// =============================================================================

/**
 * Normalizes route path for metrics (removes dynamic segments)
 */
function normalizeRoute(route: string): string {
  // Replace UUIDs
  let normalized = route.replace(
    /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
    ':id'
  );
  // Replace numeric IDs
  normalized = normalized.replace(/\/\d+/g, '/:id');
  // Replace MongoDB ObjectIds (24 hex chars)
  normalized = normalized.replace(/[0-9a-f]{24}/gi, ':id');
  return normalized || '/';
}

/**
 * Metrics collection middleware
 * Collects request metrics and updates all counters/histograms
 */
export function metricsMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // Skip metrics endpoint itself to avoid noise
  if (req.path === '/metrics') {
    return next();
  }

  // Track start time
  const startTime = process.hrtime.bigint();

  // Increment active requests
  httpActiveRequests.inc();

  // Capture original end function
  const originalEnd = res.end;

  // Override end to capture metrics
  res.end = function (
    this: Response,
    chunk?: any,
    encoding?: BufferEncoding | (() => void),
    callback?: () => void
  ): Response {
    // Calculate duration
    const endTime = process.hrtime.bigint();
    const durationNs = Number(endTime - startTime);
    const durationSeconds = durationNs / 1e9;

    // Get normalized route
    const route = normalizeRoute(req.route?.path || req.path);
    const method = req.method;
    const statusCode = res.statusCode.toString();

    // Update request counter
    httpRequestsTotal.inc({ method, route, status_code: statusCode });

    // Update response time histogram
    httpRequestDurationSeconds.observe(
      { method, route, status_code: statusCode },
      durationSeconds
    );

    // Update error counter for 4xx and 5xx responses
    if (res.statusCode >= 400) {
      const errorType =
        res.statusCode >= 500 ? 'server_error' : 'client_error';
      httpErrorsTotal.inc({
        method,
        route,
        status_code: statusCode,
        error_type: errorType,
      });
    }

    // Decrement active requests
    httpActiveRequests.dec();

    // Call original end
    if (typeof encoding === 'function') {
      return originalEnd.call(this, chunk, encoding as any);
    }
    return originalEnd.call(this, chunk, encoding, callback);
  } as typeof res.end;

  next();
}

// =============================================================================
// METRICS EXPORT FUNCTION
// =============================================================================

/**
 * Get metrics in Prometheus text format
 */
export async function getMetrics(): Promise<string> {
  return register.metrics();
}

/**
 * Get content type for metrics endpoint
 */
export function getMetricsContentType(): string {
  return register.contentType;
}

/**
 * Get the registry for testing
 */
export function getRegistry(): Registry {
  return register;
}

/**
 * Record a pricing calculation
 */
export function recordPricingCalculation(
  adType: string,
  calculationType: string,
  durationMs: number
): void {
  pricingCalculationsTotal.inc({ ad_type: adType, calculation_type: calculationType });
  pricingCalculationDurationSeconds.observe(
    { ad_type: adType, calculation_type: calculationType },
    durationMs / 1000
  );
}

/**
 * Record campaign creation
 */
export function recordCampaignCreated(status: string): void {
  campaignsCreatedTotal.inc({ status });
}

/**
 * Record business error
 */
export function recordBusinessError(errorType: string, endpoint: string): void {
  businessErrorsTotal.inc({ error_type: errorType, endpoint });
}
