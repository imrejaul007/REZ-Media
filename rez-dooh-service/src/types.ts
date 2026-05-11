/**
 * DOOH Service - Unified Types
 * Digital Out of Home Advertising Network
 *
 * Combines functionality from:
 * - Screen management (dooh/, adsos/dooh/)
 * - Ad decision engine (AdOS - adsos/)
 * - Area-based targeting (areaIntelligence.ts)
 * - 1:1 personalization (index.ts)
 * - DOOH analytics (dooh/)
 * - AdQR integration (dooh-screen-app/)
 */

// ============================================================================
// SCREEN TYPES
// ============================================================================

/**
 * Screen types in the DOOH network
 */
export type ScreenType =
  // Ground Transport
  | 'cab_tablet'
  | 'bus_shelter'
  | 'bus_interior'
  | 'train_display'
  | 'metro_screen'
  // Aviation
  | 'flight_seatback'
  | 'flight_overhead'
  | 'flight_entrance'
  | 'flight_lavatory'
  // Airports
  | 'airport_display'
  | 'airport_kiosk'
  | 'airport_gate'
  | 'airport_lounge'
  | 'airport_billboard'
  // Hospitality
  | 'restaurant_tv'
  | 'hotel_lobby'
  | 'hotel_room'
  // Retail
  | 'mall_kiosk'
  | 'mall_directory'
  | 'gym_screen'
  | 'salon_display'
  // Office
  | 'office_lobby'
  | 'office_elevator'
  // Street
  | 'billboard_digital'
  // Generic
  | 'generic_display'

/**
 * Screen network classification
 */
export type ScreenNetworkType = '1:1' | 'mass'

/**
 * Screen status
 */
export type ScreenStatus = 'active' | 'inactive' | 'offline' | 'maintenance'

/**
 * Screen location types
 */
export type LocationType =
  | 'cab' | 'bus' | 'train' | 'metro'
  | 'flight' | 'airport_terminal' | 'airport_gate' | 'airport_lounge'
  | 'restaurant' | 'hotel' | 'hospital'
  | 'mall' | 'gym' | 'salon' | 'retail'
  | 'office' | 'coworking'
  | 'street' | 'highway'
  | 'other'

/**
 * Screen location
 */
export interface ScreenLocation {
  city: string
  area: string
  zone?: string
  lat: number
  lng: number
  address?: string
}

/**
 * Hardware specifications
 */
export interface ScreenHardware {
  model?: string
  os?: string
  resolution?: string
  screen_size?: number // inches
}

/**
 * Operating hours
 */
export interface OperatingHours {
  open: string // "09:00"
  close: string // "22:00"
  timezone: string
}

/**
 * Audience segment
 */
export interface AudienceSegment {
  type: 'office_workers' | 'students' | 'families' | 'tourists' | 'fitness' | 'foodies' | 'shoppers' | 'general'
  percentage: number // 0-100
}

/**
 * Time slot
 */
export interface TimeSlot {
  start: string // "09:00"
  end: string // "12:00"
  day_type: 'weekday' | 'weekend' | 'all'
}

/**
 * Audience profile for a screen location
 */
export interface AudienceProfile {
  primary: AudienceSegment[]
  secondary?: AudienceSegment[]
  peak_hours: TimeSlot[]
  avg_dwell_time: number // seconds
  daily_footfall?: number
}

/**
 * Slot pricing for time-based advertising
 */
export interface SlotPricing {
  slot_type: 'prime' | 'standard' | 'off_peak'
  duration_seconds: number // 10, 15, 30
  price: number
  multiplier: number // CPM multiplier
}

/**
 * DOOH Screen entity
 */
export interface Screen {
  id: string
  name: string
  type: ScreenType
  network_type: ScreenNetworkType
  location_type: LocationType

  // Location
  location: ScreenLocation

  // Hardware info
  hardware?: ScreenHardware

  // Network
  network_id?: string
  ip_address?: string
  mac_address?: string

  // Owner/partner
  owner_id: string
  owner_type: 'owned' | 'partner' | 'external'
  owner_email?: string
  owner_phone?: string

  // Status
  status: ScreenStatus
  last_seen?: Date
  last_sync?: Date
  playlist_version?: number

  // Schedule
  operating_hours?: OperatingHours

  // Audience info
  audience_profile?: AudienceProfile

  // Cost
  cpm: number // Cost per 1000 impressions
  slot_pricing?: SlotPricing[]

  // Earnings
  earnings_balance?: number
  earnings_paid?: number

