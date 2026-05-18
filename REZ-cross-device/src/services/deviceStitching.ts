/**
 * Cross-Device Stitching Service
 *
 * Stitches anonymous sessions to known users across devices.
 *
 * Features:
 * - Device fingerprinting
 * - Probabilistic matching
 * - Session stitching
 * - User journey tracking
 */

import crypto from 'crypto';
import { logger } from '../utils/logger.js';

// ─── Types ─────────────────────────────────────────────────────────────────

export interface DeviceFingerprint {
  deviceId: string;
  sessionId: string;
  merchantId: string;
  fingerprint: string;
  ipAddress?: string;
  userAgent?: string;
  firstSeen: Date;
  lastSeen: Date;
  touchpoints: string[];
}

export interface DeviceLink {
  id: string;
  sourceDeviceId: string;
  targetDeviceId: string;
  linkType: 'explicit' | 'probabilistic';
  confidence: number;
  createdAt: Date;
  expiresAt?: Date;
}

export interface StitchingResult {
  deviceId: string;
  masterId?: string;
  linkedDevices: string[];
  confidence: number;
  linkType: 'explicit' | 'probabilistic' | 'none';
}

export interface JourneyEvent {
  eventId: string;
  deviceId: string;
  sessionId: string;
  userId?: string;
  eventType: string;
  timestamp: Date;
  url?: string;
  metadata?: Record<string, unknown>;
}

// ─── Cross-Device Stitching Engine ─────────────────────────────────────────────

export class CrossDeviceStitching {
  private deviceStore: Map<string, DeviceFingerprint> = new Map();
  private linkStore: Map<string, DeviceLink> = new Map();
  private journeyStore: Map<string, JourneyEvent[]> = new Map();

  constructor() {
    logger.info('[Cross-Device] Stitching service initialized');
  }

  /**
   * Generate device fingerprint from browser properties
   */
  generateFingerprint(data: {
    userAgent: string;
    language: string;
    platform: string;
    screenWidth: number;
    screenHeight: number;
    colorDepth: number;
    timezone: string;
    canvas?: string;
    webgl?: string;
  }): string {
    const raw = [
      data.userAgent,
      data.language,
      data.platform,
      data.screenWidth,
      data.screenHeight,
      data.colorDepth,
      data.timezone,
      data.canvas || '',
      data.webgl || '',
    ].join('|');

    return crypto.createHash('sha256').update(raw).digest('hex').substring(0, 32);
  }

  /**
   * Register a device/session
   */
  registerDevice(data: {
    deviceId?: string;
    sessionId: string;
    merchantId: string;
    fingerprint: string;
    ipAddress?: string;
    userAgent?: string;
  }): DeviceFingerprint {
    const deviceId = data.deviceId || `dev_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;

    const existing = this.deviceStore.get(deviceId);

    if (existing) {
      existing.lastSeen = new Date();
      existing.touchpoints.push(data.sessionId);
      return existing;
    }

    const device: DeviceFingerprint = {
      deviceId,
      sessionId: data.sessionId,
      merchantId: data.merchantId,
      fingerprint: data.fingerprint,
      ipAddress: data.ipAddress,
      userAgent: data.userAgent,
      firstSeen: new Date(),
      lastSeen: new Date(),
      touchpoints: [data.sessionId],
    };

    this.deviceStore.set(deviceId, device);
    logger.debug('[Cross-Device] Device registered', { deviceId, merchantId: data.merchantId });

    return device;
  }

  /**
   * Link devices (explicit - login, checkout)
   */
  linkDevices(data: {
    sourceDeviceId: string;
    targetDeviceId: string;
    type: 'explicit' | 'probabilistic';
    confidence: number;
  }): DeviceLink {
    const link: DeviceLink = {
      id: `link_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
      sourceDeviceId: data.sourceDeviceId,
      targetDeviceId: data.targetDeviceId,
      linkType: data.type,
      confidence: data.confidence,
      createdAt: new Date(),
    };

    // Probabilistic links expire
    if (data.type === 'probabilistic') {
      const expiry = new Date();
      expiry.setDate(expiry.getDate() + 30);
      link.expiresAt = expiry;
    }

    this.linkStore.set(link.id, link);
    logger.info('[Cross-Device] Devices linked', {
      source: data.sourceDeviceId,
      target: data.targetDeviceId,
      type: data.type,
    });

