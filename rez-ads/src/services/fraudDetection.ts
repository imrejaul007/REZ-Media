import Redis from 'ioredis';
import { v4 as uuidv4 } from 'uuid';
import { FraudCheckResult, EventType } from '../types/index.js';

interface FraudConfig {
  enabled: boolean;
  clickThreshold: number;
  windowMinutes: number;
  impressionVelocityThreshold: number;
  clickVelocityThreshold: number;
  ipReputationEnabled: boolean;
}

interface ClickPattern {
  clicks: number;
  impressions: number;
  ips: Set<string>;
  userAgents: Set<string>;
  sessions: Set<string>;
  timestamps: number[];
}

interface VelocityMetrics {
  impressionsPerMinute: number;
  clicksPerMinute: number;
  uniqueIps: number;
  uniqueSessions: number;
}

export class FraudDetectionService {
  private redis: Redis;
  private config: FraudConfig;
  private readonly BASE_KEY = 'fraud:';

  constructor(redis: Redis, config?: Partial<FraudConfig>) {
    this.redis = redis;
    this.config = {
      enabled: process.env.FRAUD_CHECK_ENABLED !== 'false',
      clickThreshold: parseInt(process.env.FRAUD_CLICK_THRESHOLD || '5', 10),
      windowMinutes: parseInt(process.env.FRAUD_WINDOW_MINUTES || '10', 10),
      impressionVelocityThreshold: 100,
      clickVelocityThreshold: 20,
      ipReputationEnabled: true,
      ...config,
    };
  }

  /**
   * Check if an event is fraudulent
   */
  async checkEvent(
    eventType: EventType,
    adId: string,
    campaignId: string,
    data: {
      ip?: string;
      userAgent?: string;
      sessionId?: string;
      userId?: string;
      placementId?: string;
      timestamp?: number;
    }
  ): Promise<FraudCheckResult> {
    if (!this.config.enabled) {
      return {
        isFraudulent: false,
        score: 0,
        reasons: [],
        recommendedAction: 'allow',
      };
    }

    const reasons: string[] = [];
    let fraudScore = 0;

    const timestamp = data.timestamp || Date.now();
    const windowMs = this.config.windowMinutes * 60 * 1000;

    // Run all checks in parallel
    const checks = await Promise.all([
      this.checkClickVelocity(adId, data.ip, data.sessionId, timestamp, windowMs),
      this.checkImpressionVelocity(adId, data.ip, timestamp, windowMs),
      this.checkIPReputation(data.ip),
      this.checkBotUserAgent(data.userAgent),
      this.checkCampaignClickRate(campaignId, data.ip),
      this.checkGeoAnomaly(adId, data.ip),
      this.checkSessionPatterns(data.sessionId, data.userId, eventType, timestamp),
    ]);

    // Aggregate results
    for (const check of checks) {
      if (check.isSuspicious) {
        fraudScore += check.weight;
        reasons.push(check.reason);
      }
    }

    // Determine final decision
    const isFraudulent = fraudScore >= 50;
    let recommendedAction: 'allow' | 'flag' | 'block';

    if (fraudScore >= 70) {
      recommendedAction = 'block';
    } else if (fraudScore >= 50) {
      recommendedAction = 'flag';
    } else {
      recommendedAction = 'allow';
    }

    // Log the check
    await this.logFraudCheck(eventType, adId, campaignId, data.ip, {
      score: fraudScore,
      reasons,
      action: recommendedAction,
    });

    return {
      isFraudulent,
      score: fraudScore,
      reasons,
      recommendedAction,
    };
  }

  /**
   * Check click velocity - detect rapid clicking patterns
   */
  private async checkClickVelocity(
    adId: string,
    ip?: string,
    sessionId?: string,
    timestamp?: number,
    windowMs?: number
  ): Promise<{ isSuspicious: boolean; weight: number; reason: string }> {
    const ts = timestamp || Date.now();
    const window = windowMs || this.config.windowMinutes * 60 * 1000;
    const key = `${this.BASE_KEY}clicks:${adId}`;

    // Get recent clicks
    const clicks = await this.redis.zrangebyscore(
      key,
      ts - window,
      ts
    );

    let clickCount = clicks.length;

    // Add current click if provided
    if (ip) {
      clickCount += 1;
    }

    if (clickCount > this.config.clickThreshold) {
      return {
        isSuspicious: true,
        weight: 40,
        reason: `High click velocity: ${clickCount} clicks in ${this.config.windowMinutes} minutes`,
      };
    }

    // Check for IP-based rapid clicking
    if (ip) {
      const ipKey = `${this.BASE_KEY}ip:${ip}:${adId}`;
      const ipClicks = await this.redis.zrangebyscore(ipKey, ts - window, ts);
      if (ipClicks.length > 3) {
        return {
          isSuspicious: true,
          weight: 35,
          reason: `IP ${ip} generated ${ipClicks.length + 1} clicks on ad ${adId}`,
        };
      }
    }

    return { isSuspicious: false, weight: 0, reason: '' };
  }

