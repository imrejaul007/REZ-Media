-- Migration: 013_add_attribution_booking_id
-- Date: 2026-05-01
-- Purpose: Add booking_id column to attribution table for proper booking linkage
-- Fixes: AB-D2

-- Add booking_id column to attribution table
ALTER TABLE attribution
ADD COLUMN IF NOT EXISTS booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL;

-- Create index for faster lookups on booking_id
CREATE INDEX IF NOT EXISTS idx_attribution_booking_id
ON attribution(booking_id)
WHERE booking_id IS NOT NULL;

-- Backfill existing attribution records with booking_id from qr_codes
-- This links existing scan attributions to their source bookings where applicable
UPDATE attribution a
SET booking_id = q.booking_id
FROM qr_codes q
WHERE a.qr_id = q.id
  AND a.booking_id IS NULL
  AND q.booking_id IS NOT NULL;

-- =====================================================
-- DOWN MIGRATION: 013_add_attribution_booking_id
-- =====================================================
-- This migration adds booking_id column to attribution table.
-- To rollback:
-- DROP INDEX IF EXISTS idx_attribution_booking_id;
-- ALTER TABLE attribution DROP COLUMN IF EXISTS booking_id;
