"use strict";
/**
 * rez-media-events — Standalone BullMQ Worker Service
 *
 * Phase C extraction from REZ monolith (Strangler Fig pattern).
 */
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
process.env.SERVICE_NAME = 'rez-media-events';
const logger_1 = require("./config/logger");
const mongodb_1 = require("./config/mongodb");
const redis_1 = require("./config/redis");
const health_1 = require("./health");
const worker_1 = require("./worker");
const http_1 = require("./http");
function validateEnv() {
    const cloudinaryVars = ['CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET'];
    const missingCloudinary = cloudinaryVars.filter((k) => !process.env[k]);
    if (missingCloudinary.length > 0) {
        // MED-SEC-FIX: Downgrade from warn to error — Cloudinary is required for the
        // upload endpoint to function. A missing env var should not silently degrade.
        logger_1.logger.error(`[rez-media-events] FATAL: Missing Cloudinary env vars: ${missingCloudinary.join(', ')} — upload endpoint will fail`);
    }
}
async function main() {
    validateEnv();
    logger_1.logger.info('[rez-media-events] Starting...');
    await (0, mongodb_1.connectMongoDB)();
    const worker = (0, worker_1.startMediaWorker)();
    const httpPort = parseInt(process.env.PORT || '3008', 10);
    const httpServer = (0, http_1.startHttpServer)(httpPort);
    const healthServer = (0, health_1.startHealthServer)(httpPort + 1);
    const shutdown = async (signal) => {
        logger_1.logger.info(`[${signal}] Graceful shutdown initiated`);
        try {
            await (0, worker_1.stopWorker)();
            httpServer.close();
            healthServer.close();
            await redis_1.bullmqRedis.quit();
            await (0, mongodb_1.disconnectMongoDB)();
            logger_1.logger.info('[rez-media-events] Shutdown complete');
            process.exit(0);
        }
        catch (err) {
            logger_1.logger.error('[rez-media-events] Shutdown error:', err);
            process.exit(1);
        }
    };
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('unhandledRejection', (reason) => {
        logger_1.logger.error('Unhandled promise rejection', { reason: reason instanceof Error ? reason.message : String(reason) });
    });
    process.on('uncaughtException', (err) => {
        logger_1.logger.error('Uncaught exception', { error: err.message, stack: err.stack });
        process.exit(1);
    });
    logger_1.logger.info('[rez-media-events] Ready');
}
main().catch((err) => {
    logger_1.logger.error('[FATAL] Failed to start:', err);
    process.exit(1);
});
//# sourceMappingURL=index.js.map