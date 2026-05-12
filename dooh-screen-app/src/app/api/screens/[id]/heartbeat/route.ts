import { NextRequest, NextResponse } from 'next/server'

// Shared screen registry
const screens = new Map<string, any>()
const heartbeats: any[] = []

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await req.json()
    const { status, timestamp, playlist_version, is_online, context } = body

    // Update screen status
    const screen = screens.get(id)
    if (screen) {
      screen.last_heartbeat = timestamp || new Date().toISOString()
      screen.status = status || 'active'
      screen.playlist_version = playlist_version || screen.playlist_version
      screen.is_online = is_online !== false
      screen.context = context
      screens.set(id, screen)
    } else {
      // Auto-register if not found
      screens.set(id, {
        id,
        status: status || 'active',
        last_heartbeat: timestamp || new Date().toISOString(),
        playlist_version: playlist_version || 0,
        is_online: is_online !== false,
        context,
      })
    }

    // Store heartbeat
    heartbeats.push({
      screen_id: id,
      timestamp: timestamp || new Date().toISOString(),
      status,
    })

    // Keep last 1000 heartbeats
    if (heartbeats.length > 1000) {
      heartbeats.shift()
    }

    console.log(`[Heartbeat] Screen ${id}: ${status || 'active'}`)

    return NextResponse.json({
      success: true,
      screen_id: id,
      timestamp: new Date().toISOString(),
    })

  } catch (error) {
    console.error('Heartbeat error:', error)
    return NextResponse.json(
      { error: 'Failed to process heartbeat' },
      { status: 500 }
    )
  }
}
