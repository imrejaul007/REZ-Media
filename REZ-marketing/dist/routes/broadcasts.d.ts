/**
 * Broadcasts routes — simplified campaign API for Sprint 3.
 *
 * A "broadcast" is a thin wrapper over the existing MarketingCampaign model.
 * It exposes a simpler interface aligned with the sprint spec:
 *
 *   POST   /broadcasts                          — create & send immediately
 *   GET    /broadcasts/:merchantId              — list past broadcasts with stats
 *   POST   /broadcasts/:broadcastId/schedule    — schedule for a future time
 *   POST   /broadcasts/send                     — Sprint 9: segment-based send
 *
 * Internally, broadcasts are stored as MarketingCampaign documents with
 * objective='awareness' and channel derived from the channels array.
 * Multi-channel broadcasts create one campaign document per channel.
 *
 * Dispatch is handled by the existing campaignOrchestrator which enqueues
 * jobs onto the notification-events BullMQ queue.
 */
declare const router: import("express-serve-static-core").Router;
export default router;
//# sourceMappingURL=broadcasts.d.ts.map