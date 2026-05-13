import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import logger from '@/lib/logger'
import { timingSafeEqual } from 'crypto'

// GET /api/cron/retry-coin-credits
// Vercel Cron (every 15 min). Retries pending/retrying coin credit failures
// with exponential backoff. Moves to manual_review after 5 failed attempts.
//
// Vercel cron config (vercel.json):
//   { "crons": [{ "path": "/api/cron/retry-coin-credits", "schedule": "0 9,21 * * *" }] }

const MAX_ATTEMPTS = 5

// Exponential backoff: 2^attempts * 60_000 ms
// attempts 0→1→2→3→4 → delays 1m, 2m, 4m, 8m, 16m
function backoffMs(attempts: number): number {
  return Math.pow(2, attempts) * 60_000
}

export async function GET(req: NextRequest) {
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

  const supabase = createServerClient()
  const now = new Date().toISOString()

  // Fetch rows ready for retry (status = pending|retrying AND next_retry <= now)
  const { data: rows, error: fetchError } = await supabase
    .from('failed_coin_credits')
    .select('*')
    .in('status', ['pending', 'retrying'])
    .or(`next_retry.is.null,next_retry.lte.${now}`)
    .limit(100)

  if (fetchError) {
    logger.error('[cron/retry-coin-credits] fetch error:', fetchError)
    return NextResponse.json({ error: fetchError.message }, { status: 500 })
  }

  let processed = 0
  let resolved = 0
  let retried = 0
  let manualReview = 0

  for (const record of rows ?? []) {
    processed++

    const attemptNumber = record.attempts ?? 0

    try {
      // AB-CROSS-01 FIX: Validate key before sending; add AbortController timeout.
      // Previously sent empty-string header on missing env var, causing silent 401s.
      const rezInternalKey = process.env.REZ_INTERNAL_KEY
      if (!rezInternalKey) {
        logger.error('[cron/retry-coin-credits] REZ_INTERNAL_KEY is not configured')
        // Don't retry — fail hard so ops is alerted
        break
      }
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 10_000)
      const rezRes = await fetch(`${process.env.REZ_API_BASE_URL}/api/adbazaar/scan`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-internal-key': rezInternalKey,
        },
        signal: controller.signal,
        body: JSON.stringify({
          // AB-C2 FIX: body was placed OUTSIDE the fetch options object,
          // so retries never sent user_id/merchant_id/coins_amount.
          // Fixes the coin credit retry loop that kept accumulating failed rows.
          rezUserId: record.user_id,
          qrCodeId: null, // not available on retry; REZ backend uses scan_event_id
          merchantId: record.merchant_id,
          coinsAmount: record.coins_amount,
          scanEventId: record.scan_event_id,
          adPlacementTitle: null,
        }),
      })
      clearTimeout(timeout)

      if (rezRes.ok) {
        // Success: mark resolved and update the scan event
        await Promise.all([
          supabase.from('failed_coin_credits').update({
            status: 'resolved',
            attempts: attemptNumber + 1,
            last_attempt: new Date().toISOString(),
            next_retry: null,
            updated_at: new Date().toISOString(),
          }).eq('id', record.id),
          supabase.from('scan_events').update({
            rez_coins_credited: true,
            coins_amount: record.coins_amount,
            rez_app_opened: true,
          }).eq('id', record.scan_event_id),
        ])
        resolved++
      } else {
        const errorText = await rezRes.text().catch(() => `HTTP ${rezRes.status}`)
        const newAttempts = attemptNumber + 1
        const nextStatus = newAttempts >= MAX_ATTEMPTS ? 'manual_review' : 'retrying'
        const nextRetryMs = backoffMs(newAttempts)
        const nextRetry = new Date(Date.now() + nextRetryMs).toISOString()

        await supabase.from('failed_coin_credits').update({
          status: nextStatus,
          attempts: newAttempts,
          last_attempt: new Date().toISOString(),
          next_retry: nextRetry,
          error_message: errorText.slice(0, 1000),
          updated_at: new Date().toISOString(),
        }).eq('id', record.id)

        if (nextStatus === 'manual_review') {
          manualReview++
        } else {
          retried++
        }
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err)
      const newAttempts = attemptNumber + 1
      const nextStatus = newAttempts >= MAX_ATTEMPTS ? 'manual_review' : 'retrying'
      const nextRetryMs = backoffMs(newAttempts)
      const nextRetry = new Date(Date.now() + nextRetryMs).toISOString()

      await supabase.from('failed_coin_credits').update({
        status: nextStatus,
        attempts: newAttempts,
        last_attempt: new Date().toISOString(),
        next_retry: nextRetry,
        error_message: errorMessage.slice(0, 1000),
        updated_at: new Date().toISOString(),
      }).eq('id', record.id)

      if (nextStatus === 'manual_review') {
        manualReview++
      } else {
        retried++
      }
    }
  }

  logger.info(
    `[cron/retry-coin-credits] processed=${processed} resolved=${resolved} retried=${retried} manual_review=${manualReview}`,
  )
  return NextResponse.json({ processed, resolved, retried, manualReview })
}
