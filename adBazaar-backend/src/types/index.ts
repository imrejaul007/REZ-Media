/**
 * AdBazaar Backend - Types
 * Screen marketplace connecting owners with advertisers
 */

// ============================================================================
// USER TYPES
// ============================================================================

export type UserType = 'screen_owner' | 'advertiser' | 'admin';

export interface User {
  userId: string;
  email: string;
  phone: string;
  userType: UserType;
  name: string;
  businessName?: string;
  verified: boolean;
  kycStatus: 'pending' | 'approved' | 'rejected';
  createdAt: Date;
}

// ============================================================================
// SCREEN OWNER TYPES
// ============================================================================

export interface ScreenOwner {
  ownerId: string;
  userId: string;
  businessName: string;
  gstin?: string;
  pan?: string;
  bankDetails?: BankDetails;
  payoutSettings: PayoutSettings;
  stats: OwnerStats;
  createdAt: Date;
}

export interface BankDetails {
  accountNumber: string;
  accountName: string;
  bankName: string;
  ifscCode: string;
  upiId?: string;
}

export interface PayoutSettings {
  minPayoutThreshold: number;
  payoutFrequency: 'weekly' | 'biweekly' | 'monthly';
  autoPayout: boolean;
}

export interface OwnerStats {
  totalScreens: number;
  activeScreens: number;
  totalEarnings: number;
  pendingPayout: number;
  totalImpressions: number;
  avgFillRate: number;
}

// ============================================================================
// SCREEN/LISTING TYPES
// ============================================================================

export type ScreenType =
  | 'hotel_tv'
  | 'cab_screen'
  | 'flight_seat'
  | 'bus_seat'
  | 'train_seat'
  | 'mall_kiosk'
  | 'office_lobby'
  | 'university_display'
  | 'gym_screen'
  | 'cinema_screen'
  | 'restaurant_tv'
  | 'billboard_led'
  | 'bus_shelter'
  | 'other';

export type CaptivityLevel = 'personal' | 'captive_private' | 'semi_captive' | 'public';

export interface Screen {
  screenId: string;
  ownerId: string;
  name: string;
  screenType: ScreenType;
  captivityLevel: CaptivityLevel;

  // Location
  address: Address;
  coordinates: {
    lat: number;
    lng: number;
  };

  // Screen specs
  dimensions: {
    width: number;
    height: number;
    unit: 'inches' | 'cm';
  };
  orientation: 'landscape' | 'portrait' | 'both';
  resolution?: string;

  // Availability
  availability: AvailabilitySchedule;

  // Pricing
  floorPrice: FloorPrice;
  pricing: PricingConfig;

  // Status
  status: 'active' | 'inactive' | 'pending_approval' | 'suspended';

  // Stats
  stats: ScreenStats;

  createdAt: Date;
  updatedAt: Date;
}

export interface Address {
  street: string;
  city: string;
  state: string;
  country: string;
  pincode: string;
}

export interface AvailabilitySchedule {
  timezone: string;
  slots: {
    dayOfWeek: number; // 0-6 (Sunday-Saturday)
    startTime: string; // "09:00"
    endTime: string; // "22:00"
  }[];
  blackedOutDates?: Date[];
}

export interface FloorPrice {
  cpm: number;
  currency: string;
  minCampaignBudget: number;
}

export interface PricingConfig {
  model: 'cpm' | 'cpc' | 'cpa';
  dynamicPricing: boolean;
  discounts: PricingDiscounts;
}

export interface PricingDiscounts {
  volume: {
    minImpressions: number;
    discountPercent: number;
  }[];
  duration: {
    minDays: number;
    discountPercent: number;
  }[];
  loyalty: {
    campaignsCompleted: number;
    discountPercent: number;
  }[];
}

export interface ScreenStats {
  totalImpressions: number;
  totalClicks: number;
  totalConversions: number;
  avgViewability: number;
  fillRate: number;
  lastUpdated: Date;
}

