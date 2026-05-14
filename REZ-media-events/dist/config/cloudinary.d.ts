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
import { v2 as cloudinary } from 'cloudinary';
export { cloudinary };
export interface CloudinaryUploadResult {
    url: string;
    publicId: string;
    format: string;
    width: number;
    height: number;
    bytes: number;
    resourceType: string;
}
export interface UploadOptions {
    mimeType: string;
    folder?: string;
    originalFilename?: string;
}
/**
 * Stream a Buffer to Cloudinary. Resource type is inferred from mimeType prefix
 * (`video/*` -> 'video', everything else -> 'image'). Cloudinary assigns a
 * unique public_id when `unique_filename: true` is set, so collisions are
 * impossible even if two clients upload files with the same originalname.
 */
export declare function uploadBufferToCloudinary(buffer: Buffer, opts: UploadOptions): Promise<CloudinaryUploadResult>;
//# sourceMappingURL=cloudinary.d.ts.map