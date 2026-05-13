import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import logger from '@/lib/logger'
import { InquiryCreateSchema } from '@/lib/schemas'
import { insertNotification } from '@/lib/notifications'

// POST /api/inquiries  — buyer submits inquiry for quote-based listing
// GET  /api/inquiries  — list inquiries (buyer or vendor, via query param role)

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization') ?? ''
    const accessToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
    if (!accessToken) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const rawBody = await req.json()
    const parsed = InquiryCreateSchema.safeParse(rawBody)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: parsed.error.flatten() },
        { status: 400 },
      )
    }
    const { listingId, message, budget, startDate, endDate, requirements } = parsed.data

    const { data: listing } = await supabase
      .from('listings')
      .select('id, vendor_id, title, pricing_model, status')
      .eq('id', listingId)
      .single()

    if (!listing || listing.status !== 'active') {
      return NextResponse.json({ error: 'Listing not found or inactive' }, { status: 404 })
    }

    if (!['quote', 'both'].includes(listing.pricing_model)) {
      return NextResponse.json({ error: 'This listing does not accept inquiries. Use the booking flow instead.' }, { status: 400 })
    }

    // Prevent self-inquiry
    if (listing.vendor_id === user.id) {
      return NextResponse.json({ error: 'You cannot send an inquiry for your own listing' }, { status: 400 })
    }

    // AB2-H9 FIX: Remove the pre-check (race-prone). Uniqueness is now enforced
    // by the partial unique index idx_inquiries_listing_buyer_pending (migration 011).
    // If a concurrent request creates a duplicate first, the DB rejects our insert
    // with a unique_violation (code 23505) and we return 409 here.
    let inquiry
    try {
      const result = await supabase
        .from('inquiries')
        .insert({
          listing_id: listingId,
          buyer_id: user.id,
          vendor_id: listing.vendor_id,
          message,
          budget: budget ?? null,
          start_date: startDate ?? null,
          end_date: endDate ?? null,
          requirements: requirements ?? null,
          status: 'pending',
        })
        .select()
        .single()
      inquiry = result.data
      if (result.error) {
        // Supabase error codes: https://www.postgresql.org/docs/current/errcodes-appendix.html
        // '23505' = unique_violation
        if ((result.error as { code?: string }).code === '23505') {
          return NextResponse.json({ error: 'You already have an open inquiry for this listing' }, { status: 409 })
        }
        return NextResponse.json({ error: result.error.message }, { status: 500 })
      }
    } catch (e) {
      // Catch direct PostgreSQL errors that may be thrown by the Supabase client
      if (typeof e === 'object' && e !== null && 'code' in e && (e as Record<string, unknown>).code === '23505') {
        return NextResponse.json({ error: 'You already have an open inquiry for this listing' }, { status: 409 })
      }
      throw e
    }

    if (!inquiry) {
      return NextResponse.json({ error: 'Failed to create inquiry' }, { status: 500 })
    }

    // AB2-L5 FIX: Properly await notification without silently swallowing errors.
    // The insertNotification function already handles retries internally,
    // so we just await and let it handle errors.
    try {
      await insertNotification({
        user_id: listing.vendor_id,
        type: 'new_inquiry',
        title: 'New inquiry received',
        body: `Someone sent an inquiry about "${listing.title}"`,
        link: '/vendor/inquiries',
      })
    } catch (e) {
      // Log but don't fail the request - notification will be retried via queue
      logger.error('notification insert failed for inquiry', e, { inquiryId: inquiry?.id })
    }

    return NextResponse.json({ inquiry }, { status: 201 })
  } catch (e) {
    logger.error('POST /api/inquiries error', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization') ?? ''
    const accessToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
    if (!accessToken) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    // AB3-H8 FIX: validate role param to avoid falling through to unintended query
    const roleRaw = new URL(req.url).searchParams.get('role') ?? 'buyer'
    if (roleRaw && !['buyer', 'vendor'].includes(roleRaw)) {
      return NextResponse.json({ error: 'Invalid role parameter' }, { status: 400 })
    }
    const role = roleRaw

    const query = supabase
      .from('inquiries')
      .select('*, listings(title, city, area, category)')
      .order('created_at', { ascending: false })

    const { data, error } = await (role === 'vendor'
      ? query.eq('vendor_id', user.id)
      : query.eq('buyer_id', user.id))

    if (error) {
      logger.error('[inquiries] Database error', { error: error.message })
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }

    return NextResponse.json({ inquiries: data ?? [] })
  } catch (e) {
    logger.error('GET /api/inquiries error', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