// ============================================================================
// ADVERTISER TYPES
// ============================================================================

export interface Advertiser {
  advertiserId: string;
  userId: string;
  companyName: string;
  gstin?: string;
  website?: string;
  industry: string;
  billingInfo?: BillingInfo;
  creditLimit?: number;
  stats: AdvertiserStats;
  createdAt: Date;
}

export interface BillingInfo {
  billingName: string;
  billingAddress: Address;
  gstin: string;
  pan?: string;
}

export interface AdvertiserStats {
  totalCampaigns: number;
  activeCampaigns: number;
  totalSpend: number;
  totalImpressions: number;
  avgROAS: number;
}

// ============================================================================
// CAMPAIGN TYPES
// ============================================================================

export type CampaignStatus = 'draft' | 'active' | 'paused' | 'completed' | 'rejected';

export type CampaignObjective =
  | 'awareness'
  | 'traffic'
  | 'engagement'
  | 'conversions'
  | 'footfall'
  | 'app_install';

export interface Campaign {
  campaignId: string;
  advertiserId: string;
  name: string;
  status: CampaignStatus;

  // Budget
  budget: {
    total: number;
    daily?: number;
    spent: number;
  };

  // Objective
  objective: CampaignObjective;
  bidStrategy: 'cpm' | 'cpc' | 'cpa' | 'auto';

  // Targeting
  targeting: CampaignTargeting;

  // Creatives
  creatives: Creative[];

  // Scheduling
  schedule: {
    startDate: Date;
    endDate?: Date;
  };

  // Screens booked
  screenBookings: ScreenBooking[];

  // Stats
  stats: CampaignStats;

  createdAt: Date;
  updatedAt: Date;
}

export interface CampaignTargeting {
  // Location
  locations?: {
    cities?: string[];
    radius?: { lat: number; lng: number; km: number }[];
  };

  // Demographics
  demographics?: {
    ageRanges?: string[];
    gender?: string[];
    income?: ('low' | 'medium' | 'high')[];
  };

  // Time
  timeSlots?: {
    dayOfWeek?: number[];
    hours?: { start: number; end: number }[];
  };

  // Screen types
  screenTypes?: ScreenType[];

  // Captivity level
  captivityLevels?: CaptivityLevel[];
}

export interface Creative {
  creativeId: string;
  name: string;
  type: 'image' | 'video' | 'html';
  assets: {
    url: string;
    width?: number;
    height?: number;
    mimeType: string;
  };
  clickUrl: string;
  status: 'active' | 'paused';
}

export interface ScreenBooking {
  screenId: string;
  ownerId: string;

  // Booking details
  bookedSlots: {
    date: Date;
    startTime: string;
    endTime: string;
  }[];

  // Pricing
  negotiatedPrice: number;
  floorPrice: number;
  platformFee: number;
  ownerPayout: number;

  // Status
  status: 'pending' | 'confirmed' | 'running' | 'completed' | 'cancelled';

  // Stats
  stats: {
    impressions: number;
    clicks: number;
    conversions: number;
  };
}

export interface CampaignStats {
  impressions: number;
  clicks: number;
  conversions: number;
  spend: number;
  ctr: number;
  cvr: number;
  cpm: number;
  cpc: number;
  cpa: number;
  roas?: number;
}

// ============================================================================
// BOOKING TYPES
// ============================================================================

export type BookingStatus =
  | 'inquiry'
  | 'quote_sent'
  | 'negotiating'
  | 'confirmed'
  | 'payment_pending'
  | 'active'
  | 'completed'
  | 'cancelled';

export interface Booking {
  bookingId: string;
  campaignId: string;
  advertiserId: string;
  screenId: string;
  ownerId: string;

  // Details
  slots: {
    date: Date;
    startTime: string;
    endTime: string;
  }[];

  // Pricing
  pricing: BookingPricing;

  // Status
  status: BookingStatus;