  /**
   * Check impression velocity - detect impression flooding
   */
  private async checkImpressionVelocity(
    adId: string,
    ip?: string,
    timestamp?: number,
    windowMs?: number
  ): Promise<{ isSuspicious: boolean; weight: number; reason: string }> {
    const ts = timestamp || Date.now();
    const window = windowMs || this.config.windowMinutes * 60 * 1000;
    const key = `${this.BASE_KEY}impressions:${adId}`;

    const impressions = await this.redis.zrangebyscore(key, ts - window, ts);
    const impressionCount = impressions.length;

    // Check for impression flooding (>100/min is suspicious)
    if (impressionCount > this.config.impressionVelocityThreshold) {
      return {
        isSuspicious: true,
        weight: 30,
        reason: `Impression flooding detected: ${impressionCount} impressions`,
      };
    }

    // Check for same-IP impression spam
    if (ip) {
      const ipKey = `${this.BASE_KEY}ip:${ip}:impressions`;
      const ipImpressions = await this.redis.zrangebyscore(ipKey, ts - window, ts);
      if (ipImpressions.length > 20) {
        return {
          isSuspicious: true,
          weight: 25,
          reason: `IP impression spam: ${ipImpressions.length + 1} impressions`,
        };
      }
    }

    return { isSuspicious: false, weight: 0, reason: '' };
  }

  /**
   * Check IP reputation - known bad actors
   */
  private async checkIPReputation(ip?: string): Promise<{ isSuspicious: boolean; weight: number; reason: string }> {
    if (!ip || !this.config.ipReputationEnabled) {
      return { isSuspicious: false, weight: 0, reason: '' };
    }

    // Check against known bad IPs (datacenter, VPN, etc.)
    const ipKey = `${this.BASE_KEY}bad_ip:${ip}`;
    const isBlocked = await this.redis.exists(ipKey);

    if (isBlocked) {
      return {
        isSuspicious: true,
        weight: 50,
        reason: `IP ${ip} is on blocklist`,
      };
    }

    // Check IP click history
    const ipClicksKey = `${this.BASE_KEY}ip_clicks:${ip}`;
    const totalClicks = await this.redis.get(ipClicksKey);

    if (totalClicks && parseInt(totalClicks, 10) > 100) {
      return {
        isSuspicious: true,
        weight: 20,
        reason: `IP ${ip} has high click history: ${totalClicks} total clicks`,
      };
    }

    return { isSuspicious: false, weight: 0, reason: '' };
  }

  /**
   * Check for bot-like user agents
   */
  private checkBotUserAgent(userAgent?: string): { isSuspicious: boolean; weight: number; reason: string } {
    if (!userAgent) {
      return { isSuspicious: false, weight: 0, reason: '' };
    }

    const botPatterns = [
      /bot/i,
      /crawler/i,
      /spider/i,
      /scraper/i,
      /curl/i,
      /wget/i,
      /python-requests/i,
      /node-fetch/i,
      /java\//i,
      /httpclient/i,
      /libwww/i,
    ];

    for (const pattern of botPatterns) {
      if (pattern.test(userAgent)) {
        return {
          isSuspicious: true,
          weight: 45,
          reason: `Bot-like user agent detected: ${userAgent}`,
        };
      }
    }

    // Check for missing or suspicious user agents
    if (userAgent.length < 20) {
      return {
        isSuspicious: true,
        weight: 15,
        reason: 'Unusually short user agent',
      };
    }

    return { isSuspicious: false, weight: 0, reason: '' };
  }

