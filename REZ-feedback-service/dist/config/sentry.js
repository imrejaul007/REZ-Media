"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.Sentry = void 0;
exports.initSentry = initSentry;
/**
 * Sentry Configuration for rez-feedback-service
 */
const Sentry = __importStar(require("@sentry/node"));
exports.Sentry = Sentry;
const SENTRY_DSN = process.env.SENTRY_DSN;
const ENVIRONMENT = process.env.NODE_ENV || 'development';
function initSentry() {
    if (!SENTRY_DSN) {
        console.warn('[Sentry] SENTRY_DSN not set');
        return;
    }
    Sentry.init({
        dsn: SENTRY_DSN,
        environment: ENVIRONMENT,
        tracesSampleRate: ENVIRONMENT === 'production' ? 0.1 : 1.0,
        debug: ENVIRONMENT !== 'production',
        integrations: [
            new Sentry.Integrations.Http({ tracing: true }),
        ],
        ignoreErrors: ['AbortError', 'ECONNRESET', 'ETIMEDOUT'],
        denyUrls: [/localhost/, /127\.0\.0\.1/],
    });
    console.log('[Sentry] Initialized for', ENVIRONMENT);
}
//# sourceMappingURL=sentry.js.map