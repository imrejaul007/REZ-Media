/**
 * Abuse Prevention Middleware Exports
 */

export {
  createAccountCreationPrevention,
  createRewardClaimPrevention,
  createPromoCodePrevention,
  createCombinedPrevention,
  createVPNProxyCheck,
  createAbuseStatsMiddleware,
  extractClientIP,
  extractDeviceFingerprint,
  type PreventionMiddlewareOptions,
  type CombinedPreventionOptions,
} from './preventionMiddleware';

export { default as preventionMiddleware } from './preventionMiddleware';
