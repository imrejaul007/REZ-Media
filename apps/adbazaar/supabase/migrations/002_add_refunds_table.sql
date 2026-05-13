-- Migration: 002_add_refunds_table
-- Added by: claude-flow (Audit 7 — AB-C3)
-- Purpose: Support Razorpay refund webhook handling for adBazaar bookings
-- Created: 2026-04-14

BEGIN;

CREATE TABLE IF NOT EXISTS refunds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  razorpay_refund_id TEXT UNIQUE NOT NULL,
  amount NUMERIC(12, 2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'created',
  -- status values: 'created' | 'processed' | 'failed'
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_refunds_razorpay_id ON refunds(razorpay_refund_id);
CREATE INDEX IF NOT EXISTS idx_refunds_booking_id ON refunds(booking_id);

COMMIT;

-- =====================================================
-- DOWN MIGRATION: 002_add_refunds_table
-- =====================================================
-- This migration creates the refunds table.
-- To rollback:
-- DROP TABLE IF EXISTS refunds CASCADE;