  // Metrics
  total_impressions?: number
  total_scans?: number

  // Timestamps
  created_at: Date
  updated_at: Date
}

/**
 * Screen registration request
 */
export interface ScreenRegistration {
  name: string
  type: ScreenType
  network_type: ScreenNetworkType
  location_type: LocationType
  location: {
    city: string
    area: string
    zone?: string
    lat: number
    lng: number
    address?: string
  }
  owner_id: string
  owner_email: string
  owner_phone?: string
  hardware?: ScreenHardware
  operating_hours?: OperatingHours
  audience_profile?: AudienceProfile
  cpm?: number
}

/**
 * Screen heartbeat
 */
export interface ScreenHeartbeat {
  screen_id: string
  timestamp: Date
  status: ScreenStatus
  playlist_version: number
  current_campaign_id?: string
  impressions_last_hour: number
  errors?: string[]
}

/**
 * Screen health status
 */
export interface ScreenHealth {
  screenId: string
  status: 'healthy' | 'degraded' | 'offline'
  lastHeartbeat: Date
  uptime: number
  errorCount: number
  lastError?: string
  connectionQuality: 'excellent' | 'good' | 'poor'
  bandwidth: number
  storageAvailable: number
}

/**
 * Screen filter for queries
 */
export interface ScreenFilter {
  type?: ScreenType
  network_type?: ScreenNetworkType
  city?: string
  area?: string
  status?: ScreenStatus
  owner_type?: 'owned' | 'partner' | 'external'
  owner_id?: string
  min_cpm?: number
  max_cpm?: number
  min_footfall?: number
}

// ============================================================================
// CAMPAIGN TYPES
// ============================================================================

/**
 * Creative asset
 */
export interface Creative {
  id: string
  type: 'image' | 'video' | 'html5'
  url: string
  thumbnail?: string
  name: string
  duration: number // seconds
}

/**
 * Context signals from ReZ Mind
 */
export interface ContextSignal {
  signal_type: 'weather' | 'time' | 'location_density' | 'event' | 'category_intent'
  condition: string
  action: 'boost' | 'reduce' | 'show' | 'hide'
  campaign_id?: string
}

/**
 * DOOH targeting configuration
 */
export interface DOOHTargeting {
  // Location
  cities?: string[]
  areas?: string[]

  // Screens
  screen_types?: ScreenType[]
  location_types?: LocationType[]
  network_types?: ScreenNetworkType[]

  // Audience
  audience_segments?: AudienceSegment['type'][]

  // Demographics
  demographics?: {
    income_levels?: ('low' | 'middle' | 'high')[]
    age_ranges?: { min: number; max: number }[]
  }

  // Time
  day_parts?: {
    morning?: boolean // 6-12
    afternoon?: boolean // 12-17
    evening?: boolean // 17-22
    night?: boolean // 22-6
  }
  weekdays_only?: boolean

  // Context signals
  context_signals?: ContextSignal[]
}

/**
 * Screen filter for campaign
 */
export interface CampaignScreenFilter {
  min_footfall?: number
  audience_overlap?: number // 0-100
  cpm_max?: number
  cpm_min?: number
}

/**
 * Campaign metrics
 */
export interface CampaignMetrics {
  impressions: number
  unique_impressions: number
  avg_view_duration: number
  interactions: number
  scans: number
  visits: number
  purchases: number
  revenue: number

  // Rates
  scan_rate: number // scans/impressions
  visit_rate: number // visits/impressions
  purchase_rate: number

  // Costs
  total_spent: number
  cpm_actual: number
  cpc_actual: number // cost per scan
  cpu_actual: number // cost per visit
  cpp_actual: number // cost per purchase

  last_updated: Date
}

/**
 * DOOH Campaign
 */
export interface DOOHCampaign {
  id: string
  name: string
  merchant_id: string
  brand_id?: string

  // Content
  creatives: Creative[]

  // Targeting
  targeting: DOOHTargeting

  // Budget
  budget: number
  spent: number

  // Schedule
  start_date: Date
  end_date: Date
  schedule_type: 'continuous' | 'scheduled' | 'time_slots'

  // Screens
  screen_filter: CampaignScreenFilter

  // Status
  status: 'draft' | 'active' | 'paused' | 'completed' | 'budget_exhausted'

  // Metrics
  metrics: CampaignMetrics

  created_at: Date
  updated_at: Date
}

/**
 * Campaign creation request
 */
