"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ApiError = void 0;
exports.errorHandler = errorHandler;
exports.notFoundHandler = notFoundHandler;
exports.asyncHandler = asyncHandler;
/**
 * Custom error class for API errors
 */
class ApiError extends Error {
    statusCode;
    code;
    details;
    constructor(message, statusCode = 500, code, details) {
        super(message);
        this.statusCode = statusCode;
        this.code = code;
        this.details = details;
        this.name = 'ApiError';
    }
    static badRequest(message, code, details) {
        return new ApiError(message, 400, code, details);
    }
    static unauthorized(message = 'Unauthorized') {
        return new ApiError(message, 401, 'UNAUTHORIZED');
    }
    static forbidden(message = 'Forbidden') {
        return new ApiError(message, 403, 'FORBIDDEN');
    }
    static notFound(message = 'Not found', code) {
        return new ApiError(message, 404, code);
    }
    static conflict(message, code) {
        return new ApiError(message, 409, code);
    }
    static internal(message = 'Internal server error') {
        return new ApiError(message, 500, 'INTERNAL_ERROR');
    }
}
exports.ApiError = ApiError;
/**
 * Error handler middleware
 */
function errorHandler(err, req, res, _next) {
    console.error('Error:', {
        name: err.name,
        message: err.message,
        stack: err.stack,
        path: req.path,
        method: req.method,
    });
    if (err instanceof ApiError) {
        res.status(err.statusCode).json({
            success: false,
            error: err.message,
            code: err.code,
            details: err.details,
        });
        return;
    }
    // Handle Mongoose validation errors
    if (err.name === 'ValidationError') {
        res.status(400).json({
            success: false,
            error: 'Validation error',
            details: err.message,
        });
        return;
    }
    // Handle Mongoose cast errors (invalid ObjectId)
    if (err.name === 'CastError') {
        res.status(400).json({
            success: false,
            error: 'Invalid ID format',
        });
        return;
    }
    // Handle duplicate key errors
    if (err.code === 11000) {
        res.status(409).json({
            success: false,
            error: 'Duplicate entry',
        });
        return;
    }
    // Default error response
    res.status(500).json({
        success: false,
        error: 'Internal server error',
    });
}
/**
 * Not found handler
 */
function notFoundHandler(req, res) {
    res.status(404).json({
        success: false,
        error: `Route ${req.method} ${req.path} not found`,
    });
}
/**
 * Async handler wrapper to catch errors in async route handlers
 */
function asyncHandler(fn) {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
}
exports.default = errorHandler;
//# sourceMappingURL=errorHandler.js.map