import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import crypto from 'crypto'
import { z } from 'zod'
import logger from '@/lib/logger'
import { addToDLQ } from '@/lib/dlq'

const RezVisitSchema = z.object({
  rezUserId: z.string().min(1, 'rezUserId required'),
  merchantId: z.string().min(1, 'merchantId required'),
  scanEventId: z.string().min(1, 'scanEventId required'),
  visitTimestamp: z.number().int().positive('visitTimestamp required'),
})

export async function POST(req: NextRequest) {
  try {
    const expectedSecret = process.env.ADBAZAAR_WEBHOOK_SECRET ?? ''
    if (!expectedSecret) {
      logger.error('[Webhook] ADBAZAAR_WEBHOOK_SECRET is not configured')
      return NextResponse.json({ error: 'Webhook not configured' }, { status: 503 })
    }
    const secret = req.headers.get('x-webhook-secret') ?? ''
    const secretBuf = Buffer.from(secret)
    const expectedBuf = Buffer.from(expectedSecret)
    const isValid = secretBuf.length > 0 &&
      secretBuf.length === expectedBuf.length &&
      crypto.timingSafeEqual(secretBuf, expectedBuf)
    if (!isValid) {
      return NextResponse.json({ success: false }, { status: 401 })
    }
    const body = await req.json()
    const parsed = RezVisitSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid payload', details: parsed.error.flatten() }, { status: 400 })
    }
    const { rezUserId, merchantId, scanEventId, visitTimestamp } = parsed.data
    const supabase = createServerClient()

    // Process the visit event with DLQ on failure
    try {
      // Find scan event and create attribution record
      const { data: scanEvent } = await supabase.from('scan_events').select('*').eq('id', scanEventId).single()
      if (!scanEvent) {
        // AB2-M5 FIX: log missing scan event instead of silently returning success
        logger.warn(`scan event not found: ${scanEventId}`)
        return NextResponse.json({ success: true, skipped: true })
      }
      const visitId = `${rezUserId}_${merchantId}_${visitTimestamp}`
      // Idempotent: skip if this visit was already recorded
      const { data: existing } = await supabase.from('attribution').select('id').eq('rez_visit_id', visitId).maybeSingle()
      if (!existing) {
        await supabase.from('attribution').insert({
          scan_event_id: scanEventId,
          qr_id: scanEvent.qr_id,
          rez_visit_id: visitId,
          visit_timestamp: visitTimestamp,
        })
      }
    } catch (processErr) {
      // Log the error and add to DLQ for retry
      logger.error('[rez-visit webhook] Processing failed, adding to DLQ:', processErr)
      await addToDLQ(supabase, 'rez-visit', {
        rezUserId,
        merchantId,
        scanEventId,
        visitTimestamp,
      }, String(processErr))
      // Still return success to acknowledge the webhook
      return NextResponse.json({ success: true, queued: true })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    logger.error('[rez-visit webhook] Unexpected error', err)
    return NextResponse.json({ success: false, error: 'Internal error' }, { status: 500 })
  }
}
