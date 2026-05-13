/**
 * Linker Service - Full account linking implementation
 */

import { Identity, IIdentity } from '../models/Identity';
import { resolverService } from './resolverService';
import { identityService } from './identityService';
import { v4 as uuid } from 'uuid';

export interface LinkResult {
  success: boolean;
  identity?: IIdentity;
  isNew: boolean;
  linked: boolean;
  error?: string;
}

export interface MergeResult {
  success: boolean;
  mergedIdentity?: IIdentity;
  sourceIdentity?: IIdentity;
  mergedAccountIds: string[];
  error?: string;
}

export class LinkerService {

  /**
   * Link a new account to existing identity
   */
  async linkAccount(
    identityId: string,
    app: string,
    userId: string,
    identifier: { phone?: string; email?: string; deviceId?: string }
  ): Promise<LinkResult> {
    try {
      const identity = await Identity.findById(identityId);
      if (!identity) {
        return { success: false, isNew: false, linked: false, error: 'Identity not found' };
      }

      // Check if already linked
      const existing = identity.linkedAccounts.find(
        a => a.app === app && a.userId === userId
      );
      if (existing) {
        return { success: true, identity, isNew: false, linked: true };
      }

      // Add new linked account
      identity.linkedAccounts.push({
        app,
        userId,
        linkedAt: new Date(),
        confidence: 1.0,
      });

      // Update identifiers if provided
      if (identifier.phone && !identity.phone) {
        identity.phone = identifier.phone;
      }
      if (identifier.email && !identity.email) {
        identity.email = identifier.email;
      }
      if (identifier.deviceId && !identity.deviceIds.includes(identifier.deviceId)) {
        identity.deviceIds.push(identifier.deviceId);
      }

      await identity.save();
      return { success: true, identity, isNew: false, linked: true };
    } catch (error) {
      return {
        success: false,
        isNew: false,
        linked: false,
        error: error.message,
      };
    }
  }

  /**
   * Link by phone (find or create)
   */
  async linkByPhone(
    phone: string,
    app: string,
    userId: string
  ): Promise<LinkResult> {
    try {
      // Normalize phone
      const normalizedPhone = this.normalizePhone(phone);

      // Find existing by phone
      let identity = await Identity.findOne({ phone: normalizedPhone });

      if (identity) {
        // Check if already linked
        const existing = identity.linkedAccounts.find(
          a => a.app === app && a.userId === userId
        );
        if (existing) {
          return { success: true, identity, isNew: false, linked: true };
        }

        // Link to existing
        identity.linkedAccounts.push({
          app,
          userId,
          linkedAt: new Date(),
          confidence: 1.0,
        });
        await identity.save();
        return { success: true, identity, isNew: false, linked: true };
      }

      // Create new identity
      identity = await identityService.createIdentity({
        phone: normalizedPhone,
        app,
        userId,
      });

      return { success: true, identity, isNew: true, linked: true };
    } catch (error) {
      return {
        success: false,
        isNew: false,
        linked: false,
        error: error.message,
      };
    }
  }

  /**
   * Link by email (find or create)
   */
  async linkByEmail(
    email: string,
    app: string,
    userId: string
  ): Promise<LinkResult> {
    try {
      // Normalize email
      const normalizedEmail = email.toLowerCase().trim();

      // Find existing by email
      let identity = await Identity.findOne({ email: normalizedEmail });

      if (identity) {
        // Check if already linked
        const existing = identity.linkedAccounts.find(
          a => a.app === app && a.userId === userId
        );
        if (existing) {
          return { success: true, identity, isNew: false, linked: true };
        }

        // Link to existing
        identity.linkedAccounts.push({
          app,
          userId,
          linkedAt: new Date(),
          confidence: 0.95,
        });
        await identity.save();
        return { success: true, identity, isNew: false, linked: true };
      }

      // Create new identity
      identity = await identityService.createIdentity({
        email: normalizedEmail,
        app,
        userId,
      });

      return { success: true, identity, isNew: true, linked: true };
    } catch (error) {
      return {
        success: false,
        isNew: false,
        linked: false,
        error: error.message,
      };
    }
  }

  /**
   * Link by device fingerprint
   */
  async linkByDevice(
    deviceId: string,
    app: string,
    userId: string
  ): Promise<LinkResult> {
    try {
      // Find identity with this device
      let identity = await Identity.findOne({ deviceIds: deviceId });

      if (identity) {
        // Check if already linked
        const existing = identity.linkedAccounts.find(
          a => a.app === app && a.userId === userId
        );
        if (existing) {
          return { success: true, identity, isNew: false, linked: true };
        }

        // Add account with lower confidence for device-only link
        identity.linkedAccounts.push({
          app,
          userId,
          linkedAt: new Date(),
          confidence: 0.8,
        });
        await identity.save();
        return { success: true, identity, isNew: false, linked: true };
      }

      // Create new identity with device
      identity = await identityService.createIdentity({
        deviceId,
        app,
        userId,
      });

      return { success: true, identity, isNew: true, linked: true };
    } catch (error) {
      return {
        success: false,
        isNew: false,
        linked: false,
        error: error.message,
      };
    }
  }

