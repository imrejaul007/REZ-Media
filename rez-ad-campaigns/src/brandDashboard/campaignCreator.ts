/**
 * Campaign Creator - Multi-Step Campaign Creation Flow
 * Sponsored Marketing Platform for ReZ
 */

import {
  CampaignType,
  BiddingStrategy,
  PacingStrategy,
  OfferType,
  SponsoredCampaign,
  CampaignCreationFlow,
  BasicCampaignInfo,
  TargetingConfig,
  BudgetAndBiddingConfig,
  OfferConfig,
  ReviewData,
  ValidationResult,
  ValidationError,
  ValidationWarning,
  TargetingDemographics,
  Offer,
  CampaignSchedule,
} from './brandDashboard';

// =============================================================================
// Campaign Creator State Machine
// =============================================================================

export const CREATION_STEPS = {
  TYPE_SELECTION: 1,
  TARGETING: 2,
  BUDGET_AND_BIDDING: 3,
  OFFERS: 4,
  REVIEW: 5,
} as const;

export const STEP_NAMES = {
  [CREATION_STEPS.TYPE_SELECTION]: 'Campaign Type',
  [CREATION_STEPS.TARGETING]: 'Targeting',
  [CREATION_STEPS.BUDGET_AND_BIDDING]: 'Budget & Bidding',
  [CREATION_STEPS.OFFERS]: 'Create Offer',
  [CREATION_STEPS.REVIEW]: 'Review & Launch',
} as const;

export const CAMPAIGN_TYPE_INFO: Record<CampaignType, CampaignTypeInfo> = {
  search: {
    name: 'Search Ads',
    description: 'Appear in search results when users look for products like yours',
    icon: 'search',
    minBudget: 50,
    recommendedBudget: 200,
    bestFor: ['High intent users', 'Product searches', 'Brand keywords'],
  },
  feed: {
    name: 'Feed Ads',
    description: 'Promote your products in the social feed and discovery sections',
    icon: 'feed',
    minBudget: 30,
    recommendedBudget: 150,
    bestFor: ['Visual products', 'Awareness campaigns', 'New product launches'],
  },
  qr: {
    name: 'QR Code Campaigns',
    description: 'Create QR codes that link to special offers and track physical engagement',
    icon: 'qr',
    minBudget: 20,
    recommendedBudget: 100,
    bestFor: ['Offline-to-online', 'In-store promotions', 'Event marketing'],
  },
  location: {
    name: 'Location-Based Ads',
    description: 'Target users based on their geographic location and behavior',
    icon: 'location',
    minBudget: 40,
    recommendedBudget: 180,
    bestFor: ['Local businesses', 'Store promotions', 'Nearby targeting'],
  },
};

export interface CampaignTypeInfo {
  name: string;
  description: string;
  icon: string;
  minBudget: number;
  recommendedBudget: number;
  bestFor: string[];
}

// =============================================================================
// Campaign Creator Class
// =============================================================================

export class CampaignCreator {
  private flow: CampaignCreationFlow;
  private merchantId: string;
  private onStateChange?: (flow: CampaignCreationFlow) => void;

  constructor(merchantId: string, onStateChange?: (flow: CampaignCreationFlow) => void) {
    this.merchantId = merchantId;
    this.onStateChange = onStateChange;
    this.flow = this.initializeFlow();
  }

  private initializeFlow(): CampaignCreationFlow {
    return {
      currentStep: CREATION_STEPS.TYPE_SELECTION,
      totalSteps: 5,
      campaignType: null,
      basicInfo: this.getDefaultBasicInfo(),
      targeting: this.getDefaultTargeting(),
      budgetAndBidding: this.getDefaultBudgetAndBidding(),
      offers: { hasOffer: false, offers: [] },
      review: this.getDefaultReview(),
    };
  }

  private getDefaultBasicInfo(): BasicCampaignInfo {
    return {
      name: '',
      objective: 'conversion',
      startDate: new Date(),
      description: '',
    };
  }

