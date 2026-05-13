/**
 * Dead Letter Queue (DLQ) for failed webhook processing
 *
 * Stores failed webhook events in Supabase for later retry.
 * In production, consider using Redis or a proper message queue.
 */

import logger from './logger'
import { SupabaseClient } from '@supabase/supabase-js'

export interface DLQEntry {
  id: string
  event: string
  payload: Record<string, unknown>
  error: string
  attempts: number
  created_at: string
}

/**
 * Add a failed event to the DLQ for later retry
 */
export async function addToDLQ(
  supabase: SupabaseClient,
  event: string,
  payload: Record<string, unknown>,
  error: string
): Promise<void> {
  const { error: insertError } = await supabase.from('dlq_entries').insert({
    id: crypto.randomUUID(),
    event,
    payload,
    error: error.slice(0, 1000), // Truncate error message
    attempts: 1,
    created_at: new Date().toISOString(),
  })

  if (insertError) {
    // If DLQ insert fails, log it but don't throw - we don't want to fail the webhook ack
    logger.error('[DLQ] Failed to add entry to DLQ', { error: String(insertError) })
  }
}

/**
 * Retry failed DLQ entries by calling the processor function
 * Returns counts of retried and failed entries
 */
export async function retryDLQ(
  supabase: SupabaseClient,
  processor: (entry: DLQEntry) => Promise<void>
): Promise<{ retried: number; failed: number }> {
  const { data, error } = await supabase
    .from('dlq_entries')
    .select('*')
    .eq('attempts', 1) // Only retry entries that have been attempted once
    .order('created_at', { ascending: true })
    .limit(100)

  if (error || !data?.length) {
    return { retried: 0, failed: 0 }
  }

  let retried = 0
  let failed = 0

  for (const entry of data) {
    try {
      await processor(entry as DLQEntry)
      // Success - delete the entry from DLQ
      await supabase.from('dlq_entries').delete().eq('id', entry.id)
      retried++
    } catch (e) {
      // Failed again - increment attempts and update error
      await supabase
        .from('dlq_entries')
        .update({
          attempts: 2,
          error: String(e).slice(0, 1000),
        })
        .eq('id', entry.id)
      failed++
    }
  }

  return { retried, failed }
}

/**
 * Process a single DLQ entry - used for both purchase and visit events
 */
export async function processDLQEntry(
  entry: DLQEntry,
  supabase: SupabaseClient
): Promise<void> {
  switch (entry.event) {
    case 'rez-purchase':
      await processPurchaseRetry(entry, supabase)
      break
    case 'rez-visit':
      await processVisitRetry(entry, supabase)
      break
    default:
      throw new Error(`Unknown DLQ event type: ${entry.event}`)
  }
}

/**
 * Retry processing a purchase event
 */
async function processPurchaseRetry(
  entry: DLQEntry,
  supabase: SupabaseClient
): Promise<void> {
  const { rezUserId, merchantId, scanEventId, purchaseAmount, purchaseTimestamp } = entry.payload as {
    rezUserId: string
    merchantId: string
    scanEventId: string
    purchaseAmount: number
    purchaseTimestamp: number
  }

  // Find scan event and create attribution record with purchase data
  const { data: scanEvent } = await supabase
    .from('scan_events')
    .select('*')
    .eq('id', scanEventId)
    .single()

  if (!scanEvent) {
    throw new Error(`Scan event not found: ${scanEventId}`)
  }

  const purchaseId = `${rezUserId}_${merchantId}_${purchaseTimestamp}`

  // Idempotent: skip if this purchase was already recorded
  const { data: existing } = await supabase
    .from('attribution')
    .select('id')
    .eq('rez_purchase_id', purchaseId)
    .maybeSingle()

  if (existing) {
    // Already processed, this is fine
    return
  }

  // AB-D2 FIX: Look up booking_id from qr_codes for proper attribution linking
  const { data: qrCode } = await supabase
    .from('qr_codes')
    .select('booking_id')
    .eq('id', scanEvent.qr_id)
    .single()

  await supabase.from('attribution').insert({
    scan_event_id: scanEventId,
    qr_id: scanEvent.qr_id,
    booking_id: qrCode?.booking_id ?? null, // AB-D2 FIX: link to booking
    rez_purchase_id: purchaseId,
    revenue_amount: purchaseAmount,
    purchase_timestamp: purchaseTimestamp,
  })
}

/**
 * Retry processing a visit event
 */
async function processVisitRetry(
  entry: DLQEntry,
  supabase: SupabaseClient
): Promise<void> {
  const { rezUserId, merchantId, scanEventId, visitTimestamp } = entry.payload as {
    rezUserId: string
    merchantId: string
    scanEventId: string
    visitTimestamp: number
  }

  // Find scan event
  const { data: scanEvent } = await supabase
    .from('scan_events')
    .select('*')
    .eq('id', scanEventId)
    .single()

  if (!scanEvent) {
    throw new Error(`Scan event not found: ${scanEventId}`)
  }

  const visitId = `${rezUserId}_${merchantId}_${visitTimestamp}`

  // Idempotent: skip if this visit was already recorded
  const { data: existing } = await supabase
    .from('attribution')
    .select('id')
    .eq('rez_visit_id', visitId)
    .maybeSingle()

  if (existing) {
    // Already processed, this is fine
    return
  }

  // AB-D2 FIX: Look up booking_id from qr_codes for proper attribution linking
  const { data: qrCode } = await supabase
    .from('qr_codes')
    .select('booking_id')
    .eq('id', scanEvent.qr_id)
    .single()

  await supabase.from('attribution').insert({
    scan_event_id: scanEventId,
    qr_id: scanEvent.qr_id,
    booking_id: qrCode?.booking_id ?? null, // AB-D2 FIX: link to booking
    rez_visit_id: visitId,
    visit_timestamp: visitTimestamp,
  })
}
