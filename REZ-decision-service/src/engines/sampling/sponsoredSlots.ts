/**
 * Sponsored Slots System for ReZ Marketing Platform
 *
 * Defines where sponsored content appears across different entry points:
 * - Search results slots
 * - Feed/discovery slots
 * - QR post-scan slots
 * - Chat/suggestion slots
 * - Location-triggered slots
 *
 * Features:
 * - Slot definitions per entry point
 * - Maximum sponsored per page (never > 30%)
 * - Labeling ("Sponsored")
 * - Rotation for fairness
 * - Pacing (don't show same merchant repeatedly)
 */

// ============================================================================
// Type Definitions
// ============================================================================

export type EntryPoint = 'search' | 'feed' | 'qr' | 'chat' | 'location';
export type PricingModel = 'cpc' | 'cpm' | 'cpa' | 'cps';

export interface SlotDefinition {
  id: string;
  entryPoint: EntryPoint;
  position: number; // 1, 2, 3...
  maxSponsored: number;
  minOrganicBetweenSponsored: number;
  label: string; // "Sponsored"
  pricing: PricingModel;
  minBid: number;
}

export interface SlotInventory {
  slotId: string;
  date: string; // YYYY-MM-DD
  hour?: number; // 0-23, optional for hourly tracking
  available: number;
  reserved: number;
  sold: number;
  price: number;
}

export interface SlotAllocation {
  slotId: string;
  listingId: string;
  merchantId: string;
  price: number;
  won: boolean;
  allocatedAt: Date;
}

export interface MerchantCampaign {
  merchantId: string;
  listingId: string;
  bidAmount: number;
  pricing: PricingModel;
  dailyBudget: number;
  spentToday: number;
  startDate: string;
  endDate: string;
  targetEntryPoints: EntryPoint[];
  isActive: boolean;
}

export interface PacingState {
  merchantId: string;
  lastShownAt: Date;
  impressionsToday: number;
  consecutiveOrganic: number;
  rotationScore: number; // Lower = more recently shown, higher = should be shown
}

export interface AllocationRequest {
  entryPoint: EntryPoint;
  pageSize: number;
  userId?: string;
  context?: Record<string, unknown>;
}

export interface AllocationResult {
  slots: SlotAllocation[];
  organicCount: number;
  sponsoredCount: number;
  totalSlots: number;
}

// ============================================================================
// Slot Definitions - All Entry Points
// ============================================================================

