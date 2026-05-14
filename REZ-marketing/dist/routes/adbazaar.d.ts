/**
 * AdBazaar integration routes.
 *
 * Protected by x-internal-key header matching ADBAZAAR_INTERNAL_KEY env var.
 * Called by AdBazaar when a brand books a WhatsApp/push/SMS listing in order to
 * trigger a broadcast to REZ users on behalf of a merchant.
 *
 *   POST  /adbazaar/broadcast          — trigger or schedule a broadcast
 *   GET   /adbazaar/status/:broadcastId — check status of an AdBazaar broadcast
 */
declare const router: import("express-serve-static-core").Router;
export default router;
//# sourceMappingURL=adbazaar.d.ts.map