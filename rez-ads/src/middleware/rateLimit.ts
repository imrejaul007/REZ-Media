import rateLimit from 'express-rate-limit';
import Redis from 'ioredis';
import { Request, Response } from 'express';

// Rate limit configuration
const WINDOW_MS = parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10);
const MAX_REQUESTS = parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10);

/**
 * Create Redis store for rate limiting
 */
export function createRedisStore(redis: Redis) {
  return class RedisStore {
    private prefix = 'rl:';

    async increment(key: string): Promise<{ totalHits: number; resetTime: Date }> {
      const prefixedKey = this.prefix + key;
      const multi = redis.multi();

      multi.incr(prefixedKey);
      multi.pttl(prefixedKey);

      const results = await multi.exec();

      if (!results) {
        return { totalHits: 1, resetTime: new Date(Date.now() + WINDOW_MS) };
      }

      const totalHits = results[0][1] as number;
      let ttl = results[1][1] as number;

      // Set expiry if key is new
      if (ttl === -1) {
        await redis.pexpire(prefixedKey, WINDOW_MS);
        ttl = WINDOW_MS;
      }

      const resetTime = new Date(Date.now() + ttl);

      return { totalHits, resetTime };
    }

    async decrement(key: string): Promise<void> {
      const prefixedKey = this.prefix + key;
      await redis.decr(prefixedKey);
    }

    async resetKey(key: string): Promise<void> {
      const prefixedKey = this.prefix + key;
      await redis.del(prefixedKey);
    }
  };
}

/**
 * Standard API rate limiter
 */
export function createApiRateLimiter(redis?: Redis) {
  if (redis) {
    const Store = createRedisStore(redis);

    return rateLimit({
      windowMs: WINDOW_MS,
      max: MAX_REQUESTS,
      standardHeaders: true,
      legacyHeaders: false,
      store: new Store(),
      keyGenerator: (req: Request) => {
        // Use user ID if authenticated, otherwise IP
        return req.user?.userId || req.ip || 'unknown';
      },
      handler: (req: Request, res: Response) => {
        res.status(429).json({
          error: 'Too Many Requests',
          message: 'Rate limit exceeded. Please try again later.',
          retryAfter: Math.ceil(WINDOW_MS / 1000),
        });
      },
      skip: (req: Request) => {
        // Skip rate limiting for internal service calls
        return req.isInternalCall === true;
      },
    });
  }

  // Fallback to memory store
  return rateLimit({
    windowMs: WINDOW_MS,
    max: MAX_REQUESTS,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req: Request) => {
      return req.user?.userId || req.ip || 'unknown';
    },
    handler: (req: Request, res: Response) => {
      res.status(429).json({
        error: 'Too Many Requests',
        message: 'Rate limit exceeded. Please try again later.',
        retryAfter: Math.ceil(WINDOW_MS / 1000),
      });
    },
    skip: (req: Request) => {
      return req.isInternalCall === true;
    },
  });
}

/**
 * Strict rate limiter for authentication endpoints
 */
export function createAuthRateLimiter(redis?: Redis) {
  const AUTH_MAX_REQUESTS = 10;
  const AUTH_WINDOW_MS = 60 * 1000; // 1 minute

  if (redis) {
    const Store = createRedisStore(redis);

    return rateLimit({
      windowMs: AUTH_WINDOW_MS,
      max: AUTH_MAX_REQUESTS,
      standardHeaders: true,
      legacyHeaders: false,
      store: new Store(),
      keyGenerator: (req: Request) => {
        return `auth:${req.ip}:${req.path}`;
      },
      handler: (req: Request, res: Response) => {
        res.status(429).json({
          error: 'Too Many Requests',
          message: 'Too many authentication attempts. Please try again in a minute.',
          retryAfter: 60,
        });
      },
    });
  }

  return rateLimit({
    windowMs: AUTH_WINDOW_MS,
    max: AUTH_MAX_REQUESTS,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req: Request) => {
      return `auth:${req.ip}:${req.path}`;
    },
    handler: (req: Request, res: Response) => {
      res.status(429).json({
        error: 'Too Many Requests',
        message: 'Too many authentication attempts. Please try again in a minute.',
        retryAfter: 60,
      });
    },
  });
}

