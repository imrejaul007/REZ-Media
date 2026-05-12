import { NextRequest, NextResponse } from 'next/server'

// Demo ads
const DEMO_ADS = [
  {
    id: 'ad_001',
    campaign_id: 'camp_demo',
    creative: {
      type: 'image',
      url: 'https://picsum.photos/1920/1080',
      duration: 15,
    },
    position: 0,
  },
  {
    id: 'ad_002',
    campaign_id: 'camp_demo',
    creative: {
      type: 'text',
      content: 'Welcome to DOOH! Scan QR to get rewards',
      duration: 10,
    },
    position: 1,
  },
  {
    id: 'ad_003',
    campaign_id: 'camp_demo',
    creative: {
      type: 'image',
      url: 'https://picsum.photos/1920/1080?random=2',
      duration: 15,
    },
    position: 2,
  },
]

/**
 * GET /api/screens/[id]/playlist
 * Get playlist for a screen
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // In production:
    // 1. Look up screen in database
    // 2. Get screen type, location, audience
    // 3. Query AdOS for optimized ads
    // 4. Return playlist

    // Demo: return demo playlist
    const playlist = {
      id: `pl_${id}_${Date.now()}`,
      screen_id: id,
      slots: DEMO_ADS,
      version: 1,
      generated_at: new Date().toISOString(),
    }

    return NextResponse.json({
      success: true,
      playlist,
    })

  } catch (error) {
    console.error('Playlist error:', error)
    return NextResponse.json(
      { error: 'Failed to get playlist' },
      { status: 500 }
    )
  }
}
