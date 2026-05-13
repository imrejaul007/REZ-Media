-- Migration: 018_add_notification_retry_queue
-- Added by: claude-flow (AB-D1 fix)
-- Purpose: Retry queue for failed notification inserts so they are not silently dropped
-- (Renamed from 003 to fix duplicate migration number conflict)

BEGIN;

CREATE TABLE IF NOT EXISTS notification_retry_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  link TEXT,
  attempts INTEGER NOT NULL DEFAULT 0,
  last_attempt TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  next_retry TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'done', 'failed')),
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notification_retry_queue_status ON notification_retry_queue(status);
CREATE INDEX IF NOT EXISTS idx_notification_retry_queue_next_retry ON notification_retry_queue(next_retry);

COMMIT;

-- =====================================================
-- DOWN MIGRATION: 018_add_notification_retry_queue
-- =====================================================
-- This migration creates the notification_retry_queue table.
-- To rollback:
-- DROP TABLE IF EXISTS notification_retry_queue CASCADE;
