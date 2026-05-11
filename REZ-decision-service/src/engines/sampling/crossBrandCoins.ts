/**
 * CROSS-BRAND COINS ENGINE - Phase 4
 * Multi-merchant coin pools for cross-brand redemption
 *
 * Features:
 * - Cross-Brand Coin Creation with multiple merchants
 * - Partner Networks (Restaurant, Fashion, Wellness)
 * - Redemption Rules with per-merchant percentages
 * - Balance Tracking across network
 */

import Redis from 'ioredis';

// ============================================
// REDIS CONFIGURATION
// ============================================

const REDIS_PREFIX = 'crossbrand:';
const COIN_PREFIX = `${REDIS_PREFIX}coin:`;
const NETWORK_PREFIX = `${REDIS_PREFIX}network:`;
const BALANCE_PREFIX = `${REDIS_PREFIX}balance:`;
const REDEMPTION_PREFIX = `${REDIS_PREFIX}redemption:`;
const MERCHANT_RULES_PREFIX = `${REDIS_PREFIX}merchantrules:`;

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

// ============================================
// INTERFACES
// ============================================

export interface CrossBrandCoin {
  id: string;
  name: string;                    // "Foodie Coins"
  symbol: string;                  // "FOOD"
  merchants: string[];              // Merchant IDs
  coinValue: number;               // 1 coin = ₹1
  maxRedemptionPercent: number;    // Max % of bill
  expiryDays: number;
  networkType: NetworkType;
  createdAt: Date;
  status: 'active' | 'paused' | 'expired';
}

export interface CrossBrandRedemption {
  merchantId: string;
  amount: number;
  billAmount: number;
  coinsRequired: number;
  merchantShare: number;
}

export interface MerchantRedemptionRule {
  merchantId: string;
  coinId: string;
  maxPercent: number;              // Merchant-specific max (overrides coin default)
  flatDiscount?: number;           // Optional flat discount in rupees
  minBillAmount?: number;          // Minimum bill to use coins
  maxDiscount?: number;            // Maximum discount cap
  daysOfWeek?: number[];           // 0-6, empty = all days
  hoursOfDay?: { start: number; end: number }[]; // Time restrictions
  status: 'active' | 'inactive';
}

export interface UserCrossBrandBalance {
  userId: string;
  coinId: string;
  balance: number;
  pendingBalance: number;          // Coins being processed
  lifetimeEarned: number;
  lifetimeRedeemed: number;
  lastActivity: Date;
  networkType: NetworkType;
}

export interface CoinCreationRequest {
  name: string;
  symbol: string;
  merchants: string[];
  coinValue?: number;              // Default 1
  maxRedemptionPercent?: number;   // Default 50
  expiryDays?: number;             // Default 90
  networkType: NetworkType;
}

export interface CoinRedemptionRequest {
  userId: string;
  coinId: string;
  merchantId: string;
  billAmount: number;
  coinsToUse?: number;             // Optional, auto-calculate if not provided
}

export interface CoinRedemptionResult {
  success: boolean;
  coinsUsed: number;
  cashRequired: number;
  discountAmount: number;
  merchantRedemptions: CrossBrandRedemption[];
  newBalance: number;
  expiresAt: Date;
  error?: string;
}

export interface NetworkStats {
  networkType: NetworkType;
  totalCoinsIssued: number;
  totalCoinsRedeemed: number;
  activeMerchants: number;
  totalUsers: number;
  avgRedemptionRate: number;
}

export interface MerchantNetworkStats {
  merchantId: string;
  coinId: string;
  coinsAccepted: number;
  coinsRedeemed: number;
  avgBillAmount: number;
  conversionRate: number;
}

// Network Types
export type NetworkType = 'restaurant' | 'fashion' | 'wellness';

// ============================================
// DEFAULT CONFIGURATION
// ============================================

const DEFAULT_CONFIG = {
  // Coin defaults
  defaultCoinValue: 1,             // 1 coin = ₹1
  defaultMaxRedemptionPercent: 50,
  defaultExpiryDays: 90,

  // Limits
  minBillAmount: 100,              // Minimum bill to use coins
  maxCoinsPerTransaction: 10000,
  minCoinsToRedeem: 10,

  // Network defaults
  networkMinMerchants: 3,          // Minimum merchants per network

  // Expiry settings
  expiryCheckIntervalHours: 24,

  // Balance thresholds
  lowBalanceThreshold: 50,        // Notify when balance below this

  // Redemption processing
  redemptionProcessingFee: 0,      // Platform fee percentage (0 = no fee)
  merchantSettlementDays: 7
};

// ============================================
// PARTNER NETWORKS
// ============================================

export class PartnerNetwork {
  private networkType: NetworkType;
  private merchants: Map<string, NetworkMerchantConfig> = new Map();

  constructor(networkType: NetworkType) {
    this.networkType = networkType;
  }

  async initialize(merchantIds: string[]): Promise<void> {
    for (const merchantId of merchantIds) {
      const config = await this.loadMerchantConfig(merchantId);
      this.merchants.set(merchantId, config);
    }
  }

