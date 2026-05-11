-- Boarding Pass QR + Flight Ads Tables

-- Boarding Pass QR Codes
CREATE TABLE IF NOT EXISTS boarding_pass_qrs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID REFERENCES campaigns(id),
  flight_number TEXT NOT NULL,
  airline TEXT NOT NULL,
  origin TEXT NOT NULL,
  destination TEXT NOT NULL,
  departure_date DATE NOT NULL,
  cabin_class TEXT DEFAULT 'economy' CHECK (cabin_class IN ('economy', 'business', 'first')),
  seat_range TEXT,
  pnr TEXT,
  passenger_name TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Boarding Pass Rewards
CREATE TABLE IF NOT EXISTS boarding_pass_rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  boarding_pass_id UUID REFERENCES boarding_pass_qrs(id),
  offer_type TEXT NOT NULL CHECK (offer_type IN ('discount', 'lounge_access', 'priority_boarding', 'miles', 'cashback')),
  offer_value TEXT NOT NULL,
  offer_description TEXT,
  qr_code TEXT UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ,
  redeemed BOOLEAN DEFAULT false,
  redeemed_at TIMESTAMPTZ,
  redeemed_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Airline Partners
CREATE TABLE IF NOT EXISTS airline_partners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  airline_code TEXT UNIQUE NOT NULL,
  airline_name TEXT NOT NULL,
  logo_url TEXT,
  api_key TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Flight Routes
CREATE TABLE IF NOT EXISTS flight_routes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  airline_code TEXT NOT NULL,
  origin TEXT NOT NULL,
  destination TEXT NOT NULL,
  base_price NUMERIC(10,2),
  is_popular BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert demo airline partners
INSERT INTO airline_partners (airline_code, airline_name) VALUES
('AI', 'Air India'),
('6E', 'IndiGo'),
('UK', 'Vistara'),
('SG', 'SpiceJet'),
('G8', 'GoAir')
ON CONFLICT (airline_code) DO NOTHING;

-- Insert popular routes
INSERT INTO flight_routes (airline_code, origin, destination, base_price, is_popular) VALUES
('AI', 'DEL', 'BLR', 8500.00, true),
('AI', 'BOM', 'DEL', 9200.00, true),
('6E', 'DEL', 'MAA', 6500.00, true),
('UK', 'BLR', 'BOM', 7800.00, true),
('G8', 'CCU', 'BOM', 7200.00, false)
ON CONFLICT DO NOTHING;
