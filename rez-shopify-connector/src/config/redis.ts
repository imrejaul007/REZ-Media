import Redis from 'ioredis';
import { logger } from './logger';
import { randomInt } from 'crypto';

let redisClient: Redis | null = null;

export function getRedis(): Redis {
  if (redisClient) return redisClient;

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

export async function closeRedis(): Promise<void> {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
    logger.info('[Redis] Connection closed');
  }
}
