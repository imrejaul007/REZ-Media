"use strict";
/**
 * Lead Intelligence Service
 * Main entry point
 *
 * Detects hot/warm/cold leads based on user behavior:
 * - Scores users based on signals (searches, carts, views, activity)
 * - Detects abandoned carts and searches
 * - Sends signals to ReZ Mind for learning
 * - Integrates with marketing for channel selection
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const morgan_1 = __importDefault(require("morgan"));
const compression_1 = __importDefault(require("compression"));
const mongoose_1 = __importDefault(require("mongoose"));
const swagger_jsdoc_1 = __importDefault(require("swagger-jsdoc"));
const swagger_ui_express_1 = __importDefault(require("swagger-ui-express"));
const node_cron_1 = __importDefault(require("node-cron"));
const config_1 = __importDefault(require("./config"));
const routes_1 = __importDefault(require("./routes"));
const middleware_1 = require("./middleware");
const shared_1 = require("@rez/shared");
const LeadIntelligenceService_1 = require("./services/LeadIntelligenceService");
const marketingIntegration_1 = require("./integrations/marketingIntegration");
// ============================================================================
// Express App Setup
// ============================================================================
const app = (0, express_1.default)();
// Trust proxy (for load balancers)
app.set('trust proxy', 1);
// Security middleware
app.use((0, helmet_1.default)());
app.use((0, cors_1.default)({
    origin: config_1.default.cors.origin,
    methods: config_1.default.cors.methods,
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID', 'X-Service-Token'],
}));
// Compression
app.use((0, compression_1.default)());
// Body parsing
app.use(express_1.default.json({ limit: '10mb' }));
app.use(express_1.default.urlencoded({ extended: true, limit: '10mb' }));
// Request logging
app.use((0, morgan_1.default)('combined', { stream: { write: (message) => shared_1.logger.info(message.trim()) } }));
// Request ID middleware
app.use((req, res, next) => {
    req.headers['x-request-id'] = req.headers['x-request-id'] || generateRequestId();
    res.setHeader('X-Request-ID', req.headers['x-request-id']);
    next();
});
// Request logger middleware
app.use(middleware_1.requestLogger);
// ============================================================================
// Swagger Documentation
// ============================================================================
const swaggerOptions = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'Lead Intelligence Service API',
            version: '1.0.0',
            description: 'API for lead scoring, abandoned cart/search detection, and re-engagement',
        },
        servers: [
            {
                url: `http://localhost:${config_1.default.port}`,
                description: 'Development server',
            },
        ],
        tags: [
            { name: 'Leads', description: 'Lead score endpoints' },
            { name: 'Carts', description: 'Abandoned cart endpoints' },
            { name: 'Searches', description: 'Abandoned search endpoints' },
            { name: 'Channels', description: 'Channel recommendation endpoints' },
            { name: 'Re-Engagement', description: 'Re-engagement endpoints' },
            { name: 'Activity', description: 'User activity tracking endpoints' },
            { name: 'Health', description: 'Health check endpoints' },
        ],
    },
    apis: ['./src/routes/*.ts'],
};
const swaggerSpec = (0, swagger_jsdoc_1.default)(swaggerOptions);
app.use('/api-docs', swagger_ui_express_1.default.serve, swagger_ui_express_1.default.setup(swaggerSpec, {
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'Lead Intelligence API Docs',
}));
// ============================================================================
// API Routes
// ============================================================================
app.use('/api/v1', routes_1.default);
// Root endpoint
app.get('/', (req, res) => {
    res.json({
        service: 'Lead Intelligence Service',
        version: '1.0.0',
        description: 'Hot/Warm/Cold lead detection and re-engagement',
        documentation: '/api-docs',
        health: '/api/v1/health',
    });
});
// Health check endpoint
app.get('/api/v1/health', (req, res) => {
    const mongoStatus = mongoose_1.default.connection.readyState === 1 ? 'connected' : 'disconnected';
    res.json({
        status: 'healthy',
        service: 'lead-intelligence',
        timestamp: new Date().toISOString(),
        mongodb: mongoStatus,
    });
});
// Readiness check
app.get('/api/v1/ready', async (req, res) => {
    try {
        // Check MongoDB connection
        await mongoose_1.default.connection.db?.admin().ping();
        res.json({
            status: 'ready',
            timestamp: new Date().toISOString(),
        });
    }
    catch (error) {
        res.status(503).json({
            status: 'not_ready',
            error: 'Database connection failed',
        });
    }
});
// Validation error handler
app.use(middleware_1.validationErrorHandler);
// 404 handler
app.use(middleware_1.notFoundHandler);
// Error handler
app.use(middleware_1.errorHandler);
// ============================================================================
// Cron Jobs
// ============================================================================
/**
 * Process hot leads every hour
 */
