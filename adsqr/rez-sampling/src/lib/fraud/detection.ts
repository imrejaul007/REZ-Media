// Fraud Detection System for Ads QR
// Detects and prevents fraudulent scanning activities

import { createClient } from '@/lib/supabase'

// Types
export interface FraudCheckRequest {
  deviceId: string
  deviceFingerprint: string
  ip: string
  userAgent: string
  scanLocation?: {
    lat: number
    lng: number
  }
  timestamp: string
  qrId: string
  campaignId: string
  userId?: string
}

export interface FraudCheckResult {
  deviceId: string
  result: 'pass' | 'flag' | 'block'
  riskScore: number
  reasons: FraudReason[]
  checksPerformed: FraudCheck[]
  timestamp: string
}

export interface FraudReason {
  code: string
  message: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  checkType: string
}

export interface FraudCheck {
  name: string
  passed: boolean
  value?: any
  threshold?: any
}

export interface DeviceFingerprint {
  deviceId: string
  userAgent: string
  screenResolution: string
  timezone: string
  language: string
  platform: string
  canvasFingerprint?: string
  webglFingerprint?: string
  audioFingerprint?: string
  installedPlugins?: string[]
}

// Constants for fraud detection thresholds
const THRESHOLDS = {
  // Velocity checks
  MAX_SCANS_PER_MINUTE: 3,
  MAX_SCANS_PER_HOUR: 20,
  MAX_SCANS_PER_DAY: 100,
  MIN_TIME_BETWEEN_SCANS_MS: 20000, // 20 seconds minimum

  // Location checks
  MAX_DISTANCE_BETWEEN_SCANS_KM: 10,
  MAX_LOCATION_IMPOSSIBLE_SPEED_KMH: 500, // Impossible travel speed

  // Risk score thresholds
  BLOCK_THRESHOLD: 70,
  FLAG_THRESHOLD: 40,

  // Abuse limits
  MAX_DEVICES_PER_IP: 5,
  MAX_IPS_PER_DEVICE: 3,
  MAX_DUPLICATE_FINGERPRINTS: 2
}

// Fraud Detection Engine
export class FraudDetector {
  private supabase = createClient()

  /**
   * Perform comprehensive fraud check on a scan attempt
   */
  async check(request: FraudCheckRequest): Promise<FraudCheckResult> {
    const checks: FraudCheck[] = []
    const reasons: FraudReason[] = []
    let riskScore = 0

    // 1. Device Velocity Check
    const velocityCheck = await this.checkDeviceVelocity(request)
    checks.push(velocityCheck)
    if (!velocityCheck.passed) {
      riskScore += 25
      reasons.push({
        code: 'VELOCITY_ABUSE',
        message: `Device scanning too fast: ${velocityCheck.value} scans detected`,
        severity: velocityCheck.value > THRESHOLDS.MAX_SCANS_PER_HOUR ? 'high' : 'medium',
        checkType: 'velocity'
      })
    }

    // 2. GPS Spoofing Detection
    const gpsCheck = await this.checkGPSSpoofing(request)
    checks.push(gpsCheck)
    if (!gpsCheck.passed) {
      riskScore += 30
      reasons.push({
        code: 'GPS_SPOOFING',
        message: 'Suspicious location data detected',
        severity: 'high',
        checkType: 'location'
      })
    }

    // 3. VPN/Proxy Detection
    const vpnCheck = await this.checkVPN(request.ip)
    checks.push(vpnCheck)
    if (!vpnCheck.passed) {
      riskScore += 20
      reasons.push({
        code: 'VPN_PROXY',
        message: 'VPN or proxy connection detected',
        severity: 'medium',
        checkType: 'network'
      })
    }

    // 4. Device Consistency Check
    const consistencyCheck = await this.checkDeviceConsistency(request)
    checks.push(consistencyCheck)
    if (!consistencyCheck.passed) {
      riskScore += 35
      reasons.push({
        code: 'DEVICE_INCONSISTENCY',
        message: 'Device fingerprint does not match history',
        severity: 'high',
        checkType: 'device'
      })
    }

    // 5. Impossible Travel Check
    const travelCheck = await this.checkImpossibleTravel(request)
    checks.push(travelCheck)
    if (!travelCheck.passed) {
      riskScore += 40
      reasons.push({
        code: 'IMPOSSIBLE_TRAVEL',
        message: 'Impossible travel speed detected',
        severity: 'critical',
        checkType: 'location'
      })
    }

    // 6. Abuse Limits Check
    const abuseCheck = await this.checkAbuseLimits(request)
    checks.push(abuseCheck)
    if (!abuseCheck.passed) {
      riskScore += 30
      reasons.push({
        code: 'ABUSE_LIMIT_EXCEEDED',
        message: 'User exceeded daily scan limits',
        severity: 'high',
        checkType: 'abuse'
      })
    }

    // 7. IP Reputation Check
    const ipCheck = await this.checkIPReputation(request.ip)
    checks.push(ipCheck)
    if (!ipCheck.passed) {
      riskScore += 15
      reasons.push({
        code: 'IP_BAD_REPUTATION',
        message: 'IP address has poor reputation',
        severity: 'medium',
        checkType: 'network'
      })
    }

    // 8. Multiple Devices Check
    const multiDeviceCheck = await this.checkMultipleDevices(request)
    checks.push(multiDeviceCheck)
    if (!multiDeviceCheck.passed) {
      riskScore += 20
      reasons.push({
        code: 'MULTIPLE_DEVICES',
        message: 'Multiple devices associated with same user/IP',
        severity: 'medium',
        checkType: 'device'
      })
    }

    // Determine result
    let result: 'pass' | 'flag' | 'block' = 'pass'
    if (riskScore >= THRESHOLDS.BLOCK_THRESHOLD) {
      result = 'block'
    } else if (riskScore >= THRESHOLDS.FLAG_THRESHOLD) {
      result = 'flag'
    }

    // Log fraud check
    await this.logFraudCheck(request, { riskScore, reasons, checksPerformed: checks, result })

    return {
      deviceId: request.deviceId,
      result,
      riskScore,
      reasons,
      checksPerformed: checks,
      timestamp: new Date().toISOString()
    }
  }

