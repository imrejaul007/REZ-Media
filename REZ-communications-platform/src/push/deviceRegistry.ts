/**
 * Device Registry Service
 * Manages FCM device tokens, user-device mappings, and multi-app support
 */

import Redis from 'ioredis';
import { v4 as uuidv4 } from 'uuid';
import { logger, LogContext } from '../utils/logger';
import { ValidationError, PushError } from '../utils/errors';

// Supported apps
export const SUPPORTED_APPS = [
  'adBazaar',
  'creators',
  'dooh-mobile',
  'hotel-ota',
  'rendez',
  'food-delivery'
] as const;

export type SupportedApp = typeof SUPPORTED_APPS[number];

export type DevicePlatform = 'ios' | 'android' | 'web';

export interface DeviceRegistration {
  id: string;
  userId: string;
  appId: SupportedApp;
  token: string;
  platform: DevicePlatform;
  deviceId?: string;
  deviceName?: string;
  deviceVersion?: string;
  appVersion?: string;
  createdAt: Date;
  updatedAt: Date;
  lastActiveAt: Date;
  isActive: boolean;
}

export interface DeviceSubscription {
  userId: string;
  appId: SupportedApp;
  topic: string;
  token: string;
  subscribedAt: Date;
}

export interface RegisterDeviceParams {
  userId: string;
  appId: SupportedApp;
  token: string;
  platform: DevicePlatform;
  deviceId?: string;
  deviceName?: string;
  deviceVersion?: string;
  appVersion?: string;
}

export interface FindDevicesParams {
  userId: string;
  appId?: SupportedApp;
  platform?: DevicePlatform;
  activeOnly?: boolean;
}

/**
 * Device Registry Service
 * Stores and manages device tokens using Redis for fast access
 */
export class DeviceRegistry {
  private redis: Redis;
  private log: LogContext;
  private isConnected: boolean = false;

  // Key prefixes
  private readonly DEVICE_KEY_PREFIX = 'push:device:';
  private readonly USER_DEVICES_PREFIX = 'push:user:';
  private readonly APP_DEVICES_PREFIX = 'push:app:';
  private readonly TOKEN_INDEX_PREFIX = 'push:token:';
  private readonly TOPIC_SUBSCRIPTIONS_PREFIX = 'push:topic:';

  constructor(redisClient?: Redis) {
    this.log = new LogContext(logger, { service: 'DeviceRegistry' });

    if (redisClient) {
      this.redis = redisClient;
      this.isConnected = true;
    } else {
      const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
      this.redis = new Redis(redisUrl, {
        maxRetriesPerRequest: 3,
        retryStrategy: (times) => {
          if (times > 3) {
            this.log.warn('Redis connection failed, running in memory mode');
            return null;
          }
          return Math.min(times * 100, 3000);
        }
      });

      this.redis.on('connect', () => {
        this.isConnected = true;
        this.log.info('Device registry connected to Redis');
      });

      this.redis.on('error', (err) => {
        this.isConnected = false;
        this.log.error('Redis connection error', err);
      });
    }
  }

  /**
   * Register a device token for a user
   */
  async registerDevice(params: RegisterDeviceParams): Promise<DeviceRegistration> {
    const { userId, appId, token, platform, deviceId, deviceName, deviceVersion, appVersion } = params;

    // Validate inputs
    this.validateAppId(appId);
    this.validatePlatform(platform);
    this.validateToken(token);
    this.validateUserId(userId);

    const now = new Date();
    const existingDevice = await this.findByToken(token);

    // Check if this token already exists
    if (existingDevice) {
      // Update existing registration
      if (existingDevice.userId !== userId || existingDevice.appId !== appId) {
        // Token was registered to different user/app, update it
        await this.updateDevice(existingDevice.id, {
          userId,
          appId,
          lastActiveAt: now,
          isActive: true
        });
        this.log.info('Device token re-assigned', {
          deviceId: existingDevice.id,
          previousUserId: existingDevice.userId,
          newUserId: userId
        });
      } else {
        // Same user/app, just update last active
        await this.updateDevice(existingDevice.id, { lastActiveAt: now });
      }

      return (await this.findByToken(token))!;
    }

    // Create new device registration
    const id = uuidv4();
    const registration: DeviceRegistration = {
      id,
      userId,
      appId,
      token,
      platform,
      deviceId,
      deviceName,
      deviceVersion,
      appVersion,
      createdAt: now,
      updatedAt: now,
      lastActiveAt: now,
      isActive: true
    };

    // Store device data
    await this.storeDevice(registration);

    // Index by user
    await this.redis.sadd(`${this.USER_DEVICES_PREFIX}${userId}`, id);

    // Index by app
    await this.redis.sadd(`${this.APP_DEVICES_PREFIX}${appId}`, id);

    // Index by token
    await this.redis.set(`${this.TOKEN_INDEX_PREFIX}${this.hashToken(token)}`, id, 'EX', 30 * 24 * 60 * 60); // 30 days

    this.log.info('Device registered', {
      deviceId: id,
      userId,
      appId,
      platform
    });

    return registration;
  }

