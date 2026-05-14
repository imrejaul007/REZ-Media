/**
 * Media Worker — standalone BullMQ consumer for media-events queue.
 *
 * Phase C extraction. Handles media processing: image variant generation,
 * asset deletion, CDN invalidation, temp file cleanup via Cloudinary API.
 *
 * Sprint 3: Added image.uploaded pipeline — downloads from Cloudinary,
 * resizes via sharp to thumbnail/medium/large, re-uploads with suffixes,
 * updates MongoDB document, and emits image.processed notification event.
 */
import { Worker } from 'bullmq';
export declare const QUEUE_NAME = "media-events";
export interface MediaEvent {
    eventId: string;
    eventType: string;
    payload: {
        publicId?: string;
        url?: string;
        resourceType?: string;
        variants?: Array<{
            width: number;
            height: number;
            crop?: string;
            suffix: string;
        }>;
        invalidateUrls?: string[];
        olderThan?: string;
        imageUrl?: string;
        entityType?: 'product' | 'store' | 'user';
        entityId?: string;
        sizes?: string[];
        [key: string]: any;
    };
    createdAt: string;
}
/**
 * Starts the BullMQ media worker on the 'media-processing' queue.
 * Handles resize and upload events for product and store images.
 * @returns The BullMQ worker instance (singleton)
 */
export declare function startMediaWorker(): Worker;
export declare function stopWorker(): Promise<void>;
//# sourceMappingURL=worker.d.ts.map