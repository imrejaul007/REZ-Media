/**
 * Resolver Service - Full identity resolution implementation
 */

import { Identity, IIdentity } from '../models/Identity';

export interface ResolutionResult {
  identity: IIdentity | null;
  resolvedBy: 'id' | 'phone' | 'email' | 'device' | 'account' | null;
  confidence: number;
}

export interface MatchResult {
  identity: IIdentity;
  confidence: number;
  matchFactors: string[];
}

export class ResolverService {

  /**
   * Normalize phone number for consistent lookup
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

  /**
   * Normalize email for consistent lookup
   */
  private normalizeEmail(email: string): string {
    return email.toLowerCase().trim();
  }

  /**
   * Resolve identity by phone number
   */
  async resolveByPhone(phone: string): Promise<ResolutionResult> {
    if (!phone) {
      return { identity: null, resolvedBy: null, confidence: 0 };
    }

    const normalizedPhone = this.normalizePhone(phone);
    const identity = await Identity.findOne({ phone: normalizedPhone });

    return {
      identity,
      resolvedBy: identity ? 'phone' : null,
      confidence: identity ? 1.0 : 0,
    };
  }

  /**
   * Resolve identity by email address
   */
  async resolveByEmail(email: string): Promise<ResolutionResult> {
    if (!email) {
      return { identity: null, resolvedBy: null, confidence: 0 };
    }

    const normalizedEmail = this.normalizeEmail(email);
    const identity = await Identity.findOne({ email: normalizedEmail });

    return {
      identity,
      resolvedBy: identity ? 'email' : null,
      confidence: identity ? 0.95 : 0,
    };
  }

  /**
   * Resolve identity by device ID
   */
  async resolveByDevice(deviceId: string): Promise<ResolutionResult> {
    if (!deviceId) {
      return { identity: null, resolvedBy: null, confidence: 0 };
    }

    const identity = await Identity.findOne({ deviceIds: deviceId });

    return {
      identity,
      resolvedBy: identity ? 'device' : null,
      confidence: identity ? 0.8 : 0,
    };
  }

  /**
   * Resolve identity by linked account
   */
  async resolveByAccount(app: string, userId: string): Promise<ResolutionResult> {
    if (!app || !userId) {
      return { identity: null, resolvedBy: null, confidence: 0 };
    }

    const identity = await Identity.findOne({
      'linkedAccounts.app': app,
      'linkedAccounts.userId': userId,
    });

    return {
      identity,
      resolvedBy: identity ? 'account' : null,
      confidence: identity ? 1.0 : 0,
    };
  }

  /**
   * Resolve identity by ID
   */
  async resolveById(identityId: string): Promise<ResolutionResult> {
    if (!identityId) {
      return { identity: null, resolvedBy: null, confidence: 0 };
    }

    const identity = await Identity.findById(identityId);

    return {
      identity,
      resolvedBy: identity ? 'id' : null,
      confidence: identity ? 1.0 : 0,
    };
  }

  /**
   * Resolve identity by any identifier (tries all methods in order)
   */
  async resolve(
    identifier: {
      phone?: string;
      email?: string;
      deviceId?: string;
      app?: string;
      userId?: string;
      identityId?: string;
    }
  ): Promise<IIdentity | null> {

    // 1. Try by ID first
    if (identifier.identityId) {
      const byId = await Identity.findById(identifier.identityId);
      if (byId) return byId;
    }

    // 2. Try by linked account
    if (identifier.app && identifier.userId) {
      const byAccount = await Identity.findOne({
        'linkedAccounts.app': identifier.app,
        'linkedAccounts.userId': identifier.userId,
      });
      if (byAccount) return byAccount;
    }

    // 3. Try by phone
    if (identifier.phone) {
      const normalizedPhone = this.normalizePhone(identifier.phone);
      const byPhone = await Identity.findOne({ phone: normalizedPhone });
      if (byPhone) return byPhone;
    }

    // 4. Try by email
    if (identifier.email) {
      const normalizedEmail = this.normalizeEmail(identifier.email);
      const byEmail = await Identity.findOne({ email: normalizedEmail });
      if (byEmail) return byEmail;
    }

    // 5. Try by device
    if (identifier.deviceId) {
      const byDevice = await Identity.findOne({ deviceIds: identifier.deviceId });
      if (byDevice) return byDevice;
    }

    return null;
  }

