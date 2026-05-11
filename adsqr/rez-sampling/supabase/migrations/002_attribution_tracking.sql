-- Migration: 002_attribution_tracking
-- Date: 2026-05-01
-- Purpose: Add visit tracking, GPS verification, and purchase attribution

-- Visit Events table
CREATE TABLE IF NOT EXISTS visit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_event_id UUID REFERENCES scan_events(id),
  campaign_id UUID REFERENCES campaigns(id),
  user_id UUID,
  qr_id UUID REFERENCES qr_codes(id),

  -- Location verification
  location_lat DECIMAL(10, 8),
  location_lng DECIMAL(11, 8),
  location_verified BOOLEAN DEFAULT false,
  location_radius_meters INTEGER DEFAULT 100,

  -- Visit details
  visited_at TIMESTAMPTZ DEFAULT NOW(),
  dwell_time_seconds INTEGER,

  -- Rewards
  visit_reward_credited BOOLEAN DEFAULT false,
  visit_reward_amount INTEGER DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Purchase Events table
CREATE TABLE IF NOT EXISTS purchase_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_event_id UUID REFERENCES scan_events(id),
  visit_event_id UUID REFERENCES visit_events(id),
  campaign_id UUID REFERENCES campaigns(id),
  user_id UUID,

  -- Purchase details
  purchase_amount DECIMAL(10, 2),
  purchase_reward_credited BOOLEAN DEFAULT false,
  purchase_reward_amount INTEGER DEFAULT 0,
  brand_coins_credited INTEGER DEFAULT 0,

  -- Attribution
  attribution_source TEXT, -- 'qr', 'visit', 'loyalty'
  attributed_revenue DECIMAL(10, 2),

  -- Metadata
  merchant_id UUID,
  merchant_name TEXT,
  pos_location TEXT,

  purchased_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Attribution Funnel View
CREATE OR REPLACE VIEW attribution_funnel AS
SELECT
  c.id as campaign_id,
  c.name as campaign_name,
  COUNT(DISTINCT se.id) as total_scans,
  COUNT(DISTINCT ve.id) as total_visits,
  COUNT(DISTINCT pe.id) as total_purchases,
  ROUND(
    CASE
      WHEN COUNT(DISTINCT se.id) > 0
      THEN COUNT(DISTINCT ve.id)::DECIMAL / COUNT(DISTINCT se.id) * 100
      ELSE 0
    END, 2
  ) as scan_to_visit_rate,
  ROUND(
    CASE
      WHEN COUNT(DISTINCT ve.id) > 0
      THEN COUNT(DISTINCT pe.id)::DECIMAL / COUNT(DISTINCT ve.id) * 100
      ELSE 0
    END, 2
  ) as visit_to_purchase_rate,
  COALESCE(SUM(pe.purchase_amount), 0) as total_revenue,
  COALESCE(SUM(pe.attributed_revenue), 0) as attributed_revenue
FROM campaigns c
LEFT JOIN scan_events se ON se.campaign_id = c.id
LEFT JOIN visit_events ve ON ve.scan_event_id = se.id
LEFT JOIN purchase_events pe ON pe.scan_event_id = se.id
GROUP BY c.id, c.name;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_visit_events_scan ON visit_events(scan_event_id);
CREATE INDEX IF NOT EXISTS idx_visit_events_user ON visit_events(user_id);
CREATE INDEX IF NOT EXISTS idx_visit_events_verified ON visit_events(location_verified);
CREATE INDEX IF NOT EXISTS idx_purchase_events_scan ON purchase_events(scan_event_id);
CREATE INDEX IF NOT EXISTS idx_purchase_events_user ON purchase_events(user_id);
CREATE INDEX IF NOT EXISTS idx_purchase_events_campaign ON purchase_events(campaign_id);

