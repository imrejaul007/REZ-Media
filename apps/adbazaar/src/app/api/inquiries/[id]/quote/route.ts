import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import logger from '@/lib/logger'
import { emailQuoteReceived } from '@/lib/email'
import { QuoteSchema } from '@/lib/schemas'
import { insertNotification } from '@/lib/notifications'

// POST /api/inquiries/[id]/quote
// Vendor responds with a price quote. Moves inquiry status to 'quoted'.

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: inquiryId } = await params
    const authHeader = req.headers.get('authorization') ?? ''
    const accessToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
    if (!accessToken) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const rawBody = await req.json()
    const parsed = QuoteSchema.safeParse(rawBody)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: parsed.error.flatten() },
        { status: 400 },
      )
    }
    const { quoteAmount, quoteMessage, validDays = 7 } = parsed.data

    const { data: inquiry } = await supabase
      .from('inquiries')
      .select('id, vendor_id, buyer_id, listing_id, status, listings(title)')
      .eq('id', inquiryId)
      .single()

    if (!inquiry) return NextResponse.json({ error: 'Inquiry not found' }, { status: 404 })
    if (inquiry.vendor_id !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    if (inquiry.status !== 'pending') return NextResponse.json({ error: 'Inquiry already actioned' }, { status: 400 })

    const validUntil = new Date()
    validUntil.setDate(validUntil.getDate() + validDays)

    const { data: updated, error } = await supabase
      .from('inquiries')
      .update({
        status: 'quoted',
        quote_amount: quoteAmount,
        quote_message: quoteMessage ?? null,
        quote_valid_until: validUntil.toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', inquiryId)
      .select()
      .single()

    if (error) {
      logger.error('[inquiries quote] Database error', { error: error.message })
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }

    // Notify buyer of quote received
    await insertNotification({
      user_id: inquiry.buyer_id,
      type: 'quote_received',
      title: 'Quote received',
      body: `Your inquiry received a quote of ₹${quoteAmount.toLocaleString('en-IN')}`,
      link: '/buyer/inquiries',
    }).catch((e) => logger.error('notification insert failed', e))

    // AB-H3 FIX: Fire email to buyer with proper error handling
    // Fetch users and send email, non-blocking but logged on failure
    const listingRaw = inquiry.listings as unknown
    const listingObj = Array.isArray(listingRaw) ? (listingRaw[0] as Record<string, string> | undefined ?? null) : (listingRaw as Record<string, string> | null)
    ;(async () => {
      try {
        const { data: users } = await supabase
          .from('users')
          .select('id, email, name')
          .in('id', [inquiry.buyer_id, inquiry.vendor_id])

        const buyer = users?.find((u) => u.id === inquiry.buyer_id)
        const vendor = users?.find((u) => u.id === inquiry.vendor_id)
        if (buyer?.email) {
          await emailQuoteReceived({
            buyerEmail: buyer.email,
            buyerName: buyer.name ?? 'there',
            vendorName: vendor?.name ?? 'Vendor',
            listingTitle: listingObj?.title ?? 'your listing',
            amount: quoteAmount,
            inquiryId,
          })
        }
      } catch (e) {
        logger.error('[inquiry/quote] emailQuoteReceived failed', e)
      }
    })()

    return NextResponse.json({ inquiry: updated })
  } catch (e) {
    logger.error('POST /api/inquiries/[id]/quote error', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
