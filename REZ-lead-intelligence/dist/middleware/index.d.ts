/**
 * Lead Intelligence Service - Middleware
 */
import { Request, Response, NextFunction } from 'express';
declare global {
    namespace Express {
        interface Request {
            userId?: string;
            merchantId?: string;
            isAdmin?: boolean;
        }
    }
}
/**
 * Validation error handler
 */
export declare const validationErrorHandler: (req: Request, res: Response, next: NextFunction) => void;
/**
 * Async handler wrapper to catch promise rejections
 */
export declare const asyncHandler: (fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) => (req: Request, res: Response, next: NextFunction) => void;
/**
 * 404 Not Found handler
 */
export declare const notFoundHandler: (req: Request, res: Response, next: NextFunction) => void;
/**
 * Global error handler
 */
export declare const errorHandler: (err: Error & {
    statusCode?: number;
    code?: string;
}, req: Request, res: Response, next: NextFunction) => void;
/**
 * Request logger middleware
 */
export declare const requestLogger: (req: Request, res: Response, next: NextFunction) => void;
/**
 * Rate limiter helper (placeholder - use express-rate-limit in production)
 */
export declare const rateLimiter: (maxRequests?: number, windowMs?: number) => (req: Request, res: Response, next: NextFunction) => void;
/**
 * Auth middleware - validates JWT and attaches user to request
 */
export declare const authenticate: (req: Request, res: Response, next: NextFunction) => void;
/**
 * Service-to-service auth middleware with timing-safe comparison
 */
export declare const serviceAuth: (req: Request, res: Response, next: NextFunction) => void;
//# sourceMappingURL=index.d.ts.map