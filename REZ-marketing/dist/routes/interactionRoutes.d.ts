/**
 * Ad interaction routes — auth-protected impression and click tracking.
 *
 * These routes are called by client apps when a user views or clicks on
 * an ad served by the marketing campaign system. Authentication is required
 * (JWT user token via Authorization header). Returns 401 for anonymous requests.
 */
declare const router: import("express-serve-static-core").Router;
export default router;
//# sourceMappingURL=interactionRoutes.d.ts.map