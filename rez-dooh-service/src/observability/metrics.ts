/**
 * DOOH Service - Observability
 *
 * Prometheus metrics and tracing utilities.
 */

import { Registry, Counter, Histogram, Gauge, Summary } from 'prom-client';

// ============================================================================
// Metrics Registry
// ============================================================================

export const registry = new Registry();

// Add default metrics
import { collectDefaultMetrics } from 'prom-client';
collectDefaultMetrics({ register: registry });

// ============================================================================
// HTTP Metrics
// ============================================================================

export const httpRequestsTotal = new Counter({
  name: 'dooh_http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'path', 'status'],
  registers: [registry],
});

export const httpRequestDuration = new Histogram({
  name: 'dooh_http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'path', 'status'],
  buckets: [0.001, 0.005, 0.015, 0.05, 0.1, 0.2, 0.5, 1, 2, 5],
  registers: [registry],
});

// ============================================================================
// Screen Metrics
// ============================================================================

export const screensTotal = new Gauge({
  name: 'dooh_screens_total',
  help: 'Total number of screens in the network',
  labelNames: ['status', 'type'],
  registers: [registry],
});

export const screensOnline = new Gauge({
  name: 'dooh_screens_online',
  help: 'Number of online screens',
  registers: [registry],
});

export const screenHeartbeatsTotal = new Counter({
  name: 'dooh_screen_heartbeats_total',
  help: 'Total number of screen heartbeats received',
  labelNames: ['status'],
  registers: [registry],
});

export const screenHeartbeatDuration = new Histogram({
  name: 'dooh_screen_heartbeat_processing_seconds',
  help: 'Time to process screen heartbeat',
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1],
  registers: [registry],
});

// ============================================================================
// Campaign Metrics
// ============================================================================

export const campaignsTotal = new Gauge({
  name: 'dooh_campaigns_total',
  help: 'Total number of campaigns',
  labelNames: ['status'],
  registers: [registry],
});

export const campaignBudgetTotal = new Gauge({
  name: 'dooh_campaign_budget_total',
  help: 'Total campaign budget',
  registers: [registry],
});

export const campaignSpendTotal = new Gauge({
  name: 'dooh_campaign_spend_total',
  help: 'Total campaign spend',
  registers: [registry],
});

// ============================================================================
// Analytics Metrics
// ============================================================================

export const impressionsTotal = new Counter({
  name: 'dooh_impressions_total',
  help: 'Total number of impressions recorded',
  labelNames: ['screen_id'],
  registers: [registry],
});

export const impressionsProcessingDuration = new Histogram({
  name: 'dooh_impressions_processing_seconds',
  help: 'Time to process impression events',
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1],
  registers: [registry],
});

export const activeUsersGauge = new Gauge({
  name: 'dooh_active_users_current',
  help: 'Current number of active users/sessions',
  registers: [registry],
});

// ============================================================================
// Revenue Metrics
// ============================================================================

export const revenueTotal = new Counter({
  name: 'dooh_revenue_total',
  help: 'Total revenue generated',
  labelNames: ['type'],
  registers: [registry],
});

export const earningsPending = new Gauge({
  name: 'dooh_earnings_pending',
  help: 'Pending earnings to be paid out',
  registers: [registry],
});

// ============================================================================
// Error Metrics
// ============================================================================

export const errorsTotal = new Counter({
  name: 'dooh_errors_total',
  help: 'Total number of errors',
  labelNames: ['type', 'code'],
  registers: [registry],
});

export const authenticationFailures = new Counter({
  name: 'dooh_auth_failures_total',
  help: 'Total authentication failures',
  labelNames: ['reason'],
  registers: [registry],
});

// ============================================================================
// Rate Limiting Metrics
// ============================================================================

export const rateLimitHitsTotal = new Counter({
  name: 'dooh_rate_limit_hits_total',
  help: 'Total rate limit hits',
  labelNames: ['path', 'ip'],
  registers: [registry],
});

// ============================================================================
// Database Metrics
// ============================================================================

export const dbQueryDuration = new Histogram({
  name: 'dooh_db_query_duration_seconds',
  help: 'Database query duration',
  labelNames: ['operation', 'collection'],
  buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1],
  registers: [registry],
});

export const dbConnections = new Gauge({
  name: 'dooh_db_connections_active',
  help: 'Active database connections',
  registers: [registry],
});

// ============================================================================
// Cache Metrics
// ============================================================================

export const cacheHits = new Counter({
  name: 'dooh_cache_hits_total',
  help: 'Total cache hits',
  labelNames: ['key_type'],
  registers: [registry],
});

export const cacheMisses = new Counter({
  name: 'dooh_cache_misses_total',
  help: 'Total cache misses',
  labelNames: ['key_type'],
  registers: [registry],
});

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Record an HTTP request
 */
export function recordHttpRequest(
  method: string,
  path: string,
  status: number,
  durationMs: number
): void {
  const labels = { method, path: normalizePath(path), status: String(status) };

  httpRequestsTotal.inc(labels);
  httpRequestDuration.observe(labels, durationMs / 1000);
}

/**
 * Normalize path to prevent high cardinality
 */
function normalizePath(path: string): string {
  // Replace dynamic segments with placeholders
  return path
    .replace(/\/screens\/[^/]+/, '/screens/:id')
    .replace(/\/campaigns\/[^/]+/, '/campaigns/:id')
    .replace(/\/playlist\/[^/]+/, '/playlist/:id')
    .replace(/\/[0-9a-f-]{36}/gi, '/:uuid');
}

/**
 * Record a screen heartbeat
 */
export function recordHeartbeat(
  screenId: string,
  status: string,
  durationMs: number
): void {
  screenHeartbeatsTotal.inc({ status });
  screenHeartbeatDuration.observe(durationMs / 1000);
}

/**
 * Update screen counts
 */
export function updateScreenCounts(
  counts: { active: number; inactive: number; offline: number; maintenance: number },
  byType: Record<string, number>
): void {
  screensOnline.set(counts.active);

  for (const [status, count] of Object.entries(counts)) {
    // Sum by status
    screensTotal.set({ status, type: 'all' }, count);

    // By type
    for (const [type, typeCount] of Object.entries(byType)) {
      screensTotal.set({ status, type }, typeCount);
    }
  }
}

/**
 * Record impressions
 */
export function recordImpressions(screenId: string, count: number): void {
  impressionsTotal.inc({ screen_id: screenId }, count);
}

/**
 * Record an error
 */
export function recordError(type: string, code: string): void {
  errorsTotal.inc({ type, code });
}

/**
 * Express middleware for HTTP metrics
 */
export function metricsMiddleware(
  req: { method: string; path: string },
  res: { statusCode: number },
  next: (err?: Error) => void
): void {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    recordHttpRequest(req.method, req.path, res.statusCode, duration);
  });

  next();
}