    return link;
  }

  /**
   * Resolve device to master user
   */
  resolveToMaster(deviceId: string): StitchingResult {
    const device = this.deviceStore.get(deviceId);

    if (!device) {
      return {
        deviceId,
        linkedDevices: [],
        confidence: 0,
        linkType: 'none',
      };
    }

    // Find all linked devices
    const linkedDevices: string[] = [deviceId];
    let masterId = deviceId;
    let maxConfidence = 1.0;

    for (const link of this.linkStore.values()) {
      if (link.sourceDeviceId === deviceId) {
        linkedDevices.push(link.targetDeviceId);
        if (link.confidence > maxConfidence) {
          masterId = link.targetDeviceId;
          maxConfidence = link.confidence;
        }
      }
      if (link.targetDeviceId === deviceId) {
        linkedDevices.push(link.sourceDeviceId);
        if (link.confidence > maxConfidence) {
          masterId = link.sourceDeviceId;
          maxConfidence = link.confidence;
        }
      }
    }

    // Get link type
    const linkType = this.getLinkType(deviceId);

    return {
      deviceId,
      masterId,
      linkedDevices: [...new Set(linkedDevices)],
      confidence: maxConfidence,
      linkType,
    };
  }

  /**
   * Track journey event
   */
  trackEvent(event: Omit<JourneyEvent, 'eventId'>): JourneyEvent {
    const fullEvent: JourneyEvent = {
      ...event,
      eventId: `evt_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
    };

    const journey = this.journeyStore.get(event.sessionId) || [];
    journey.push(fullEvent);
    this.journeyStore.set(event.sessionId, journey);

    return fullEvent;
  }

  /**
   * Get user journey across devices
   */
  getUserJourney(userId: string): JourneyEvent[] {
    const allEvents: JourneyEvent[] = [];

    // Find all sessions for this user
    for (const events of this.journeyStore.values()) {
      const userEvents = events.filter(e => e.userId === userId);
      allEvents.push(...userEvents);
    }

    // Sort by timestamp
    return allEvents.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }

  /**
   * Probabilistic matching based on signals
   */
  calculateMatchScore(device1: DeviceFingerprint, device2: DeviceFingerprint): number {
    let score = 0;
    let maxScore = 0;

    // IP address match (20 points)
    maxScore += 20;
    if (device1.ipAddress && device2.ipAddress && device1.ipAddress === device2.ipAddress) {
      score += 20;
    }

    // User agent match (15 points)
    maxScore += 15;
    if (device1.userAgent && device2.userAgent) {
      const uaSimilarity = this.calculateStringSimilarity(
        device1.userAgent,
        device2.userAgent
      );
      score += 15 * uaSimilarity;
    }

    // Fingerprint match (30 points)
    maxScore += 30;
    if (device1.fingerprint === device2.fingerprint) {
      score += 30;
    }

    // Time proximity (20 points)
    maxScore += 20;
    const timeDiff = Math.abs(
      device1.firstSeen.getTime() - device2.firstSeen.getTime()
    ) / (1000 * 60 * 60); // hours

    if (timeDiff < 1) score += 20;
    else if (timeDiff < 24) score += 15;
    else if (timeDiff < 168) score += 10; // 1 week

    // Same merchant (15 points)
    maxScore += 15;
    if (device1.merchantId === device2.merchantId) {
      score += 15;
    }

    return score / maxScore;
  }

  /**
   * Simple string similarity (Jaccard)
   */
  private calculateStringSimilarity(str1: string, str2: string): number {
    const set1 = new Set(str1.split(''));
    const set2 = new Set(str2.split(''));

    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);

    return union.size > 0 ? intersection.size / union.size : 0;
  }

  /**
   * Find probable matches for a device
   */
  findProbableMatches(deviceId: string, threshold = 0.7): Array<{ deviceId: string; score: number }> {
    const device = this.deviceStore.get(deviceId);
    if (!device) return [];

    const matches: Array<{ deviceId: string; score: number }> = [];

    for (const [otherId, otherDevice] of this.deviceStore) {
      if (otherId === deviceId) continue;
      if (otherDevice.merchantId !== device.merchantId) continue;

      const score = this.calculateMatchScore(device, otherDevice);

      if (score >= threshold) {
        matches.push({ deviceId: otherId, score });
      }
    }

    return matches.sort((a, b) => b.score - a.score);
  }

  /**
   * Get link type for device
   */
  private getLinkType(deviceId: string): 'explicit' | 'probabilistic' | 'none' {
    for (const link of this.linkStore.values()) {
      if (link.sourceDeviceId === deviceId || link.targetDeviceId === deviceId) {
        return link.linkType;
      }
    }
    return 'none';
  }

  /**
   * Cleanup expired links
   */
  cleanupExpiredLinks(): number {
    let count = 0;
    const now = new Date();

    for (const [id, link] of this.linkStore.entries()) {
      if (link.expiresAt && link.expiresAt < now) {
        this.linkStore.delete(id);
        count++;
      }
    }

    logger.info('[Cross-Device] Cleaned up expired links', { count });
    return count;
  }
}

export const crossDeviceStitching = new CrossDeviceStitching();
export default crossDeviceStitching;