  private async loadMerchantConfig(merchantId: string): Promise<NetworkMerchantConfig> {
    const data = await redis.hgetall(`${NETWORK_PREFIX}${this.networkType}:merchant:${merchantId}`);

    return {
      merchantId,
      category: data.category || this.getDefaultCategory(),
      maxRedemptionPercent: parseInt(data.maxRedemptionPercent || '50'),
      minBillAmount: parseInt(data.minBillAmount || String(DEFAULT_CONFIG.minBillAmount)),
      averageBill: parseFloat(data.averageBill || '500'),
      rating: parseFloat(data.rating || '4.0'),
      status: (data.status as 'active' | 'inactive') || 'active'
    };
  }

  private getDefaultCategory(): string {
    switch (this.networkType) {
      case 'restaurant': return 'food';
      case 'fashion': return 'apparel';
      case 'wellness': return 'spa';
      default: return 'general';
    }
  }

  addMerchant(merchantId: string, config?: Partial<NetworkMerchantConfig>): void {
    this.merchants.set(merchantId, {
      merchantId,
      category: config?.category || this.getDefaultCategory(),
      maxRedemptionPercent: config?.maxRedemptionPercent || 50,
      minBillAmount: config?.minBillAmount || DEFAULT_CONFIG.minBillAmount,
      averageBill: config?.averageBill || 500,
      rating: config?.rating || 4.0,
      status: config?.status || 'active'
    });
  }

  removeMerchant(merchantId: string): boolean {
    return this.merchants.delete(merchantId);
  }

  getMerchants(): string[] {
    return Array.from(this.merchants.keys());
  }

  getActiveMerchants(): string[] {
    return Array.from(this.merchants.entries())
      .filter(([_, config]) => config.status === 'active')
      .map(([id]) => id);
  }

  getMerchantConfig(merchantId: string): NetworkMerchantConfig | undefined {
    return this.merchants.get(merchantId);
  }

  isMerchantInNetwork(merchantId: string): boolean {
    return this.merchants.has(merchantId);
  }

  async getNetworkStats(): Promise<NetworkStats> {
    const coinIds = await redis.smembers(`${NETWORK_PREFIX}${this.networkType}:coins`);

    let totalIssued = 0;
    let totalRedeemed = 0;
    let totalUsers = 0;

    for (const coinId of coinIds) {
      const stats = await redis.hgetall(`${COIN_PREFIX}${coinId}:stats`);
      totalIssued += parseInt(stats.issued || '0');
      totalRedeemed += parseInt(stats.redeemed || '0');

      const userCount = await redis.scard(`${COIN_PREFIX}${coinId}:users`);
      totalUsers += userCount;
    }

    return {
      networkType: this.networkType,
      totalCoinsIssued: totalIssued,
      totalCoinsRedeemed: totalRedeemed,
      activeMerchants: this.getActiveMerchants().length,
      totalUsers,
      avgRedemptionRate: totalIssued > 0 ? totalRedeemed / totalIssued : 0
    };
  }

  private async persistMerchantConfig(merchantId: string, config: NetworkMerchantConfig): Promise<void> {
    await redis.hmset(`${NETWORK_PREFIX}${this.networkType}:merchant:${merchantId}`, {
      category: config.category,
      maxRedemptionPercent: config.maxRedemptionPercent.toString(),
      minBillAmount: config.minBillAmount.toString(),
      averageBill: config.averageBill.toString(),
      rating: config.rating.toString(),
      status: config.status
    });
  }
}

interface NetworkMerchantConfig {
  merchantId: string;
  category: string;
  maxRedemptionPercent: number;
  minBillAmount: number;
  averageBill: number;
  rating: number;
  status: 'active' | 'inactive';
}

// ============================================
// CROSS-BRAND COIN MANAGER
// ============================================

export class CrossBrandCoinManager {
  private config: typeof DEFAULT_CONFIG;
  private networks: Map<NetworkType, PartnerNetwork>;

  constructor(config?: Partial<typeof DEFAULT_CONFIG>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.networks = new Map([
      ['restaurant', new PartnerNetwork('restaurant')],
      ['fashion', new PartnerNetwork('fashion')],
      ['wellness', new PartnerNetwork('wellness')]
    ]);
  }

  /**
   * Create a new cross-brand coin pool
   */
  async createCoin(request: CoinCreationRequest): Promise<CrossBrandCoin> {
    const coinId = this.generateCoinId(request.symbol);

    const coin: CrossBrandCoin = {
      id: coinId,
      name: request.name,
      symbol: request.symbol.toUpperCase(),
      merchants: request.merchants,
      coinValue: request.coinValue || this.config.defaultCoinValue,
      maxRedemptionPercent: request.maxRedemptionPercent || this.config.defaultMaxRedemptionPercent,
      expiryDays: request.expiryDays || this.config.defaultExpiryDays,
      networkType: request.networkType,
      createdAt: new Date(),
      status: 'active'
    };

    // Validate minimum merchants
    if (request.merchants.length < this.config.networkMinMerchants) {
      throw new Error(
        `Network must have at least ${this.config.networkMinMerchants} merchants, got ${request.merchants.length}`
      );
    }

    // Persist coin data
    await redis.hmset(`${COIN_PREFIX}${coinId}`, {
      id: coin.id,
      name: coin.name,
      symbol: coin.symbol,
      coinValue: coin.coinValue.toString(),
      maxRedemptionPercent: coin.maxRedemptionPercent.toString(),
      expiryDays: coin.expiryDays.toString(),
      networkType: coin.networkType,
      createdAt: coin.createdAt.toISOString(),
      status: coin.status,
      merchants: JSON.stringify(coin.merchants)
    });

    // Add to network's coin set
    await redis.sadd(`${NETWORK_PREFIX}${coin.networkType}:coins`, coinId);

    // Add merchants to network if not already present
    const network = this.networks.get(coin.networkType);
    if (network) {
      for (const merchantId of coin.merchants) {
        if (!network.isMerchantInNetwork(merchantId)) {
          network.addMerchant(merchantId);
        }
      }
    }

    // Initialize stats
    await redis.hmset(`${COIN_PREFIX}${coinId}:stats`, {
      issued: '0',
      redeemed: '0',
      expired: '0'
    });

    console.log(`[CrossBrandCoinManager] Created coin ${coin.symbol} (${coinId}) with ${coin.merchants.length} merchants`);
    return coin;
  }

