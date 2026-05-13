-- Phase 3: Payout fields on users table
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS bank_account_name TEXT,
  ADD COLUMN IF NOT EXISTS bank_account_number TEXT,
  ADD COLUMN IF NOT EXISTS bank_ifsc TEXT,
  ADD COLUMN IF NOT EXISTS upi_id TEXT;

-- =====================================================
-- DOWN MIGRATION: 004_payout_fields
-- =====================================================
-- This migration adds payout-related columns to users table.
-- To rollback:
-- ALTER TABLE users DROP COLUMN IF EXISTS bank_account_name;
-- ALTER TABLE users DROP COLUMN IF EXISTS bank_account_number;
-- ALTER TABLE users DROP COLUMN IF EXISTS bank_ifsc;
-- ALTER TABLE users DROP COLUMN IF EXISTS upi_id;
