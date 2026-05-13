-- AB-D4 FIX: Failed coin credits retry queue
-- Table to track failed REZ coin credit attempts for automatic retry
-- (Renamed from 006 to fix duplicate migration number conflict)

CREATE TABLE IF NOT EXISTS failed_coin_credits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  scan_event_id UUID REFERENCES scan_events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  merchant_id TEXT NOT NULL,
  coins_amount INTEGER NOT NULL,
  attempts INTEGER DEFAULT 0,
  last_attempt TIMESTAMPTZ DEFAULT NOW(),
  next_retry TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'retrying', 'failed', 'completed')),
  error_message TEXT,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for efficient retry processing
CREATE INDEX IF NOT EXISTS idx_failed_coin_credits_status_next_retry
  ON failed_coin_credits(status, next_retry)
  WHERE status IN ('pending', 'retrying');

-- Index for user lookup
CREATE INDEX IF NOT EXISTS idx_failed_coin_credits_user_id
  ON failed_coin_credits(user_id);

-- Index for scan event lookup
CREATE INDEX IF NOT EXISTS idx_failed_coin_credits_scan_event_id
  ON failed_coin_credits(scan_event_id);

-- AB-D4 FIX: Add missing columns to scan_events table if not exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'scan_events' AND column_name = 'device_type'
  ) THEN
    ALTER TABLE scan_events ADD COLUMN device_type TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'scan_events' AND column_name = 'city_derived'
  ) THEN
    ALTER TABLE scan_events ADD COLUMN city_derived TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'scan_events' AND column_name = 'country_derived'
  ) THEN
    ALTER TABLE scan_events ADD COLUMN country_derived TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'scan_events' AND column_name = 'referrer'
  ) THEN
    ALTER TABLE scan_events ADD COLUMN referrer TEXT;
  END IF;
END $$;

-- =====================================================
-- DOWN MIGRATION: 018_failed_coin_credits_v1
-- =====================================================
-- This migration creates failed_coin_credits table and adds columns to scan_events.
-- To rollback:
-- DROP TABLE IF EXISTS failed_coin_credits CASCADE;
-- ALTER TABLE scan_events DROP COLUMN IF EXISTS device_type;
-- ALTER TABLE scan_events DROP COLUMN IF EXISTS city_derived;
-- ALTER TABLE scan_events DROP COLUMN IF EXISTS country_derived;
-- ALTER TABLE scan_events DROP COLUMN IF EXISTS referrer;