  /**
   * Check device scanning velocity
   */
  async checkDeviceVelocity(request: FraudCheckRequest): Promise<FraudCheck> {
    const now = new Date()
    const oneMinuteAgo = new Date(now.getTime() - 60000)
    const oneHourAgo = new Date(now.getTime() - 3600000)
    const oneDayAgo = new Date(now.getTime() - 86400000)

    // Get recent scans for this device
    const { data: recentScans } = await this.supabase
      .from('scan_events')
      .select('created_at, latitude, longitude')
      .eq('device_id', request.deviceId)
      .gte('created_at', oneDayAgo.toISOString())
      .order('created_at', { ascending: false })

    if (!recentScans || recentScans.length === 0) {
      return { name: 'Device Velocity', passed: true, value: 0, threshold: THRESHOLDS.MAX_SCANS_PER_HOUR }
    }

    const lastScan = recentScans[0]
    const timeSinceLastScan = now.getTime() - new Date(lastScan.created_at).getTime()
    const scansLastMinute = recentScans.filter(s =>
      new Date(s.created_at).getTime() > oneMinuteAgo.getTime()
    ).length
    const scansLastHour = recentScans.filter(s =>
      new Date(s.created_at).getTime() > oneHourAgo.getTime()
    ).length

    const passed = scansLastMinute <= THRESHOLDS.MAX_SCANS_PER_MINUTE &&
      scansLastHour <= THRESHOLDS.MAX_SCANS_PER_HOUR &&
      timeSinceLastScan >= THRESHOLDS.MIN_TIME_BETWEEN_SCANS_MS

    return {
      name: 'Device Velocity',
      passed,
      value: { perMinute: scansLastMinute, perHour: scansLastHour, lastScanGap: timeSinceLastScan },
      threshold: THRESHOLDS
    }
  }

  /**
   * Check for GPS spoofing indicators
   */
  async checkGPSSpoofing(request: FraudCheckRequest): Promise<FraudCheck> {
    if (!request.scanLocation) {
      return { name: 'GPS Spoofing', passed: true, value: 'No location provided' }
    }

    const { lat, lng } = request.scanLocation

    // Check for impossible coordinates
    const impossibleLat = lat < -90 || lat > 90
    const impossibleLng = lng < -180 || lng > 180
    const zeroCoordinates = lat === 0 && lng === 0
    const suspiciousPrecision = (lat.toString().split('.')[1]?.length || 0) > 6

    // Check for static location (same coordinates across many scans)
    const { data: sameLocationScans } = await this.supabase
      .from('scan_events')
      .select('latitude, longitude, device_id')
      .eq('device_id', request.deviceId)
      .gte('created_at', new Date(Date.now() - 86400000 * 7).toISOString())

    let staticLocationCount = 0
    if (sameLocationScans) {
      const locationCounts = new Map<string, number>()
      for (const scan of sameLocationScans) {
        if (scan.latitude && scan.longitude) {
          const key = `${scan.latitude.toFixed(4)}_${scan.longitude.toFixed(4)}`
          locationCounts.set(key, (locationCounts.get(key) || 0) + 1)
        }
      }
      staticLocationCount = Math.max(...Array.from(locationCounts.values()), 0)
    }

    const failed = impossibleLat || impossibleLng || zeroCoordinates ||
      staticLocationCount > 50 || suspiciousPrecision

    return {
      name: 'GPS Spoofing',
      passed: !failed,
      value: {
        coordinates: { lat, lng },
        staticLocationCount,
        indicators: { impossibleLat, impossibleLng, zeroCoordinates, suspiciousPrecision }
      }
    }
  }

