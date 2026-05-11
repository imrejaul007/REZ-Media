/**
 * Creator/Influencer System Types
 */

// Creator Profile
export interface Creator {
  id: string
  user_id: string
  display_name: string
  username: string
  bio: string
  avatar_url?: string
  cover_url?: string
  location?: string
  website?: string

  // Stats
  followers: number
  following: number
  posts: number
  engagement_rate: number

  // Social accounts
  socials: SocialAccount[]

  // Business
  rates: CreatorRates
  niche: string[]
  verified: boolean

  // Status
  status: 'active' | 'inactive' | 'suspended'
  created_at: string
  updated_at: string
}

export interface SocialAccount {
  platform: 'instagram' | 'youtube' | 'tiktok' | 'twitter' | 'linkedin' | 'facebook' | 'snapchat'
  username: string
  url: string
  followers: number
  verified: boolean
  connected: boolean
  access_token?: string
  refresh_token?: string
}

export interface CreatorRates {
  sponsored_post: number      // Per post
  sponsored_story: number    // Per story (24hr)
  sponsored_reel: number     // Per reel/video
  sponsored_story_bundle: number // Bundle (3 stories)
  monthly_retainer: number  // Monthly
  per_scan: number         // Per QR scan
  per_conversion: number    // Per purchase
}

export interface CreatorCategory {
  id: string
  name: string
  slug: string
  icon: string
  count: number
}

// Campaign Types
export interface CreatorCampaign {
  id: string
  brand_id: string
  brand_name: string
  brand_logo?: string

  title: string
  description: string
  brief: string

  requirements: CampaignRequirement[]

  budget: number
  payment_type: 'fixed' | 'per_post' | 'per_scan' | 'revenue_share'

  deadline?: string
  start_date?: string
  end_date?: string

  status: 'draft' | 'open' | 'in_progress' | 'completed' | 'cancelled'
  created_at: string
}

export interface CampaignRequirement {
  platform: SocialAccount['platform']
  content_type: 'post' | 'story' | 'reel' | 'video' | 'live'
  mentions: string[]
  hashtags: string[]
  minimum_followers: number
  deadline_hours: number
}

// Applications
export interface CreatorApplication {
  id: string
  campaign_id: string
  creator_id: string

  proposed_rate: number
  pitch: string
  content_ideas: string[]

  status: 'pending' | 'shortlisted' | 'accepted' | 'rejected' | 'completed'

  submitted_at: string
  responded_at?: string
}

// Content Deliverables
export interface ContentDeliverable {
  id: string
  application_id: string
  creator_id: string
  campaign_id: string

  platform: SocialAccount['platform']
  content_type: 'post' | 'story' | 'reel' | 'video'

  content_url?: string        // Uploaded content
  content_caption?: string
  content_hashtags?: string[]

  proof_url?: string         // Screenshot proof
  proof_verified: boolean

  status: 'draft' | 'submitted' | 'under_review' | 'approved' | 'revision_requested'

  created_at: string
  submitted_at?: string
  approved_at?: string
}

// Earnings
export interface CreatorEarnings {
  id: string
  creator_id: string

  source: 'sponsored_post' | 'affiliate' | 'dooh_scan' | 'retainer' | 'bonus'
  campaign_id?: string

  amount: number
  status: 'pending' | 'approved' | 'paid'

  created_at: string
  paid_at?: string
}

// DOOH Integration
export interface CreatorDOOHIntegration {
  creator_id: string
  content_id: string

  dooh_campaign_id: string
  dooh_screen_type: string[]

  total_scans: number
  total_visits: number
  total_conversions: number

  earnings: number
}

// Verification
export interface CreatorVerification {
  creator_id: string
  platform: SocialAccount['platform']

  verified_posts: number
  engagement_rate: number

  documents: string[]  // ID proofs

  status: 'pending' | 'verified' | 'rejected'
  verified_at?: string
}
