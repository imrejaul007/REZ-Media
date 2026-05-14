import { Request, Response, NextFunction } from 'express';
/**
 * Lightweight W3C traceparent propagation middleware.
 * Reads `traceparent` from incoming requests and propagates a trace ID
 * through the service without requiring @opentelemetry/* packages.
 *
 * Format: 00-{traceId 32hex}-{spanId 16hex}-{flags 2hex}
 * Spec:   https://www.w3.org/TR/trace-context/
 */
export declare function tracingMiddleware(req: Request, res: Response, next: NextFunction): void;
//# sourceMappingURL=tracing.d.ts.map