  /**
   * Update device registration
   */
  async updateDevice(deviceId: string, updates: Partial<Omit<DeviceRegistration, 'id' | 'createdAt'>>): Promise<DeviceRegistration | null> {
    const device = await this.getDevice(deviceId);
    if (!device) {
      return null;
    }

    const updated: DeviceRegistration = {
      ...device,
      ...updates,
      updatedAt: new Date()
    };

    await this.storeDevice(updated);
    return updated;
  }

  /**
   * Get device by ID
   */
  async getDevice(deviceId: string): Promise<DeviceRegistration | null> {
    const data = await this.redis.hgetall(`${this.DEVICE_KEY_PREFIX}${deviceId}`);
    if (!data || Object.keys(data).length === 0) {
      return null;
    }
    return this.deserializeDevice(deviceId, data);
  }

  /**
   * Find device by token
   */
  async findByToken(token: string): Promise<DeviceRegistration | null> {
    const tokenHash = this.hashToken(token);
    const deviceId = await this.redis.get(`${this.TOKEN_INDEX_PREFIX}${tokenHash}`);

    if (!deviceId) {
      return null;
    }

    return this.getDevice(deviceId);
  }

  /**
   * Find all devices for a user
   */
  async findDevicesByUser(params: FindDevicesParams): Promise<DeviceRegistration[]> {
    const { userId, appId, platform, activeOnly = true } = params;

    this.validateUserId(userId);

    const deviceIds = await this.redis.smembers(`${this.USER_DEVICES_PREFIX}${userId}`);
    if (deviceIds.length === 0) {
      return [];
    }

    const devices: DeviceRegistration[] = [];
    for (const deviceId of deviceIds) {
      const device = await this.getDevice(deviceId);
      if (device) {
        if (appId && device.appId !== appId) continue;
        if (platform && device.platform !== platform) continue;
        if (activeOnly && !device.isActive) continue;
        devices.push(device);
      } else {
        // Device was deleted, clean up index
        await this.redis.srem(`${this.USER_DEVICES_PREFIX}${userId}`, deviceId);
      }
    }

    return devices;
  }

  /**
   * Get all tokens for a user (optionally filtered by app)
   */
  async getTokensForUser(userId: string, appId?: SupportedApp): Promise<string[]> {
    const devices = await this.findDevicesByUser({ userId, appId, activeOnly: true });
    return devices.map(d => d.token);
  }

  /**
   * Get all tokens for an app
   */
  async getTokensForApp(appId: SupportedApp, platform?: DevicePlatform): Promise<string[]> {
    this.validateAppId(appId);

    const deviceIds = await this.redis.smembers(`${this.APP_DEVICES_PREFIX}${appId}`);
    if (deviceIds.length === 0) {
      return [];
    }

    const tokens: string[] = [];
    for (const deviceId of deviceIds) {
      const device = await this.getDevice(deviceId);
      if (device && device.isActive) {
        if (platform && device.platform !== platform) continue;
        tokens.push(device.token);
      }
    }

    return tokens;
  }

  /**
   * Unsubscribe/unregister a device
   */
  async unregisterDevice(userId: string, token: string): Promise<boolean> {
    this.validateUserId(userId);
    this.validateToken(token);

    const device = await this.findByToken(token);
    if (!device) {
      return false;
    }

    if (device.userId !== userId) {
      throw new PushError(
        'Device does not belong to user',
        'DEVICE_MISMATCH',
        { retryable: false }
      );
    }

    // Remove device
    await this.redis.del(`${this.DEVICE_KEY_PREFIX}${device.id}`);

    // Clean up indexes
    await this.redis.srem(`${this.USER_DEVICES_PREFIX}${userId}`, device.id);
    await this.redis.srem(`${this.APP_DEVICES_PREFIX}${device.appId}`, device.id);
    await this.redis.del(`${this.TOKEN_INDEX_PREFIX}${this.hashToken(token)}`);

    this.log.info('Device unregistered', {
      deviceId: device.id,
      userId,
      appId: device.appId
    });

    return true;
  }

