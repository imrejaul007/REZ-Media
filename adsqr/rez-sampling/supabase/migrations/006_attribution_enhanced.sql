-- Migration: 006_attribution_enhanced
-- Date: 2026-05-03
-- Purpose: Add enhanced attribution tracking features

-- Attribution Touchpoints table (for multi-touch attribution)
CREATE TABLE IF NOT EXISTS attribution_touchpoints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  campaign_id UUID REFERENCES campaigns(id),

  -- Touchpoint type
  touchpoint_type TEXT NOT NULL CHECK (touchpoint_type IN ('scan', 'visit', 'view', 'engagement', 'purchase')),
  source TEXT, -- 'qr', 'social', 'search', 'direct', 'referral'

  -- Context
  campaign_id_ref UUID REFERENCES campaigns(id),
  qr_id UUID REFERENCES qr_codes(id),
  scan_event_id UUID REFERENCES scan_events(id),
  visit_event_id UUID REFERENCES visit_events(id),
  purchase_event_id UUID REFERENCES purchase_events(id),

  -- Attribution data
  attribution_credit DECIMAL(5, 4) DEFAULT 0, -- 0-1 representing attribution weight
  conversion_bucket TEXT, -- 'first_touch', 'last_touch', 'linear', 'time_decay'

  -- Metadata
  device_fingerprint TEXT,
  ip_address TEXT,
  referrer TEXT,
  utm_data JSONB DEFAULT '{}',

  -- Timestamp
  touched_at TIMESTAMPTZ DEFAULT NOW(),

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Attribution Sessions table (for session-based attribution)
CREATE TABLE IF NOT EXISTS attribution_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  session_id TEXT UNIQUE NOT NULL,

  -- Session data
  device_fingerprint TEXT,
  ip_address TEXT,
  user_agent TEXT,

  -- Attribution summary
  touchpoints_count INTEGER DEFAULT 0,
  channels JSONB DEFAULT '[]',

  -- Timestamps
  started_at TIMESTAMPTZ DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  last_activity_at TIMESTAMPTZ DEFAULT NOW()
);

-- Conversion Events table (for tracking all conversions)
CREATE TABLE IF NOT EXISTS conversion_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  campaign_id UUID REFERENCES campaigns(id),

  -- Conversion details
  conversion_type TEXT NOT NULL CHECK (conversion_type IN ('scan', 'visit', 'purchase', 'signup', 'lead', 'custom')),
  conversion_value DECIMAL(12, 2) DEFAULT 0,
  currency TEXT DEFAULT 'INR',

  -- Attribution
  attributed_channels JSONB DEFAULT '[]',
  primary_channel TEXT,
  first_touch_campaign UUID REFERENCES campaigns(id),
  last_touch_campaign UUID REFERENCES campaigns(id),

  -- Related events
  scan_event_id UUID REFERENCES scan_events(id),
  visit_event_id UUID REFERENCES visit_events(id),
  purchase_event_id UUID REFERENCES purchase_events(id),

  -- Metadata
  metadata JSONB DEFAULT '{}',
  conversion_time TIMESTAMPTZ DEFAULT NOW(),

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- UTM Parameters tracking table
CREATE TABLE IF NOT EXISTS utm_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  session_id TEXT,

  -- UTM data
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  utm_term TEXT,
  utm_content TEXT,

  -- Context
  campaign_id UUID REFERENCES campaigns(id),
  qr_id UUID REFERENCES qr_codes(id),

  -- First seen
  first_seen_at TIMESTAMPTZ DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ DEFAULT NOW(),
  touch_count INTEGER DEFAULT 1
);

-- Add transaction_id to purchase_events if not exists
-- This is typically done in application code, but here's the schema update
ALTER TABLE purchase_events ADD COLUMN IF NOT EXISTS transaction_id TEXT;
CREATE INDEX IF NOT EXISTS idx_purchase_events_transaction ON purchase_events(transaction_id);

