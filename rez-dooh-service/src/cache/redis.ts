/**
 * DOOH Service - Redis Cache
 *
 * Redis integration for caching, sessions, and distributed rate limiting.
 */

import Redis from 'ioredis';
import { createClient, RedisClientType } from 'redis';

// ============================================================================
// Redis Client
// ============================================================================

let redis: Redis | null = null;
let redisV4: RedisClientType | null = null;

export interface RedisConfig {
  host?: string;
  port?: number;
  password?: string;
  url?: string;
}

export async function connectRedis(config?: RedisConfig): Promise<Redis> {
  if (redis) {
    return redis;
  }

  const url = config?.url || process.env.REDIS_URL;

  if (!url) {
    // Fallback to individual config
    const host = config?.host || process.env.REDIS_HOST || 'localhost';
    const port = config?.port || parseInt(process.env.REDIS_PORT || '6379');
    const password = config?.password || process.env.REDIS_PASSWORD;

    redis = new Redis({
      host,
      port,
      password: password || undefined,
      maxRetriesPerRequest: 3,
      retryStrategy(times) {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
    });
  } else {
    redis = new Redis(url, {
      maxRetriesPerRequest: 3,
      retryStrategy(times) {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
    });
  }

  redis.on('error', (err) => {
    console.error('[Redis] Error:', err.message);
  });

  redis.on('connect', () => {
    console.log('[Redis] Connected');
  });

  redis.on('reconnecting', () => {
    console.log('[Redis] Reconnecting...');
  });

  return redis;
}

export async function connectRedisV4(config?: RedisConfig): Promise<RedisClientType> {
  if (redisV4) {
    return redisV4;
  }

  const url = config?.url || process.env.REDIS_URL;

  if (!url) {
    throw new Error('REDIS_URL is required for Redis v4 client');
  }

  redisV4 = createClient({ url });

  redisV4.on('error', (err) => {
    console.error('[Redis] Error:', err.message);
  });

  await redisV4.connect();
  console.log('[Redis] Connected (v4)');

  return redisV4;
}

export function getRedis(): Redis | null {
  return redis;
}

export async function disconnectRedis(): Promise<void> {
  if (redis) {
    await redis.quit();
    redis = null;
    console.log('[Redis] Disconnected');
  }
}

// ============================================================================
// Cache Utilities
// ============================================================================

const DEFAULT_TTL = 3600; // 1 hour

export async function cacheGet<T>(key: string): Promise<T | null> {
  if (!redis) return null;

  const data = await redis.get(key);
  if (!data) return null;

  try {
    return JSON.parse(data) as T;
  } catch {
    return null;
  }
}

export async function cacheSet<T>(
  key: string,
  value: T,
  ttlSeconds: number = DEFAULT_TTL
): Promise<void> {
  if (!redis) return;

  const data = JSON.stringify(value);
  await redis.setex(key, ttlSeconds, data);
}

export async function cacheDelete(key: string): Promise<void> {
  if (!redis) return;
  await redis.del(key);
}

export async function cacheExists(key: string): Promise<boolean> {
  if (!redis) return false;
  const result = await redis.exists(key);
  return result === 1;
}

// ============================================================================
// Rate Limiting (Redis-based)
// ============================================================================

export interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Max requests per window
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number; // Unix timestamp when the window resets
  retryAfter?: number; // Seconds until retry is allowed
}

export async function checkRateLimit(
  key: string,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  if (!redis) {
    // Fallback: always allow
    return {
      allowed: true,
      remaining: config.maxRequests,
      resetAt: Date.now() + config.windowMs,
    };
  }

  const now = Date.now();
  const windowKey = `ratelimit:${key}:${Math.floor(now / config.windowMs)}`;

  // Use Redis multi for atomic operations
  const multi = redis.multi();
  multi.incr(windowKey);
  multi.ttl(windowKey);

  const results = await multi.exec();

  if (!results) {
    return {
      allowed: true,
      remaining: config.maxRequests,
      resetAt: now + config.windowMs,
    };
  }

  const count = (results[0][1] as number) || 1;
  const ttl = (results[1][1] as number) || Math.floor(config.windowMs / 1000);

  const resetAt = now + (ttl * 1000);
  const remaining = Math.max(0, config.maxRequests - count);
  const allowed = count <= config.maxRequests;

  // Set expiry if this is a new key
  if (count === 1) {
    await redis.expire(windowKey, Math.floor(config.windowMs / 1000));
  }

  return {
    allowed,
    remaining,
    resetAt,
    retryAfter: allowed ? undefined : ttl,
  };
}

// ============================================================================
// Distributed Locking
// ============================================================================

export interface LockOptions {
  ttlMs: number; // Lock TTL in milliseconds
  retryCount?: number;
  retryDelayMs?: number;
}

export async function acquireLock(
  key: string,
  options: LockOptions
): Promise<boolean> {
  if (!redis) return false;

  const lockKey = `lock:${key}`;
  const lockValue = `${Date.now()}-${Math.random()}`;

  for (let i = 0; i < (options.retryCount || 0); i++) {
    // NX = only set if not exists, PX = expire in milliseconds
    const result = await redis.set(lockKey, lockValue, 'PX', options.ttlMs, 'NX');

    if (result === 'OK') {
      return true;
    }

    // Wait before retry
    if (options.retryDelayMs) {
      await new Promise((resolve) => setTimeout(resolve, options.retryDelayMs));
    }
  }

  return false;
}

export async function releaseLock(key: string): Promise<boolean> {
  if (!redis) return false;

  const lockKey = `lock:${key}`;
  const result = await redis.del(lockKey);
  return result === 1;
}

// ============================================================================
// Idempotency
// ============================================================================

export async function checkIdempotency(
  key: string,
  ttlSeconds: number = 86400 // 24 hours
): Promise<{ isNew: boolean; cachedResponse?: unknown }> {
  if (!redis) {
    return { isNew: true };
  }

  const idempotencyKey = `idempotency:${key}`;

  // Try to get cached response
  const cached = await redis.get(idempotencyKey);
  if (cached) {
    try {
      return {
        isNew: false,
        cachedResponse: JSON.parse(cached),
      };
    } catch {
      // Corrupted data, treat as new
      await redis.del(idempotencyKey);
    }
  }

  // Set a placeholder (will be replaced with actual response)
  await redis.setex(idempotencyKey, ttlSeconds, 'PROCESSING');
  return { isNew: true };
}

export async function setIdempotencyResponse(
  key: string,
  response: unknown,
  ttlSeconds: number = 86400
): Promise<void> {
  if (!redis) return;

  const idempotencyKey = `idempotency:${key}`;
  await redis.setex(idempotencyKey, ttlSeconds, JSON.stringify(response));
}

// ============================================================================
// Screen-Specific Cache
// ============================================================================

const PLAYLIST_CACHE_PREFIX = 'playlist:';
const SCREEN_HEALTH_PREFIX = 'health:';

export async function cachePlaylist(
  screenId: string,
  playlist: unknown,
  ttlSeconds: number = 300 // 5 minutes
): Promise<void> {
  return cacheSet(`${PLAYLIST_CACHE_PREFIX}${screenId}`, playlist, ttlSeconds);
}

export async function getCachedPlaylist(screenId: string): Promise<unknown | null> {
  return cacheGet(`${PLAYLIST_CACHE_PREFIX}${screenId}`);
}

export async function invalidatePlaylistCache(screenId: string): Promise<void> {
  return cacheDelete(`${PLAYLIST_CACHE_PREFIX}${screenId}`);
}

export async function updateScreenHealth(
  screenId: string,
  health: unknown,
  ttlSeconds: number = 120 // 2 minutes
): Promise<void> {
  return cacheSet(`${SCREEN_HEALTH_PREFIX}${screenId}`, health, ttlSeconds);
}

export async function getCachedScreenHealth(screenId: string): Promise<unknown | null> {
  return cacheGet(`${SCREEN_HEALTH_PREFIX}${screenId}`);
}

// ============================================================================
// Session Management
// ============================================================================

export interface SessionData {
  userId: string;
  serviceId?: string;
  permissions: string[];
  createdAt: number;
  expiresAt: number;
}

export async function createSession(
  sessionId: string,
  data: Omit<SessionData, 'createdAt' | 'expiresAt'>,
  ttlSeconds: number = 3600
): Promise<void> {
  if (!redis) return;

  const session: SessionData = {
    ...data,
    createdAt: Date.now(),
    expiresAt: Date.now() + (ttlSeconds * 1000),
  };

  await redis.setex(`session:${sessionId}`, ttlSeconds, JSON.stringify(session));
}

export async function getSession(sessionId: string): Promise<SessionData | null> {
  if (!redis) return null;

  const data = await redis.get(`session:${sessionId}`);
  if (!data) return null;

  try {
    const session = JSON.parse(data) as SessionData;

    // Check expiration
    if (session.expiresAt < Date.now()) {
      await redis.del(`session:${sessionId}`);
      return null;
    }

    return session;
  } catch {
    return null;
  }
}

export async function deleteSession(sessionId: string): Promise<void> {
  if (!redis) return;
  await redis.del(`session:${sessionId}`);
}

export async function refreshSession(
  sessionId: string,
  ttlSeconds: number = 3600
): Promise<boolean> {
  if (!redis) return false;

  const session = await getSession(sessionId);
  if (!session) return false;

  session.expiresAt = Date.now() + (ttlSeconds * 1000);
  await redis.setex(`session:${sessionId}`, ttlSeconds, JSON.stringify(session));

  return true;
}