export interface CampaignCreateRequest {
  name: string
  merchant_id: string
  budget: number
  start_date: Date
  end_date: Date
  targeting: DOOHTargeting
  screen_filter?: CampaignScreenFilter
  creatives: Omit<Creative, 'id'>[]
}

// ============================================================================
// PLAYLIST TYPES
// ============================================================================

/**
 * Playlist slot
 */
export interface PlaylistSlot {
  position: number
  campaign_id: string
  creative_id: string
  start_time: string // "09:00:00"
  duration: number // seconds
  scheduled_impressions: number
  actual_impressions?: number
}

/**
 * Time slot config
 */
export interface TimeSlotConfig {
  start: string
  end: string
  slot_type: 'prime' | 'standard' | 'off_peak'
}

/**
 * Playlist generation request
 */
export interface PlaylistRequest {
  screen_id: string
  date: Date
  duration: number // total playlist duration in seconds
  time_slots: TimeSlotConfig[]
  context_signals?: ContextSignal[]
}

/**
 * Playlist for a screen
 */
export interface Playlist {
  id: string
  screen_id: string
  date: Date

  slots: PlaylistSlot[]

  total_duration: number // seconds
  generated_at: Date
  version: number
}

// ============================================================================
// DELIVERY TYPES
// ============================================================================

/**
 * Delivery context
 */
export interface DeliveryContext {
  time: string
  day_type: 'weekday' | 'weekend'
  weather?: 'sunny' | 'cloudy' | 'rainy'
  nearby_events?: string[]
  audience: AudienceProfile
}

/**
 * Ad delivery request
 */
export interface DeliveryRequest {
  screen_id: string
  available_slots: number
  context: DeliveryContext
  user_id?: string
}

/**
 * Delivery slot
 */
export interface DeliverySlot {
  position: number
  campaign_id: string
  creative: Creative
  duration: number
  priority: number
  reason: string
}

/**
 * Ad delivery response
 */
export interface DeliveryResponse {
  screen_id: string
  slots: DeliverySlot[]
  generated_at: Date
}

// ============================================================================
// AD DECISION TYPES (AdOS)
// ============================================================================

/**
 * Ad decision result
 */
export interface AdDecision {
  screenId: string
  adId: string
  merchantId: string
  type: 'personalized' | 'area_based' | 'brand'
  score: number
  reasons: string[]
  expiresAt: Date
}

/**
 * Scored listing for AdOS
 */
export interface ScoredListing {
  listing_id: string
  listing_name: string
  metrics: ListingMetrics | null
  roi: ROIResult
  score: number
  rank: number
}

/**
 * Listing metrics
 */
export interface ListingMetrics {
  scans: number
  visits: number
  purchases: number
  revenue: number
  scan_to_visit_rate: number
  visit_to_purchase_rate: number
  avg_order_value: number
  last_updated: Date
  data_points: number
}

/**
 * ROI result
 */
export interface ROIResult {
  roas: number
  cpp: number
  cpv: number
  confidence: number
  data_points: number
  used_fallback: boolean
  breakdown: {
    scans: number
    expected_visits: number
    expected_purchases: number
    expected_revenue: number
    total_cost: number
  }
}

/**
 * Budget allocation
 */
export interface BudgetAllocation {
  listing_id: string
  listing_name: string
  allocated_budget: number
  percentage_of_total: number
  expected_visits: number
  expected_purchases: number
  expected_roas: number
  confidence: number
  warnings: AllocationWarning[]
}

/**
 * Allocation warning
 */
export interface AllocationWarning {
  type: 'low_confidence' | 'low_roi' | 'high_cpv' | 'budget_low' | 'new_listing'
  message: string
  severity: 'info' | 'warning' | 'critical'
}

// ============================================================================
// AREA INTELLIGENCE TYPES
// ============================================================================

/**
 * Area demographics
 */
export interface AreaDemographics {
  areaId: string
  name: string
  population?: number
  avg_age: number
  income_level: 'low' | 'middle' | 'high'
  income_distribution?: {
    low: number
    middle: number
    high: number
  }
  dominant_categories: string[]
  peak_hours: string[]
  weekend_vs_weekday?: number
}

/**
 * Area time context
 */
export interface AreaTimeContext {
  hour: number
  day_of_week: number
  is_peak: boolean
  season?: string
}

/**
 * Intent data
 */
export interface IntentData {
  intent: string
  count: number
}

/**
 * Area context
 */
export interface AreaContext {
  areaId: string
  name: string
  demographics: AreaDemographics
  time_context: AreaTimeContext
  top_intents: IntentData[]
  active_users: number
  trending_products: string[]
}

