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
import http from 'http';
/**
 * Creates and starts the HTTP server for the media upload service.
 * Mounts Express with upload, health check, and Prometheus metrics endpoints.
 * @param port - The port number to listen on
 * @returns The HTTP server instance
 */
export declare function startHttpServer(port: number): http.Server;
//# sourceMappingURL=http.d.ts.map