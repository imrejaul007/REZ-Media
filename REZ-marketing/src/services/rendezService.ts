/**
 * Rendez Service — Social and Contextual Offers Engine
 *
 * Handles:
 * - Dynamic offer generation based on time, occasions, and user behavior
 * - Couple-based offers (romantic dinners, couple spa)
 * - Group/social offers (friend meetups, party packages)
 * - Context-aware offers (Friday night deals, Valentine's campaigns)
 * - Offer templates management
 * - Booking flow
 * - Social sharing
 * - Analytics integration
 */

import { v4 as uuidv4 } from 'uuid';
import { RendezOffer, IRendezOffer, RendezOfferCategory, RendezOfferType, DayOfWeek, TimeOfDay, OccasionType, IOfferTemplate, IOfferBenefits } from '../models/RendezOffer';
import { logger } from '../config/logger';
import { growthAnalytics } from './growthAnalytics';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface CreateRendezOfferDTO {
  merchantId: string;
  name: string;
  category: RendezOfferCategory;
  type: RendezOfferType;
  title: string;
  description: string;
  benefits: IOfferBenefits;
  imageUrls?: string[];
  videoUrl?: string;
  ctaText?: string;
  ctaUrl?: string;
  originalPrice?: number;
  offerPrice?: number;
  minPartySize?: number;
  maxPartySize?: number;
  contextTrigger?: {
    dayOfWeek?: DayOfWeek[];
    timeOfDay?: TimeOfDay[];
    occasion?: { type: OccasionType; startDate?: Date; endDate?: Date; customName?: string }[];
    minPartySize?: number;
    maxPartySize?: number;
  };
  validFrom: Date;
  validUntil: Date;
  templateId?: string;
  templateName?: string;
  targetAudience?: {
    segments?: string[];
    locations?: { city?: string; areas?: string[]; pincodes?: string[] };
    interests?: string[];
  };
  bookingSlots?: { day: DayOfWeek; startTime: string; endTime: string; capacity?: number }[];
  shareable?: boolean;
  shareUrl?: string;
  shareMessage?: string;
  metadata?: Record<string, unknown>;
  tags?: string[];
  createdBy?: string;
}

export interface UpdateRendezOfferDTO {
  name?: string;
  title?: string;
  description?: string;
  benefits?: IOfferBenefits;
  imageUrls?: string[];
  videoUrl?: string;
  ctaText?: string;
  ctaUrl?: string;
  originalPrice?: number;
  offerPrice?: number;
  minPartySize?: number;
  maxPartySize?: number;
  contextTrigger?: {
    dayOfWeek?: DayOfWeek[];
    timeOfDay?: TimeOfDay[];
    occasion?: { type: OccasionType; startDate?: Date; endDate?: Date; customName?: string }[];
    minPartySize?: number;
    maxPartySize?: number;
  };
  validFrom?: Date;
  validUntil?: Date;
  status?: 'active' | 'scheduled' | 'expired' | 'cancelled' | 'paused';
  bookingSlots?: { day: DayOfWeek; startTime: string; endTime: string; capacity?: number }[];
  shareable?: boolean;
  shareUrl?: string;
  shareMessage?: string;
  metadata?: Record<string, unknown>;
  tags?: string[];
}

export interface RendezOfferFilters {
  merchantId?: string;
  category?: RendezOfferCategory;
  type?: RendezOfferType;
  status?: string;
  tags?: string[];
  occasion?: OccasionType;
  dayOfWeek?: DayOfWeek;
  validNow?: boolean;
  page?: number;
  limit?: number;
}

export interface ContextQuery {
  userId?: string;
  dayOfWeek?: DayOfWeek;
  timeOfDay?: TimeOfDay;
  occasion?: OccasionType;
  city?: string;
  area?: string;
  partySize?: number;
  interests?: string[];
  merchantId?: string;
}

export interface BookingDTO {
  offerId: string;
  userId: string;
  partySize: number;
  bookingDate: Date;
  bookingTime: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  specialRequests?: string;
  paymentMethod?: string;
}

export interface ShareDTO {
  offerId: string;
  userId: string;
  platform: 'whatsapp' | 'facebook' | 'twitter' | 'instagram' | 'copy_link';
  recipientCount?: number;
}

