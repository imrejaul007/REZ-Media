// DOOH Screen Types

export interface ScreenContext {
  screen_id: string
  location_type: string
  demographics: string[]
  time: string
  audience?: string[]
}

export interface AdSlot {
  id: string
  campaign_id: string
  duration: number
  position: number
}

export interface Screen {
  id: string
  name: string
  location: string
  status: 'active' | 'inactive' | 'pending'
  registered_at: string
}

export interface Campaign {
  id: string
  name: string
  budget: number
  status: 'draft' | 'active' | 'paused' | 'ended'
}
