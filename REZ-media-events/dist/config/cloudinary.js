"use strict";
/**
 * Cloudinary configuration + upload helper.
 *
 * B6 (MASTER-PLAN-2026-04-19): Centralized Cloudinary client. Uploads stream
 * directly from in-memory buffers (multer memoryStorage) to Cloudinary —
 * no ephemeral disk writes. Files live on Cloudinary CDN and survive Render
 * container restarts/redeploys.
 *
 * Environment variables (required in prod, warned at startup by src/index.ts):
 *   CLOUDINARY_CLOUD_NAME
 *   CLOUDINARY_API_KEY
 *   CLOUDINARY_API_SECRET
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.cloudinary = void 0;
exports.uploadBufferToCloudinary = uploadBufferToCloudinary;
const cloudinary_1 = require("cloudinary");
Object.defineProperty(exports, "cloudinary", { enumerable: true, get: function () { return cloudinary_1.v2; } });
// Configure once at module load. If env vars are missing, Cloudinary calls will
// fail at request time with a clear error — startup logs the warning already
// (see src/index.ts#validateEnv).
cloudinary_1.v2.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true,
});
/**
 * Stream a Buffer to Cloudinary. Resource type is inferred from mimeType prefix
 * (`video/*` -> 'video', everything else -> 'image'). Cloudinary assigns a
 * unique public_id when `unique_filename: true` is set, so collisions are
 * impossible even if two clients upload files with the same originalname.
 */
function uploadBufferToCloudinary(buffer, opts) {
    const resourceType = opts.mimeType.startsWith('video/') ? 'video' : 'image';
    return new Promise((resolve, reject) => {
        const stream = cloudinary_1.v2.uploader.upload_stream({
            folder: opts.folder ?? 'rez/media-events',
            resource_type: resourceType,
            unique_filename: true,
            use_filename: Boolean(opts.originalFilename),
            filename_override: opts.originalFilename,
            overwrite: false,
        }, (err, result) => {
            if (err) {
                reject(err);
                return;
            }
            if (!result) {
                reject(new Error('Cloudinary upload returned no result'));
                return;
            }
            resolve({
                url: result.secure_url,
                publicId: result.public_id,
                format: result.format,
                width: result.width,
                height: result.height,
                bytes: result.bytes,
                resourceType: result.resource_type,
            });
        });
        stream.end(buffer);
    });
}
//# sourceMappingURL=cloudinary.js.map