import mongoose from 'mongoose';
import { IAudienceFilter } from '../models/MarketingCampaign';
import { UserInterestProfile } from '../models/UserInterestProfile';
import { logger } from '../config/logger';

/**
 * AudienceBuilder — translates IAudienceFilter into MongoDB queries
 * and returns arrays of { userId, phone, email, pushTokens } for dispatch.
 *
 * Data sources:
 *   - MerchantCustomerSnapshot (same DB as rez-backend) — base merchant audience
 *   - UserInterestProfile (this service's DB) — interest + location + institution
 *   - User (same DB as rez-backend) — birthday, profile data
 *   - Order (same DB as rez-backend) — purchase history targeting
 *
 * All queries are batched and paginated — never loads full audience into memory.
 */

// Shared models (read from rez-backend's MongoDB)
const Snapshot = mongoose.model(
  'MerchantCustomerSnapshot',
  new mongoose.Schema({}, { strict: false, collection: 'merchantcustomersnapshots' }),
);

const User = mongoose.model(
  'User',
  new mongoose.Schema({}, { strict: false, collection: 'users' }),
);

const Order = mongoose.model(
  'Order',
  new mongoose.Schema({}, { strict: false, collection: 'orders' }),
);

export interface AudienceRecord {
  userId: string;
  phone?: string;
  email?: string;
  firstName?: string;
  pushTokens?: string[];
  hasAppInstalled?: boolean;
  smsOptIn?: boolean;
  pushOptIn?: boolean;
  emailOptIn?: boolean;
  whatsappOptIn?: boolean;
}

const BATCH_SIZE = 200;

export class AudienceBuilder {
  /**
   * Estimate audience size without loading full data.
   * Used by the UI to show "~1,200 customers will receive this" before launch.
   * Uses a count query rather than loading IDs into memory.
   */
  async estimate(merchantId: string, filter: IAudienceFilter): Promise<number> {
    // BE-MKT-004 FIX: Validate segment exists before estimation
    const validSegments = ['all', 'recent', 'lapsed', 'high_value', 'stamp_card', 'location', 'interest', 'birthday', 'purchase_history', 'institution', 'keyword', 'custom'];
    if (!validSegments.includes(filter.segment)) {
      throw new Error(`Invalid audience segment: '${filter.segment}'. Valid segments are: ${validSegments.join(', ')}`);
    }

    const count = await this.countUserIds(merchantId, filter);
    return count;
  }

