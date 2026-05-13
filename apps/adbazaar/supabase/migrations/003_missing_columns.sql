-- Migration 003: add missing columns

-- rejection_reason on listings (written by admin review route)
ALTER TABLE listings ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

-- =====================================================
-- DOWN MIGRATION: 003_missing_columns
-- =====================================================
-- This migration adds rejection_reason column to listings table.
-- To rollback:
-- ALTER TABLE listings DROP COLUMN IF EXISTS rejection_reason;
