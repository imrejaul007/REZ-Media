-- REZ Try Integration for ADSQR
-- Free Samples and Free Trials

-- Free Samples Table
CREATE TABLE IF NOT EXISTS free_samples (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID REFERENCES campaigns(id),
  merchant_id TEXT,
  merchant_name TEXT,
  name TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  stock INTEGER DEFAULT 100,
  coin_cost INTEGER DEFAULT 0,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Sample Requests Table
CREATE TABLE IF NOT EXISTS sample_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  sample_id UUID REFERENCES free_samples(id),
  campaign_id UUID REFERENCES campaigns(id),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'shipped', 'delivered', 'cancelled')),
  shipping_address TEXT,
  phone TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Free Trials Table
CREATE TABLE IF NOT EXISTS free_trials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID REFERENCES campaigns(id),
  merchant_id TEXT,
  merchant_name TEXT,
  name TEXT NOT NULL,
  description TEXT,
  duration_minutes INTEGER DEFAULT 60,
  locations TEXT[] DEFAULT '{}',
  coin_cost INTEGER DEFAULT 0,
  slots_available INTEGER DEFAULT 10,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Trial Bookings Table
CREATE TABLE IF NOT EXISTS trial_bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  trial_id UUID REFERENCES free_trials(id),
  campaign_id UUID REFERENCES campaigns(id),
  status TEXT DEFAULT 'confirmed' CHECK (status IN ('pending', 'confirmed', 'completed', 'cancelled')),
  slot_time TIMESTAMPTZ NOT NULL,
  slot_location TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert demo data
INSERT INTO free_samples (name, description, stock, merchant_name) VALUES
('Coffee Sample Pack', 'Try our premium coffee blend', 50, 'Cafe REZ'),
('Skincare Mini Set', 'Full skincare routine samples', 30, 'Beauty Co'),
('Snack Box', 'Assorted healthy snacks', 100, 'FoodieBox');

INSERT INTO free_trials (name, description, duration_minutes, locations, slots_available, merchant_name) VALUES
('Yoga Class Trial', 'One hour yoga session', 60, ARRAY['Bangalore - MG Road', 'Bangalore - Koramangala'], 20, 'Zen Studio'),
('Gym Trial', 'Full gym access for a day', 480, ARRAY['Bangalore - Whitefield'], 10, 'FitZone'),
('Dance Class Trial', 'One dance class', 60, ARRAY['Bangalore - Indiranagar', 'Bangalore - HSR'], 15, 'Dance Academy');