  /**
   * Unlink account from identity
   */
  async unlinkAccount(
    identityId: string,
    app: string,
    userId: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const identity = await Identity.findById(identityId);
      if (!identity) {
        return { success: false, error: 'Identity not found' };
      }

      const initialCount = identity.linkedAccounts.length;
      identity.linkedAccounts = identity.linkedAccounts.filter(
        a => !(a.app === app && a.userId === userId)
      );

      if (identity.linkedAccounts.length === initialCount) {
        return { success: false, error: 'Account not found on identity' };
      }

      await identity.save();
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Merge two identities (full implementation)
   */
  async mergeIdentities(
    sourceIdentityId: string,
    targetIdentityId: string,
    reason?: string,
    performedBy?: string
  ): Promise<MergeResult> {
    try {
      return await identityService.mergeIdentities({
        sourceIdentityId,
        targetIdentityId,
        reason,
        performedBy,
      });
    } catch (error) {
      return {
        success: false,
        mergedAccountIds: [],
        error: error.message,
      };
    }
  }

  /**
   * Link with OTP verification
   */
  async linkWithVerification(
    identifier: { phone?: string; email?: string; deviceId?: string },
    app: string,
    userId: string,
    verified: boolean
  ): Promise<LinkResult> {
    if (!verified) {
      return {
        success: false,
        isNew: false,
        linked: false,
        error: 'Identifier not verified',
      };
    }

    if (identifier.phone) {
      return this.linkByPhone(identifier.phone, app, userId);
    }
    if (identifier.email) {
      return this.linkByEmail(identifier.email, app, userId);
    }
    if (identifier.deviceId) {
      return this.linkByDevice(identifier.deviceId, app, userId);
    }

    return {
      success: false,
      isNew: false,
      linked: false,
      error: 'No identifier provided',
    };
  }

  /**
   * Auto-link: Find or create identity based on any available identifier
   */
  async autoLink(
    identifier: { phone?: string; email?: string; deviceId?: string },
    app: string,
    userId: string
  ): Promise<LinkResult> {
    // Try to resolve existing identity
    const existing = await resolverService.resolve(identifier);

    if (existing) {
      // Link to existing
      return this.linkAccount(existing._id.toString(), app, userId, identifier);
    }

    // Create new identity
    try {
      const identity = await identityService.createIdentity({
        phone: identifier.phone,
        email: identifier.email,
        deviceId: identifier.deviceId,
        app,
        userId,
      });

      return { success: true, identity, isNew: true, linked: true };
    } catch (error) {
      return {
        success: false,
        isNew: false,
        linked: false,
        error: error.message,
      };
    }
  }

  /**
   * Transfer account from one identity to another
   */
  async transferAccount(
    accountApp: string,
    accountUserId: string,
    fromIdentityId: string,
    toIdentityId: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const fromIdentity = await Identity.findById(fromIdentityId);
      const toIdentity = await Identity.findById(toIdentityId);

      if (!fromIdentity || !toIdentity) {
        return { success: false, error: 'Identity not found' };
      }

      // Find the account
      const accountIndex = fromIdentity.linkedAccounts.findIndex(
        a => a.app === accountApp && a.userId === accountUserId
      );

      if (accountIndex === -1) {
        return { success: false, error: 'Account not found on source identity' };
      }

      // Check if already exists on target
      const existsOnTarget = toIdentity.linkedAccounts.some(
        a => a.app === accountApp && a.userId === accountUserId
      );

      if (!existsOnTarget) {
        // Move account
        const account = fromIdentity.linkedAccounts[accountIndex];
        account.linkedAt = new Date();
        account.confidence = 0.9; // Slightly lower confidence for transfer
        toIdentity.linkedAccounts.push(account);
        await toIdentity.save();
      }

      // Remove from source
      fromIdentity.linkedAccounts.splice(accountIndex, 1);
      await fromIdentity.save();

      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Get all apps linked to an identity
   */
  async getLinkedApps(identityId: string): Promise<string[]> {
    const identity = await Identity.findById(identityId);
    if (!identity) return [];

    return [...new Set(identity.linkedAccounts.map(a => a.app))];
  }

  /**
   * Check if account is linked
   */
  async isAccountLinked(app: string, userId: string): Promise<boolean> {
    const identity = await Identity.findOne({
      'linkedAccounts.app': app,
      'linkedAccounts.userId': userId,
    });

    return !!identity;
  }

  /**
   * Get identity ID for an account
   */
  async getIdentityIdForAccount(app: string, userId: string): Promise<string | null> {
    const identity = await Identity.findOne({
      'linkedAccounts.app': app,
      'linkedAccounts.userId': userId,
    });

    return identity ? identity._id.toString() : null;
  }

  /**
   * Batch link multiple accounts to identity
   */
  async batchLink(
    identityId: string,
    accounts: Array<{ app: string; userId: string }>
  ): Promise<{ success: boolean; linked: number; failed: number; errors: string[] }> {
    const identity = await Identity.findById(identityId);
    if (!identity) {
      return { success: false, linked: 0, failed: accounts.length, errors: ['Identity not found'] };
    }

    let linked = 0;
    const errors: string[] = [];

    for (const account of accounts) {
      const existing = identity.linkedAccounts.find(
        a => a.app === account.app && a.userId === account.userId
      );
      if (!existing) {
        identity.linkedAccounts.push({
          app: account.app,
          userId: account.userId,
          linkedAt: new Date(),
          confidence: 1.0,
        });
        linked++;
      }
    }

    try {
      await identity.save();
      return { success: true, linked, failed: accounts.length - linked, errors };
    } catch (error) {
      return { success: false, linked: 0, failed: accounts.length, errors: [error.message] };
    }
  }

  /**
   * Normalize phone number
   */
  private normalizePhone(phone: string): string {
    const digits = phone.replace(/\D/g, '');
    if (digits.length === 10) {
      return `+91${digits}`;
    }
    if (digits.length === 12 && digits.startsWith('91')) {
      return `+${digits}`;
    }
    return phone;
  }
}

export const linkerService = new LinkerService();
