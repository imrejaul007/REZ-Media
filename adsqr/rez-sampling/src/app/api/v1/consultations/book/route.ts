import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase'

// POST /api/v1/consultations/book
// Book a consultation

interface BookConsultationRequest {
  campaignId: string
  userId: string
  consultationTypeId: string
  preferredDate: string
  preferredTime?: string
  contactEmail?: string
  contactPhone?: string
  notes?: string
}

export async function POST(req: NextRequest) {
  try {
    const body: BookConsultationRequest = await req.json()
    const {
      campaignId,
      userId,
      consultationTypeId,
      preferredDate,
      preferredTime,
      contactEmail,
      contactPhone,
      notes,
    } = body

    if (!campaignId || !userId || !consultationTypeId || !preferredDate) {
      return NextResponse.json(
        { error: 'campaignId, userId, consultationTypeId, and preferredDate are required' },
        { status: 400 }
      )
    }

    const supabase = createClient()

    // Get consultation type details
    const { data: consultationType, error: typeError } = await supabase
      .from('consultation_types')
      .select('*')
      .eq('id', consultationTypeId)
      .eq('campaign_id', campaignId)
      .single()

    if (typeError || !consultationType) {
      return NextResponse.json(
        { error: 'Consultation type not found' },
        { status: 404 }
      )
    }

    // Check if user already has a booking for this type
    const { data: existingBooking } = await supabase
      .from('consultation_bookings')
      .select('id, status')
      .eq('consultation_type_id', consultationTypeId)
      .eq('user_id', userId)
      .in('status', ['pending', 'confirmed'])
      .single()

    if (existingBooking) {
      return NextResponse.json(
        { error: 'You already have a booking for this consultation type', bookingId: existingBooking.id, status: existingBooking.status },
        { status: 409 }
      )
    }

    // Check if slot is available for the preferred date
    const preferredDateObj = new Date(preferredDate)
    const startOfDay = preferredDateObj.toISOString().split('T')[0]
    const endOfDay = new Date(preferredDateObj.getTime() + 86400000).toISOString().split('T')[0]

    const { count: dayBookings } = await supabase
      .from('consultation_bookings')
      .select('*', { count: 'exact', head: true })
      .eq('consultation_type_id', consultationTypeId)
      .gte('preferred_date', startOfDay)
      .lt('preferred_date', endOfDay)
      .in('status', ['pending', 'confirmed'])

    if (dayBookings && dayBookings >= (consultationType.max_bookings_per_day || 10)) {
      return NextResponse.json(
        { error: 'No slots available for this date' },
        { status: 400 }
      )
    }

    // Check user's coin balance if there's a cost
    if (consultationType.coin_cost && consultationType.coin_cost > 0) {
      const { data: userBalance } = await supabase
        .from('coin_transactions')
        .select('amount')
        .eq('user_id', userId)
        .eq('transaction_type', 'credit')

      const totalEarned = userBalance?.reduce((sum, t) => sum + t.amount, 0) || 0
      const { data: spent } = await supabase
        .from('coin_transactions')
        .select('amount')
        .eq('user_id', userId)
        .eq('transaction_type', 'debit')

      const totalSpent = spent?.reduce((sum, t) => sum + t.amount, 0) || 0
      const availableCoins = totalEarned - totalSpent

      if (availableCoins < (consultationType.coin_cost || 0)) {
        return NextResponse.json(
          { error: 'Insufficient coins', required: consultationType.coin_cost, available: availableCoins },
          { status: 400 }
        )
      }
    }

    // Generate confirmation code
    const confirmationCode = generateConfirmationCode()

    // Create booking
    const { data: booking, error: bookingError } = await supabase
      .from('consultation_bookings')
      .insert({
        consultation_type_id: consultationTypeId,
        campaign_id: campaignId,
        user_id: userId,
        preferred_date: preferredDate,
        preferred_time: preferredTime || null,
        contact_email: contactEmail || null,
        contact_phone: contactPhone || null,
        notes,
        status: 'pending',
        confirmation_code: confirmationCode,
        duration_minutes: consultationType.duration_minutes,
        mode: consultationType.mode,
        coin_cost: consultationType.coin_cost || 0,
      })
      .select(`
        *,
        consultation_types (
          name,
          description,
          mode,
          duration_minutes
        )
      `)
      .single()

    if (bookingError) {
      console.error('[consultations/book] insert error:', bookingError)
      return NextResponse.json(
        { error: 'Failed to create booking' },
        { status: 500 }
      )
    }

    // Deduct coins if there's a cost
    if (consultationType.coin_cost && consultationType.coin_cost > 0) {
      await supabase.from('coin_transactions').insert({
        campaign_id: campaignId,
        user_id: userId,
        amount: consultationType.coin_cost,
        coin_type: 'rez',
        transaction_type: 'debit',
        reason: 'consultation_booking',
      })
    }

    // Update consultation type day bookings count
    await supabase.rpc('increment_consultation_day_bookings', {
      p_consultation_type_id: consultationTypeId,
    })

    return NextResponse.json({
      success: true,
      booking: {
        id: booking.id,
        confirmationCode: booking.confirmation_code,
        status: booking.status,
        preferredDate: booking.preferred_date,
        preferredTime: booking.preferred_time,
        mode: booking.consultation_types?.mode,
        duration: booking.consultation_types?.duration_minutes,
        coinCost: booking.coin_cost,
        consultationName: booking.consultation_types?.name,
      },
      instructions: {
        message: 'You will receive a confirmation via email. Please arrive 10 minutes early.',
        modeDetails: getModeInstructions(booking.consultation_types?.mode),
      },
    })
  } catch (e) {
    console.error('[consultations/book] error:', e)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

function generateConfirmationCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let code = 'CNS-'
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return code
}

function getModeInstructions(mode: string): string {
  switch (mode) {
    case 'in_store':
      return 'Please visit the store at your scheduled time.'
    case 'video':
      return 'You will receive a video call link via email.'
    case 'phone':
      return 'You will receive a call at your registered phone number.'
    default:
      return 'Please contact the store for more details.'
  }
}