  createdAt: Date;
  updatedAt: Date;
}

export interface BookingPricing {
  basePrice: number;
  negotiatedPrice: number;
  platformFee: number;
  ownerPayout: number;
  tax: number;
  total: number;
  currency: string;
}

// ============================================================================
// PAYMENT TYPES
// ============================================================================

export type PaymentStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'refunded';

export interface Payment {
  paymentId: string;
  type: 'campaign_payment' | 'owner_payout' | 'refund';

  // References
  bookingId?: string;
  campaignId?: string;
  advertiserId?: string;
  ownerId?: string;

  // Amount
  amount: number;
  currency: string;
  platformFee: number;
  gst: number;

  // Status
  status: PaymentStatus;
  transactionId?: string;

  createdAt: Date;
  completedAt?: Date;
}

// ============================================================================
// REVIEW TYPES
// ============================================================================

export interface Review {
  reviewId: string;
  bookingId: string;
  campaignId: string;
  screenId: string;

  reviewerType: 'advertiser' | 'owner';

  rating: number; // 1-5
  comment?: string;
  screenshots?: string[];

  createdAt: Date;
}

// ============================================================================
// MARKETPLACE TYPES
// ============================================================================

export interface MarketplaceSearch {
  query?: string;
  filters: {
    screenTypes?: ScreenType[];
    cities?: string[];
    captivityLevels?: CaptivityLevel[];
    priceRange?: { min: number; max: number };
    availability?: { startDate: Date; endDate: Date };
  };
  sort: 'price_asc' | 'price_desc' | 'rating' | 'popularity' | 'fill_rate';
  pagination: {
    page: number;
    limit: number;
  };
}

export interface MarketplaceListing {
  screen: Screen;
  owner: {
    name: string;
    rating: number;
    totalListings: number;
  };
  pricing: {
    currentCPM: number;
    originalCPM: number;
    discount?: number;
  };
  availability: {
    available: boolean;
    nextAvailable?: Date;
  };
}

// ============================================================================
// PRICING INTEGRATION
// ============================================================================

export interface PricingQuote {
  screenId: string;
  campaignId: string;

  // Base pricing from DOOH intelligence
  baseCPM: number;
  dynamicCPM: number;

  // Adjustments
  adjustments: {
    captivity: number;
    cityTier: number;
    timeSlot: number;
    seasonal: number;
    demand: number;
    audienceMatch: number;
  };

  // Final pricing
  finalCPM: number;
  totalBudget: number;
  estimatedImpressions: number;

  // Breakdown
  ownerPayout: number;
  platformFee: number;
  gst: number;
  total: number;

  validUntil: Date;
}

// ============================================================================
// ANALYTICS TYPES
// ============================================================================

export interface OwnerAnalytics {
  ownerId: string;
  period: { start: Date; end: Date };

  revenue: {
    total: number;
    pending: number;
    paid: number;
  };

  screens: {
    total: number;
    active: number;
    byType: Record<ScreenType, number>;
  };

  impressions: {
    total: number;
    byScreen: Record<string, number>;
    fillRate: number;
  };

  earnings: {
    byScreen: Record<string, number>;
    byDay: { date: Date; amount: number }[];
  };

  topCampaigns: {
    campaignId: string;
    impressions: number;
    revenue: number;
  }[];
}

export interface AdvertiserAnalytics {
  advertiserId: string;
  period: { start: Date; end: Date };

  spend: {
    total: number;
    byCampaign: Record<string, number>;
    byDay: { date: Date; amount: number }[];
  };

  performance: {
    impressions: number;
    clicks: number;
    conversions: number;
    ctr: number;
    cvr: number;
    cpm: number;
    cpa: number;
    roas: number;
  };

  byScreenType: {
    screenType: ScreenType;
    impressions: number;
    spend: number;
    conversions: number;
  }[];

  topScreens: {
    screenId: string;
    impressions: number;
    conversions: number;
    roas: number;
  }[];
}