  /**
   * Mark device as inactive (soft delete)
   */
  async deactivateDevice(userId: string, token: string): Promise<boolean> {
    const device = await this.findByToken(token);
    if (!device || device.userId !== userId) {
      return false;
    }

    await this.updateDevice(device.id, { isActive: false });
    return true;
  }

  /**
   * Subscribe device to a topic
   */
  async subscribeToTopic(userId: string, token: string, topic: string, appId: SupportedApp): Promise<void> {
    this.validateUserId(userId);
    this.validateToken(token);
    this.validateAppId(appId);

    const device = await this.findByToken(token);
    if (!device) {
      throw new PushError('Device not registered', 'DEVICE_NOT_FOUND', { retryable: false });
    }

    const subscription: DeviceSubscription = {
      userId,
      appId,
      topic,
      token,
      subscribedAt: new Date()
    };

    const key = `${this.TOPIC_SUBSCRIPTIONS_PREFIX}${appId}:${topic}`;
    await this.redis.hset(key, token, JSON.stringify(subscription));

    // Also maintain a set of subscribers
    await this.redis.sadd(`${key}:subscribers`, token);

    this.log.info('Device subscribed to topic', {
      userId,
      appId,
      topic,
      tokenPrefix: token.substring(0, 10)
    });
  }

  /**
   * Unsubscribe device from a topic
   */
  async unsubscribeFromTopic(userId: string, token: string, topic: string, appId: SupportedApp): Promise<void> {
    const key = `${this.TOPIC_SUBSCRIPTIONS_PREFIX}${appId}:${topic}`;

    await this.redis.hdel(key, token);
    await this.redis.srem(`${key}:subscribers`, token);

    this.log.info('Device unsubscribed from topic', {
      userId,
      appId,
      topic,
      tokenPrefix: token.substring(0, 10)
    });
  }

  /**
   * Get all subscribers for a topic
   */
  async getTopicSubscribers(appId: SupportedApp, topic: string): Promise<string[]> {
    const key = `${this.TOPIC_SUBSCRIPTIONS_PREFIX}${appId}:${topic}`;
    return await this.redis.smembers(`${key}:subscribers`);
  }

  /**
   * Get app identifier for display
   */
  getAppDisplayName(appId: SupportedApp): string {
    const displayNames: Record<SupportedApp, string> = {
      'adBazaar': 'AdBazaar',
      'creators': 'Creators',
      'dooh-mobile': 'DOOH Mobile',
      'hotel-ota': 'Hotel OTA',
      'rendez': 'Rendez',
      'food-delivery': 'Food Delivery'
    };
    return displayNames[appId];
  }

  /**
   * Get statistics for an app
   */
  async getAppStats(appId: SupportedApp): Promise<{
    totalDevices: number;
    iosDevices: number;
    androidDevices: number;
    webDevices: number;
  }> {
    const tokens = await this.getTokensForApp(appId);

    const deviceDetails = await Promise.all(
      tokens.map(token => this.findByToken(token))
    );

    const validDevices = deviceDetails.filter((d): d is DeviceRegistration => d !== null);

    return {
      totalDevices: validDevices.length,
      iosDevices: validDevices.filter(d => d.platform === 'ios').length,
      androidDevices: validDevices.filter(d => d.platform === 'android').length,
      webDevices: validDevices.filter(d => d.platform === 'web').length
    };
  }

  /**
   * Clean up inactive devices (older than specified days)
   */
  async cleanupInactiveDevices(maxInactiveDays: number = 90): Promise<number> {
    let cleaned = 0;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - maxInactiveDays);