-- Function to credit visit reward
CREATE OR REPLACE FUNCTION credit_visit_reward(
  p_scan_event_id UUID,
  p_user_id UUID,
  p_campaign_id UUID,
  p_lat DECIMAL,
  p_lng DECIMAL
) RETURNS UUID AS $$
DECLARE
  v_visit_id UUID;
  v_reward INTEGER;
  v_qr_lat DECIMAL;
  v_qr_lng DECIMAL;
  v_distance INTEGER;
  v_verified BOOLEAN;
BEGIN
  -- Get QR location
  SELECT location_lat, location_lng INTO v_qr_lat, v_qr_lng
  FROM qr_codes q
  JOIN scan_events se ON se.qr_id = q.id
  WHERE se.id = p_scan_event_id;

  -- Calculate distance (simplified - use PostGIS for production)
  -- For now, just verify coordinates are present
  v_verified := p_lat IS NOT NULL AND p_lng IS NOT NULL;

  -- Get reward amount
  SELECT visit_reward INTO v_reward
  FROM campaigns WHERE id = p_campaign_id;

  -- Create visit event
  INSERT INTO visit_events (
    scan_event_id, campaign_id, user_id, qr_id,
    location_lat, location_lng, location_verified,
    visit_reward_amount, visit_reward_credited
  ) VALUES (
    p_scan_event_id, p_campaign_id, p_user_id,
    (SELECT qr_id FROM scan_events WHERE id = p_scan_event_id),
    p_lat, p_lng, v_verified,
    CASE WHEN v_verified THEN v_reward ELSE 0 END,
    v_verified
  ) RETURNING id INTO v_visit_id;

  -- Credit reward if verified
  IF v_verified AND p_user_id IS NOT NULL THEN
    INSERT INTO coin_transactions (campaign_id, user_id, amount, coin_type, reason)
    VALUES (p_campaign_id, p_user_id, v_reward, 'rez', 'visit');
  END IF;

  RETURN v_visit_id;
END;
$$ LANGUAGE plpgsql;

-- Function to credit purchase reward
CREATE OR REPLACE FUNCTION credit_purchase_reward(
  p_scan_event_id UUID,
  p_user_id UUID,
  p_campaign_id UUID,
  p_amount DECIMAL
) RETURNS UUID AS $$
DECLARE
  v_purchase_id UUID;
  v_rez_reward INTEGER;
  v_brand_coins INTEGER;
  v_attribution DECIMAL;
BEGIN
  -- Get reward amounts from campaign
  SELECT purchase_reward, brand_coins_reward
  INTO v_rez_reward, v_brand_coins
  FROM campaigns WHERE id = p_campaign_id;

  -- Calculate attributed revenue (5% of purchase as example)
  v_attribution := p_amount * 0.05;

  -- Create purchase event
  INSERT INTO purchase_events (
    scan_event_id, campaign_id, user_id,
    purchase_amount, purchase_reward_amount, brand_coins_credited,
    attributed_revenue, purchase_reward_credited
  ) VALUES (
    p_scan_event_id, p_campaign_id, p_user_id,
    p_amount,
    CASE WHEN p_user_id IS NOT NULL THEN v_rez_reward ELSE 0 END,
    CASE WHEN p_user_id IS NOT NULL THEN v_brand_coins ELSE 0 END,
    v_attribution,
    p_user_id IS NOT NULL
  ) RETURNING id INTO v_purchase_id;

  -- Credit rewards if user is logged in
  IF p_user_id IS NOT NULL THEN
    INSERT INTO coin_transactions (campaign_id, user_id, amount, coin_type, reason)
    VALUES (p_campaign_id, p_user_id, v_rez_reward, 'rez', 'purchase');

    IF v_brand_coins > 0 THEN
      INSERT INTO coin_transactions (campaign_id, user_id, amount, coin_type, reason)
      VALUES (p_campaign_id, p_user_id, v_brand_coins, 'brand', 'purchase');
    END IF;
  END IF;

  RETURN v_purchase_id;
END;
$$ LANGUAGE plpgsql;
