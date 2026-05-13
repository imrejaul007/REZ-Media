/**
 * Identity Service - Core identity operations
 */

import { Identity, IIdentity } from '../models/Identity';
import { linkerService } from './linkerService';
import { resolverService } from './resolverService';
import { v4 as uuid } from 'uuid';

export interface CreateIdentityOptions {
  phone?: string;
  email?: string;
  whatsapp?: string;
  deviceId?: string;
  app?: string;
  userId?: string;
  profile?: {
    app: string;
    profileId: string;
    name?: string;
    avatar?: string;
  };
}

export interface MergeOptions {
  sourceIdentityId: string;
  targetIdentityId: string;
  reason?: string;
  performedBy?: string;
}

export class IdentityService {

  /**
   * Create a new identity with optional linked account
   */
  async createIdentity(options: CreateIdentityOptions): Promise<IIdentity> {
    const { phone, email, whatsapp, deviceId, app, userId, profile } = options;

    // Check if identity already exists with these identifiers
    const existing = await resolverService.resolve({ phone, email, deviceId });
    if (existing) {
      throw new Error('Identity already exists with these identifiers');
    }

    const identityData: Partial<IIdentity> = {
      deviceIds: deviceId ? [deviceId] : [],
      linkedAccounts: [],
      profiles: [],
      wallets: [],
      mergeHistory: [],
      status: 'active',
      riskFlags: [],
    };

    if (phone) identityData.phone = phone;
    if (email) identityData.email = email;
    if (whatsapp) identityData.whatsapp = whatsapp;

    if (app && userId) {
      identityData.linkedAccounts = [{
        app,
        userId,
        linkedAt: new Date(),
        confidence: 1.0,
      }];
    }

    if (profile) {
      identityData.profiles = [profile];
    }

    const identity = new Identity(identityData);
    await identity.save();

    return identity;
  }

  /**
   * Find identity by phone number
   */
  async findByPhone(phone: string): Promise<IIdentity | null> {
    if (!phone) return null;

    // Normalize phone number
    const normalizedPhone = this.normalizePhone(phone);
    return Identity.findOne({ phone: normalizedPhone });
  }

  /**
   * Find identity by email address
   */
  async findByEmail(email: string): Promise<IIdentity | null> {
    if (!email) return null;

    // Normalize email
    const normalizedEmail = email.toLowerCase().trim();
    return Identity.findOne({ email: normalizedEmail });
  }

  /**
   * Find identity by device ID
   */
  async findByDevice(deviceId: string): Promise<IIdentity | null> {
    if (!deviceId) return null;
    return Identity.findOne({ deviceIds: deviceId });
  }

  /**
   * Find identity by ID
   */
  async findById(identityId: string): Promise<IIdentity | null> {
    return Identity.findById(identityId);
  }

  /**
   * Find identity by linked account
   */
  async findByLinkedAccount(app: string, userId: string): Promise<IIdentity | null> {
    return Identity.findOne({
      'linkedAccounts.app': app,
      'linkedAccounts.userId': userId,
    });
  }

  /**
   * Find all identities for a phone (including potential duplicates)
   */
  async findAllByPhone(phone: string): Promise<IIdentity[]> {
    const normalizedPhone = this.normalizePhone(phone);
    return Identity.find({ phone: normalizedPhone });
  }

  /**
   * Find all identities for an email (including potential duplicates)
   */
  async findAllByEmail(email: string): Promise<IIdentity[]> {
    const normalizedEmail = email.toLowerCase().trim();
    return Identity.find({ email: normalizedEmail });
  }