export interface GeneratedOffer {
  offerId: string;
  title: string;
  description: string;
  benefits: IOfferBenefits;
  originalPrice?: number;
  offerPrice?: number;
  savings?: number;
  imageUrls?: string[];
  ctaText: string;
  ctaUrl: string;
  validUntil: Date;
  occasion?: string;
  shareMessage: string;
}

// ── Offer Templates ─────────────────────────────────────────────────────────────

const COUPLE_OFFER_TEMPLATES: IOfferTemplate[] = [
  {
    name: 'Romantic Dinner',
    category: 'couple',
    type: 'bundle',
    title: 'Romantic Candlelight Dinner for Two',
    description: 'Create unforgettable memories with a specially curated candlelight dinner for two',
    benefits: {
      bundle: {
        items: ['3-course meal', 'sparkling wine', 'rose decoration'],
        packagePrice: 249900, // INR 2499
      },
    },
    imageUrls: ['/images/templates/candlelight-dinner.jpg'],
    ctaText: 'Book Your Date Night',
    ctaUrl: '/book/candlelight-dinner',
    validDays: ['friday', 'saturday', 'sunday'],
    validTimeStart: '18:00',
    validTimeEnd: '22:00',
  },
  {
    name: 'Couple Spa Retreat',
    category: 'couple',
    type: 'experience',
    title: 'Luxury Couple Spa Retreat',
    description: 'Relax and rejuvenate together with our premium couple spa package',
    benefits: {
      experience: {
        type: 'complimentary',
        description: '60-minute Swedish massage + 30-minute aromatherapy for two',
      },
    },
    imageUrls: ['/images/templates/couple-spa.jpg'],
    ctaText: 'Book Spa Experience',
    ctaUrl: '/book/couple-spa',
    validDays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
    validTimeStart: '10:00',
    validTimeEnd: '20:00',
  },
  {
    name: 'Anniversary Special',
    category: 'couple',
    type: 'percentage',
    title: 'Anniversary Celebration - 30% Off',
    description: 'Celebrate your special day with exclusive anniversary discounts',
    benefits: {
      discount: { type: 'percentage', value: 30, maxDiscount: 500000 },
    },
    ctaText: 'Claim Anniversary Offer',
    ctaUrl: '/book/anniversary-special',
    validDays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
  },
];

const GROUP_OFFER_TEMPLATES: IOfferTemplate[] = [
  {
    name: 'Friends Hangout',
    category: 'group',
    type: 'bogo',
    title: 'Friends Hangout - Buy 3 Get 1 Free',
    description: 'Bring your squad and enjoy exclusive group savings',
    benefits: {
      bogo: { buyQuantity: 3, getQuantity: 1, getItem: 'equivalent item' },
    },
    imageUrls: ['/images/templates/friends-hangout.jpg'],
    ctaText: 'Plan Your Hangout',
    ctaUrl: '/book/friends-hangout',
    validDays: ['friday', 'saturday', 'sunday'],
  },
  {
    name: 'Party Package',
    category: 'group',
    type: 'bundle',
    title: 'Ultimate Party Package (5+ People)',
    description: 'Everything you need for the perfect celebration',
    benefits: {
      bundle: {
        items: ['Reserved seating', 'DJ access', 'complimentary drinks', 'birthday cake'],
        packagePrice: 999900, // INR 9999
      },
    },
    imageUrls: ['/images/templates/party-package.jpg'],
    ctaText: 'Book Party Package',
    ctaUrl: '/book/party-package',
    validDays: ['friday', 'saturday'],
    validTimeStart: '20:00',
    validTimeEnd: '02:00',
  },
  {
    name: 'Group Dining',
    category: 'group',
    type: 'percentage',
    title: 'Group Dining - 20% Off for 4+',
    description: 'Dine together and save together',
    benefits: {
      discount: { type: 'percentage', value: 20, maxDiscount: 200000 },
    },
    ctaText: 'Book Group Table',
    ctaUrl: '/book/group-dining',
    validDays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
  },
];

