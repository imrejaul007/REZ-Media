// @ts-nocheck
import Redis from 'ioredis';
import { logger } from './logger';
import { randomUUID, randomInt } from 'crypto';

let redisClient: Redis | null = null;

export function getRedis(): Redis {
  if (redisClient) return redisClient;

  // SECURITY FIX: Fail at startup if REDIS_URL not set
  const url = process.env.REDIS_URL;
  if (!url) {
    throw new Error('REDIS_URL environment variable is required');
  }

  redisClient = new Redis(url, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    keepAlive: 10_000,
    retryStrategy: (times: number) => {
      const base = Math.min(Math.pow(2, times) * 200, 15000);
      // BAK-MKT-013 FIX: Use crypto.randomInt() for jitter — Math.random() is
      // predictable and could allow an attacker to anticipate retry timing.
      const jitter = randomInt(0, 500);
      return base + jitter;
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
