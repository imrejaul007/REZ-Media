import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';

/**
 * Adds a unique request ID to each request
 */
export function requestIdMiddleware(req: Request, _res: Response, next: NextFunction): void {
  req.requestId = (req.headers['x-request-id'] as string) || uuidv4();
  next();
}

/**
 * Logs incoming requests and response times
 */
export function requestLoggerMiddleware(req: Request, res: Response, next: NextFunction): void {
  const startTime = Date.now();

  // Log incoming request
  console.log(JSON.stringify({
    level: 'info',
    type: 'request',
    requestId: req.requestId,
    method: req.method,
    path: req.path,
    query: req.query,
    ip: req.ip,
    userAgent: req.get('user-agent'),
    timestamp: new Date().toISOString(),
  }));

  // Log response when finished
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    console.log(JSON.stringify({
      level: res.statusCode >= 400 ? 'warn' : 'info',
      type: 'response',
      requestId: req.requestId,
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      timestamp: new Date().toISOString(),
    }));
  });

  next();
}
