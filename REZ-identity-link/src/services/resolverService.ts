/**
 * Resolver Service - Resolve identity from any identifier
 */

import { Identity } from '../models/Identity';

export class ResolverService {

  /**
   * Resolve identity by any identifier
   */
  async resolve(
    identifier: { phone?: string; email?: string; deviceId?: string; app?: string; userId?: string }
  ): Promise<any | null> {

    // 1. Try by ID first
    if (identifier.app && identifier.userId) {
      const byAccount = await Identity.findOne({
        'linkedAccounts.app': identifier.app,
        'linkedAccounts.userId': identifier.userId,
      });
      if (byAccount) return byAccount;
    }

    // 2. Try by phone
    if (identifier.phone) {
      const byPhone = await Identity.findOne({ phone: identifier.phone });
      if (byPhone) return byPhone;
    }

    // 3. Try by email
    if (identifier.email) {
      const byEmail = await Identity.findOne({ email: identifier.email });
      if (byEmail) return byEmail;
    }

    // 4. Try by device
    if (identifier.deviceId) {
      const byDevice = await Identity.findOne({ deviceIds: identifier.deviceId });
      if (byDevice) return byDevice;
    }

    return null;
  }

  /**
   * Find potential matches for merging
   */
  async findPotentialMatches(
    identifier: { phone?: string; email?: string; deviceId?: string }
  ): Promise<any[]> {
    const matches: any[] = [];

    if (identifier.phone) {
      const byPhone = await Identity.findOne({ phone: identifier.phone });
      if (byPhone && !matches.find(m => m._id.equals(byPhone._id))) {
        matches.push(byPhone);
      }
    }

    if (identifier.email) {
      const byEmail = await Identity.findOne({ email: identifier.email });
      if (byEmail && !matches.find(m => m._id.equals(byEmail._id))) {
        matches.push(byEmail);
      }
    }

    if (identifier.deviceId) {
      const byDevice = await Identity.findOne({ deviceIds: identifier.deviceId });
      if (byDevice && !matches.find(m => m._id.equals(byDevice._id))) {
        matches.push(byDevice);
      }
    }

    return matches;
  }

  /**
   * Calculate match confidence between two identities
   */
  calculateMatchConfidence(identity1: any, identity2: any): number {
    let confidence = 0;
    let factors = 0;

    // Phone match
    if (identity1.phone && identity2.phone && identity1.phone === identity2.phone) {
      confidence += 1.0;
      factors++;
    }

    // Email match
    if (identity1.email && identity2.email && identity1.email === identity2.email) {
      confidence += 0.9;
      factors++;
    }

    // Device overlap
    const deviceOverlap = identity1.deviceIds?.filter(
      (d: string) => identity2.deviceIds?.includes(d)
    );
    if (deviceOverlap?.length > 0) {
      confidence += 0.7 * Math.min(deviceOverlap.length, 3) / 3;
      factors++;
    }

    // WhatsApp match
    if (identity1.whatsapp && identity2.whatsapp && identity1.whatsapp === identity2.whatsapp) {
      confidence += 0.95;
      factors++;
    }

    return factors > 0 ? confidence / factors : 0;
  }
}

export const resolverService = new ResolverService();
