import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase'

// GET /api/v1/consultations/:bookingId
// Get booking details

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ bookingId: string }> }
) {
  try {
    const { bookingId } = await params

    if (!bookingId) {
      return NextResponse.json(
        { error: 'bookingId is required' },
        { status: 400 }
      )
    }

    const supabase = createClient()

    // Get booking with related data
    const { data: booking, error } = await supabase
      .from('consultation_bookings')
      .select(`
        *,
        consultation_types (
          id,
          name,
          description,
          mode,
          duration_minutes,
          coin_cost
        ),
        campaigns (
          id,
          name,
          brand_id
        )
      `)
      .eq('id', bookingId)
      .single()

    if (error || !booking) {
      return NextResponse.json(
        { error: 'Booking not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      booking: {
        id: booking.id,
        confirmationCode: booking.confirmation_code,
        status: booking.status,
        preferredDate: booking.preferred_date,
        preferredTime: booking.preferred_time,
        confirmedDate: booking.confirmed_date,
        confirmedTime: booking.confirmed_time,
        mode: booking.consultation_types?.mode,
        duration: booking.consultation_types?.duration_minutes,
        coinCost: booking.coin_cost,
        contactEmail: booking.contact_email,
        contactPhone: booking.contact_phone,
        notes: booking.notes,
        cancellationReason: booking.cancellation_reason,
        createdAt: booking.created_at,
        updatedAt: booking.updated_at,
        consultation: booking.consultation_types ? {
          id: booking.consultation_types.id,
          name: booking.consultation_types.name,
          description: booking.consultation_types.description,
        } : null,
        campaign: booking.campaigns ? {
          id: booking.campaigns.id,
          name: booking.campaigns.name,
        } : null,
      },
    })
  } catch (e) {
    console.error('[consultations/bookingId] error:', e)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// PATCH /api/v1/consultations/:bookingId
// Update booking (used for reschedule)
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ bookingId: string }> }
) {
  try {
    const { bookingId } = await params
    const body = await req.json()
    const { preferredDate, preferredTime, notes } = body

    if (!bookingId) {
      return NextResponse.json(
        { error: 'bookingId is required' },
        { status: 400 }
      )
    }

    const supabase = createClient()

    // Get existing booking
    const { data: existingBooking, error: fetchError } = await supabase
      .from('consultation_bookings')
      .select('*')
      .eq('id', bookingId)
      .single()

    if (fetchError || !existingBooking) {
      return NextResponse.json(
        { error: 'Booking not found' },
        { status: 404 }
      )
    }

    // Check if reschedulable
    if (!['pending', 'confirmed'].includes(existingBooking.status)) {
      return NextResponse.json(
        { error: 'Cannot reschedule a cancelled or completed booking' },
        { status: 400 }
      )
    }

    // Build update object
    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    }

    if (preferredDate) {
      updates.preferred_date = preferredDate
    }
    if (preferredTime) {
      updates.preferred_time = preferredTime
    }
    if (notes !== undefined) {
      updates.notes = notes
    }

    // Update booking
    const { data: updatedBooking, error: updateError } = await supabase
      .from('consultation_bookings')
      .update(updates)
      .eq('id', bookingId)
      .select()
      .single()

    if (updateError) {
      console.error('[consultations/bookingId] update error:', updateError)
      return NextResponse.json(
        { error: 'Failed to update booking' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Booking updated successfully',
      booking: {
        id: updatedBooking.id,
        confirmationCode: updatedBooking.confirmation_code,
        status: updatedBooking.status,
        preferredDate: updatedBooking.preferred_date,
        preferredTime: updatedBooking.preferred_time,
      },
    })
  } catch (e) {
    console.error('[consultations/bookingId] error:', e)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// DELETE /api/v1/consultations/:bookingId
// Cancel booking
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ bookingId: string }> }
) {
  try {
    const { bookingId } = await params

    if (!bookingId) {
      return NextResponse.json(
        { error: 'bookingId is required' },
        { status: 400 }
      )
    }

    // Get reason from query params
    const searchParams = req.nextUrl.searchParams
    const reason = searchParams.get('reason')

    const supabase = createClient()

    // Get existing booking
    const { data: existingBooking, error: fetchError } = await supabase
      .from('consultation_bookings')
      .select('*')
      .eq('id', bookingId)
      .single()

    if (fetchError || !existingBooking) {
      return NextResponse.json(
        { error: 'Booking not found' },
        { status: 404 }
      )
    }

    // Check if cancellable
    if (existingBooking.status === 'cancelled') {
      return NextResponse.json(
        { error: 'Booking is already cancelled' },
        { status: 400 }
      )
    }

    if (existingBooking.status === 'completed') {
      return NextResponse.json(
        { error: 'Cannot cancel a completed booking' },
        { status: 400 }
      )
    }

    // Cancel booking
    const { data: cancelledBooking, error: cancelError } = await supabase
      .from('consultation_bookings')
      .update({
        status: 'cancelled',
        cancellation_reason: reason || 'User requested cancellation',
        cancelled_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', bookingId)
      .select()
      .single()

    if (cancelError) {
      console.error('[consultations/bookingId] cancel error:', cancelError)
      return NextResponse.json(
        { error: 'Failed to cancel booking' },
        { status: 500 }
      )
    }

    // Refund coins if applicable
    if (cancelledBooking.coin_cost && cancelledBooking.coin_cost > 0) {
      await supabase.from('coin_transactions').insert({
        campaign_id: cancelledBooking.campaign_id,
        user_id: cancelledBooking.user_id,
        amount: cancelledBooking.coin_cost,
        coin_type: 'rez',
        transaction_type: 'credit',
        reason: 'consultation_cancellation_refund',
      })
    }

    return NextResponse.json({
      success: true,
      message: 'Booking cancelled successfully',
      refund: cancelledBooking.coin_cost > 0
        ? {
            amount: cancelledBooking.coin_cost,
            coinType: 'rez',
            note: 'Coins refunded to your wallet',
          }
        : null,
    })
  } catch (e) {
    console.error('[consultations/bookingId] delete error:', e)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
