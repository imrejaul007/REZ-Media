-- Migration: 014_add_vendor_ledger
-- Added by: claude-flow (Fix AB-A1)
-- Purpose: Track vendor earnings with proper refund adjustments
-- Created: 2026-05-01

BEGIN;

-- AB-A1 FIX: Create vendor_ledger table to track all financial transactions
-- This allows accurate earnings calculation that accounts for refunds
CREATE TABLE IF NOT EXISTS vendor_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,
  refund_id UUID REFERENCES refunds(id) ON DELETE SET NULL,
  entry_type TEXT NOT NULL CHECK (entry_type IN ('earning', 'refund', 'payout', 'adjustment')),
  amount NUMERIC(12, 2) NOT NULL,
  -- Positive amounts are credits (money owed to vendor)
  -- Negative amounts are debits (refunds, deductions)
  currency TEXT NOT NULL DEFAULT 'INR',
  description TEXT,
  reference_id TEXT,
  -- For linking to bookings/refunds
  balance_after NUMERIC(12, 2),
  -- Running balance after this entry
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'settled', 'cancelled')),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_vendor_ledger_vendor_id ON vendor_ledger(vendor_id);
CREATE INDEX IF NOT EXISTS idx_vendor_ledger_booking_id ON vendor_ledger(booking_id);
CREATE INDEX IF NOT EXISTS idx_vendor_ledger_refund_id ON vendor_ledger(refund_id);
CREATE INDEX IF NOT EXISTS idx_vendor_ledger_entry_type ON vendor_ledger(entry_type);
CREATE INDEX IF NOT EXISTS idx_vendor_ledger_created_at ON vendor_ledger(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_vendor_ledger_vendor_created ON vendor_ledger(vendor_id, created_at DESC);

-- AB-A1 FIX: Function to automatically create ledger entries when bookings are confirmed
CREATE OR REPLACE FUNCTION create_booking_earning_entry()
RETURNS TRIGGER AS $$
BEGIN
  -- Only create earning entry when booking is confirmed or paid
  IF NEW.status IN ('confirmed', 'paid') AND OLD.status IN ('inquiry', 'quoted') THEN
    INSERT INTO vendor_ledger (vendor_id, booking_id, entry_type, amount, description, reference_id)
    VALUES (
      NEW.vendor_id,
      NEW.id,
      'earning',
      NEW.vendor_payout,
      'Booking confirmed: ' || COALESCE(NEW.id::text, ''),
      NEW.payment_id
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- AB-A1 FIX: Trigger to auto-create earning entries on booking status change
DROP TRIGGER IF EXISTS trg_create_booking_earning ON bookings;
CREATE TRIGGER trg_create_booking_earning
  AFTER UPDATE OF status ON bookings
  FOR EACH ROW
  EXECUTE FUNCTION create_booking_earning_entry();

-- AB-A1 FIX: Function to create refund ledger entries
CREATE OR REPLACE FUNCTION create_refund_ledger_entry()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'processed' AND OLD.status != 'processed' THEN
    -- Find the original earning entry for this booking
    INSERT INTO vendor_ledger (vendor_id, booking_id, refund_id, entry_type, amount, description, reference_id)
    SELECT
      b.vendor_id,
      NEW.booking_id,
      NEW.id,
      'refund',
      -(NEW.amount * b.vendor_payout / b.amount),
      -- Proportional refund based on original payout ratio
      'Refund processed: ' || COALESCE(NEW.razorpay_refund_id, ''),
      NEW.razorpay_refund_id
    FROM bookings b
    WHERE b.id = NEW.booking_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- AB-A1 FIX: Trigger to create refund entries when refunds are processed
DROP TRIGGER IF EXISTS trg_create_refund_entry ON refunds;
CREATE TRIGGER trg_create_refund_entry
  AFTER UPDATE OF status ON refunds
  FOR EACH ROW
  EXECUTE FUNCTION create_refund_ledger_entry();

-- AB-A1 FIX: View for accurate vendor earnings with refund adjustments
CREATE OR REPLACE VIEW vendor_earnings_summary AS
SELECT
  vendor_id,
  COUNT(*) FILTER (WHERE entry_type = 'earning') AS total_earnings_count,
  COALESCE(SUM(amount) FILTER (WHERE entry_type = 'earning'), 0) AS total_earnings,
  COUNT(*) FILTER (WHERE entry_type = 'refund') AS total_refunds_count,
  COALESCE(ABS(SUM(amount)) FILTER (WHERE entry_type = 'refund'), 0) AS total_refunds,
  COALESCE(SUM(amount) FILTER (WHERE entry_type = 'earning'), 0) +
  COALESCE(SUM(amount) FILTER (WHERE entry_type = 'refund'), 0) AS net_earnings,
  COUNT(*) FILTER (WHERE entry_type = 'payout') AS total_payouts_count,
  COALESCE(ABS(SUM(amount)) FILTER (WHERE entry_type = 'payout'), 0) AS total_payouts
FROM vendor_ledger
WHERE entry_type IN ('earning', 'refund', 'payout')
  AND status != 'cancelled'
GROUP BY vendor_id;

COMMIT;

-- =====================================================
-- DOWN MIGRATION: 014_add_vendor_ledger
-- =====================================================
-- This migration creates the vendor_ledger table and related functions/triggers.
-- To rollback:
-- DROP TRIGGER IF EXISTS trg_create_refund_entry ON refunds;
-- DROP TRIGGER IF EXISTS trg_create_booking_earning ON bookings;
-- DROP FUNCTION IF EXISTS create_refund_ledger_entry();
-- DROP FUNCTION IF EXISTS create_booking_earning_entry();
-- DROP VIEW IF EXISTS vendor_earnings_summary;
-- DROP TABLE IF EXISTS vendor_ledger CASCADE;