  /**
   * Get coin by ID
   */
  async getCoin(coinId: string): Promise<CrossBrandCoin | null> {
    const data = await redis.hgetall(`${COIN_PREFIX}${coinId}`);
    if (!data.id) return null;

    return {
      id: data.id,
      name: data.name,
      symbol: data.symbol,
      merchants: JSON.parse(data.merchants || '[]'),
      coinValue: parseFloat(data.coinValue),
      maxRedemptionPercent: parseInt(data.maxRedemptionPercent),
      expiryDays: parseInt(data.expiryDays),
      networkType: data.networkType as NetworkType,
      createdAt: new Date(data.createdAt),
      status: data.status as 'active' | 'paused' | 'expired'
    };
  }

  /**
   * Get coin by symbol
   */
  async getCoinBySymbol(symbol: string): Promise<CrossBrandCoin | null> {
    const coinId = await redis.get(`${REDIS_PREFIX}symbol:${symbol.toUpperCase()}`);
    if (!coinId) return null;
    return this.getCoin(coinId);
  }

  /**
   * Update coin status
   */
  async updateCoinStatus(coinId: string, status: 'active' | 'paused' | 'expired'): Promise<boolean> {
    const coin = await this.getCoin(coinId);
    if (!coin) return false;

    await redis.hset(`${COIN_PREFIX}${coinId}`, 'status', status);
    return true;
  }

  /**
   * Add merchant to existing coin
   */
  async addMerchantToCoin(coinId: string, merchantId: string): Promise<boolean> {
    const coin = await this.getCoin(coinId);
    if (!coin) return false;

    if (coin.merchants.includes(merchantId)) return true; // Already exists

    coin.merchants.push(merchantId);
    await redis.hset(`${COIN_PREFIX}${coinId}`, 'merchants', JSON.stringify(coin.merchants));

    // Add to network
    const network = this.networks.get(coin.networkType);
    if (network) {
      network.addMerchant(merchantId);
    }

    return true;
  }

  /**
   * Remove merchant from coin (soft remove - existing balances still valid)
   */
  async removeMerchantFromCoin(coinId: string, merchantId: string): Promise<boolean> {
    const coin = await this.getCoin(coinId);
    if (!coin) return false;

    coin.merchants = coin.merchants.filter(m => m !== merchantId);
    await redis.hset(`${COIN_PREFIX}${coinId}`, 'merchants', JSON.stringify(coin.merchants));

    // Mark merchant as inactive in network
    const network = this.networks.get(coin.networkType);
    if (network) {
      const config = network.getMerchantConfig(merchantId);
      if (config) {
        config.status = 'inactive';
      }
    }

    return true;
  }

  /**
   * Get all coins for a network type
   */
  async getCoinsByNetwork(networkType: NetworkType): Promise<CrossBrandCoin[]> {
    const coinIds = await redis.smembers(`${NETWORK_PREFIX}${networkType}:coins`);
    const coins: CrossBrandCoin[] = [];

    for (const coinId of coinIds) {
      const coin = await this.getCoin(coinId);
      if (coin) coins.push(coin);
    }

    return coins;
  }

  /**
   * Get merchant's applicable coins
   */
  async getMerchantCoins(merchantId: string): Promise<CrossBrandCoin[]> {
    const allCoins = await redis.keys(`${COIN_PREFIX}*:merchants`);
    const applicableCoins: CrossBrandCoin[] = [];

    for (const key of allCoins) {
      const coinId = key.replace(`${COIN_PREFIX}`, '').replace(':merchants', '');
      const coin = await this.getCoin(coinId);
      if (coin && coin.merchants.includes(merchantId) && coin.status === 'active') {
        applicableCoins.push(coin);
      }
    }

    return applicableCoins;
  }

  private generateCoinId(symbol: string): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 6);
    return `${symbol.toLowerCase()}_${timestamp}_${random}`;
  }
}

// ============================================
// MERCHANT REDEMPTION RULES ENGINE
// ============================================

export class MerchantRulesEngine {
  private config: typeof DEFAULT_CONFIG;

