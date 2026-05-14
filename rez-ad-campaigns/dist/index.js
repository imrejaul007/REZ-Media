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
// @ts-nocheck
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
const compression_1 = __importDefault(require("compression"));
const express_mongo_sanitize_1 = __importDefault(require("express-mongo-sanitize"));
const mongoose_1 = __importDefault(require("mongoose"));
const prom_client_1 = __importDefault(require("prom-client"));
const register = new prom_client_1.default.Registry();
prom_client_1.default.collectDefaultMetrics({ register });
const database_1 = require("./config/database");
const logger_1 = require("./config/logger");
const tracing_1 = require("./middleware/tracing");
const reEngagementService_1 = require("./services/reEngagementService");
const merchant_1 = __importDefault(require("./routes/merchant"));
const admin_1 = __importDefault(require("./routes/admin"));
const serve_1 = __importDefault(require("./routes/serve"));
const interactionRoutes_1 = __importDefault(require("./routes/interactionRoutes"));
const adbazaar_1 = __importDefault(require("./routes/adbazaar"));
const conversion_1 = __importDefault(require("./routes/conversion"));
const app = (0, express_1.default)();
app.set('trust proxy', 1); // P1: Trust nginx/Render LB X-Forwarded-For so req.ip reflects real client IP
const PORT = parseInt(process.env.PORT || '4007');
function validateEnv() {
    if (!process.env.ADS_MONGO_URI && !process.env.MONGO_URI && !process.env.MONGODB_URI) {
        throw new Error('ADS_MONGO_URI, MONGO_URI, or MONGODB_URI is required');
    }
    if (!process.env.JWT_SECRET) {
        throw new Error('JWT_SECRET is required');
    }
}
// ── Middleware ────────────────────────────────────────────────────────────────
app.use((0, helmet_1.default)());
app.use((0, cors_1.default)({
    origin: (process.env.CORS_ORIGIN || 'https://rez.money').split(',').map((s) => s.trim()),
    credentials: true,
}));
app.use((0, compression_1.default)());
app.use(express_1.default.json({ limit: '1mb' }));
app.use((0, express_mongo_sanitize_1.default)());
app.use(tracing_1.tracingMiddleware);
// Strip /api prefix injected by the API gateway so route handlers remain
// unaware of the gateway's URL scheme.
app.use((req, _res, next) => {
    if (req.url.startsWith('/api/'))
        req.url = req.url.replace(/^\/api/, '');
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
        const { getRedis } = await Promise.resolve().then(() => __importStar(require('./config/redis')));
        const redis = getRedis();
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
        service: 'rez-ads-service',
        checks,
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
    });
});
app.get('/healthz', (_req, res) => res.status(200).json({ status: 'ok', service: 'rez-ads-service' }));
// GET /health/detailed — Comprehensive health check with latency metrics
app.get('/health/detailed', async (_req, res) => {
    const checks = {};
    let isHealthy = true;
    // Check MongoDB with latency
    const mongoStart = Date.now();
    try {
        if (mongoose_1.default.connection.readyState !== 1)
            throw new Error('not connected');
        await mongoose_1.default.connection.db?.admin().ping();
        checks.database = { status: 'up', latencyMs: Date.now() - mongoStart };
    }
    catch (err) {
        checks.database = { status: 'down', error: err.message, latencyMs: Date.now() - mongoStart };
        isHealthy = false;
    }
    // Check Redis with latency
    const redisStart = Date.now();
    try {
        const { getRedis } = await Promise.resolve().then(() => __importStar(require('./config/redis')));
        const redis = getRedis();
        if (redis.status !== 'ready')
            throw new Error('Redis not ready');
        await redis.ping();
        checks.redis = { status: 'up', latencyMs: Date.now() - redisStart };
    }
    catch (err) {
        checks.redis = { status: 'down', error: err.message, latencyMs: Date.now() - redisStart };
    }
    const overallStatus = isHealthy ? 'healthy' : 'unhealthy';
    res.status(overallStatus === 'healthy' ? 200 : 503).json({
        status: overallStatus,
        timestamp: new Date().toISOString(),
        version: process.env.SERVICE_VERSION || '1.0.0',
        uptime: process.uptime(),
        checks,
    });
});
app.get('/metrics', async (_req, res) => {
    res.setHeader('Content-Type', register.contentType);
    res.end(await register.metrics());
});
app.use('/merchant/ads', merchant_1.default);
app.use('/admin/ads', admin_1.default);
app.use('/ads', interactionRoutes_1.default);
app.use('/ads', serve_1.default);
app.use('/', adbazaar_1.default);
app.use('/', conversion_1.default);
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
    // BAK-ADS-007 FIX: Initialize Redis connection on boot.
    // Previously getRedis() was called in the billing service but never connected,
    // causing the in-memory fallback to be used and Redis-based click deduplication
    // to silently fail. Redis must be connected before any route handler runs.
    try {
        const { getRedis } = await Promise.resolve().then(() => __importStar(require('./config/redis')));
        const redis = getRedis();
        await redis.ping();
        logger_1.logger.info('[Boot] Redis connected successfully');
    }
    catch (err) {
        logger_1.logger.error('[Boot] Redis connection failed — ensure REDIS_URL is set', { error: err.message });
        throw err; // Fail-closed: do not start without Redis
    }
    // Start the re-engagement scheduler (hourly engagement spike checks)
    await (0, reEngagementService_1.startReengagementScheduler)();
    const server = app.listen(PORT, () => {
        logger_1.logger.info(`[Boot] rez-ads-service listening on port ${PORT}`);
    });
    const shutdown = async (signal) => {
        logger_1.logger.info(`[Shutdown] ${signal} received — shutting down gracefully`);
        await (0, reEngagementService_1.stopReengagementScheduler)();
        await new Promise((resolve, reject) => {
            server.close((err) => {
                if (err) {
                    reject(err);
                    return;
                }
                resolve();
            });
        });
        await mongoose_1.default.disconnect();
        process.exit(0);
    };
    process.on('SIGTERM', () => void shutdown('SIGTERM'));
    process.on('SIGINT', () => void shutdown('SIGINT'));
    process.on('unhandledRejection', (reason) => {
        logger_1.logger.error('Unhandled promise rejection', { reason: reason instanceof Error ? reason.message : String(reason) });
    });
}
boot().catch((err) => {
    logger_1.logger.error('[Boot] Fatal startup error', err);
    process.exit(1);
});
//# sourceMappingURL=index.js.map