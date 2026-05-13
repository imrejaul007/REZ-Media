import CryptoJS from 'crypto-js';
import UAParser from 'ua-parser-js';
import geoip from 'geoip-lite';
import { IDevice } from '../models/Device';
import { FraudSignalType, FraudSignal } from '../types';
import { logger } from '../config/logger';

interface FingerprintComponents {
  userAgent: string;
  screenResolution: string;
  timezone: string;
  language: string;
  platform: string;
  canvasHash: string;
  webglHash: string;
  audioHash: string;
  ipAddress: string;
}

interface FingerprintResult {
  fingerprintId: string;
  fingerprintHash: string;
  isNewDevice: boolean;
  isTrusted: boolean;
  trustScore: number;
  device: IDevice | null;
  signals: FraudSignal[];
  ipInfo: {
    country: string;
    city: string;
    isp: string;
    isProxy: boolean;
    isTor: boolean;
  };
}

const FINGERPRINT_SECRET = process.env.FINGERPRINT_SECRET || 'default-secret';

export class DeviceFingerprintService {
  /**
   * Generate a fingerprint from client components
   */
  generateFingerprint(components: FingerprintComponents): string {
    const fingerprintData = [
      components.userAgent,
      components.screenResolution,
      components.timezone,
      components.language,
      components.platform,
      components.canvasHash,
      components.webglHash,
      components.audioHash,
    ].join('|');

    return CryptoJS.HmacSHA256(fingerprintData, FINGERPRINT_SECRET).toString();
  }

  /**
   * Generate a unique fingerprint ID
   */
  generateFingerprintId(userId: string, fingerprintHash: string): string {
    const data = `${userId}:${fingerprintHash}:${Date.now()}`;
    return CryptoJS.SHA256(data).toString().substring(0, 32);
  }

  /**
   * Get IP geolocation info
   */
  getIpInfo(ipAddress: string): {
    country: string;
    city: string;
    isp: string;
    isProxy: boolean;
    isTor: boolean;
  } {
    const geo = geoip.lookup(ipAddress);

    // In production, integrate with IP intelligence services
    // For now, use basic geoip-lite data
    const isProxy = false; // Would be determined by IP intelligence API
    const isTor = false; // Would be determined by Tor exit node list

    return {
      country: geo?.country || 'XX',
      city: geo?.city || 'Unknown',
      isp: 'Unknown', // Would need MaxMind or similar for ISP info
      isProxy,
      isTor,
    };
  }

  /**
   * Parse user agent
   */
  parseUserAgent(userAgent: string): {
    browser: string;
    browserVersion: string;
    os: string;
    osVersion: string;
    device: string;
    isMobile: boolean;
    isBot: boolean;
  } {
    const parser = new UAParser.UAParser(userAgent);
    const result = parser.getResult();

    return {
      browser: result.browser.name || 'Unknown',
      browserVersion: result.browser.version || 'Unknown',
      os: result.os.name || 'Unknown',
      osVersion: result.os.version || 'Unknown',
      device: result.device.type || 'desktop',
      isMobile: result.device.type === 'mobile' || result.device.type === 'tablet',
      isBot: result.browser.name?.toLowerCase().includes('bot') || false,
    };
  }

