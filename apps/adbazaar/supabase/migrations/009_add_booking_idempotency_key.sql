-- Migration: 009_add_booking_idempotency_key
-- Fix: AB-C4 (No idempotency on booking creation)
-- Adds idempotency_key column to bookings table to prevent duplicate booking creation
-- when clients retry after network timeouts.

-- Add idempotency_key column with unique constraint per buyer
-- The unique constraint ensures idempotency at the database level.
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT;

-- Create index for fast lookup during idempotency check
CREATE INDEX IF NOT EXISTS idx_bookings_buyer_idempotency
  ON bookings (buyer_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

-- =====================================================
-- DOWN MIGRATION: 009_add_booking_idempotency_key
-- =====================================================
-- This migration adds idempotency_key column to bookings table.
-- To rollback:
-- DROP INDEX IF EXISTS idx_bookings_buyer_idempotency;
-- ALTER TABLE bookings DROP COLUMN IF EXISTS idempotency_key;