const CONTEXT_OFFER_TEMPLATES: IOfferTemplate[] = [
  {
    name: 'Friday Night Deal',
    category: 'context',
    type: 'percentage',
    title: 'Friday Night Deals - 25% Off',
    description: 'Kick off your weekend with exclusive Friday night savings',
    benefits: {
      discount: { type: 'percentage', value: 25, maxDiscount: 300000 },
    },
    ctaText: 'Enjoy Friday Deals',
    ctaUrl: '/book/friday-deals',
    validDays: ['friday'],
    validTimeStart: '18:00',
    validTimeEnd: '23:00',
  },
  {
    name: 'Weekend Brunch',
    category: 'context',
    type: 'bundle',
    title: 'Weekend Brunch Package',
    description: 'Start your weekend right with our unlimited brunch',
    benefits: {
      bundle: {
        items: ['Unlimited food', '2-hour drinks package', 'live music'],
        packagePrice: 149900,
      },
    },
    imageUrls: ['/images/templates/weekend-brunch.jpg'],
    ctaText: 'Book Brunch',
    ctaUrl: '/book/weekend-brunch',
    validDays: ['saturday', 'sunday'],
    validTimeStart: '10:00',
    validTimeEnd: '14:00',
  },
  {
    name: "Valentine's Special",
    category: 'context',
    type: 'percentage',
    title: "Valentine's Week Special - 40% Off",
    description: 'Express your love with exclusive Valentine\'s offers',
    benefits: {
      discount: { type: 'percentage', value: 40, maxDiscount: 1000000 },
    },
    ctaText: 'Celebrate Valentine\'s',
    ctaUrl: '/book/valentines',
    tags: ['valentines', 'romantic', 'love'],
  },
  {
    name: 'Diwali Celebration',
    category: 'context',
    type: 'bundle',
    title: 'Diwali Celebration Package',
    description: 'Light up your celebrations with special Diwali offers',
    benefits: {
      bundle: {
        items: ['Festive decorations', 'traditional sweets', '20% off on orders'],
        packagePrice: 599900,
      },
    },
    ctaText: 'Book Diwali Celebration',
    ctaUrl: '/book/diwali',
    tags: ['diwali', 'festival', 'celebration'],
  },
];

// ── Service ────────────────────────────────────────────────────────────────────

class RendezService {
  /**
   * Create a new Rendez offer
   */
  async create(data: CreateRendezOfferDTO): Promise<IRendezOffer> {
    const offer = await RendezOffer.create({
      merchantId: data.merchantId,
      name: data.name,
      category: data.category,
      type: data.type,
      title: data.title,
      description: data.description,
      benefits: data.benefits,
      imageUrls: data.imageUrls,
      videoUrl: data.videoUrl,
      ctaText: data.ctaText,
      ctaUrl: data.ctaUrl,
      originalPrice: data.originalPrice,
      offerPrice: data.offerPrice,
      minPartySize: data.minPartySize || 1,
      maxPartySize: data.maxPartySize,
      contextTrigger: data.contextTrigger,
      validFrom: new Date(data.validFrom),
      validUntil: new Date(data.validUntil),
      status: 'active',
      templateId: data.templateId,
      templateName: data.templateName,
      targetAudience: data.targetAudience,
      bookingSlots: data.bookingSlots,
      shareable: data.shareable !== false,
      shareUrl: data.shareUrl,
      shareMessage: data.shareMessage,
      metadata: data.metadata,
      tags: data.tags,
      createdBy: data.createdBy,
      stats: { views: 0, bookings: 0, conversions: 0, shares: 0, revenue: 0, redemptions: 0 },
    });

    // Track in analytics
    this.trackOfferEvent('offer_created', offer).catch((err) => {
      logger.warn('[RendezService] Analytics tracking failed', { error: err.message });
    });

    logger.info('[RendezService] Created rendez offer', {
      offerId: offer._id,
      merchantId: data.merchantId,
      category: data.category,
      type: data.type,
    });

    return offer;
  }

