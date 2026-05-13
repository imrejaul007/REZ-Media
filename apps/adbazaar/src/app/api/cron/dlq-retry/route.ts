import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { timingSafeEqual } from 'crypto'
import logger from '@/lib/logger'
import { retryDLQ, processDLQEntry } from '@/lib/dlq'

// GET /api/cron/dlq-retry
// Called by Vercel Cron (hourly). Retries failed DLQ entries.
//
// Vercel cron config (vercel.json):
//   { "crons": [{ "path": "/api/cron/dlq-retry", "schedule": "0 * * * *" }] }
//
// Protected by CRON_SECRET env var.

export async function GET(req: NextRequest) {
  // Validate cron secret via Authorization header
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 503 })
  }
  const authHeader = req.headers.get('authorization') ?? ''
  const expected = Buffer.from(`Bearer ${cronSecret}`)
  const actual = Buffer.from(authHeader)
  if (!timingSafeEqual(expected, actual)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const supabase = createServerClient()

    // Process DLQ entries for REZ purchase and visit events
    const result = await retryDLQ(supabase, async (entry) => {
      await processDLQEntry(entry, supabase)
    })

    logger.info(`[cron/dlq-retry] retried=${result.retried} failed=${result.failed}`)
    return NextResponse.json({
      success: true,
      retried: result.retried,
      failed: result.failed,
    })
  } catch (e) {
    logger.error('[cron/dlq-retry] error:', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
