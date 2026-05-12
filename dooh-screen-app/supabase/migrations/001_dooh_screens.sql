-- DOOH Screens Database Schema

-- Screens Registry
CREATE TABLE IF NOT EXISTS dooh_screens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN (
    'cab_tablet', 'bus_shelter', 'bus_interior', 'train_display', 'metro_screen',
    'flight_seatback', 'flight_overhead', 'flight_entrance', 'flight_lavatory',
    'airport_display', 'airport_kiosk', 'airport_gate', 'airport_lounge', 'airport_billboard',
    'restaurant_tv', 'hotel_lobby', 'hotel_room',
    'mall_kiosk', 'mall_directory', 'gym_screen', 'salon_display',
    'office_lobby', 'office_elevator',
    'generic_display'
  )),
  location JSONB DEFAULT '{"city": "Unknown"}',
  owner_id TEXT NOT NULL,
  owner_email TEXT NOT NULL,
  owner_phone TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'offline', 'maintenance')),
  registered_at TIMESTAMPTZ DEFAULT NOW(),
  last_heartbeat TIMESTAMPTZ,
  playlist_version INTEGER DEFAULT 0,
  total_impressions INTEGER DEFAULT 0,
  total_scans INTEGER DEFAULT 0,
  earnings_balance DECIMAL(10,2) DEFAULT 0,
  earnings_paid DECIMAL(10,2) DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Heartbeats Log
CREATE TABLE IF NOT EXISTS dooh_heartbeats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  screen_id UUID REFERENCES dooh_screens(id) ON DELETE CASCADE,
  status TEXT,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  playlist_version INTEGER,
  is_online BOOLEAN DEFAULT true
);

-- Impressions Log
CREATE TABLE IF NOT EXISTS dooh_impressions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  screen_id UUID REFERENCES dooh_screens(id) ON DELETE CASCADE,
  campaign_id UUID REFERENCES campaigns(id),
  creative_id UUID,
  displayed_at TIMESTAMPTZ DEFAULT NOW(),
  duration_seconds INTEGER DEFAULT 15
);

-- Revenue Ledger
CREATE TABLE IF NOT EXISTS dooh_revenue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  screen_id UUID REFERENCES dooh_screens(id) ON DELETE CASCADE,
  campaign_id UUID REFERENCES campaigns(id),
  impressions INTEGER NOT NULL,
  rate_cpm DECIMAL(10,2) NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Payouts
CREATE TABLE IF NOT EXISTS dooh_payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  screen_id UUID REFERENCES dooh_screens(id) ON DELETE CASCADE,
  amount DECIMAL(10,2) NOT NULL,
  method TEXT DEFAULT 'bank_transfer',
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ
);

-- Functions
CREATE OR REPLACE FUNCTION increment_impression(screen_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE dooh_screens
  SET total_impressions = total_impressions + 1, updated_at = NOW()
  WHERE id = screen_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION increment_scan(screen_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE dooh_screens
  SET total_scans = total_scans + 1, updated_at = NOW()
  WHERE id = screen_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_screens_owner ON dooh_screens(owner_id);
CREATE INDEX IF NOT EXISTS idx_screens_type ON dooh_screens(type);
CREATE INDEX IF NOT EXISTS idx_screens_status ON dooh_screens(status);
CREATE INDEX IF NOT EXISTS idx_heartbeats_screen ON dooh_heartbeats(screen_id);
CREATE INDEX IF NOT EXISTS idx_impressions_screen ON dooh_impressions(screen_id);
CREATE INDEX IF NOT EXISTS idx_impressions_campaign ON dooh_impressions(campaign_id);
CREATE INDEX IF NOT EXISTS idx_revenue_screen ON dooh_revenue(screen_id);

-- RLS
ALTER TABLE dooh_screens ENABLE ROW LEVEL SECURITY;
ALTER TABLE dooh_heartbeats ENABLE ROW LEVEL SECURITY;
ALTER TABLE dooh_impressions ENABLE ROW LEVEL SECURITY;
ALTER TABLE dooh_revenue ENABLE ROW LEVEL SECURITY;
ALTER TABLE dooh_payouts ENABLE ROW LEVEL SECURITY;

-- Owners can access their screens
CREATE POLICY "Owners can view own screens" ON dooh_screens
  FOR SELECT USING (auth.uid()::text = owner_id);

CREATE POLICY "Service can insert screens" ON dooh_screens
  FOR INSERT WITH CHECK (true);