export const SLOT_DEFINITIONS: SlotDefinition[] = [
  // Search Results Slots
  {
    id: 'search-slot-1',
    entryPoint: 'search',
    position: 1,
    maxSponsored: 1,
    minOrganicBetweenSponsored: 0,
    label: 'Sponsored',
    pricing: 'cpc',
    minBid: 0.50,
  },
  {
    id: 'search-slot-4',
    entryPoint: 'search',
    position: 4,
    maxSponsored: 1,
    minOrganicBetweenSponsored: 3,
    label: 'Sponsored',
    pricing: 'cpc',
    minBid: 0.35,
  },
  {
    id: 'search-slot-7',
    entryPoint: 'search',
    position: 7,
    maxSponsored: 1,
    minOrganicBetweenSponsored: 2,
    label: 'Sponsored',
    pricing: 'cpc',
    minBid: 0.25,
  },
  {
    id: 'search-slot-10',
    entryPoint: 'search',
    position: 10,
    maxSponsored: 1,
    minOrganicBetweenSponsored: 2,
    label: 'Sponsored',
    pricing: 'cpm',
    minBid: 2.00,
  },

  // Feed/Discovery Slots
  {
    id: 'feed-slot-2',
    entryPoint: 'feed',
    position: 2,
    maxSponsored: 1,
    minOrganicBetweenSponsored: 1,
    label: 'Sponsored',
    pricing: 'cpm',
    minBid: 1.50,
  },
  {
    id: 'feed-slot-5',
    entryPoint: 'feed',
    position: 5,
    maxSponsored: 1,
    minOrganicBetweenSponsored: 3,
    label: 'Sponsored',
    pricing: 'cpm',
    minBid: 1.00,
  },
  {
    id: 'feed-slot-9',
    entryPoint: 'feed',
    position: 9,
    maxSponsored: 1,
    minOrganicBetweenSponsored: 3,
    label: 'Sponsored',
    pricing: 'cpm',
    minBid: 0.75,
  },
  {
    id: 'feed-slot-15',
    entryPoint: 'feed',
    position: 15,
    maxSponsored: 1,
    minOrganicBetweenSponsored: 5,
    label: 'Sponsored',
    pricing: 'cpm',
    minBid: 0.50,
  },

  // QR Post-Scan Slots (high intent moment)
  {
    id: 'qr-slot-1',
    entryPoint: 'qr',
    position: 1,
    maxSponsored: 2,
    minOrganicBetweenSponsored: 0,
    label: 'Sponsored',
    pricing: 'cpa',
    minBid: 1.00,
  },
  {
    id: 'qr-slot-3',
    entryPoint: 'qr',
    position: 3,
    maxSponsored: 1,
    minOrganicBetweenSponsored: 1,
    label: 'Sponsored',
    pricing: 'cpa',
    minBid: 0.75,
  },

  // Chat/Suggestion Slots (conversation context)
  {
    id: 'chat-slot-1',
    entryPoint: 'chat',
    position: 1,
    maxSponsored: 1,
    minOrganicBetweenSponsored: 0,
    label: 'Suggested',
    pricing: 'cpc',
    minBid: 0.30,
  },
  {
    id: 'chat-slot-3',
    entryPoint: 'chat',
    position: 3,
    maxSponsored: 1,
    minOrganicBetweenSponsored: 2,
    label: 'Suggested',
    pricing: 'cpc',
    minBid: 0.20,
  },

  // Location-Triggered Slots (geo-fenced)
  {
    id: 'location-slot-1',
    entryPoint: 'location',
    position: 1,
    maxSponsored: 3,
    minOrganicBetweenSponsored: 2,
    label: 'Nearby Sponsored',
    pricing: 'cpm',
    minBid: 2.50,
  },
  {
    id: 'location-slot-2',
    entryPoint: 'location',
    position: 2,
    maxSponsored: 2,
    minOrganicBetweenSponsored: 1,
    label: 'Nearby Sponsored',
    pricing: 'cpm',
    minBid: 1.50,
  },
  {
    id: 'location-slot-3',
    entryPoint: 'location',
    position: 3,
    maxSponsored: 1,
    minOrganicBetweenSponsored: 0,
    label: 'Nearby Sponsored',
    pricing: 'cpm',
    minBid: 1.00,
  },
];

// ============================================================================
// Constants
// ============================================================================

const MAX_SPONSORED_RATIO = 0.30; // Never more than 30% sponsored content
const PACING_WINDOW_HOURS = 24; // Don't show same merchant within 24 hours
const MIN_ROTATION_SCORE_THRESHOLD = 0.3; // Minimum rotation score to be considered

// ============================================================================
// Pricing Rules
// ============================================================================

export interface PricingRule {
  model: PricingModel;
  calculatePrice: (basePrice: number, competition: number, quality: number) => number;
}

export const PRICING_RULES: Record<PricingModel, PricingRule> = {
  cpc: {
    // Cost per click - adjusted by competition and quality score
    calculatePrice: (basePrice, competition, quality) => {
      const competitionMultiplier = 1 + (competition * 0.1);
      const qualityMultiplier = 0.5 + (quality * 0.5); // 0.5 to 1.0 based on quality
      return Math.round(basePrice * competitionMultiplier / qualityMultiplier * 100) / 100;
    },
  },
  cpm: {
    // Cost per 1000 impressions - base price adjusted by competition
    calculatePrice: (basePrice, competition, quality) => {
      const competitionMultiplier = 1 + (competition * 0.15);
      return Math.round(basePrice * competitionMultiplier * 100) / 100;
    },
  },
  cpa: {
    // Cost per acquisition - premium pricing due to conversion intent
    calculatePrice: (basePrice, competition, quality) => {
      const competitionMultiplier = 1 + (competition * 0.2);
      const qualityMultiplier = 0.7 + (quality * 0.3);
      return Math.round(basePrice * competitionMultiplier / qualityMultiplier * 100) / 100;
    },
  },
  cps: {
    // Cost per sale - percentage-based or fixed
    calculatePrice: (basePrice, competition, quality) => {
      const basePercentage = 0.10; // 10% baseline
      const qualityBonus = quality * 0.05; // Up to 5% bonus for high quality
      return Math.round((basePercentage + qualityBonus) * 10000) / 10000;
    },
  },
};

