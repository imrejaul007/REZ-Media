-- Migration 012: Unique constraint on scan_events(qr_id, ip_address)
-- Fix: AB3-H2 (isNewScanner race condition)
--
-- Problem: Two concurrent scan requests from the same IP both read
-- priorScans === 0 before either inserts, causing both to get
-- isNewScanner = true and both increments to fire.
--
-- Solution: Add a unique constraint on (qr_id, ip_address). On insert,
-- if the same IP has already scanned this QR, the insert fails with
-- a unique_violation (23505). The route catches this and sets
-- isNewScanner = false without double-incrementing.

-- Step 1: Check for existing duplicates (keep the oldest scan per qr_id+ip_address)
DELETE FROM scan_events AS dup
USING scan_events AS kept
WHERE
  dup.qr_id = kept.qr_id
  AND dup.ip_address = kept.ip_address
  AND dup.id > kept.id;

-- Step 2: Add the unique constraint
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS
  idx_scan_events_qr_ip
  ON scan_events (qr_id, ip_address);

COMMENT ON INDEX idx_scan_events_qr_ip
  IS 'AB3-H2 FIX: prevents isNewScanner double-credit race — only first scan per QR+IP wins';

-- =====================================================
-- DOWN MIGRATION: 012_scan_ip_unique_constraint
-- =====================================================
-- This migration adds a unique constraint on scan_events(qr_id, ip_address).
-- To rollback:
-- DROP INDEX IF EXISTS idx_scan_events_qr_ip;