  private getDefaultTargeting(): TargetingConfig {
    return {
      selectedType: 'feed',
      categories: [],
      locations: [],
      demographics: {
        ageRanges: ['18-24', '25-34', '35-44', '45-54', '55+'],
        genders: ['all'],
      },
      intentSignals: [],
      customAudiences: [],
    };
  }

  private getDefaultBudgetAndBidding(): BudgetAndBiddingConfig {
    return {
      totalBudget: 200,
      budgetType: 'daily',
      biddingStrategy: 'auto',
      maxCPC: 0.5,
      pacing: 'evenspeed',
    };
  }

  private getDefaultReview(): ReviewData {
    return {
      summary: {},
      warnings: [],
      errors: [],
      estimatedReach: 0,
      estimatedCost: 0,
    };
  }

  // ===========================================================================
  // Step Navigation
  // ===========================================================================

  public getFlow(): CampaignCreationFlow {
    return { ...this.flow };
  }

  public getCurrentStep(): number {
    return this.flow.currentStep;
  }

  public getStepName(step: number): string {
    return STEP_NAMES[step as keyof typeof STEP_NAMES] || '';
  }

  public canProceed(): boolean {
    switch (this.flow.currentStep) {
      case CREATION_STEPS.TYPE_SELECTION:
        return this.flow.campaignType !== null;
      case CREATION_STEPS.TARGETING:
        return this.validateTargeting().valid;
      case CREATION_STEPS.BUDGET_AND_BIDDING:
        return this.validateBudgetAndBidding().valid;
      case CREATION_STEPS.OFFERS:
        return this.validateOffers().valid;
      case CREATION_STEPS.REVIEW:
        return this.validateReview().valid;
      default:
        return false;
    }
  }

  public nextStep(): CampaignCreationFlow | null {
    if (!this.canProceed()) {
      return null;
    }

    if (this.flow.currentStep < this.flow.totalSteps) {
      this.flow.currentStep++;
      this.updateReview();
      this.notifyChange();
      return this.getFlow();
    }
    return null;
  }

  public previousStep(): CampaignCreationFlow | null {
    if (this.flow.currentStep > 1) {
      this.flow.currentStep--;
      this.notifyChange();
      return this.getFlow();
    }
    return null;
  }

  public goToStep(step: number): CampaignCreationFlow | null {
    if (step >= 1 && step <= this.flow.totalSteps) {
      if (step < this.flow.currentStep || this.canProceed()) {
        this.flow.currentStep = step;
        this.updateReview();
        this.notifyChange();
        return this.getFlow();
      }
    }
    return null;
  }

  // ===========================================================================
  // Step 1: Campaign Type Selection
  // ===========================================================================

  public setCampaignType(type: CampaignType): CampaignCreationFlow {
    this.flow.campaignType = type;
    this.flow.targeting.selectedType = type;
    this.flow.basicInfo.name = `${CAMPAIGN_TYPE_INFO[type].name} Campaign`;
    this.flow.budgetAndBidding.totalBudget = CAMPAIGN_TYPE_INFO[type].recommendedBudget;
    this.updateReview();
    this.notifyChange();
    return this.getFlow();
  }

  public getCampaignTypeInfo(type: CampaignType): CampaignTypeInfo {
    return CAMPAIGN_TYPE_INFO[type];
  }

  // ===========================================================================
  // Step 2: Targeting Configuration
  // ===========================================================================

  public updateTargeting(targeting: Partial<TargetingConfig>): CampaignCreationFlow {
    this.flow.targeting = { ...this.flow.targeting, ...targeting };
    this.updateReview();
    this.notifyChange();
    return this.getFlow();
  }

  public setCategories(categories: string[]): CampaignCreationFlow {
    this.flow.targeting.categories = categories;
    this.updateReview();
    this.notifyChange();
    return this.getFlow();
  }