  /**
   * Update an existing offer
   */
  async update(offerId: string, data: UpdateRendezOfferDTO): Promise<IRendezOffer | null> {
    const offer = await RendezOffer.findById(offerId);
    if (!offer) return null;

    // Apply updates
    if (data.name !== undefined) offer.name = data.name;
    if (data.title !== undefined) offer.title = data.title;
    if (data.description !== undefined) offer.description = data.description;
    if (data.benefits !== undefined) offer.benefits = data.benefits;
    if (data.imageUrls !== undefined) offer.imageUrls = data.imageUrls;
    if (data.videoUrl !== undefined) offer.videoUrl = data.videoUrl;
    if (data.ctaText !== undefined) offer.ctaText = data.ctaText;
    if (data.ctaUrl !== undefined) offer.ctaUrl = data.ctaUrl;
    if (data.originalPrice !== undefined) offer.originalPrice = data.originalPrice;
    if (data.offerPrice !== undefined) offer.offerPrice = data.offerPrice;
    if (data.minPartySize !== undefined) offer.minPartySize = data.minPartySize;
    if (data.maxPartySize !== undefined) offer.maxPartySize = data.maxPartySize;
    if (data.contextTrigger !== undefined) offer.contextTrigger = data.contextTrigger;
    if (data.validFrom !== undefined) offer.validFrom = new Date(data.validFrom);
    if (data.validUntil !== undefined) offer.validUntil = new Date(data.validUntil);
    if (data.status !== undefined) offer.status = data.status;
    if (data.bookingSlots !== undefined) offer.bookingSlots = data.bookingSlots;
    if (data.shareable !== undefined) offer.shareable = data.shareable;
    if (data.shareUrl !== undefined) offer.shareUrl = data.shareUrl;
    if (data.shareMessage !== undefined) offer.shareMessage = data.shareMessage;
    if (data.metadata !== undefined) offer.metadata = data.metadata;
    if (data.tags !== undefined) offer.tags = data.tags;

    await offer.save();

    logger.info('[RendezService] Updated rendez offer', { offerId, updates: Object.keys(data) });

    return offer;
  }

  /**
   * Get offer by ID
   */
  async getById(offerId: string): Promise<IRendezOffer | null> {
    return RendezOffer.findById(offerId).lean();
  }

  /**
   * List offers with filters
   */
  async list(filters: RendezOfferFilters): Promise<{ offers: IRendezOffer[]; total: number }> {
    const query: Record<string, unknown> = {};

    if (filters.merchantId) query.merchantId = filters.merchantId;
    if (filters.category) query.category = filters.category;
    if (filters.type) query.type = filters.type;
    if (filters.status) query.status = filters.status;
    if (filters.tags && filters.tags.length > 0) query.tags = { $in: filters.tags };

    // Context-based filtering
    if (filters.occasion) {
      query['contextTrigger.occasion.type'] = filters.occasion;
    }
    if (filters.dayOfWeek) {
      query['contextTrigger.dayOfWeek'] = filters.dayOfWeek;
    }

    // Filter for currently valid offers
    if (filters.validNow) {
      const now = new Date();
      query.validFrom = { $lte: now };
      query.validUntil = { $gte: now };
      query.status = 'active';
    }

    const page = filters.page || 1;
    const limit = Math.min(100, filters.limit || 20);
    const skip = (page - 1) * limit;

    const [offers, total] = await Promise.all([
      RendezOffer.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      RendezOffer.countDocuments(query),
    ]);

    return { offers, total };
  }