  constructor(config?: Partial<typeof DEFAULT_CONFIG>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Set redemption rule for a merchant
   */
  async setRule(merchantId: string, coinId: string, rule: Partial<MerchantRedemptionRule>): Promise<void> {
    const existingRule = await this.getRule(merchantId, coinId);

    const fullRule: MerchantRedemptionRule = {
      merchantId,
      coinId,
      maxPercent: rule.maxPercent ?? existingRule?.maxPercent ?? 50,
      flatDiscount: rule.flatDiscount,
      minBillAmount: rule.minBillAmount ?? this.config.minBillAmount,
      maxDiscount: rule.maxDiscount,
      daysOfWeek: rule.daysOfWeek,
      hoursOfDay: rule.hoursOfDay,
      status: rule.status || 'active'
    };

    await redis.hmset(`${MERCHANT_RULES_PREFIX}${merchantId}:${coinId}`, {
      merchantId,
      coinId,
      maxPercent: fullRule.maxPercent.toString(),
      flatDiscount: fullRule.flatDiscount?.toString() || '',
      minBillAmount: fullRule.minBillAmount.toString(),
      maxDiscount: fullRule.maxDiscount?.toString() || '',
      daysOfWeek: JSON.stringify(fullRule.daysOfWeek || []),
      hoursOfDay: JSON.stringify(fullRule.hoursOfDay || []),
      status: fullRule.status
    });
  }

  /**
   * Get redemption rule for merchant + coin combination
   */
  async getRule(merchantId: string, coinId: string): Promise<MerchantRedemptionRule | null> {
    const data = await redis.hgetall(`${MERCHANT_RULES_PREFIX}${merchantId}:${coinId}`);
    if (!data.merchantId) return null;

    return {
      merchantId: data.merchantId,
      coinId: data.coinId,
      maxPercent: parseInt(data.maxPercent),
      flatDiscount: data.flatDiscount ? parseFloat(data.flatDiscount) : undefined,
      minBillAmount: parseInt(data.minBillAmount),
      maxDiscount: data.maxDiscount ? parseFloat(data.maxDiscount) : undefined,
      daysOfWeek: JSON.parse(data.daysOfWeek || '[]'),
      hoursOfDay: JSON.parse(data.hoursOfDay || '[]'),
      status: data.status as 'active' | 'inactive'
    };
  }

  /**
   * Get all rules for a merchant
   */
  async getMerchantRules(merchantId: string): Promise<MerchantRedemptionRule[]> {
    const keys = await redis.keys(`${MERCHANT_RULES_PREFIX}${merchantId}:*`);
    const rules: MerchantRedemptionRule[] = [];

    for (const key of keys) {
      const coinId = key.split(':').pop()!;
      const rule = await this.getRule(merchantId, coinId);
      if (rule) rules.push(rule);
    }

    return rules;
  }

  /**
   * Check if redemption is allowed at current time
   */
  isRedemptionAllowed(rule: MerchantRedemptionRule): { allowed: boolean; reason?: string } {
    if (rule.status !== 'active') {
      return { allowed: false, reason: 'Merchant redemption is inactive' };
    }

    const now = new Date();
    const dayOfWeek = now.getDay();

    // Check day restrictions
    if (rule.daysOfWeek && rule.daysOfWeek.length > 0) {
      if (!rule.daysOfWeek.includes(dayOfWeek)) {
        return { allowed: false, reason: `Not valid on day ${dayOfWeek}` };
      }
    }

    // Check hour restrictions
    if (rule.hoursOfDay && rule.hoursOfDay.length > 0) {
      const hour = now.getHours();
      const isWithinHours = rule.hoursOfDay.some(({ start, end }) =>
        hour >= start && hour < end
      );
      if (!isWithinHours) {
        return { allowed: false, reason: 'Outside valid hours' };
      }
    }

    return { allowed: true };
  }

  /**
   * Calculate max coins applicable for a bill
   */
  calculateMaxCoins(
    billAmount: number,
    maxPercent: number,
    maxDiscount?: number,
    coinValue: number = 1
  ): number {
    const maxByPercent = (billAmount * maxPercent) / 100;
    const maxCoins = maxDiscount
      ? Math.min(maxByPercent, maxDiscount / coinValue)
      : maxByPercent;

    return Math.floor(maxCoins);
  }
}

// ============================================
// BALANCE TRACKER
// ============================================

export class BalanceTracker {
  private config: typeof DEFAULT_CONFIG;

