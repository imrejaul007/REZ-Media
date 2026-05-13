import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@/lib/supabase'
import logger from '@/lib/logger'

// POST /api/vendor/listings/[id]/refresh
// Vendor confirms their listing is still current — resets freshness score to 100
// and bumps freshness_last_updated. This prevents auto-pause by the cron job.

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: listingId } = await params

    const authHeader = req.headers.get('authorization') ?? ''
    const accessToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
    if (!accessToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const userClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { global: { headers: { Authorization: `Bearer ${accessToken}` } } },
    )
    const { data: { user }, error: authError } = await userClient.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = createServerClient()

    // Verify ownership
    const { data: listing } = await supabase
      .from('listings')
      .select('id, vendor_id, status')
      .eq('id', listingId)
      .single()

    if (!listing || listing.vendor_id !== user.id) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const now = new Date().toISOString()
    const { data: updated, error } = await supabase
      .from('listings')
      .update({
        freshness_score: 100,
        freshness_last_updated: now,
        // Re-activate if it was auto-paused (status = 'paused' due to staleness)
        status: listing.status === 'paused' ? 'active' : listing.status,
        updated_at: now,
      })
      .eq('id', listingId)
      .select('id, freshness_score, freshness_last_updated, status')
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ listing: updated })
  } catch (e) {
    logger.error('POST /api/vendor/listings/[id]/refresh error', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