  /**
   * Get contextual offers based on user context
   */
  async getContextualOffers(context: ContextQuery): Promise<GeneratedOffer[]> {
    const now = new Date();
    const currentDay = this.getDayOfWeek(now);
    const currentTime = this.getTimeOfDay(now);
    const activeOccasion = this.detectActiveOccasion(now);

    // Build match query
    const query: Record<string, unknown> = {
      status: 'active',
      validFrom: { $lte: now },
      validUntil: { $gte: now },
    };

    if (context.merchantId) query.merchantId = context.merchantId;

    // Day of week match
    query.$or = [
      { 'contextTrigger.dayOfWeek': { $size: 0 } },
      { 'contextTrigger.dayOfWeek': { $in: [currentDay] } },
      { contextTrigger: { $exists: false } },
    ];

    // Time of day match
    query.$or = query.$or.concat([
      { 'contextTrigger.timeOfDay': { $size: 0 } },
      { 'contextTrigger.timeOfDay': { $in: [currentTime] } },
    ]);

    // Occasion match
    if (activeOccasion) {
      query.$or = query.$or.concat([
        { 'contextTrigger.occasion.type': activeOccasion },
        { tags: activeOccasion },
      ]);
    }

    // Location match
    if (context.city) {
      query.$or = query.$or.concat([
        { 'targetAudience.locations.city': { $in: [context.city, { $exists: false }] } },
        { targetAudience: { $exists: false } },
      ]);
    }

    // Party size match
    if (context.partySize) {
      query.$and = [
        { $or: [{ 'contextTrigger.minPartySize': { $exists: false } }, { 'contextTrigger.minPartySize': { $lte: context.partySize } }] },
        { $or: [{ 'contextTrigger.maxPartySize': { $exists: false } }, { 'contextTrigger.maxPartySize': { $gte: context.partySize } }] },
      ];
    }

    // Interest match
    if (context.interests && context.interests.length > 0) {
      query.$or = query.$or.concat([
        { 'targetAudience.interests': { $in: context.interests } },
        { targetAudience: { $exists: false } },
      ]);
    }

    const offers = await RendezOffer.find(query).limit(20).lean();

    // Increment view stats
    const offerIds = offers.map((o) => o._id);
    await RendezOffer.updateMany({ _id: { $in: offerIds } }, { $inc: { 'stats.views': 1 } });

    return offers.map((offer) => this.formatGeneratedOffer(offer, activeOccasion));
  }

  /**
   * Generate dynamic offers based on context
   */
  async generateDynamicOffers(context: ContextQuery): Promise<GeneratedOffer[]> {
    const now = new Date();
    const currentDay = this.getDayOfWeek(now);
    const currentTime = this.getTimeOfDay(now);
    const activeOccasion = this.detectActiveOccasion(now);

    // Get matching templates
    const templates = this.getMatchingTemplates(currentDay, currentTime, activeOccasion, context.partySize || 2);

    // Generate offers from templates
    const generatedOffers: GeneratedOffer[] = [];

    for (const template of templates) {
      const baseOffer = await this.createOfferFromTemplate(template, context.merchantId);

      if (context.occasion || activeOccasion) {
        const personalizedOffer = await this.personalizeOffer(baseOffer, context);
        generatedOffers.push(personalizedOffer);
      } else {
        generatedOffers.push(baseOffer);
      }
    }

    return generatedOffers;
  }

  /**
   * Get couple-specific offers
   */
  async getCoupleOffers(context: ContextQuery): Promise<GeneratedOffer[]> {
    const query: Record<string, unknown> = {
      category: 'couple',
      status: 'active',
      validFrom: { $lte: new Date() },
      validUntil: { $gte: new Date() },
    };

    if (context.merchantId) query.merchantId = context.merchantId;

    const offers = await RendezOffer.find(query).limit(10).lean();

    return offers.map((offer) => this.formatGeneratedOffer(offer));
  }

  /**
   * Get group/social offers
   */
  async getGroupOffers(context: ContextQuery): Promise<GeneratedOffer[]> {
    const query: Record<string, unknown> = {
      category: 'group',
      status: 'active',
      validFrom: { $lte: new Date() },
      validUntil: { $gte: new Date() },
    };

    if (context.merchantId) query.merchantId = context.merchantId;
    if (context.partySize && context.partySize > 1) {
      query.$and = [
        { $or: [{ maxPartySize: { $exists: false } }, { maxPartySize: { $gte: context.partySize } }] },
      ];
    }

    const offers = await RendezOffer.find(query).limit(10).lean();

    return offers.map((offer) => this.formatGeneratedOffer(offer));
  }