  /**
   * Check if IP is from VPN/Proxy
   */
  async checkVPN(ip: string): Promise<FraudCheck> {
    // Known VPN/Proxy IP ranges (simplified - in production use a proper service)
    const suspiciousPatterns = [
      /^10\./,
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
      /^192\.168\./,
      /^127\./,
      /^localhost$/i
    ]

    const isPrivate = suspiciousPatterns.some(pattern => pattern.test(ip))

    // Check against known VPN/proxy list (in production, use external API)
    // For now, we'll use heuristics
    const { data: vpnHistory } = await this.supabase
      .from('fraud_logs')
      .select('ip')
      .eq('ip', ip)
      .eq('result', 'block')
      .gte('created_at', new Date(Date.now() - 86400000).toISOString())

    const hasVPNHistory = (vpnHistory?.length || 0) > 5
    const failed = isPrivate || hasVPNHistory

    return {
      name: 'VPN/Proxy Detection',
      passed: !failed,
      value: { ip, isPrivate, vpnHistoryCount: vpnHistory?.length || 0 }
    }
  }

  /**
   * Check device fingerprint consistency
   */
  async checkDeviceConsistency(request: FraudCheckRequest): Promise<FraudCheck> {
    if (!request.deviceFingerprint) {
      return { name: 'Device Consistency', passed: true, value: 'No fingerprint provided' }
    }

    // Get historical fingerprints for this device
    const { data: history } = await this.supabase
      .from('device_fingerprints')
      .select('*')
      .eq('device_id', request.deviceId)
      .order('created_at', { ascending: false })
      .limit(10)

    if (!history || history.length === 0) {
      // First time device, store fingerprint
      await this.supabase.from('device_fingerprints').insert({
        device_id: request.deviceId,
        fingerprint: request.deviceFingerprint,
        user_agent: request.userAgent,
        created_at: new Date().toISOString()
      })
      return { name: 'Device Consistency', passed: true, value: 'New device registered' }
    }

    // Check for consistency
    const fingerprints = new Set(history.map(h => h.fingerprint))
    const hasConsistentFingerprint = fingerprints.size <= THRESHOLDS.MAX_DUPLICATE_FINGERPRINTS

    return {
      name: 'Device Consistency',
      passed: hasConsistentFingerprint,
      value: { uniqueFingerprints: fingerprints.size, historyCount: history.length },
      threshold: THRESHOLDS.MAX_DUPLICATE_FINGERPRINTS
    }
  }

