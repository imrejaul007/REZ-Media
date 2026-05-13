"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.internalAuthMiddleware = internalAuthMiddleware;
exports.optionalInternalAuthMiddleware = optionalInternalAuthMiddleware;
const index_js_1 = require("../config/index.js");
/**
 * Middleware to verify internal service token
 */
function internalAuthMiddleware(req, res, next) {
    const token = req.headers['x-internal-token'];
    if (!token) {
        res.status(401).json({
            success: false,
            error: 'Missing internal service token',
        });
        return;
    }
    // Use timing-safe comparison
    const expectedToken = index_js_1.config.internalServiceToken;
    if (!timingSafeEqual(token, expectedToken)) {
        res.status(401).json({
            success: false,
            error: 'Invalid internal service token',
        });
        return;
    }
    req.internalServiceAuthenticated = true;
    next();
}
/**
 * Timing-safe string comparison to prevent timing attacks
 */
function timingSafeEqual(a, b) {
    if (a.length !== b.length) {
        return false;
    }
    let result = 0;
    for (let i = 0; i < a.length; i++) {
        result |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }
    return result === 0;
}
/**
 * Optional internal auth - doesn't fail if token is missing
 */
function optionalInternalAuthMiddleware(req, _res, next) {
    const token = req.headers['x-internal-token'];
    if (token) {
        const expectedToken = index_js_1.config.internalServiceToken;
        if (timingSafeEqual(token, expectedToken)) {
            req.internalServiceAuthenticated = true;
        }
    }
    next();
}
exports.default = internalAuthMiddleware;
//# sourceMappingURL=auth.js.map