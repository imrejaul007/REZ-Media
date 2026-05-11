-- AdsQr MVP - Phase 1
-- AdsQr MVP Database Schema
-- Based on AdBazaar's QR system but simplified for campaigns

-- Campaign table
CREATE TABLE campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,

  -- Offer details (JSON for flexibility)
  offer JSONB NOT NULL DEFAULT '{}',
  /* offer structure:
    {
      headline: "20% off",
      details: "On all orders",
      terms: "Min order ₹500",
      valid_until: "2026-06-30"
    }
  */

  -- Rewards
  scan_reward INTEGER DEFAULT 10,        -- REZ coins per scan
  visit_reward INTEGER DEFAULT 25,       -- REZ coins for verified visit
  purchase_reward INTEGER DEFAULT 50,     -- REZ coins for purchase
  brand_coins_reward INTEGER DEFAULT 0,   -- Brand-specific coins

  -- Budget
  coin_budget INTEGER DEFAULT 10000,    -- Total coins allocated
  coins_used INTEGER DEFAULT 0,

  -- Settings
  max_scans INTEGER DEFAULT 1000,       -- Stop after N scans
  max_per_user INTEGER DEFAULT 1,        -- Max reward per user
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'paused', 'ended')),

  -- Branding
  logo_url TEXT,
  banner_url TEXT,
  brand_color TEXT DEFAULT '#6366F1',

  -- Dates
  start_date DATE,
  end_date DATE,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- QR Codes
CREATE TABLE qr_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,

  -- QR identity
  qr_slug TEXT UNIQUE NOT NULL,  -- URL-safe slug
  qr_label TEXT,                  -- "Table 1", "Entrance", etc.

  -- Location (optional)
  location_name TEXT,
  location_address TEXT,
  location_lat DECIMAL(10, 8),
  location_lng DECIMAL(11, 8),

  -- Stats
  scan_count INTEGER DEFAULT 0,
  unique_scans INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,

  -- Image
  qr_image_url TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Scan Events
CREATE TABLE scan_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  qr_id UUID REFERENCES qr_codes(id),
  campaign_id UUID REFERENCES campaigns(id),

  -- User (nullable for anonymous scans)
  user_id UUID,

  -- Device info
  device_fingerprint TEXT,
  ip_address TEXT,
  user_agent TEXT,
  device_type TEXT,

  -- Location from scan
  city_derived TEXT,
  country_derived TEXT,

  -- Rewards
  coins_credited BOOLEAN DEFAULT false,
  coins_amount INTEGER DEFAULT 0,

  -- Tracking
  scanned_at TIMESTAMPTZ DEFAULT NOW()
);

-- Coin Transactions
CREATE TABLE coin_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID REFERENCES campaigns(id),
  user_id UUID NOT NULL,
  amount INTEGER NOT NULL,
  coin_type TEXT DEFAULT 'rez' CHECK (coin_type IN ('rez', 'brand')),
  transaction_type TEXT DEFAULT 'credit' CHECK (transaction_type IN ('credit', 'debit')),
  reason TEXT,  -- 'scan', 'visit', 'purchase'

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_campaigns_brand ON campaigns(brand_id);
CREATE INDEX idx_campaigns_status ON campaigns(status);
CREATE INDEX idx_qr_codes_campaign ON qr_codes(campaign_id);
CREATE INDEX idx_scan_events_qr ON scan_events(qr_id);
CREATE INDEX idx_scan_events_user ON scan_events(user_id);
CREATE INDEX idx_coin_transactions_user ON coin_transactions(user_id);
CREATE INDEX idx_coin_transactions_campaign ON coin_transactions(campaign_id);