  /**
   * Check for impossible travel (scanning from distant locations too quickly)
   */
  async checkImpossibleTravel(request: FraudCheckRequest): Promise<FraudCheck> {
    if (!request.scanLocation) {
      return { name: 'Impossible Travel', passed: true, value: 'No location provided' }
    }

    // Get last scan with location
    const { data: lastScan } = await this.supabase
      .from('scan_events')
      .select('latitude, longitude, created_at')
      .eq('device_id', request.deviceId)
      .not('latitude', 'is', null)
      .not('longitude', 'is', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (!lastScan) {
      return { name: 'Impossible Travel', passed: true, value: 'No previous location data' }
    }

    const lastLocation = { lat: lastScan.latitude, lng: lastScan.longitude }
    const currentLocation = request.scanLocation

    // Calculate distance
    const distanceKm = this.calculateDistance(lastLocation, currentLocation)
    const timeDiffHours = (new Date(request.timestamp).getTime() - new Date(lastScan.created_at).getTime()) / 3600000

    if (timeDiffHours <= 0) {
      return { name: 'Impossible Travel', passed: true, value: 'Same timestamp' }
    }

    const speedKmh = distanceKm / timeDiffHours
    const failed = speedKmh > THRESHOLDS.MAX_LOCATION_IMPOSSIBLE_SPEED_KMH

    return {
      name: 'Impossible Travel',
      passed: !failed,
      value: { distanceKm: Math.round(distanceKm), speedKmh: Math.round(speedKmh), timeDiffHours },
      threshold: THRESHOLDS.MAX_LOCATION_IMPOSSIBLE_SPEED_KMH
    }
  }

  /**
   * Check abuse limits (daily/monthly scan limits)
   */
  async checkAbuseLimits(request: FraudCheckRequest): Promise<FraudCheck> {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    const { data: todayScans } = await this.supabase
      .from('scan_events')
      .select('id')
      .eq('device_id', request.deviceId)
      .gte('created_at', today.toISOString())
      .lt('created_at', tomorrow.toISOString())

    const todayCount = todayScans?.length || 0
    const failed = todayCount >= THRESHOLDS.MAX_SCANS_PER_DAY

    return {
      name: 'Abuse Limits',
      passed: !failed,
      value: todayCount,
      threshold: THRESHOLDS.MAX_SCANS_PER_DAY
    }
  }

  /**
   * Check IP reputation
   */
  async checkIPReputation(ip: string): Promise<FraudCheck> {
    // Get recent fraud attempts from this IP
    const { data: recentFraud } = await this.supabase
      .from('fraud_logs')
      .select('id')
      .eq('ip', ip)
      .eq('result', 'block')
      .gte('created_at', new Date(Date.now() - 86400000).toISOString())

    const fraudCount = recentFraud?.length || 0
    const failed = fraudCount > 10

    return {
      name: 'IP Reputation',
      passed: !failed,
      value: { fraudAttempts: fraudCount },
      threshold: 10
    }
  }

  /**
   * Check for multiple devices per user/IP
   */
  async checkMultipleDevices(request: FraudCheckRequest): Promise<FraudCheck> {
    if (!request.userId) {
      return { name: 'Multiple Devices', passed: true, value: 'No user ID' }
    }

    // Count devices for this user
    const { data: userDevices } = await this.supabase
      .from('scan_events')
      .select('device_id')
      .eq('user_id', request.userId)
      .order('created_at', { ascending: false })

    if (!userDevices) {
      return { name: 'Multiple Devices', passed: true, value: 0 }
    }

    const uniqueDevices = new Set(userDevices.map(s => s.device_id))
    const failed = uniqueDevices.size > THRESHOLDS.MAX_DEVICES_PER_IP

    return {
      name: 'Multiple Devices',
      passed: !failed,
      value: uniqueDevices.size,
      threshold: THRESHOLDS.MAX_DEVICES_PER_IP
    }
  }

  /**
   * Calculate distance between two coordinates (Haversine formula)
   */
  private calculateDistance(
    point1: { lat: number; lng: number },
    point2: { lat: number; lng: number }
  ): number {
    const R = 6371 // Earth's radius in km
    const dLat = this.toRad(point2.lat - point1.lat)
    const dLng = this.toRad(point2.lng - point1.lng)
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(point1.lat)) *
        Math.cos(this.toRad(point2.lat)) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    return R * c
  }

  private toRad(deg: number): number {
    return deg * (Math.PI / 180)
  }

  /**
   * Log fraud check result
   */
  private async logFraudCheck(
    request: FraudCheckRequest,
    result: { riskScore: number; reasons: FraudReason[]; checksPerformed: FraudCheck[]; result: 'pass' | 'flag' | 'block' }
  ) {
    await this.supabase.from('fraud_logs').insert({
      device_id: request.deviceId,
      device_fingerprint: request.deviceFingerprint,
      ip: request.ip,
      qr_id: request.qrId,
      campaign_id: request.campaignId,
      user_id: request.userId,
      latitude: request.scanLocation?.lat,
      longitude: request.scanLocation?.lng,
      risk_score: result.riskScore,
      result: result.result,
      reasons: result.reasons,
      checks_performed: result.checksPerformed,
      created_at: new Date().toISOString()
    })
  }

  /**
   * Generate device fingerprint
   */
  generateFingerprint(): DeviceFingerprint {
    return {
      deviceId: this.generateDeviceId(),
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
      screenResolution: typeof screen !== 'undefined' ? `${screen.width}x${screen.height}` : '',
      timezone: typeof Intl !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().timeZone : '',
      language: typeof navigator !== 'undefined' ? navigator.language : '',
      platform: typeof navigator !== 'undefined' ? navigator.platform : ''
    }
  }

  /**
   * Generate unique device ID
   */
  private generateDeviceId(): string {
    return `dev_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`
  }
}

// Singleton instance
let fraudDetectorInstance: FraudDetector | null = null

export function getFraudDetector(): FraudDetector {
  if (!fraudDetectorInstance) {
    fraudDetectorInstance = new FraudDetector()
  }
  return fraudDetectorInstance
}
