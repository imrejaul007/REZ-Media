import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import logger from '@/lib/logger'

/**
 * AB-D4 FIX: Cron endpoint to process failed coin credits retry queue.
 *
 * This endpoint should be called by a cron job (e.g., every 5 minutes)
 * to retry failed coin credits that have reached their next_retry time.
 *
 * Security: This endpoint should be protected by a secret cron secret
 * to prevent unauthorized access.
 */

const CRON_SECRET = process.env.CRON_SECRET

// Maximum retries before marking as permanently failed
const MAX_RETRIES = 5

// Backoff multiplier for exponential backoff (in minutes)
const BACKOFF_MULTIPLIER = 2

interface FailedCredit {
  id: string
  scan_event_id: string
  user_id: string
  merchant_id: string
  coins_amount: number
  attempts: number
  last_attempt: string
  next_retry: string
  status: string
}

async function creditCoinsViaRezApi(
  userId: string,
  merchantId: string,
  coinsAmount: number,
  scanEventId: string,
  retryCount: number
): Promise<{ success: boolean; error?: string }> {
  const rezInternalKey = process.env.REZ_INTERNAL_KEY
  const rezApiBaseUrl = process.env.REZ_API_BASE_URL

  if (!rezInternalKey || !rezApiBaseUrl) {
    return { success: false, error: 'REZ API not configured' }
  }

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 10_000)

    const response = await fetch(`${rezApiBaseUrl}/api/adbazaar/scan`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-internal-key': rezInternalKey,
      },
      signal: controller.signal,
      body: JSON.stringify({
        rezUserId: userId,
        merchantId,
        coinsAmount,
        scanEventId,
        isRetry: retryCount > 0,
      }),
    })

    clearTimeout(timeout)

    if (response.ok) {
      return { success: true }
    } else {
      const errorText = await response.text().catch(() => `HTTP ${response.status}`)
      return { success: false, error: errorText.slice(0, 1000) }
    }
  } catch (e) {
    const errorMessage = e instanceof Error ? e.message : String(e)
    return { success: false, error: errorMessage }
  }
}

export async function GET(req: NextRequest) {
  // AB-D4 FIX: Verify cron secret to prevent unauthorized access
  const authHeader = req.headers.get('authorization') ?? ''
  const providedSecret = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null

  if (!CRON_SECRET || providedSecret !== CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServerClient()

  // Get failed credits that are ready for retry
  const now = new Date().toISOString()

  const { data: failedCredits, error: fetchError } = await supabase
    .from('failed_coin_credits')
    .select('*')
    .in('status', ['pending', 'retrying'])
    .lte('next_retry', now)
    .order('next_retry', { ascending: true })
    .limit(50) // Process in batches to avoid overwhelming the API

  if (fetchError) {
    logger.error('[process-coin-credits] Failed to fetch failed credits', fetchError)
    return NextResponse.json({ error: 'Failed to fetch failed credits' }, { status: 500 })
  }

  if (!failedCredits || failedCredits.length === 0) {
    return NextResponse.json({ message: 'No pending retries', processed: 0 })
  }

  const results = {
    processed: 0,
    succeeded: 0,
    failed: 0,
    maxRetriesReached: 0,
  }

  for (const credit of failedCredits as FailedCredit[]) {
    results.processed++

    // Check if max retries reached
    if (credit.attempts >= MAX_RETRIES) {
      await supabase
        .from('failed_coin_credits')
        .update({
          status: 'failed',
          resolved_at: now,
          error_message: `Max retries (${MAX_RETRIES}) reached`,
        })
        .eq('id', credit.id)
      results.maxRetriesReached++
      continue
    }

    // Attempt to credit coins
    const result = await creditCoinsViaRezApi(
      credit.user_id,
      credit.merchant_id,
      credit.coins_amount,
      credit.scan_event_id,
      credit.attempts
    )

    if (result.success) {
      // Mark scan event as credited
      await supabase
        .from('scan_events')
        .update({
          rez_coins_credited: true,
          coins_amount: credit.coins_amount,
        })
        .eq('id', credit.scan_event_id)

      // Mark failed credit as completed
      await supabase
        .from('failed_coin_credits')
        .update({
          status: 'completed',
          attempts: credit.attempts + 1,
          last_attempt: now,
          resolved_at: now,
        })
        .eq('id', credit.id)

      results.succeeded++
      logger.info('[process-coin-credits] Successfully credited coins', {
        creditId: credit.id,
        userId: credit.user_id,
        coinsAmount: credit.coins_amount,
      })
    } else {
      // Calculate next retry with exponential backoff
      const backoffMinutes = Math.pow(BACKOFF_MULTIPLIER, credit.attempts) * 5 // 5, 10, 20, 40, 80 minutes
      const nextRetry = new Date(Date.now() + backoffMinutes * 60 * 1000).toISOString()

      // Update failed credit record
      await supabase
        .from('failed_coin_credits')
        .update({
          status: 'retrying',
          attempts: credit.attempts + 1,
          last_attempt: now,
          next_retry: nextRetry,
          error_message: result.error?.slice(0, 1000),
        })
        .eq('id', credit.id)

      results.failed++
      logger.warn('[process-coin-credits] Retry failed', {
        creditId: credit.id,
        attempt: credit.attempts + 1,
        error: result.error,
      })
    }
  }

  logger.info('[process-coin-credits] Batch complete', results)

  return NextResponse.json({
    message: 'Processed failed coin credits',
    ...results,
  })
}

// Also support POST for manual triggers
export async function POST(req: NextRequest) {
  return GET(req)
}
