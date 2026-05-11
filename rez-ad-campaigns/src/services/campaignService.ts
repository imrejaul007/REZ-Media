// @ts-nocheck
import AdCampaign from '../models/AdCampaign';
import { getRedis } from '../config/redis';
import { logger } from '../config/logger';

const CAMPAIGN_CACHE_TTL = 300; // 5 minutes
const CAMPAIGN_CACHE_PREFIX = 'campaign:';

/**
 * Get campaign by ID with cache-aside pattern.
 * First checks Redis cache, falls back to MongoDB on cache miss.
 */
export async function getCampaignById(
  campaignId: string,
  options: { populate?: string[] } = {}
): Promise<any | null> {
  const redis = getRedis();
  const cacheKey = `${CAMPAIGN_CACHE_PREFIX}${campaignId}`;

  try {
    // Try cache first
    const cached = await redis.get(cacheKey);
    if (cached) {
      const campaign = JSON.parse(cached);

      // Apply dynamic population if requested
      if (options.populate?.length) {
        const populated = await AdCampaign.findById(campaignId)
          .select('-__v')
          .populate(options.populate.join(' '));
        return populated;
      }

      return campaign;
    }
  } catch (err) {
    logger.warn(`[CampaignCache] Redis get error: ${err?.message}. Falling back to DB.`);
  }

  // Cache miss - fetch from DB
  let query = AdCampaign.findById(campaignId).select('-__v');

  if (options.populate?.length) {
    query = query.populate(options.populate.join(' '));
  }

  const campaign = await query;

  if (campaign) {
    // Store in cache (only cache the raw document, not populated)
    try {
      const cacheData = campaign.toObject ? campaign.toObject() : campaign;
      await redis.setex(cacheKey, CAMPAIGN_CACHE_TTL, JSON.stringify(cacheData));
    } catch (err) {
      logger.warn(`[CampaignCache] Redis set error: ${err?.message}. Skipping cache.`);
    }
  }

  return campaign;
}

/**
 * Get multiple campaigns by IDs with caching.
 */
export async function getCampaignsByIds(
  campaignIds: string[],
  options: { populate?: string[] } = {}
): Promise<any[]> {
  if (!campaignIds.length) return [];

  const redis = getRedis();
  const campaigns: Map<string, any> = new Map();
  const missingIds: string[] = [];

  // Check cache for each ID
  try {
    const pipeline = redis.pipeline();
    for (const id of campaignIds) {
      pipeline.get(`${CAMPAIGN_CACHE_PREFIX}${id}`);
    }
    const results = await pipeline.exec();

    for (let i = 0; i < campaignIds.length; i++) {
      const [err, cached] = results[i] as [Error | null, string | null];
      if (!err && cached) {
        campaigns.set(campaignIds[i], JSON.parse(cached));
      } else {
        missingIds.push(campaignIds[i]);
      }
    }
  } catch (err) {
    logger.warn(`[CampaignCache] Redis pipeline error: ${err?.message}. Fetching all from DB.`);
    missingIds.push(...campaignIds);
  }

  // Fetch missing from DB
  if (missingIds.length > 0) {
    try {
      let query = AdCampaign.find({ _id: { $in: missingIds } }).select('-__v');

      if (options.populate?.length) {
        query = query.populate(options.populate.join(' '));
      }

      const dbCampaigns = await query;

      // Cache the fetched campaigns
      try {
        const pipeline = redis.pipeline();
        for (const campaign of dbCampaigns) {
          const cacheData = campaign.toObject ? campaign.toObject() : campaign;
          const key = `${CAMPAIGN_CACHE_PREFIX}${campaign._id}`;
          pipeline.setex(key, CAMPAIGN_CACHE_TTL, JSON.stringify(cacheData));
        }
        await pipeline.exec();
      } catch (cacheErr) {
        logger.warn(`[CampaignCache] Redis set error: ${cacheErr?.message}. Skipping cache.`);
      }

      for (const campaign of dbCampaigns) {
        campaigns.set(campaign._id.toString(), campaign.toObject ? campaign.toObject() : campaign);
      }
    } catch (err) {
      logger.error(`[CampaignCache] DB query error: ${err?.message}`);
    }
  }

  // Return in original order
  return campaignIds.map(id => campaigns.get(id)).filter(Boolean);
}

/**
 * Invalidate campaign cache after updates.
 */
export async function invalidateCampaignCache(campaignId: string): Promise<void> {
  try {
    const redis = getRedis();
    await redis.del(`${CAMPAIGN_CACHE_PREFIX}${campaignId}`);
    logger.debug(`[CampaignCache] Invalidated cache for campaign:${campaignId}`);
  } catch (err) {
    logger.warn(`[CampaignCache] Redis del error: ${err?.message}. Cache may be stale.`);
  }
}

/**
 * Update campaign with automatic cache invalidation.
 */
export async function updateCampaign(
  campaignId: string,
  updateData: Record<string, any>,
  options: { populate?: string[] } = {}
): Promise<any | null> {
  const campaign = await AdCampaign.findByIdAndUpdate(
    campaignId,
    updateData,
    { new: true }
  );

  if (campaign) {
    // Invalidate cache
    await invalidateCampaignCache(campaignId);

    // Optionally return with population
    if (options.populate?.length) {
      return AdCampaign.findById(campaignId)
        .select('-__v')
        .populate(options.populate.join(' '));
    }
  }

  return campaign;
}
