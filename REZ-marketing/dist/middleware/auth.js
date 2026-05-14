"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireInternalToken = void 0;
exports.verifyConsumer = verifyConsumer;
exports.verifyMerchant = verifyMerchant;
exports.verifyAdmin = verifyAdmin;
exports.verifyInternal = verifyInternal;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const crypto_1 = __importDefault(require("crypto"));
// ── Helpers ───────────────────────────────────────────────────────────────────
function getSecret() {
    const secret = process.env.JWT_SECRET;
    if (!secret)
        throw new Error('JWT_SECRET env var is required');
    return secret;
}
function extractBearer(req) {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer '))
        return null;
    return header.slice(7);
}
// ── verifyConsumer — decodes userId from Bearer token ────────────────────────
function verifyConsumer(req, res, next) {
    const token = extractBearer(req);
    if (!token) {
        res.status(401).json({ success: false, message: 'Missing authorization token' });
        return;
    }
    try {
        // MKT-SEC-FIX: Explicitly constrain to HS256 to prevent algorithm confusion attacks.
        // jwt.verify defaults to allowing any algorithm the token declares, including "none"
        // or symmetric-to-asymmetric confusion (HS256 vs RS256).
        const payload = jsonwebtoken_1.default.verify(token, getSecret(), { algorithms: ['HS256'] });
        req.userId = (payload.userId || payload._id || payload.id);
        next();
    }
    catch {
        res.status(401).json({ success: false, message: 'Invalid or expired token' });
    }
}
// ── verifyMerchant — decodes merchant._id from Bearer token ──────────────────
function verifyMerchant(req, res, next) {
    const token = extractBearer(req);
    if (!token) {
        res.status(401).json({ success: false, message: 'Missing authorization token' });
        return;
    }
    try {
        // MKT-SEC-FIX: Explicitly constrain to HS256.
        const payload = jsonwebtoken_1.default.verify(token, getSecret(), { algorithms: ['HS256'] });
        // Support both flat and nested merchant payload shapes
        const merchant = payload.merchant;
        const merchantId = merchant?._id ||
            payload.merchantId ||
            payload._id;
        if (!merchantId) {
            res.status(401).json({ success: false, message: 'Merchant identity not found in token' });
            return;
        }
        req.merchantId = String(merchantId);
        next();
    }
    catch {
        res.status(401).json({ success: false, message: 'Invalid or expired token' });
    }
}
// ── verifyAdmin — checks role === 'admin' or isAdmin === true ─────────────────
function verifyAdmin(req, res, next) {
    const token = extractBearer(req);
    if (!token) {
        res.status(401).json({ success: false, message: 'Missing authorization token' });
        return;
    }
    try {
        // MKT-SEC-FIX: Explicitly constrain to HS256.
        const payload = jsonwebtoken_1.default.verify(token, getSecret(), { algorithms: ['HS256'] });
        const isAdmin = payload.role === 'admin' ||
            payload.isAdmin === true ||
            payload.user?.role === 'admin';
        if (!isAdmin) {
            res.status(401).json({ success: false, message: 'Admin access required' });
            return;
        }
        req.isAdmin = true;
        req.userId = (payload._id || payload.userId || payload.id);
        next();
    }
    catch {
        res.status(401).json({ success: false, message: 'Invalid or expired token' });
    }
}
// ── verifyInternal — checks x-internal-key header (constant-time comparison) ──
// Alias for verifyInternal (used in some routes)
exports.requireInternalToken = verifyInternal;
function verifyInternal(req, res, next) {
    // Accept both header names for compatibility with all REZ services
    const key = req.headers['x-internal-token'] || req.headers['x-internal-key'];
    // Accept both env var names
    const expected = process.env.INTERNAL_SERVICE_KEY || process.env.INTERNAL_SERVICE_TOKEN;
    if (!expected) {
        // If no key configured, block all internal requests
        res.status(401).json({ success: false, message: 'Internal service key not configured' });
        return;
    }
    // FIX C-4: Use constant-time comparison to prevent timing attacks
    // Convert to buffers for timingSafeEqual()
    const keyBuffer = Buffer.isBuffer(key) ? key : Buffer.from(String(key || ''));
    const expectedBuffer = Buffer.from(expected);
    // Ensure both buffers are same length before comparison
    let keysMatch;
    try {
        keysMatch = crypto_1.default.timingSafeEqual(keyBuffer, expectedBuffer);
    }
    catch (error) {
        // timingSafeEqual throws if buffers are different lengths
        // This is expected for invalid keys, treat as mismatch
        keysMatch = false;
    }
    if (!keysMatch) {
        res.status(401).json({ success: false, message: 'Invalid internal service key' });
        return;
    }
    next();
}
//# sourceMappingURL=auth.js.map