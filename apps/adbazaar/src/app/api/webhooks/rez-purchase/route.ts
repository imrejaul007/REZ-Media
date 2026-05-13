import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import crypto from 'crypto'
import { z } from 'zod'
import logger from '@/lib/logger'
import { addToDLQ } from '@/lib/dlq'

const RezPurchaseSchema = z.object({
  rezUserId: z.string().min(1, 'rezUserId required'),
  merchantId: z.string().min(1, 'merchantId required'),
  scanEventId: z.string().min(1, 'scanEventId required'),
  purchaseAmount: z.number().positive('purchaseAmount must be positive'),
  purchaseTimestamp: z.number().int().positive('purchaseTimestamp required'),
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
    const parsed = RezPurchaseSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid payload', details: parsed.error.flatten() }, { status: 400 })
    }
    const { rezUserId, merchantId, scanEventId, purchaseAmount, purchaseTimestamp } = parsed.data
    const supabase = createServerClient()

    // Process the purchase event with DLQ on failure
    try {
      // Find scan event and create attribution record with purchase data
      const { data: scanEvent } = await supabase.from('scan_events').select('*').eq('id', scanEventId).single()
      if (scanEvent) {
        const purchaseId = `${rezUserId}_${merchantId}_${purchaseTimestamp}`
        // Idempotent: skip if this purchase was already recorded
        const { data: existing } = await supabase.from('attribution').select('id').eq('rez_purchase_id', purchaseId).maybeSingle()
        if (!existing) {
          await supabase.from('attribution').insert({
            scan_event_id: scanEventId,
            qr_id: scanEvent.qr_id,
            rez_purchase_id: purchaseId,
            revenue_amount: purchaseAmount,
            purchase_timestamp: purchaseTimestamp,
          })
        }
      }
    } catch (processErr) {
      // Log the error and add to DLQ for retry
      logger.error('[rez-purchase webhook] Processing failed, adding to DLQ:', processErr)
      await addToDLQ(supabase, 'rez-purchase', {
        rezUserId,
        merchantId,
        scanEventId,
        purchaseAmount,
        purchaseTimestamp,
      }, String(processErr))
      // Still return success to acknowledge the webhook
      return NextResponse.json({ success: true, queued: true })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    logger.error('[rez-purchase webhook] Unexpected error', err)
    return NextResponse.json({ success: false, error: 'Internal error' }, { status: 500 })
  }
}
