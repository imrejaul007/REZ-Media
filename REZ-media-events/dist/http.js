"use strict";
/**
 * rez-media-events — HTTP upload server
 *
 * Handles multipart file uploads, validates MIME by magic bytes, streams the
 * file directly to Cloudinary (no ephemeral disk), and stores metadata in
 * MongoDB. Files are served from Cloudinary CDN.
 *
 * B6 (MASTER-PLAN-2026-04-19):
 *   - multer.memoryStorage (no write to Render's ephemeral disk)
 *   - magic-byte MIME sniff in the handler AFTER multer populates `file.buffer`
 *     (multer's fileFilter runs BEFORE the buffer is available with memoryStorage)
 *   - Cloudinary client centralized in src/config/cloudinary.ts
 *   - Legacy /uploads/* route returns 410 Gone
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.startHttpServer = startHttpServer;
const express_1 = __importDefault(require("express"));
const multer_1 = __importDefault(require("multer"));
const http_1 = __importDefault(require("http"));
const crypto_1 = __importDefault(require("crypto"));
const helmet_1 = __importDefault(require("helmet"));
const cors_1 = __importDefault(require("cors"));
const express_mongo_sanitize_1 = __importDefault(require("express-mongo-sanitize"));
const mongoose_1 = __importDefault(require("mongoose"));
const prom_client_1 = __importDefault(require("prom-client"));
const logger_1 = require("./config/logger");
const cloudinary_1 = require("./config/cloudinary");
const register = new prom_client_1.default.Registry();
prom_client_1.default.collectDefaultMetrics({ register });
// ── Internal token middleware (mirrors rez-catalog-service pattern) ───────────
function resolveScopedTokens() {
    try {
        const raw = process.env.INTERNAL_SERVICE_TOKENS_JSON;
        const parsed = raw ? JSON.parse(raw) : {};
        return Object.keys(parsed).length > 0 ? parsed : null;
    }
    catch {
        return null;
    }
}
function requireInternalToken(req, res, next) {
    const token = req.headers['x-internal-token'];
    const callerService = req.headers['x-internal-service'];
    const scopedTokens = resolveScopedTokens();
    if (!scopedTokens) {
        res.status(503).json({ success: false, error: 'Internal auth not configured — set INTERNAL_SERVICE_TOKENS_JSON' });
        return;
    }
    const expected = callerService ? scopedTokens[callerService] : undefined;
    // MED-SEC-FIX: Reject blank tokens before timing comparison.
    // A blank token padded to the expected length matches timingSafeEqual, bypassing auth.
    const tokenStr = token || '';
    if (tokenStr.trim().length === 0) {
        logger_1.logger.warn('[HTTP] Unauthorized upload attempt — blank token', { callerService, ip: req.ip });
        res.status(401).json({ success: false, error: 'Invalid internal token' });
        return;
    }
    const tokenBuf = Buffer.from(tokenStr);
    const expectedBuf = Buffer.from(expected || '');
    const isValid = !!expected &&
        tokenBuf.length === expectedBuf.length &&
        crypto_1.default.timingSafeEqual(tokenBuf, expectedBuf);
    if (!isValid) {
        logger_1.logger.warn('[HTTP] Unauthorized upload attempt', { callerService, ip: req.ip });
        res.status(401).json({ success: false, error: 'Invalid internal token' });
        return;
    }
    next();
}
// ── Multer memory storage ────────────────────────────────────────────────────
// B6: multer.memoryStorage keeps the file in RAM on req.file.buffer — no disk
// writes. Note: with memoryStorage, file.buffer is NOT yet populated inside
// the `fileFilter` callback; it becomes available only after multer has fully
// consumed the multipart stream. Therefore the magic-byte sniff MUST run in
// the handler, not in fileFilter.
const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const MAGIC_BYTES = [
    { sig: Buffer.from([0xFF, 0xD8, 0xFF]), mime: 'image/jpeg' },
    { sig: Buffer.from([0x89, 0x50, 0x4E, 0x47]), mime: 'image/png' },
    { sig: Buffer.from([0x52, 0x49, 0x46, 0x46]), mime: 'image/webp' }, // RIFF....WEBP
];
/**
 * Detects the MIME type of an image by reading magic bytes (file signatures).
 * Checks for JPEG (FF D8 FF), PNG (89 50 4E 47), and WebP (52 49 46 46) signatures.
 * @param buffer - The first bytes of the file
 * @returns The detected MIME type or null if the signature is unrecognized
 */
