-- Migration: 004_free_samples
-- Date: 2026-05-03
-- Purpose: Add free samples management tables

-- Stores table (for sample redemption locations)
CREATE TABLE IF NOT EXISTS stores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID NOT NULL,
  name TEXT NOT NULL,
  address TEXT,
  city TEXT,
  state TEXT,
  country TEXT DEFAULT 'India',
  postal_code TEXT,

  -- Location
  location_lat DECIMAL(10, 8),
  location_lng DECIMAL(11, 8),

  -- Contact
  phone TEXT,
  email TEXT,
  operating_hours JSONB DEFAULT '{}',

  -- Status
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'temporarily_closed')),

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Free Samples table
CREATE TABLE IF NOT EXISTS free_samples (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,

  -- Sample details
  name TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  terms TEXT,

  -- Availability
  quantity INTEGER DEFAULT 0,
  quantity_remaining INTEGER DEFAULT 0,
  coin_cost INTEGER DEFAULT 0,
  max_per_user INTEGER DEFAULT 1,

  -- Validity
  start_date DATE,
  end_date DATE,
  expiry_date TIMESTAMPTZ,

  -- Status
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'out_of_stock', 'expired')),

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Sample Requests table
CREATE TABLE IF NOT EXISTS sample_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sample_id UUID REFERENCES free_samples(id) ON DELETE CASCADE,
  campaign_id UUID REFERENCES campaigns(id),
  user_id UUID NOT NULL,
  store_id UUID REFERENCES stores(id),

  -- Request details
  preferred_date DATE,
  contact_email TEXT,
  notes TEXT,

  -- Redemption
  redemption_code TEXT UNIQUE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'claimed', 'expired', 'cancelled')),

  -- Claim info
  claimed_by TEXT,
  claimed_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  cancellation_reason TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_stores_brand ON stores(brand_id);
CREATE INDEX IF NOT EXISTS idx_stores_location ON stores(location_lat, location_lng);
CREATE INDEX IF NOT EXISTS idx_free_samples_campaign ON free_samples(campaign_id);
CREATE INDEX IF NOT EXISTS idx_free_samples_status ON free_samples(status);
CREATE INDEX IF NOT EXISTS idx_sample_requests_sample ON sample_requests(sample_id);
CREATE INDEX IF NOT EXISTS idx_sample_requests_user ON sample_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_sample_requests_code ON sample_requests(redemption_code);
CREATE INDEX IF NOT EXISTS idx_sample_requests_status ON sample_requests(status);
