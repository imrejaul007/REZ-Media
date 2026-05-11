/**
 * Creator QR - Refined Types
 * 4 locked listing types: Service, Consulting, Booking, Promotion, Product
 */

// Creator Profile
export interface Creator {
  id: string
  name: string
  username: string
  bio: string
  avatar: string
  category: CreatorCategory
  location: string
  verified: boolean
  
  // Trust Layer
  completion_rate: number
  response_time_hours: number
  rating: number
  review_count: number
  dispute_count: number
  member_since: string
}

export type CreatorCategory = 'fitness' | 'consulting' | 'freelance' | 'beauty' | 'events' | 'coaching' | 'education' | 'other'

export interface SocialLink {
  platform: 'instagram' | 'youtube' | 'twitter' | 'linkedin' | 'website'
  url: string
  followers?: number
}

// 4 LOCKED LISTING TYPES
export type ListingType = 'service' | 'consulting' | 'booking' | 'promotion' | 'product'
export type DeliveryType = 'instant' | 'scheduled' | 'manual'

export interface CreatorListing {
  id: string
  creator_id: string
  type: ListingType
  title: string
  description: string
  price: number
  delivery: DeliveryType
  slots?: TimeSlot[]
  requirements?: string[]
  file_url?: string
  active: boolean
  created_at: string
}

export interface TimeSlot {
  id: string
  day: string
  times: string[]
}

// REQUEST FLOW (Critical for Promotions)
export type RequestStatus = 'pending' | 'accepted' | 'submitted' | 'revision_requested' | 'completed' | 'disputed' | 'cancelled'

export interface Request {
  id: string
  listing_id: string
  creator_id: string
  buyer_id: string
  status: RequestStatus
  buyer_requirements: string
  delivered_content_url?: string
  delivery_notes?: string
  revision_notes?: string[]
  amount: number
  paid: boolean
  created_at: string
  updated_at: string
}

// DELIVERY SYSTEM
export type DeliveryType2 = 'file' | 'link' | 'chat' | 'none'

export interface Delivery {
  id: string
  request_id: string
  type: DeliveryType2
  content?: string
  file_url?: string
  delivered_at?: string
  confirmed_by_buyer: boolean
}

// DISPUTE SYSTEM
export type DisputeStatus = 'open' | 'resolved_buyer' | 'resolved_creator' | 'escalated'

export interface Dispute {
  id: string
  request_id: string
  raised_by: 'buyer' | 'creator'
  reason: string
  status: DisputeStatus
  resolution?: string
  created_at: string
  resolved_at?: string
}

// BOOKING
export type BookingStatus = 'pending' | 'confirmed' | 'completed' | 'cancelled'

export interface Booking {
  id: string
  listing_id: string
  buyer_id: string
  date: string
  time: string
  amount: number
  status: BookingStatus
  notes?: string
  created_at: string
}

// REVIEW
export interface Review {
  id: string
  creator_id: string
  buyer_id: string
  rating: number
  comment: string
  listing_type: ListingType
  created_at: string
}