  /**
   * Merge two identities
   */
  async mergeIdentities(options: MergeOptions): Promise<{
    success: boolean;
    mergedIdentity: IIdentity;
    mergedAccountIds: string[];
  }> {
    const { sourceIdentityId, targetIdentityId, reason, performedBy } = options;

    // Validate both identities exist
    const sourceIdentity = await Identity.findById(sourceIdentityId);
    const targetIdentity = await Identity.findById(targetIdentityId);

    if (!sourceIdentity) {
      throw new Error(`Source identity not found: ${sourceIdentityId}`);
    }
    if (!targetIdentity) {
      throw new Error(`Target identity not found: ${targetIdentityId}`);
    }

    // Cannot merge into self
    if (sourceIdentityId === targetIdentityId) {
      throw new Error('Cannot merge identity into itself');
    }

    // Cannot merge already merged identities
    if (sourceIdentity.mergedInto) {
      throw new Error('Source identity has already been merged');
    }
    if (targetIdentity.mergedInto) {
      throw new Error('Target identity has already been merged');
    }

    // Use transaction for atomic merge
    const session = await Identity.startSession();
    session.startTransaction();

    try {
      const mergedAccountIds: string[] = [];

      // Merge linked accounts (avoiding duplicates)
      for (const account of sourceIdentity.linkedAccounts) {
        const exists = targetIdentity.linkedAccounts.some(
          a => a.app === account.app && a.userId === account.userId
        );
        if (!exists) {
          targetIdentity.linkedAccounts.push({
            ...account,
            confidence: Math.min(account.confidence, 0.9), // Reduce confidence on merge
          });
          mergedAccountIds.push(`${account.app}:${account.userId}`);
        }
      }

      // Merge profiles
      for (const profile of sourceIdentity.profiles) {
        const exists = targetIdentity.profiles.some(
          p => p.app === profile.app && p.profileId === profile.profileId
        );
        if (!exists) {
          targetIdentity.profiles.push(profile);
        }
      }

      // Merge device IDs
      for (const deviceId of sourceIdentity.deviceIds) {
        if (!targetIdentity.deviceIds.includes(deviceId)) {
          targetIdentity.deviceIds.push(deviceId);
        }
      }

      // Merge identifiers (prefer existing target values)
      if (!targetIdentity.phone && sourceIdentity.phone) {
        targetIdentity.phone = sourceIdentity.phone;
      }
      if (!targetIdentity.email && sourceIdentity.email) {
        targetIdentity.email = sourceIdentity.email;
      }
      if (!targetIdentity.whatsapp && sourceIdentity.whatsapp) {
        targetIdentity.whatsapp = sourceIdentity.whatsapp;
      }

      // Merge wallets
      for (const wallet of sourceIdentity.wallets) {
        const exists = targetIdentity.wallets.some(
          w => w.type === wallet.type && w.app === wallet.app
        );
        if (!exists) {
          targetIdentity.wallets.push(wallet);
        }
      }

      // Update source identity to mark as merged
      sourceIdentity.mergedInto = targetIdentityId;
      sourceIdentity.status = 'merged';
      sourceIdentity.mergeHistory.push(...targetIdentity.mergeHistory, targetIdentityId);

      // Add to target's merge history
      targetIdentity.mergeHistory.push(sourceIdentityId);

      // Add audit info
      targetIdentity.mergeHistory.push(`merged:${reason || 'no-reason'}:${performedBy || 'system'}:${Date.now()}`);

      // Save all changes
      await sourceIdentity.save({ session });
      await targetIdentity.save({ session });

      await session.commitTransaction();

      return {
        success: true,
        mergedIdentity: targetIdentity,
        mergedAccountIds,
      };
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  /**
   * Update identity profile
   */
  async updateProfile(
    identityId: string,
    app: string,
    profileId: string,
    updates: { name?: string; avatar?: string }
  ): Promise<IIdentity | null> {
    const identity = await Identity.findById(identityId);
    if (!identity) return null;

    const profileIndex = identity.profiles.findIndex(
      p => p.app === app && p.profileId === profileId
    );

    if (profileIndex >= 0) {
      if (updates.name) identity.profiles[profileIndex].name = updates.name;
      if (updates.avatar) identity.profiles[profileIndex].avatar = updates.avatar;
    } else {
      identity.profiles.push({
        app,
        profileId,
        name: updates.name,
        avatar: updates.avatar,
      });
    }

    await identity.save();
    return identity;
  }

  /**
   * Add device to identity
   */
  async addDevice(identityId: string, deviceId: string): Promise<IIdentity | null> {
    const identity = await Identity.findById(identityId);
    if (!identity) return null;

    if (!identity.deviceIds.includes(deviceId)) {
      identity.deviceIds.push(deviceId);
      await identity.save();
    }

    return identity;
  }

  /**
   * Remove device from identity
   */
  async removeDevice(identityId: string, deviceId: string): Promise<IIdentity | null> {
    const identity = await Identity.findById(identityId);
    if (!identity) return null;

    identity.deviceIds = identity.deviceIds.filter(d => d !== deviceId);
    await identity.save();

    return identity;
  }

  /**
   * Update identity status
   */
  async updateStatus(
    identityId: string,
    status: 'active' | 'merged' | 'flagged' | 'suspended'
  ): Promise<IIdentity | null> {
    const identity = await Identity.findById(identityId);
    if (!identity) return null;

    identity.status = status;
    await identity.save();

    return identity;
  }

  /**
   * Add risk flag to identity
   */
  async addRiskFlag(identityId: string, flag: string): Promise<IIdentity | null> {
    const identity = await Identity.findById(identityId);
    if (!identity) return null;

    if (!identity.riskFlags.includes(flag)) {
      identity.riskFlags.push(flag);
      await identity.save();
    }

    return identity;
  }

  /**
   * Remove risk flag from identity
   */
  async removeRiskFlag(identityId: string, flag: string): Promise<IIdentity | null> {
    const identity = await Identity.findById(identityId);
    if (!identity) return null;

    identity.riskFlags = identity.riskFlags.filter(f => f !== flag);
    await identity.save();

    return identity;
  }

  /**
   * Get all linked accounts across apps for an identity
   */
  async getLinkedAccounts(identityId: string): Promise<{
    app: string;
    userId: string;
    linkedAt: Date;
    confidence: number;
  }[]> {
    const identity = await Identity.findById(identityId);
    if (!identity) return [];

    return identity.linkedAccounts;
  }

  /**
   * Link wallet to identity
   */
  async linkWallet(
    identityId: string,
    walletType: 'cash' | 'coins' | 'points',
    app: string
  ): Promise<IIdentity | null> {
    const identity = await Identity.findById(identityId);
    if (!identity) return null;

    const existingWallet = identity.wallets.find(
      w => w.type === walletType && w.app === app
    );

    if (!existingWallet) {
      identity.wallets.push({
        type: walletType,
        app,
        linked: true,
      });
      await identity.save();
    }

    return identity;
  }

  /**
   * Unlink wallet from identity
   */
  async unlinkWallet(
    identityId: string,
    walletType: 'cash' | 'coins' | 'points',
    app: string
  ): Promise<IIdentity | null> {
    const identity = await Identity.findById(identityId);
    if (!identity) return null;

    identity.wallets = identity.wallets.filter(
      w => !(w.type === walletType && w.app === app)
    );
    await identity.save();

    return identity;
  }

  /**
   * Check if two identities can be confidently matched
   */
  async canMatch(sourceId: string, targetId: string): Promise<{
    canMatch: boolean;
    confidence: number;
    reasons: string[];
  }> {
    const source = await Identity.findById(sourceId);
    const target = await Identity.findById(targetId);

    if (!source || !target) {
      return { canMatch: false, confidence: 0, reasons: ['Identity not found'] };
    }

    const reasons: string[] = [];
    let confidence = 0;
    let factors = 0;

    // Phone match
    if (source.phone && target.phone && source.phone === target.phone) {
      confidence += 1.0;
      factors++;
      reasons.push('Phone number matches');
    }

    // Email match
    if (source.email && target.email && source.email === target.email) {
      confidence += 0.9;
      factors++;
      reasons.push('Email matches');
    }

    // Device overlap
    const deviceOverlap = source.deviceIds.filter(d => target.deviceIds.includes(d));
    if (deviceOverlap.length > 0) {
      confidence += 0.7 * Math.min(deviceOverlap.length, 3) / 3;
      factors++;
      reasons.push(`Device overlap: ${deviceOverlap.length} device(s)`);
    }

    // WhatsApp match
    if (source.whatsapp && target.whatsapp && source.whatsapp === target.whatsapp) {
      confidence += 0.95;
      factors++;
      reasons.push('WhatsApp matches');
    }

    const avgConfidence = factors > 0 ? confidence / factors : 0;
    const canMatch = avgConfidence >= 0.7 && factors >= 2;

    return { canMatch, confidence: avgConfidence, reasons };
  }

  /**
   * Get identity summary
   */
  async getSummary(identityId: string): Promise<{
    id: string;
    phone?: string;
    email?: string;
    whatsapp?: string;
    apps: string[];
    devices: number;
    wallets: { type: string; app: string }[];
    status: string;
    riskFlags: string[];
    createdAt: Date;
    linkedAccountsCount: number;
  } | null> {
    const identity = await Identity.findById(identityId);
    if (!identity) return null;

    return {
      id: identity._id.toString(),
      phone: identity.phone,
      email: identity.email,
      whatsapp: identity.whatsapp,
      apps: [...new Set(identity.linkedAccounts.map(a => a.app))],
      devices: identity.deviceIds.length,
      wallets: identity.wallets.map(w => ({ type: w.type, app: w.app })),
      status: identity.status,
      riskFlags: identity.riskFlags,
      createdAt: identity.createdAt,
      linkedAccountsCount: identity.linkedAccounts.length,
    };
  }

  /**
   * Normalize phone number
   */
  private normalizePhone(phone: string): string {
    // Remove all non-digits
    const digits = phone.replace(/\D/g, '');

    // Add country code if missing (India +91)
    if (digits.length === 10) {
      return `+91${digits}`;
    }

    // Already has country code
    if (digits.length === 12 && digits.startsWith('91')) {
      return `+${digits}`;
    }

    return phone;
  }
}

export const identityService = new IdentityService();
