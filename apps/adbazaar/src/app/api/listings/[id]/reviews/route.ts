import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import logger from '@/lib/logger'

// GET /api/listings/[id]/reviews
// Returns paginated reviews for a listing, with aggregated stats.

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: listingId } = await params
    const { searchParams } = new URL(req.url)
    const limit = Math.min(parseInt(searchParams.get('limit') ?? '20', 10), 50)
    const offset = parseInt(searchParams.get('offset') ?? '0', 10)

    const supabase = createServerClient()

    const [{ data: reviews, error, count }, { data: allRatings }] = await Promise.all([
      supabase
        .from('reviews')
        .select('id, rating, on_time_rating, proof_quality_rating, communication_rating, comment, created_at, users!reviews_reviewer_id_fkey(name)', { count: 'exact' })
        .eq('target_id', listingId)
        .eq('reviewer_role', 'buyer')
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1),
      // Separate query for true average across ALL reviews (not just this page)
      supabase
        .from('reviews')
        .select('rating')
        .eq('target_id', listingId)
        .eq('reviewer_role', 'buyer'),
    ])

    if (error) {
      logger.error('[listings reviews] Database error', { error: error.message })
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }

    const rows = reviews ?? []

    // Compute average from all reviews, not just the current page
    const allRows = allRatings ?? []
    const avgRating = allRows.length > 0
      ? allRows.reduce((s, r) => s + (r.rating ?? 0), 0) / allRows.length
      : 0

    const formattedReviews = rows.map(r => ({
      id: r.id,
      rating: r.rating,
      onTimeRating: r.on_time_rating,
      proofQualityRating: r.proof_quality_rating,
      communicationRating: r.communication_rating,
      comment: r.comment,
      reviewerName: (() => { const u = r.users as unknown; const obj = Array.isArray(u) ? (u[0] as Record<string, unknown> | undefined ?? null) : (u as Record<string, unknown> | null); return (obj?.name as string) ?? 'Anonymous' })(),
      createdAt: r.created_at,
    }))

    return NextResponse.json({
      reviews: formattedReviews,
      total: count ?? 0,
      avgRating: Math.round(avgRating * 10) / 10,
    })
  } catch (e) {
    logger.error('GET /api/listings/[id]/reviews error', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