  constructor(config?: Partial<typeof DEFAULT_CONFIG>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Get user's balance for a specific coin
   */
  async getBalance(userId: string, coinId: string): Promise<UserCrossBrandBalance> {
    const key = `${BALANCE_PREFIX}${userId}:${coinId}`;
    const data = await redis.hgetall(key);

    return {
      userId,
      coinId,
      balance: parseInt(data.balance || '0'),
      pendingBalance: parseInt(data.pendingBalance || '0'),
      lifetimeEarned: parseInt(data.lifetimeEarned || '0'),
      lifetimeRedeemed: parseInt(data.lifetimeRedeemed || '0'),
      lastActivity: data.lastActivity ? new Date(data.lastActivity) : new Date(),
      networkType: (data.networkType as NetworkType) || 'restaurant'
    };
  }

  /**
   * Add coins to user balance
   */
  async addCoins(
    userId: string,
    coinId: string,
    amount: number,
    networkType: NetworkType
  ): Promise<UserCrossBrandBalance> {
    const key = `${BALANCE_PREFIX}${userId}:${coinId}`;
    const now = new Date();

    const pipeline = redis.pipeline();
    pipeline.hincrby(key, 'balance', amount);
    pipeline.hincrby(key, 'lifetimeEarned', amount);
    pipeline.hset(key, 'lastActivity', now.toISOString());
    pipeline.hset(key, 'networkType', networkType);
    pipeline.sadd(`${COIN_PREFIX}${coinId}:users`, userId);
    await pipeline.exec();

    // Update coin stats
    await redis.hincrby(`${COIN_PREFIX}${coinId}:stats`, 'issued', amount);

    return this.getBalance(userId, coinId);
  }

  /**
   * Reserve coins for redemption (pending state)
   */
  async reserveCoins(
    userId: string,
    coinId: string,
    amount: number
  ): Promise<boolean> {
    const key = `${BALANCE_PREFIX}${userId}:${coinId}`;
    const currentBalance = parseInt(await redis.hget(key, 'balance') || '0');

    if (currentBalance < amount) {
      return false;
    }

    const pipeline = redis.pipeline();
    pipeline.hincrby(key, 'balance', -amount);
    pipeline.hincrby(key, 'pendingBalance', amount);
    pipeline.hset(key, 'lastActivity', new Date().toISOString());
    await pipeline.exec();

    return true;
  }

  /**
   * Confirm redemption (remove from pending, record redemption)
   */
  async confirmRedemption(
    userId: string,
    coinId: string,
    amount: number
  ): Promise<UserCrossBrandBalance> {
    const key = `${BALANCE_PREFIX}${userId}:${coinId}`;
    const now = new Date();

    const pipeline = redis.pipeline();
    pipeline.hincrby(key, 'pendingBalance', -amount);
    pipeline.hincrby(key, 'lifetimeRedeemed', amount);
    pipeline.hset(key, 'lastActivity', now.toISOString());
    pipeline.sadd(`${COIN_PREFIX}${coinId}:users`, userId);
    await pipeline.exec();

    // Update coin stats
    await redis.hincrby(`${COIN_PREFIX}${coinId}:stats`, 'redeemed', amount);

    return this.getBalance(userId, coinId);
  }

  /**
   * Cancel pending reservation
   */
  async cancelReservation(
    userId: string,
    coinId: string,
    amount: number
  ): Promise<UserCrossBrandBalance> {
    const key = `${BALANCE_PREFIX}${userId}:${coinId}`;

    const pipeline = redis.pipeline();
    pipeline.hincrby(key, 'balance', amount);
    pipeline.hincrby(key, 'pendingBalance', -amount);
    await pipeline.exec();

    return this.getBalance(userId, coinId);
  }

  /**
   * Get all user balances across networks
   */
  async getAllUserBalances(userId: string): Promise<UserCrossBrandBalance[]> {
    const keys = await redis.keys(`${BALANCE_PREFIX}${userId}:*`);
    const balances: UserCrossBrandBalance[] = [];

    for (const key of keys) {
      const coinId = key.split(':').pop()!;
      const balance = await this.getBalance(userId, coinId);
      if (balance.balance > 0 || balance.pendingBalance > 0) {
        balances.push(balance);
      }
    }

    return balances;
  }

  /**
   * Get user's total balance across all coins in a network
   */
  async getNetworkBalance(userId: string, networkType: NetworkType): Promise<number> {
    const balances = await this.getAllUserBalances(userId);
    const coinManager = new CrossBrandCoinManager();

    let total = 0;
    for (const balance of balances) {
      const coin = await coinManager.getCoin(balance.coinId);
      if (coin && coin.networkType === networkType) {
        total += balance.balance + balance.pendingBalance;
      }
    }

    return total;
  }

  /**
   * Check for and process expired coins
   */
  async processExpiredCoins(userId: string, coinId: string): Promise<number> {
    const balance = await this.getBalance(userId, coinId);
    const coin = await new CrossBrandCoinManager().getCoin(coinId);

    if (!coin) return 0;

    const expiryDate = new Date(balance.lastActivity);
    expiryDate.setDate(expiryDate.getDate() + coin.expiryDays);

    if (new Date() > expiryDate && balance.balance > 0) {
      const expiredAmount = balance.balance;

      // Move to expired
      const pipeline = redis.pipeline();
      pipeline.hincrby(`${BALANCE_PREFIX}${userId}:${coinId}`, 'balance', -expiredAmount);
      pipeline.hincrby(`${COIN_PREFIX}${coinId}:stats`, 'expired', expiredAmount);
      await pipeline.exec();

      return expiredAmount;
    }

    return 0;
  }

  /**
   * Get per-merchant redemption tracking
   */
  async getMerchantRedemptionStats(
    userId: string,
    coinId: string
  ): Promise<Record<string, { totalRedeemed: number; timesUsed: number; lastUsed: Date | null }>> {
    const key = `${REDEMPTION_PREFIX}${userId}:${coinId}:merchants`;
    const data = await redis.hgetall(key);
    const stats: Record<string, { totalRedeemed: number; timesUsed: number; lastUsed: Date | null }> = {};

    for (const [merchantId, value] of Object.entries(data)) {
      const parsed = JSON.parse(value);
      stats[merchantId] = {
        totalRedeemed: parsed.total || 0,
        timesUsed: parsed.count || 0,
        lastUsed: parsed.last ? new Date(parsed.last) : null
      };
    }

    return stats;
  }

  /**
   * Record merchant redemption
   */
  async recordMerchantRedemption(
    userId: string,
    coinId: string,
    merchantId: string,
    amount: number
  ): Promise<void> {
    const key = `${REDEMPTION_PREFIX}${userId}:${coinId}:merchants:${merchantId}`;
    const now = new Date().toISOString();

    const existing = await redis.get(key);
    const data = existing ? JSON.parse(existing) : { total: 0, count: 0 };

    data.total += amount;
    data.count += 1;
    data.last = now;

    await redis.set(key, JSON.stringify(data));
  }
}

// ============================================
// REDEMPTION ENGINE (MAIN)
// ============================================

export class RedemptionEngine {
  private coinManager: CrossBrandCoinManager;
  private rulesEngine: MerchantRulesEngine;
  private balanceTracker: BalanceTracker;
  private config: typeof DEFAULT_CONFIG;

