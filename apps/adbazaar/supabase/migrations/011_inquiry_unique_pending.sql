-- Migration 011: Unique partial index on inquiries table
-- Fix: AB2-H9 (duplicate inquiry race condition)
--
-- Problem: The inquiry POST handler checks for existing open inquiries
-- (lines 57-66) then inserts (lines 68-82). Two concurrent requests
-- can both pass the check and create duplicate inquiries.
--
-- Solution: Add a partial unique index on (listing_id, buyer_id)
-- where status is 'pending' or 'quoted'. When the DB enforces uniqueness,
-- the second concurrent insert fails with a constraint violation. The route
-- catches this error and returns 409 Conflict, making the operation atomic.

-- Step 1: Delete any pre-existing duplicate pending/quoted inquiries
-- (keep the oldest, delete newer duplicates)
DELETE FROM inquiries AS dup
USING inquiries AS kept
WHERE
  dup.listing_id = kept.listing_id
  AND dup.buyer_id = kept.buyer_id
  AND dup.id > kept.id
  AND dup.status IN ('pending', 'quoted')
  AND kept.status IN ('pending', 'quoted');

-- Step 2: Add the partial unique index
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS
  idx_inquiries_listing_buyer_pending
  ON inquiries (listing_id, buyer_id)
  WHERE status IN ('pending', 'quoted');

COMMENT ON INDEX idx_inquiries_listing_buyer_pending
  IS 'AB2-H9 FIX: prevents duplicate open inquiries for same buyer+listing pair';

-- =====================================================
-- DOWN MIGRATION: 011_inquiry_unique_pending
-- =====================================================
-- This migration adds a unique partial index on inquiries table.
-- To rollback:
-- DROP INDEX IF EXISTS idx_inquiries_listing_buyer_pending;