// ============================================================================
// Slot Manager Class
// ============================================================================

export class SponsoredSlotManager {
  private inventory: Map<string, SlotInventory> = new Map();
  private pacingStates: Map<string, PacingState> = new Map();
  private allocations: SlotAllocation[] = [];
  private campaigns: Map<string, MerchantCampaign> = new Map();

  constructor() {
    this.initializeInventory();
  }

  /**
   * Initialize inventory for all slot definitions
   */
  private initializeInventory(): void {
    const today = this.getTodayDate();

    for (const slot of SLOT_DEFINITIONS) {
      const slotKey = `${slot.id}-${today}`;
      this.inventory.set(slotKey, {
        slotId: slot.id,
        date: today,
        available: slot.maxSponsored,
        reserved: 0,
        sold: 0,
        price: slot.minBid,
      });

      // Initialize hourly inventory for high-traffic slots
      if (slot.entryPoint === 'search' || slot.entryPoint === 'feed') {
        for (let hour = 0; hour < 24; hour++) {
          const hourlyKey = `${slot.id}-${today}-${hour}`;
          this.inventory.set(hourlyKey, {
            slotId: slot.id,
            date: today,
            hour,
            available: Math.ceil(slot.maxSponsored / 4), // 1/4 of daily for each quarter
            reserved: 0,
            sold: 0,
            price: this.calculateDynamicPrice(slot, hour),
          });
        }
      }
    }
  }

  /**
   * Get today's date in YYYY-MM-DD format
   */
  private getTodayDate(): string {
    return new Date().toISOString().split('T')[0];
  }

  /**
   * Calculate dynamic pricing based on time of day
   */
  private calculateDynamicPrice(slot: SlotDefinition, hour: number): number {
    // Peak hours (11-14, 18-21) get 1.5x pricing
    const isPeak = (hour >= 11 && hour <= 14) || (hour >= 18 && hour <= 21);
    const multiplier = isPeak ? 1.5 : 1.0;
    return Math.round(slot.minBid * multiplier * 100) / 100;
  }

  /**
   * Get slots for a specific entry point
   */
  getSlotsForEntryPoint(entryPoint: EntryPoint): SlotDefinition[] {
    return SLOT_DEFINITIONS.filter((slot) => slot.entryPoint === entryPoint)
      .sort((a, b) => a.position - b.position);
  }

  /**
   * Get slot definition by ID
   */
  getSlotDefinition(slotId: string): SlotDefinition | undefined {
    return SLOT_DEFINITIONS.find((slot) => slot.id === slotId);
  }

  /**
   * Get current inventory for a slot
   */
  getSlotInventory(slotId: string, date?: string, hour?: number): SlotInventory | undefined {
    const targetDate = date || this.getTodayDate();
    let key: string;

    if (hour !== undefined) {
      key = `${slotId}-${targetDate}-${hour}`;
    } else {
      key = `${slotId}-${targetDate}`;
    }

    return this.inventory.get(key);
  }

  /**
   * Reserve a slot for a merchant
   */
  reserveSlot(slotId: string, merchantId: string, date?: string, hour?: number): boolean {
    const inventory = this.getSlotInventory(slotId, date, hour);
    if (!inventory || inventory.available <= 0) {
      return false;
    }

    const key = hour !== undefined
      ? `${slotId}-${date || this.getTodayDate()}-${hour}`
      : `${slotId}-${date || this.getTodayDate()}`;

    inventory.available--;
    inventory.reserved++;
    this.inventory.set(key, inventory);

    return true;
  }