  /**
   * Resolve full audience as paginated batches using a cursor-based approach.
   * Streams user IDs in batches from MongoDB — never loads the full set into memory.
   */
  async *buildAudience(
    merchantId: string,
    filter: IAudienceFilter,
    channel: string,
  ): AsyncGenerator<AudienceRecord[]> {
    const optInField = channelOptInField(channel);

    for await (const idBatch of this.resolveUserIdsBatched(merchantId, filter)) {
      if (idBatch.length === 0) continue;

      const batchIds = idBatch.map((id) => new mongoose.Types.ObjectId(id));

      const records = await Snapshot.find({
        merchantId: new mongoose.Types.ObjectId(merchantId),
        userId: { $in: batchIds },
        [optInField]: true,
      })
        .select('userId phone email pushTokens hasAppInstalled smsOptIn pushOptIn emailOptIn whatsappOptIn')
        .lean<AudienceRecord[]>();

      if (records.length === 0) continue;

      // For push channel: enrich push tokens directly from User model.
      // The consumer app registers Expo push tokens to User.pushTokens (array of
      // {token, platform, lastUsed}), not to the Snapshot. This ensures we always
      // have the latest tokens even if the Snapshot was built before the user installed the app.
      let enrichedRecords: AudienceRecord[] = records.map((r: any) => ({
        userId: r.userId.toString(),
        phone: r.phone,
        email: r.email,
        firstName: undefined,
        pushTokens: r.pushTokens ?? [],
        hasAppInstalled: r.hasAppInstalled,
        smsOptIn: r.smsOptIn,
        pushOptIn: r.pushOptIn,
        emailOptIn: r.emailOptIn,
        whatsappOptIn: r.whatsappOptIn,
      }));

      if (channel === 'push') {
        // Fetch live push tokens and firstName from User model for this batch
        const userDocs = await User.find({ _id: { $in: batchIds } })
          .select('_id pushTokens profile.name firstName')
          .lean<{ _id: mongoose.Types.ObjectId; pushTokens?: Array<{ token: string } | string>; profile?: { name?: string }; firstName?: string }[]>();

        const tokenMap = new Map<string, string[]>();
        const nameMap = new Map<string, string>();
        for (const u of userDocs) {
          const tokens = (u.pushTokens ?? []).map((t: any) => (typeof t === 'string' ? t : t.token)).filter(Boolean);
          tokenMap.set(u._id.toString(), tokens);
          const firstName = u.profile?.name
            ? (u.profile.name as string).trim().split(/\s+/)[0] || undefined
            : u.firstName || undefined;
          if (firstName) nameMap.set(u._id.toString(), firstName);
        }

        enrichedRecords = enrichedRecords.map((r) => ({
          ...r,
          pushTokens: tokenMap.get(r.userId) ?? r.pushTokens,
          hasAppInstalled: (tokenMap.get(r.userId)?.length ?? 0) > 0 || r.hasAppInstalled,
          firstName: nameMap.get(r.userId) ?? r.firstName,
        }));

        // BE-MKT-005 FIX: Filter out records with empty tokens and log warning if high percentage lacks tokens
        const recordsWithTokens = enrichedRecords.filter((r) => r.pushTokens && r.pushTokens.length > 0);
        const recordsWithoutTokens = enrichedRecords.length - recordsWithTokens.length;
        if (enrichedRecords.length > 0) {
          const emptyTokenPercentage = (recordsWithoutTokens / enrichedRecords.length) * 100;
          if (emptyTokenPercentage > 5) {
            logger.warn(
              `[AudienceBuilder] High percentage of push records lack tokens`,
              {
                percentage: emptyTokenPercentage.toFixed(1),
                recordsWithoutTokens,
                totalRecords: enrichedRecords.length,
              },
            );
          }
        }
        enrichedRecords = recordsWithTokens;
      }

      yield enrichedRecords;
    }
  }

  // ── Private: resolve matching userIds across all targeting modes ─────────

  /**
   * Count distinct user IDs matching the filter without loading into memory.
   */
  private async countUserIds(merchantId: string, filter: IAudienceFilter): Promise<number> {
    switch (filter.segment) {
      case 'all':
      case 'recent':
      case 'lapsed':
      case 'high_value':
      case 'stamp_card':
        return this.countSnapshotSegment(merchantId, filter.segment);

      case 'location':
        return this.countLocation(merchantId, filter);

      case 'interest':
        return this.countInterest(merchantId, filter);

      case 'birthday':
        return this.countBirthday(merchantId, filter);

      case 'purchase_history':
        return this.countPurchaseHistory(merchantId, filter);

      case 'institution':
        return this.countInstitution(merchantId, filter);

      case 'keyword':
        return this.countKeyword(merchantId, filter);

      case 'custom':
        return this.countCustom(merchantId, filter);

      default:
        return 0;
    }
  }

  /**
   * Stream user IDs in batches using MongoDB cursor pagination.
   * Yields arrays of up to BATCH_SIZE ObjectIds at a time — O(1) memory.
   */
  private async *resolveUserIdsBatched(
    merchantId: string,
    filter: IAudienceFilter,
  ): AsyncGenerator<mongoose.Types.ObjectId[]> {
    switch (filter.segment) {
      case 'all':
      case 'recent':
      case 'lapsed':
      case 'high_value':
      case 'stamp_card':
        yield* this.resolveSnapshotSegmentBatched(merchantId, filter.segment);
        return;

      case 'location':
        yield* this.resolveLocationBatched(merchantId, filter);
        return;

      case 'interest':
        yield* this.resolveInterestBatched(merchantId, filter);
        return;

      case 'birthday':
        yield* this.resolveBirthdayBatched(merchantId, filter);
        return;

      case 'purchase_history':
        yield* this.resolvePurchaseHistoryBatched(merchantId, filter);
        return;

      case 'institution':
        yield* this.resolveInstitutionBatched(merchantId, filter);
        return;

      case 'keyword':
        yield* this.resolveKeywordBatched(merchantId, filter);
        return;

      case 'custom':
        yield* this.resolveCustomBatched(merchantId, filter);
        return;

      default:
        return;
    }
  }