    for (const appId of SUPPORTED_APPS) {
      const deviceIds = await this.redis.smembers(`${this.APP_DEVICES_PREFIX}${appId}`);

      for (const deviceId of deviceIds) {
        const device = await this.getDevice(deviceId);
        if (device && !device.isActive) {
          await this.redis.del(`${this.DEVICE_KEY_PREFIX}${deviceId}`);
          await this.redis.srem(`${this.APP_DEVICES_PREFIX}${appId}`, deviceId);
          await this.redis.srem(`${this.USER_DEVICES_PREFIX}${device.userId}`, deviceId);
          await this.redis.del(`${this.TOKEN_INDEX_PREFIX}${this.hashToken(device.token)}`);
          cleaned++;
        }
      }
    }

    this.log.info('Inactive devices cleaned up', { count: cleaned });
    return cleaned;
  }

  // Private helper methods

  private async storeDevice(device: DeviceRegistration): Promise<void> {
    const key = `${this.DEVICE_KEY_PREFIX}${device.id}`;
    const data = this.serializeDevice(device);
    await this.redis.hmset(key, data);
  }

  private serializeDevice(device: DeviceRegistration): Record<string, string> {
    return {
      id: device.id,
      userId: device.userId,
      appId: device.appId,
      token: device.token,
      platform: device.platform,
      deviceId: device.deviceId || '',
      deviceName: device.deviceName || '',
      deviceVersion: device.deviceVersion || '',
      appVersion: device.appVersion || '',
      createdAt: device.createdAt.toISOString(),
      updatedAt: device.updatedAt.toISOString(),
      lastActiveAt: device.lastActiveAt.toISOString(),
      isActive: device.isActive ? '1' : '0'
    };
  }

  private deserializeDevice(id: string, data: Record<string, string>): DeviceRegistration {
    return {
      id,
      userId: data.userId,
      appId: data.appId as SupportedApp,
      token: data.token,
      platform: data.platform as DevicePlatform,
      deviceId: data.deviceId || undefined,
      deviceName: data.deviceName || undefined,
      deviceVersion: data.deviceVersion || undefined,
      appVersion: data.appVersion || undefined,
      createdAt: new Date(data.createdAt),
      updatedAt: new Date(data.updatedAt),
      lastActiveAt: new Date(data.lastActiveAt),
      isActive: data.isActive === '1'
    };
  }

  private hashToken(token: string): string {
    // Simple hash for index lookup - tokens can be long
    const crypto = require('crypto');
    return crypto.createHash('sha256').update(token).digest('hex').substring(0, 32);
  }

  private validateAppId(appId: string): void {
    if (!SUPPORTED_APPS.includes(appId as SupportedApp)) {
      throw new ValidationError('Invalid app ID', [{
        field: 'appId',
        message: `App must be one of: ${SUPPORTED_APPS.join(', ')}`
      }]);
    }
  }

  private validatePlatform(platform: string): void {
    const validPlatforms: DevicePlatform[] = ['ios', 'android', 'web'];
    if (!validPlatforms.includes(platform as DevicePlatform)) {
      throw new ValidationError('Invalid platform', [{
        field: 'platform',
        message: 'Platform must be ios, android, or web'
      }]);
    }
  }

  private validateToken(token: string): void {
    if (!token || token.length < 10) {
      throw new ValidationError('Invalid token', [{
        field: 'token',
        message: 'Token must be at least 10 characters'
      }]);
    }
  }

  private validateUserId(userId: string): void {
    if (!userId || userId.length < 1) {
      throw new ValidationError('Invalid user ID', [{
        field: 'userId',
        message: 'User ID is required'
      }]);
    }
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<{ healthy: boolean; error?: string }> {
    try {
      await this.redis.ping();
      return { healthy: true };
    } catch (error) {
      return {
        healthy: false,
        error: (error as Error).message
      };
    }
  }

  /**
   * Cleanup resources
   */
  async destroy(): Promise<void> {
    await this.redis.quit();
    this.log.info('Device registry destroyed');
  }
}

// ============================================
// FACTORY FUNCTION
// ============================================

let deviceRegistryInstance: DeviceRegistry | null = null;

export function createDeviceRegistry(redisClient?: Redis): DeviceRegistry {
  if (!deviceRegistryInstance) {
    deviceRegistryInstance = new DeviceRegistry(redisClient);
  }
  return deviceRegistryInstance;
}

export function getDeviceRegistry(): DeviceRegistry {
  if (!deviceRegistryInstance) {
    return createDeviceRegistry();
  }
  return deviceRegistryInstance;
}
