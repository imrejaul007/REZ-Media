/**
 * Linker Service - Link accounts across apps
 */

import { Identity } from '../models/Identity';
import { v4 as uuid } from 'uuid';

export class LinkerService {

  /**
   * Link a new account to existing identity
   */
  async linkAccount(
    identityId: string,
    app: string,
    userId: string,
    identifier: { phone?: string; email?: string; deviceId?: string }
  ): Promise<{ success: boolean; identity: any }> {

    const identity = await Identity.findById(identityId);
    if (!identity) {
      throw new Error('Identity not found');
    }

    // Check if already linked
    const existing = identity.linkedAccounts.find(
      a => a.app === app && a.userId === userId
    );
    if (existing) {
      return { success: true, identity };
    }

    // Add new linked account
    identity.linkedAccounts.push({
      app,
      userId,
      linkedAt: new Date(),
      confidence: 1.0,
    });

    // Update identifiers
    if (identifier.phone) identity.phone = identifier.phone;
    if (identifier.email) identity.email = identifier.email;
    if (identifier.deviceId && !identity.deviceIds.includes(identifier.deviceId)) {
      identity.deviceIds.push(identifier.deviceId);
    }

    await identity.save();
    return { success: true, identity };
  }

  /**
   * Link by phone (find or create)
   */
  async linkByPhone(
    phone: string,
    app: string,
    userId: string
  ): Promise<{ identity: any; isNew: boolean }> {

    // Find existing by phone
    let identity = await Identity.findOne({ phone });

    if (identity) {
      // Link to existing
      const existing = identity.linkedAccounts.find(
        a => a.app === app && a.userId === userId
      );
      if (!existing) {
        identity.linkedAccounts.push({
          app,
          userId,
          linkedAt: new Date(),
          confidence: 1.0,
        });
        await identity.save();
      }
      return { identity, isNew: false };
    }

    // Create new
    identity = new Identity({
      phone,
      linkedAccounts: [{ app, userId }],
    });
    await identity.save();
    return { identity, isNew: true };
  }

  /**
   * Link by device fingerprint
   */
  async linkByDevice(
    deviceId: string,
    app: string,
    userId: string
  ): Promise<{ identity: any; linked: boolean }> {

    // Find identity with this device
    let identity = await Identity.findOne({ deviceIds: deviceId });

    if (identity) {
      // Add account if not already linked
      const existing = identity.linkedAccounts.find(
        a => a.app === app && a.userId === userId
      );
      if (!existing) {
        identity.linkedAccounts.push({
          app,
          userId,
          linkedAt: new Date(),
          confidence: 0.8, // Device link is less confident
        });
        await identity.save();
      }
      return { identity, linked: true };
    }

    // Create new identity with device
    identity = new Identity({
      deviceIds: [deviceId],
      linkedAccounts: [{
        app,
        userId,
        linkedAt: new Date(),
        confidence: 0.8,
      }],
    });
    await identity.save();
    return { identity, linked: false };
  }

  /**
   * Unlink account from identity
   */
  async unlinkAccount(
    identityId: string,
    app: string,
    userId: string
  ): Promise<{ success: boolean }> {

    const identity = await Identity.findById(identityId);
    if (!identity) {
      throw new Error('Identity not found');
    }

    identity.linkedAccounts = identity.linkedAccounts.filter(
      a => !(a.app === app && a.userId === userId)
    );

    await identity.save();
    return { success: true };
  }
}

export const linkerService = new LinkerService();
