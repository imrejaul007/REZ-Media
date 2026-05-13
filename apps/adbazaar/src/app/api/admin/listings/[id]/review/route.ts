import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import logger from '@/lib/logger'
import { UserRole } from '@/types'
import { insertNotification } from '@/lib/notifications'

interface ReviewBody {
  action: 'approve' | 'reject'
  reason?: string
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Verify authenticated session via Bearer token
  const authHeader = req.headers.get('authorization') ?? ''
  const accessToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (!accessToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Verify admin role
  const { data: userData, error: userError } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  if (userError || !userData || userData.role !== UserRole.Admin) {
    return NextResponse.json({ error: 'Forbidden: admin access required' }, { status: 403 })
  }

  // Parse and validate body
  let body: ReviewBody
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const { action, reason } = body

  if (action !== 'approve' && action !== 'reject') {
    return NextResponse.json(
      { error: 'Invalid action. Must be "approve" or "reject".' },
      { status: 400 }
    )
  }

  if (action === 'reject' && !reason?.trim()) {
    return NextResponse.json(
      { error: 'Rejection reason is required.' },
      { status: 400 }
    )
  }

  const { id: listingId } = await params

  // Verify listing exists
  const { data: listing, error: listingError } = await supabase
    .from('listings')
    .select('id, status')
    .eq('id', listingId)
    .single()

  if (listingError || !listing) {
    return NextResponse.json({ error: 'Listing not found' }, { status: 404 })
  }

  const newStatus = action === 'approve' ? 'active' : 'rejected'
  const updatePayload: Record<string, unknown> = {
    status: newStatus,
    updated_at: new Date().toISOString(),
  }
  if (action === 'reject' && reason) {
    updatePayload.rejection_reason = reason.trim()
  }

  const { error: updateError } = await supabase
    .from('listings')
    .update(updatePayload)
    .eq('id', listingId)

  if (updateError) {
    return NextResponse.json(
      { error: 'Failed to update listing: ' + updateError.message },
      { status: 500 }
    )
  }

  // Notify vendor
  const { data: listingFull } = await supabase
    .from('listings')
    .select('vendor_id, title')
    .eq('id', listingId)
    .single()

  if (listingFull?.vendor_id) {
    await insertNotification({
      user_id: listingFull.vendor_id,
      type: action === 'approve' ? 'listing_approved' : 'listing_rejected',
      title: action === 'approve' ? 'Listing approved' : 'Listing rejected',
      body: action === 'approve'
        ? `Your listing "${listingFull.title}" has been approved and is now live.`
        : `Your listing "${listingFull.title}" was rejected. Reason: ${reason}`,
      link: '/vendor/listings',
    }).catch((e) => logger.error('notification insert failed', e))
  }

  return NextResponse.json({ success: true, listingId, status: newStatus })
}