  constructor(config?: Partial<typeof DEFAULT_CONFIG>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.coinManager = new CrossBrandCoinManager(config);
    this.rulesEngine = new MerchantRulesEngine(config);
    this.balanceTracker = new BalanceTracker(config);
  }

  /**
   * Calculate redemption details without executing
   */
  async calculateRedemption(request: CoinRedemptionRequest): Promise<CoinRedemptionResult> {
    const { userId, coinId, merchantId, billAmount, coinsToUse } = request;

    // Validate coin exists
    const coin = await this.coinManager.getCoin(coinId);
    if (!coin) {
      return this.createErrorResult('Coin not found');
    }

    if (coin.status !== 'active') {
      return this.createErrorResult(`Coin is ${coin.status}`);
    }

    // Validate merchant is in coin's network
    if (!coin.merchants.includes(merchantId)) {
      return this.createErrorResult('Merchant not part of this coin network');
    }

    // Get user's balance
    const balance = await this.balanceTracker.getBalance(userId, coinId);
    if (balance.balance <= 0) {
      return this.createErrorResult('Insufficient balance');
    }

    // Get merchant-specific rules
    const merchantRule = await this.rulesEngine.getRule(merchantId, coinId);
    const maxPercent = merchantRule?.maxPercent ?? coin.maxRedemptionPercent;

    // Check redemption restrictions
    if (merchantRule) {
      const allowed = this.rulesEngine.isRedemptionAllowed(merchantRule);
      if (!allowed.allowed) {
        return this.createErrorResult(allowed.reason || 'Redemption not allowed');
      }
    }

    // Check minimum bill amount
    const minBill = merchantRule?.minBillAmount ?? this.config.minBillAmount;
    if (billAmount < minBill) {
      return this.createErrorResult(`Minimum bill amount is ₹${minBill}`);
    }

    // Calculate coins to use
    const maxCoinsByPercent = this.rulesEngine.calculateMaxCoins(
      billAmount,
      maxPercent,
      merchantRule?.maxDiscount,
      coin.coinValue
    );

    const coinsAvailable = Math.min(balance.balance, maxCoinsByPercent);
    const coinsToRedeem = coinsToUse
      ? Math.min(coinsToUse, coinsAvailable)
      : coinsAvailable;

    if (coinsToRedeem < this.config.minCoinsToRedeem) {
      return this.createErrorResult(`Minimum ${this.config.minCoinsToRedeem} coins required`);
    }

    // Calculate values
    const discountAmount = coinsToRedeem * coin.coinValue;
    const cashRequired = Math.max(0, billAmount - discountAmount);
    const newBalance = balance.balance - coinsToRedeem;

    // Calculate expiry
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + coin.expiryDays);

    return {
      success: true,
      coinsUsed: coinsToRedeem,
      cashRequired,
      discountAmount,
      merchantRedemptions: [{
        merchantId,
        amount: coinsToRedeem,
        billAmount,
        coinsRequired: coinsToRedeem,
        merchantShare: discountAmount
      }],
      newBalance,
      expiresAt
    };
  }

  /**
   * Execute redemption
   */
  async redeem(request: CoinRedemptionRequest): Promise<CoinRedemptionResult> {
    const { userId, coinId, merchantId, billAmount, coinsToUse } = request;

    // Calculate first
    const calculation = await this.calculateRedemption(request);
    if (!calculation.success) {
      return calculation;
    }

    // Reserve coins
    const reserved = await this.balanceTracker.reserveCoins(userId, coinId, calculation.coinsUsed);
    if (!reserved) {
      return this.createErrorResult('Failed to reserve coins - balance may have changed');
    }

    try {
      // Confirm redemption
      const newBalance = await this.balanceTracker.confirmRedemption(
        userId,
        coinId,
        calculation.coinsUsed
      );

      // Record per-merchant stats
      await this.balanceTracker.recordMerchantRedemption(
        userId,
        coinId,
        merchantId,
        calculation.coinsUsed
      );

      // Get updated calculation with new balance
      const coin = await this.coinManager.getCoin(coinId)!;
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + coin.expiryDays);

      return {
        success: true,
        coinsUsed: calculation.coinsUsed,
        cashRequired: calculation.cashRequired,
        discountAmount: calculation.discountAmount,
        merchantRedemptions: calculation.merchantRedemptions,
        newBalance: newBalance.balance,
        expiresAt
      };
    } catch (error) {
      // Cancel reservation on error
      await this.balanceTracker.cancelReservation(userId, coinId, calculation.coinsUsed);
      return this.createErrorResult('Redemption failed - coins returned to balance');
    }
  }