/**
 * ReZ Mind signals
 */
export interface ReZMindSignals {
  areaId: string
  intent_signals: {
    category: string
    intensity: number
  }[]
  context_factors: {
    weather?: 'sunny' | 'cloudy' | 'rainy' | 'stormy'
    events?: string[]
    local_activity?: string
  }
  active_user_density: number
  predicted_footfall: number
}

/**
 * Area ad candidate
 */
export interface AreaAdCandidate {
  ad_id: string
  merchant_id: string
  merchant_name: string
  categories: string[]
  price_range: { min: number; max: number }
  score: number
  reason: string
}

// ============================================================================
// PERSONALIZATION TYPES
// ============================================================================

/**
 * User profile for 1:1 personalization
 */
export interface UserProfile {
  id: string
  preferences: {
    categories: string[]
    intents: string[]
    preferred_time_slots: string[]
  }
  demographics: {
    age: number
    income_level: 'low' | 'middle' | 'high'
  }
  recent_activity: {
    last_seen: Date
    frequent_areas: string[]
  }
}

/**
 * Ad creative (for personalization)
 */
export interface AdCreative {
  id: string
  merchant_id: string
  name: string
  type: 'image' | 'video' | 'html5'
  url: string
  thumbnail_url?: string
  duration: number
  target_categories: string[]
  target_intents: string[]
  target_income_levels?: ('low' | 'middle' | 'high')[]
  target_age_ranges?: { min: number; max: number }
  status: 'active' | 'paused' | 'ended'
  created_at: Date
}

// ============================================================================
// ANALYTICS TYPES
// ============================================================================

/**
 * Impression event
 */
export interface ImpressionEvent {
  screen_id: string
  campaign_id?: string
  ad_id: string
  user_id?: string
  timestamp: Date
  duration_played: number
  viewable: boolean
  metadata?: Record<string, unknown>
}

/**
 * Interaction event
 */
export interface InteractionEvent {
  screen_id: string
  ad_id: string
  user_id?: string
  type: 'tap' | 'scan' | 'swipe' | 'voice'
  timestamp: Date
  metadata?: Record<string, unknown>
}

/**
 * DOOH analytics for a screen
 */
export interface DOOHAnalytics {
  screen_id: string
  impressions: number
  unique_views: number
  avg_view_duration: number
  interactions: number
  conversions: number
  attribution: {
    scan_count: number
    trial_count: number
    purchase_count: number
  }
  last_updated: Date
}

/**
 * Network analytics aggregate
 */
export interface NetworkAnalytics {
  total_screens: number
  active_screens: number
  total_impressions: number
  total_interactions: number
  total_conversions: number
  avg_engagement_rate: number
  scan_rate: number
  visit_rate: number
  purchase_rate: number
  total_revenue: number
  period: 'hour' | 'day' | 'week' | 'month'
}

/**
 * Campaign performance
 */
export interface CampaignPerformance {
  campaign_id: string
  campaign_name: string
  status: DOOHCampaign['status']
  metrics: CampaignMetrics
  roi: ROIResult
  spend_progress: number // percentage
  time_remaining: number // days
}

/**
 * Screen performance
 */
export interface ScreenPerformance {
  screen_id: string
  screen_name: string
  screen_type: ScreenType
  location: ScreenLocation
  metrics: {
    impressions_today: number
    impressions_week: number
    scans_today: number
    earnings_today: number
  }
  health: ScreenHealth
}

// ============================================================================
// ADQR INTEGRATION TYPES
// ============================================================================

/**
 * QR code connection
 */
export interface AdQRConnection {
  qr_id: string
  screen_id: string
  ad_id: string
  campaign_id?: string
  scan_events: QR scan event[]
  conversions: {
    trial_count: number
    purchase_count: number
    revenue: number
  }
}

/**
 * QR scan event
 */
export interface QR scan event {
  user_id?: string
  timestamp: Date
  location: { lat: number; lng: number }
}

/**
 * QR generation request
 */
export interface QRGenerationRequest {
  screen_id: string
  ad_id: string
  campaign_id?: string
  expires_at?: Date
}

/**
 * QR generation response
 */
export interface QRGenerationResponse {
  qr_id: string
  url: string
  short_code: string
  expires_at: Date
}

// ============================================================================
// REVENUE TYPES
// ============================================================================

/**
 * Revenue model
 */
export interface RevenueModel {
  type: 'cpm' | 'slot' | 'performance' | 'hybrid'

  // CPM
  cpm_rate?: number

  // Slot pricing
  slot_pricing?: SlotPricing[]