  /**
   * Book a rendez offer
   */
  async bookOffer(booking: BookingDTO): Promise<{ success: boolean; bookingId?: string; error?: string }> {
    const offer = await RendezOffer.findById(booking.offerId);
    if (!offer) {
      return { success: false, error: 'Offer not found' };
    }

    if (offer.status !== 'active') {
      return { success: false, error: 'Offer is not available for booking' };
    }

    // Validate party size
    if (offer.minPartySize && booking.partySize < offer.minPartySize) {
      return { success: false, error: `Minimum ${offer.minPartySize} guests required` };
    }
    if (offer.maxPartySize && booking.partySize > offer.maxPartySize) {
      return { success: false, error: `Maximum ${offer.maxPartySize} guests allowed` };
    }

    // Check availability
    const bookingDate = new Date(booking.bookingDate);
    const dayOfWeek = this.getDayOfWeek(bookingDate);
    const slot = offer.bookingSlots?.find((s) => s.day === dayOfWeek);

    if (slot) {
      if (booking.bookingTime < slot.startTime || booking.bookingTime > slot.endTime) {
        return { success: false, error: 'Booking time outside available slots' };
      }
    }

    // Generate booking ID
    const bookingId = `RZV-${uuidv4().substring(0, 8).toUpperCase()}`;

    // Update stats
    await RendezOffer.findByIdAndUpdate(booking.offerId, {
      $inc: { 'stats.bookings': 1 },
    });

    // Track in analytics
    this.trackOfferEvent('offer_booked', offer, {
      bookingId,
      partySize: booking.partySize,
      userId: booking.userId,
    }).catch((err) => {
      logger.warn('[RendezService] Booking analytics tracking failed', { error: err.message });
    });

    logger.info('[RendezService] Booking created', {
      bookingId,
      offerId: booking.offerId,
      partySize: booking.partySize,
    });

    return { success: true, bookingId };
  }

  /**
   * Share an offer
   */
  async shareOffer(share: ShareDTO): Promise<{ success: boolean; shareUrl?: string; error?: string }> {
    const offer = await RendezOffer.findById(share.offerId);
    if (!offer) {
      return { success: false, error: 'Offer not found' };
    }

    if (!offer.shareable) {
      return { success: false, error: 'This offer is not shareable' };
    }

    // Generate unique share URL
    const shareToken = uuidv4().substring(0, 12);
    const shareUrl = offer.shareUrl || `https://rez.money/rendez/${share.offerId}`;
    const fullShareUrl = `${shareUrl}?ref=${share.userId}&token=${shareToken}`;

    // Update stats
    await RendezOffer.findByIdAndUpdate(share.offerId, {
      $inc: {
        'stats.shares': share.recipientCount || 1,
      },
    });

    // Track in analytics
    this.trackOfferEvent('offer_shared', offer, {
      platform: share.platform,
      recipientCount: share.recipientCount,
      userId: share.userId,
    }).catch((err) => {
      logger.warn('[RendezService] Share analytics tracking failed', { error: err.message });
    });

    logger.info('[RendezService] Offer shared', {
      offerId: share.offerId,
      platform: share.platform,
      recipientCount: share.recipientCount,
    });

    return { success: true, shareUrl: fullShareUrl };
  }

  /**
   * Redeem an offer (mark as used)
   */
  async redeemOffer(offerId: string, orderId: string, revenue: number): Promise<boolean> {
    const offer = await RendezOffer.findByIdAndUpdate(
      offerId,
      {
        $inc: {
          'stats.redemptions': 1,
          'stats.conversions': 1,
          'stats.revenue': revenue,
        },
      },
      { new: true },
    );

    if (offer) {
      this.trackOfferEvent('offer_redeemed', offer, {
        orderId,
        revenue,
      }).catch((err) => {
        logger.warn('[RendezService] Redemption analytics tracking failed', { error: err.message });
      });
    }

    return !!offer;
  }

  /**
   * Get offer templates by category
   */
  getTemplates(category?: RendezOfferCategory): IOfferTemplate[] {
    switch (category) {
      case 'couple':
        return COUPLE_OFFER_TEMPLATES;
      case 'group':
        return GROUP_OFFER_TEMPLATES;
      case 'context':
        return CONTEXT_OFFER_TEMPLATES;
      default:
        return [...COUPLE_OFFER_TEMPLATES, ...GROUP_OFFER_TEMPLATES, ...CONTEXT_OFFER_TEMPLATES];
    }
  }

