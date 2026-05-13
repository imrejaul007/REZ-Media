-- Migration 008: Atomic QR scan counter increment function
-- Fixes race condition where concurrent scans could both read the same counter
-- value and both write counter+1 instead of counter+2.

CREATE OR REPLACE FUNCTION increment_qr_scan_counts(qr_id UUID, inc_unique BOOLEAN)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE qr_codes
  SET
    total_scans   = total_scans + 1,
    unique_scanners = unique_scanners + (CASE WHEN inc_unique THEN 1 ELSE 0 END)
  WHERE id = qr_id;
END;
$$;

-- =====================================================
-- DOWN MIGRATION: 008_atomic_qr_counters
-- =====================================================
-- This migration creates the increment_qr_scan_counts function.
-- To rollback:
-- DROP FUNCTION IF EXISTS increment_qr_scan_counts(UUID, BOOLEAN);
