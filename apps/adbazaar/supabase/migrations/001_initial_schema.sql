CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL,
  phone TEXT,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('vendor', 'buyer', 'admin')),
  company_name TEXT,
  gst_number TEXT,
  pan_number TEXT,
  verified BOOLEAN DEFAULT FALSE,
  city TEXT,
  avatar_url TEXT,
  rez_merchant_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE listings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  vendor_id UUID REFERENCES users(id) ON DELETE CASCADE,
  category TEXT NOT NULL CHECK (category IN ('outdoor_ooh','transit_infrastructure','property_spaces','local_business','print_broadcast','influencer','digital','unconventional')),
  subcategory TEXT NOT NULL,
  type_tag TEXT NOT NULL CHECK (type_tag IN ('offline','online','influencer','unconventional')),
  title TEXT NOT NULL,
  description TEXT,
  city TEXT NOT NULL,
  area TEXT,
  address TEXT,
  lat DECIMAL(10,8),
  lng DECIMAL(11,8),
  images TEXT[] DEFAULT '{}',
  pricing_model TEXT NOT NULL CHECK (pricing_model IN ('fixed','quote','both')),
  price DECIMAL(12,2),
  currency TEXT DEFAULT 'INR',
  duration_unit TEXT CHECK (duration_unit IN ('per_day','per_week','per_month','per_post','per_campaign','per_slot')),
  bulk_discount_pct DECIMAL(5,2) DEFAULT 0,
  seasonal_pricing BOOLEAN DEFAULT FALSE,
  availability_model TEXT NOT NULL CHECK (availability_model IN ('calendar','slot','always_on')),
  min_booking_days INTEGER DEFAULT 1,
  non_competitor_exclusions TEXT[] DEFAULT '{}',
  qr_enabled BOOLEAN DEFAULT TRUE,
  specs JSONB DEFAULT '{}',
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft','active','paused','rejected')),
  freshness_score INTEGER DEFAULT 100,
  freshness_last_updated TIMESTAMPTZ DEFAULT NOW(),
  is_featured BOOLEAN DEFAULT FALSE,
  view_count INTEGER DEFAULT 0,
  booking_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE availability (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  listing_id UUID REFERENCES listings(id) ON DELETE CASCADE,
  date DATE,
  slot_start TIME,
  slot_end TIME,
  status TEXT DEFAULT 'available' CHECK (status IN ('available','booked','blocked')),
  booking_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE bookings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  listing_id UUID REFERENCES listings(id),
  buyer_id UUID REFERENCES users(id),
  vendor_id UUID REFERENCES users(id),
  campaign_id UUID,
  start_date DATE,
  end_date DATE,
  slots JSONB DEFAULT '[]',
  amount DECIMAL(12,2) NOT NULL,
  commission_rate DECIMAL(5,2) NOT NULL,
  commission_amount DECIMAL(12,2) NOT NULL,
  vendor_payout DECIMAL(12,2) NOT NULL,
  status TEXT DEFAULT 'inquiry' CHECK (status IN ('inquiry','quoted','confirmed','paid','executing','completed','disputed','cancelled')),
  payment_id TEXT,
  payment_order_id TEXT,
  proof_of_execution TEXT[] DEFAULT '{}',
  proof_approved BOOLEAN DEFAULT FALSE,
  proof_approved_at TIMESTAMPTZ,
  creative_instructions TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE qr_codes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  campaign_id UUID,
  booking_id UUID REFERENCES bookings(id),
  listing_id UUID REFERENCES listings(id),
  brand_id UUID REFERENCES users(id),
  rez_merchant_id TEXT,
  coins_per_scan INTEGER DEFAULT 20,
  visit_bonus_coins INTEGER DEFAULT 100,
  purchase_bonus_pct DECIMAL(5,2) DEFAULT 5.0,
  qr_image_url TEXT,
  short_url TEXT UNIQUE,
  qr_slug TEXT UNIQUE NOT NULL,
  total_scans INTEGER DEFAULT 0,
  unique_scanners INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE scan_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  qr_id UUID REFERENCES qr_codes(id),
  user_id TEXT,
  device_fingerprint TEXT,
  lat DECIMAL(10,8),
  lng DECIMAL(11,8),
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  rez_app_opened BOOLEAN DEFAULT FALSE,
  rez_coins_credited BOOLEAN DEFAULT FALSE,
  coins_amount INTEGER DEFAULT 0,
  ip_address TEXT,
  user_agent TEXT
);

CREATE TABLE attribution (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  scan_event_id UUID REFERENCES scan_events(id),
  qr_id UUID REFERENCES qr_codes(id),
  booking_id UUID REFERENCES bookings(id),
  rez_visit_id TEXT,
  rez_purchase_id TEXT,
  revenue_amount DECIMAL(12,2),
  visit_timestamp TIMESTAMPTZ,
  purchase_timestamp TIMESTAMPTZ,
  attributed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE campaigns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  buyer_id UUID REFERENCES users(id),
  name TEXT NOT NULL,
  budget DECIMAL(12,2),
  total_spent DECIMAL(12,2) DEFAULT 0,
  booking_ids UUID[] DEFAULT '{}',
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft','active','completed')),
  attribution_summary JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE reviews (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  booking_id UUID REFERENCES bookings(id),
  reviewer_id UUID REFERENCES users(id),
  reviewer_role TEXT CHECK (reviewer_role IN ('buyer','vendor')),
  target_id UUID REFERENCES users(id),
  rating SMALLINT CHECK (rating BETWEEN 1 AND 5),
  on_time_rating SMALLINT,
  proof_quality_rating SMALLINT,
  communication_rating SMALLINT,
  comment TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_listings_city ON listings(city);
CREATE INDEX idx_listings_category ON listings(category);
CREATE INDEX idx_listings_status ON listings(status);
CREATE INDEX idx_listings_vendor ON listings(vendor_id);
CREATE INDEX idx_listings_location ON listings(lat, lng);
CREATE INDEX idx_availability_listing_date ON availability(listing_id, date);
CREATE INDEX idx_bookings_buyer ON bookings(buyer_id);
CREATE INDEX idx_bookings_vendor ON bookings(vendor_id);
CREATE INDEX idx_bookings_status ON bookings(status);
CREATE INDEX idx_scan_events_qr ON scan_events(qr_id);
CREATE INDEX idx_scan_events_timestamp ON scan_events(timestamp);
CREATE INDEX idx_scan_events_user ON scan_events(user_id);
CREATE INDEX idx_attribution_scan ON attribution(scan_event_id);

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE qr_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE scan_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- DOWN MIGRATION: 001_initial_schema
-- =====================================================
-- This migration creates the core adBazaar schema.
-- To rollback, run the following in reverse order:
--
-- DROP TABLE IF EXISTS reviews CASCADE;
-- DROP TABLE IF EXISTS campaigns CASCADE;
-- DROP TABLE IF EXISTS attribution CASCADE;
-- DROP TABLE IF EXISTS scan_events CASCADE;
-- DROP TABLE IF EXISTS qr_codes CASCADE;
-- DROP TABLE IF EXISTS bookings CASCADE;
-- DROP TABLE IF EXISTS availability CASCADE;
-- DROP TABLE IF EXISTS listings CASCADE;
-- DROP TABLE IF EXISTS users CASCADE;
-- DROP EXTENSION IF EXISTS "uuid-ossp";
