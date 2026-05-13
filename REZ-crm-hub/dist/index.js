"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const mongoose_1 = __importDefault(require("mongoose"));
const ioredis_1 = __importDefault(require("ioredis"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const index_js_1 = require("./config/index.js");
const index_js_2 = __importDefault(require("./routes/index.js"));
const errorHandler_js_1 = require("./middleware/errorHandler.js");
const authService_js_1 = require("./services/authService.js");
const syncService_js_1 = require("./services/syncService.js");
// Initialize Redis client (optional)
let redisClient = null;
async function initializeRedis() {
    if (!index_js_1.config.redis.url) {
        console.warn('Redis URL not configured. Running without Redis.');
        return;
    }
    try {
        redisClient = new ioredis_1.default(index_js_1.config.redis.url, {
            lazyConnect: true,
            maxRetriesPerRequest: 3,
        });
        await redisClient.connect();
        console.log('Redis connected successfully');
    }
    catch (error) {
        console.warn('Redis connection failed. Running without Redis:', error);
        redisClient = null;
    }
}
// Initialize MongoDB connection
async function initializeDatabase() {
    try {
        await mongoose_1.default.connect(index_js_1.config.mongodb.uri, index_js_1.config.mongodb.options);
        console.log('MongoDB connected successfully');
    }
    catch (error) {
        console.error('MongoDB connection failed:', error);
        throw error;
    }
}
// Initialize Express app
function createApp() {
    const app = (0, express_1.default)();
    // CORS configuration
    app.use((0, cors_1.default)({
        origin: true,
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization', 'X-Internal-Token'],
    }));
    // Body parsing
    app.use(express_1.default.json({ limit: '10mb' }));
    app.use(express_1.default.urlencoded({ extended: true }));
    // Rate limiting
    const limiter = (0, express_rate_limit_1.default)({
        windowMs: index_js_1.config.rateLimit.windowMs,
        max: index_js_1.config.rateLimit.max,
        message: {
            success: false,
            error: 'Too many requests, please try again later',
        },
        standardHeaders: true,
        legacyHeaders: false,
    });
    app.use(limiter);
    // Request logging (simple)
    app.use((req, _res, next) => {
        const start = Date.now();
        _res.on('finish', () => {
            const duration = Date.now() - start;
            console.log(`${req.method} ${req.path} ${_res.statusCode} ${duration}ms`);
        });
        next();
    });
    // Trust proxy (for rate limiting behind reverse proxy)
    app.set('trust proxy', 1);
    // Health check at root
    app.get('/', (_req, res) => {
        res.json({
            success: true,
            service: 'REZ CRM Hub',
            version: '1.0.0',
            timestamp: new Date().toISOString(),
        });
    });
    // API routes
    app.use('/api', index_js_2.default);
    // Error handling
    app.use(errorHandler_js_1.notFoundHandler);
    app.use(errorHandler_js_1.errorHandler);
    return app;
}
// Graceful shutdown handler
async function gracefulShutdown(signal) {
    console.log(`Received ${signal}. Starting graceful shutdown...`);
    // Stop the sync scheduler
    syncService_js_1.syncService.stopScheduler();
    // Close Redis connection
    if (redisClient) {
        await redisClient.quit();
    }
    // Close MongoDB connection
    await mongoose_1.default.connection.close();
    console.log('Graceful shutdown completed');
    process.exit(0);
}
// Main startup function
async function main() {
    try {
        // Validate configuration
        (0, index_js_1.validateConfig)();
        console.log('Starting REZ CRM Hub service...');
        console.log(`Environment: ${index_js_1.config.nodeEnv}`);
        // Initialize Redis
        await initializeRedis();
        // Initialize Database
        await initializeDatabase();
        // Initialize client tokens from database
        await authService_js_1.authService.initializeClientTokens();
        // Create Express app
        const app = createApp();
        // Start sync scheduler
        syncService_js_1.syncService.startScheduler();
        // Start server
        const server = app.listen(index_js_1.config.port, () => {
            console.log(`REZ CRM Hub listening on port ${index_js_1.config.port}`);
            console.log(`Health check: http://localhost:${index_js_1.config.port}/api/health`);
        });
        // Graceful shutdown handlers
        process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
        process.on('SIGINT', () => gracefulShutdown('SIGINT'));
        // Handle uncaught exceptions
        process.on('uncaughtException', (error) => {
            console.error('Uncaught Exception:', error);
            gracefulShutdown('uncaughtException');
        });
        process.on('unhandledRejection', (reason, promise) => {
            console.error('Unhandled Rejection at:', promise, 'reason:', reason);
        });
        // Export server for testing
        void server; // Suppress unused variable warning
    }
    catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
}
// Start the application
main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
});
exports.default = main;
//# sourceMappingURL=index.js.map