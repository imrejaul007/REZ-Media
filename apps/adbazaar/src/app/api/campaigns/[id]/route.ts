import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import logger from '@/lib/logger'
import { checkBudgetAlerts } from '@/lib/budgetAlerts'
import { insertNotification } from '@/lib/notifications'
import { sendPushNotification } from '@/lib/pushNotifications'

async function authenticate(req: NextRequest) {
  const authHeader = req.headers.get('authorization') ?? ''
  const accessToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (!accessToken) return null
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  return error || !user ? null : user
}

// PATCH /api/campaigns/[id] — add bookings, rename, update budget, update status
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await authenticate(req)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id: campaignId } = await params
    const body = await req.json()
    const { name, budget, status, addBookingIds, removeBookingIds } = body

    const supabase = await createClient()

    const { data: campaign } = await supabase
      .from('campaigns')
      .select('id, buyer_id, booking_ids')
      .eq('id', campaignId)
      .single()

    if (!campaign || campaign.buyer_id !== user.id) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    let bookingIds: string[] = campaign.booking_ids ?? []

    // Add bookings (validate ownership)
    if (Array.isArray(addBookingIds) && addBookingIds.length > 0) {
      const { data: toAdd } = await supabase
        .from('bookings')
        .select('id')
        .eq('buyer_id', user.id)
        .in('id', addBookingIds)
      const addIds = (toAdd ?? []).map((b) => b.id)
      if (addIds.length > 0) {
        // AB3-C3 FIX: update DB BEFORE updating in-memory state.
        // Previously bookingIds was updated at line 54 before the await, so a failed update
        // left the local array inconsistent with the DB. Now the DB update happens first,
        // and only on success does bookingIds reflect the new IDs.
        const { error: linkError } = await supabase
          .from('bookings')
          .update({ campaign_id: campaignId })
          .in('id', addIds)
        if (linkError) {
          return NextResponse.json(
            { error: 'Failed to link bookings to campaign' },
            { status: 500 },
          )
        }
        // Only update local state after DB update succeeds
        bookingIds = [...new Set([...bookingIds, ...addIds])]
      }
    }

    // Remove bookings — AB3-C1 FIX: only remove bookings owned by this buyer
    // AB3-C3 FIX: same DB-first pattern as add case — await and check before updating local state
    if (Array.isArray(removeBookingIds) && removeBookingIds.length > 0) {
      const { error: unlinkError } = await supabase
        .from('bookings')
        .update({ campaign_id: null })
        .eq('buyer_id', user.id) // AB3-C1 FIX: ownership filter prevents IDOR
        .in('id', removeBookingIds)
      if (unlinkError) {
        return NextResponse.json(
          { error: 'Failed to unlink bookings from campaign' },
          { status: 500 },
        )
      }
      // Only update local state after DB update succeeds
      bookingIds = bookingIds.filter((id) => !removeBookingIds.includes(id))
    }

    // AB2-M15 FIX: recalculate total_spent whenever booking_ids changes by summing
    // the amount of all remaining bookings linked to this campaign.
    const totalSpentRes = await supabase
      .from('bookings')
      .select('amount')
      .eq('campaign_id', campaignId)
      .in('id', bookingIds)
    const totalSpent = (totalSpentRes.data ?? []).reduce(
      (sum: number, b: { amount: number | null }) => sum + (b.amount ?? 0),
      0,
    )

    const update: Record<string, unknown> = {
      booking_ids: bookingIds,
      total_spent: totalSpent, // AB2-M15 FIX: keep total_spent in sync with actual booking amounts
      updated_at: new Date().toISOString(),
    }
    if (name) update.name = name.trim()
    if (budget !== undefined) update.budget = budget
    // AB3-H3 FIX: validate status against allowed values
    if (status) {
      if (!['active', 'paused', 'completed'].includes(status)) {
        return NextResponse.json({ error: 'Invalid status' }, { status: 422 })
      }
      update.status = status
    }

    const { data: updated, error } = await supabase
      .from('campaigns')
      .update(update)
      .eq('id', campaignId)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Check for budget alerts after updating the campaign
    const alert = await checkBudgetAlerts(campaignId)
    if (alert) {
      // Create in-app notification
      await insertNotification({
        user_id: alert.buyerId,
        type: 'budget_alert',
        title: `Budget Alert: ${alert.threshold}% Reached`,
        body: `Your campaign "${alert.campaignName}" has reached ${alert.threshold}% of its budget (Rs. ${alert.spent.toLocaleString('en-IN')} of Rs. ${alert.budget.toLocaleString('en-IN')}).`,
        link: `/buyer/campaigns/${campaignId}`,
      })

      // Also try to send push notification
      await sendPushNotification(alert.buyerId, {
        title: `Budget Alert: ${alert.threshold}% Reached`,
        body: `Your campaign "${alert.campaignName}" has reached ${alert.threshold}% of its budget.`,
        data: {
          type: 'budget_alert',
          campaignId,
          threshold: alert.threshold,
        },
      })
    }

    return NextResponse.json({ campaign: updated })
  } catch (e) {
    logger.error('PATCH /api/campaigns/[id] error', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/campaigns/[id]
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await authenticate(req)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id: campaignId } = await params
    const supabase = await createClient()

    const { data: campaign } = await supabase
      .from('campaigns')
      .select('id, buyer_id, booking_ids')
      .eq('id', campaignId)
      .single()

    if (!campaign || campaign.buyer_id !== user.id) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    // Unlink bookings
    // AB3-C3 FIX: await and check errors before deleting the campaign.
    // If unlinking fails but we delete the campaign, bookings are orphaned with a dangling campaign_id.
    if ((campaign.booking_ids ?? []).length > 0) {
      // AB3-C1 FIX (defense-in-depth): also filter by buyer_id even though campaign.buyer_id
      // was already verified at line 116. Defense in depth — no trust of data derived from user input.
      const { error: unlinkError } = await supabase
        .from('bookings')
        .update({ campaign_id: null })
        .eq('buyer_id', campaign.buyer_id)
        .in('id', campaign.booking_ids)
      if (unlinkError) {
        return NextResponse.json(
          { error: 'Failed to unlink bookings before deleting campaign' },
          { status: 500 },
        )
      }
    }

    const { error: deleteError } = await supabase
      .from('campaigns')
      .delete()
      .eq('id', campaignId)
    if (deleteError) {
      return NextResponse.json({ error: 'Failed to delete campaign' }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (e) {
    logger.error('DELETE /api/campaigns/[id] error', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
