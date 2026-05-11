import mongoose from 'mongoose';
import Redis from 'ioredis';
import { rezMindClient } from './integrations/rez-mind';
import { feedbackProcessor } from './workers/feedback-processor';
import { logger } from './utils/logger';

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: number;
  version: string;
  uptime: number;
  checks: {
    mongodb: ComponentHealth;
    redis: ComponentHealth;
    rezMind: ComponentHealth;
    queue: ComponentHealth;
  };
}

interface ComponentHealth {
  status: 'up' | 'down' | 'unknown' | 'degraded';
  latency_ms?: number;
  message?: string;
}

const startTime = Date.now();

export async function checkHealth(): Promise<HealthStatus> {
  const checks: HealthStatus['checks'] = {
    mongodb: await checkMongoDB(),
    redis: await checkRedis(),
    rezMind: await checkRezMind(),
    queue: await checkQueue()
  };

  const allUp = Object.values(checks).every(c => c.status === 'up');
  const anyDown = Object.values(checks).some(c => c.status === 'down');

  let status: HealthStatus['status'] = 'healthy';
  if (anyDown) {
    status = 'unhealthy';
  } else if (!allUp) {
    status = 'degraded';
  }

  return {
    status,
    timestamp: Date.now(),
    version: process.env.npm_package_version || '1.0.0',
    uptime: Math.floor((Date.now() - startTime) / 1000),
    checks
  };
}

async function checkMongoDB(): Promise<ComponentHealth> {
  const start = Date.now();
  try {
    const state = mongoose.connection.readyState;
    // 0 = disconnected, 1 = connected, 2 = connecting, 3 = disconnecting
    if (state === 1) {
      // Ping the database
      await mongoose.connection.db?.admin().ping();
      return {
        status: 'up',
        latency_ms: Date.now() - start
      };
    }
    return {
      status: 'down',
      message: `Mongoose state: ${state}`
    };
  } catch (error) {
    return {
      status: 'down',
      latency_ms: Date.now() - start,
      message: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

async function checkRedis(): Promise<ComponentHealth> {
  const start = Date.now();
  try {
    const redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      maxRetriesPerRequest: null
    });

    await redis.ping();
    redis.disconnect();

    return {
      status: 'up',
      latency_ms: Date.now() - start
    };
  } catch (error) {
    return {
      status: 'down',
      latency_ms: Date.now() - start,
      message: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

async function checkRezMind(): Promise<ComponentHealth> {
  const start = Date.now();
  try {
    const isHealthy = await rezMindClient.healthCheck();
    return {
      status: isHealthy ? 'up' : 'down',
      latency_ms: Date.now() - start
    };
  } catch (error) {
    return {
      status: 'unknown',
      latency_ms: Date.now() - start,
      message: 'Could not connect to ReZ Mind'
    };
  }
}

async function checkQueue(): Promise<ComponentHealth> {
  try {
    const stats = await feedbackProcessor.getQueueStats();
    const totalPending = stats.waiting + stats.active + stats.delayed;

    // Queue is healthy if we have capacity
    if (stats.failed > 100) {
      return {
        status: 'degraded',
        message: `${stats.failed} failed jobs in queue`
      };
    }

    return {
      status: 'up',
      message: `${totalPending} pending, ${stats.completed} completed`
    };
  } catch (error) {
    return {
      status: 'unknown',
      message: 'Could not get queue stats'
    };
  }
}

// Liveness probe - is the process running?
export function isAlive(): boolean {
  return true;
}

// Readiness probe - is the service ready to receive traffic?
export async function isReady(): Promise<boolean> {
  try {
    const mongoHealth = await checkMongoDB();
    const redisHealth = await checkRedis();
    return mongoHealth.status === 'up' && redisHealth.status === 'up';
  } catch {
    return false;
  }
}