  /**
   * Split redemption across multiple merchants in network
   */
  async splitRedemption(
    userId: string,
    coinId: string,
    merchantVisits: { merchantId: string; billAmount: number }[]
  ): Promise<CoinRedemptionResult> {
    const coin = await this.coinManager.getCoin(coinId);
    if (!coin) {
      return this.createErrorResult('Coin not found');
    }

    const balance = await this.balanceTracker.getBalance(userId, coinId);
    let remainingBalance = balance.balance;
    const merchantRedemptions: CrossBrandRedemption[] = [];
    let totalCoinsUsed = 0;
    let totalDiscount = 0;

    // Sort by merchant priority (could be rating, maxPercent, etc.)
    const sortedVisits = [...merchantVisits].sort((a, b) => {
      return (b.billAmount || 0) - (a.billAmount || 0);
    });

    for (const visit of sortedVisits) {
      if (remainingBalance <= 0) break;

      // Validate merchant in network
      if (!coin.merchants.includes(visit.merchantId)) continue;

      const merchantRule = await this.rulesEngine.getRule(visit.merchantId, coinId);
      const maxPercent = merchantRule?.maxPercent ?? coin.maxRedemptionPercent;

      const maxCoinsForThis = this.rulesEngine.calculateMaxCoins(
        visit.billAmount,
        maxPercent,
        merchantRule?.maxDiscount,
        coin.coinValue
      );

      const coinsToUse = Math.min(remainingBalance, maxCoinsForThis);
      const discount = coinsToUse * coin.coinValue;

      merchantRedemptions.push({
        merchantId: visit.merchantId,
        amount: coinsToUse,
        billAmount: visit.billAmount,
        coinsRequired: coinsToUse,
        merchantShare: discount
      });

      totalCoinsUsed += coinsToUse;
      totalDiscount += discount;
      remainingBalance -= coinsToUse;
    }

    const totalBill = merchantVisits.reduce((sum, v) => sum + v.billAmount, 0);

    return {
      success: totalCoinsUsed > 0,
      coinsUsed: totalCoinsUsed,
      cashRequired: totalBill - totalDiscount,
      discountAmount: totalDiscount,
      merchantRedemptions,
      newBalance: balance.balance - totalCoinsUsed,
      expiresAt: new Date(Date.now() + (coin?.expiryDays || 90) * 24 * 60 * 60 * 1000)
    };
  }

  private createErrorResult(error: string): CoinRedemptionResult {
    return {
      success: false,
      coinsUsed: 0,
      cashRequired: 0,
      discountAmount: 0,
      merchantRedemptions: [],
      newBalance: 0,
      expiresAt: new Date(),
      error
    };
  }
}

// ============================================
// CROSS-BRAND COINS ENGINE (FACADE)
// ============================================

export class CrossBrandCoinsEngine {
  private coinManager: CrossBrandCoinManager;
  private rulesEngine: MerchantRulesEngine;
  private balanceTracker: BalanceTracker;
  private redemptionEngine: RedemptionEngine;
  private networks: Map<NetworkType, PartnerNetwork>;
  private config: typeof DEFAULT_CONFIG;

  constructor(config?: Partial<typeof DEFAULT_CONFIG>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.coinManager = new CrossBrandCoinManager(config);
    this.rulesEngine = new MerchantRulesEngine(config);
    this.balanceTracker = new BalanceTracker(config);
    this.redemptionEngine = new RedemptionEngine(config);
    this.networks = new Map([
      ['restaurant', new PartnerNetwork('restaurant')],
      ['fashion', new PartnerNetwork('fashion')],
      ['wellness', new PartnerNetwork('wellness')]
    ]);
  }

  // ========== Coin Operations ==========

  async createCoin(request: CoinCreationRequest): Promise<CrossBrandCoin> {
    return this.coinManager.createCoin(request);
  }

  async getCoin(coinId: string): Promise<CrossBrandCoin | null> {
    return this.coinManager.getCoin(coinId);
  }

  async getCoinBySymbol(symbol: string): Promise<CrossBrandCoin | null> {
    return this.coinManager.getCoinBySymbol(symbol);
  }

  async getCoinsByNetwork(networkType: NetworkType): Promise<CrossBrandCoin[]> {
    return this.coinManager.getCoinsByNetwork(networkType);
  }

  async getMerchantCoins(merchantId: string): Promise<CrossBrandCoin[]> {
    return this.coinManager.getMerchantCoins(merchantId);
  }