  public setLocations(locations: string[]): CampaignCreationFlow {
    this.flow.targeting.locations = locations;
    this.updateReview();
    this.notifyChange();
    return this.getFlow();
  }

  public setDemographics(demographics: TargetingDemographics): CampaignCreationFlow {
    this.flow.targeting.demographics = demographics;
    this.updateReview();
    this.notifyChange();
    return this.getFlow();
  }

  public setIntentSignals(intent: string[]): CampaignCreationFlow {
    this.flow.targeting.intentSignals = intent;
    this.updateReview();
    this.notifyChange();
    return this.getFlow();
  }

  public validateTargeting(): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    if (!this.flow.campaignType) {
      errors.push({
        field: 'campaignType',
        message: 'Campaign type must be selected',
        code: 'CAMPAIGN_TYPE_REQUIRED',
      });
    }

    if (this.flow.targeting.categories.length === 0) {
      errors.push({
        field: 'categories',
        message: 'At least one category must be selected',
        code: 'CATEGORIES_REQUIRED',
      });
    }

    if (this.flow.targeting.demographics.ageRanges.length === 0) {
      errors.push({
        field: 'demographics.ageRanges',
        message: 'At least one age range must be selected',
        code: 'AGE_RANGE_REQUIRED',
      });
    }

    // Warnings for broad/narrow targeting
    if (this.flow.targeting.categories.length > 20) {
      warnings.push({
        field: 'categories',
        message: 'Selecting more than 20 categories may reduce targeting precision',
      });
    }