  private async resolveUserIds(
    merchantId: string,
    filter: IAudienceFilter,
  ): Promise<Set<string>> {
    switch (filter.segment) {
      case 'all':
      case 'recent':
      case 'lapsed':
      case 'high_value':
      case 'stamp_card':
        return this.resolveSnapshotSegment(merchantId, filter.segment);

      case 'location':
        return this.resolveLocation(merchantId, filter);

      case 'interest':
        return this.resolveInterest(merchantId, filter);

      case 'birthday':
        return this.resolveBirthday(merchantId, filter);

      case 'purchase_history':
        return this.resolvePurchaseHistory(merchantId, filter);

      case 'institution':
        return this.resolveInstitution(merchantId, filter);

      case 'keyword':
        return this.resolveKeyword(merchantId, filter);

      case 'custom':
        return this.resolveCustom(merchantId, filter);

      default:
        return new Set();
    }
  }

  // ── Standard snapshot-based segments ─────────────────────────────────────

  private async countSnapshotSegment(merchantId: string, segment: string): Promise<number> {
    const flagMap: Record<string, Record<string, boolean>> = {
      recent: { isRecent: true },
      lapsed: { isLapsed: true },
      high_value: { isHighValue: true },
      stamp_card: { hasActiveStampCard: true },
      all: {},
    };
    const dateFilter = this.buildSegmentDateFilter(segment);
    return Snapshot.countDocuments({
      merchantId: new mongoose.Types.ObjectId(merchantId),
      ...flagMap[segment],
      ...dateFilter,
    });
  }

  private async *resolveSnapshotSegmentBatched(
    merchantId: string,
    segment: string,
  ): AsyncGenerator<mongoose.Types.ObjectId[]> {
    const flagMap: Record<string, Record<string, boolean>> = {
      recent: { isRecent: true },
      lapsed: { isLapsed: true },
      high_value: { isHighValue: true },
      stamp_card: { hasActiveStampCard: true },
      all: {},
    };
    const dateFilter = this.buildSegmentDateFilter(segment);
    const query = { merchantId: new mongoose.Types.ObjectId(merchantId), ...flagMap[segment], ...dateFilter };
    const cursor = Snapshot.collection.find(query, { projection: { _id: 1 } }).batchSize(BATCH_SIZE);
    for await (const doc of cursor) {
      yield [doc._id];
    }
  }

  private async resolveSnapshotSegment(
    merchantId: string,
    segment: string,
  ): Promise<Set<string>> {
    const flagMap: Record<string, Record<string, boolean>> = {
      recent: { isRecent: true },
      lapsed: { isLapsed: true },
      high_value: { isHighValue: true },
      stamp_card: { hasActiveStampCard: true },
      all: {},
    };
    const dateFilter = this.buildSegmentDateFilter(segment);
    const docs = await Snapshot.find({
      merchantId: new mongoose.Types.ObjectId(merchantId),
      ...flagMap[segment],
      ...dateFilter,
    })
      .select('userId')
      .lean<{ userId: mongoose.Types.ObjectId }[]>();

    return new Set(docs.map((d) => d.userId.toString()));
  }

