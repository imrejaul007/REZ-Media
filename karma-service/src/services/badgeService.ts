import { Badge, EarnedBadge, DEFAULT_BADGES, seedBadges } from '../models/Badge';
import { Types } from 'mongoose';
import { logger } from '../config/logger';

export interface BadgeCheckResult {
  badgeId: string;
  name: string;
  earned: boolean;
  earnedAt?: Date;
}

// Cross-merchant badge validation rules
const CROSS_MERCHANT_BADGE_RULES: Record<string, {
  requireAllMerchants?: string[];
  requireAnyMerchant?: string[];
  maxMerchants?: number;
}> = {
  'multi_merchant_loyalist': {
    requireAnyMerchant: ['merchant_a', 'merchant_b', 'merchant_c'],
    maxMerchants: 3
  },
  'pan_india_explorer': {
    requireAllMerchants: ['north', 'south', 'east', 'west'],
    maxMerchants: 4
  }
};

export class BadgeService {
  async checkAndAwardBadges(
    userId: string,
    event: string,
    data: any = {}
  ): Promise<BadgeCheckResult[]> {
    // Seed badges if needed
    await this.ensureBadgesSeeded();

    const earnedBadges: BadgeCheckResult[] = [];
    const allBadges = await Badge.find({ isActive: true });

    for (const badge of allBadges) {
      // Check if already earned
      const alreadyEarned = await EarnedBadge.findOne({
        userId: new Types.ObjectId(userId),
        badgeId: badge._id
      });

      if (alreadyEarned) continue;

      // Check if criteria met
      const earned = await this.checkBadgeCriteria(userId, badge, event, data);

      if (earned) {
        await EarnedBadge.create({
          userId: new Types.ObjectId(userId),
          badgeId: badge._id,
          message: `Congratulations! You earned the ${badge.name} badge!`
        });

        // Award karma bonus based on rarity
        const karmaBonus = badge.rarity * 10;
        await this.awardKarmaBonus(userId, karmaBonus);

        earnedBadges.push({
          badgeId: badge._id.toString(),
          name: badge.name,
          earned: true,
          earnedAt: new Date()
        });

        logger.info(`Badge awarded: ${badge.name} to user ${userId}`);
      }
    }

    return earnedBadges;
  }

  /**
   * FIX: Added cross-merchant badge validation.
   * Validates that a badge can be earned based on merchant participation rules.
   */
  async validateCrossMerchantBadge(
    userId: string,
    badgeId: string,
    merchantId: string
  ): Promise<{ valid: boolean; reason?: string }> {
    const badge = await Badge.findById(badgeId);
    if (!badge) {
      return { valid: false, reason: 'Badge not found' };
    }

    // Check if this is a cross-merchant badge
    const rules = CROSS_MERCHANT_BADGE_RULES[badge.badgeKey];
    if (!rules) {
      // Not a cross-merchant badge, no validation needed
      return { valid: true };
    }

    // Get user's merchant participation (from EarnRecord or other source)
    const userMerchants = await this.getUserMerchantParticipation(userId);

    // Check max merchants constraint
    if (rules.maxMerchants && userMerchants.length >= rules.maxMerchants) {
      // New merchant would exceed limit
      return {
        valid: false,
        reason: `This badge requires participation from up to ${rules.maxMerchants} merchants. You have already reached this limit.`
      };
    }

    // Check requireAnyMerchant constraint
    if (rules.requireAnyMerchant) {
      const hasRequired = rules.requireAnyMerchant.some(m => userMerchants.includes(m));
      if (!hasRequired) {
        return {
          valid: false,
          reason: 'You must participate with specific merchants to earn this badge'
        };
      }
    }

    // Check requireAllMerchants constraint
    if (rules.requireAllMerchants) {
      const hasAll = rules.requireAllMerchants.every(m => userMerchants.includes(m));
      if (!hasAll) {
        return {
          valid: false,
          reason: 'You must participate with all required merchants to earn this badge'
        };
      }
    }

    return { valid: true };
  }

  private async getUserMerchantParticipation(userId: string): Promise<string[]> {
    // This would integrate with EarnRecord or a merchant participation tracking service
    // For now, return empty array as placeholder
    // TODO: Implement actual merchant participation tracking
    return [];
  }

  private async checkBadgeCriteria(
    userId: string,
    badge: any,
    event: string,
    data: any
  ): Promise<boolean> {
    const KarmaProfile = badge.model('KarmaProfile');
    const KarmaMission = badge.model('KarmaMission');

    switch (badge.criteria.type) {
      case 'missions_complete': {
        const count = await KarmaMission.countDocuments({
          userId: new Types.ObjectId(userId),
          status: 'completed'
        });
        return count >= (badge.criteria.count || 1);
      }

      case 'karma_earned': {
        const profile = await KarmaProfile.findOne({ userId: new Types.ObjectId(userId) });
        return (profile?.totalKarma || 0) >= (badge.criteria.karmaRequired || 100);
      }

      case 'streak_days': {
        const profile = await KarmaProfile.findOne({ userId: new Types.ObjectId(userId) });
        return (profile?.streak?.currentStreak || 0) >= (badge.criteria.count || 7);
      }

      case 'social_share': {
        // Would need social share tracking
        return false;
      }

      default:
        return false;
    }
  }

  private async awardKarmaBonus(userId: string, karma: number) {
    const KarmaProfile = require('./models/KarmaProfile').KarmaProfile;
    await KarmaProfile.findOneAndUpdate(
      { userId: new Types.ObjectId(userId) },
      { $inc: { currentKarma: karma } }
    );
  }

  private async ensureBadgesSeeded() {
    const count = await Badge.countDocuments();
    if (count === 0) {
      await seedBadges();
    }
  }

  async getUserBadges(userId: string) {
    const earned = await EarnedBadge.find({ userId: new Types.ObjectId(userId) })
      .populate('badgeId');

    const allBadges = await Badge.find({ isActive: true });
    const earnedIds = earned.map(e => e.badgeId.toString());

    return {
      earned: earned.map(e => ({
        id: e.badgeId,
        name: (e.badgeId as any).name,
        icon: (e.badgeId as any).icon,
        earnedAt: e.earnedAt
      })),
      available: allBadges
        .filter(b => !earnedIds.includes(b._id.toString()))
        .map(b => ({
          id: b._id,
          name: b.name,
          description: b.description,
          icon: b.icon,
          rarity: b.rarity
        }))
    };
  }
}

export const badgeService = new BadgeService();
