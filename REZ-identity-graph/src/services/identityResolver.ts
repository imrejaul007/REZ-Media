/**
 * Identity Resolution Service
 *
 * Resolves and links user identities across devices and sessions.
 *
 * Features:
 * - Deterministic matching (email, phone, loyalty ID)
 * - Probabilistic matching (device, IP, fingerprint)
 * - Identity graph traversal
 * - Profile merging
 */

import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger.js';
import type {
  IdentityNode,
  IdentityEdge,
  CustomerProfile,
  CustomerAttributes,
  ResolutionRequest,
  ResolutionResult,
  IdentityType,
  LinkType,
  LinkContext,
} from '../types/index.js';

// ─── Hash Utilities ─────────────────────────────────────────────────────────────

/**
 * Hash email for consistent matching
 */
export function hashEmail(email: string): string {
  return crypto
    .createHash('sha256')
    .update(email.toLowerCase().trim())
    .digest('hex');
}

/**
 * Normalize and hash phone number
 */
export function hashPhone(phone: string): string {
  // Remove all non-numeric except +
  const normalized = phone.replace(/[^0-9+]/g, '');
  return crypto
    .createHash('sha256')
    .update(normalized)
    .digest('hex');
}

/**
 * Hash any string for storage
 */
export function hashValue(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

// ─── Identity Resolver ───────────────────────────────────────────────────────────

export class IdentityResolver {
  // In-memory store (in production, use Redis + MongoDB)
  private identities: Map<string, IdentityNode> = new Map();
  private edges: Map<string, IdentityEdge> = new Map();
  private profiles: Map<string, CustomerProfile> = new Map();

  // Identity type to hash function mapping
  private hashFunctions: Record<IdentityType, (v: string) => string> = {
    email: hashEmail,
    phone: hashPhone,
    device_id: hashValue,
    session_id: hashValue,
    cookie_id: hashValue,
    external_id: hashValue,
    loyalty_id: hashValue,
    qr_scan_id: hashValue,
    pos_customer_id: hashValue,
    whatsapp_id: hashValue,
    user_agent: hashValue,
    ip_address: hashValue,
  };

  /**
   * Resolve identities to a customer profile
   */
  async resolve(request: ResolutionRequest): Promise<ResolutionResult> {
    logger.debug('[IdentityResolver] Resolving identities', { request });

    const matchedIdentities: IdentityNode[] = [];
    const links: IdentityEdge[] = [];

    // Normalize and hash all provided identities
    const normalizedIds = this.normalizeIdentities(request);

    // Find existing identities
    for (const [type, value] of Object.entries(normalizedIds)) {
      if (!value) continue;

      const identity = await this.findIdentity(type as IdentityType, value);
      if (identity) {
        matchedIdentities.push(identity);

        // Find links
        const identityLinks = await this.findLinks(identity.id);
        links.push(...identityLinks);
      }
    }

    // Determine if we found a customer
    let customerId: string | undefined;
    let found = false;
    let created = false;
    let confidence = 0;

    if (matchedIdentities.length > 0) {
      // Get customer ID from any matched identity via links
      const primaryIdentity = matchedIdentities[0];
      const profileId = await this.getProfileIdForIdentity(primaryIdentity.id);

      if (profileId) {
        customerId = profileId;
        found = true;
      }
    }

    // If not found, create new profile
    if (!found && Object.values(normalizedIds).some(Boolean)) {
      customerId = await this.createProfile(normalizedIds, request.merchantId);
      found = true;
      created = true;
    }

    // Calculate confidence based on identity types
    confidence = this.calculateConfidence(normalizedIds);

    // Link new identities to existing profile
    if (customerId && matchedIdentities.length > 0) {
      await this.linkToProfile(customerId, normalizedIds, 'same_user');
    }

    return {
      found,
      customerId,
      matchedIdentities,
      links,
      created,
      confidence,
    };
  }

  /**
   * Normalize identities for storage
   */
  private normalizeIdentities(request: ResolutionRequest): Record<string, string> {
    return {
      email: request.email ? hashEmail(request.email) : '',
      phone: request.phone ? hashPhone(request.phone) : '',
      device_id: request.deviceId || '',
      session_id: request.sessionId || '',
      external_id: request.externalId || '',
      loyalty_id: request.loyaltyId || '',
      qr_scan_id: request.qrScanId || '',
      pos_customer_id: request.posCustomerId || '',
      ip_address: request.clientIp ? hashValue(request.clientIp) : '',
    };
  }

  /**
   * Find identity by type and value
   */
  async findIdentity(type: IdentityType, value: string): Promise<IdentityNode | null> {
    const key = `${type}:${value}`;
    return this.identities.get(key) || null;
  }

  /**
   * Create a new identity node
   */
  async createIdentity(
    type: IdentityType,
    value: string,
    options?: {
      confidence?: number;
      verified?: boolean;
      merchantId?: string;
      storeId?: string;
    }
  ): Promise<IdentityNode> {
    const hashedValue = this.hashFunctions[type]?.(value) || hashValue(value);
    const key = `${type}:${hashedValue}`;

    // Check if exists
    const existing = this.identities.get(key);
    if (existing) {
      // Update last seen
      existing.lastSeen = new Date();
      this.identities.set(key, existing);
      return existing;
    }

    const identity: IdentityNode = {
      id: uuidv4(),
      type,
      value: hashedValue,
      firstSeen: new Date(),
      lastSeen: new Date(),
      confidence: options?.confidence ?? 1,
      verified: options?.verified ?? false,
      merchantId: options?.merchantId,
      storeId: options?.storeId,
    };

    this.identities.set(key, identity);
    logger.debug('[IdentityResolver] Created identity', { type, value: hashedValue.substring(0, 8) + '...' });

    return identity;
  }

  /**
   * Link two identities
   */
  async linkIdentities(
    sourceId: string,
    targetId: string,
    linkType: LinkType,
    confidence: number,
    context?: LinkContext
  ): Promise<IdentityEdge> {
    // Create bidirectional links
    const edge1 = this.createEdge(sourceId, targetId, linkType, confidence, context);
    const edge2 = this.createEdge(targetId, sourceId, linkType, confidence, context);

    this.edges.set(edge1.id, edge1);
    this.edges.set(edge2.id, edge2);

    logger.info('[IdentityResolver] Linked identities', {
      sourceId: sourceId.substring(0, 8),
      targetId: targetId.substring(0, 8),
      linkType,
    });

    return edge1;
  }

  /**
   * Create an edge
   */
  private createEdge(
    sourceId: string,
    targetId: string,
    linkType: LinkType,
    confidence: number,
    context?: LinkContext
  ): IdentityEdge {
    return {
      id: `${sourceId}-${targetId}-${Date.now()}`,
      sourceId,
      targetId,
      linkType,
      confidence,
      createdAt: new Date(),
      context,
    };
  }

  /**
   * Find links for an identity
   */
  async findLinks(identityId: string): Promise<IdentityEdge[]> {
    const links: IdentityEdge[] = [];
    for (const edge of this.edges.values()) {
      if (edge.sourceId === identityId || edge.targetId === identityId) {
        links.push(edge);
      }
    }
    return links;
  }

  /**
   * Create a new customer profile
   */
  private async createProfile(
    identities: Record<string, string>,
    merchantId?: string
  ): Promise<string> {
    const profileId = uuidv4();
    const now = new Date();

    // Create identity nodes for all provided IDs
    const identityNodes: IdentityNode[] = [];

    for (const [type, value] of Object.entries(identities)) {
      if (!value) continue;

      const node = await this.createIdentity(type as IdentityType, value, {
        merchantId,
        confidence: this.getIdentityConfidence(type as IdentityType),
      });

      identityNodes.push(node);

      // Link all identities to each other
      if (identityNodes.length > 1) {
        const prev = identityNodes[identityNodes.length - 2];
        await this.linkIdentities(
          prev.id,
          node.id,
          'explicit_login',
          this.getIdentityConfidence(type as IdentityType),
          { eventType: 'profile_creation' }
        );
      }
    }

    // Create profile
    const profile: CustomerProfile = {
      id: profileId,
      identities: identityNodes,
      attributes: {
        devices: [],
        locations: [],
        tags: [],
      },
      sources: [],
      lifetime: {
        totalOrders: 0,
        totalSpend: 0,
        averageOrderValue: 0,
        tenureDays: 0,
      },
      createdAt: now,
      updatedAt: now,
    };

    this.profiles.set(profileId, profile);

    logger.info('[IdentityResolver] Created profile', { profileId, identityCount: identityNodes.length });

    return profileId;
  }

  /**
   * Get profile ID for an identity
   */
  private async getProfileIdForIdentity(identityId: string): Promise<string | null> {
    // Find all linked identities
    const visited = new Set<string>();
    const toVisit = [identityId];

    while (toVisit.length > 0) {
      const current = toVisit.pop()!;
      if (visited.has(current)) continue;
      visited.add(current);

      // Check if this identity is in a profile
      for (const [profileId, profile] of this.profiles.entries()) {
        if (profile.identities.some(i => i.id === current)) {
          return profileId;
        }
      }

      // Find connected identities
      const links = await this.findLinks(current);
      for (const link of links) {
        if (!visited.has(link.sourceId)) toVisit.push(link.sourceId);
        if (!visited.has(link.targetId)) toVisit.push(link.targetId);
      }
    }

    return null;
  }

  /**
   * Link identities to existing profile
   */
  private async linkToProfile(
    profileId: string,
    identities: Record<string, string>,
    linkType: LinkType
  ): Promise<void> {
    const profile = this.profiles.get(profileId);
    if (!profile) return;

    for (const [type, value] of Object.entries(identities)) {
      if (!value) continue;

      const existing = await this.findIdentity(type as IdentityType, value);
      if (existing && !profile.identities.some(i => i.id === existing.id)) {
        // Link to existing identities
        for (const existingIdentity of profile.identities) {
          await this.linkIdentities(
            existingIdentity.id,
            existing.id,
            linkType,
            this.getIdentityConfidence(type as IdentityType)
          );
        }

        // Add to profile
        profile.identities.push(existing);
        profile.updatedAt = new Date();
        this.profiles.set(profileId, profile);
      }
    }
  }

  /**
   * Calculate confidence based on identity types provided
   */
  private calculateConfidence(identities: Record<string, string>): number {
    let score = 0;
    let maxScore = 0;

    // Weight by identity type
    const weights: Record<string, number> = {
      email: 0.4,
      phone: 0.3,
      loyalty_id: 0.2,
      pos_customer_id: 0.2,
      device_id: 0.15,
      external_id: 0.1,
      session_id: 0.05,
      ip_address: 0.05,
    };

    for (const [type, value] of Object.entries(identities)) {
      maxScore += weights[type] || 0.05;
      if (value) {
        score += weights[type] || 0.05;
      }
    }

    return maxScore > 0 ? score / maxScore : 0;
  }

  /**
   * Get confidence for identity type
   */
  private getIdentityConfidence(type: IdentityType): number {
    const confidence: Record<IdentityType, number> = {
      email: 0.95,
      phone: 0.9,
      loyalty_id: 0.95,
      pos_customer_id: 0.95,
      external_id: 0.85,
      device_id: 0.7,
      qr_scan_id: 0.6,
      whatsapp_id: 0.8,
      cookie_id: 0.5,
      session_id: 0.4,
      user_agent: 0.3,
      ip_address: 0.2,
    };

    return confidence[type] || 0.5;
  }

  /**
   * Get profile by ID
   */
  async getProfile(profileId: string): Promise<CustomerProfile | null> {
    return this.profiles.get(profileId) || null;
  }

  /**
   * Update profile attributes
   */
  async updateProfile(profileId: string, attributes: Partial<CustomerAttributes>): Promise<void> {
    const profile = this.profiles.get(profileId);
    if (!profile) return;

    profile.attributes = { ...profile.attributes, ...attributes };
    profile.updatedAt = new Date();
    this.profiles.set(profileId, profile);
  }

  /**
   * Merge two profiles
   */
  async mergeProfiles(primaryId: string, secondaryId: string): Promise<void> {
    const primary = this.profiles.get(primaryId);
    const secondary = this.profiles.get(secondaryId);

    if (!primary || !secondary) return;

    // Merge identities
    for (const identity of secondary.identities) {
      if (!primary.identities.some(i => i.id === identity.id)) {
        primary.identities.push(identity);
      }
    }

    // Merge attributes
    if (secondary.attributes.firstName && !primary.attributes.firstName) {
      primary.attributes.firstName = secondary.attributes.firstName;
    }
    if (secondary.attributes.primaryEmail && !primary.attributes.primaryEmail) {
      primary.attributes.primaryEmail = secondary.attributes.primaryEmail;
    }

    // Delete secondary profile
    this.profiles.delete(secondaryId);

    logger.info('[IdentityResolver] Merged profiles', {
      primaryId,
      secondaryId,
    });
  }
}

// Singleton instance
export const identityResolver = new IdentityResolver();
export default identityResolver;
