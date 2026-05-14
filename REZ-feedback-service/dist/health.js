"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkHealth = checkHealth;
exports.isAlive = isAlive;
exports.isReady = isReady;
const mongoose_1 = __importDefault(require("mongoose"));
const ioredis_1 = __importDefault(require("ioredis"));
const rez_mind_1 = require("./integrations/rez-mind");
const feedback_processor_1 = require("./workers/feedback-processor");
const startTime = Date.now();
async function checkHealth() {
    const checks = {
        mongodb: await checkMongoDB(),
        redis: await checkRedis(),
        rezMind: await checkRezMind(),
        queue: await checkQueue()
    };
    const allUp = Object.values(checks).every(c => c.status === 'up');
    const anyDown = Object.values(checks).some(c => c.status === 'down');
    let status = 'healthy';
    if (anyDown) {
        status = 'unhealthy';
    }
    else if (!allUp) {
        status = 'degraded';
    }
    return {
        status,
        timestamp: Date.now(),
        version: process.env.npm_package_version || '1.0.0',
        uptime: Math.floor((Date.now() - startTime) / 1000),
        checks
    };
}
async function checkMongoDB() {
    const start = Date.now();
    try {
        const state = mongoose_1.default.connection.readyState;
        // 0 = disconnected, 1 = connected, 2 = connecting, 3 = disconnecting
        if (state === 1) {
            // Ping the database
            await mongoose_1.default.connection.db?.admin().ping();
            return {
                status: 'up',
                latency_ms: Date.now() - start
            };
        }
        return {
            status: 'down',
            message: `Mongoose state: ${state}`
        };
    }
    catch (error) {
        return {
            status: 'down',
            latency_ms: Date.now() - start,
            message: error instanceof Error ? error.message : 'Unknown error'
        };
    }
}
async function checkRedis() {
    const start = Date.now();
    try {
        const redis = new ioredis_1.default({
            host: process.env.REDIS_HOST || 'localhost',
            port: parseInt(process.env.REDIS_PORT || '6379'),
            maxRetriesPerRequest: null
        });
        await redis.ping();
        redis.disconnect();
        return {
            status: 'up',
            latency_ms: Date.now() - start
        };
    }
    catch (error) {
        return {
            status: 'down',
            latency_ms: Date.now() - start,
            message: error instanceof Error ? error.message : 'Unknown error'
        };
    }
}
async function checkRezMind() {
    const start = Date.now();
    try {
        const isHealthy = await rez_mind_1.rezMindClient.healthCheck();
        return {
            status: isHealthy ? 'up' : 'down',
            latency_ms: Date.now() - start
        };
    }
    catch (error) {
        return {
            status: 'unknown',
            latency_ms: Date.now() - start,
            message: 'Could not connect to ReZ Mind'
        };
    }
}
async function checkQueue() {
    try {
        const stats = await feedback_processor_1.feedbackProcessor.getQueueStats();
        const totalPending = stats.waiting + stats.active + stats.delayed;
        // Queue is healthy if we have capacity
        if (stats.failed > 100) {
            return {
                status: 'degraded',
                message: `${stats.failed} failed jobs in queue`
            };
        }
        return {
            status: 'up',
            message: `${totalPending} pending, ${stats.completed} completed`
        };
    }
    catch (error) {
        return {
            status: 'unknown',
            message: 'Could not get queue stats'
        };
    }
}
// Liveness probe - is the process running?
function isAlive() {
    return true;
}
// Readiness probe - is the service ready to receive traffic?
async function isReady() {
    try {
        const mongoHealth = await checkMongoDB();
        const redisHealth = await checkRedis();
        return mongoHealth.status === 'up' && redisHealth.status === 'up';
    }
    catch {
        return false;
    }
}
//# sourceMappingURL=health.js.map