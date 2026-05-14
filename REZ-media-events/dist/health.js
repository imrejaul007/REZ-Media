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
exports.setHealthy = setHealthy;
exports.startHealthServer = startHealthServer;
const http_1 = __importDefault(require("http"));
const logger_1 = require("./config/logger");
let isHealthy = true;
function setHealthy(healthy) {
    isHealthy = healthy;
}
function startHealthServer(port = 3001) {
    const server = http_1.default.createServer((req, res) => {
        if (req.url === '/health' || req.url === '/healthz') {
            if (isHealthy) {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ status: 'ok', uptime: process.uptime() }));
            }
            else {
                res.writeHead(503, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ status: 'unhealthy' }));
            }
        }
        else if (req.url === '/ready') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ status: 'ready' }));
        }
        else if (req.url === '/health/detailed') {
            // Detailed health check - use async handler
            handleDetailedHealth(req, res);
        }
        else {
            res.writeHead(404);
            res.end();
        }
    });
    server.listen(port, () => {
        logger_1.logger.info(`Health server listening on port ${port}`);
    });
    return server;
}
async function handleDetailedHealth(req, res) {
    const checks = {};
    let allHealthy = isHealthy;
    // MongoDB check with latency (if available)
    try {
        const mongoose = await Promise.resolve().then(() => __importStar(require('mongoose')));
        const mongoStart = Date.now();
        if (mongoose.connection.readyState === 1) {
            await mongoose.connection.db?.admin().ping();
            checks.database = { status: 'up', latencyMs: Date.now() - mongoStart };
        }
        else {
            checks.database = { status: 'down', error: 'MongoDB not connected' };
            allHealthy = false;
        }
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        checks.database = { status: 'down', error: msg };
        allHealthy = false;
    }
    // Redis check with latency
    try {
        const { bullmqRedis } = await Promise.resolve().then(() => __importStar(require('./config/redis')));
        const redisStart = Date.now();
        await bullmqRedis.ping();
        checks.redis = { status: 'up', latencyMs: Date.now() - redisStart };
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        checks.redis = { status: 'down', error: msg };
        allHealthy = false;
    }
    // Memory usage
    const memUsage = process.memoryUsage();
    checks.memory = {
        heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
        heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
        rss: Math.round(memUsage.rss / 1024 / 1024),
    };
    const response = {
        status: allHealthy ? 'healthy' : 'unhealthy',
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
        checks,
    };
    res.writeHead(allHealthy ? 200 : 503, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(response, null, 2));
}
//# sourceMappingURL=health.js.map