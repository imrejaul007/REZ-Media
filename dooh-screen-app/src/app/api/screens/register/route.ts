import { NextRequest, NextResponse } from 'next/server'

// In-memory screen registry (use Redis/DB in production)
const screens = new Map<string, any>()

/**
 * POST /api/screens/register
 * Register a new screen in the DOOH network
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { id, name, type, location, owner_id, owner_type } = body

    // Validate required fields
    if (!id || !name || !type) {
      return NextResponse.json(
        { error: 'Missing required fields: id, name, type' },
        { status: 400 }
      )
    }

    // Valid screen types
    const validTypes = [
      'cab_tablet', 'bus_shelter', 'bus_interior', 'train_display', 'metro_screen',
      'flight_seatback', 'flight_overhead', 'flight_entrance', 'flight_lavatory',
      'airport_display', 'airport_kiosk', 'airport_gate', 'airport_lounge', 'airport_billboard',
      'restaurant_tv', 'hotel_lobby', 'hotel_room',
      'mall_kiosk', 'mall_directory', 'gym_screen', 'salon_display',
      'office_lobby', 'office_elevator',
      'generic_display'
    ]

    if (!validTypes.includes(type)) {
      return NextResponse.json(
        { error: `Invalid screen type. Valid types: ${validTypes.join(', ')}` },
        { status: 400 }
      )
    }

    // Create screen record
    const screen = {
      id,
      name,
      type,
      location: location || {
        city: 'Unknown',
        area: 'Unknown',
        lat: 0,
        lng: 0
      },
      owner_id: owner_id || 'partner',
      owner_type: owner_type || 'partner',
      status: 'active',
      registered_at: new Date().toISOString(),
      last_heartbeat: null,
      playlist_version: 0,
    }

    // Store screen
    screens.set(id, screen)

    console.log(`[DOOH] Screen registered: ${id} (${type})`)

    return NextResponse.json({
      success: true,
      screen_id: id,
      message: 'Screen registered successfully',
      screen: {
        id: screen.id,
        name: screen.name,
        type: screen.type,
        status: screen.status,
      }
    })

  } catch (error) {
    console.error('Screen registration error:', error)
    return NextResponse.json(
      { error: 'Failed to register screen' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/screens/register
 * Health check
 */
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    service: 'dooh-screen-registry',
    screens_registered: screens.size,
  })
}
