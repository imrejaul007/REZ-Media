-- AB3-M14 FIX: Add atomic view count increment functions
-- These functions use database-level atomic operations to increment view counts
-- without race conditions from read-then-write patterns

-- Function to atomically increment view_count for a listing
CREATE OR REPLACE FUNCTION increment_view_count(listing_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE listings
  SET view_count = view_count + 1
  WHERE id = listing_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to atomically increment view_count manually (fallback)
CREATE OR REPLACE FUNCTION increment_view_count_manual(target_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE listings
  SET view_count = view_count + 1
  WHERE id = target_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION increment_view_count(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION increment_view_count_manual(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION increment_view_count(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION increment_view_count_manual(UUID) TO service_role;

-- =====================================================
-- DOWN MIGRATION: 015_view_count_increment
-- =====================================================
-- This migration creates view count increment functions.
-- To rollback:
-- REVOKE EXECUTE ON FUNCTION increment_view_count(UUID) FROM authenticated;
-- REVOKE EXECUTE ON FUNCTION increment_view_count_manual(UUID) FROM authenticated;
-- REVOKE EXECUTE ON FUNCTION increment_view_count(UUID) FROM service_role;
-- REVOKE EXECUTE ON FUNCTION increment_view_count_manual(UUID) FROM service_role;
-- DROP FUNCTION IF EXISTS increment_view_count(UUID);
-- DROP FUNCTION IF EXISTS increment_view_count_manual(UUID);