  // ========== Redemption Rules ==========

  async setMerchantRule(merchantId: string, coinId: string, rule: Partial<MerchantRedemptionRule>): Promise<void> {
    return this.rulesEngine.setRule(merchantId, coinId, rule);
  }

  async getMerchantRule(merchantId: string, coinId: string): Promise<MerchantRedemptionRule | null> {
    return this.rulesEngine.getRule(merchantId, coinId);
  }

  async getMerchantRules(merchantId: string): Promise<MerchantRedemptionRule[]> {
    return this.rulesEngine.getMerchantRules(merchantId);
  }

  // ========== Balance Operations ==========

  async getBalance(userId: string, coinId: string): Promise<UserCrossBrandBalance> {
    return this.balanceTracker.getBalance(userId, coinId);
  }

  async addCoins(userId: string, coinId: string, amount: number): Promise<UserCrossBrandBalance> {
    const coin = await this.coinManager.getCoin(coinId);
    if (!coin) throw new Error('Coin not found');
    return this.balanceTracker.addCoins(userId, coinId, amount, coin.networkType);
  }

  async getAllUserBalances(userId: string): Promise<UserCrossBrandBalance[]> {
    return this.balanceTracker.getAllUserBalances(userId);
  }

  async getMerchantRedemptionStats(userId: string, coinId: string): Promise<Record<string, any>> {
    return this.balanceTracker.getMerchantRedemptionStats(userId, coinId);
  }

  // ========== Redemption Operations ==========

  async calculateRedemption(request: CoinRedemptionRequest): Promise<CoinRedemptionResult> {
    return this.redemptionEngine.calculateRedemption(request);
  }

  async redeem(request: CoinRedemptionRequest): Promise<CoinRedemptionResult> {
    return this.redemptionEngine.redeem(request);
  }

  async splitRedemption(
    userId: string,
    coinId: string,
    merchantVisits: { merchantId: string; billAmount: number }[]
  ): Promise<CoinRedemptionResult> {
    return this.redemptionEngine.splitRedemption(userId, coinId, merchantVisits);
  }

  // ========== Network Operations ==========

  async getNetworkStats(networkType: NetworkType): Promise<NetworkStats> {
    const network = this.networks.get(networkType);
    if (!network) throw new Error(`Unknown network type: ${networkType}`);
    return network.getNetworkStats();
  }

  async addMerchantToNetwork(
    networkType: NetworkType,
    merchantId: string,
    config?: Partial<NetworkMerchantConfig>
  ): Promise<void> {
    const network = this.networks.get(networkType);
    if (!network) throw new Error(`Unknown network type: ${networkType}`);
    network.addMerchant(merchantId, config);
  }

  // ========== Convenience Methods ==========

  /**
   * Quick check if user can redeem at merchant
   */
  async canRedeem(userId: string, coinId: string, merchantId: string, billAmount: number): Promise<{
    canRedeem: boolean;
    reason?: string;
    maxCoins?: number;
    maxDiscount?: number;
  }> {
    const result = await this.calculateRedemption({ userId, coinId, merchantId, billAmount });

    if (result.success) {
      return {
        canRedeem: true,
        maxCoins: result.coinsUsed,
        maxDiscount: result.discountAmount
      };
    }

    return {
      canRedeem: false,
      reason: result.error
    };
  }

  /**
   * Get user's best available coin for a merchant
   */
  async getBestCoinForMerchant(
    userId: string,
    merchantId: string,
    billAmount: number
  ): Promise<{ coin: CrossBrandCoin; result: CoinRedemptionResult } | null> {
    const coins = await this.coinManager.getMerchantCoins(merchantId);
    let bestResult: CoinRedemptionResult | null = null;
    let bestCoin: CrossBrandCoin | null = null;

    for (const coin of coins) {
      const result = await this.calculateRedemption({ userId, coinId: coin.id, merchantId, billAmount });
      if (result.success && (!bestResult || result.discountAmount > bestResult.discountAmount)) {
        bestResult = result;
        bestCoin = coin;
      }
    }

    if (bestCoin && bestResult) {
      return { coin: bestCoin, result: bestResult };
    }

    return null;
  }
}

// ============================================
// CONVENIENCE INSTANCES & FUNCTIONS
// ============================================

export const crossBrandCoinsEngine = new CrossBrandCoinsEngine();

export async function createCrossBrandCoin(request: CoinCreationRequest): Promise<CrossBrandCoin> {
  return crossBrandCoinsEngine.createCoin(request);
}

export async function getCrossBrandBalance(userId: string, coinId: string): Promise<UserCrossBrandBalance> {
  return crossBrandCoinsEngine.getBalance(userId, coinId);
}

export async function redeemCrossBrandCoins(request: CoinRedemptionRequest): Promise<CoinRedemptionResult> {
  return crossBrandCoinsEngine.redeem(request);
}

export async function calculateCrossBrandRedemption(request: CoinRedemptionRequest): Promise<CoinRedemptionResult> {
  return crossBrandCoinsEngine.calculateRedemption(request);
}

export async function getNetworkStatistics(networkType: NetworkType): Promise<NetworkStats> {
  return crossBrandCoinsEngine.getNetworkStats(networkType);
}
