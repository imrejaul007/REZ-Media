/**
 * DOOH - Digital Out of Home Advertising Network
 * Screen management, ad delivery, and playlist generation
 */

// ============================================================================
// SCREEN TYPES
// ============================================================================

/**
 * Screen types in the network
 */
export type ScreenType =
  | 'cab_tablet'
  | 'restaurant_tv'
  | 'mall_kiosk'
  | 'gym_screen'
  | 'salon_display'
  | 'hotel_lobby'
  | 'airport_display'
  | 'office_lobby'
  | 'bus_shelter'
  | 'billboard_digital'
  | 'generic_display'

/**
 * Screen status
 */
export type ScreenStatus = 'active' | 'inactive' | 'offline' | 'maintenance'

/**
 * Screen location types
 */
export type LocationType =
  | 'cab'
  | 'restaurant'
  | 'mall'
  | 'gym'
  | 'salon'
  | 'hotel'
  | 'airport'
  | 'office'
  | 'street'
  | 'other'

/**
 * Geographic context
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
 * Screen metadata
 */
export interface Screen {
  id: string
  name: string
  type: ScreenType
  location_type: LocationType

  // Location
  location: ScreenLocation

  // Hardware info
  hardware?: {
    model?: string
    os?: string
    resolution?: string
    screen_size?: number // inches
  }

  // Network
  network_id?: string
  ip_address?: string
  mac_address?: string

  // Owner/partner
  owner_id: string
  owner_type: 'owned' | 'partner' | 'external'

  // Status
  status: ScreenStatus
  last_seen?: Date
  last_sync?: Date

  // Schedule
  operating_hours?: {
    open: string // "09:00"
    close: string // "22:00"
    timezone: string
  }

  // Audience info
  audience_profile?: AudienceProfile

  // Cost
  cpm: number // Cost per 1000 impressions
  slot_pricing?: SlotPricing[]

  // Timestamps
  created_at: Date
  updated_at: Date
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

export interface AudienceSegment {
  type: 'office_workers' | 'students' | 'families' | 'tourists' | 'fitness' | 'foodies' | 'shoppers' | 'general'
  percentage: number // 0-100
}

export interface TimeSlot {
  start: string // "09:00"
  end: string // "12:00"
  day_type: 'weekday' | 'weekend' | 'all'
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

// ============================================================================
// CAMPAIGN TYPES
// ============================================================================

/**
 * DOOH Campaign
 */
export interface DOOHCampaign {
  id: string
  name: string
  brand_id: string

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
  screen_filter: ScreenFilter

  // Status
  status: 'draft' | 'active' | 'paused' | 'completed' | 'budget_exhausted'

  // Metrics
  metrics: CampaignMetrics

  created_at: Date
  updated_at: Date
}

/**
 * Creative asset
 */
export interface Creative {
  id: string
  type: 'image' | 'video' | 'html5'
  url: string
  duration: number // seconds
  thumbnail?: string
  name: string
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

  // Audience
  audience_segments?: AudienceSegment['type'][]

  // Time
  day_parts?: {
    morning?: boolean // 6-12
    afternoon?: boolean // 12-17
    evening?: boolean // 17-22
  }
  weekdays_only?: boolean

  // Context signals
  context_signals?: ContextSignal[]
}

/**
 * Context signals from ReZ Mind
 */
export interface ContextSignal {
  signal_type: 'weather' | 'time' | 'location_density' | 'event' | 'category_intent'
  condition: string
  action: 'boost' | 'reduce' | 'show' | 'hide'
  campaign_id?: string // boost specific campaign
}

/**
 * Screen filter for campaign
 */
export interface ScreenFilter {
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
  cpc_actual: number // cost per click (scan)
  cpu_actual: number // cost per visit
  cpp_actual: number // cost per purchase

  last_updated: Date
}

// ============================================================================
// PLAYLIST TYPES
// ============================================================================

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
 * Playlist generation request
 */
export interface PlaylistRequest {
  screen_id: string
  date: Date
  duration: number // total playlist duration in seconds
  time_slots: TimeSlotConfig[]
  context_signals?: ContextSignal[]
}

export interface TimeSlotConfig {
  start: string
  end: string
  slot_type: 'prime' | 'standard' | 'off_peak'
}

// ============================================================================
// DELIVERY TYPES
// ============================================================================

/**
 * Ad delivery request
 */
export interface DeliveryRequest {
  screen_id: string
  available_slots: number
  context: DeliveryContext
}

export interface DeliveryContext {
  time: string
  day_type: 'weekday' | 'weekend'
  weather?: 'sunny' | 'cloudy' | 'rainy'
  nearby_events?: string[]
  audience: AudienceProfile
}

export interface DeliveryResponse {
  screen_id: string
  slots: DeliverySlot[]
  generated_at: Date
}

export interface DeliverySlot {
  position: number
  campaign_id: string
  creative: Creative
  duration: number
  priority: number
  reason: string // why this ad was chosen
}

// ============================================================================
// REPORTING TYPES
// ============================================================================

/**
 * Impression event
 */
export interface ImpressionEvent {
  screen_id: string
  campaign_id: string
  creative_id: string
  timestamp: Date
  duration_played: number
  user_id?: string // if QR scanned
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
 * Screen content update
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
// CONTEXT ENGINE TYPES (ReZ Mind Integration)
// ============================================================================

/**
 * Context signal from ReZ Mind
 */
export interface ReZMindContext {
  location_cluster: string
  time_pattern: string
  category_intent: string[]
  spending_level: 'low' | 'medium' | 'high'
  density: 'sparse' | 'moderate' | 'dense'
  events: string[]
}

/**
 * Contextual ad decision
 */
export interface ContextualDecision {
  campaign_id: string
  relevance_score: number
  reasons: string[]
  context_match: string
}

// ============================================================================
// REVENUE TYPES
// ============================================================================

/**
 * Revenue model for DOOH
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
 * Screen owner payout
 */
export interface PayoutRecord {
  screen_id: string
  period_start: Date
  period_end: Date
  impressions: number
  revenue: number
  owner_share: number
  platform_share: number
  status: 'pending' | 'processed' | 'paid'
}