    if (this.flow.targeting.locations.length === 0) {
      warnings.push({
        field: 'locations',
        message: 'No location targeting selected - campaign will target all regions',
      });
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  // ===========================================================================
  // Step 3: Budget and Bidding
  // ===========================================================================

  public updateBudgetAndBidding(config: Partial<BudgetAndBiddingConfig>): CampaignCreationFlow {
    this.flow.budgetAndBidding = { ...this.flow.budgetAndBidding, ...config };
    this.updateReview();
    this.notifyChange();
    return this.getFlow();
  }

  public setTotalBudget(budget: number): CampaignCreationFlow {
    this.flow.budgetAndBidding.totalBudget = budget;
    this.updateReview();
    this.notifyChange();
    return this.getFlow();
  }

  public setBiddingStrategy(strategy: BiddingStrategy): CampaignCreationFlow {
    this.flow.budgetAndBidding.biddingStrategy = strategy;
    if (strategy === 'auto') {
      this.flow.budgetAndBidding.maxCPC = CAMPAIGN_TYPE_INFO[this.flow.campaignType!]?.minBudget || 0.5;
    }
    this.updateReview();
    this.notifyChange();
    return this.getFlow();
  }

  public setMaxCPC(cpc: number): CampaignCreationFlow {
    this.flow.budgetAndBidding.maxCPC = cpc;
    this.updateReview();
    this.notifyChange();
    return this.getFlow();
  }

  public setTargetCPA(cpa: number): CampaignCreationFlow {
    this.flow.budgetAndBidding.targetCPA = cpa;
    this.updateReview();
    this.notifyChange();
    return this.getFlow();
  }

  public setPacing(pacing: PacingStrategy): CampaignCreationFlow {
    this.flow.budgetAndBidding.pacing = pacing;
    this.updateReview();
    this.notifyChange();
    return this.getFlow();
  }

  public validateBudgetAndBidding(): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    const typeInfo = CAMPAIGN_TYPE_INFO[this.flow.campaignType!];

    if (!this.flow.campaignType) {
      errors.push({
        field: 'campaignType',
        message: 'Campaign type is required',
        code: 'CAMPAIGN_TYPE_REQUIRED',
      });
      return { valid: false, errors, warnings };
    }

    const minBudget = typeInfo?.minBudget || 20;
    if (this.flow.budgetAndBidding.totalBudget < minBudget) {
      errors.push({
        field: 'totalBudget',
        message: `Minimum budget for ${typeInfo.name} is $${minBudget}`,
        code: 'BUDGET_TOO_LOW',
      });
    }

    if (this.flow.budgetAndBidding.biddingStrategy !== 'auto') {
      if (this.flow.budgetAndBidding.maxCPC <= 0) {
        errors.push({
          field: 'maxCPC',
          message: 'Max CPC must be greater than 0',
          code: 'INVALID_MAX_CPC',
        });
      }

      if (this.flow.budgetAndBidding.maxCPC > this.flow.budgetAndBidding.totalBudget * 0.5) {
        warnings.push({
          field: 'maxCPC',
          message: 'Max CPC is unusually high compared to total budget',
        });
      }
    }

    if (this.flow.budgetAndBidding.targetCPA && this.flow.budgetAndBidding.targetCPA <= 0) {
      errors.push({
        field: 'targetCPA',
        message: 'Target CPA must be greater than 0',
        code: 'INVALID_TARGET_CPA',
      });
    }

    // Estimate daily spend warning
    const daysInMonth = 30;
    const estimatedDaily = this.flow.budgetAndBidding.totalBudget / daysInMonth;
    if (estimatedDaily < typeInfo?.minBudget) {
      warnings.push({
        field: 'totalBudget',
        message: `Budget results in ~$${estimatedDaily.toFixed(2)}/day which may limit ad delivery`,
      });
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  // ===========================================================================
  // Step 4: Offers
  // ===========================================================================

  public setHasOffer(hasOffer: boolean): CampaignCreationFlow {
    this.flow.offers.hasOffer = hasOffer;
    if (!hasOffer) {
      this.flow.offers.offers = [];
    } else if (this.flow.offers.offers.length === 0) {
      this.addOffer();
    }
    this.updateReview();
    this.notifyChange();
    return this.getFlow();
  }

  public addOffer(offer?: Partial<Offer>): CampaignCreationFlow {
    const newOffer: Partial<Offer> = offer || {
      type: 'discount',
      value: 10,
      description: '',
      validFrom: new Date(),
      validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      usedCount: 0,
    };
    this.flow.offers.offers.push(newOffer);
    this.updateReview();
    this.notifyChange();
    return this.getFlow();
  }

  public updateOffer(index: number, offer: Partial<Offer>): CampaignCreationFlow {
    if (index >= 0 && index < this.flow.offers.offers.length) {
      this.flow.offers.offers[index] = { ...this.flow.offers.offers[index], ...offer };
      this.updateReview();
      this.notifyChange();
    }
    return this.getFlow();
  }

  public removeOffer(index: number): CampaignCreationFlow {
    if (index >= 0 && index < this.flow.offers.offers.length) {
      this.flow.offers.offers.splice(index, 1);
      if (this.flow.offers.offers.length === 0) {
        this.flow.offers.hasOffer = false;
      }
      this.updateReview();
      this.notifyChange();
    }
    return this.getFlow();
  }

  public getOfferTypes(): OfferType[] {
    return ['discount', 'coins', 'freebie', 'bogo', 'percentage'];
  }

  public validateOffers(): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    if (!this.flow.offers.hasOffer) {
      return { valid: true, errors, warnings };
    }

    this.flow.offers.offers.forEach((offer, index) => {
      if (!offer.type) {
        errors.push({
          field: `offers[${index}].type`,
          message: 'Offer type is required',
          code: 'OFFER_TYPE_REQUIRED',
        });
      }

      if (!offer.value || offer.value <= 0) {
        errors.push({
          field: `offers[${index}].value`,
          message: 'Offer value must be greater than 0',
          code: 'INVALID_OFFER_VALUE',
        });
      }

      if (!offer.description || offer.description.trim() === '') {
        errors.push({
          field: `offers[${index}].description`,
          message: 'Offer description is required',
          code: 'OFFER_DESCRIPTION_REQUIRED',
        });
      }

      if (!offer.validUntil) {
        errors.push({
          field: `offers[${index}].validUntil`,
          message: 'Offer expiration date is required',
          code: 'OFFER_EXPIRY_REQUIRED',
        });
      } else if (new Date(offer.validUntil) <= new Date()) {
        errors.push({
          field: `offers[${index}].validUntil`,
          message: 'Offer must have a future expiration date',
          code: 'OFFER_EXPIRED',
        });
      }
    });

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  // ===========================================================================
  // Step 5: Review
  // ===========================================================================

  private updateReview(): void {
    const typeInfo = CAMPAIGN_TYPE_INFO[this.flow.campaignType!];
    const validation = this.validateReview();

    this.flow.review = {
      summary: {
        campaignType: this.flow.campaignType,
        typeName: typeInfo?.name,
        name: this.flow.basicInfo.name,
        objective: this.flow.basicInfo.objective,
        startDate: this.flow.basicInfo.startDate,
        endDate: this.flow.basicInfo.endDate,
        targeting: {
          categories: this.flow.targeting.categories.length,
          locations: this.flow.targeting.locations.length,
          demographics: this.flow.targeting.demographics,
        },
        budget: this.flow.budgetAndBidding,
        offers: this.flow.offers,
      },
      warnings: validation.warnings,
      errors: validation.errors.map((e) => e.message),
      estimatedReach: this.estimateReach(),
      estimatedCost: this.estimateCost(),
    };
  }

  public validateReview(): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    if (!this.flow.basicInfo.name || this.flow.basicInfo.name.trim() === '') {
      errors.push({
        field: 'name',
        message: 'Campaign name is required',
        code: 'NAME_REQUIRED',
      });
    }

    const targetingValidation = this.validateTargeting();
    errors.push(...targetingValidation.errors);
    warnings.push(...targetingValidation.warnings);

    const budgetValidation = this.validateBudgetAndBidding();
    errors.push(...budgetValidation.errors);
    warnings.push(...budgetValidation.warnings);

    const offersValidation = this.validateOffers();
    errors.push(...offersValidation.errors);
    warnings.push(...offersValidation.warnings);

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  private estimateReach(): number {
    const baseReach = {
      search: 5000,
      feed: 15000,
      qr: 2000,
      location: 8000,
    };

    const typeMultiplier = this.flow.campaignType
      ? (baseReach[this.flow.campaignType] || 5000) / 5000
      : 1;

    const targetingMultiplier = Math.min(
      this.flow.targeting.categories.length / 10,
      2
    );

    const dailyBudget = this.flow.budgetAndBidding.totalBudget / 30;
    const budgetMultiplier = Math.max(0.5, Math.min(3, dailyBudget / 100));

    return Math.round(
      10000 * typeMultiplier * targetingMultiplier * budgetMultiplier
    );
  }

  private estimateCost(): number {
    const cpcEstimates = {
      search: 0.75,
      feed: 0.35,
      qr: 0.25,
      location: 0.55,
    };

    const cpc = this.flow.campaignType
      ? cpcEstimates[this.flow.campaignType]
      : 0.5;

    return Math.round(this.flow.budgetAndBidding.totalBudget);
  }

  public getReview(): ReviewData {
    return { ...this.flow.review };
  }

  // ===========================================================================
  // Campaign Launch
  // ===========================================================================

  public buildCampaign(): SponsoredCampaign {
    const now = new Date();
    const id = this.generateCampaignId();

    const campaign: SponsoredCampaign = {
      id,
      name: this.flow.basicInfo.name,
      status: 'pending_review',
      type: this.flow.campaignType!,
      budget: {
        total: this.flow.budgetAndBidding.totalBudget,
        spent: 0,
        remaining: this.flow.budgetAndBidding.totalBudget,
        dailyLimit:
          this.flow.budgetAndBidding.budgetType === 'daily'
            ? this.flow.budgetAndBidding.totalBudget / 30
            : undefined,
        currency: 'USD',
      },
      bidding: {
        strategy: this.flow.budgetAndBidding.biddingStrategy,
        maxCPC: this.flow.budgetAndBidding.maxCPC,
        targetCPA: this.flow.budgetAndBidding.targetCPA,
        targetROAS: this.flow.budgetAndBidding.targetROAS,
      },
      targeting: {
        categories: this.flow.targeting.categories,
        locations: this.flow.targeting.locations,
        demographics: this.flow.targeting.demographics,
        intent: this.flow.targeting.intentSignals,
        customAudiences: this.flow.targeting.customAudiences,
        retargeting: {
          enabled: false,
          lookbackDays: 30,
          minimumEngagements: 1,
          engagementTypes: ['view', 'click'],
        },
      },
      performance: {
        impressions: 0,
        clicks: 0,
        ctr: 0,
        conversions: 0,
        conversionRate: 0,
        roas: 0,
        costPerConversion: 0,
        trend: {
          impressionsChange: 0,
          clicksChange: 0,
          conversionsChange: 0,
          roasChange: 0,
        },
      },
      pacing: this.flow.budgetAndBidding.pacing,
      offers: this.buildOffers(),
      schedule: {
        startDate: this.flow.basicInfo.startDate,
        endDate: this.flow.basicInfo.endDate,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      },
      createdAt: now,
      updatedAt: now,
    };

    return campaign;
  }

  private buildOffers(): Offer[] {
    if (!this.flow.offers.hasOffer) {
      return [];
    }

    return this.flow.offers.offers.map((offer, index) => ({
      id: `offer-${this.generateCampaignId()}-${index}`,
      type: offer.type as OfferType,
      value: offer.value || 0,
      minPurchaseAmount: offer.minPurchaseAmount,
      maxDiscountAmount: offer.maxDiscountAmount,
      code: offer.code || this.generateOfferCode(),
      description: offer.description || '',
      terms: offer.terms,
      usageLimit: offer.usageLimit,
      usedCount: 0,
      validFrom: offer.validFrom || new Date(),
      validUntil: offer.validUntil || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    }));
  }

  private generateCampaignId(): string {
    return `camp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateOfferCode(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = 'REZ';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  public async launchCampaign(): Promise<{
    success: boolean;
    campaign?: SponsoredCampaign;
    error?: string;
  }> {
    const validation = this.validateReview();

    if (!validation.valid) {
      return {
        success: false,
        error: `Validation failed: ${validation.errors.map((e) => e.message).join(', ')}`,
      };
    }

    const campaign = this.buildCampaign();

    // Simulate API call - replace with actual API integration
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          success: true,
          campaign,
        });
      }, 1000);
    });
  }

  // ===========================================================================
  // Basic Info
  // ===========================================================================

  public updateBasicInfo(info: Partial<BasicCampaignInfo>): CampaignCreationFlow {
    this.flow.basicInfo = { ...this.flow.basicInfo, ...info };
    this.updateReview();
    this.notifyChange();
    return this.getFlow();
  }

  // ===========================================================================
  // Reset
  // ===========================================================================

  public reset(): CampaignCreationFlow {
    this.flow = this.initializeFlow();
    this.notifyChange();
    return this.getFlow();
  }

  private notifyChange(): void {
    if (this.onStateChange) {
      this.onStateChange(this.getFlow());
    }
  }
}

// =============================================================================
// Campaign Template Service
// =============================================================================

export interface CampaignTemplate {
  id: string;
  name: string;
  type: CampaignType;
  description: string;
  targeting: Partial<TargetingConfig>;
  budget: Partial<BudgetAndBiddingConfig>;
  offers?: Partial<Offer>[];
}

export const CAMPAIGN_TEMPLATES: CampaignTemplate[] = [
  {
    id: 'template_quick_start',
    name: 'Quick Start',
    type: 'feed',
    description: 'Get your first campaign running with minimal setup',
    targeting: {
      categories: ['general'],
      demographics: {
        ageRanges: ['25-34', '35-44'],
        genders: ['all'],
      },
    },
    budget: {
      totalBudget: 100,
      biddingStrategy: 'auto',
      pacing: 'evenspeed',
    },
  },
  {
    id: 'template_product_launch',
    name: 'Product Launch',
    type: 'feed',
    description: 'Announce a new product with visual ads',
    targeting: {
      categories: [],
      demographics: {
        ageRanges: ['18-24', '25-34'],
        genders: ['all'],
      },
    },
    budget: {
      totalBudget: 500,
      biddingStrategy: 'auto',
      pacing: 'accelerated',
    },
    offers: [
      {
        type: 'percentage',
        value: 10,
        description: 'Launch special: 10% off',
      },
    ],
  },
  {
    id: 'template_location_promo',
    name: 'Local Store Promotion',
    type: 'location',
    description: 'Drive foot traffic to your physical location',
    targeting: {
      locations: [],
      demographics: {
        ageRanges: ['25-34', '35-44', '45-54'],
        genders: ['all'],
      },
    },
    budget: {
      totalBudget: 200,
      biddingStrategy: 'manual',
      maxCPC: 0.75,
      pacing: 'evenspeed',
    },
    offers: [
      {
        type: 'discount',
        value: 15,
        description: '$15 off your first visit',
        minPurchaseAmount: 50,
      },
    ],
  },
  {
    id: 'template_search_brand',
    name: 'Brand Awareness Search',
    type: 'search',
    description: 'Capture high-intent search traffic for your brand',
    targeting: {
      categories: [],
      intentSignals: ['brand_search', 'competitor_search'],
      demographics: {
        ageRanges: ['18-24', '25-34', '35-44', '45-54', '55+'],
        genders: ['all'],
      },
    },
    budget: {
      totalBudget: 300,
      biddingStrategy: 'manual',
      maxCPC: 1.5,
      pacing: 'evenspeed',
    },
  },
  {
    id: 'template_qr_event',
    name: 'Event QR Campaign',
    type: 'qr',
    description: 'Track engagement from event QR codes',
    targeting: {
      categories: ['events'],
      demographics: {
        ageRanges: ['18-24', '25-34', '35-44'],
        genders: ['all'],
      },
    },
    budget: {
      totalBudget: 150,
      biddingStrategy: 'auto',
      pacing: 'frontloaded',
    },
    offers: [
      {
        type: 'freebie',
        value: 1,
        description: 'Free item with QR scan',
        usageLimit: 500,
      },
    ],
  },
];

export class CampaignTemplateService {
  public getTemplates(): CampaignTemplate[] {
    return CAMPAIGN_TEMPLATES;
  }

  public getTemplateById(id: string): CampaignTemplate | undefined {
    return CAMPAIGN_TEMPLATES.find((t) => t.id === id);
  }

  public getTemplatesByType(type: CampaignType): CampaignTemplate[] {
    return CAMPAIGN_TEMPLATES.filter((t) => t.type === type);
  }

  public applyTemplate(
    creator: CampaignCreator,
    templateId: string
  ): CampaignCreationFlow | null {
    const template = this.getTemplateById(templateId);
    if (!template) {
      return null;
    }

    creator.setCampaignType(template.type);

    if (template.targeting) {
      creator.updateTargeting(template.targeting as TargetingConfig);
    }

    if (template.budget) {
      creator.updateBudgetAndBidding(template.budget);
    }

    if (template.offers && template.offers.length > 0) {
      creator.setHasOffer(true);
      template.offers.forEach((offer) => {
        creator.addOffer(offer);
      });
    }

    return creator.getFlow();
  }
}