  /**
   * Release a reserved slot
   */
  releaseSlot(slotId: string, date?: string, hour?: number): void {
    const inventory = this.getSlotInventory(slotId, date, hour);
    if (!inventory || inventory.reserved <= 0) {
      return;
    }

    const key = hour !== undefined
      ? `${slotId}-${date || this.getTodayDate()}-${hour}`
      : `${slotId}-${date || this.getTodayDate()}`;

    inventory.available++;
    inventory.reserved--;
    this.inventory.set(key, inventory);
  }

  /**
   * Confirm slot purchase (convert reservation to sale)
   */
  confirmSlotSale(slotId: string, merchantId: string, listingId: string, price: number): SlotAllocation {
    const allocation: SlotAllocation = {
      slotId,
      listingId,
      merchantId,
      price,
      won: true,
      allocatedAt: new Date(),
    };

    this.allocations.push(allocation);

    // Update inventory
    const key = `${slotId}-${this.getTodayDate()}`;
    const inventory = this.inventory.get(key);
    if (inventory) {
      inventory.reserved--;
      inventory.sold++;
      inventory.price = price;
      this.inventory.set(key, inventory);
    }

    return allocation;
  }

  /**
   * Get all active campaigns
   */
  getActiveCampaigns(entryPoint?: EntryPoint): MerchantCampaign[] {
    const today = this.getTodayDate();
    const campaigns = Array.from(this.campaigns.values());

    return campaigns.filter((campaign) => {
      if (!campaign.isActive) return false;
      if (campaign.startDate > today || campaign.endDate < today) return false;
      if (campaign.spentToday >= campaign.dailyBudget) return false;
      if (entryPoint && !campaign.targetEntryPoints.includes(entryPoint)) return false;
      return true;
    });
  }

  /**
   * Register a new campaign
   */
  registerCampaign(campaign: MerchantCampaign): void {
    this.campaigns.set(campaign.merchantId, campaign);
  }

  /**
   * Update campaign spend
   */
  recordSpend(merchantId: string, amount: number): void {
    const campaign = this.campaigns.get(merchantId);
    if (campaign) {
      campaign.spentToday += amount;
    }
  }

  // ==========================================================================
  // Pacing & Rotation Logic
  // ==========================================================================

  /**
   * Get or create pacing state for a merchant
   */
  private getPacingState(merchantId: string): PacingState {
    let state = this.pacingStates.get(merchantId);
    if (!state) {
      state = {
        merchantId,
        lastShownAt: new Date(0), // Never shown
        impressionsToday: 0,
        consecutiveOrganic: 0,
        rotationScore: 1.0, // High score = should be shown
      };
      this.pacingStates.set(merchantId, state);
    }
    return state;
  }

  /**
   * Update pacing state after impression
   */
  private updatePacingState(merchantId: string, wasSponsored: boolean): void {
    const state = this.getPacingState(merchantId);

    if (wasSponsored) {
      state.lastShownAt = new Date();
      state.impressionsToday++;
      state.consecutiveOrganic = 0;
      state.rotationScore = 0.1; // Recently shown, low priority
    } else {
      state.consecutiveOrganic++;
      state.rotationScore = Math.min(1.0, state.rotationScore + 0.1);
    }

    // Decay rotation score over time
    const hoursSinceLastShown = (Date.now() - state.lastShownAt.getTime()) / (1000 * 60 * 60);
    if (hoursSinceLastShown > PACING_WINDOW_HOURS) {
      state.rotationScore = Math.min(1.0, state.rotationScore + (hoursSinceLastShown / PACING_WINDOW_HOURS) * 0.2);
    }

    this.pacingStates.set(merchantId, state);
  }