  /**
   * Check for unusual click-to-impression ratio for campaign
   */
  private async checkCampaignClickRate(
    campaignId: string,
    ip?: string
  ): Promise<{ isSuspicious: boolean; weight: number; reason: string }> {
    if (!ip) {
      return { isSuspicious: false, weight: 0, reason: '' };
    }

    const ts = Date.now();
    const window = this.config.windowMinutes * 60 * 1000;

    // Get campaign stats
    const clicksKey = `${this.BASE_KEY}campaign:${campaignId}:clicks:${ip}`;
    const impressionsKey = `${this.BASE_KEY}campaign:${campaignId}:impressions:${ip}`;

    const [clicks, impressions] = await Promise.all([
      this.redis.zcount(clicksKey, ts - window, ts),
      this.redis.zcount(impressionsKey, ts - window, ts),
    ]);

    if (impressions > 0) {
      const ctr = (clicks / impressions) * 100;

      // CTR > 50% is suspicious
      if (ctr > 50) {
        return {
          isSuspicious: true,
          weight: 30,
          reason: `Unusually high CTR for campaign: ${ctr.toFixed(1)}%`,
        };
      }
    }

    return { isSuspicious: false, weight: 0, reason: '' };
  }

  /**
   * Check for geo-location anomalies
   */
  private async checkGeoAnomaly(
    adId: string,
    ip?: string
  ): Promise<{ isSuspicious: boolean; weight: number; reason: string }> {
    if (!ip) {
      return { isSuspicious: false, weight: 0, reason: '' };
    }

    // Get last known location for this IP
    const geoKey = `${this.BASE_KEY}geo:${ip}`;
    const lastGeo = await this.redis.get(geoKey);
    const currentTime = Date.now();

    if (lastGeo) {
      const { country, lastSeen } = JSON.parse(lastGeo);
      const timeDiff = currentTime - lastSeen;

      // If same IP appears from different country within 1 hour, flag it
      if (timeDiff < 60 * 60 * 1000) {
        // Country changed - this is suspicious
        return {
          isSuspicious: true,
          weight: 25,
          reason: 'IP location changed significantly within short time period',
        };
      }
    }

    return { isSuspicious: false, weight: 0, reason: '' };
  }

  /**
   * Check session patterns for consistency
   */
  private async checkSessionPatterns(
    sessionId?: string,
    userId?: string,
    eventType?: EventType,
    timestamp?: number
  ): Promise<{ isSuspicious: boolean; weight: number; reason: string }> {
    if (!sessionId) {
      return { isSuspicious: false, weight: 0, reason: '' };
    }

    const ts = timestamp || Date.now();
    const sessionKey = `${this.BASE_KEY}session:${sessionId}`;

    // Get session history
    const sessionData = await this.redis.hgetall(sessionKey);

    if (!Object.keys(sessionData).length) {
      // New session, record this event
      await this.redis.hmset(sessionKey, {
        firstEvent: eventType || 'unknown',
        firstEventTime: ts.toString(),
        impressionCount: eventType === EventType.IMPRESSION ? '1' : '0',
        clickCount: eventType === EventType.CLICK ? '1' : '0',
      });
      await this.redis.expire(sessionKey, 24 * 60 * 60); // 24 hour TTL
      return { isSuspicious: false, weight: 0, reason: '' };
    }

    // Check for impossible navigation patterns
    const firstEvent = sessionData.firstEvent;
    const firstEventTime = parseInt(sessionData.firstEventTime, 10);

    if (eventType === EventType.CLICK && firstEvent === EventType.IMPRESSION) {
      const timeDiff = ts - firstEventTime;

      // Click within 100ms of impression is suspicious
      if (timeDiff < 100) {
        return {
          isSuspicious: true,
          weight: 20,
          reason: 'Click occurred within 100ms of impression - suspicious',
        };
      }

      // Click before impression (impossible) is fraud
      if (timeDiff < 0) {
        return {
          isSuspicious: true,
          weight: 50,
          reason: 'Event sequence violation detected',
        };
      }
    }

    // Update session
    const updates: Record<string, string> = {};
    if (eventType === EventType.IMPRESSION) {
      updates.impressionCount = ((parseInt(sessionData.impressionCount, 10) || 0) + 1).toString();
    }
    if (eventType === EventType.CLICK) {
      updates.clickCount = ((parseInt(sessionData.clickCount, 10) || 0) + 1).toString();
    }
    updates.lastEvent = eventType || 'unknown';
    updates.lastEventTime = ts.toString();

    await this.redis.hmset(sessionKey, updates);

    return { isSuspicious: false, weight: 0, reason: '' };
  }

