"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.bullmqRedis = void 0;
const ioredis_1 = __importDefault(require("ioredis"));
const logger_1 = require("./logger");
const crypto_1 = require("crypto");
// SECURITY FIX: Fail at startup if REDIS_URL not set
const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
if (!process.env.REDIS_URL) {
    console.warn('[Redis] WARNING: REDIS_URL not set, using default localhost:6379');
}
function parsedUrl() {
    try {
        return new URL(redisUrl);
    }
    catch {
        throw new Error(`Invalid REDIS_URL: ${redisUrl}`);
    }
}
const u = parsedUrl();
exports.bullmqRedis = new ioredis_1.default({
    host: u.hostname || 'localhost',
    port: parseInt(u.port || '6379', 10),
    password: u.password || undefined,
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    keepAlive: 10000,
    retryStrategy: (times) => {
        const base = Math.min(Math.pow(2, times) * 200, 15000);
        return base + (0, crypto_1.randomInt)(0, 1000);
    },
    reconnectOnError: (err) => {
        return err.message.includes('ECONNRESET') || err.message.includes('EPIPE') || err.message.includes('READONLY');
    },
    lazyConnect: false,
    tls: process.env.REDIS_TLS === 'true' ? { rejectUnauthorized: true } : undefined,
});
exports.bullmqRedis.on('connect', () => logger_1.logger.info('[Redis] Connection established'));
exports.bullmqRedis.on('ready', () => logger_1.logger.info('[Redis] Connection ready'));
exports.bullmqRedis.on('reconnecting', () => logger_1.logger.warn('[Redis] Reconnecting...'));
exports.bullmqRedis.on('error', (err) => logger_1.logger.error('[Redis] Error: ' + err.message));
exports.bullmqRedis.on('end', () => logger_1.logger.error('[Redis] Connection closed'));
//# sourceMappingURL=redis.js.map