  // Performance
  performance_rate?: number
  performance_metric?: 'scan' | 'visit' | 'purchase'

  // Hybrid
  base_cpm?: number
  performance_bonus?: number
}

/**
 * Revenue share model
 */
export interface RevenueShare {
  screen_owner: number // percentage
  platform: number // percentage
  content_provider?: number // percentage
}

/**
 * Payout record
 */
export interface PayoutRecord {
  id: string
  screen_id: string
  period_start: Date
  period_end: Date
  impressions: number
  revenue: number
  owner_share: number
  platform_share: number
  status: 'pending' | 'processed' | 'paid'
  paid_at?: Date
}

/**
 * Payment summary
 */
export interface PaymentSummary {
  screen_id: string
  impressions: number
  gross_revenue: number
  platform_fee: number
  owner_amount: number
}

// ============================================================================
// SCREEN OS TYPES
// ============================================================================

/**
 * Screen OS configuration
 */
export interface ScreenOSConfig {
  server_url: string
  api_key: string
  sync_interval: number // seconds
  playlist_refresh: number // seconds
  heartbeat_interval: number // seconds
  offline_buffer_hours: number
}

/**
 * Content update for screen
 */
export interface ContentUpdate {
  screen_id: string
  playlist: Playlist
  creatives: Creative[]
  config: ScreenOSConfig
  version: number
  timestamp: Date
}

// ============================================================================
// GUARDRAILS TYPES (AdOS)
// ============================================================================

/**
 * Guardrail configuration
 */
export interface GuardrailConfig {
  min_budget_per_listing: number
  min_total_budget: number
  max_budget_per_listing: number
  max_cost_per_visit: number
  max_cost_per_purchase: number
  min_roas_threshold: number
  min_confidence_threshold: number
  min_data_points: number
  max_scan_rate_per_hour: number
  max_visit_rate_per_scan: number
  max_listings_per_campaign: number
  max_campaign_duration_days: number
}

/**
 * Guardrail result
 */
export interface GuardrailResult {
  passed: boolean
  modifications: {
    listing_id: string
    field: string
    original_value: unknown
    new_value: unknown
    reason: string
  }[]
  excluded_listings: {
    listing_id: string
    reason: string
    severity: 'warning' | 'critical'
  }[]
  warnings: string[]
}

// ============================================================================
// DEFAULT CONSTANTS
// ============================================================================

/**
 * Default CPM rates by screen type (INR)
 */
export const DEFAULT_CPM_RATES: Record<ScreenType, number> = {
  cab_tablet: 15,
  bus_shelter: 20,
  bus_interior: 12,
  train_display: 18,
  metro_screen: 25,
  flight_seatback: 50,
  flight_overhead: 45,
  flight_entrance: 35,
  flight_lavatory: 30,
  airport_display: 35,
  airport_kiosk: 40,
  airport_gate: 40,
  airport_lounge: 60,
  airport_billboard: 75,
  restaurant_tv: 10,
  hotel_lobby: 15,
  hotel_room: 8,
  mall_kiosk: 22,
  mall_directory: 18,
  gym_screen: 12,
  salon_display: 10,
  office_lobby: 20,
  office_elevator: 18,
  billboard_digital: 50,
  generic_display: 10,
}

/**
 * Default guardrail configuration
 */
export const DEFAULT_GUARDRAILS: GuardrailConfig = {
  min_budget_per_listing: 500,
  min_total_budget: 1000,
  max_budget_per_listing: 100000,
  max_cost_per_visit: 50,
  max_cost_per_purchase: 200,
  min_roas_threshold: 0.5,
  min_confidence_threshold: 0.2,
  min_data_points: 10,
  max_scan_rate_per_hour: 100,
  max_visit_rate_per_scan: 5,
  max_listings_per_campaign: 50,
  max_campaign_duration_days: 90,
}

/**
 * Default scoring weights for AdOS
 */
export const DEFAULT_SCORING_WEIGHTS = {
  roas: 0.5,
  confidence: 0.2,
  volume: 0.2,
  category_match: 0.1,
}

/**
 * Default area intelligence configuration
 */
export const DEFAULT_AREA_INTELLIGENCE_CONFIG = {
  peak_hours_start: 7,
  peak_hours_end: 9,
  min_foot_traffic: 100,
  intent_aggregation_window: 30, // minutes
  ad_selection_top_n: 5,
  score_weights: {
    demographic: 0.3,
    intent: 0.35,
    time: 0.2,
    trend: 0.15,
  },
}
