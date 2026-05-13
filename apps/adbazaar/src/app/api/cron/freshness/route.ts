import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { timingSafeEqual } from 'crypto'
import logger from '@/lib/logger'

// GET /api/cron/freshness
// Called by Vercel Cron (daily). Finds active listings that haven't been
// refreshed in 30+ days, decays their freshness_score, and auto-pauses at 0.
//
// Vercel cron config (vercel.json):
//   { "crons": [{ "path": "/api/cron/freshness", "schedule": "0 3 * * *" }] }
//
// Protected by CRON_SECRET env var (set same value in Vercel dashboard).

const STALE_DAYS = 30          // days before decay starts
const DECAY_PER_DAY = 5        // freshness points lost per day
const PAUSE_THRESHOLD = 0      // pause when score reaches this
const BATCH_SIZE = 100         // AB-D3 FIX: process listings in batches to avoid timeout

export async function GET(req: NextRequest) {
  // Validate Vercel cron secret via Authorization header
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 503 });
  }
  const authHeader = req.headers.get('authorization') ?? '';
  const expected = Buffer.from(`Bearer ${cronSecret}`);
  const actual = Buffer.from(authHeader);
  if (!timingSafeEqual(expected, actual)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const supabase = createServerClient()
    const now = new Date()

    // AB-D3 FIX: Process listings in batches to avoid serverless timeout
    // With thousands of listings, fetching all at once and processing sequentially
    // would timeout in Vercel's 10s serverless limit
    let lastId: string | null = null
    let totalProcessed = 0
    let totalDecayed = 0
    let totalPaused = 0

    while (true) {
      let query = supabase
        .from('listings')
        .select('id, freshness_score, freshness_last_updated, status')
        .eq('status', 'active')
        .order('id')
        .limit(BATCH_SIZE)

      if (lastId) {
        query = query.gt('id', lastId)
      }

      const { data: listings, error } = await query

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }

      if (!listings?.length) break // No more listings to process

      for (const listing of listings) {
        const lastUpdated = listing.freshness_last_updated
          ? new Date(listing.freshness_last_updated)
          : new Date(0)

        const daysSinceUpdate = Math.floor(
          (now.getTime() - lastUpdated.getTime()) / (1000 * 60 * 60 * 24),
        )

        if (daysSinceUpdate >= STALE_DAYS) {
          const staleDays = daysSinceUpdate - STALE_DAYS
          const newScore = Math.max(
            PAUSE_THRESHOLD,
            (listing.freshness_score ?? 100) - staleDays * DECAY_PER_DAY,
          )

          const shouldPause = newScore <= PAUSE_THRESHOLD
          const update: Record<string, unknown> = {
            freshness_score: newScore,
            updated_at: now.toISOString(),
          }
          if (shouldPause) {
            update.status = 'paused'
            totalPaused++
          }

          await supabase.from('listings').update(update).eq('id', listing.id)
          totalDecayed++
        }

        totalProcessed++
        lastId = listing.id
      }

      // If we got fewer than BATCH_SIZE, we're done
      if (listings.length < BATCH_SIZE) break
    }

    logger.info(`[cron/freshness] processed=${totalProcessed} decayed=${totalDecayed} paused=${totalPaused}`)
    return NextResponse.json({ processed: totalProcessed, decayed: totalDecayed, paused: totalPaused })
  } catch (e) {
    logger.error('[cron/freshness] error:', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