  /**
   * Find all potential matches for a set of identifiers
   */
  async findMatches(identifier: {
    phone?: string;
    email?: string;
    deviceId?: string;
  }): Promise<MatchResult[]> {
    const matches: Map<string, MatchResult> = new Map();

    if (identifier.phone) {
      const normalizedPhone = this.normalizePhone(identifier.phone);
      const byPhone = await Identity.findOne({ phone: normalizedPhone });
      if (byPhone) {
        matches.set(byPhone._id.toString(), {
          identity: byPhone,
          confidence: 1.0,
          matchFactors: ['phone'],
        });
      }
    }

    if (identifier.email) {
      const normalizedEmail = this.normalizeEmail(identifier.email);
      const byEmail = await Identity.findOne({ email: normalizedEmail });
      if (byEmail) {
        const existing = matches.get(byEmail._id.toString());
        if (existing) {
          existing.confidence = 0.95;
          existing.matchFactors.push('email');
        } else {
          matches.set(byEmail._id.toString(), {
            identity: byEmail,
            confidence: 0.95,
            matchFactors: ['email'],
          });
        }
      }
    }

    if (identifier.deviceId) {
      const byDevice = await Identity.findOne({ deviceIds: identifier.deviceId });
      if (byDevice) {
        const existing = matches.get(byDevice._id.toString());
        if (existing) {
          existing.confidence = Math.max(existing.confidence, 0.8);
          existing.matchFactors.push('device');
        } else {
          matches.set(byDevice._id.toString(), {
            identity: byDevice,
            confidence: 0.8,
            matchFactors: ['device'],
          });
        }
      }
    }

    return Array.from(matches.values());
  }

  /**
   * Find potential duplicate identities (for merge suggestions)
   */
  async findPotentialMatches(
    identifier: { phone?: string; email?: string; deviceId?: string }
  ): Promise<IIdentity[]> {
    const matches: IIdentity[] = [];
    const seenIds = new Set<string>();

    const addMatch = (identity: IIdentity | null) => {
      if (identity && !seenIds.has(identity._id.toString())) {
        seenIds.add(identity._id.toString());
        matches.push(identity);
      }
    };

    if (identifier.phone) {
      const normalizedPhone = this.normalizePhone(identifier.phone);
      const byPhone = await Identity.findOne({ phone: normalizedPhone });
      addMatch(byPhone);
    }

    if (identifier.email) {
      const normalizedEmail = this.normalizeEmail(identifier.email);
      const byEmail = await Identity.findOne({ email: normalizedEmail });
      addMatch(byEmail);
    }

    if (identifier.deviceId) {
      const byDevice = await Identity.findOne({ deviceIds: identifier.deviceId });
      addMatch(byDevice);
    }

    return matches;
  }

