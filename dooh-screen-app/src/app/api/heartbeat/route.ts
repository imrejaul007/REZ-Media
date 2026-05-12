import { NextRequest, NextResponse } from 'next/server'

// POST /api/heartbeat
// Screen sends heartbeat to server

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { screen_id, status, timestamp, playlist_version } = body

    // In production, this would:
    // 1. Update screen status in database
    // 2. Check if playlist needs update
    // 3. Return new playlist if needed

    console.log(`[Heartbeat] Screen ${screen_id} - Status: ${status}`)

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      needsUpdate: false,
    })
  } catch (error) {
    console.error('Heartbeat error:', error)
    return NextResponse.json(
      { error: 'Failed to process heartbeat' },
      { status: 500 }
    )
  }
}

// GET /api/heartbeat
// Health check

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    service: 'dooh-screen-heartbeat',
    timestamp: new Date().toISOString(),
  })
}
