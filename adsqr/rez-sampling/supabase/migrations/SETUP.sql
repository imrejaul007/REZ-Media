-- ============================================
-- AdsQr Database Setup (Run in Supabase SQL Editor)
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- CAMPAIGNS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS campaigns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  brand_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  offer JSONB NOT NULL DEFAULT '{}',
  scan_reward INTEGER DEFAULT 10,
  visit_reward INTEGER DEFAULT 25,
  purchase_reward INTEGER DEFAULT 50,
  brand_coins_reward INTEGER DEFAULT 0,
  coin_budget INTEGER DEFAULT 10000,
  coins_used INTEGER DEFAULT 0,
  max_scans INTEGER DEFAULT 1000,
  max_per_user INTEGER DEFAULT 1,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'paused', 'ended')),
  logo_url TEXT,
  banner_url TEXT,
  brand_color TEXT DEFAULT '#6366F1',
  start_date DATE,
  end_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- QR CODES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS qr_codes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
  qr_slug TEXT UNIQUE NOT NULL,
  qr_label TEXT,
  location_name TEXT,
  location_address TEXT,
  location_lat DECIMAL(10, 8),
  location_lng DECIMAL(11, 8),
  scan_count INTEGER DEFAULT 0,
  unique_scans INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  qr_image_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- SCAN EVENTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS scan_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  qr_id UUID REFERENCES qr_codes(id),
  campaign_id UUID REFERENCES campaigns(id),
  user_id UUID,
  device_fingerprint TEXT,
  ip_address TEXT,
  user_agent TEXT,
  device_type TEXT,
  city_derived TEXT,
  country_derived TEXT,
  coins_credited BOOLEAN DEFAULT false,
  coins_amount INTEGER DEFAULT 0,
  scanned_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- VISIT EVENTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS visit_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  scan_event_id UUID REFERENCES scan_events(id),
  campaign_id UUID REFERENCES campaigns(id),
  user_id UUID,
  qr_id UUID REFERENCES qr_codes(id),
  location_lat DECIMAL(10, 8),
  location_lng DECIMAL(11, 8),
  location_verified BOOLEAN DEFAULT false,
  location_radius_meters INTEGER DEFAULT 100,
  visited_at TIMESTAMPTZ DEFAULT NOW(),
  dwell_time_seconds INTEGER,
  visit_reward_credited BOOLEAN DEFAULT false,
  visit_reward_amount INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- PURCHASE EVENTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS purchase_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  scan_event_id UUID REFERENCES scan_events(id),
  visit_event_id UUID REFERENCES visit_events(id),
  campaign_id UUID REFERENCES campaigns(id),
  user_id UUID,
  purchase_amount DECIMAL(10, 2),
  purchase_reward_credited BOOLEAN DEFAULT false,
  purchase_reward_amount INTEGER DEFAULT 0,
  brand_coins_credited INTEGER DEFAULT 0,
  attributed_revenue DECIMAL(10, 2),
  merchant_id UUID,
  merchant_name TEXT,
  purchased_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- COIN TRANSACTIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS coin_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  campaign_id UUID REFERENCES campaigns(id),
  user_id UUID NOT NULL,
  amount INTEGER NOT NULL,
  coin_type TEXT DEFAULT 'rez' CHECK (coin_type IN ('rez', 'brand')),
  transaction_type TEXT DEFAULT 'credit' CHECK (transaction_type IN ('credit', 'debit')),
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_campaigns_brand ON campaigns(brand_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_status ON campaigns(status);
CREATE INDEX IF NOT EXISTS idx_qr_codes_campaign ON qr_codes(campaign_id);
CREATE INDEX IF NOT EXISTS idx_scan_events_qr ON scan_events(qr_id);
CREATE INDEX IF NOT EXISTS idx_scan_events_user ON scan_events(user_id);
CREATE INDEX IF NOT EXISTS idx_visit_events_scan ON visit_events(scan_event_id);
CREATE INDEX IF NOT EXISTS idx_visit_events_user ON visit_events(user_id);
CREATE INDEX IF NOT EXISTS idx_purchase_events_scan ON purchase_events(scan_event_id);
CREATE INDEX IF NOT EXISTS idx_purchase_events_user ON purchase_events(user_id);
CREATE INDEX IF NOT EXISTS idx_coin_transactions_user ON coin_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_coin_transactions_campaign ON coin_transactions(campaign_id);

-- ============================================
-- ATTRIBUTION FUNNEL VIEW
-- ============================================
CREATE OR REPLACE VIEW attribution_funnel AS
SELECT
  c.id as campaign_id,
  c.name as campaign_name,
  COUNT(DISTINCT se.id) as total_scans,
  COUNT(DISTINCT ve.id) as total_visits,
  COUNT(DISTINCT pe.id) as total_purchases,
  COALESCE(SUM(pe.purchase_amount), 0) as total_revenue,
  COALESCE(SUM(pe.attributed_revenue), 0) as attributed_revenue
FROM campaigns c
LEFT JOIN scan_events se ON se.campaign_id = c.id
LEFT JOIN visit_events ve ON ve.scan_event_id = se.id
LEFT JOIN purchase_events pe ON pe.scan_event_id = se.id
GROUP BY c.id, c.name;

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Increment QR scan count
CREATE OR REPLACE FUNCTION increment_scan_count(qr_id UUID)
RETURNS void AS $$
UPDATE qr_codes
SET scan_count = scan_count + 1
WHERE id = qr_id;
$$ LANGUAGE sql;

-- ============================================
-- ROW LEVEL SECURITY (Optional - Enable for production)
-- ============================================
-- ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE qr_codes ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE scan_events ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE visit_events ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE purchase_events ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE coin_transactions ENABLE ROW LEVEL SECURITY;

-- Public read for QR codes (so anyone can scan)
CREATE POLICY "Public can read QR codes" ON qr_codes
  FOR SELECT USING (true);

-- Users can only see their own campaigns
-- CREATE POLICY "Users see own campaigns" ON campaigns
--   FOR SELECT USING (auth.uid() = brand_id);

print('AdsQr database setup complete!');
