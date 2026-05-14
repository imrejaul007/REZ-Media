"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getRedis = getRedis;
exports.getRedisBullMQConnection = getRedisBullMQConnection;
const ioredis_1 = __importDefault(require("ioredis"));
const logger_1 = require("./logger");
const crypto_1 = require("crypto");
let redisClient = null;
function getRedis() {
    if (redisClient)
        return redisClient;
    const url = process.env.REDIS_URL || 'redis://localhost:6379';
    redisClient = new ioredis_1.default(url, {
        maxRetriesPerRequest: null,
        enableReadyCheck: false,
        keepAlive: 10000,
        retryStrategy: (times) => {
            const base = Math.min(Math.pow(2, times) * 200, 15000);
            // BAK-MKT-013 FIX: Use crypto.randomInt for jitter (replaces Math.random())
            return Math.floor(base + (0, crypto_1.randomInt)(0, 500));
        },
        reconnectOnError: (err) => {
            const retriable = ['ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND', 'READONLY'];
            return retriable.some((msg) => err.message.includes(msg));
        },
    });
    redisClient.on('error', (err) => logger_1.logger.error('[Redis] Error: ' + err.message));
    redisClient.on('connect', () => logger_1.logger.info('[Redis] Connection established'));
    redisClient.on('ready', () => logger_1.logger.info('[Redis] Connection ready'));
    redisClient.on('reconnecting', () => logger_1.logger.warn('[Redis] Reconnecting...'));
    return redisClient;
}
function getRedisBullMQConnection() {
    const url = new URL(process.env.REDIS_URL || 'redis://localhost:6379');
    return {
        host: url.hostname,
        port: parseInt(url.port || '6379'),
        password: url.password || undefined,
        maxRetriesPerRequest: null,
        enableReadyCheck: false,
        keepAlive: 10000,
    };
}
//# sourceMappingURL=redis.js.map