/**
 * Ad serving rate limiter (higher limits for legitimate traffic)
 */
export function createServeRateLimiter(redis?: Redis) {
  const SERVE_MAX_REQUESTS = 1000;
  const SERVE_WINDOW_MS = 60000; // 1 minute

  if (redis) {
    const Store = createRedisStore(redis);

    return rateLimit({
      windowMs: SERVE_WINDOW_MS,
      max: SERVE_MAX_REQUESTS,
      standardHeaders: true,
      legacyHeaders: false,
      store: new Store(),
      keyGenerator: (req: Request) => {
        // Per-session or per-IP
        return `serve:${req.query.sessionId || req.ip}:${req.query.placementId || 'unknown'}`;
      },
      handler: (req: Request, res: Response) => {
        res.status(429).json({
          error: 'Too Many Requests',
          message: 'Too many ad requests. Please slow down.',
          retryAfter: 60,
        });
      },
    });
  }

  return rateLimit({
    windowMs: SERVE_WINDOW_MS,
    max: SERVE_MAX_REQUESTS,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req: Request) => {
      return `serve:${req.query.sessionId || req.ip}:${req.query.placementId || 'unknown'}`;
    },
    handler: (req: Request, res: Response) => {
      res.status(429).json({
        error: 'Too Many Requests',
        message: 'Too many ad requests. Please slow down.',
        retryAfter: 60,
      });
    },
  });
}

/**
 * Event tracking rate limiter (for click/impression events)
 */
export function createEventRateLimiter(redis?: Redis) {
  const EVENT_MAX_REQUESTS = 500;
  const EVENT_WINDOW_MS = 60000; // 1 minute

  if (redis) {
    const Store = createRedisStore(redis);

    return rateLimit({
      windowMs: EVENT_WINDOW_MS,
      max: EVENT_MAX_REQUESTS,
      standardHeaders: true,
      legacyHeaders: false,
      store: new Store(),
      keyGenerator: (req: Request) => {
        // Per-campaign or per-IP
        return `event:${req.query.campaignId || req.ip}`;
      },
      handler: (req: Request, res: Response) => {
        res.status(429).json({
          error: 'Too Many Requests',
          message: 'Too many events. Please slow down.',
          retryAfter: 60,
        });
      },
    });
  }

  return rateLimit({
    windowMs: EVENT_WINDOW_MS,
    max: EVENT_MAX_REQUESTS,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req: Request) => {
      return `event:${req.query.campaignId || req.ip}`;
    },
    handler: (req: Request, res: Response) => {
      res.status(429).json({
        error: 'Too Many Requests',
        message: 'Too many events. Please slow down.',
        retryAfter: 60,
      });
    },
  });
}

/**
 * Campaign management rate limiter (stricter for write operations)
 */
export function createCampaignRateLimiter(redis?: Redis) {
  const CAMPAIGN_MAX_REQUESTS = 100;
  const CAMPAIGN_WINDOW_MS = 60000; // 1 minute

  if (redis) {
    const Store = createRedisStore(redis);

    return rateLimit({
      windowMs: CAMPAIGN_WINDOW_MS,
      max: CAMPAIGN_MAX_REQUESTS,
      standardHeaders: true,
      legacyHeaders: false,
      store: new Store(),
      keyGenerator: (req: Request) => {
        return `campaign:${req.user?.userId || req.ip}`;
      },
      handler: (req: Request, res: Response) => {
        res.status(429).json({
          error: 'Too Many Requests',
          message: 'Too many campaign operations. Please slow down.',
          retryAfter: 60,
        });
      },
      skip: (req: Request) => {
        // Skip for read operations (GET)
        return req.method === 'GET';
      },
    });
  }

  return rateLimit({
    windowMs: CAMPAIGN_WINDOW_MS,
    max: CAMPAIGN_MAX_REQUESTS,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req: Request) => {
      return `campaign:${req.user?.userId || req.ip}`;
    },
    handler: (req: Request, res: Response) => {
      res.status(429).json({
        error: 'Too Many Requests',
        message: 'Too many campaign operations. Please slow down.',
        retryAfter: 60,
      });
    },
    skip: (req: Request) => {
      return req.method === 'GET';
    },
  });
}
