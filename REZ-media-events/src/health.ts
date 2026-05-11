import http from 'http';
import { logger } from './config/logger';

let isHealthy = true;

export function setHealthy(healthy: boolean): void {
  isHealthy = healthy;
}

export function startHealthServer(port: number = 3001): http.Server {
  const server = http.createServer((req, res) => {
    if (req.url === '/health' || req.url === '/healthz') {
      if (isHealthy) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok', uptime: process.uptime() }));
      } else {
        res.writeHead(503, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'unhealthy' }));
      }
    } else if (req.url === '/ready') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ready' }));
    } else if (req.url === '/health/detailed') {
      // Detailed health check - use async handler
      handleDetailedHealth(req, res);
    } else {
      res.writeHead(404);
      res.end();
    }
  });

  server.listen(port, () => {
    logger.info(`Health server listening on port ${port}`);
  });

  return server;
}

async function handleDetailedHealth(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
  const checks: Record<string, unknown> = {};
  let allHealthy = isHealthy;

  // MongoDB check with latency (if available)
  try {
    const mongoose = await import('mongoose');
    const mongoStart = Date.now();
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.db?.admin().ping();
      checks.database = { status: 'up', latencyMs: Date.now() - mongoStart };
    } else {
      checks.database = { status: 'down', error: 'MongoDB not connected' };
      allHealthy = false;
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    checks.database = { status: 'down', error: msg };
    allHealthy = false;
  }

  // Redis check with latency
  try {
    const { bullmqRedis } = await import('./config/redis');
    const redisStart = Date.now();
    await bullmqRedis.ping();
    checks.redis = { status: 'up', latencyMs: Date.now() - redisStart };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    checks.redis = { status: 'down', error: msg };
    allHealthy = false;
  }

  // Memory usage
  const memUsage = process.memoryUsage();
  checks.memory = {
    heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
    heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
    rss: Math.round(memUsage.rss / 1024 / 1024),
  };

  const response = {
    status: allHealthy ? 'healthy' : 'unhealthy',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    checks,
  };

  res.writeHead(allHealthy ? 200 : 503, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(response, null, 2));
}