-- Add indexes for enhanced attribution
CREATE INDEX IF NOT EXISTS idx_attribution_touchpoints_user ON attribution_touchpoints(user_id);
CREATE INDEX IF NOT EXISTS idx_attribution_touchpoints_campaign ON attribution_touchpoints(campaign_id);
CREATE INDEX IF NOT EXISTS idx_attribution_touchpoints_type ON attribution_touchpoints(touchpoint_type);
CREATE INDEX IF NOT EXISTS idx_attribution_touchpoints_time ON attribution_touchpoints(touched_at);
CREATE INDEX IF NOT EXISTS idx_attribution_sessions_user ON attribution_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_attribution_sessions_session ON attribution_sessions(session_id);
CREATE INDEX IF NOT EXISTS idx_conversion_events_user ON conversion_events(user_id);
CREATE INDEX IF NOT EXISTS idx_conversion_events_campaign ON conversion_events(campaign_id);
CREATE INDEX IF NOT EXISTS idx_conversion_events_type ON conversion_events(conversion_type);
CREATE INDEX IF NOT EXISTS idx_utm_tracking_user ON utm_tracking(user_id);
CREATE INDEX IF NOT EXISTS idx_utm_tracking_campaign ON utm_tracking(campaign_id);

-- Function to increment campaign coins used
CREATE OR REPLACE FUNCTION increment_campaign_coins(
  p_campaign_id UUID,
  p_amount INTEGER
) RETURNS void AS $$
BEGIN
  UPDATE campaigns
  SET
    coins_used = coins_used + p_amount,
    updated_at = NOW()
  WHERE id = p_campaign_id;
END;
$$ LANGUAGE plpgsql;

-- View for detailed attribution funnel with more metrics
CREATE OR REPLACE VIEW attribution_funnel_detailed AS
SELECT
  c.id as campaign_id,
  c.name as campaign_name,
  c.status as campaign_status,
  c.start_date,
  c.end_date,

  -- Counts
  COUNT(DISTINCT se.id)::INTEGER as total_scans,
  COUNT(DISTINCT se.user_id) FILTER (WHERE se.user_id IS NOT NULL)::INTEGER as unique_scanners,
  COUNT(DISTINCT ve.id)::INTEGER as total_visits,
  COUNT(DISTINCT ve.id) FILTER (WHERE ve.location_verified = true)::INTEGER as verified_visits,
  COUNT(DISTINCT pe.id)::INTEGER as total_purchases,

  -- Revenue
  COALESCE(SUM(pe.purchase_amount), 0) as total_revenue,
  COALESCE(SUM(pe.attributed_revenue), 0) as attributed_revenue,

  -- Rewards
  COALESCE(SUM(se.coins_amount), 0) as scan_rewards_issued,
  COALESCE(SUM(ve.visit_reward_amount), 0) as visit_rewards_issued,
  COALESCE(SUM(pe.purchase_reward_amount), 0) as purchase_rewards_issued,
  c.coins_used as total_coins_used,
  c.coin_budget as coin_budget,

  -- Conversion rates
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
  ROUND(
    CASE
      WHEN COUNT(DISTINCT se.id) > 0
      THEN COUNT(DISTINCT pe.id)::DECIMAL / COUNT(DISTINCT se.id) * 100
      ELSE 0
    END, 2
  ) as scan_to_purchase_rate,

  -- Averages
  ROUND(
    CASE
      WHEN COUNT(DISTINCT pe.id) > 0
      THEN COALESCE(SUM(pe.purchase_amount), 0) / COUNT(DISTINCT pe.id)
      ELSE 0
    END, 2
  ) as avg_purchase_value,
  ROUND(
    CASE
      WHEN COUNT(DISTINCT se.id) > 0
      THEN c.coins_used::DECIMAL / COUNT(DISTINCT se.id)
      ELSE 0
    END, 2
  ) as avg_cost_per_scan

FROM campaigns c
LEFT JOIN scan_events se ON se.campaign_id = c.id
LEFT JOIN visit_events ve ON ve.scan_event_id = se.id
LEFT JOIN purchase_events pe ON pe.scan_event_id = se.id
GROUP BY c.id, c.name, c.status, c.start_date, c.end_date, c.coins_used, c.coin_budget;
