/**
 * Webhook routes for delivery receipt tracking.
 *
 * WhatsApp (Meta) sends delivery/read receipts to:
 *   POST /webhooks/whatsapp
 *
 * Webhook verification (GET) also handled here.
 * Set webhook URL in Meta Business Manager → WhatsApp → Configuration.
 */
declare const router: import("express-serve-static-core").Router;
export default router;
//# sourceMappingURL=webhooks.d.ts.map