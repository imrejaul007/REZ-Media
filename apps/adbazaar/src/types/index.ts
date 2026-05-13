export enum UserRole {
  Vendor = 'vendor',
  Buyer = 'buyer',
  Admin = 'admin',
}

export enum ListingCategory {
  OutdoorOOH = 'outdoor_ooh',
  TransitInfrastructure = 'transit_infrastructure',
  PropertySpaces = 'property_spaces',
  LocalBusiness = 'local_business',
  PrintBroadcast = 'print_broadcast',
  Influencer = 'influencer',
  Digital = 'digital',
  Unconventional = 'unconventional',
}

export enum TypeTag {
  Offline = 'offline',
  Online = 'online',
  Influencer = 'influencer',
  Unconventional = 'unconventional',
}

export enum PricingModel {
  Fixed = 'fixed',
  Quote = 'quote',
  Both = 'both',
}

export enum AvailabilityModel {
  Calendar = 'calendar',
  Slot = 'slot',
  AlwaysOn = 'always_on',
}

export enum BookingStatus {
  Inquiry = 'inquiry',
  Quoted = 'quoted',
  Confirmed = 'confirmed',
  Paid = 'paid',
  Executing = 'executing',
  Completed = 'completed',
  Disputed = 'disputed',
  Cancelled = 'cancelled',
}

export enum DurationUnit {
  PerDay = 'per_day',
  PerWeek = 'per_week',
  PerMonth = 'per_month',
  PerPost = 'per_post',
  PerCampaign = 'per_campaign',
  PerSlot = 'per_slot',
}

export enum AvailabilityStatus {
  Available = 'available',
  Booked = 'booked',
  Blocked = 'blocked',
}

export enum CampaignStatus {
  Draft = 'draft',
  Active = 'active',
  Completed = 'completed',
}

export type ListingSpecs = Record<string, unknown> & {
  dimensions?: string
  material?: string
  illuminated?: boolean
  facing?: string
  traffic_count?: number
  followers?: number
  engagement_rate?: number
  platform?: string
  format?: string
  resolution?: string
}

export interface User {
  id: string
  email: string
  phone?: string | null
  name: string
  role: UserRole
  company_name?: string | null
  gst_number?: string | null
  pan_number?: string | null
  verified: boolean
  city?: string | null
  avatar_url?: string | null
  rez_merchant_id?: string | null
  upi_id?: string | null
  bank_account_name?: string | null
  bank_account_number?: string | null
  bank_ifsc?: string | null
  // AB-SEC-KYC-01: KYC status tracking
  kyc_status?: 'pending' | 'submitted' | 'verified' | 'rejected'
  // AB-SEC-DOC-01: Document verification status
  gst_verified?: boolean
  pan_verified?: boolean
  gst_name?: string | null
  pan_name?: string | null
  // AB-SEC-2FA-01: Two-factor authentication
  totp_enabled?: boolean
  totp_secret?: string | null // Encrypted TOTP secret
  created_at: string
  updated_at: string
}

export interface Listing {
  id: string
  vendor_id: string
  category: ListingCategory
  subcategory: string
  type_tag: TypeTag
  title: string
  description?: string | null
  city: string
  area?: string | null
  address?: string | null
  lat?: number | null
  lng?: number | null
  images: string[]
  pricing_model: PricingModel
  price?: number | null
  currency: string
  duration_unit?: DurationUnit | null
  bulk_discount_pct: number
  seasonal_pricing: boolean
  availability_model: AvailabilityModel
  min_booking_days: number
  non_competitor_exclusions: string[]
  qr_enabled: boolean
  specs: ListingSpecs
  status: 'draft' | 'active' | 'paused' | 'rejected' | 'archived' // AB2-M9 FIX: 'archived' used in DELETE handler
  rejection_reason?: string | null
  freshness_score: number
  freshness_last_updated: string
  is_featured: boolean
  view_count: number
  booking_count: number
  created_at: string
  updated_at: string
}

export interface Availability {
  id: string
  listing_id: string
  date?: string | null
  slot_start?: string | null
  slot_end?: string | null
  status: AvailabilityStatus
  booking_id?: string | null
  created_at: string
}

export interface Booking {
  id: string
  listing_id: string
  buyer_id: string
  vendor_id: string
  campaign_id?: string | null
  start_date?: string | null
  end_date?: string | null
  slots: Record<string, unknown>[]
  amount: number
  commission_rate: number
  commission_amount: number
  vendor_payout: number
  status: BookingStatus
  payment_id?: string | null
  payment_order_id?: string | null
  proof_of_execution: string[]
  proof_approved: boolean
  proof_approved_at?: string | null
  payout_id?: string | null
  payout_initiated_at?: string | null
  creative_instructions?: string | null
  notes?: string | null
  created_at: string
  updated_at: string
}

export interface QRCode {
  id: string
  campaign_id?: string | null
  booking_id?: string | null
  listing_id?: string | null
  brand_id?: string | null
  rez_merchant_id?: string | null
  coins_per_scan: number
  visit_bonus_coins: number
  purchase_bonus_pct: number
  qr_image_url?: string | null
  short_url?: string | null
  qr_slug: string
  total_scans: number
  unique_scanners: number
  is_active: boolean
  expires_at?: string | null
  created_at: string
}

export interface ScanEvent {
  id: string
  qr_id: string
  user_id?: string | null
  device_fingerprint?: string | null
  lat?: number | null
  lng?: number | null
  timestamp: string
  rez_app_opened: boolean
  rez_coins_credited: boolean
  coins_amount: number
  ip_address?: string | null
  user_agent?: string | null
  device_type?: string | null // AB2-M10 FIX: align with DB schema
  city_derived?: string | null // AB2-M10 FIX: align with DB schema
  country_derived?: string | null // AB2-M10 FIX: align with DB schema
}

export interface Attribution {
  id: string
  scan_event_id?: string | null
  qr_id?: string | null
  booking_id?: string | null
  rez_visit_id?: string | null
  rez_purchase_id?: string | null
  revenue_amount?: number | null
  visit_timestamp?: string | null
  purchase_timestamp?: string | null
  attributed_at: string
}

export interface Campaign {
  id: string
  buyer_id: string
  name: string
  budget?: number | null
  total_spent: number
  booking_ids: string[]
  status: CampaignStatus
  attribution_summary: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface Review {
  id: string
  booking_id?: string | null
  reviewer_id?: string | null
  reviewer_role?: 'buyer' | 'vendor' | null
  target_id?: string | null
  rating?: number | null
  on_time_rating?: number | null
  proof_quality_rating?: number | null
  communication_rating?: number | null
  comment?: string | null
  created_at: string
}

export interface Notification {
  id: string
  user_id: string
  type: string
  title: string
  body: string // AB2-M17 FIX: Notification interface matching notifications table schema
  link?: string | null
  read_at?: string | null
  created_at: string
}

// ---------------------------------------------------------------------------
// DLQ Entry (Dead Letter Queue)
// ---------------------------------------------------------------------------
export interface DLQEntry {
  id: string
  event: string
  payload: Record<string, unknown>
  error: string
  attempts: number
  created_at: string
}

// ---------------------------------------------------------------------------
// Budget Alert
// ---------------------------------------------------------------------------
export interface BudgetAlert {
  id: string
  campaign_id: string
  threshold: number
  alert_sent_at: string
}
