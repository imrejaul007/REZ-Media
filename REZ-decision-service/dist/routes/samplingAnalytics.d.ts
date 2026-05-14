/**
 * SAMPLING ANALYTICS DASHBOARD API
 * Phase 3: Real-time analytics for campaigns
 *
 * Endpoints:
 * - GET /api/sampling/analytics/campaign/:id     - Campaign performance metrics
 * - GET /api/sampling/analytics/user/:id       - User activity & engagement
 * - GET /api/sampling/analytics/merchant/:id    - Merchant redemption analytics
 * - GET /api/sampling/analytics/system           - System-wide metrics & alerts
 * - GET /api/sampling/analytics/funnel/:id      - Conversion funnel analysis
 * - GET /api/sampling/analytics/leaderboard     - Top users ranking
 */
declare const router: import("express-serve-static-core").Router;
export default router;