function sniffMimeType(buffer) {
    for (const { sig, mime } of MAGIC_BYTES) {
        if (buffer.length >= sig.length && buffer.slice(0, sig.length).equals(sig)) {
            return mime;
        }
    }
    return null;
}
const upload = (0, multer_1.default)({
    storage: multer_1.default.memoryStorage(),
    limits: { fileSize: MAX_FILE_SIZE },
    fileFilter: (_req, file, cb) => {
        // Client-declared mimetype check — cheap early reject. The real defence
        // is the magic-byte sniff in the handler below.
        if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
            cb(new Error(`Unsupported file type: ${file.mimetype}. Allowed: jpeg, png, webp`));
            return;
        }
        cb(null, true);
    },
});
async function insertMediaUpload(doc) {
    const collection = mongoose_1.default.connection.collection('media_uploads');
    const result = await collection.insertOne(doc);
    return result.insertedId.toString();
}
// ── Express app ──────────────────────────────────────────────────────────────
const app = (0, express_1.default)();
// Behind Render LB + CF — trust N hops so per-IP rate limiters key on real client IP.
// See MASTER-PLAN-2026-04-19 P1 (trust proxy fleet-wide).
app.set('trust proxy', Number(process.env.TRUST_PROXY_HOPS) || 1);
app.use((0, helmet_1.default)());
app.use((0, cors_1.default)({
    origin: (process.env.CORS_ORIGIN || 'https://rez.money').split(',').map(s => s.trim()),
    credentials: true,
}));
app.use(express_1.default.json({ limit: '1mb' }));
app.use((0, express_mongo_sanitize_1.default)());
// GET /health
app.get('/health', (_req, res) => {
    res.json({ status: 'ok', service: 'rez-media-events' });
});
// GET /metrics
app.get('/metrics', async (_req, res) => {
    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
});
// GET /uploads/* — legacy local-disk route, now permanently gone.
// B6: Files are served from Cloudinary CDN. Any consumer still reading from
// /uploads/* has a stale cached URL and should refresh from the originating
// record (which now stores the Cloudinary secure_url).
app.use('/uploads', requireInternalToken, (_req, res) => {
    res.status(410).json({
        success: false,
        error: 'Legacy local-file route removed — files now live on Cloudinary. Refresh the record to get the secure_url.',
        code: 'LEGACY_UPLOADS_GONE',
    });
});
// POST /upload  — requires internal service token
// Magic-byte validation runs AFTER multer has populated req.file.buffer.
app.post('/upload', requireInternalToken, upload.single('file'), async (req, res) => {
    if (!req.file) {
        res.status(400).json({ success: false, error: 'No file uploaded' });
        return;
    }
    const { buffer, originalname, mimetype: declaredMime, size } = req.file;
    if (!buffer || buffer.length === 0) {
        res.status(400).json({ success: false, error: 'Empty file upload' });
        return;
    }
    // Magic-byte sniff — trust the bytes, not the client-supplied header.
    const actualMime = sniffMimeType(buffer);
    if (!actualMime || !ALLOWED_MIME_TYPES.has(actualMime)) {
        logger_1.logger.warn('[HTTP] Magic-byte MIME mismatch', {
            declaredMime,
            detected: actualMime ?? 'unknown',
            originalname,
            size,
        });
        res.status(400).json({
            success: false,
            error: `File content does not match an allowed image type. Detected: ${actualMime ?? 'unknown'}. Allowed: jpeg, png, webp`,
        });
        return;
    }
    const uploadedBy = req.headers['x-internal-service'] ?? null;
    let cloudinaryResult;
    try {
        cloudinaryResult = await (0, cloudinary_1.uploadBufferToCloudinary)(buffer, {
            mimeType: actualMime,
            folder: 'rez/media-events',
            originalFilename: originalname,
        });
    }
    catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        logger_1.logger.error('[HTTP] Cloudinary upload failed', { error: message, originalname, size });
        res.status(502).json({ success: false, error: 'Upload service unavailable' });
        return;
    }
    try {
        const mediaId = await insertMediaUpload({
            originalName: originalname,
            mimeType: actualMime,
            size,
            cloudinaryUrl: cloudinaryResult.url,
            cloudinaryPublicId: cloudinaryResult.publicId,
            width: cloudinaryResult.width,
            height: cloudinaryResult.height,
            uploadedBy,
            createdAt: new Date(),
        });
        logger_1.logger.info('[HTTP] File uploaded', {
            mediaId,
            cloudinaryUrl: cloudinaryResult.url,
            size,
        });
        res.status(201).json({
            success: true,
            url: cloudinaryResult.url,
            publicId: cloudinaryResult.publicId,
            width: cloudinaryResult.width,
            height: cloudinaryResult.height,
            mediaId,
        });
    }
    catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        logger_1.logger.error('[HTTP] Mongo insert failed after Cloudinary upload', {
            error: message,
            publicId: cloudinaryResult.publicId,
        });
        // The Cloudinary asset exists — surface the URL so the caller can still
        // persist it and the asset isn't orphaned.
        res.status(201).json({
            success: true,
            url: cloudinaryResult.url,
            publicId: cloudinaryResult.publicId,
            width: cloudinaryResult.width,
            height: cloudinaryResult.height,
            mediaId: null,
            warning: 'Upload succeeded but metadata persistence failed',
        });
    }
});
// ── Multer error handler ─────────────────────────────────────────────────────
app.use((err, _req, res, _next) => {
    const message = err instanceof Error ? err.message : String(err);
    if (err instanceof multer_1.default.MulterError || message.startsWith('Unsupported file type')) {
        res.status(400).json({ success: false, error: message });
        return;
    }
    logger_1.logger.error('[HTTP] Unhandled error', { error: message });
    res.status(500).json({ success: false, error: 'Internal server error' });
});
// ── Server factory ───────────────────────────────────────────────────────────
/**
 * Creates and starts the HTTP server for the media upload service.
 * Mounts Express with upload, health check, and Prometheus metrics endpoints.
 * @param port - The port number to listen on
 * @returns The HTTP server instance
 */
function startHttpServer(port) {
    const server = http_1.default.createServer(app);
    server.listen(port, () => {
        logger_1.logger.info(`[HTTP] Upload server listening on port ${port}`);
    });
    return server;
}
//# sourceMappingURL=http.js.map