  /**
   * Record an event for fraud tracking
   */
  async recordEvent(
    eventType: EventType,
    adId: string,
    campaignId: string,
    data: {
      ip?: string;
      sessionId?: string;
      userAgent?: string;
      placementId?: string;
    }
  ): Promise<void> {
    const ts = Date.now();
    const window = this.config.windowMinutes * 60 * 1000;

    // Store click in sorted set for velocity tracking
    const eventKey = `${this.BASE_KEY}${eventType}s:${adId}`;
    const eventId = uuidv4();
    await this.redis.zadd(eventKey, ts, `${eventId}:${data.ip || 'unknown'}`);
    await this.redis.expire(eventKey, window * 2);

    // Store IP-specific data
    if (data.ip) {
      const ipKey = `${this.BASE_KEY}ip:${data.ip}:${adId}`;
      await this.redis.zadd(ipKey, ts, `${eventId}:${eventType}`);
      await this.redis.expire(ipKey, window * 2);

      // Update IP click count
      if (eventType === EventType.CLICK) {
        await this.redis.incr(`${this.BASE_KEY}ip_clicks:${data.ip}`);
      }

      // Update campaign IP stats
      await this.redis.zadd(
        `${this.BASE_KEY}campaign:${campaignId}:${eventType}s:${data.ip}`,
        ts,
        eventId
      );
      await this.redis.expire(
        `${this.BASE_KEY}campaign:${campaignId}:${eventType}s:${data.ip}`,
        window * 2
      );
    }

    // Update campaign-level stats
    await this.redis.zadd(
      `${this.BASE_KEY}campaign:${campaignId}:${eventType}`,
      ts,
      `${eventId}:${data.ip || 'unknown'}`
    );
    await this.redis.expire(
      `${this.BASE_KEY}campaign:${campaignId}:${eventType}`,
      window * 2
    );
  }

  /**
   * Log fraud check result
   */
  private async logFraudCheck(
    eventType: EventType,
    adId: string,
    campaignId: string,
    ip: string | undefined,
    result: { score: number; reasons: string[]; action: string }
  ): Promise<void> {
    const logKey = `${this.BASE_KEY}logs`;
    const logEntry = JSON.stringify({
      eventType,
      adId,
      campaignId,
      ip: ip || 'unknown',
      score: result.score,
      reasons: result.reasons,
      action: result.action,
      timestamp: Date.now(),
    });

    // Keep last 10000 logs
    await this.redis.lpush(logKey, logEntry);
    await this.redis.ltrim(logKey, 0, 9999);
    await this.redis.expire(logKey, 7 * 24 * 60 * 60); // 7 day TTL
  }

  /**
   * Get fraud statistics for an ad or campaign
   */
  async getFraudStats(
    targetId: string,
    targetType: 'ad' | 'campaign'
  ): Promise<{
    totalEvents: number;
    flaggedEvents: number;
    blockedEvents: number;
    fraudRate: number;
    topReasons: string[];
  }> {
    const logsKey = `${this.BASE_KEY}logs`;
    const logs = await this.redis.lrange(logsKey, 0, 9999);

    let totalEvents = 0;
    let flaggedEvents = 0;
    let blockedEvents = 0;
    const reasonCounts: Record<string, number> = {};

    for (const log of logs) {
      try {
        const entry = JSON.parse(log);
        const matchKey = targetType === 'ad' ? entry.adId : entry.campaignId;

        if (matchKey === targetId) {
          totalEvents++;
          if (entry.action === 'flag') flaggedEvents++;
          if (entry.action === 'block') blockedEvents++;

          for (const reason of entry.reasons) {
            reasonCounts[reason] = (reasonCounts[reason] || 0) + 1;
          }
        }
      } catch {
        continue;
      }
    }

    // Get top reasons
    const topReasons = Object.entries(reasonCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([reason]) => reason);

    return {
      totalEvents,
      flaggedEvents,
      blockedEvents,
      fraudRate: totalEvents > 0 ? ((flaggedEvents + blockedEvents) / totalEvents) * 100 : 0,
      topReasons,
    };
  }

  /**
   * Add IP to blocklist
   */
  async blockIP(ip: string, reason: string): Promise<void> {
    const key = `${this.BASE_KEY}bad_ip:${ip}`;
    await this.redis.set(key, JSON.stringify({ reason, blockedAt: Date.now() }));
  }

  /**
   * Remove IP from blocklist
   */
  async unblockIP(ip: string): Promise<void> {
    await this.redis.del(`${this.BASE_KEY}bad_ip:${ip}`);
  }
}

// Singleton instance
let fraudDetectionService: FraudDetectionService | null = null;

export function getFraudDetectionService(redis: Redis): FraudDetectionService {
  if (!fraudDetectionService) {
    fraudDetectionService = new FraudDetectionService(redis);
  }
  return fraudDetectionService;
}

export function createFraudDetectionService(redis: Redis, config?: Partial<FraudConfig>): FraudDetectionService {
  fraudDetectionService = new FraudDetectionService(redis, config);
  return fraudDetectionService;
}