  /**
   * Calculate match confidence between two identities
   */
  calculateMatchConfidence(identity1: IIdentity, identity2: IIdentity): number {
    let confidence = 0;
    let factors = 0;

    // Phone match (highest confidence)
    if (identity1.phone && identity2.phone && identity1.phone === identity2.phone) {
      confidence += 1.0;
      factors++;
    }

    // Email match
    if (identity1.email && identity2.email && identity1.email === identity2.email) {
      confidence += 0.9;
      factors++;
    }

    // WhatsApp match
    if (identity1.whatsapp && identity2.whatsapp && identity1.whatsapp === identity2.whatsapp) {
      confidence += 0.95;
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

    // Linked account overlap
    const accountOverlap = identity1.linkedAccounts?.filter(
      (a1) => identity2.linkedAccounts?.some(
        (a2) => a1.app === a2.app && a1.userId === a2.userId
      )
    );
    if (accountOverlap?.length > 0) {
      confidence += 1.0;
      factors++;
    }

    return factors > 0 ? confidence / factors : 0;
  }

  /**
   * Get detailed match analysis between two identities
   */
  async getMatchAnalysis(
    identityId1: string,
    identityId2: string
  ): Promise<{
    canMatch: boolean;
    confidence: number;
    matchFactors: {
      factor: string;
      match: boolean;
      confidence: number;
    }[];
  }> {
    const identity1 = await Identity.findById(identityId1);
    const identity2 = await Identity.findById(identityId2);

    if (!identity1 || !identity2) {
      return {
        canMatch: false,
        confidence: 0,
        matchFactors: [],
      };
    }

    const matchFactors = [
      {
        factor: 'phone',
        match: !!(identity1.phone && identity2.phone && identity1.phone === identity2.phone),
        confidence: 1.0,
      },
      {
        factor: 'email',
        match: !!(identity1.email && identity2.email && identity1.email === identity2.email),
        confidence: 0.9,
      },
      {
        factor: 'whatsapp',
        match: !!(identity1.whatsapp && identity2.whatsapp && identity1.whatsapp === identity2.whatsapp),
        confidence: 0.95,
      },
      {
        factor: 'device',
        match: identity1.deviceIds?.some((d: string) => identity2.deviceIds?.includes(d)),
        confidence: 0.7,
      },
      {
        factor: 'account',
        match: identity1.linkedAccounts?.some(
          (a1) => identity2.linkedAccounts?.some(
            (a2) => a1.app === a2.app && a1.userId === a2.userId
          )
        ),
        confidence: 1.0,
      },
    ];

    const confidence = this.calculateMatchConfidence(identity1, identity2);
    const matchingFactors = matchFactors.filter(f => f.match);
    const canMatch = confidence >= 0.7 && matchingFactors.length >= 2;

    return { canMatch, confidence, matchFactors };
  }

  /**
   * Search identities by partial match
   */
  async search(queries: {
    phone?: string;
    email?: string;
    limit?: number;
    skip?: number;
  }): Promise<{
    identities: IIdentity[];
    total: number;
  }> {
    const filter: Record<string, any> = { status: 'active' };
    const limit = queries.limit || 20;
    const skip = queries.skip || 0;

    if (queries.phone) {
      const normalizedPhone = this.normalizePhone(queries.phone);
      filter.phone = { $regex: normalizedPhone.replace(/[+]/g, '\\+'), $options: 'i' };
    }

    if (queries.email) {
      filter.email = { $regex: queries.email, $options: 'i' };
    }

    const [identities, total] = await Promise.all([
      Identity.find(filter).skip(skip).limit(limit).sort({ createdAt: -1 }),
      Identity.countDocuments(filter),
    ]);

    return { identities, total };
  }

  /**
   * Batch resolve multiple identifiers
   */
  async batchResolve(
    identifiers: Array<{
      phone?: string;
      email?: string;
      deviceId?: string;
    }>
  ): Promise<Array<{
    index: number;
    identity: IIdentity | null;
    resolvedBy: string | null;
  }>> {
    const results = await Promise.all(
      identifiers.map(async (identifier, index) => {
        const result = await this.resolve(identifier);
        return {
          index,
          identity: result,
          resolvedBy: result
            ? (identifier.phone ? 'phone' : identifier.email ? 'email' : 'device')
            : null,
        };
      })
    );

    return results;
  }

  /**
   * Find identities without linked accounts (orphans)
   */
  async findOrphanedIdentities(limit: number = 100): Promise<IIdentity[]> {
    return Identity.find({
      linkedAccounts: { $size: 0 },
      status: 'active',
    })
      .limit(limit)
      .sort({ createdAt: 1 });
  }

  /**
   * Find duplicate identities by phone
   */
  async findPhoneDuplicates(): Promise<Array<{
    phone: string;
    identities: IIdentity[];
  }>> {
    const duplicates = await Identity.aggregate([
      { $match: { phone: { $exists: true, $ne: null }, status: 'active' } },
      {
        $group: {
          _id: '$phone',
          identities: { $push: '$_id' },
          count: { $sum: 1 },
        },
      },
      { $match: { count: { $gt: 1 } } },
    ]);

    const results = [];
    for (const dup of duplicates) {
      const identities = await Identity.find({ _id: { $in: dup.identities } });
      results.push({
        phone: dup._id,
        identities,
      });
    }

    return results;
  }

  /**
   * Find duplicate identities by email
   */
  async findEmailDuplicates(): Promise<Array<{
    email: string;
    identities: IIdentity[];
  }>> {
    const duplicates = await Identity.aggregate([
      { $match: { email: { $exists: true, $ne: null }, status: 'active' } },
      {
        $group: {
          _id: '$email',
          identities: { $push: '$_id' },
          count: { $sum: 1 },
        },
      },
      { $match: { count: { $gt: 1 } } },
    ]);

    const results = [];
    for (const dup of duplicates) {
      const identities = await Identity.find({ _id: { $in: dup.identities } });
      results.push({
        email: dup._id,
        identities,
      });
    }

    return results;
  }
}

export const resolverService = new ResolverService();