node_cron_1.default.schedule('0 * * * *', async () => {
    shared_1.logger.info('[Cron] Processing hot leads batch');
    try {
        const result = await LeadIntelligenceService_1.leadIntelligenceService.processHotLeadsBatch();
        shared_1.logger.info('[Cron] Hot leads batch completed', result);
    }
    catch (error) {
        shared_1.logger.error('[Cron] Hot leads batch failed', error);
    }
});
/**
 * Sync leads to marketing every hour
 * Creates campaigns for hot (WhatsApp), warm (Push), and cold (Email) leads
 */
node_cron_1.default.schedule('5 * * * *', async () => {
    shared_1.logger.info('[Cron] Syncing leads to marketing');
    try {
        const result = await marketingIntegration_1.marketingIntegration.syncLeadsToMarketing();
        shared_1.logger.info('[Cron] Marketing sync completed', {
            totalProcessed: result.totalProcessed,
            totalErrors: result.totalErrors,
            hotCampaign: result.hotLeads.campaignId,
            warmCampaign: result.warmLeads.campaignId,
            coldCampaign: result.coldLeads.campaignId,
        });
    }
    catch (error) {
        shared_1.logger.error('[Cron] Marketing sync failed', error);
    }
});
/**
 * Process abandoned carts every 4 hours
 */
node_cron_1.default.schedule('0 */4 * * *', async () => {
    shared_1.logger.info('[Cron] Processing abandoned carts batch');
    try {
        const result = await LeadIntelligenceService_1.leadIntelligenceService.processAbandonedCartsBatch();
        shared_1.logger.info('[Cron] Abandoned carts batch completed', result);
    }
    catch (error) {
        shared_1.logger.error('[Cron] Abandoned carts batch failed', error);
    }
});
/**
 * Generate request ID
 */
function generateRequestId() {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}
// ============================================================================
// MongoDB Connection
// ============================================================================
async function connectToMongoDB() {
    try {
        const mongoUri = `${config_1.default.mongodb.uri}/${config_1.default.mongodb.db}`;
        await mongoose_1.default.connect(mongoUri, {
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 45000,
        });
        shared_1.logger.info('Connected to MongoDB', { database: config_1.default.mongodb.db });
    }
    catch (error) {
        shared_1.logger.error('Failed to connect to MongoDB', error);
        throw error;
    }
}
// ============================================================================
// Server Start
// ============================================================================
async function startServer() {
    try {
        // Connect to MongoDB
        await connectToMongoDB();
        // Start listening
        app.listen(config_1.default.port, () => {
            shared_1.logger.info(`Lead Intelligence Service started`, {
                port: config_1.default.port,
                environment: config_1.default.nodeEnv,
                mongodb: config_1.default.mongodb.db,
                docs: `http://localhost:${config_1.default.port}/api-docs`,
            });
        });
        // Graceful shutdown
        process.on('SIGTERM', gracefulShutdown);
        process.on('SIGINT', gracefulShutdown);
    }
    catch (error) {
        shared_1.logger.error('Failed to start server', error);
        process.exit(1);
    }
}
/**
 * Graceful shutdown
 */
async function gracefulShutdown() {
    shared_1.logger.info('Received shutdown signal, closing connections...');
    try {
        await mongoose_1.default.connection.close();
        shared_1.logger.info('MongoDB connection closed');
        process.exit(0);
    }
    catch (error) {
        shared_1.logger.error('Error during shutdown', error);
        process.exit(1);
    }
}
// Start the server
startServer();
exports.default = app;
//# sourceMappingURL=index.js.map