"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.tracingMiddleware = tracingMiddleware;
const crypto_1 = __importDefault(require("crypto"));
/**
 * Lightweight W3C traceparent propagation middleware.
 * Reads `traceparent` from incoming requests and propagates a trace ID
 * through the service without requiring @opentelemetry/* packages.
 *
 * Format: 00-{traceId 32hex}-{spanId 16hex}-{flags 2hex}
 * Spec:   https://www.w3.org/TR/trace-context/
 */
function tracingMiddleware(req, res, next) {
    const incoming = req.headers['traceparent'];
    let traceId;
    if (incoming) {
        const parts = incoming.split('-');
        traceId = parts.length >= 2 && parts[1].length === 32 ? parts[1] : generateTraceId();
    }
    else {
        const xTrace = (req.headers['x-trace-id'] || req.headers['x-correlation-id']);
        traceId = xTrace ? xTrace.replace(/-/g, '').substring(0, 32).padEnd(32, '0') : generateTraceId();
    }
    const spanId = crypto_1.default.randomBytes(8).toString('hex');
    res.locals.traceId = traceId;
    res.locals.spanId = spanId;
    res.setHeader('traceparent', `00-${traceId}-${spanId}-01`);
    next();
}
function generateTraceId() {
    return crypto_1.default.randomUUID().replace(/-/g, '');
}
//# sourceMappingURL=tracing.js.map