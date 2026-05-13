import { Request, Response, NextFunction } from 'express';
/**
 * Custom error class for API errors
 */
export declare class ApiError extends Error {
    statusCode: number;
    code?: string;
    details?: unknown;
    constructor(message: string, statusCode?: number, code?: string, details?: unknown);
    static badRequest(message: string, code?: string, details?: unknown): ApiError;
    static unauthorized(message?: string): ApiError;
    static forbidden(message?: string): ApiError;
    static notFound(message?: string, code?: string): ApiError;
    static conflict(message: string, code?: string): ApiError;
    static internal(message?: string): ApiError;
}
/**
 * Error handler middleware
 */
export declare function errorHandler(err: Error, req: Request, res: Response, _next: NextFunction): void;
/**
 * Not found handler
 */
export declare function notFoundHandler(req: Request, res: Response): void;
/**
 * Async handler wrapper to catch errors in async route handlers
 */
export declare function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>): (req: Request, res: Response, next: NextFunction) => void;
export default errorHandler;
//# sourceMappingURL=errorHandler.d.ts.map