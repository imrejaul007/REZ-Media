// Fraud Check API Endpoint
import { NextRequest, NextResponse } from 'next/server'
import { getFraudDetector, FraudCheckRequest } from '@/lib/fraud/detection'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    const request: FraudCheckRequest = {
      deviceId: body.deviceId,
      deviceFingerprint: body.deviceFingerprint,
      ip: body.ip || req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown',
      userAgent: body.userAgent || req.headers.get('user-agent') || 'unknown',
      scanLocation: body.scanLocation,
      timestamp: body.timestamp || new Date().toISOString(),
      qrId: body.qrId,
      campaignId: body.campaignId,
      userId: body.userId
    }

    if (!request.deviceId || !request.qrId || !request.campaignId) {
      return NextResponse.json(
        { error: 'Missing required fields: deviceId, qrId, campaignId' },
        { status: 400 }
      )
    }

    const detector = getFraudDetector()
    const result = await detector.check(request)

    return NextResponse.json({
      success: true,
      fraudCheck: result
    })
  } catch (error) {
    console.error('Fraud check error:', error)
    return NextResponse.json(
      { error: 'Internal server error during fraud check' },
      { status: 500 }
    )
  }
}

// Get fraud statistics for a campaign or device
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const campaignId = searchParams.get('campaignId')
    const deviceId = searchParams.get('deviceId')
    const period = searchParams.get('period') || '7d'

    // Calculate date range
    const now = new Date()
    const startDate = new Date()
    switch (period) {
      case '24h':
        startDate.setDate(now.getDate() - 1)
        break
      case '7d':
        startDate.setDate(now.getDate() - 7)
        break
      case '30d':
        startDate.setDate(now.getDate() - 30)
        break
      default:
        startDate.setDate(now.getDate() - 7)
    }

    // Build query for future use (noted for production implementation)
    // const query = `
    //   SELECT
    //     result,
    //     COUNT(*) as count,
    //     AVG(risk_score) as avg_risk_score,
    //     MAX(risk_score) as max_risk_score
    //   FROM fraud_logs
    //   WHERE created_at >= '${startDate.toISOString()}'
    // `
    //
    // if (campaignId) {
    //   query += ` AND campaign_id = '${campaignId}'`
    // }
    // if (deviceId) {
    //   query += ` AND device_id = '${deviceId}'`
    // }
    //
    // query += ` GROUP BY result`

    // Note: In production, use Supabase RPC or proper query builder
    // This is a simplified version

    return NextResponse.json({
      success: true,
      stats: {
        period,
        startDate: startDate.toISOString(),
        endDate: now.toISOString(),
        summary: {
          totalChecks: 0,
          passed: 0,
          flagged: 0,
          blocked: 0,
          avgRiskScore: 0
        }
      }
    })
  } catch (error) {
    console.error('Fraud stats error:', error)
    return NextResponse.json(
      { error: 'Internal server error fetching fraud stats' },
      { status: 500 }
    )
  }
}
