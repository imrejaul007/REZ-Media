"use strict";
/**
 * Lead Intelligence Service - Middleware
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.serviceAuth = exports.authenticate = exports.rateLimiter = exports.requestLogger = exports.errorHandler = exports.notFoundHandler = exports.asyncHandler = exports.validationErrorHandler = void 0;
const express_validator_1 = require("express-validator");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const crypto_1 = __importDefault(require("crypto"));
const shared_1 = require("@rez/shared");
// ── Helpers ───────────────────────────────────────────────────────────────────
function getJwtSecret() {
    const secret = process.env.LEAD_INTEL_JWT_SECRET || process.env.JWT_SECRET;
    if (!secret) {
        throw new Error('LEAD_INTEL_JWT_SECRET or JWT_SECRET env var is required');
    }
    return secret;
}
function extractBearer(req) {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer '))
        return null;
    return header.slice(7);
}
/**
 * Validation error handler
 */
const validationErrorHandler = (req, res, next) => {
    const errors = (0, express_validator_1.validationResult)(req);
    if (!errors.isEmpty()) {
        res.status(400).json({
            success: false,
            error: {
                code: 'VALIDATION_ERROR',
                message: 'Request validation failed',
                details: errors.array(),
            },
        });
        return;
    }
    next();
};
exports.validationErrorHandler = validationErrorHandler;
/**
 * Async handler wrapper to catch promise rejections
 */
const asyncHandler = (fn) => {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
};
exports.asyncHandler = asyncHandler;
/**
 * 404 Not Found handler
 */
const notFoundHandler = (req, res, next) => {
    res.status(404).json({
        success: false,
        error: {
            code: 'NOT_FOUND',
            message: `Route ${req.method} ${req.path} not found`,
        },
    });
};
exports.notFoundHandler = notFoundHandler;
/**
 * Global error handler
 */
const errorHandler = (err, req, res, next) => {
    const statusCode = err.statusCode || 500;
    const errorCode = err.code || 'INTERNAL_ERROR';
    shared_1.logger.error('[Error Handler]', {
        error: err.message,
        stack: err.stack,
        path: req.path,
        method: req.method,
    });
    res.status(statusCode).json({
        success: false,
        error: {
            code: errorCode,
            message: statusCode === 500 ? 'Internal server error' : err.message,
        },
    });
};
exports.errorHandler = errorHandler;
/**
 * Request logger middleware
 */
const requestLogger = (req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
        const duration = Date.now() - start;
        shared_1.logger.info('[Request]', {
            method: req.method,
            path: req.path,
            status: res.statusCode,
            duration: `${duration}ms`,
            requestId: req.headers['x-request-id'],
        });
    });
    next();
};
exports.requestLogger = requestLogger;
/**
 * Rate limiter helper (placeholder - use express-rate-limit in production)
 */
const rateLimiter = (maxRequests = 100, windowMs = 60000) => {
    return (req, res, next) => {
        // Placeholder implementation
        // In production, use express-rate-limit with Redis store
        next();
    };
};
exports.rateLimiter = rateLimiter;
/**
 * Auth middleware - validates JWT and attaches user to request
 */
const authenticate = (req, res, next) => {
    const token = extractBearer(req);
    if (!token) {
        res.status(401).json({
            success: false,
            error: {
                code: 'UNAUTHORIZED',
                message: 'Authentication required',
            },
        });
        return;
    }
    try {
        const payload = jsonwebtoken_1.default.verify(token, getJwtSecret(), { algorithms: ['HS256'] });
        // Extract userId from various possible token shapes
        req.userId = (payload.userId || payload._id || payload.id);
        // Extract merchantId if present
        const merchant = payload.merchant;
        if (merchant?._id) {
            req.merchantId = String(merchant._id);
        }
        else if (payload.merchantId) {
            req.merchantId = String(payload.merchantId);
        }
        // Check for admin role
        if (payload.role === 'admin') {
            req.isAdmin = true;
        }
        next();
    }
    catch (error) {
        shared_1.logger.warn('[Auth] JWT verification failed', { error: error instanceof Error ? error.message : 'Unknown error' });
        res.status(401).json({
            success: false,
            error: {
                code: 'UNAUTHORIZED',
                message: 'Invalid or expired token',
            },
        });
    }
};
exports.authenticate = authenticate;
/**
 * Service-to-service auth middleware with timing-safe comparison
 */
const serviceAuth = (req, res, next) => {
    // Accept both header names for compatibility with all REZ services
    const serviceToken = req.headers['x-internal-token'] || req.headers['x-internal-key'];
    if (!serviceToken) {
        res.status(401).json({
            success: false,
            error: {
                code: 'UNAUTHORIZED',
                message: 'Service token required',
            },
        });
        return;
    }
    // Accept both env var names
    const expectedToken = process.env.INTERNAL_SERVICE_KEY || process.env.INTERNAL_SERVICE_TOKEN;
    if (!expectedToken) {
        shared_1.logger.error('[ServiceAuth] Internal service token not configured');
        res.status(401).json({
            success: false,
            error: {
                code: 'UNAUTHORIZED',
                message: 'Internal service key not configured',
            },
        });
        return;
    }
    // Convert to string and validate
    const tokenStr = typeof serviceToken === 'string' ? serviceToken : String(serviceToken);
    // Reject blank tokens to prevent timing-safe-equal bypass
    if (tokenStr.trim().length === 0) {
        res.status(401).json({
            success: false,
            error: {
                code: 'UNAUTHORIZED',
                message: 'Invalid internal service key',
            },
        });
        return;
    }
    // Use timing-safe comparison to prevent timing attacks
    const tokenBuffer = Buffer.from(tokenStr);
    const expectedBuffer = Buffer.from(expectedToken);
    let keysMatch;
    try {
        keysMatch = crypto_1.default.timingSafeEqual(tokenBuffer, expectedBuffer);
    }
    catch {
        // Throws if buffers have different lengths
        keysMatch = false;
    }
    if (!keysMatch) {
        shared_1.logger.warn('[ServiceAuth] Invalid service token attempt', { ip: req.ip });
        res.status(401).json({
            success: false,
            error: {
                code: 'UNAUTHORIZED',
                message: 'Invalid internal service key',
            },
        });
        return;
    }
    next();
};
exports.serviceAuth = serviceAuth;
//# sourceMappingURL=index.js.map