  /**
   * MRS-H7: Apply a date filter to the 'all' segment so that only customers
   * with recent activity (updated within 90 days) are included. This prevents
   * campaigns from broadcasting to lapsed/inactive users who should not receive
   * notifications. Other segments already have their own implicit date semantics.
   */
  private buildSegmentDateFilter(segment: string): Record<string, unknown> {
    if (segment !== 'all') return {};
    const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000); // 90 days
    return { updatedAt: { $gte: cutoff } };
  }

  // ── Location targeting ────────────────────────────────────────────────────
  // Strategy: find users whose primaryLocation matches, then intersect with merchant's customer base

  private async countLocation(merchantId: string, filter: IAudienceFilter): Promise<number> {
    const { location } = filter;
    if (!location) return 0;
    const candidates = await this.getLocationUserIds(location);
    return this.countIntersectWithMerchantCustomers(merchantId, candidates);
  }

  private async *resolveLocationBatched(
    merchantId: string,
    filter: IAudienceFilter,
  ): AsyncGenerator<mongoose.Types.ObjectId[]> {
    const { location } = filter;
    if (!location) return;
    const candidates = await this.getLocationUserIds(location);
    yield* this.intersectMerchantCustomersBatched(merchantId, candidates);
  }

  private async resolveLocation(
    merchantId: string,
    filter: IAudienceFilter,
  ): Promise<Set<string>> {
    const { location } = filter;
    if (!location) return new Set();

    const locationQuery: Record<string, unknown> = {};
    if (location.city) locationQuery['primaryLocation.city'] = new RegExp(location.city, 'i');
    if (location.area) locationQuery['primaryLocation.area'] = new RegExp(location.area, 'i');
    if (location.pincode) locationQuery['primaryLocation.pincode'] = location.pincode;

    if (location.coordinates && location.radiusKm) {
      locationQuery['primaryLocation.coordinates'] = {
        $geoWithin: {
          $centerSphere: [location.coordinates, location.radiusKm / 6371],
        },
      };
    }

    const profiles = await UserInterestProfile.find(locationQuery)
      .select('userId')
      .lean<{ userId: mongoose.Types.ObjectId }[]>();

    const locationUserIds = new Set(profiles.map((p) => p.userId.toString()));

    // Intersect with merchant's existing customer base
    return this.intersectWithMerchantCustomers(merchantId, locationUserIds);
  }

  private async getLocationUserIds(location: NonNullable<IAudienceFilter['location']>): Promise<Set<string>> {
    const locationQuery: Record<string, unknown> = {};
    if (location.city) locationQuery['primaryLocation.city'] = new RegExp(location.city, 'i');
    if (location.area) locationQuery['primaryLocation.area'] = new RegExp(location.area, 'i');
    if (location.pincode) locationQuery['primaryLocation.pincode'] = location.pincode;
    if (location.coordinates && location.radiusKm) {
      locationQuery['primaryLocation.coordinates'] = {
        $geoWithin: { $centerSphere: [location.coordinates, location.radiusKm / 6371] },
      };
    }
    const profiles = await UserInterestProfile.find(locationQuery as any)
      .select('userId')
      .lean<{ userId: mongoose.Types.ObjectId }[]>();
    return new Set(profiles.map((p) => p.userId.toString()));
  }

  // ── Interest targeting ────────────────────────────────────────────────────
  // Finds users whose interest tags match, then intersects with merchant customers

  private async countInterest(merchantId: string, filter: IAudienceFilter): Promise<number> {
    const { interests } = filter;
    if (!interests?.length) return 0;
    const candidates = await this.getInterestUserIds(interests);
    return this.countIntersectWithMerchantCustomers(merchantId, candidates);
  }

  private async *resolveInterestBatched(
    merchantId: string,
    filter: IAudienceFilter,
  ): AsyncGenerator<mongoose.Types.ObjectId[]> {
    const { interests } = filter;
    if (!interests?.length) return;
    const candidates = await this.getInterestUserIds(interests);
    yield* this.intersectMerchantCustomersBatched(merchantId, candidates);
  }

  private async resolveInterest(
    merchantId: string,
    filter: IAudienceFilter,
  ): Promise<Set<string>> {
    const { interests } = filter;
    if (!interests?.length) return new Set();

    const profiles = await UserInterestProfile.find({
      'interests.tag': { $in: interests },
      'interests.score': { $gte: 20 }, // minimum signal strength
    })
      .select('userId')
      .lean<{ userId: mongoose.Types.ObjectId }[]>();

    const interestUserIds = new Set(profiles.map((p) => p.userId.toString()));
    return this.intersectWithMerchantCustomers(merchantId, interestUserIds);
  }

  private async getInterestUserIds(interests: string[]): Promise<Set<string>> {
    const profiles = await UserInterestProfile.find({
      'interests.tag': { $in: interests },
      'interests.score': { $gte: 20 },
    })
      .select('userId')
      .lean<{ userId: mongoose.Types.ObjectId }[]>();
    return new Set(profiles.map((p) => p.userId.toString()));
  }

  // ── Birthday targeting ────────────────────────────────────────────────────
  // Finds users whose birthday is N days from today, in merchant's customer base

  private async countBirthday(merchantId: string, filter: IAudienceFilter): Promise<number> {
    const candidates = await this.getBirthdayUserIds(filter.birthday?.daysAhead ?? 0);
    return this.countIntersectWithMerchantCustomers(merchantId, candidates);
  }

  private async *resolveBirthdayBatched(
    merchantId: string,
    filter: IAudienceFilter,
  ): AsyncGenerator<mongoose.Types.ObjectId[]> {
    const candidates = await this.getBirthdayUserIds(filter.birthday?.daysAhead ?? 0);
    yield* this.intersectMerchantCustomersBatched(merchantId, candidates);
  }

  private async resolveBirthday(
    merchantId: string,
    filter: IAudienceFilter,
  ): Promise<Set<string>> {
    const daysAhead = filter.birthday?.daysAhead ?? 0;
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + daysAhead);

    const month = targetDate.getMonth() + 1; // 1-12
    const day = targetDate.getDate();

    // MongoDB: match users where month(dob) = month AND day(dob) = day
    const users = await User.find({
      $expr: {
        $and: [
          { $eq: [{ $month: '$profile.dateOfBirth' }, month] },
          { $eq: [{ $dayOfMonth: '$profile.dateOfBirth' }, day] },
        ],
      },
    })
      .select('_id')
      .lean<{ _id: mongoose.Types.ObjectId }[]>();

    const birthdayUserIds = new Set(users.map((u) => u._id.toString()));
    return this.intersectWithMerchantCustomers(merchantId, birthdayUserIds);
  }

  private async getBirthdayUserIds(daysAhead: number): Promise<Set<string>> {
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + daysAhead);
    const month = targetDate.getMonth() + 1;
    const day = targetDate.getDate();
    const users = await User.find({
      $expr: {
        $and: [
          { $eq: [{ $month: '$profile.dateOfBirth' }, month] },
          { $eq: [{ $dayOfMonth: '$profile.dateOfBirth' }, day] },
        ],
      },
    })
      .select('_id')
      .lean<{ _id: mongoose.Types.ObjectId }[]>();
    return new Set(users.map((u) => u._id.toString()));
  }

  // ── Purchase history targeting ────────────────────────────────────────────
  // Finds users who bought a specific product/category in the last N days

  private async countPurchaseHistory(merchantId: string, filter: IAudienceFilter): Promise<number> {
    const ph = filter.purchaseHistory;
    if (!ph) return 0;
    const candidates = await this.getPurchaseHistoryUserIds(merchantId, ph);
    return this.countIntersectWithMerchantCustomers(merchantId, candidates);
  }

  private async *resolvePurchaseHistoryBatched(
    merchantId: string,
    filter: IAudienceFilter,
  ): AsyncGenerator<mongoose.Types.ObjectId[]> {
    const ph = filter.purchaseHistory;
    if (!ph) return;
    const candidates = await this.getPurchaseHistoryUserIds(merchantId, ph);
    yield* this.intersectMerchantCustomersBatched(merchantId, candidates);
  }

  private async resolvePurchaseHistory(
    merchantId: string,
    filter: IAudienceFilter,
  ): Promise<Set<string>> {
    const ph = filter.purchaseHistory;
    if (!ph) return new Set();

    const since = new Date();
    since.setDate(since.getDate() - ph.withinDays);

    const orderQuery: Record<string, unknown> = {
      merchantId: new mongoose.Types.ObjectId(merchantId),
      createdAt: { $gte: since },
      status: { $nin: ['cancelled', 'refunded'] },
    };

    // Category or keyword match on order items
    if (ph.categoryIds?.length) {
      orderQuery['items.categoryId'] = { $in: ph.categoryIds };
    }
    if (ph.productKeywords?.length) {
      orderQuery['items.name'] = {
        $in: ph.productKeywords.map((kw) => new RegExp(kw, 'i')),
      };
    }

    const pipeline: mongoose.PipelineStage[] = [
      { $match: orderQuery },
      { $group: { _id: '$userId', orderCount: { $sum: 1 } } },
    ];

    if (ph.minOrderCount && ph.minOrderCount > 1) {
      pipeline.push({ $match: { orderCount: { $gte: ph.minOrderCount } } });
    }

    const results = await Order.aggregate<{ _id: mongoose.Types.ObjectId }>(pipeline);
    return new Set(results.map((r) => r._id.toString()));
  }

  private async getPurchaseHistoryUserIds(
    merchantId: string,
    ph: NonNullable<IAudienceFilter['purchaseHistory']>,
  ): Promise<Set<string>> {
    const since = new Date();
    since.setDate(since.getDate() - ph.withinDays);
    const orderQuery: Record<string, unknown> = {
      merchantId: new mongoose.Types.ObjectId(merchantId),
      createdAt: { $gte: since },
      status: { $nin: ['cancelled', 'refunded'] },
    };
    if (ph.categoryIds?.length) orderQuery['items.categoryId'] = { $in: ph.categoryIds };
    if (ph.productKeywords?.length) {
      orderQuery['items.name'] = { $in: ph.productKeywords.map((kw) => new RegExp(kw, 'i')) };
    }
    const pipeline: mongoose.PipelineStage[] = [
      { $match: orderQuery },
      { $group: { _id: '$userId', orderCount: { $sum: 1 } } },
    ];
    if (ph.minOrderCount && ph.minOrderCount > 1) pipeline.push({ $match: { orderCount: { $gte: ph.minOrderCount } } });
    const results = await Order.aggregate<{ _id: mongoose.Types.ObjectId }>(pipeline);
    return new Set(results.map((r) => r._id.toString()));
  }

  // ── Institution targeting ─────────────────────────────────────────────────

  private async countInstitution(merchantId: string, filter: IAudienceFilter): Promise<number> {
    const { institution } = filter;
    if (!institution) return 0;
    const candidates = await this.getInstitutionUserIds(institution);
    return this.countIntersectWithMerchantCustomers(merchantId, candidates);
  }

  private async *resolveInstitutionBatched(
    merchantId: string,
    filter: IAudienceFilter,
  ): AsyncGenerator<mongoose.Types.ObjectId[]> {
    const { institution } = filter;
    if (!institution) return;
    const candidates = await this.getInstitutionUserIds(institution);
    yield* this.intersectMerchantCustomersBatched(merchantId, candidates);
  }

  private async resolveInstitution(
    merchantId: string,
    filter: IAudienceFilter,
  ): Promise<Set<string>> {
    const { institution } = filter;
    if (!institution) return new Set();

    const query: Record<string, unknown> = {};
    if (institution.name) query['institution.name'] = new RegExp(institution.name, 'i');
    if (institution.type) query['institution.type'] = institution.type;
    if (institution.area) query['institution.area'] = new RegExp(institution.area, 'i');

    const profiles = await UserInterestProfile.find(query)
      .select('userId')
      .lean<{ userId: mongoose.Types.ObjectId }[]>();

    const institutionUserIds = new Set(profiles.map((p) => p.userId.toString()));
    return this.intersectWithMerchantCustomers(merchantId, institutionUserIds);
  }

  private async getInstitutionUserIds(
    institution: NonNullable<IAudienceFilter['institution']>,
  ): Promise<Set<string>> {
    const query: Record<string, unknown> = {};
    if (institution.name) query['institution.name'] = new RegExp(institution.name, 'i');
    if (institution.type) query['institution.type'] = institution.type;
    if (institution.area) query['institution.area'] = new RegExp(institution.area, 'i');
    const profiles = await UserInterestProfile.find(query as any)
      .select('userId')
      .lean<{ userId: mongoose.Types.ObjectId }[]>();
    return new Set(profiles.map((p) => p.userId.toString()));
  }

  // ── Keyword targeting ─────────────────────────────────────────────────────
  // Users who recently searched these terms in the REZ consumer app

  private async countKeyword(merchantId: string, filter: IAudienceFilter): Promise<number> {
    const kw = filter.keyword;
    if (!kw?.terms?.length) return 0;
    const candidates = await this.getKeywordUserIds(kw);
    return this.countIntersectWithMerchantCustomers(merchantId, candidates);
  }

  private async *resolveKeywordBatched(
    merchantId: string,
    filter: IAudienceFilter,
  ): AsyncGenerator<mongoose.Types.ObjectId[]> {
    const kw = filter.keyword;
    if (!kw?.terms?.length) return;
    const candidates = await this.getKeywordUserIds(kw);
    yield* this.intersectMerchantCustomersBatched(merchantId, candidates);
  }

  private async resolveKeyword(
    merchantId: string,
    filter: IAudienceFilter,
  ): Promise<Set<string>> {
    const kw = filter.keyword;
    if (!kw?.terms?.length) return new Set();

    const since = new Date();
    since.setDate(since.getDate() - (kw.withinDays ?? 30));

    const profiles = await UserInterestProfile.find({
      recentSearches: {
        $elemMatch: {
          term: { $in: kw.terms.map((t) => new RegExp(t, 'i')) },
          searchedAt: { $gte: since },
        },
      },
    })
      .select('userId')
      .lean<{ userId: mongoose.Types.ObjectId }[]>();

    const keywordUserIds = new Set(profiles.map((p) => p.userId.toString()));
    return this.intersectWithMerchantCustomers(merchantId, keywordUserIds);
  }

  private async getKeywordUserIds(kw: NonNullable<IAudienceFilter['keyword']>): Promise<Set<string>> {
    const since = new Date();
    since.setDate(since.getDate() - (kw.withinDays ?? 30));
    const profiles = await UserInterestProfile.find({
      recentSearches: {
        $elemMatch: {
          term: { $in: kw.terms.map((t) => new RegExp(t, 'i')) },
          searchedAt: { $gte: since },
        },
      },
    })
      .select('userId')
      .lean<{ userId: mongoose.Types.ObjectId }[]>();
    return new Set(profiles.map((p) => p.userId.toString()));
  }

  // ── Custom filter ─────────────────────────────────────────────────────────

  private async countCustom(merchantId: string, filter: IAudienceFilter): Promise<number> {
    if (!filter.customFilter) return 0;
    const candidates = await this.getCustomUserIds(filter);
    return this.countIntersectWithMerchantCustomers(merchantId, candidates);
  }

  private async *resolveCustomBatched(
    merchantId: string,
    filter: IAudienceFilter,
  ): AsyncGenerator<mongoose.Types.ObjectId[]> {
    if (!filter.customFilter) return;
    const candidates = await this.getCustomUserIds(filter);
    yield* this.intersectMerchantCustomersBatched(merchantId, candidates);
  }

  private async resolveCustom(
    merchantId: string,
    filter: IAudienceFilter,
  ): Promise<Set<string>> {
    if (!filter.customFilter) return new Set();

    // Sanitise: strip any MongoDB operator keys (keys starting with '$') from the
    // caller-supplied filter to prevent NoSQL injection / server-side JS execution.
    const safeFilter = this.sanitizeMongoFilter(filter.customFilter as Record<string, unknown>);

    const users = await User.find(safeFilter)
      .select('_id')
      .lean<{ _id: mongoose.Types.ObjectId }[]>();

    const customUserIds = new Set(users.map((u) => u._id.toString()));
    return this.intersectWithMerchantCustomers(merchantId, customUserIds);
  }

  private async getCustomUserIds(filter: IAudienceFilter): Promise<Set<string>> {
    const safeFilter = this.sanitizeMongoFilter(filter.customFilter as Record<string, unknown>);
    const users = await User.find(safeFilter)
      .select('_id')
      .lean<{ _id: mongoose.Types.ObjectId }[]>();
    return new Set(users.map((u) => u._id.toString()));
  }

  /** Recursively removes any key that begins with '$' at any nesting depth to prevent operator injection. */
  private sanitizeMongoFilter(obj: Record<string, unknown>): Record<string, unknown> {
    const safe: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(obj)) {
      if (key.startsWith('$')) continue;
      if (val !== null && typeof val === 'object' && !Array.isArray(val)) {
        safe[key] = this.sanitizeMongoFilter(val as Record<string, unknown>);
      } else {
        safe[key] = val;
      }
    }
    return safe;
  }

  // ── Intersection helper ───────────────────────────────────────────────────
  // Ensures we only target users who are known customers of this merchant

  private async intersectWithMerchantCustomers(
    merchantId: string,
    userIds: Set<string>,
  ): Promise<Set<string>> {
    if (userIds.size === 0) return new Set();

    // MRS-H5: Throw for invalid merchantId so callers get a clear error instead of
    // silently returning empty results when a non-existent merchantId is targeted.
    if (!mongoose.Types.ObjectId.isValid(merchantId)) {
      throw new Error(`Invalid merchantId for audience build: ${merchantId}`);
    }

    const objectIds = Array.from(userIds).map((id) => new mongoose.Types.ObjectId(id));

    const docs = await Snapshot.find({
      merchantId: new mongoose.Types.ObjectId(merchantId),
      userId: { $in: objectIds },
    })
      .select('userId')
      .lean<{ userId: mongoose.Types.ObjectId }[]>();

    return new Set(docs.map((d) => d.userId.toString()));
  }

  /**
   * Batched intersection — streams matching userIds from the merchant snapshot
   * using a MongoDB cursor with O(BATCH_SIZE) memory overhead per batch (MRS-H6).
   */
  private async *intersectMerchantCustomersBatched(
    merchantId: string,
    candidateIds: Set<string>,
  ): AsyncGenerator<mongoose.Types.ObjectId[]> {
    if (candidateIds.size === 0) return;

    if (!mongoose.Types.ObjectId.isValid(merchantId)) {
      throw new Error(`Invalid merchantId for audience build: ${merchantId}`);
    }

    const candidateList = Array.from(candidateIds).map((id) => new mongoose.Types.ObjectId(id));
    const cursor = Snapshot.collection.find(
      { merchantId: new mongoose.Types.ObjectId(merchantId), userId: { $in: candidateList } },
      { projection: { _id: 1 } },
    ).batchSize(BATCH_SIZE);

    for await (const doc of cursor) {
      yield [doc._id];
    }
  }

  private async countIntersectWithMerchantCustomers(
    merchantId: string,
    candidateIds: Set<string>,
  ): Promise<number> {
    if (candidateIds.size === 0) return 0;

    if (!mongoose.Types.ObjectId.isValid(merchantId)) {
      throw new Error(`Invalid merchantId for audience build: ${merchantId}`);
    }

    const objectIds = Array.from(candidateIds).map((id) => new mongoose.Types.ObjectId(id));
    return Snapshot.countDocuments({
      merchantId: new mongoose.Types.ObjectId(merchantId),
      userId: { $in: objectIds },
    });
  }
}

function channelOptInField(channel: string): string {
  switch (channel) {
    case 'sms': return 'smsOptIn';
    case 'push': return 'pushOptIn';
    case 'email': return 'emailOptIn';
    case 'whatsapp': return 'whatsappOptIn';
    default: return 'hasAppInstalled';
  }
}

export const audienceBuilder = new AudienceBuilder();
export default audienceBuilder;
