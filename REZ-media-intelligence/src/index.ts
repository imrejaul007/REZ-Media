/**
 * REZ Media Intelligence Service
 *
 * Exports all public functions and types
 */

// Re-export all types and functions from mediaIntelligence
export {
  // Types
  RFMTier,
  ChurnRisk,
  CustomerProfile,
  RFMScore,
  ChurnPrediction,
  LTVPrediction,
  Segment,
  CampaignTargets,
  PersonalizedContent,
  ContentType,
  DOOHContext,
  OptimizedAd,
  TierBenefits,
  LoyaltyOffer,
  MediaIntelligenceError,
} from './services/mediaIntelligence';

// Re-export functions with full TypeScript signatures
export {
  getCustomerProfile,
  getCampaignTargets,
  generatePersonalizedContent,
  optimizeDOOHAd,
  getTierBenefits,
  triggerReEngagement,
  getBatchCustomerProfiles,
  getSegmentAnalysis,
  getContentRecommendations,
  healthCheck,
  mapRFMScore,
} from './services/mediaIntelligence';
