"use strict";
/**
 * Redis Connection with Authentication Support
 *
 * CRITICAL SECURITY: This module supports Redis authentication.
 * Enable by setting REDIS_PASSWORD env var.
 *
 * Connection Modes:
 *   1. Single node: REDIS_URL=redis://host:6379
 *   2. Sentinel:    REDIS_SENTINEL_HOSTS=s1:26379,s2:26379
 *                  REDIS_SENTINEL_NAME=mymaster
 *                  REDIS_PASSWORD=your_password
 *
 * For Redis AUTH:
 *   Set REDIS_PASSWORD=your_password
 *
 * For Redis ACL:
 *   Set REDIS_USERNAME=your_username (optional)
 *   Set REDIS_PASSWORD=your_password
 *
 * For Sentinel with AUTH:
 *   Set REDIS_SENTINEL_HOSTS=s1:26379,s2:26379
 *   Set REDIS_PASSWORD=your_password
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createRedisClient = createRedisClient;
exports.createBullMqRedisClient = createBullMqRedisClient;
exports.maskRedisUrl = maskRedisUrl;
const ioredis_1 = __importDefault(require("ioredis"));
const logger_1 = require("./logger");
const crypto_1 = require("crypto");
/**
 * Get Redis password from environment
 */
function getRedisPassword() {
    return process.env.REDIS_PASSWORD || undefined;
}
/**
 * Get Redis username from environment (for ACL)
 */
function getRedisUsername() {
    return process.env.REDIS_USERNAME || undefined;
}
/**
 * Parse Redis URL into connection config
 */
function parseRedisUrl(url) {
    try {
        const parsed = new URL(url);
        const password = parsed.password || undefined;
        const db = parsed.pathname ? parseInt(parsed.pathname.slice(1), 10) : undefined;
        return {
            host: parsed.hostname,
            port: parseInt(parsed.port || '6379', 10),
            password,
            db: isNaN(db) ? undefined : db,
        };
    }
    catch {
        // Fallback for simple URLs without protocol
        const parts = url.replace('redis://', '').split(':');
        return {
            host: parts[0] || 'localhost',
            port: parseInt(parts[1] || '6379', 10),
        };
    }
}
/**
 * Create a Redis client with authentication support
 */
function createRedisClient() {
    const sentinelRaw = process.env.REDIS_SENTINEL_HOSTS;
    const password = getRedisPassword();
    const username = getRedisUsername();
    const hasAuth = !!(password || username);
    if (hasAuth) {
        logger_1.logger.info('[Redis] Authentication enabled', {
            hasPassword: !!password,
            hasUsername: !!username,
            mode: sentinelRaw ? 'sentinel' : 'single',
        });
    }
    const retryStrategy = (times) => {
        const base = Math.min(times * 200, 5000);
        // Use crypto.randomInt for secure random jitter
        return Math.floor(base + (0, crypto_1.randomInt)(500));
    };
    const reconnectOnError = (err) => err.message.includes('ECONNRESET') ||
        err.message.includes('EPIPE') ||
        err.message.includes('READONLY');
    // Sentinel mode
    if (sentinelRaw) {
        if (!sentinelRaw.includes(',')) {
            throw new Error('REDIS_SENTINEL_HOSTS must contain at least one sentinel host');
        }
        const sentinels = sentinelRaw.split(',').map((h) => {
            const [host, port] = h.trim().split(':');
            if (!host)
                throw new Error('Sentinel host cannot be empty');
            return { host, port: parseInt(port || '26379', 10) };
        });
        return new ioredis_1.default({
            sentinels,
            name: process.env.REDIS_SENTINEL_NAME || 'mymaster',
            password: password,
            username: username,
            maxRetriesPerRequest: 3,
            enableReadyCheck: true,
            lazyConnect: false,
            keepAlive: 10000,
            retryStrategy,
            reconnectOnError,
        });
    }
    // Single node mode
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    const parsed = parseRedisUrl(redisUrl);
    // Check if URL already contains password
    const urlPassword = parsed.password;
    const finalPassword = password || urlPassword;
    return new ioredis_1.default({
        host: parsed.host,
        port: parsed.port,
        password: finalPassword,
        username: username,
        db: parsed.db || 0,
        maxRetriesPerRequest: 3,
        enableReadyCheck: true,
        lazyConnect: false,
        keepAlive: 10000,
        retryStrategy,
        reconnectOnError,
    });
}
/**
 * Create a separate Redis client for BullMQ (worker)
 * BullMQ has different connection requirements
 */
function createBullMqRedisClient() {
    const sentinelRaw = process.env.REDIS_SENTINEL_HOSTS;
    const password = getRedisPassword();
    const username = getRedisUsername();
    if (sentinelRaw) {
        if (!sentinelRaw.includes(',')) {
            throw new Error('REDIS_SENTINEL_HOSTS must contain at least one sentinel host');
        }
        const sentinels = sentinelRaw.split(',').map((h) => {
            const [host, port] = h.trim().split(':');
            return { host, port: parseInt(port || '26379', 10) };
        });
        return new ioredis_1.default({
            sentinels,
            name: process.env.REDIS_SENTINEL_NAME || 'mymaster',
            password: password,
            username: username,
            maxRetriesPerRequest: null, // Required for BullMQ
            enableReadyCheck: false,
            enableOfflineQueue: true,
            lazyConnect: false,
        });
    }
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    const parsed = parseRedisUrl(redisUrl);
    const urlPassword = parsed.password;
    const finalPassword = password || urlPassword;
    return new ioredis_1.default({
        host: parsed.host,
        port: parsed.port,
        password: finalPassword,
        username: username,
        db: parsed.db || 1, // Use different DB for BullMQ
        maxRetriesPerRequest: null, // Required for BullMQ
        enableReadyCheck: false,
        enableOfflineQueue: true,
        lazyConnect: false,
    });
}
/**
 * Mask URL for logging (hide credentials)
 */
function maskRedisUrl(url) {
    if (!url)
        return '[not set]';
    try {
        const parsed = new URL(url);
        if (parsed.password) {
            parsed.password = '***';
        }
        return parsed.toString();
    }
    catch {
        return '[invalid URL]';
    }
}
//# sourceMappingURL=redis-auth.js.map