  /**
   * Analyze device and return risk assessment
   */
  async analyzeDevice(
    userId: string,
    components: FingerprintComponents,
    existingDevice?: IDevice | null
  ): Promise<FingerprintResult> {
    const fingerprintHash = this.generateFingerprint(components);
    const ipInfo = this.getIpInfo(components.ipAddress);
    const parsedUA = this.parseUserAgent(components.userAgent);

    const signals: FraudSignal[] = [];
    let isNewDevice = true;
    let isTrusted = false;
    let trustScore = 50;

    if (existingDevice) {
      isNewDevice = false;
      trustScore = existingDevice.trustScore;
      isTrusted = existingDevice.isTrusted;

      // Check for fingerprint mismatch
      if (existingDevice.fingerprintHash !== fingerprintHash) {
        signals.push({
          type: FraudSignalType.DEVICE_FINGERPRINT_MISMATCH,
          severity: 'HIGH',
          description: 'Device fingerprint does not match registered device',
          value: true,
        });
        trustScore = Math.max(0, trustScore - 30);
      }

      // Check for IP change with same device
      if (existingDevice.ipAddress !== components.ipAddress) {
        const oldCountry = existingDevice.country;
        const newCountry = ipInfo.country;

        if (oldCountry !== newCountry) {
          signals.push({
            type: FraudSignalType.UNUSUAL_LOCATION,
            severity: 'MEDIUM',
            description: `Order from different country than usual (${oldCountry} -> ${newCountry})`,
            value: { from: oldCountry, to: newCountry },
          });
          trustScore = Math.max(0, trustScore - 20);
        }
      }

      // Check for proxy
      if (ipInfo.isProxy || ipInfo.isTor) {
        const severity = ipInfo.isTor ? 'HIGH' : 'MEDIUM';
        signals.push({
          type: FraudSignalType.IP_PROXY,
          severity,
          description: ipInfo.isTor ? 'Tor exit node detected' : 'Proxy/VPN detected',
          value: ipInfo.isTor,
        });
        trustScore = Math.max(0, trustScore - 25);
      }

      // Check for bot
      if (parsedUA.isBot) {
        signals.push({
          type: FraudSignalType.NEW_DEVICE,
          severity: 'CRITICAL',
          description: 'Bot traffic detected',
          value: true,
        });
        trustScore = 0;
      }
    } else {
      // New device
      signals.push({
        type: FraudSignalType.NEW_DEVICE,
        severity: 'MEDIUM',
        description: 'New device detected for this user',
        value: true,
      });

      // New device from different country
      if (ipInfo.country !== 'IN') {
        signals.push({
          type: FraudSignalType.UNUSUAL_LOCATION,
          severity: 'MEDIUM',
          description: `New device from unusual location: ${ipInfo.country}`,
          value: ipInfo.country,
        });
      }

      // New device with proxy
      if (ipInfo.isProxy || ipInfo.isTor) {
        signals.push({
          type: FraudSignalType.IP_PROXY,
          severity: ipInfo.isTor ? 'HIGH' : 'MEDIUM',
          description: 'Proxy/VPN on new device',
          value: true,
        });
        trustScore = Math.max(0, trustScore - 20);
      }

      // High value order on new device
      trustScore = Math.max(0, trustScore - 15);
    }

    // Update trust score based on device history
    if (existingDevice) {
      if (existingDevice.totalOrders >= 10) trustScore += 10;
      if (existingDevice.successfulOrders / existingDevice.totalOrders >= 0.9) trustScore += 15;
      if (existingDevice.codReturnRate > 0.5) trustScore -= 20;
    }

    trustScore = Math.max(0, Math.min(100, trustScore));
    isTrusted = trustScore >= 70;

    logger.info('Device fingerprint analysis', {
      userId,
      isNewDevice,
      isTrusted,
      trustScore,
      signalsCount: signals.length,
      fingerprintHash: fingerprintHash.substring(0, 8),
    });

    return {
      fingerprintId: existingDevice?.fingerprintId || this.generateFingerprintId(userId, fingerprintHash),
      fingerprintHash,
      isNewDevice,
      isTrusted,
      trustScore,
      device: existingDevice,
      signals,
      ipInfo,
    };
  }

  /**
   * Calculate device risk score (0-100, lower is better)
   */
  calculateDeviceRiskScore(
    isNewDevice: boolean,
    trustScore: number,
    signals: FraudSignal[]
  ): number {
    let score = 0;

    // Start with inverse of trust score
    score = 100 - trustScore;

    // Add penalty for signals
    for (const signal of signals) {
      switch (signal.severity) {
        case 'CRITICAL':
          score += 30;
          break;
        case 'HIGH':
          score += 20;
          break;
        case 'MEDIUM':
          score += 10;
          break;
        case 'LOW':
          score += 5;
          break;
      }
    }

    // New device penalty
    if (isNewDevice) {
      score += 15;
    }

    // Cap at 100
    return Math.min(100, Math.max(0, score));
  }
}

export const deviceFingerprintService = new DeviceFingerprintService();
