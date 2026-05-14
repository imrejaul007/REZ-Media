"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("express-async-errors");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const Sentry = __importStar(require("@sentry/node"));
const node_1 = require("@sentry/node");
Sentry.init({
    dsn: process.env.SENTRY_DSN,
    integrations: [(0, node_1.expressIntegration)()],
});
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const express_mongo_sanitize_1 = __importDefault(require("express-mongo-sanitize"));
const prom_client_1 = __importDefault(require("prom-client"));
const crypto_1 = __importDefault(require("crypto"));
const mongoose_1 = __importDefault(require("mongoose"));
const database_1 = require("./config/database");
const redis_1 = require("./config/redis");
const logger_1 = require("./config/logger");
const tracing_1 = require("./middleware/tracing");
const campaigns_1 = __importDefault(require("./routes/campaigns"));
const audience_1 = __importDefault(require("./routes/audience"));
const analytics_1 = __importDefault(require("./routes/analytics"));
const growthAnalytics_1 = __importDefault(require("./routes/growthAnalytics"));
const keywords_1 = __importDefault(require("./routes/keywords"));
const webhooks_1 = __importDefault(require("./routes/webhooks"));
const broadcasts_1 = __importDefault(require("./routes/broadcasts"));
const adbazaar_1 = __importDefault(require("./routes/adbazaar"));
const vouchers_1 = __importDefault(require("./routes/vouchers"));
const merchantGrowth_1 = __importDefault(require("./routes/merchantGrowth"));
const campaignWorker_1 = require("./workers/campaignWorker");
const interestSyncWorker_1 = require("./workers/interestSyncWorker");
const interestRetryWorker_1 = require("./workers/interestRetryWorker");
const BirthdayScheduler_1 = require("./audience/BirthdayScheduler");
const interactionRoutes_1 = __importDefault(require("./routes/interactionRoutes"));
const auth_1 = require("./middleware/auth");
const register = new prom_client_1.default.Registry();
prom_client_1.default.collectDefaultMetrics({ register });
const app = (0, express_1.default)();
app.set('trust proxy', 1); // P1: Trust nginx/Render LB X-Forwarded-For so req.ip reflects real client IP
const PORT = parseInt(process.env.PORT || '4000');
function validateEnv() {
    const required = ['MONGODB_URI', 'REDIS_URL'];
    const missing = required.filter((key) => !process.env[key]);
    // Accept either the scoped map or the legacy shared token during rollout
    if (!process.env.INTERNAL_SERVICE_TOKENS_JSON && !process.env.INTERNAL_SERVICE_TOKEN) {
        missing.push('INTERNAL_SERVICE_TOKENS_JSON or INTERNAL_SERVICE_TOKEN');
    }
    if (missing.length > 0) {
        throw new Error(`Missing required env vars: ${missing.join(', ')}`);
    }
}
// ── Prometheus metrics counters ───────────────────────────────────────────────
let requestCount = 0;
let errorCount = 0;
// ── Middleware ────────────────────────────────────────────────────────────────
app.use((0, helmet_1.default)());
app.use((0, cors_1.default)({ origin: (process.env.CORS_ORIGIN || 'https://rez.money').split(',').map(s => s.trim()), credentials: true }));
// WhatsApp webhook must receive raw body for HMAC verification (Meta signs the raw bytes)
app.use('/webhooks/whatsapp', express_1.default.raw({ type: 'application/json', limit: '1mb' }));
app.use(express_1.default.json({ limit: '1mb' }));
// MKT-SEC-FIX: mongoSanitize was missing — NoSQL injection possible via query/body params.
// The /campaigns and /broadcasts routes accept merchantId, userId, and campaignId params
// that could contain MongoDB operators like $where, $ne, etc. This middleware strips
// them before they reach route handlers.
app.use((0, express_mongo_sanitize_1.default)());
app.use(tracing_1.tracingMiddleware);
// Gateway sends /api/marketing/* — strip /api/marketing prefix so routes match /campaigns, /broadcasts etc.
app.use((req, _res, next) => {
    if (req.url.startsWith('/api/marketing'))
        req.url = req.url.replace(/^\/api\/marketing/, '');
    else if (req.url.startsWith('/api/'))
        req.url = req.url.replace(/^\/api/, '');
    next();
});
// Metrics tracking middleware (before routes)
app.use((_req, res, next) => {
    requestCount++;
    res.on('finish', () => { if (res.statusCode >= 500)
        errorCount++; });
    next();
});
// Internal service key auth — applied to all non-public routes.
// WhatsApp verification (GET /webhooks/whatsapp) and tracking pixel are public.
app.use((req, res, next) => {
    // Always allowed (health only — /metrics requires internal token)
    if (req.path === '/health')
        return next();
    // WhatsApp webhook verification challenge (GET) — must be reachable by Meta
    if (req.method === 'GET' && req.path === '/webhooks/whatsapp')
        return next();
    // Tracking pixel (GET) — embedded in emails, no auth
    if (req.method === 'GET' && req.path.startsWith('/webhooks/track/'))
        return next();
    // All other routes require a scoped internal service secret.
    // Keep x-internal-key header compatibility for existing callers, but require
    // x-internal-service so the token can be resolved from the scoped map.
    const key = req.headers['x-internal-token'] || req.headers['x-internal-key'];
    const callerService = req.headers['x-internal-service'];
    let scopedTokens = null;
    try {
        const raw = process.env.INTERNAL_SERVICE_TOKENS_JSON;
        const parsed = raw ? JSON.parse(raw) : {};
        scopedTokens = Object.keys(parsed).length > 0 ? parsed : null;
    }
    catch {
        scopedTokens = null;
    }
    if (!scopedTokens) {
        return res.status(503).json({ error: 'Service auth not configured' });
    }
    const expected = typeof callerService === 'string' ? scopedTokens[callerService] : undefined;
    const providedBuf = Buffer.from(typeof key === 'string' ? key : '');
    const expectedBuf = Buffer.from(expected || '');
    const isValid = !!expected &&
        providedBuf.length === expectedBuf.length &&
        crypto_1.default.timingSafeEqual(providedBuf, expectedBuf);
    if (!isValid) {
        return res.status(401).json({ error: 'Invalid internal token' });
    }
    next();
});
// ── Routes ────────────────────────────────────────────────────────────────────
app.get('/health', async (_req, res) => {
    const checks = { db: 'ok', redis: 'ok' };
    const errors = [];
    if (mongoose_1.default.connection.readyState !== 1) {
        checks.db = 'error';
        errors.push('MongoDB not connected');
    }
    try {
        const redis = (0, redis_1.getRedis)();
        if (redis.status !== 'ready') {
            checks.redis = 'error';
            errors.push('Redis not ready');
        }
    }
    catch {
        checks.redis = 'error';
        errors.push('Redis unavailable');
    }
    const status = errors.length > 0 ? 'degraded' : 'ok';
    res.status(errors.length > 0 ? 503 : 200).json({
        status,
        service: 'rez-marketing-service',
        checks,
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
    });
});
app.get('/healthz', (_req, res) => res.status(200).json({ status: 'ok', service: 'rez-marketing-service' }));
app.get('/metrics', async (_req, res) => {
    res.setHeader('Content-Type', register.contentType);
    res.end(await register.metrics());
});
app.use('/campaigns', campaigns_1.default);
app.use('/broadcasts', broadcasts_1.default);
app.use('/audience', audience_1.default);
app.use('/analytics', analytics_1.default);
app.use('/growth-analytics', growthAnalytics_1.default);
app.use('/keywords', keywords_1.default);
app.use('/webhooks', webhooks_1.default);
app.use('/adbazaar', adbazaar_1.default);
app.use('/vouchers', vouchers_1.default);
app.use('/merchant/growth', merchantGrowth_1.default);
app.use('/interaction', auth_1.verifyConsumer, interactionRoutes_1.default);
// ── Error handler ─────────────────────────────────────────────────────────────
(0, node_1.setupExpressErrorHandler)(app);
app.use((err, _req, res, _next) => {
    logger_1.logger.error('[API] Unhandled error', { err: err.message, stack: err.stack });
    res.status(500).json({ error: 'Internal server error' });
});
// ── Boot ──────────────────────────────────────────────────────────────────────
async function boot() {
    validateEnv();
    await (0, database_1.connectDB)();
    // Warm Redis connection
    (0, redis_1.getRedis)();
    // Start BullMQ workers
    logger_1.logger.info('[Boot] Workers started: campaignWorker, interestSyncWorker');
    // Start cron schedulers
    (0, interestSyncWorker_1.startInterestSyncScheduler)();
    (0, BirthdayScheduler_1.startBirthdayScheduler)();
    app.listen(PORT, () => {
        logger_1.logger.info(`[Boot] rez-marketing-service listening on port ${PORT}`);
    });
}
boot().catch((err) => {
    logger_1.logger.error('[Boot] Fatal startup error', err);
    process.exit(1);
});
// Graceful shutdown
process.on('SIGTERM', async () => {
    logger_1.logger.info('[Shutdown] SIGTERM received — closing workers');
    await campaignWorker_1.campaignWorker.close();
    await interestSyncWorker_1.interestSyncWorker.close();
    await interestRetryWorker_1.interestRetryWorker.close();
    await mongoose_1.default.disconnect();
    logger_1.logger.info('[Shutdown] MongoDB disconnected');
    process.exit(0);
});
process.on('SIGINT', async () => {
    logger_1.logger.info('[Shutdown] SIGINT received — closing workers');
    await campaignWorker_1.campaignWorker.close();
    await interestSyncWorker_1.interestSyncWorker.close();
    await interestRetryWorker_1.interestRetryWorker.close();
    await mongoose_1.default.disconnect();
    logger_1.logger.info('[Shutdown] MongoDB disconnected');
    process.exit(0);
});
process.on('unhandledRejection', (reason) => {
    logger_1.logger.error('Unhandled promise rejection', { reason: reason instanceof Error ? reason.message : String(reason) });
});
process.on('uncaughtException', (err) => {
    logger_1.logger.error('Uncaught exception', { error: err.message, stack: err.stack });
    process.exit(1);
});
//# sourceMappingURL=index.js.map