  /**
   * Check if merchant is eligible for sponsored slot (pacing check)
   */
  private isMerchantEligible(merchantId: string, slot: SlotDefinition): boolean {
    const state = this.getPacingState(merchantId);

    // Check minimum organic between sponsored
    if (state.consecutiveOrganic < slot.minOrganicBetweenSponsored) {
      return false;
    }

    // Check rotation score threshold
    if (state.rotationScore < MIN_ROTATION_SCORE_THRESHOLD) {
      return false;
    }

    // Check budget
    const campaign = this.campaigns.get(merchantId);
    if (campaign && campaign.spentToday >= campaign.dailyBudget) {
      return false;
    }

    return true;
  }

  /**
   * Rank merchants by allocation priority (rotation + bid + quality)
   */
  private rankMerchants(
    merchants: Array<{ merchantId: string; listingId: string; bidAmount: number; quality: number }>,
    slot: SlotDefinition
  ): Array<{ merchantId: string; listingId: string; score: number; bidAmount: number }> {
    return merchants
      .filter((m) => this.isMerchantEligible(m.merchantId, slot))
      .map((m) => {
        const pacingScore = this.getPacingState(m.merchantId).rotationScore;
        const bidScore = m.bidAmount / slot.minBid;
        const qualityScore = m.quality;

        // Weighted combination: 40% bid, 30% quality, 30% rotation fairness
        const combinedScore = (bidScore * 0.4) + (qualityScore * 0.3) + (pacingScore * 0.3);

        return {
          merchantId: m.merchantId,
          listingId: m.listingId,
          score: combinedScore,
          bidAmount: m.bidAmount,
        };
      })
      .sort((a, b) => b.score - a.score);
  }

  // ==========================================================================
  // Main Allocation Logic
  // ==========================================================================

  /**
   * Allocate sponsored slots for a request
   */
  allocate(request: AllocationRequest): AllocationResult {
    const { entryPoint, pageSize } = request;
    const slots = this.getSlotsForEntryPoint(entryPoint);

    // Calculate max sponsored slots (never > 30%)
    const maxSponsored = Math.min(
      Math.floor(pageSize * MAX_SPONSORED_RATIO),
      slots.reduce((sum, slot) => sum + slot.maxSponsored, 0)
    );

    const allocations: SlotAllocation[] = [];
    let organicCount = 0;
    let sponsoredCount = 0;
    let slotsUsed = 0;
    let lastSponsoredPosition = -999; // Track position for minOrganicBetweenSponsored

    // Build slot position map
    const slotPositions = new Map<number, SlotDefinition>();
    for (const slot of slots) {
      if (slot.position <= pageSize) {
        slotPositions.set(slot.position, slot);
      }
    }

    // Get eligible merchants for this entry point
    const activeCampaigns = this.getActiveCampaigns(entryPoint);
    const eligibleMerchants = activeCampaigns.map((campaign) => ({
      merchantId: campaign.merchantId,
      listingId: campaign.listingId,
      bidAmount: campaign.bidAmount,
      quality: 0.7, // Default quality score, can be adjusted based on campaign metrics
    }));

    // Process each position in the page
    for (let position = 1; position <= pageSize && sponsoredCount < maxSponsored; position++) {
      const slotDefinition = slotPositions.get(position);

      // Check if this is a sponsored slot position
      if (slotDefinition) {
        const inventory = this.getSlotInventory(slotDefinition.id);
        if (!inventory || inventory.available <= 0) {
          // No inventory, treat as organic
          organicCount++;
          this.updatePacingState('organic', false);
          continue;
        }

        // Rank eligible merchants for this slot
        const rankedMerchants = this.rankMerchants(eligibleMerchants, slotDefinition);

        if (rankedMerchants.length > 0) {
          const winner = rankedMerchants[0];
          const price = this.calculatePrice(slotDefinition, winner.bidAmount, rankedMerchants.length, winner.score);

          const allocation: SlotAllocation = {
            slotId: slotDefinition.id,
            listingId: winner.listingId,
            merchantId: winner.merchantId,
            price,
            won: true,
            allocatedAt: new Date(),
          };

          allocations.push(allocation);
          sponsoredCount++;
          lastSponsoredPosition = position;
          slotsUsed++;

          // Reserve the slot
          this.reserveSlot(slotDefinition.id, winner.merchantId);

          // Update pacing state
          this.updatePacingState(winner.merchantId, true);

          // Remove winner from eligible list (prevent double-booking)
          const winnerIndex = eligibleMerchants.findIndex((m) => m.merchantId === winner.merchantId);
          if (winnerIndex !== -1) {
            eligibleMerchants.splice(winnerIndex, 1);
          }
        } else {
          // No eligible merchant, treat as organic
          organicCount++;
          this.updatePacingState('organic', false);
        }
      } else {
        // Not a sponsored slot position
        organicCount++;
        this.updatePacingState('organic', false);
      }
    }

    return {
      slots: allocations,
      organicCount,
      sponsoredCount,
      totalSlots: pageSize,
    };
  }

