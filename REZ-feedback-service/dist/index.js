"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.app = void 0;
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const compression_1 = __importDefault(require("compression"));
const mongoose_1 = __importDefault(require("mongoose"));
const sentry_1 = require("./config/sentry");
const feedback_1 = __importDefault(require("./routes/feedback"));
const dashboard_1 = __importDefault(require("./dashboard"));
const health_1 = require("./health");
const logger_1 = require("./utils/logger");
const feedback_processor_1 = require("./workers/feedback-processor");
// Initialize Sentry
(0, sentry_1.initSentry)();
const PORT = parseInt(process.env.PORT || '4010');
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/rez-feedback';
const app = (0, express_1.default)();
exports.app = app;
// Middleware
app.use((0, helmet_1.default)());
app.use((0, cors_1.default)());
app.use((0, compression_1.default)());
app.use(express_1.default.json({ limit: '10mb' }));
app.use(express_1.default.urlencoded({ extended: true }));
// Request logging
app.use((req, _res, next) => {
    logger_1.logger.info(`${req.method} ${req.path}`, {
        ip: req.ip,
        query: req.query
    });
    next();
});
// Health endpoints
app.get('/health', async (_req, res) => {
    const health = await (0, health_1.checkHealth)();
    const statusCode = health.status === 'healthy' ? 200 : health.status === 'degraded' ? 200 : 503;
    res.status(statusCode).json(health);
});
app.get('/health/live', (_req, res) => {
    if ((0, health_1.isAlive)()) {
        res.json({ status: 'alive' });
    }
    else {
        res.status(503).json({ status: 'dead' });
    }
});
app.get('/health/ready', async (_req, res) => {
    const ready = await (0, health_1.isReady)();
    if (ready) {
        res.json({ status: 'ready' });
    }
    else {
        res.status(503).json({ status: 'not ready' });
    }
});
// API routes
app.use('/feedback', feedback_1.default);
app.use('/dashboard', dashboard_1.default);
// 404 handler
app.use((_req, res) => {
    res.status(404).json({ error: 'Not found' });
});
// Error handler
app.use((err, _req, res, _next) => {
    logger_1.logger.error('Unhandled error', { error: err.message, stack: err.stack });
    res.status(500).json({
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});
// Connect to MongoDB
async function connectDatabase() {
    try {
        await mongoose_1.default.connect(MONGODB_URI);
        logger_1.logger.info('Connected to MongoDB');
    }
    catch (error) {
        logger_1.logger.error('MongoDB connection failed', {
            error: error instanceof Error ? error.message : 'Unknown error'
        });
        throw error;
    }
}
// Graceful shutdown
async function shutdown() {
    logger_1.logger.info('Shutting down gracefully...');
    try {
        await feedback_processor_1.feedbackProcessor.shutdown();
        await mongoose_1.default.connection.close();
        logger_1.logger.info('Shutdown complete');
        process.exit(0);
    }
    catch (error) {
        logger_1.logger.error('Shutdown error', { error });
        process.exit(1);
    }
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
// Start server
async function start() {
    try {
        await connectDatabase();
        app.listen(PORT, () => {
            logger_1.logger.info(`REZ Feedback Service started on port ${PORT}`);
            logger_1.logger.info(`Health check: http://localhost:${PORT}/health`);
            logger_1.logger.info(`API: http://localhost:${PORT}/feedback`);
            logger_1.logger.info(`Dashboard: http://localhost:${PORT}/dashboard`);
        });
    }
    catch (error) {
        logger_1.logger.error('Failed to start server', {
            error: error instanceof Error ? error.message : 'Unknown error'
        });
        process.exit(1);
    }
}
start();
// ── Global Error Handlers ─────────────────────────────────────────────────
process.on('uncaughtException', (error) => {
    console.error('UNCAUGHT EXCEPTION:', error);
    process.exit(1);
});
process.on('unhandledRejection', (reason, promise) => {
    console.error('UNHANDLED REJECTION at:', promise, 'reason:', reason);
});
//# sourceMappingURL=index.js.map