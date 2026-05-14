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
import IORedis from 'ioredis';
export interface RedisConfig {
    host?: string;
    port?: number;
    password?: string;
    username?: string;
    db?: number;
    sentinels?: Array<{
        host: string;
        port: number;
    }>;
    sentinelName?: string;
    url?: string;
}
/**
 * Create a Redis client with authentication support
 */
export declare function createRedisClient(): IORedis;
/**
 * Create a separate Redis client for BullMQ (worker)
 * BullMQ has different connection requirements
 */
export declare function createBullMqRedisClient(): IORedis;
/**
 * Mask URL for logging (hide credentials)
 */
export declare function maskRedisUrl(url: string): string;
//# sourceMappingURL=redis-auth.d.ts.map