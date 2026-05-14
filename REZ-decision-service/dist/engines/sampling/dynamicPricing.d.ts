/**
 * DYNAMIC QR PRICING ENGINE
 * "Uber Surge Pricing" for coins - adjusts rewards based on context
 *
 * Pricing factors:
 * - Time: Peak hours (lunch/dinner) = standard, Off-peak = boosted
 * - Inventory: High stock = standard, Low stock = boosted, Near expiry = maximum boost
 * - Demand: High nearby users = standard, Low demand = boosted
 * - Location: Premium = standard, Emerging/hard-to-reach = boosted
 */
export interface PricingContext {
    merchantId: string;
    location?: {
        lat: number;
        lng: number;
    };
    time: Date;
}
export interface DynamicPrice {
    baseCoins: number;
    finalCoins: number;
    multipliers: {
        time: number;
        inventory: number;
        demand: number;
        location: number;
    };
    surgeLabel: 'normal' | 'boosted' | 'surge';
    expiresAt: Date;
}
export interface MerchantInventory {
    productId: string;
    quantity: number;
    maxQuantity: number;
    expiresAt?: Date;
    category: string;
}
export interface NearbyUserCount {
    total: number;
    activeLast5min: number;
    activeLast15min: number;
}
export interface LocationType {
    type: 'premium' | 'standard' | 'emerging' | 'campus';
    geohash: string;
    address?: string;
}
export declare class DynamicPricingEngine {
    /**
     * Calculate dynamic price for a merchant at a given time/location
     */
    calculatePrice(context: PricingContext, baseCoins?: number): Promise<DynamicPrice>;
    /**
     * Calculate time-of-day multiplier
     * Peak hours = standard, Off-peak = boosted, Midnight = maximum boost
     */
    calculateTimeMultiplier(time: Date): number;
    /**
     * Calculate inventory-based multiplier
     * High stock = standard, Low stock = boosted, Near expiry = maximum boost
     */
    calculateInventoryMultiplier(inventory: MerchantInventory | null): number;
    /**
     * Calculate demand-based multiplier
     * High demand (many nearby users) = standard, Low demand = boosted
     */
    calculateDemandMultiplier(demand: NearbyUserCount): number;
    /**
     * Calculate location-based multiplier
     * Premium = standard, Emerging = boosted, Campus/hard-to-reach = maximum boost
     */
    calculateLocationMultiplier(locationType: LocationType): number;
    /**
     * Determine surge label based on combined multiplier
     */
    determineSurgeLabel(combinedMultiplier: number): 'normal' | 'boosted' | 'surge';
    /**
     * Fetch merchant inventory from Redis
     */
    private fetchInventory;
    /**
     * Fetch demand (nearby users) from Redis
     */
    private fetchDemand;
    /**
     * Determine location type from coordinates or geohash
     */
    private determineLocationType;
    /**
     * Simple geohash encoding (base32)
     */
    private encodeGeohash;
    /**
     * Get surrounding geohash cells (8 neighbors + self)
     */
    private getSurroundingGeohashes;
    /**
     * Infer location type from geohash pattern
     * This is a simplified heuristic - production would use POI/MLS data
     */
    private inferLocationType;
    /**
     * Record a user presence at a location (for demand tracking)
     */
    recordUserPresence(userId: string, location: {
        lat: number;
        lng: number;
    }): Promise<void>;
    /**
     * Update merchant inventory in Redis
     */
    updateInventory(merchantId: string, inventory: MerchantInventory): Promise<void>;
    /**
     * Set location type explicitly (admin function)
     */
    setLocationType(geohash: string, type: LocationType['type']): Promise<void>;
    /**
     * Get pricing history for analytics
     */
    getPricingHistory(merchantId: string, hours?: number): Promise<Array<{
        timestamp: Date;
        baseCoins: number;
        finalCoins: number;
        multipliers: DynamicPrice['multipliers'];
    }>>;
    /**
     * Record pricing event for analytics
     */
    recordPricingEvent(merchantId: string, price: DynamicPrice): Promise<void>;
}
export declare function calculateDynamicPrice(context: PricingContext, baseCoins?: number): Promise<DynamicPrice>;
export declare function getCurrentSurgeLevel(merchantId: string): Promise<{
    level: 'normal' | 'boosted' | 'surge';
    activeMultiplier: number;
}>;
export default DynamicPricingEngine;