  /**
   * Calculate final price for a slot
   */
  private calculatePrice(
    slot: SlotDefinition,
    bidAmount: number,
    competition: number,
    quality: number
  ): number {
    const pricingRule = PRICING_RULES[slot.pricing];
    const calculatedPrice = pricingRule.calculatePrice(bidAmount, competition, quality);

    // Final price is the higher of: calculated price or minimum bid
    return Math.max(calculatedPrice, slot.minBid);
  }

  // ==========================================================================
  // Utility Methods
  // ==========================================================================

  /**
   * Get allocation statistics
   */
  getAllocationStats(entryPoint: EntryPoint, date?: string): {
    totalSlots: number;
    sold: number;
    available: number;
    revenue: number;
    fillRate: number;
  } {
    const slots = this.getSlotsForEntryPoint(entryPoint);
    const targetDate = date || this.getTodayDate();

    let totalSlots = 0;
    let sold = 0;
    let available = 0;
    let revenue = 0;

    for (const slot of slots) {
      const inventory = this.getSlotInventory(slot.id, targetDate);
      if (inventory) {
        totalSlots += slot.maxSponsored;
        sold += inventory.sold;
        available += inventory.available;
        revenue += inventory.sold * inventory.price;
      }
    }

    return {
      totalSlots,
      sold,
      available,
      revenue: Math.round(revenue * 100) / 100,
      fillRate: totalSlots > 0 ? Math.round((sold / totalSlots) * 10000) / 100 : 0,
    };
  }

  /**
   * Reset daily metrics (call at start of each day)
   */
  resetDailyMetrics(): void {
    // Reset pacing states for impressions
    for (const state of this.pacingStates.values()) {
      state.impressionsToday = 0;
    }

    // Reset campaign spend
    for (const campaign of this.campaigns.values()) {
      campaign.spentToday = 0;
    }

    // Reinitialize inventory
    this.initializeInventory();
  }

  /**
   * Export current state for persistence
   */
  exportState(): {
    campaigns: MerchantCampaign[];
    pacingStates: PacingState[];
    allocations: SlotAllocation[];
  } {
    return {
      campaigns: Array.from(this.campaigns.values()),
      pacingStates: Array.from(this.pacingStates.values()),
      allocations: this.allocations.slice(-1000), // Keep last 1000 allocations
    };
  }

  /**
   * Import state from persistence
   */
  importState(state: {
    campaigns?: MerchantCampaign[];
    pacingStates?: PacingState[];
    allocations?: SlotAllocation[];
  }): void {
    if (state.campaigns) {
      for (const campaign of state.campaigns) {
        this.campaigns.set(campaign.merchantId, campaign);
      }
    }

    if (state.pacingStates) {
      for (const pacingState of state.pacingStates) {
        this.pacingStates.set(pacingState.merchantId, pacingState);
      }
    }

    if (state.allocations) {
      this.allocations = state.allocations;
    }
  }
}

// ============================================================================
// Factory Function
// ============================================================================

export function createSponsoredSlotManager(): SponsoredSlotManager {
  return new SponsoredSlotManager();
}

// ============================================================================
// Default Export
// ============================================================================

export default SponsoredSlotManager;