  /**
   * Create offer from template
   */
  async createOfferFromTemplate(template: IOfferTemplate, merchantId?: string): Promise<GeneratedOffer> {
    const now = new Date();
    const validUntil = new Date(now);
    validUntil.setDate(validUntil.getMonth() + 1); // Default: 1 month validity

    const savings = template.benefits.discount && template.originalPrice
      ? template.originalPrice - (template.benefits.discount.type === 'percentage'
          ? template.originalPrice * (1 - template.benefits.discount.value / 100)
          : template.originalPrice - template.benefits.discount.value)
      : undefined;

    return {
      offerId: `template-${template.name.toLowerCase().replace(/\s+/g, '-')}`,
      title: template.title,
      description: template.description,
      benefits: template.benefits,
      originalPrice: template.benefits.bundle?.packagePrice,
      offerPrice: template.benefits.bundle?.packagePrice,
      savings: savings,
      imageUrls: template.imageUrls,
      ctaText: template.ctaText || 'Book Now',
      ctaUrl: template.ctaUrl || '/book',
      validUntil,
      shareMessage: `Check out this amazing deal: ${template.title}! ${template.description}`,
    };
  }

  /**
   * Personalize offer based on user context
   */
  private async personalizeOffer(offer: GeneratedOffer, context: ContextQuery): Promise<GeneratedOffer> {
    // Apply user-specific customizations
    const personalized = { ...offer };

    // Adjust pricing based on user value
    if (context.userId) {
      // In production, fetch user data and adjust accordingly
      // For now, return the base offer
    }

    // Adjust party size messaging
    if (context.partySize) {
      if (context.partySize >= 4) {
        personalized.title = `${offer.title} - Perfect for Groups!`;
        personalized.shareMessage = `Looking for group plans? ${offer.title} is perfect for ${context.partySize} of you!`;
      }
    }

    return personalized;
  }

  /**
   * Format offer for display
   */
  private formatGeneratedOffer(offer: IRendezOffer & { _id: unknown }, occasion?: OccasionType): GeneratedOffer {
    const savings = offer.benefits.discount && offer.originalPrice
      ? offer.originalPrice - (offer.benefits.discount.type === 'percentage'
          ? offer.originalPrice * (1 - offer.benefits.discount.value / 100)
          : offer.originalPrice - offer.benefits.discount.value)
      : offer.originalPrice && offer.offerPrice
      ? offer.originalPrice - offer.offerPrice
      : undefined;

    return {
      offerId: String(offer._id),
      title: offer.title,
      description: offer.description,
      benefits: offer.benefits,
      originalPrice: offer.originalPrice,
      offerPrice: offer.offerPrice,
      savings: savings,
      imageUrls: offer.imageUrls,
      ctaText: offer.ctaText || 'Book Now',
      ctaUrl: offer.ctaUrl || `/rendez/${offer._id}`,
      validUntil: offer.validUntil,
      occasion: occasion || offer.contextTrigger?.occasion?.[0]?.type,
      shareMessage: offer.shareMessage || `Check out this amazing deal: ${offer.title}!`,
    };
  }

  /**
   * Get matching templates based on context
   */
  private getMatchingTemplates(day: DayOfWeek, time: TimeOfDay, occasion: OccasionType | undefined, partySize: number): IOfferTemplate[] {
    let templates: IOfferTemplate[] = [];

    // Get base templates by occasion or day
    if (occasion) {
      const occasionTemplates = [...COUPLE_OFFER_TEMPLATES, ...GROUP_OFFER_TEMPLATES, ...CONTEXT_OFFER_TEMPLATES]
        .filter((t) => t.tags?.includes(occasion) || t.name.toLowerCase().includes(occasion));
      templates = occasionTemplates.length > 0 ? occasionTemplates : templates;
    }

    // Day-based templates
    if (day === 'friday' || day === 'saturday' || day === 'sunday') {
      const weekendTemplates = [...GROUP_OFFER_TEMPLATES, ...CONTEXT_OFFER_TEMPLATES]
        .filter((t) => t.validDays?.includes(day));
      if (weekendTemplates.length > 0 && templates.length === 0) {
        templates = weekendTemplates;
      }
    }

    // Party size-based templates
    if (partySize === 2) {
      templates = [...COUPLE_OFFER_TEMPLATES, ...templates];
    } else if (partySize >= 4) {
      templates = [...GROUP_OFFER_TEMPLATES, ...templates];
    }

    return templates.length > 0 ? templates : [...COUPLE_OFFER_TEMPLATES, ...GROUP_OFFER_TEMPLATES].slice(0, 5);
  }

