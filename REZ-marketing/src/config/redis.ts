import Redis from 'ioredis';
import { logger } from './logger';
import { randomUUID, randomInt } from 'crypto';

let redisClient: Redis | null = null;

export function getRedis(): Redis {
  if (redisClient) return redisClient;

  const url = process.env.REDIS_URL || 'redis://localhost:6379';

  redisClient = new Redis(url, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    keepAlive: 10_000,
    retryStrategy: (times: number) => {
      const base = Math.min(Math.pow(2, times) * 200, 15000);
      // BAK-MKT-013 FIX: Use crypto.randomInt for jitter (replaces Math.random())
      return Math.floor(base + randomInt(0, 500));
    },
    reconnectOnError: (err) => {
      const retriable = ['ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND', 'READONLY'];
      return retriable.some((msg) => err.message.includes(msg));
    },
  });

  redisClient.on('error', (err) => logger.error('[Redis] Error: ' + err.message));
  redisClient.on('connect', () => logger.info('[Redis] Connection established'));
  redisClient.on('ready', () => logger.info('[Redis] Connection ready'));
  redisClient.on('reconnecting', () => logger.warn('[Redis] Reconnecting...'));

  return redisClient;
}

export function getRedisBullMQConnection() {
  const url = new URL(process.env.REDIS_URL || 'redis://localhost:6379');
  return {
    host: url.hostname,
    port: parseInt(url.port || '6379'),
    password: url.password || undefined,
    maxRetriesPerRequest: null as null,
    enableReadyCheck: false,
    keepAlive: 10_000,
  };
}
