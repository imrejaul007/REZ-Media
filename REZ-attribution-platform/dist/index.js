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
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const compression_1 = __importDefault(require("compression"));
const mongoose_1 = __importDefault(require("mongoose"));
const dotenv_1 = __importDefault(require("dotenv"));
const routes_1 = require("./routes");
const logger_1 = __importDefault(require("./utils/logger"));
// Load environment variables
dotenv_1.default.config();
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/rez-attribution';
// Middleware
app.use((0, helmet_1.default)());
app.use((0, cors_1.default)({
    origin: process.env.CORS_ORIGIN || '*',
    credentials: true
}));
app.use((0, compression_1.default)());
app.use(express_1.default.json({ limit: '10mb' }));
app.use(express_1.default.urlencoded({ extended: true }));
// Request logging middleware
app.use((req, _res, next) => {
    logger_1.default.info(`${req.method} ${req.path}`, {
        query: req.query,
        ip: req.ip
    });
    next();
});
// Health check endpoint
app.get('/health', (_req, res) => {
    const healthcheck = {
        uptime: process.uptime(),
        message: 'OK',
        timestamp: new Date().toISOString(),
        database: mongoose_1.default.connection.readyState === 1 ? 'connected' : 'disconnected'
    };
    res.json(healthcheck);
});
// API Routes
app.use('/api/track', routes_1.trackRoutes);
app.use('/api/reports', routes_1.reportsRoutes);
// Campaign attribution endpoint (POST version)
app.post('/api/campaigns/:id/attribution', async (req, res, next) => {
    try {
        const { id: campaignId } = req.params;
        const { reportGenerator } = await Promise.resolve().then(() => __importStar(require('./services/ReportGenerator')));
        const { AttributionModel } = await Promise.resolve().then(() => __importStar(require('./models/AttributionReport')));
        const { startDate, endDate, attributionModel } = req.body;
        const report = await reportGenerator.generateCampaignAttribution(campaignId, {
            startDate: startDate ? new Date(startDate) : undefined,
            endDate: endDate ? new Date(endDate) : undefined,
            attributionModel: attributionModel || AttributionModel.LINEAR
        });
        res.json({
            success: true,
            data: report
        });
    }
    catch (error) {
        next(error);
    }
});
// Error handling middleware
app.use((err, _req, res, _next) => {
    logger_1.default.error('Unhandled error', {
        error: err.message,
        stack: err.stack
    });
    res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});
// 404 handler
app.use((_req, res) => {
    res.status(404).json({
        success: false,
        error: 'Not found'
    });
});
// Database connection
async function connectDatabase() {
    try {
        await mongoose_1.default.connect(MONGODB_URI, {
            maxPoolSize: 10,
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 45000
        });
        logger_1.default.info('Connected to MongoDB', { uri: MONGODB_URI.replace(/\/\/.*@/, '//<credentials>@') });
    }
    catch (error) {
        logger_1.default.error('Failed to connect to MongoDB', { error });
        process.exit(1);
    }
}
// Graceful shutdown
async function shutdown(signal) {
    logger_1.default.info(`Received ${signal}. Shutting down gracefully...`);
    try {
        await mongoose_1.default.connection.close();
        logger_1.default.info('MongoDB connection closed');
        process.exit(0);
    }
    catch (error) {
        logger_1.default.error('Error during shutdown', { error });
        process.exit(1);
    }
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
// Start server
async function startServer() {
    await connectDatabase();
    app.listen(PORT, () => {
        logger_1.default.info(`REZ Attribution Platform running on port ${PORT}`, {
            nodeEnv: process.env.NODE_ENV,
            mongodbUri: MONGODB_URI.replace(/\/\/.*@/, '//<credentials>@')
        });
        logger_1.default.info('Available endpoints:', {
            'POST /api/track/touchpoint': 'Track a touchpoint',
            'POST /api/track/conversion': 'Track a conversion',
            'GET /api/reports/attribution': 'Get attribution report',
            'GET /api/reports/funnel': 'Get conversion funnel',
            'POST /api/campaigns/:id/attribution': 'Get campaign attribution'
        });
    });
}
startServer().catch(error => {
    logger_1.default.error('Failed to start server', { error });
    process.exit(1);
});
exports.default = app;
//# sourceMappingURL=index.js.map