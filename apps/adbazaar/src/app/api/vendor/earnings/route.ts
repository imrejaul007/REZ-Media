import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@/lib/supabase'
import logger from '@/lib/logger'

// GET /api/vendor/earnings
// Aggregates all earnings from vendor_ledger for the authenticated vendor.
// AB-A1 FIX: Now uses vendor_ledger table which accounts for refunds automatically.
// Returns: monthly breakdown, status totals, recent payouts.

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization') ?? ''
    const accessToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
    if (!accessToken) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const userClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { global: { headers: { Authorization: `Bearer ${accessToken}` } } },
    )
    const { data: { user }, error: authError } = await userClient.auth.getUser()
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const supabase = createServerClient()

    // AB-A1 FIX: Use vendor_ledger for accurate earnings calculation that accounts for refunds
    // Fall back to bookings table if ledger is not populated yet
    const { data: ledgerEntries, error: ledgerError } = await supabase
      .from('vendor_ledger')
      .select('id, entry_type, amount, description, status, created_at, booking_id, reference_id')
      .eq('vendor_id', user.id)
      .in('entry_type', ['earning', 'refund', 'payout'])
      .order('created_at', { ascending: false })

    const hasLedgerData = !ledgerError && ledgerEntries && ledgerEntries.length > 0

    if (hasLedgerData) {
      // AB-A1 FIX: Calculate earnings from ledger (refund-adjusted)
      const rows = ledgerEntries ?? []

      // Totals from ledger
      const totalRevenue = rows
        .filter(b => b.entry_type === 'earning' && b.status !== 'cancelled')
        .reduce((s, b) => s + Number(b.amount ?? 0), 0)
      const totalRefunds = rows
        .filter(b => b.entry_type === 'refund' && b.status !== 'cancelled')
        .reduce((s, b) => s + Math.abs(Number(b.amount ?? 0)), 0)
      const netEarnings = totalRevenue - totalRefunds

      // Monthly breakdown from ledger (last 6 months)
      const monthlyMap = new Map<string, { earned: number; refunded: number; count: number }>()
      for (const b of rows) {
        const month = b.created_at.slice(0, 7) // YYYY-MM
        const existing = monthlyMap.get(month) ?? { earned: 0, refunded: 0, count: 0 }
        if (b.entry_type === 'earning') {
          existing.earned += Number(b.amount ?? 0)
        } else if (b.entry_type === 'refund') {
          existing.refunded += Math.abs(Number(b.amount ?? 0))
        }
        existing.count += 1
        monthlyMap.set(month, existing)
      }

      const monthlyTrend = Array.from(monthlyMap.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .slice(-6)
        .map(([month, data]) => ({ month, ...data }))

      // Entry type breakdown
      const typeBreakdown: Record<string, { count: number; amount: number }> = {}
      for (const b of rows) {
        const t = b.entry_type
        if (!typeBreakdown[t]) typeBreakdown[t] = { count: 0, amount: 0 }
        typeBreakdown[t].count += 1
        typeBreakdown[t].amount += Number(b.amount ?? 0)
      }

      // Recent transactions (last 10)
      const recentTransactions = rows.slice(0, 10).map(b => ({
        ledgerId: b.id,
        entryType: b.entry_type,
        amount: Number(b.amount ?? 0),
        description: b.description ?? '',
        bookingId: b.booking_id ?? null,
        referenceId: b.reference_id ?? null,
        status: b.status,
        date: b.created_at,
      }))

      return NextResponse.json({
        totalRevenue,
        totalRefunds,
        netEarnings,
        pendingPayout: 0, // Would need additional logic with payout entries
        releasedPayout: rows
          .filter(b => b.entry_type === 'payout' && b.status === 'settled')
          .reduce((s, b) => s + Math.abs(Number(b.amount ?? 0)), 0),
        totalBookings: rows.filter(b => b.entry_type === 'earning').length,
        monthlyTrend,
        typeBreakdown,
        recentTransactions,
        source: 'ledger',
      })
    }

    // Fallback: Use bookings table if ledger is empty (legacy data migration scenario)
    const { data: bookings, error } = await supabase
      .from('bookings')
      .select('id, amount, vendor_payout, commission_amount, status, proof_approved, payout_id, created_at, listings(title, city)')
      .eq('vendor_id', user.id)
      .not('status', 'in', '(inquiry,cancelled)')
      .order('created_at', { ascending: false })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const rows = bookings ?? []

    // Totals
    const totalRevenue = rows
      .filter(b => b.status !== 'disputed' && b.status !== 'cancelled')
      .reduce((s, b) => s + Number(b.vendor_payout ?? 0), 0)
    const pendingPayout = rows
      .filter(b => ['confirmed', 'executing'].includes(b.status)) // AB-P3 FIX: exclude 'paid' — payout only initiated after proof_approved + completed
      .reduce((s, b) => s + Number(b.vendor_payout ?? 0), 0)
    const releasedPayout = rows
      .filter(b => b.status === 'completed' && b.proof_approved)
      .reduce((s, b) => s + Number(b.vendor_payout ?? 0), 0)

    // Monthly breakdown (last 6 months)
    const monthlyMap = new Map<string, { booked: number; released: number; count: number }>()
    for (const b of rows) {
      const month = b.created_at.slice(0, 7) // YYYY-MM
      const existing = monthlyMap.get(month) ?? { booked: 0, released: 0, count: 0 }
      existing.booked += Number(b.vendor_payout ?? 0)
      if (b.status === 'completed') existing.released += Number(b.vendor_payout ?? 0)
      existing.count += 1
      monthlyMap.set(month, existing)
    }

    const monthlyTrend = Array.from(monthlyMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-6)
      .map(([month, data]) => ({ month, ...data }))

    // Status breakdown
    const statusBreakdown: Record<string, { count: number; amount: number }> = {}
    for (const b of rows) {
      const s = b.status
      if (!statusBreakdown[s]) statusBreakdown[s] = { count: 0, amount: 0 }
      statusBreakdown[s].count += 1
      statusBreakdown[s].amount += Number(b.vendor_payout ?? 0)
    }

    // Recent payouts (completed bookings)
    const recentPayouts = rows
      .filter(b => b.status === 'completed')
      .slice(0, 10)
      .map(b => {
        const lr = b.listings as unknown
        const lo = Array.isArray(lr) ? (lr[0] as Record<string, unknown> | undefined ?? null) : (lr as Record<string, unknown> | null)
        return {
          bookingId: b.id,
          listingTitle: (lo?.title as string) ?? 'Unknown',
          city: (lo?.city as string) ?? '',
          amount: Number(b.vendor_payout ?? 0),
          bookingTotal: Number(b.amount ?? 0),
          date: b.created_at,
          payoutId: b.payout_id ?? null,
          proofApproved: b.proof_approved ?? false,
        }
      })

    return NextResponse.json({
      totalRevenue,
      totalRefunds: 0, // Legacy mode - refunds not tracked in this fallback
      netEarnings: totalRevenue,
      pendingPayout,
      releasedPayout,
      totalBookings: rows.length,
      monthlyTrend,
      statusBreakdown,
      recentPayouts,
      source: 'bookings_fallback',
    })
  } catch (e) {
    logger.error('GET /api/vendor/earnings error', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
