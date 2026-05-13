import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { BookingStatus } from '@/types'
import logger from '@/lib/logger'
import { insertNotification } from '@/lib/notifications'

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function GET(req: NextRequest, { params }: RouteContext) {
  try {
    const { id } = await params

    // Auth required — only buyer or vendor of this booking may view it
    const authHeader = req.headers.get('authorization') ?? ''
    const accessToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
    if (!accessToken) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: booking, error } = await supabase
      .from('bookings')
      .select(`
        *,
        listings(id, title, category, city, area),
        users!bookings_vendor_id_fkey(id, name, company_name),
        qr_codes(
          id, qr_slug, qr_image_url, coins_per_scan, visit_bonus_coins,
          total_scans, unique_scanners, is_active, created_at
        )
      `)
      .eq('id', id)
      .single()

    if (error || !booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
    }

    // Only buyer, vendor, or admin may view this booking
    const { data: userRow } = await supabase.from('users').select('role').eq('id', user.id).single()
    const isAdmin = userRow?.role === 'admin'
    const isParticipant = booking.buyer_id === user.id || booking.vendor_id === user.id
    if (!isAdmin && !isParticipant) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Aggregate scan stats
    const qrIds = Array.isArray(booking.qr_codes)
      ? booking.qr_codes.map((q: Record<string, unknown>) => q.id)
      : booking.qr_codes ? [booking.qr_codes.id] : []

    const scanStats = { total_scans: 0, unique_scanners: 0, store_visits: 0 }

    if (qrIds.length > 0) {
      const { data: scans } = await supabase
        .from('scan_events')
        .select('id, user_id, rez_app_opened')
        .in('qr_id', qrIds)

      if (scans) {
        scanStats.total_scans = scans.length
        scanStats.unique_scanners = new Set(scans.map(s => s.user_id).filter(Boolean)).size // AB3-M12 FIX: null user_id not counted as unique scanner
        scanStats.store_visits = scans.filter(s => s.rez_app_opened).length
      }
    }

    return NextResponse.json({ booking, scanStats })
  } catch (e) {
    logger.error('GET /api/bookings/[id] error', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  try {
    const { id } = await params

    // Auth via Bearer token
    const authHeader = req.headers.get('authorization') ?? ''
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    let body: Record<string, unknown>
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }
    const { action, status, notes } = body as { action?: string; status?: string; notes?: string }

    // Fetch current booking first
    const { data: current, error: fetchError } = await supabase
      .from('bookings')
      .select('id, status, proof_of_execution, proof_approved, buyer_id, vendor_id')
      .eq('id', id)
      .single()

    if (fetchError || !current) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
    }

    let updatePayload: Record<string, unknown> = {}

    if (action === 'approve_proof') {
      // Only the buyer who owns this booking may approve proof
      if (current.buyer_id !== user.id) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
      if (current.status !== BookingStatus.Executing) {
        return NextResponse.json({ error: 'Can only approve proof for executing bookings' }, { status: 400 })
      }
      updatePayload = {
        proof_approved: true,
        proof_approved_at: new Date().toISOString(),
        status: BookingStatus.Completed,
      }
    } else if (action === 'raise_dispute') {
      // Only the buyer who owns this booking may raise a dispute
      if (current.buyer_id !== user.id) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
      const disputeableStatuses = [BookingStatus.Executing, BookingStatus.Completed]
      if (!disputeableStatuses.includes(current.status as BookingStatus)) {
        return NextResponse.json({ error: 'Can only raise a dispute for bookings that are executing or completed' }, { status: 400 })
      }
      updatePayload = {
        status: BookingStatus.Disputed,
        notes: notes ?? 'Dispute raised by buyer',
      }
      // AB2-L5 FIX: Properly await notification without silently swallowing errors.
      // The insertNotification function already handles retries internally.
      try {
        await insertNotification({
          user_id: current.vendor_id,
          type: 'dispute_raised',
          title: 'Dispute raised',
          body: notes ? `Buyer raised a dispute: "${notes}"` : 'A buyer has raised a dispute on your booking.',
          link: '/vendor/bookings',
        })
      } catch (e) {
        // Log but don't fail the dispute - notification will be retried via queue
        logger.error('notification insert failed for dispute', e, { bookingId: id })
      }
    } else if (action === 'vendor_proof_uploaded') {
      // Only the vendor who owns this booking may mark proof as uploaded
      if (current.vendor_id !== user.id) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
      // AB2-H10 FIX: Only advance to Executing from confirmed/paid — never regress completed bookings
      if (current.status !== BookingStatus.Confirmed && current.status !== BookingStatus.Paid) {
        return NextResponse.json(
          { error: 'Proof can only be uploaded for confirmed or paid bookings' },
          { status: 400 },
        )
      }
      updatePayload = {
        status: BookingStatus.Executing,
      }
    } else if (status) {
      // Direct status update — admin only
      const { data: callerRow } = await supabase.from('users').select('role').eq('id', user.id).single()
      if (callerRow?.role !== 'admin') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
      const validStatuses = Object.values(BookingStatus) as string[]
      if (!validStatuses.includes(status)) {
        return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
      }
      updatePayload = { status: status as BookingStatus }
      if (notes) updatePayload.notes = notes
    } else {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }

    const { data: updated, error: updateError } = await supabase
      .from('bookings')
      .update({ ...updatePayload, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()

    if (updateError || !updated) {
      logger.error('Booking update error', updateError)
      return NextResponse.json({ error: 'Failed to update booking' }, { status: 500 })
    }

    return NextResponse.json({ booking: updated })
  } catch (e) {
    logger.error('PATCH /api/bookings/[id] error', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
