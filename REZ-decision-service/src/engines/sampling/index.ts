/**
 * SAMPLING ENGINES INDEX
 * Exports all sampling-related decision engines
 */

// Re-export ReZ Mind integration
export {
  ReZMindIntegration,
  rezMindIntegration,
  getUserIntent,
  getTopIntent,
  getDormantUsers,
  getHighIntentUsers,
  sendIntentSignal,
  type UserIntent,
  type IntentQuery
} from './rezMindIntegration';

// Re-export samplingDecision exports
export {
  makeSamplingDecision,
  SamplingScoringEngine,
  CoinAllocationEngine,
  TimingEngine,
  type SamplingDecision,
  type SamplingContext,
  type CampaignConfig
} from './samplingDecision';

// Re-export dynamicPricing exports
export {
  getCurrentSurgeLevel,
  calculateDynamicPrice,
  DynamicPricingEngine,
  type PricingContext,
  type DynamicPrice,
  type MerchantInventory,
  type NearbyUserCount,
  type LocationType
} from './dynamicPricing';

// Auto-Campaign Engine exports
export {
  AutoCampaignEngine,
  SignalDetectionEngine,
  CampaignSuggestionEngine,
  AutoLaunchEngine,
  CampaignPerformanceTracker,
  autoCampaignEngine,
  signalDetectionEngine,
  campaignSuggestionEngine,
  autoLaunchEngine,
  campaignPerformanceTracker,
  type CampaignSignal,
  type AutoCampaign,
  type SignalType,
  type SignalConfig,
  type CampaignPerformance
} from './autoCampaign';

// Cross-Brand Coins Engine exports (Phase 4)
export {
  CrossBrandCoinsEngine,
  CrossBrandCoinManager,
  PartnerNetwork,
  MerchantRulesEngine,
  BalanceTracker,
  RedemptionEngine,
  crossBrandCoinsEngine,
  createCrossBrandCoin,
  getCrossBrandBalance,
  redeemCrossBrandCoins,
  calculateCrossBrandRedemption,
  getNetworkStatistics,
  type CrossBrandCoin,
  type CrossBrandRedemption,
  type MerchantRedemptionRule,
  type UserCrossBrandBalance,
  type CoinCreationRequest,
  type CoinRedemptionRequest,
  type CoinRedemptionResult,
  type NetworkStats,
  type MerchantNetworkStats,
  type NetworkType
} from './crossBrandCoins';

// Coin Marketplace Engine exports (Phase 4)
export {
  CoinMarketplaceEngine,
  CoinBalanceManager,
  EscrowManager,
  coinMarketplaceEngine,
  purchaseREZCoins,
  giftCoins,
  exchangeCoins,
  createListing,
  purchaseListing,
  getBalance,
  getMarketStats,
  type CoinListing,
  type CoinPurchase,
  type CoinGifting,
  type CoinExchange,
  type EscrowTransaction,
  type CoinBalance,
  type PurchaseRequest,
  type ListingRequest,
  type GiftRequest,
  type ExchangeRequest
} from './coinMarketplace';

// Coin Bundles Engine exports (Phase 4)
export {
  BundlePricingEngine,
  BonusCalculationEngine,
  BundleGenerationEngine,
  SubscriptionEngine,
  PurchaseEngine,
  BundleManagementEngine,
  BundleAnalyticsEngine,
  bundlePricingEngine,
  bonusCalculationEngine,
  bundleGenerationEngine,
  subscriptionEngine,
  purchaseEngine,
  bundleManagementEngine,
  bundleAnalyticsEngine,
  getAvailableBundles,
  getBundleById,
  purchaseBundle,
  previewBonus,
  createSubscription,
  getSubscriptionStatus,
  type CoinBundle,
  type BundlePurchase,
  type CoinType,
  type BundleType,
  type BonusType,
  type UserPurchaseHistory,
  type BundlePricingTier,
  type BundleConfig,
  type BonusConfig,
  type SubscriptionConfig
} from './coinBundles';

// DOOH Attribution Engine exports (Phase 5)
export {
  DOOHAttributionTracker,
  doohAttributionTracker,
  DOOH_ATTRIBUTION_WEIGHTS,
  DOOHAttribution,
  DOOHEventType,
  DOOHScreen,
  DOOHLocation,
  ImpressionEvent,
  QRScanEvent,
  VisitEvent,
  PurchaseEvent,
  DOOHCampaignConfig,
  DOOHAttributionQuery,
  DOOHAttributionResult,
  DOOHScreenSummary,
  DOOHCampaignSummary,
  QRCodeMapping,
  DOOHAttributionModel,
  trackDOOHImpression,
  trackDOOHQRScan,
  trackDOOHVisit,
  trackDOOHPurchase,
  getDOOHUserAttribution,
  getDOOHScreenSummary,
  getDOOHCampaignSummary,
  createDOOHQRCode,
  resolveDOOHQRCode,
  configureDOOHCampaign,
  attributeDOOHConversion
} from './doohAttribution';

// DOOH QR Integration exports (Phase 5)
export {
  QRGenerationEngine,
  ScanTrackingEngine,
  ImpressionTrackingEngine,
  PerformanceAnalyticsEngine,
  ShortUrlResolver,
  qrGenerationEngine,
  scanTrackingEngine,
  impressionTrackingEngine,
  performanceAnalyticsEngine,
  shortUrlResolver,
  QR_TEMPLATES,
  createDOOHQR,
  recordQRScan,
  recordQRImpressions,
  getQRPerformance,
  getScreenQRPerformance,
  resolveShortUrl,
  getQRByShortCode,
  getScreenQRCodes,
  type DOOHQR,
  type QRType,
  type QRStatus,
  type QRGenerationRequest,
  type QRCodePayload,
  type ScanEvent,
  type ScreenPerformance,
  type QRPerformance,
  type ImpressionEvent,
  type QRMMetadata
} from './doohQR';
