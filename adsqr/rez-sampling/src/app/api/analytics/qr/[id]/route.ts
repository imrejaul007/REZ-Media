// QR Analytics API - AdsQr MVP Phase 3
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase'

// GET /api/analytics/qr/[id]
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { searchParams } = new URL(req.url)
  const range = searchParams.get('range') || '30d'

  const supabase = createClient()

  // Get QR code and verify access
  const { data: qr } = await supabase
    .from('qr_codes')
    .select('campaign_id, campaigns(brand_id)')
    .eq('id', id)
    .single()

  if (!qr) {
    return NextResponse.json({ error: 'QR code not found' }, { status: 404 })
  }

  // Calculate date range
  const days = range === '7d' ? 7 : range === '90d' ? 90 : 30
  const startDate = new Date()
  startDate.setDate(startDate.getDate() - days)

  // Get scan events
  const { data: scanEvents } = await supabase
    .from('scan_events')
    .select('*')
    .eq('qr_id', id)
    .gte('created_at', startDate.toISOString())

  // Get unique users
  const uniqueUsers = new Set(scanEvents?.map(s => s.user_id).filter(Boolean) || [])

  // Get today's scans
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  const todayScans = scanEvents?.filter(s =>
    new Date(s.created_at) >= todayStart
  ).length || 0

  // Build timeline (group by date)
  const timelineMap = new Map<string, number>()
  scanEvents?.forEach(event => {
    const date = new Date(event.created_at).toISOString().split('T')[0]
    timelineMap.set(date, (timelineMap.get(date) || 0) + 1)
  })

  // Fill in missing dates
  const timeline: { date: string; count: number }[] = []
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date()
    date.setDate(date.getDate() - i)
    const dateStr = date.toISOString().split('T')[0]
    timeline.push({
      date: dateStr,
      count: timelineMap.get(dateStr) || 0
    })
  }

  // Device breakdown
  const deviceCounts = new Map<string, number>()
  scanEvents?.forEach(event => {
    const device = event.device_type || 'unknown'
    deviceCounts.set(device, (deviceCounts.get(device) || 0) + 1)
  })

  const totalScans = scanEvents?.length || 0
  const deviceBreakdown = Array.from(deviceCounts.entries()).map(([device, count]) => ({
    device,
    count,
    percentage: totalScans > 0 ? Math.round((count / totalScans) * 100) : 0
  }))

  // Location breakdown
  const locationCounts = new Map<string, number>()
  scanEvents?.forEach(event => {
    const location = event.location_name || 'Unknown'
    locationCounts.set(location, (locationCounts.get(location) || 0) + 1)
  })

  const topLocations = Array.from(locationCounts.entries())
    .map(([location, count]) => ({ location, count }))
    .sort((a, b) => b.count - a.count)

  return NextResponse.json({
    totalScans,
    uniqueScans: uniqueUsers.size,
    todayScans,
    timeline,
    deviceBreakdown,
    topLocations
  })
}
