// AdsQr Scan API with REZ TRY Integration + RDE Core
// After scan, redirects to REZ TRY with coin credits
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase'
import { getFraudDetector, FraudCheckRequest } from '@/lib/fraud/detection'
import { awardScanKarma } from '@/lib/karmaIntegration'

// RDE Integration
import { processIntegratedScan } from '@/lib/rdeIntegration'

// REZ TRY URL - where users go after scan
const REZ_TRY_URL = process.env.REZ_TRY_URL || 'https://try.rez.money'

// GET /api/scan/[slug] - Record scan and redirect to REZ TRY
export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const supabase = createClient()

  // Extract fraud detection data from headers
  const deviceId = req.headers.get('x-device-id') || ''
  const deviceFingerprint = req.headers.get('x-device-fingerprint') || ''
  const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown'
  const latitude = parseFloat(req.headers.get('x-latitude') || '0') || undefined
  const longitude = parseFloat(req.headers.get('x-longitude') || '0') || undefined

  // Find QR code with campaign details
  const { data: qr } = await supabase
    .from('qr_codes')
    .select('*, campaigns(*)')
    .eq('qr_slug', slug)
    .single()

  if (!qr) {
    // QR not found - redirect to REZ TRY with error
    return NextResponse.redirect(`${REZ_TRY_URL}/scan-error?reason=not_found`)
  }

  if (!qr.is_active) {
    // QR inactive - redirect to REZ TRY with error
    return NextResponse.redirect(`${REZ_TRY_URL}/scan-error?reason=inactive`)
  }

  // Get user from auth header
  const authHeader = req.headers.get('authorization') ?? ''
  const accessToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
  let userId: string | null = null

  if (accessToken) {
    const { data } = await supabase.auth.getUser(accessToken)
    userId = data.user?.id || null
  }

  // Perform fraud check
  const fraudRequest: FraudCheckRequest = {
    deviceId,
    deviceFingerprint,
    ip,
    userAgent: req.headers.get('user-agent') || 'unknown',
    scanLocation: latitude && longitude ? { lat: latitude, lng: longitude } : undefined,
    timestamp: new Date().toISOString(),
    qrId: qr.id,
    campaignId: qr.campaign_id,
    userId: userId || undefined
  }

  const fraudDetector = getFraudDetector()
  const fraudResult = await fraudDetector.check(fraudRequest)

  // If blocked, still record but flag
  const shouldCredit = fraudResult.result === 'pass'
  const isFlagged = fraudResult.result === 'flag'

  // Record scan event
  const scanReward = qr.campaigns?.scan_reward || 10

  const { data: scanEvent } = await supabase
    .from('scan_events')
    .insert({
      qr_id: qr.id,
      campaign_id: qr.campaign_id,
      user_id: userId,
      device_id: deviceId || null,
      latitude: latitude,
      longitude: longitude,
      fraud_check_result: fraudResult.result,
      fraud_risk_score: fraudResult.riskScore,
      coins_credited: false, // Will be updated by RDE
      coins_amount: 0,
      fraud_flagged: isFlagged
    })
    .select()
    .single()

  // Update QR scan count
  await supabase.rpc('increment_scan_count', { qr_id: qr.id })

  // INTEGRATE WITH RDE CORE
  let finalCoins = 0
  let finalCoinType: 'try' | 'brand' = 'try'
  let redirectUrl = `${REZ_TRY_URL}/scan-error?reason=rde_failed`
  let rdeDecisionId: string | null = null

  if (userId) {
    try {
      // Call RDE integration
      const rdeResult = await processIntegratedScan({
        userId,
        campaignId: qr.campaign_id,
        merchantId: qr.campaigns?.merchant_id || '',
        qrId: qr.id,
        location: latitude && longitude ? { lat: latitude, lng: longitude } : undefined,
        category: qr.campaigns?.category || 'general',
        coins: scanReward
      }, scanReward)

      finalCoins = rdeResult.coins
      finalCoinType = rdeResult.coinType
      redirectUrl = rdeResult.redirectUrl
      rdeDecisionId = rdeResult.decisionId || null

      // Update scan event with RDE decision
      if (rdeDecisionId) {
        await supabase
          .from('scan_events')
          .update({
            coins_credited: rdeResult.approved,
            coins_amount: rdeResult.coins,
            rde_decision_id: rdeDecisionId
          })
          .eq('id', scanEvent?.id)
      }

    } catch (rdeError) {
      console.error('[adsqr] RDE integration error:', rdeError)
      // Fallback to basic coin credit
      if (shouldCredit) {
        finalCoins = scanReward
        finalCoinType = 'try'
        redirectUrl = `${REZ_TRY_URL}/scan-reward?coins=${finalCoins}&type=${finalCoinType}`
      }
    }
  }

  // Credit coins if user is authenticated and passed fraud check
  if (userId && finalCoins > 0 && shouldCredit) {
    // Credit coins to user
    const { error: err } = await supabase
      .from('coin_balances')
      .upsert({
        user_id: userId,
        coin_type: finalCoinType,
        balance: finalCoins,
        last_updated: new Date().toISOString()
      }, {
        onConflict: 'user_id,coin_type'
      })

    if (!err) {
      // Add transaction record
      await supabase.from('coin_transactions').insert({
        user_id: userId,
        coin_type: finalCoinType,
        amount: finalCoins,
        transaction_type: 'scan_reward',
        reference_id: scanEvent?.id,
        description: `Scanned QR: ${qr.campaigns?.name || 'Campaign'}`
      })
    }
  }

  // Award karma points
  if (userId) {
    await awardScanKarma(userId, qr.campaign_id)
  }

  // Redirect to REZ TRY
  return NextResponse.redirect(redirectUrl)
}