  /**
   * Get day of week from date
   */
  private getDayOfWeek(date: Date): DayOfWeek {
    const days: DayOfWeek[] = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    return days[date.getDay()];
  }

  /**
   * Get time of day from date
   */
  private getTimeOfDay(date: Date): TimeOfDay {
    const hour = date.getHours();
    if (hour >= 5 && hour < 12) return 'morning';
    if (hour >= 12 && hour < 17) return 'afternoon';
    if (hour >= 17 && hour < 21) return 'evening';
    return 'night';
  }

  /**
   * Detect active occasion from date
   */
  private detectActiveOccasion(date: Date): OccasionType | undefined {
    const month = date.getMonth();
    const day = date.getDate();
    const dayOfWeek = date.getDay();

    // Weekend
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      return 'weekend';
    }

    // Valentine's (Feb 10-14)
    if (month === 1 && day >= 10 && day <= 14) {
      return 'valentines';
    }

    // Christmas (Dec 20-26)
    if (month === 11 && day >= 20 && day <= 26) {
      return 'christmas';
    }

    // New Year (Dec 28 - Jan 3)
    if ((month === 11 && day >= 28) || (month === 0 && day <= 3)) {
      return 'new_year';
    }

    // Diwali (approximate - would use calendar in production)
    // This is a placeholder for actual Diwali date calculation
    if (month === 9 || month === 10) {
      // October or November - peak Diwali season
      return 'diwali';
    }

    // Summer (May-August in India)
    if (month >= 4 && month <= 7) {
      return 'summer';
    }

    // Monsoon (June-September in India)
    if (month >= 5 && month <= 8) {
      return 'monsoon';
    }

    return undefined;
  }

  /**
   * Track offer event in analytics
   */
  private async trackOfferEvent(
    eventType: string,
    offer: IRendezOffer & { _id: unknown },
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    try {
      growthAnalytics.trackEvent({
        eventType: `rendez_${eventType}`,
        sourceService: 'rez-marketing',
        merchantId: String(offer.merchantId),
        metadata: {
          offerId: String(offer._id),
          offerName: offer.name,
          category: offer.category,
          type: offer.type,
          ...metadata,
        },
      });
    } catch (err) {
      logger.error('[RendezService] Failed to track event', {
        eventType,
        offerId: offer._id,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  /**
   * Deactivate expired offers
   */
  async markExpiredOffers(): Promise<number> {
    const result = await RendezOffer.updateMany(
      {
        status: 'active',
        validUntil: { $lt: new Date() },
        isRecurring: { $ne: true },
      },
      { status: 'expired' },
    );

    if (result.modifiedCount > 0) {
      logger.info('[RendezService] Marked expired offers', { count: result.modifiedCount });
    }

    return result.modifiedCount;
  }

  /**
   * Delete an offer
   */
  async delete(offerId: string): Promise<boolean> {
    const result = await RendezOffer.findByIdAndDelete(offerId);
    if (result) {
      logger.info('[RendezService] Deleted rendez offer', { offerId });
      return true;
    }
    return false;
  }

  /**
   * Get offer statistics
   */
  async getStats(merchantId: string): Promise<{
    total: number;
    active: number;
    totalViews: number;
    totalBookings: number;
    totalConversions: number;
    totalRevenue: number;
  }> {
    const stats = await RendezOffer.aggregate([
      { $match: { merchantId: merchantId as unknown as typeof Schema.Types.ObjectId } },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          active: { $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] } },
          totalViews: { $sum: '$stats.views' },
          totalBookings: { $sum: '$stats.bookings' },
          totalConversions: { $sum: '$stats.conversions' },
          totalRevenue: { $sum: '$stats.revenue' },
        },
      },
    ]);

    if (stats.length === 0) {
      return { total: 0, active: 0, totalViews: 0, totalBookings: 0, totalConversions: 0, totalRevenue: 0 };
    }

    return stats[0] as { total: number; active: number; totalViews: number; totalBookings: number; totalConversions: number; totalRevenue: number };
  }
}

// Singleton export
export const rendezService = new RendezService();
